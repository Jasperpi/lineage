#!/usr/bin/env node
/**
 * Step 8. Validation of the ancestry methods on genomes whose answer is known,
 * using the same code the browser runs (@lineage/core).
 *
 * Test genomes are spliced from real 1000 Genomes phase 3 genotypes: each
 * autosome is cut into blocks of 15-60 cM, and each block takes both copies
 * from a genome of continent X, both from continent Y, or one copy from each
 * (one allele drawn from each person's genotype, at random where they are
 * heterozygous). The painter's calls are then compared with the known state
 * of every window, and the component estimates with the known proportions.
 * Unadmixed genomes from each continent are painted as controls.
 *
 * Caveat, stated with the results: the test genomes' donors are among the
 * 2,504 genomes the component frequencies were learned from, which flatters
 * the numbers slightly (each donor is one of about 500 per continent).
 *
 * Requires steps 1-5 and the built core package. Output: data/reference/validation.json
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { CACHE, REFERENCE, today, writeJson } from "./lib.mjs";
import {
  AUTOSOMES, componentAdmixture, decodeReferencePanel, geneticMapFromCompact, mulberry32, paintChromosomes,
} from "../../packages/core/dist/index.js";

const panel = decodeReferencePanel(gunzipSync(readFileSync(`${REFERENCE}/panel.1000g.bin.gz`)).buffer);
const map = geneticMapFromCompact(JSON.parse(readFileSync(`${REFERENCE}/genetic-map.grch37.json`, "utf8")));
const ref = JSON.parse(readFileSync(`${REFERENCE}/reference-samples.json`, "utf8"));
const N_SAMPLES = ref.pop.length;
const K = panel.header.components.length;
const COMP = panel.header.components.map((c) => c.id);

// Dosage rows: map each dense panel SNP to its row in the per-chromosome dosage matrix.
const rowOf = new Map();
{
  const perChrom = new Map();
  for (const line of readFileSync(`${CACHE}/1000g-counts.tsv`, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const t1 = line.indexOf("\t"), t2 = line.indexOf("\t", t1 + 1), t3 = line.indexOf("\t", t2 + 1);
    const chrom = line.slice(t1 + 1, t2), pos = line.slice(t2 + 1, t3);
    const k = perChrom.get(chrom) ?? 0;
    rowOf.set(`${chrom}:${pos}`, k);
    perChrom.set(chrom, k + 1);
  }
}
const dosageFiles = new Map(AUTOSOMES.map((c) => [c, readFileSync(`${CACHE}/1000g-dosage.chr${c}.u8`)]));
const N = panel.header.nSnp;
const rows = new Int32Array(N);
for (let i = 0; i < N; i++) {
  const c = panel.header.chromosomes[panel.chromIdx[i]];
  const r = rowOf.get(`${c}:${panel.pos[i]}`);
  if (r === undefined) throw new Error(`panel SNP ${c}:${panel.pos[i]} has no dosage row`);
  rows[i] = r;
}
const dosageAt = (i, sample) => dosageFiles.get(panel.header.chromosomes[panel.chromIdx[i]])[rows[i] * N_SAMPLES + sample];
const cm = Float64Array.from({ length: N }, (_, i) => map.cM(panel.header.chromosomes[panel.chromIdx[i]], panel.pos[i]) ?? 0);

const rng = mulberry32(8);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const genomeOf = (s) => ({ dosage: Int8Array.from({ length: N }, (_, i) => { const d = dosageAt(i, s); return d > 2 ? -1 : d; }), called: N, strandFlipped: 0, alleleMismatch: 0, notOnChip: 0, noCall: 0, perChromosome: [] });

// Donors: genomes the model itself places at 95% or more of one component, projected with the
// component frequencies fixed exactly as a user's file is. Reference genomes are fixed to their
// continent's component while the components are fitted, but some carry real ancestry from
// elsewhere (East Asian segments in some Bengali genomes, for example), which the painter rightly
// finds; testing on those would count it as error. Up to 30 per component.
const MAX_DONORS = 30, MAX_TRIED = 150;
const donorLog = {};
const donors = COMP.map((_, k) => {
  const pool = ref.q.map((q, s) => [q, s]).filter(([q]) => q[k] >= 950).map(([, s]) => s);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [];
  let tried = 0;
  for (const s of pool) {
    if (out.length >= MAX_DONORS || tried >= MAX_TRIED) break;
    tried++;
    if (componentAdmixture(panel, genomeOf(s), { replicates: 0 }).proportions[k] >= 0.95) out.push(s);
  }
  donorLog[COMP[k]] = { donors: out.length, tried, candidates: pool.length };
  process.stderr.write(`${COMP[k]}: ${out.length} donors of ${tried} tried (${pool.length} candidates)\n`);
  return out;
});

/** One test genome: per-SNP dosage and the true (a, b) component pair per SNP. */
function spliced(x, y) {
  const dosage = new Int8Array(N).fill(-1), truth = new Int16Array(N);
  const X = pick(donors[x]), X2 = pick(donors[x]), Y = pick(donors[y]), Y2 = pick(donors[y]);
  let i = 0;
  while (i < N) {
    const c = panel.chromIdx[i];
    const start = cm[i], len = 15 + rng() * 45;
    const state = Math.floor(rng() * 3); // 0: X/X, 1: X/Y, 2: Y/Y
    while (i < N && panel.chromIdx[i] === c && cm[i] < start + len) {
      const one = (s) => { const d = dosageAt(i, s); return d === 1 ? (rng() < 0.5 ? 1 : 0) : d / 2; };
      const d = state === 0 ? dosageAt(i, X) : state === 2 ? dosageAt(i, Y) : one(X2) + one(Y2);
      dosage[i] = d > 2 ? -1 : d;
      truth[i] = state === 0 ? x * K + x : state === 2 ? y * K + y : Math.min(x, y) * K + Math.max(x, y);
      i++;
    }
  }
  return { dosage, truth };
}
function control(k) {
  return { dosage: genomeOf(pick(donors[k])).dosage, truth: new Int16Array(N).fill(k * K + k) };
}

