/**
 * Segment file parsers. Every vendor exports "matching segments" as a table
 * with some spelling of: match name, chromosome, start, end, cM, SNPs.
 * Known layouts:
 *   - GEDmatch one-to-one / segment CSV:  Chr, B37 Start Pos'n, B37 End Pos'n, Centimorgans (cM), SNPs
 *   - DNA Painter:                        Chromosome, Start Location, End Location, Centimorgans, Matching SNPs, Match Name
 *   - 23andMe:                            Chromosome Number, Chromosome Start Point, Chromosome End Point, Genetic Distance, # of Matching SNPs
 *   - FamilyTreeDNA chromosome browser:   MATCHNAME, CHROMOSOME, START LOCATION, END LOCATION, CENTIMORGANS, MATCHING SNPS
 *   - MyHeritage:                         Name, Chromosome, Start Location, End Location, Start RSID, End RSID, Centimorgans, SNPs
 */
import { type Chrom, normaliseChrom } from "../genome.js";
import { detectDelimiter, findColumn, iterateLines, splitDelimited } from "../util/csv.js";

export interface MatchSegment {
  match: string;
  chrom: Chrom;
  start: number;
  end: number;
  cm: number;
  snps?: number;
}

export interface SegmentParseResult {
  segments: MatchSegment[];
  skipped: number;
  columns: Record<string, number>;
}

export function parseSegmentTable(text: string, defaultMatchName = "match"): SegmentParseResult {
  const delim = detectDelimiter(text.slice(0, 8000));
  let cols: { match: number; chrom: number; start: number; end: number; cm: number; snps: number } | undefined;
  const segments: MatchSegment[] = [];
  let skipped = 0;
  for (const raw of iterateLines(text)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const f = splitDelimited(line, delim).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (!cols) {
      const chrom = findColumn(f, ["chromosome", "chr", "chromosome number", "chrom"]);
      const cm = findColumn(f, ["centimorgans", "centimorgans (cm)", "cm", "genetic distance", "shared cm", "segment cm", "length cm"]);
      if (chrom === -1 || cm === -1) continue; // keep looking for a header
      cols = {
        match: findColumn(f, ["match name", "matchname", "matched name", "matchedname", "match display name", "name", "match", "matched kit", "matching kit"]),
        chrom,
        start: findColumn(f, ["start", "start location", "b37 start pos'n", "b37 start", "start position", "chromosome start point", "start point", "start_position"]),
        end: findColumn(f, ["end", "end location", "b37 end pos'n", "b37 end", "end position", "chromosome end point", "end point", "end_position"]),
        cm,
        snps: findColumn(f, ["snps", "matching snps", "# of matching snps", "snp count", "num snps"]),
      };
      continue;
    }
    const chrom = normaliseChrom(f[cols.chrom] ?? "");
    const start = Number((f[cols.start] ?? "").replace(/,/g, ""));
    const end = Number((f[cols.end] ?? "").replace(/,/g, ""));
    const cm = Number((f[cols.cm] ?? "").replace(/,/g, ""));
    if (!chrom || !Number.isFinite(cm) || !Number.isFinite(start) || !Number.isFinite(end)) { skipped++; continue; }
    const snpsRaw = cols.snps === -1 ? undefined : Number((f[cols.snps] ?? "").replace(/,/g, ""));
    segments.push({
      match: cols.match === -1 ? defaultMatchName : (f[cols.match] || defaultMatchName),
      chrom, start, end, cm,
      snps: Number.isFinite(snpsRaw) ? snpsRaw : undefined,
    });
  }
  return { segments, skipped, columns: cols ? { ...cols } : {} };
}

export interface MatchSummary {
  match: string;
  totalCm: number;
  autosomalCm: number;
  xCm: number;
  longestCm: number;
  segments: number;
  /** Segments >= 7 cM, the usual threshold below which segments are unreliable. */
  segmentsOver7: number;
}

export function summariseMatches(segments: MatchSegment[], opts: { minCm?: number } = {}): MatchSummary[] {
  const minCm = opts.minCm ?? 0;
  const by = new Map<string, MatchSegment[]>();
  for (const s of segments) {
    if (s.cm < minCm) continue;
    let arr = by.get(s.match);
    if (!arr) { arr = []; by.set(s.match, arr); }
    arr.push(s);
  }
  const out: MatchSummary[] = [];
  for (const [match, segs] of by) {
    const autosomal = segs.filter((s) => s.chrom !== "X");
    const x = segs.filter((s) => s.chrom === "X");
    const autosomalCm = autosomal.reduce((a, s) => a + s.cm, 0);
    const xCm = x.reduce((a, s) => a + s.cm, 0);
    out.push({
      match,
      totalCm: autosomalCm + xCm,
      autosomalCm,
      xCm,
      longestCm: segs.reduce((a, s) => Math.max(a, s.cm), 0),
      segments: segs.length,
      segmentsOver7: segs.filter((s) => s.cm >= 7).length,
    });
  }
  return out.sort((a, b) => b.autosomalCm - a.autosomalCm);
}

/**
 * Triangulation: find regions where several matches overlap the tester on the
 * same chromosome. Overlap alone does not prove all three share a common
 * ancestor (the matches must also match each other), so the result is labelled
 * as a candidate cluster, not a confirmed triangulated group.
 */
export interface OverlapCluster { chrom: Chrom; start: number; end: number; matches: string[] }

export function overlapClusters(segments: MatchSegment[], minOverlapBp = 3_000_000, minMatches = 2): OverlapCluster[] {
  const out: OverlapCluster[] = [];
  const byChrom = new Map<Chrom, MatchSegment[]>();
  for (const s of segments) {
    let arr = byChrom.get(s.chrom);
    if (!arr) { arr = []; byChrom.set(s.chrom, arr); }
    arr.push(s);
  }
  for (const [chrom, segs] of byChrom) {
    segs.sort((a, b) => a.start - b.start);
    for (let i = 0; i < segs.length; i++) {
      const a = segs[i]!;
      const group = [a];
      let start = a.start, end = a.end;
      for (let j = i + 1; j < segs.length; j++) {
        const b = segs[j]!;
        if (b.match === a.match) continue;
        const os = Math.max(start, b.start), oe = Math.min(end, b.end);
        if (oe - os >= minOverlapBp) { group.push(b); start = os; end = oe; }
      }
      const names = [...new Set(group.map((g) => g.match))];
      if (names.length >= minMatches) out.push({ chrom, start, end, matches: names });
    }
  }
  // Deduplicate identical clusters
  const seen = new Set<string>();
  return out.filter((c) => { const k = `${c.chrom}:${c.start}-${c.end}:${c.matches.join("|")}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
