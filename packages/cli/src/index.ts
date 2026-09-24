#!/usr/bin/env node
/**
 * lineage - command line for the Lineage DNA and genealogy framework.
 *
 *   lineage inspect   <kit>                         summary, sex inference, runs of homozygosity
 *   lineage traits    <kit>                         trait calls from the curated knowledge base
 *   lineage compare   <kitA> <kitB> [--map file]    half/fully identical regions between two kits
 *   lineage segments  <csv>                         summarise a segment export and predict relationships
 *   lineage gedcom    <file> [--rel @I1@ @I2@]      tree statistics; relationship between two people
 *   lineage panel     <kit> --out panel.json        build a 1000 Genomes reference panel from Ensembl
 *   lineage admixture <kit> --panel panel.json      supervised admixture against a panel
 *   lineage haplogroup <kit> --tree file --chrom Y|MT [--isogg]
 *   lineage report    <kit> [--gedcom f] [--panel f] [--segments f] --out report.json
 *   lineage narrate   <report.json> [--md out.md]   grounded narrative with Claude
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  parseRawKit, summariseKit, inferSex, runsOfHomozygosity, compareKits, parseHapMapGeneticMap,
  parseSegmentTable, summariseMatches, predictRelationship, parseGedcom, gedcomStats, findRelationship,
  callTraits, estimateAdmixture, parseSimpleTree, parseIsoggSnpIndex, callHaplogroup, ReportBuilder,
  type ReferencePanel, type Kit,
} from "@lineage/core";
import { TRAITS } from "@lineage/kb";
import { buildThousandGenomesPanel } from "@lineage/fetch";

const args = process.argv.slice(2);
const cmd = args[0];
const positional = args.slice(1).filter((a, i, arr) => !a.startsWith("--") && !(arr[i - 1]?.startsWith("--") && !isFlagWithoutValue(arr[i - 1]!)));
function isFlagWithoutValue(f: string): boolean { return ["--isogg", "--json"].includes(f); }
function flag(name: string): string | undefined { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; }
function has(name: string): boolean { return args.includes(`--${name}`); }
const json = has("json");

function loadKit(path: string): Kit {
  const t0 = Date.now();
  const { kit, report } = parseRawKit(readFileSync(path, "utf8"));
  if (!json) console.error(`Loaded ${path}: ${report.format}, ${report.rowsKept.toLocaleString()} variants (${Date.now() - t0} ms)` + (report.rowsRead - report.rowsKept ? `, skipped ${report.rowsRead - report.rowsKept}` : ""));
  return kit;
}
const out = (o: unknown) => console.log(JSON.stringify(o, null, 2));
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  switch (cmd) {
    case "inspect": {
      const kit = loadKit(positional[0]!);
      const summary = summariseKit(kit), sex = inferSex(kit), roh = runsOfHomozygosity(kit);
      if (json) return out({ summary, sex, roh });
      console.log(`Format ${summary.format}, build ${summary.build}; ${summary.variants.toLocaleString()} variants, call rate ${pct(summary.callRate)}, autosomal heterozygosity ${pct(summary.autosomalHeterozygosity)}`);
      console.log(`Sex: ${sex.inferred} (${sex.rationale})`);
      console.log(`Runs of homozygosity > 4 Mb: ${roh.length}, total ${(roh.reduce((a, s) => a + s.lengthBp, 0) / 1e6).toFixed(1)} Mb`);
      for (const s of roh.slice(0, 10)) console.log(`  chr${s.chrom} ${s.start.toLocaleString()}-${s.end.toLocaleString()} (${(s.lengthBp / 1e6).toFixed(1)} Mb, ${s.snps} SNPs)`);
      return;
    }
    case "traits": {
      const kit = loadKit(positional[0]!);
      const calls = callTraits(kit, TRAITS);
      if (json) return out(calls);
      for (const c of calls) {
        const head = `${c.variant.name} [${c.variant.gene} ${c.variant.rsid}]`;
        if (c.status === "called" || c.status === "strand-flipped") console.log(`${head}\n  ${c.genotype}: ${c.interpretation}${c.status === "strand-flipped" ? " (genotype was strand-flipped)" : ""}\n  Source: ${c.variant.sources.map((s) => `${s.authors.split(",")[0]} ${s.year}, PMID ${s.pmid}`).join("; ")}`);
        else console.log(`${head}\n  ${c.status}${c.note ? `: ${c.note}` : ""}`);
      }
      return;
    }
    case "compare": {
      const a = loadKit(positional[0]!), b = loadKit(positional[1]!);
      const mapPath = flag("map");
      const map = mapPath ? parseHapMapGeneticMap(readFileSync(mapPath, "utf8")) : undefined;
      const r = compareKits(a, b, { map });
      if (json) return out(r);
      console.log(`Shared SNPs ${r.sharedSnps.toLocaleString()}, comparable ${r.comparableSnps.toLocaleString()}, opposite-homozygous rate ${(r.oppositeHomozygousRate * 100).toFixed(2)}%`);
      const fmt = (bp: number, cm?: number) => cm !== undefined ? `${cm.toFixed(1)} cM` : `${(bp / 1e6).toFixed(1)} Mb`;
      console.log(`Half-identical: ${r.halfIdentical.length} segments, ${fmt(r.totals.halfBp, r.totals.halfCm)}`);
      console.log(`Fully identical: ${r.fullyIdentical.length} segments, ${fmt(r.totals.fullBp, r.totals.fullCm)}`);
      for (const s of r.halfIdentical) console.log(`  chr${s.chrom} ${s.start.toLocaleString()}-${s.end.toLocaleString()} ${fmt(s.lengthBp, s.lengthCm)} ${s.snps} SNPs`);
      if (!map) console.log("(No genetic map supplied; lengths are physical. Pass --map <HapMap-format file> for cM.)");
      return;
    }
    case "segments": {
      const { segments, skipped } = parseSegmentTable(readFileSync(positional[0]!, "utf8"));
      const rows = summariseMatches(segments).map((m) => ({ ...m, prediction: predictRelationship(m.autosomalCm) }));
      if (json) return out(rows);
      console.log(`${segments.length} segments, ${rows.length} matches${skipped ? `, ${skipped} rows skipped` : ""}`);
      for (const m of rows.slice(0, 40)) {
        console.log(`${m.match}: ${m.autosomalCm.toFixed(1)} cM / ${m.segments} segments (longest ${m.longestCm.toFixed(1)})`);
        console.log(`  consistent with: ${m.prediction.candidates.slice(0, 6).map((c) => `${c.entry.label} (avg ${c.entry.average})`).join(", ") || "none"}`);
      }
      return;
    }
    case "gedcom": {
      const file = parseGedcom(readFileSync(positional[0]!, "utf8"));
      const stats = gedcomStats(file);
      const relIdx = args.indexOf("--rel");
      const rel = relIdx !== -1 ? findRelationship(file, args[relIdx + 1]!, args[relIdx + 2]!) : undefined;
      if (json) return out({ stats, relationship: rel, warnings: file.warnings });
      console.log(`${stats.individuals} individuals, ${stats.families} families; birth years ${stats.earliestBirthYear ?? "?"}-${stats.latestBirthYear ?? "?"}`);
      console.log(`Top surnames: ${stats.surnames.map((s) => `${s.surname} (${s.count})`).join(", ")}`);
      if (file.warnings.length) console.log(`${file.warnings.length} integrity warnings; first: ${file.warnings[0]}`);
      if (relIdx !== -1) {
        const [x, y] = [args[relIdx + 1]!, args[relIdx + 2]!];
        const nx = file.individuals.get(x)?.name ?? x, ny = file.individuals.get(y)?.name ?? y;
        if (!rel) console.log(`${nx} and ${ny}: no common ancestor in this tree`);
        else console.log(`${ny} is ${nx}'s ${rel.description}; r = ${rel.math.coefficientOfRelationship.toFixed(4)}, expected shared DNA ≈ ${pct(rel.math.expectedHalfIdenticalFraction)}; via ${rel.commonAncestors.map((id) => file.individuals.get(id)?.name ?? id).join(" & ")}`);
      }
      return;
    }
    case "panel": {
      const kit = loadKit(positional[0]!);
      const panel = await buildThousandGenomesPanel(kit, { maxSnps: Number(flag("max") ?? 4000), onProgress: (d, t) => console.error(`  fetched ${d}/${t}`) });
      writeFileSync(flag("out") ?? "panel.json", JSON.stringify(panel));
      console.error(`Panel: ${panel.snps.length} SNPs after thinning, populations ${panel.populations.join(", ")}`);
      return;
    }
    case "admixture": {
      const kit = loadKit(positional[0]!);
      const panel = JSON.parse(readFileSync(flag("panel")!, "utf8")) as ReferencePanel;
      const r = estimateAdmixture(kit, panel);
      if (json) return out(r);
      console.log(`Supervised admixture over ${r.snpsUsed.toLocaleString()} SNPs (${r.iterations} EM iterations):`);
      r.populations.forEach((p, i) => console.log(`  ${p.padEnd(5)} ${pct(r.proportions[i]!).padStart(6)}   95% CI ${pct(r.ci95[i]![0])}-${pct(r.ci95[i]![1])}`));
      for (const c of r.caveats) console.log(`  note: ${c}`);
      return;
    }
    case "haplogroup": {
      const kit = loadKit(positional[0]!);
      const chrom = (flag("chrom") ?? "Y") as "Y" | "MT";
      const text = readFileSync(flag("tree")!, "utf8");
      const tree = has("isogg") ? parseIsoggSnpIndex(text, 37) : parseSimpleTree(text, chrom, chrom === "MT" ? "rCRS" : 37);
      const call = callHaplogroup(kit, tree);
      if (json) return out(call);
      console.log(call.note);
      for (const p of call.path) console.log(`  ${p.node}: ${p.derived} derived (${p.derivedNames.slice(0, 5).join(", ")}), ${p.ancestral} ancestral, ${p.noCall} no-call`);
      if (call.ambiguous.length) console.log(`  ambiguous: ${call.ambiguous.map((a) => `${a.node} (${a.derived}+/${a.ancestral}-)`).join(", ")}`);
      return;
    }
    case "report": {
      const kit = loadKit(positional[0]!);
      const rb = new ReportBuilder({ label: flag("label") ?? "the tester", kitFormat: kit.meta.format });
      rb.kit(summariseKit(kit)).sex(inferSex(kit)).roh(runsOfHomozygosity(kit)).traits(callTraits(kit, TRAITS));
      if (flag("panel")) rb.admixture(estimateAdmixture(kit, JSON.parse(readFileSync(flag("panel")!, "utf8"))));
      if (flag("segments")) {
        const { segments } = parseSegmentTable(readFileSync(flag("segments")!, "utf8"));
        rb.matches(summariseMatches(segments).map((m) => ({ ...m, prediction: predictRelationship(m.autosomalCm) })));
      }
      if (flag("gedcom")) {
        const file = parseGedcom(readFileSync(flag("gedcom")!, "utf8"));
        rb.gedcom(gedcomStats(file));
        const relIdx = args.indexOf("--rel");
        if (relIdx !== -1) {
          const r = findRelationship(file, args[relIdx + 1]!, args[relIdx + 2]!);
          if (r) rb.relationship(r, file.individuals.get(r.a)?.name ?? r.a, file.individuals.get(r.b)?.name ?? r.b);
        }
      }
      const report = rb.build();
      const outPath = flag("out");
      if (outPath) { writeFileSync(outPath, JSON.stringify(report, null, 2)); console.error(`Wrote ${outPath}: ${report.facts.length} facts`); }
      else out(report);
      return;
    }
    case "narrate": {
      const { narrateReport, narrativeToMarkdown } = await import("@lineage/ai");
      const report = JSON.parse(readFileSync(positional[0]!, "utf8"));
      const res = await narrateReport(report, { model: flag("model") });
      const md = narrativeToMarkdown(res.narrative);
      if (flag("md")) writeFileSync(flag("md")!, md);
      console.log(md);
      if (res.rejectedParagraphs.length) console.error(`Rejected ${res.rejectedParagraphs.length} paragraph(s) with unverifiable citations:\n` + res.rejectedParagraphs.map((r) => `  [${r.section}] ${r.reason}`).join("\n"));
      console.error(`Model ${res.model}; ${res.usage.inputTokens} in / ${res.usage.outputTokens} out tokens`);
      return;
    }
    default:
      console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0]!.replace(/^#!.*\n\/\*\*\n/, "").replace(/^ \* ?/gm, ""));
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