const THRESHOLDS = { cautious: 0.95, standard: 0.8, complete: 0.5 };
function score(genome) {
  const g = { dosage: genome.dosage, called: N, strandFlipped: 0, alleleMismatch: 0, notOnChip: 0, noCall: 0, perChromosome: [] };
  const adm = componentAdmixture(panel, g, { replicates: 5 });
  const painting = paintChromosomes(panel, g, adm.proportions, map);
  // Truth per window: the majority state among its SNPs.
  const out = Object.fromEntries(Object.keys(THRESHOLDS).map((k) => [k, { painted: 0, correct: 0, total: 0 }]));
  const byChrom = new Map(painting.chromosomes.map((c) => [c.chrom, c.windows]));
  let begin = 0;
  for (let c = 0; c < panel.header.chromosomes.length; c++) {
    let end = begin;
    while (end < N && panel.chromIdx[end] === c) end++;
    const wins = byChrom.get(panel.header.chromosomes[c]) ?? [];
    let j = begin;
    for (const w of wins) {
      while (j < end && panel.pos[j] < w.start) j++;
      const counts = new Map();
      for (let i = j; i < end && panel.pos[i] <= w.end; i++) counts.set(genome.truth[i], (counts.get(genome.truth[i]) ?? 0) + 1);
      const want = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const got = Math.min(w.pair[0], w.pair[1]) * K + Math.max(w.pair[0], w.pair[1]);
      for (const [k, t] of Object.entries(THRESHOLDS)) {
        out[k].total++;
        if (w.posterior >= t) { out[k].painted++; if (got === want) out[k].correct++; }
      }
    }
    begin = end;
  }
  // True proportions by SNP count on the autosomes.
  const trueQ = new Array(K).fill(0);
  for (let i = 0; i < N; i++) { const t = genome.truth[i]; trueQ[Math.floor(t / K)] += 0.5; trueQ[t % K] += 0.5; }
  return { windows: out, trueQ: trueQ.map((x) => x / N), estQ: adm.proportions };
}

const PAIRS = [[0, 1], [1, 2], [1, 3], [2, 3], [0, 2], [0, 4], [1, 4], [2, 4]];
const results = [];
for (const [x, y] of PAIRS) {
  if (!donors[x].length || !donors[y].length) { process.stderr.write(`skipping ${COMP[x]}-${COMP[y]}: no donor genomes\n`); continue; }
  for (let r = 0; r < 3; r++) {
    const res = score(spliced(x, y));
    results.push({ kind: "spliced", pair: `${COMP[x]}-${COMP[y]}`, ...res });
    process.stderr.write(`${COMP[x]}-${COMP[y]} #${r + 1}: standard ${res.windows.standard.correct}/${res.windows.standard.painted} of ${res.windows.standard.total}\n`);
  }
}
for (let k = 0; k < K; k++) {
  if (!donors[k].length) continue;
  for (let r = 0; r < 2; r++) {
    const res = score(control(k));
    results.push({ kind: "control", pair: `${COMP[k]}`, ...res });
    process.stderr.write(`control ${COMP[k]} #${r + 1}: standard ${res.windows.standard.correct}/${res.windows.standard.painted} of ${res.windows.standard.total}\n`);
  }
}

const summarise = (list) => Object.fromEntries(Object.keys(THRESHOLDS).map((k) => {
  const p = list.reduce((a, r) => a + r.windows[k].painted, 0), c = list.reduce((a, r) => a + r.windows[k].correct, 0), t = list.reduce((a, r) => a + r.windows[k].total, 0);
  return [k, { accuracy: Number((c / Math.max(1, p)).toFixed(4)), painted: Number((p / Math.max(1, t)).toFixed(4)), windows: t }];
}));
const byPair = {};
for (const r of results) (byPair[r.pair] ??= []).push(r);
const mae = (list) => Number((list.reduce((a, r) => a + r.trueQ.reduce((s, q, k) => s + Math.abs(q - r.estQ[k]), 0) / K, 0) / list.length).toFixed(4));

writeJson(`${REFERENCE}/validation.json`, {
  id: "validation.ancestry",
  title: "Painting and component estimates on spliced real genomes",
  method: "Autosomes cut into 15-60 cM blocks; each block takes both copies from a donor of continent X, both from Y, or one allele from each (drawn at random at heterozygous sites). Donors are 1000 Genomes phase 3 genomes that the model itself places at 95% or more of one component when projected like a user's file (up to 30 per component), so that real ancestry from elsewhere in a donor is not counted as a painting error. The painter and the component EM are the browser's code (@lineage/core).",
  caveat: "Donors are among the genomes the component frequencies were learned from (one of about 500 per continent), which flatters the results slightly. Splicing at block edges and drawing single alleles at heterozygous sites break some linkage, so real genomes may be a little harder.",
  generated: today(),
  script: "scripts/data/08-validate.mjs",
  thresholds: THRESHOLDS,
  donors: Object.fromEntries(COMP.map((c, k) => [c, donors[k].length])),
  donorSelection: donorLog,
  overall: summarise(results.filter((r) => r.kind === "spliced")),
  controls: summarise(results.filter((r) => r.kind === "control")),
  byPair: Object.fromEntries(Object.entries(byPair).map(([k, list]) => [k, { genomes: list.length, ...summarise(list), componentMae: mae(list) }])),
  componentMae: mae(results.filter((r) => r.kind === "spliced")),
});
