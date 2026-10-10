#!/usr/bin/env node
/**
 * Run the ancestry engine on your own raw file and compare it with a vendor's
 * result, locally. Nothing is written anywhere and nothing leaves the machine.
 *
 *   node scripts/local/personal-check.mjs data/private/genome.23andme.txt [data/private/composition.23andme.csv]
 *
 * Keep personal files in data/private/ (gitignored). The optional second file
 * is 23andMe's "Ancestry Composition" segment export; its segments are summed
 * by length into shares at each of its categories and at Lineage's continents.
 * Needs `npm run build` first (it imports packages/core/dist).
 * Set LINEAGE_CORE=/path/to/another/core/dist to run an older engine for a before/after.
 */
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const core = await import(process.env.LINEAGE_CORE ? resolve(process.env.LINEAGE_CORE, "index.js") : resolve(root, "packages/core/dist/index.js"));
const [kitPath, compPath] = process.argv.slice(2);
if (!kitPath) { console.error("usage: personal-check.mjs <raw file> [23andMe composition csv]"); process.exit(1); }

// LINEAGE_PANEL points at another build (for example data/.cache/validation); the genetic map always comes from data/reference.
const panelDir = process.env.LINEAGE_PANEL ? resolve(process.env.LINEAGE_PANEL) : resolve(root, "data/reference");
const ref = (f) => resolve(f.startsWith("genetic-map") ? resolve(root, "data/reference") : panelDir, f);
const base = existsSync(ref("panel.bin.gz")) ? "panel" : "panel.1000g";
// A small Buffer shares Node's pool, so its bytes must be sliced out before decoding.
const unzip = (path) => { const b = gunzipSync(readFileSync(path)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const t0 = performance.now();
const panel = core.decodeReferencePanel(unzip(ref(`${base}.bin.gz`)));
const meta = JSON.parse(readFileSync(ref(`${base}.json`), "utf8"));
if (panel.header.version === 1 && core.applyGroupSizes) {
  const pops = JSON.parse(readFileSync(ref("populations.json"), "utf8"));
  core.applyGroupSizes(panel, Object.fromEntries(pops.populations.map((p) => [p.code, p.samples])), meta.admixture.meanProportions);
}
for (const t of panel.header.tiers ?? []) if (existsSync(ref(t.file))) core.attachTier(panel, core.decodePanelTier(unzip(ref(t.file))));
const map = core.geneticMapFromCompact(JSON.parse(readFileSync(ref("genetic-map.grch37.json"), "utf8")));
const calibration = existsSync(ref("calibration.json")) ? JSON.parse(readFileSync(ref("calibration.json"), "utf8")) : undefined;
const { kit } = core.parseRawKit(readFileSync(kitPath, "utf8"));
const tLoad = performance.now();

const time = (label, f) => { const s = performance.now(); const r = f(); console.log(`  ${label.padEnd(26)} ${((performance.now() - s) / 1000).toFixed(2)} s`); return r; };
console.log(`\nEngine: ${process.env.LINEAGE_CORE ?? "packages/core/dist"}; panel v${panel.header.version}, ${panel.header.nSnp.toLocaleString()} SNPs, ${panel.tiers?.length ?? 0} tiers; calibration ${calibration ? calibration.generated ?? "yes" : "none"}; load ${((tLoad - t0) / 1000).toFixed(1)} s`);
const build = core.detectBuild ? core.detectBuild(kit, panel) : { build: 37 };
const g = time("match to panel", () => core.panelGenotypes(kit, panel, { build: build.build === 38 ? 38 : 37 }));
console.log(`  build ${build.build}; ${g.called.toLocaleString()} of ${panel.header.nSnp.toLocaleString()} panel SNPs called; flipped ${g.strandFlipped}, mismatched ${g.alleleMismatch}, conflicting ${g.conflicting ?? "-"}`);
const adm = time("continental components", () => core.componentAdmixture(panel, g, { calibration, map }));
const reg = panel.tiers?.length ? time("regional components", () => core.componentAdmixture(panel, g, { calibration, level: "region" })) : undefined;
const sim = time("similarity", () => core.populationSimilarity(panel, g, { calibration }));
const paint = time("painting", () => core.paintChromosomes(panel, g, adm.proportions, map, { calibration }));
const pca = time("PCA", () => core.projectPca(panel, g, { map, replicates: 200 }));

const pct = (x) => `${(x * 100).toFixed(1).padStart(5)}%`;
console.log("\nContinental components (95% interval, present?)");
adm.components.forEach((c, k) => console.log(`  ${c.padEnd(6)} ${pct(adm.proportions[k])}  ${pct(adm.ci95[k][0])}–${pct(adm.ci95[k][1])}  ${adm.present ? (adm.present[k] ? "present" : "-") : ""}${adm.lrZero ? `  LR0 ${adm.lrZero[k].toFixed(1)}` : ""}`));
if (reg && core.ancestryTree) {
  console.log("\nRegional tree");
  for (const n of core.ancestryTree(reg, { labels: Object.fromEntries(panel.header.components.map((c) => [c.id, c.label])) }).nodes) console.log(`  ${n.kind === "continent" ? "" : "  "}${n.label.padEnd(30)} ${pct(n.share)}  ${pct(n.ci95[0])}–${pct(n.ci95[1])}`);
}
const top = [...sim.scores].sort((a, b) => a.rank - b.rank).slice(0, 6);
if (sim.fit) console.log(`\nClosest-population fit: ${sim.fit.population} z = ${sim.fit.z.toFixed(2)} (LD inflation ${sim.fit.inflation.toFixed(2)}, ${sim.fit.gapPer1000.toFixed(1)} per 1,000 SNPs below a member)${sim.fit.outside === undefined ? " — uncalibrated" : sim.fit.outside ? " — no single population fits" : ""}`);
console.log(`Closest populations: ${top.map((s) => `${s.population}${s.probability !== undefined ? ` ${(s.probability * 100).toFixed(0)}%` : ` −${s.gapPer1000.toFixed(1)}`}`).join(", ")}${sim.set ? `\n95% set: ${sim.set.join(", ")}` : ""}`);
console.log(`\nPainting: ${paint.settings.generations} generations chosen; totals ${paint.components.map((c, k) => `${c} ${pct(paint.totals[k]).trim()}`).join(", ")}`);
if (paint.fit) console.log(`Fit: z = ${paint.fit.z.toFixed(2)} (LD inflation ${paint.fit.inflation.toFixed(2)}, ${paint.fit.windows} windows)${paint.fit.outside === undefined ? " — uncalibrated" : paint.fit.outside ? " — OUTSIDE the reference" : " — within the reference"}`);
console.log(`PCA: ${pca.pcs.slice(0, 4).map((x) => x.toFixed(4)).join(", ")}${pca.cov ? ` (sd ${pca.cov.slice(0, 4).map((r, i) => Math.sqrt(r[i]).toFixed(4)).join(", ")})` : ""}`);

if (compPath) {
  // 23andMe composition: segments per copy; sum lengths per category.
  const rows = readFileSync(compPath, "utf8").trim().split(/\r?\n/).slice(1).map((line) => {
    const cells = line.match(/("([^"]*)"|[^,]+)/g).map((c) => c.replace(/^"|"$/g, ""));
    return { ancestry: cells[0], copy: cells[1], len: Number(cells[4]) - Number(cells[3]) };
  });
  const total = rows.reduce((a, r) => a + r.len, 0);
  const by = new Map();
  for (const r of rows) by.set(r.ancestry, (by.get(r.ancestry) ?? 0) + r.len);
  const MENA = ["Arab, Egyptian & Levantine", "Peninsular Arab", "Western Asian & North African"];
  const cont = (name) => (MENA.includes(name) ? "Middle East & North Africa" : "European");
  const byCont = new Map();
  for (const [k, v] of by) byCont.set(cont(k), (byCont.get(cont(k)) ?? 0) + v);
  console.log("\n23andMe Ancestry Composition (0.5 confidence), by segment length");
  for (const [k, v] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(40)} ${pct(v / total)}`);
  console.log("  —");
  for (const [k, v] of byCont) console.log(`  ${k.padEnd(40)} ${pct(v / total)}`);
}
console.log("");
