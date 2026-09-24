/**
 * Raw consumer genotype file parser.
 *
 * Supported vendor layouts (all GRCh37, forward strand):
 *  - 23andMe:        "# ..." comments, then rsid<TAB>chromosome<TAB>position<TAB>genotype
 *  - AncestryDNA:    "#AncestryDNA raw data download" comments, header row
 *                    rsid<TAB>chromosome<TAB>position<TAB>allele1<TAB>allele2;
 *                    chromosome 23=X, 24=Y, 25=PAR (X), 26=MT; "0" = no call
 *  - FamilyTreeDNA:  CSV, header RSID,CHROMOSOME,POSITION,RESULT with quoted fields
 *  - MyHeritage:     "# MyHeritage DNA raw data." comments, then the same CSV layout as FTDNA
 *  - Living DNA:     "# Living DNA ..." comments, then rsid<TAB>chromosome<TAB>position<TAB>genotype
 *  - generic:        any delimited file with recognisable header names
 *
 * The parser never guesses beyond what the file says: unknown chromosomes,
 * malformed positions and unparsable rows are counted and reported rather than
 * silently dropped.
 */
import { normaliseChrom, type Chrom } from "../genome.js";
import { Kit, makeGenotype, type KitFormat, type KitMeta, type Variant } from "../kit/kit.js";
import { detectDelimiter, findColumn, iterateLines, splitDelimited } from "../util/csv.js";

export interface ParseReport {
  format: KitFormat;
  rowsRead: number;
  rowsKept: number;
  skipped: { unknownChrom: number; badPosition: number; malformed: number };
  /** Sample of skipped raw lines for debugging (max 10). */
  skippedSamples: string[];
}

export interface ParsedKit { kit: Kit; report: ParseReport }

export function detectFormat(head: string): KitFormat {
  const h = head.slice(0, 4000);
  const lower = h.toLowerCase();
  if (lower.includes("23andme")) return "23andme";
  if (lower.includes("ancestrydna")) return "ancestrydna";
  if (lower.includes("myheritage")) return "myheritage";
  if (lower.includes("living dna") || lower.includes("livingdna")) return "livingdna";
  if (/^\s*"?RSID"?\s*,\s*"?CHROMOSOME"?\s*,\s*"?POSITION"?\s*,\s*"?RESULT"?/im.test(h)) return "ftdna";
  return "generic";
}

function extractChipVersion(headerLines: string[]): string | undefined {
  for (const l of headerLines) {
    const m = l.match(/(?:version|chip|build)\s*[:=]?\s*([\w.\-]+)/i);
    if (m && !/build\s*3[78]/i.test(l)) return m[1];
  }
  return undefined;
}

export function parseRawKit(text: string): ParsedKit {
  const format = detectFormat(text);
  const headerLines: string[] = [];
  const rows: Variant[] = [];
  const report: ParseReport = {
    format, rowsRead: 0, rowsKept: 0,
    skipped: { unknownChrom: 0, badPosition: 0, malformed: 0 },
    skippedSamples: [],
  };

  let delim: string | undefined;
  let cols: { rsid: number; chrom: number; pos: number; geno: number; a1: number; a2: number } | undefined;

  const skip = (line: string, kind: keyof ParseReport["skipped"]) => {
    report.skipped[kind]++;
    if (report.skippedSamples.length < 10) report.skippedSamples.push(line.slice(0, 120));
  };

  for (const rawLine of iterateLines(text)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) { headerLines.push(line); continue; }

    if (!delim) delim = detectDelimiter(text.slice(0, 8000));
    const fields = splitDelimited(line, delim).map((f) => f.trim().replace(/^"|"$/g, ""));

    if (!cols) {
      // Is this a header row?
      const rsidCol = findColumn(fields, ["rsid", "snp", "marker", "id", "name"]);
      const looksLikeHeader = rsidCol !== -1 && !fields.some((f) => /^\d+$/.test(f));
      if (looksLikeHeader) {
        cols = {
          rsid: rsidCol,
          chrom: findColumn(fields, ["chromosome", "chrom", "chr"]),
          pos: findColumn(fields, ["position", "pos", "bp", "start"]),
          geno: findColumn(fields, ["genotype", "result", "call", "alleles"]),
          a1: findColumn(fields, ["allele1", "allele 1", "a1"]),
          a2: findColumn(fields, ["allele2", "allele 2", "a2"]),
        };
        continue;
      }
      // Headerless (23andMe / Living DNA style): rsid chrom pos genotype
      cols = { rsid: 0, chrom: 1, pos: 2, geno: 3, a1: -1, a2: -1 };
      if (fields.length === 5 && (fields[4]?.length ?? 0) <= 1) cols = { rsid: 0, chrom: 1, pos: 2, geno: -1, a1: 3, a2: 4 };
    }

    report.rowsRead++;
    const rsid = fields[cols.rsid] ?? "";
    const chromRaw = fields[cols.chrom];
    const posRaw = fields[cols.pos];
    if (chromRaw === undefined || posRaw === undefined) { skip(line, "malformed"); continue; }
    const chrom: Chrom | undefined = normaliseChrom(chromRaw);
    if (!chrom) { skip(line, "unknownChrom"); continue; }
    const pos = Number(posRaw);
    if (!Number.isInteger(pos) || pos <= 0) { skip(line, "badPosition"); continue; }

    let genotype: string;
    if (cols.geno !== -1 && fields[cols.geno] !== undefined) {
      const g = fields[cols.geno]!;
      genotype = g.length === 2 ? makeGenotype(g[0]!, g[1]) : makeGenotype(g, undefined);
    } else if (cols.a1 !== -1) {
      genotype = makeGenotype(fields[cols.a1] ?? "", fields[cols.a2]);
    } else { skip(line, "malformed"); continue; }

    rows.push({ rsid, chrom, pos, genotype });
    report.rowsKept++;
  }

  const meta: KitMeta = {
    format,
    build: 37,
    headerLines,
    strand: format === "generic" ? "unknown" : "plus",
    chipVersion: extractChipVersion(headerLines),
  };
  return { kit: new Kit(meta, rows), report };
}

/** Serialise a kit back to the 23andMe text layout (useful for tests and interchange). */
export function toTwentyThreeAndMeText(kit: Kit, comment = "# Generated by Lineage"): string {
  const out: string[] = [comment, "# rsid\tchromosome\tposition\tgenotype"];
  for (const v of kit.variants()) out.push(`${v.rsid}\t${v.chrom}\t${v.pos}\t${v.genotype || "--"}`);
  return out.join("\n") + "\n";
}
