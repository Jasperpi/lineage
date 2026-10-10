#!/usr/bin/env node
/**
 * Step 8. Validation and calibration of the ancestry engine.
 *
 * The browser's own code (@lineage/core) is run on genomes whose ancestry is
 * known, against a panel that never saw them: the validation build of step 5
 * (`--holdout`) is fitted on 80% of each population, and every test genome
 * here is made from the phased haplotypes of the other 20%.
 *
 * Test genomes
 *   single    each held-out genome as it is.
 *   pedigree  recent mixture: 4, 8 or 16 founders, one of them from another
 *             region, passed down through real meioses (shares of 25, 12.5
 *             and 6.25%).
 *   old       admixture 5-15 generations ago between two or three regions,
 *             minor shares from 1% to 50%, tracts from the genetic map.
 *   lopo      held-out genomes of a population tested with that population
 *             removed from the similarity reference (does the page notice?).
 * Each is read the way a chip would read it: all SNPs, or only the GSA's or
 * the OmniExpress's, with 0.2-0.5% of alleles misread and 1-3% no-calls.
 *
 * Half of the genomes (even index) calibrate; the other half measure. From the
 * first half: the similarity temperature and conformal threshold, the
 * likelihood-ratio inflation that gives 95% intervals their coverage, the
 * presence level of each component (99th percentile where it is truly
 * absent), each region's precision by share, the painter's isotonic map, and
 * the fit levels 1% of genomes fall below. From the second half: everything
 * validation.json reports.
 *
 *   node scripts/data/08-validate.mjs run   --dir data/.cache/validation --shard 0/4
 *   node scripts/data/08-validate.mjs merge --dir data/.cache/validation --out data/reference
 *
 * VALIDATE_SCALE (default 1) scales the number of simulated genomes.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve, join } from "node:path";
import {
  applyIsotonic, attachTier, componentAdmixture, componentColumns, conformalThreshold, decodePanelTier, decodeReferencePanel, fitIsotonic,
  founderHaplotype, geneticMapFromCompact, meiosis, mosaicHaplotype, mulberry32, paintChromosomes, panelCm, populationSimilarity, quantileSorted,
  similarityProbabilities, toGenotypes, trueProportions,
} from "../../packages/core/dist/index.js";
import { ROOT, REFERENCE, today } from "./lib.mjs";

const args = Object.fromEntries(process.argv.slice(3).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const mode = process.argv[2];
const DIR = resolve(args.dir ?? join(ROOT, "data/.cache/validation"));
const SCALE = Number(process.env.VALIDATE_SCALE ?? 1);
const CHI2_95 = 3.841459, CHI2BAR_99 = 5.411894;
const POST_BINS = 26; // raw posterior: [0, 0.5) then 25 bins of 0.02 up to 1
const postBin = (p) => (p < 0.5 ? 0 : Math.min(POST_BINS - 1, 1 + Math.floor((p - 0.5) / 0.02)));
const postCentre = (b) => (b === 0 ? 0.4 : 0.5 + (b - 0.5) * 0.02);
const Z_LO = -12, Z_STEP = 0.25, Z_BINS = 80; // window fit z histogram, -12 .. 8

const buf = (name) => { const b = gunzipSync(readFileSync(join(DIR, name))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

function load() {
  const panel = decodeReferencePanel(buf("panel.bin.gz"));
  const tiers = (panel.header.tiers ?? []).map((t) => decodePanelTier(buf(t.file)));
  const map = geneticMapFromCompact(JSON.parse(readFileSync(join(REFERENCE, "genetic-map.grch37.json"), "utf8")));
  const held = JSON.parse(readFileSync(join(DIR, "heldout.json"), "utf8"));
  const bits = readFileSync(join(DIR, "heldout.bin"));
  const cache = new Map();
  /** Haplotype `copy` of held-out genome `h`: ALT alleles per dense SNP. */
  const hap = (h, copy) => {
    const key = 2 * h + copy;
    let a = cache.get(key);
    if (!a) {
      a = new Uint8Array(held.snps);
      const byte = key >> 3, shift = 7 - (key & 7);
      for (let i = 0; i < held.snps; i++) a[i] = (bits[i * held.rowBytes + byte] >> shift) & 1;
      cache.set(key, a);
    }
    return a;
  };
  return { panel, tiers, map, held, hap };
}

/* ------------------------------------------------------------------ */
/* run: one shard of test genomes                                      */
/* ------------------------------------------------------------------ */

function run() {
  const [shard, shards] = (args.shard ?? "0/1").split("/").map(Number);
  const { panel, tiers, map, held, hap } = load();
  const cm = panelCm(panel, map);
  const conts = panel.header.components.map((c) => c.id);
  // Label space: the regional columns with every tier attached.
  for (const t of tiers) attachTier(panel, t);
  const cols = componentColumns(panel, "region", 0.001).map((c) => ({ id: c.id, parent: c.parent }));
  const R = cols.length;
  const colOf = (h) => {
    const r = cols.findIndex((c) => c.id === held.region[h]);
    if (r >= 0) return { col: r, known: true };
    const leaf = cols.findIndex((c) => c.id === held.continent[h]);
    if (leaf >= 0) return { col: leaf, known: true };
    return { col: cols.findIndex((c) => c.parent === held.continent[h]), known: false }; // a population in no region
  };
  const donors = Array.from({ length: R }, () => []);
  const singles = [];
  for (let h = 0; h < held.genomes; h++) {
    if (held.admixed[h]) continue;
    const c = colOf(h);
    singles.push({ h, ...c });
    if (c.known) donors[c.col].push(h);
  }
  const usable = donors.map((d, r) => (d.length >= 3 ? r : -1)).filter((r) => r >= 0);
  const chipMask = (bit) => Uint8Array.from(panel.chipMask ?? new Uint8Array(panel.header.nSnp).fill(3), (m) => (m >> bit) & 1);
  const CONDITIONS = [
    { id: "all", cond: {} },
    { id: "gsa", cond: { mask: chipMask(0), alleleError: 0.002, noCall: 0.01 } },
    { id: "omni", cond: { mask: chipMask(1), alleleError: 0.002, noCall: 0.02 } },
    { id: "gsa-noisy", cond: { mask: chipMask(0), alleleError: 0.005, noCall: 0.03 } },
  ];

  // The specs are a pure function of the seed, so shards agree on them.
  const specs = singles.map((s) => ({ type: "single", ...s }));
  const rs = mulberry32(8);
  const pickFrom = (list) => list[Math.floor(rs() * list.length)];
  const otherRegion = (a, sameContinent) => pickFrom(usable.filter((r) => r !== a && (cols[r].parent === cols[a].parent) === sameContinent)) ?? pickFrom(usable.filter((r) => r !== a));
  for (let i = 0; i < Math.round(160 * SCALE); i++) {
    const a = pickFrom(usable);
    specs.push({ type: "pedigree", generations: 2 + (i % 3), a, b: otherRegion(a, rs() < 0.3), seed: 1000 + i });
  }
  const MINOR = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
  for (let i = 0; i < Math.round(220 * SCALE); i++) {
    const a = pickFrom(usable), b = otherRegion(a, rs() < 0.25);
    const q = new Array(R).fill(0);
    const minor = MINOR[i % MINOR.length];
    if (i % 4 === 3) { const c = otherRegion(a, false); q[c] += minor / 2; q[b] += minor / 2; } else q[b] = minor;
    q[a] += 1 - minor;
    specs.push({ type: "old", generations: [5, 8, 12, 15][i % 4], q, seed: 5000 + i });
  }
  // Leave one population out of the similarity reference: populations with at least six held-out genomes.
  const byPop = new Map();
  singles.forEach((s) => { const p = held.population[s.h]; byPop.set(p, [...(byPop.get(p) ?? []), s]); });
  const lopoPops = [...byPop.entries()].filter(([, v]) => v.length >= 6).map(([p]) => p).filter((_, i) => i % 3 === 0);
  for (const p of lopoPops) for (const s of byPop.get(p).slice(0, 6)) specs.push({ type: "lopo", ...s, drop: p });

  const person = (rng, founders, level, idx) => {
    if (level === 0) { const f = founders[idx]; return [founderHaplotype(hap(f.h, 0), f.col), founderHaplotype(hap(f.h, 1), f.col)]; }
    const m = person(rng, founders, level - 1, idx * 2), f = person(rng, founders, level - 1, idx * 2 + 1);
    return [meiosis(rng, panel, cm, m[0], m[1]), meiosis(rng, panel, cm, f[0], f[1])];
  };
  const tierOf = (c) => tiers.find((t) => t.header.continent === c);
  const lines = [];
  const t0 = Date.now();
  specs.forEach((spec, index) => {
    if (index % shards !== shard) return;
    const rng = mulberry32(77 + index);
    let h0, h1, regionKnown = true, truePop;
    if (spec.type === "single" || spec.type === "lopo") {
      h0 = founderHaplotype(hap(spec.h, 0), spec.col); h1 = founderHaplotype(hap(spec.h, 1), spec.col);
      regionKnown = spec.known; truePop = held.population[spec.h];
    } else if (spec.type === "pedigree") {
      const n = 2 ** spec.generations;
      const r2 = mulberry32(spec.seed);
      const founders = Array.from({ length: n }, (_, i) => { const col = i === 0 ? spec.b : spec.a; return { h: donors[col][Math.floor(r2() * donors[col].length)], col }; });
      [h0, h1] = person(r2, founders, spec.generations, 0);
    } else {
      const r2 = mulberry32(spec.seed);
      const pools = donors.map((d) => d.flatMap((h) => [hap(h, 0), hap(h, 1)]));
      h0 = mosaicHaplotype(r2, panel, cm, pools, spec.q, spec.generations); h1 = mosaicHaplotype(r2, panel, cm, pools, spec.q, spec.generations);
    }
    const condition = CONDITIONS[index % CONDITIONS.length];
    const g = toGenotypes(rng, h0, h1, condition.cond, panel);
    const truthR = trueProportions(h0, h1, R, cm, panel);
    const truthC = conts.map((c) => cols.reduce((a, col, r) => a + (col.parent === c ? truthR[r] : 0), 0));
    const rec = { index, type: spec.type, cond: condition.id, generations: spec.generations, called: g.called, truthC, regionKnown, pop: truePop };

    if (spec.type === "lopo") {
      // Similarity only, with the genome's own population taken out of its tier.
      const t = tierOf(held.continent[spec.h]);
      const j = t.header.populations.indexOf(spec.drop);
      const P = t.header.populations.length, keep = t.header.populations.map((_, k) => k).filter((k) => k !== j);
      const popFreq = new Uint8Array((t.popFreq.length / P) * keep.length);
      for (let k = 0; k < t.popFreq.length / P; k++) keep.forEach((src, d) => { popFreq[k * keep.length + d] = t.popFreq[k * P + src]; });
      const cut = { ...t, popFreq, header: { ...t.header, populations: keep.map((k) => t.header.populations[k]), popAlleles: keep.map((k) => t.header.popAlleles[k]), popScale: keep.map((k) => t.header.popScale[k]) } };
      panel.tiers = [cut];
      rec.simFitZ = populationSimilarity(panel, g).fit.z;
      lines.push(JSON.stringify(rec));
      return;
    }

    panel.tiers = [];
    const cont = componentAdmixture(panel, g, { truth: truthC });
    rec.q = cont.proportions; rec.lrTruth = cont.lrTruth; rec.lrZero = cont.lrZero.map((x) => (Number.isFinite(x) ? x : 1e9)); rec.ci = cont.ci95;
    const paint = paintChromosomes(panel, g, cont.proportions, map);
    const hist = new Array(POST_BINS * 2).fill(0), zh = new Array(Z_BINS).fill(0);
    let at = 0;
    for (const ch of paint.chromosomes) {
      const c = panel.header.chromosomes.indexOf(ch.chrom);
      while (panel.chromIdx[at] !== c) at++;
      let i = at;
      for (const w of ch.windows) {
        const mid = (w.start + w.end) / 2;
        while (i + 1 < panel.header.nSnp && panel.chromIdx[i + 1] === c && panel.pos[i + 1] <= mid) i++;
        const a = conts.indexOf(cols[h0.labels[i]].parent), b = conts.indexOf(cols[h1.labels[i]].parent);
        const ok = (w.pair[0] === Math.min(a, b) && w.pair[1] === Math.max(a, b)) ? 1 : 0;
        hist[postBin(w.rawPosterior) * 2 + ok]++;
        zh[Math.max(0, Math.min(Z_BINS - 1, Math.floor((w.fitZ - Z_LO) / Z_STEP)))]++;
      }
    }
    rec.paint = { hist, zh, z: paint.fit.z, generations: paint.settings.generations, totals: paint.totals };

    // Regional fit and similarity with the tiers the app would load: continents at 2% or more.
    panel.tiers = tiers.filter((t) => cont.proportions[conts.indexOf(t.header.continent)] >= 0.02);
    const live = componentColumns(panel, "region", 0.001).map((c) => c.id);
    const reg = componentAdmixture(panel, g, { level: "region", truth: live.map((id) => truthRegionOf(id, cols, truthR, truthC, conts)) });
    rec.reg = { ids: live, q: reg.proportions, lrTruth: reg.lrTruth, lrZero: reg.lrZero.map((x) => (Number.isFinite(x) ? x : 1e9)), truth: live.map((id) => truthRegionOf(id, cols, truthR, truthC, conts)) };
    const sim = populationSimilarity(panel, g);
    const best = Math.max(...sim.scores.map((s) => s.logLik));
    rec.sim = { pops: sim.scores.map((s) => s.population), d: sim.scores.map((s) => Math.round((best - s.logLik) * 10) / 10), fitZ: sim.fit.z };
    lines.push(JSON.stringify(rec));
    if (lines.length % 20 === 0) process.stderr.write(`shard ${shard}: ${lines.length} genomes, ${Math.round((Date.now() - t0) / 1000)} s\n`);
  });
  writeFileSync(join(DIR, `validate.${shard}.jsonl`), lines.join("\n") + "\n");
  process.stderr.write(`shard ${shard}/${shards}: ${lines.length} of ${specs.length} genomes in ${Math.round((Date.now() - t0) / 1000)} s\n`);
}

/** True share of a live regional column: a region's own share, or the whole continent's when its tier is not loaded. */
function truthRegionOf(id, cols, truthR, truthC, conts) {
  const r = cols.findIndex((c) => c.id === id);
  const isLoadedRegion = r >= 0 && cols[r].parent !== id;
  if (isLoadedRegion) return truthR[r];
  return truthC[conts.indexOf(id)];
}

/* ------------------------------------------------------------------ */
/* merge: calibration from one half, validation from the other          */
/* ------------------------------------------------------------------ */

const sorted = (a) => [...a].sort((x, y) => x - y);
const q = (a, p) => (a.length ? quantileSorted(sorted(a), p) : NaN);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const share = (a, f) => (a.length ? a.filter(f).length / a.length : NaN);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : null);

function merge() {
  const meta = JSON.parse(readFileSync(join(DIR, "panel.json"), "utf8"));
  const recs = readdirSync(DIR).filter((f) => /^validate\.\d+\.jsonl$/.test(f)).flatMap((f) => readFileSync(join(DIR, f), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  recs.sort((a, b) => a.index - b.index);
  const cal = recs.filter((r) => r.index % 2 === 0), ev = recs.filter((r) => r.index % 2 === 1);
  const conts = meta.components.map((c) => c.id);
  const fitted = (rs) => rs.filter((r) => r.type !== "lopo");

  /* ---- similarity ---- */
  const simOf = (rs) => rs.filter((r) => r.type === "single" && r.sim && r.sim.pops.includes(r.pop));
  const probTrue = (r, T) => { const p = similarityProbabilities(r.sim.d.map((d) => -d), T); return { p, t: p[r.sim.pops.indexOf(r.pop)] }; };
  let bestT = 1, bestScore = -Infinity;
  for (let k = 0; k <= 40; k++) {
    const T = Math.exp((Math.log(3000) * k) / 40);
    const s = mean(simOf(cal).map((r) => Math.log(Math.max(1e-12, probTrue(r, T).t))));
    if (s > bestScore) { bestScore = s; bestT = T; }
  }
  const conformalQ95 = conformalThreshold(simOf(cal).map((r) => 1 - probTrue(r, bestT).t), 0.05);
  const simEval = simOf(ev).map((r) => {
    const { p, t } = probTrue(r, bestT);
    const rank = p.filter((x) => x > t).length + 1;
    const setSize = Math.max(1, p.filter((x) => 1 - x <= conformalQ95).length);
    return { rank, covered: 1 - t <= conformalQ95 || rank === 1, setSize };
  });
  const fitZ01 = q(simOf(cal).map((r) => r.sim.fitZ), 0.01);
  const lopo = ev.concat(cal).filter((r) => r.type === "lopo");
  const similarity = {
    genomes: simEval.length, temperature: r4(bestT), conformalQ95: r4(conformalQ95),
    coverage: r4(share(simEval, (x) => x.covered)), meanSetSize: r4(mean(simEval.map((x) => x.setSize))),
    top1: r4(share(simEval, (x) => x.rank === 1)), top3: r4(share(simEval, (x) => x.rank <= 3)),
    fit: { z01: r4(fitZ01), falseAlarm: r4(share(simOf(ev), (r) => r.sim.fitZ < fitZ01)), flaggedWhenPopulationRemoved: r4(share(lopo, (r) => r.simFitZ < fitZ01)), removedGenomes: lopo.length,
           flaggedWhenAdmixed: r4(share(fitted(ev).filter((r) => r.type !== "single"), (r) => r.sim.fitZ < fitZ01)) },
  };

  /* ---- components ---- */
  const BINS = [[0, 0, "absent"], [1e-9, 0.02, "under 2%"], [0.02, 0.1, "2-10%"], [0.1, 0.5, "10-50%"], [0.5, 1.0001, "over 50%"]];
  const inBin = (t, [lo, hi]) => (lo === 0 && hi === 0 ? t <= 1e-9 : t > Math.max(lo, 1e-9) - 1e-12 && t < hi);
  const level = (pick) => {
    const rows = (rs) => fitted(rs).flatMap((r) => { const x = pick(r); return x ? x.ids.map((id, k) => ({ id, t: x.truth[k], est: x.q[k], lr: x.lrTruth[k], lr0: x.lrZero[k], type: r.type, cond: r.cond })) : []; });
    const c = rows(cal), e = rows(ev);
    const phi = Math.max(1, q(c.map((x) => x.lr), 0.95) / CHI2_95);
    const ids = [...new Set(c.map((x) => x.id))];
    const presence = Object.fromEntries(ids.map((id) => [id, r4(Math.max(0.005, q(c.filter((x) => x.id === id && x.t <= 1e-9).map((x) => x.est), 0.99) || 0.005))]));
    const called = (x) => x.est > (presence[x.id] ?? 0.01) && x.lr0 / phi > CHI2BAR_99;
    const PB = [0.05, 0.1, 0.25, 0.5, 1];
    const byId = Object.fromEntries(ids.map((id) => [id, PB.map((hi, b) => {
      const lo = b ? PB[b - 1] : 0;
      const calls = e.concat(c).filter((x) => x.id === id && called(x) && x.est > lo && x.est <= hi);
      return calls.length >= 4 ? r4(share(calls, (x) => x.t >= 0.5 * x.est)) : 0;
    })]));
    return {
      phi: r4(phi), presence, precision: { bins: PB, byId },
      report: {
        estimates: e.length, phi: r4(phi),
        coverage: r4(share(e, (x) => x.lr <= CHI2_95 * phi)),
        coverageByShare: BINS.map((b) => { const s = e.filter((x) => inBin(x.t, b)); return { share: b[2], n: s.length, coverage: r4(share(s, (x) => x.lr <= CHI2_95 * phi)), meanAbsError: r4(mean(s.map((x) => Math.abs(x.est - x.t)))), bias: r4(mean(s.map((x) => x.est - x.t))) }; }),
        falsePresent: r4(share(e.filter((x) => x.t <= 1e-9), called)),
        foundWhenPresent: BINS.slice(1).map((b) => { const s = e.filter((x) => inBin(x.t, b)); return { share: b[2], n: s.length, found: r4(share(s, called)) }; }),
        byCondition: Object.fromEntries([...new Set(e.map((x) => x.cond))].map((cd) => [cd, r4(mean(e.filter((x) => x.cond === cd && x.t > 1e-9).map((x) => Math.abs(x.est - x.t))))])),
        precisionById: Object.fromEntries(ids.map((id) => { const calls = e.filter((x) => x.id === id && called(x)); return [id, { calls: calls.length, precision: r4(share(calls, (x) => x.t >= 0.5 * x.est)), recall: r4(share(e.filter((x) => x.id === id && x.t >= 0.1), called)) }]; })),
      },
    };
  };
  const contLevel = level((r) => (r.q ? { ids: conts, truth: r.truthC, q: r.q, lrTruth: r.lrTruth, lrZero: r.lrZero } : undefined));
  const regLevel = level((r) => (r.reg && r.regionKnown ? r.reg : undefined));

  /* ---- painting ---- */
  const sumHist = (rs, key, n) => fitted(rs).reduce((a, r) => { r.paint[key].forEach((v, i) => { a[i] += v; }); return a; }, new Array(n).fill(0));
  const hc = sumHist(cal, "hist", POST_BINS * 2), he = sumHist(ev, "hist", POST_BINS * 2);
  const xs = [], ys = [], ws = [];
  for (let b = 0; b < POST_BINS; b++) { const n = hc[b * 2] + hc[b * 2 + 1]; if (n) { xs.push(postCentre(b)); ys.push(hc[b * 2 + 1] / n); ws.push(n); } }
  const isotonic = fitIsotonic(xs, ys, ws);
  const totalWindows = he.reduce((a, b) => a + b, 0);
  const byThreshold = Object.fromEntries(Object.entries({ cautious: 0.95, standard: 0.8, complete: 0.5 }).map(([name, thr]) => {
    let right = 0, painted = 0;
    for (let b = 0; b < POST_BINS; b++) if (applyIsotonic(postCentre(b), isotonic) >= thr) { right += he[b * 2 + 1]; painted += he[b * 2] + he[b * 2 + 1]; }
    return [name, { accuracy: r4(painted ? right / painted : NaN), painted: r4(painted / totalWindows), windows: totalWindows }];
  }));
  const reliability = [];
  let ece = 0;
  for (let b = 0; b < POST_BINS; b++) {
    const n = he[b * 2] + he[b * 2 + 1];
    if (!n) continue;
    const said = applyIsotonic(postCentre(b), isotonic), was = he[b * 2 + 1] / n;
    reliability.push({ model: r4(postCentre(b)), calibrated: r4(said), observed: r4(was), windows: n });
    ece += (n / totalWindows) * Math.abs(said - was);
  }
  const zh = sumHist(cal.filter((r) => r.type === "single"), "zh", Z_BINS);
  let acc = 0, windowZ = Z_LO;
  const zTotal = zh.reduce((a, b) => a + b, 0);
  for (let i = 0; i < Z_BINS; i++) { acc += zh[i]; if (acc / zTotal >= 0.005) { windowZ = Z_LO + i * Z_STEP; break; } }
  const z01 = q(fitted(cal).map((r) => r.paint.z), 0.01);
  const gens = fitted(ev).filter((r) => r.type !== "single");
  const painting = {
    byThreshold, reliability, expectedCalibrationError: r4(ece),
    fit: { z01: r4(z01), falseAlarm: r4(share(fitted(ev), (r) => r.paint.z < z01)) },
    generations: { old: r4(mean(gens.filter((r) => r.type === "old").map((r) => Math.abs(Math.log2(r.paint.generations / r.generations))))), note: "mean absolute log2 ratio of the chosen to the true generations, old admixture" },
  };

  const calibration = {
    generated: today(), panel: meta.id, alleleError: 0.001,
    similarity: { temperature: similarity.temperature, conformalQ95: similarity.conformalQ95, coverage: similarity.coverage, fitZ01: similarity.fit.z01 },
    components: { phi: contLevel.phi, phiRegion: regLevel.phi, coverage: contLevel.report.coverage, presence: { ...contLevel.presence, ...regLevel.presence }, precision: { bins: regLevel.precision.bins, byId: { ...contLevel.precision.byId, ...regLevel.precision.byId } } },
    painting: { tempering: 0.5, isotonic: { x: isotonic.x.map(r4), y: isotonic.y.map(r4) }, windowZ },
    fit: { z01: painting.fit.z01 },
  };
  const count = (t) => ev.filter((r) => r.type === t).length;
  const validation = {
    id: "validation.ancestry", version: 2, generated: today(), script: "scripts/data/08-validate.mjs",
    title: "The ancestry engine on genomes it has not seen",
    method: "The panel is fitted on 80% of each reference population. Test genomes are made from the phased haplotypes of the other 20%: each held-out genome as it is, recent mixtures passed down through simulated meioses (4, 8 or 16 founders, one from another region), and admixture 5-15 generations old with minor shares from 1% to 50%. Each is read as a chip would read it (all SNPs, GSA only, OmniExpress only; 0.2-0.5% of alleles misread; 1-3% no-calls). Half of the genomes set the calibration; the figures here are from the other half. The engine is the browser's code.",
    caveat: "Test genomes come from the same studies as the reference (HGDP and 1000 Genomes), so real files from other sources may do a little worse. Populations with fewer than ten genomes have no held-out genomes and are untested. The Ashkenazi reference has no genomes to hold out; it is tested only for false calls here.",
    panel: { id: meta.id, genomesFitted: meta.qc.genomes, heldOut: meta.holdout?.genomes, dense: meta.qc.dense, core: meta.qc.core },
    genomes: { calibration: cal.length, measured: ev.length, single: count("single"), pedigree: count("pedigree"), old: count("old"), populationRemoved: lopo.length },
    similarity, components: contLevel.report, regions: regLevel.report, painting,
    thresholds: { cautious: 0.95, standard: 0.8, complete: 0.5 },
  };
  const out = resolve(args.out ?? REFERENCE);
  writeFileSync(join(out, "calibration.json"), JSON.stringify(calibration) + "\n");
  writeFileSync(join(out, "validation.json"), JSON.stringify(validation) + "\n");
  process.stderr.write(`${recs.length} genomes; wrote ${join(out, "calibration.json")} and validation.json\n`);
  console.log(JSON.stringify({ similarity: { coverage: similarity.coverage, top1: similarity.top1, setSize: similarity.meanSetSize, T: similarity.temperature, fit: similarity.fit }, continents: { phi: contLevel.phi, coverage: contLevel.report.coverage, falsePresent: contLevel.report.falsePresent, byShare: contLevel.report.coverageByShare }, regions: { phi: regLevel.phi, coverage: regLevel.report.coverage, falsePresent: regLevel.report.falsePresent }, painting: { byThreshold, ece: painting.expectedCalibrationError, fit: painting.fit } }, null, 1));
}

if (mode === "run") run();
else if (mode === "merge") merge();
else { console.error("usage: 08-validate.mjs run|merge --dir <validation build> [--shard i/n] [--out dir]"); process.exit(1); }
void existsSync;
