/**
 * The ancestry engine against things it used to get wrong: intervals that
 * miss the truth, small components called in genomes that have none, forward-
 * strand calls complemented, duplicate rows, GRCh38 files, genomes from a
 * population the reference lacks. The synthetic world here is harder than the
 * one in ancestry.test.ts: continental drift of Fst = 0.1 (Balding-Nichols),
 * reference frequencies counted from 50 genomes per population (so they carry
 * sampling error), test genomes drawn from other members of the populations,
 * and a fourth population the panel never saw.
 */
import { describe, expect, it } from "vitest";
import {
  AUTOSOMES, InterpolatedGeneticMap, Kit, ancestryTree, applyIsotonic, attachTier, componentAdmixture, conformalThreshold,
  decodePanelTier, decodeReferencePanel, detectBuild, dirichlet, encodePanelTier, encodeReferencePanel, fitIsotonic, groupTable,
  lzwShrinkage, mosaicHaplotype, mulberry32, paintChromosomes, panelCm, panelGenotypes, populationSimilarity, projectPca,
  quantileSorted, similarityProbabilities, toGenotypes, trueProportions, type Chrom, type ComponentAdmixture, type ReferencePanelData,
} from "../index.js";

const K = 3, PER_CHROM = 300, REF_GENOMES = 50, POOL = 120, FST = 0.1;
const rng = mulberry32(2026);
const n = AUTOSOMES.length * PER_CHROM;

function betaDraw(r: () => number, a: number, b: number): number {
  // Gamma ratio via Marsaglia-Tsang, enough for tests.
  const g = (s: number): number => {
    if (s < 1) return g(1 + s) * Math.pow(r(), 1 / s);
    const d = s - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = 0, v = 0;
      do { const u1 = Math.max(1e-12, r()), u2 = r(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = r();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const x = g(a), y = g(b);
  return x / (x + y);
}

// True frequencies: K panel populations plus X, which the panel never sees.
const trueF: Float64Array[] = Array.from({ length: K + 1 }, () => new Float64Array(n));
for (let i = 0; i < n; i++) {
  const p = 0.05 + 0.9 * rng();
  for (let k = 0; k <= K; k++) trueF[k]![i] = Math.min(0.999, Math.max(0.001, betaDraw(rng, (p * (1 - FST)) / FST, ((1 - p) * (1 - FST)) / FST)));
}
const hap = (f: Float64Array) => Uint8Array.from(f, (x) => (rng() < x ? 1 : 0));
// Donor pools (the people test genomes are made from) and separate reference samples (what the panel counts).
const donors = trueF.map((f) => Array.from({ length: POOL }, () => hap(f)));
const refCounts = trueF.slice(0, K).map((f) => {
  const c = new Uint8Array(n);
  for (let h = 0; h < 2 * REF_GENOMES; h++) { const x = hap(f); for (let i = 0; i < n; i++) c[i]! += x[i]!; }
  return c;
});

const chromIdx = new Uint8Array(n), pos = new Uint32Array(n), pos38 = new Uint32Array(n), ref = new Uint8Array(n), alt = new Uint8Array(n);
const compFreq = new Uint8Array(n * K);
for (let i = 0; i < n; i++) {
  chromIdx[i] = Math.floor(i / PER_CHROM);
  pos[i] = 1_000_000 + (i % PER_CHROM) * 100_000;
  pos38[i] = pos[i]! + 5_003; // a fixed shift stands in for the GRCh37 -> GRCh38 liftover
  ref[i] = 0; alt[i] = 2;
  for (let k = 0; k < K; k++) compFreq[i * K + k] = refCounts[k]![i]!;
}
const coreIndex = Uint32Array.from({ length: n / 2 }, (_, k) => k * 2);
const popFreq = new Uint8Array(coreIndex.length * K);
coreIndex.forEach((i, k) => { for (let p = 0; p < K; p++) popFreq[k * K + p] = refCounts[p]![i]!; });
const AN = 2 * REF_GENOMES;
// One PC separating P0 from P1: loadings proportional to their frequency difference, unit length.
const rawLoad = Array.from(coreIndex, (i) => refCounts[0]![i]! - refCounts[1]![i]!);
const loadNorm = Math.sqrt(rawLoad.reduce((a, b) => a + b * b, 0));
const loadMax = Math.max(...rawLoad.map((x) => Math.abs(x / loadNorm)));
const loadings = Int16Array.from(rawLoad, (x) => Math.round((x / loadNorm / loadMax) * 32767));
const panel: ReferencePanelData = decodeReferencePanel(encodeReferencePanel({
  header: {
    version: 2, build: 37, chromosomes: [...AUTOSOMES], freqScale: AN, populations: ["P0", "P1", "P2"], popAlleles: [AN, AN, AN], popScale: [AN, AN, AN],
    components: ["C0", "C1", "C2"].map((id, k) => ({ id, label: `Component ${k}`, populations: [`P${k}`], alleles: AN, scale: AN, level: "continent" as const })),
    core: { nSnp: coreIndex.length }, pca: { nPc: 1, loadingScale: [loadMax / 32767], shrinkage: [1], eigenvalues: [1] },
  },
  chromIdx, pos, pos38, ref, alt, compFreq, coreIndex, popFreq, pooledFreq: new Uint16Array(coreIndex.length).fill(32768), loadings,
}));

const map = new InterpolatedGeneticMap();
for (const c of AUTOSOMES) map.add(c, [[1_000_000, 0], [1_000_000 + PER_CHROM * 100_000, 30]]);
const cm = panelCm(panel, map);

/** A genome admixed `T` generations ago in proportions q (over K+1 populations; the last is X). */
function genome(seed: number, q: number[], T = 6, cond: Parameters<typeof toGenotypes>[3] = {}) {
  const r = mulberry32(seed);
  const qq = q.length === K ? [...q, 0] : q;
  const h0 = mosaicHaplotype(r, panel, cm, donors, qq, T), h1 = mosaicHaplotype(r, panel, cm, donors, qq, T);
  return { g: toGenotypes(r, h0, h1, cond, panel), truth: trueProportions(h0, h1, K + 1, cm, panel), h0, h1 };
}

describe("genotype probabilities", () => {
  it("carry the reference sample size and sum to one", () => {
    const small = groupTable(20, 20, 0.001), big = groupTable(250, 3000, 0.001), exact = groupTable(250, 0, 0);
    for (const t of [small, big]) for (let v = 0; v < t.mean.length; v++) {
      const s = [0, 1, 2].reduce((a, d) => a + Math.exp(t.logP[v * 3 + d]!), 0);
      expect(s).toBeCloseTo(1, 9);
    }
    // Zero copies in 20 chromosomes is weak evidence the allele is absent; zero in 3,000 is strong.
    expect(Math.exp(small.logP[0 * 3 + 2]!)).toBeGreaterThan(Math.exp(big.logP[0 * 3 + 2]!) * 10);
    // With no sample size and no error the stored frequency is used as is.
    expect(exact.mean[125]).toBeCloseTo(0.5, 12);
    expect(Math.exp(exact.logP[125 * 3 + 1]!)).toBeCloseTo(0.5, 12);
  });
});

describe("matching a kit to the panel", () => {
  const row = (p: number, gt: string) => ({ rsid: `rs${p}`, chrom: "1" as Chrom, pos: p, genotype: gt });

  it("never complements a forward-strand call", () => {
    const rows = [row(1_000_000, "CT"), ...Array.from({ length: 30 }, (_, i) => row(1_100_000 + i * 100_000, "AG"))];
    const g = panelGenotypes(new Kit({ format: "23andme", build: 37, headerLines: [], strand: "plus" }, rows), panel);
    expect(g.dosage[0]).toBe(-1);
    expect(g.alleleMismatch).toBe(1);
    expect(g.strandFlipped).toBe(0);
  });

  it("reads a mislabelled file again with complements when most calls fit only that way", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(1_000_000 + i * 100_000, "CT"));
    const g = panelGenotypes(new Kit({ format: "23andme", build: 37, headerLines: [], strand: "plus" }, rows), panel);
    expect(g.strandFlipped).toBe(40);
    expect(g.dosage[0]).toBe(1);
  });

  it("keeps agreeing duplicate rows and drops conflicting ones", () => {
    const g = panelGenotypes(new Kit({ format: "generic", build: 37, headerLines: [], strand: "unknown" }, [
      row(1_000_000, "GG"), row(1_000_000, "GG"), row(1_100_000, "AG"), row(1_100_000, "GG"), row(1_200_000, ""), row(1_200_000, "AA"),
    ]), panel);
    expect(Array.from(g.dosage.subarray(0, 3))).toEqual([2, -1, 0]);
    expect(g.conflicting).toBe(1);
  });

  it("recognises a GRCh38 file and reads it on GRCh38 positions", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ rsid: `rs${i}`, chrom: AUTOSOMES[chromIdx[i * 3]!]!, pos: pos38[i * 3]!, genotype: "AG" }));
    const kit = new Kit({ format: "generic", build: 37, headerLines: [], strand: "unknown" }, rows);
    const b = detectBuild(kit, panel, 1);
    expect(b.build).toBe(38);
    expect(panelGenotypes(kit, panel, { build: 38 }).called).toBe(2000);
    expect(panelGenotypes(kit, panel).called).toBe(0);
  });
});

describe("component intervals", () => {
  // Proportions from a Dirichlet so some shares are small, the case the old intervals never faced.
  const genomes = Array.from({ length: 24 }, (_, s) => {
    const q = dirichlet(mulberry32(100 + s), [0.6, 0.6, 0.6]);
    return genome(200 + s, q, 4 + (s % 8), { alleleError: 0.002, noCall: 0.02 });
  });
  const fits = genomes.map((x) => componentAdmixture(panel, x.g));

  it("cover the true proportions at close to the nominal rate", () => {
    let inside = 0, total = 0;
    fits.forEach((a, s) => a.proportions.forEach((_, k) => {
      const t = genomes[s]!.truth[k]!;
      total++;
      if (t >= a.ci95[k]![0] - 1e-9 && t <= a.ci95[k]![1] + 1e-9) inside++;
    }));
    expect(inside / total).toBeGreaterThanOrEqual(0.88);
  });

  it("are wider when the reference frequencies' sampling error is part of the likelihood", () => {
    const withRef = fits[0]!;
    const without = componentAdmixture(panel, genomes[0]!.g, { referenceUncertainty: false });
    const width = (a: ComponentAdmixture) => a.ci95.reduce((s, [lo, hi]) => s + (hi - lo), 0);
    expect(width(withRef)).toBeGreaterThan(width(without));
  });

  it("start at zero for a component the genome does not carry, and end at one for a pure genome", () => {
    const a = componentAdmixture(panel, genome(300, [1, 0, 0], 1).g);
    expect(a.ci95[1]![0]).toBe(0);
    expect(a.ci95[2]![0]).toBe(0);
    expect(a.ci95[0]![1]).toBeCloseTo(1, 6);
  });

  it("does not call absent components present in unmixed genomes", () => {
    let falseCalls = 0, checks = 0;
    for (let s = 0; s < 12; s++) {
      const k = s % K;
      const q = [0, 0, 0]; q[k] = 1;
      const a = componentAdmixture(panel, genome(400 + s, q, 1).g);
      a.present.forEach((p, j) => { if (j !== k) { checks++; if (p) falseCalls++; } });
      expect(a.present[k]).toBe(true);
    }
    expect(falseCalls / checks).toBeLessThanOrEqual(0.05);
  });
});

describe("population similarity", () => {
  it("turns log-likelihoods into probabilities and a conformal set when calibrated", () => {
    const x = genome(501, [1, 0, 0], 1);
    const raw = populationSimilarity(panel, x.g);
    expect(raw.calibrated).toBe(false);
    expect(raw.scores.find((s) => s.rank === 1)!.population).toBe("P0");
    const cal = populationSimilarity(panel, x.g, { calibration: { similarity: { temperature: 50, conformalQ95: 0.5 } } });
    expect(cal.set![0]).toBe("P0");
    expect(cal.scores.reduce((a, s) => a + s.probability!, 0)).toBeCloseTo(1, 9);
  });

  it("says when no single reference population fits", () => {
    const own = [genome(510, [1, 0, 0], 1), genome(511, [0, 1, 0], 1)].map((x) => populationSimilarity(panel, x.g).fit.z);
    const outsider = populationSimilarity(panel, genome(512, [0, 0, 0, 1], 1).g).fit.z;
    const mixed = populationSimilarity(panel, genome(513, [0.5, 0.5, 0], 4).g).fit.z;
    for (const z of own) expect(Math.abs(z)).toBeLessThan(4);
    expect(outsider).toBeLessThan(-8);
    expect(mixed).toBeLessThan(-4);
  });

  it("softmax and conformal threshold behave", () => {
    expect(similarityProbabilities([0, 0], 1)).toEqual([0.5, 0.5]);
    expect(conformalThreshold([0.1, 0.2, 0.3, 0.4], 0.5)).toBe(0.3);
  });
});

describe("hierarchy", () => {
  it("orders continents, shown regions and the Broadly remainder", () => {
    const adm: ComponentAdmixture = {
      components: ["NW", "SOUTH", "ASJ", "EAS"], labels: ["North-west", "Southern", "Ashkenazi", "East Asian"], parents: ["EUR", "EUR", "EUR", "EAS"], level: "region",
      proportions: [0.3, 0.05, 0.6, 0.05], ci95: [[0.25, 0.35], [0, 0.1], [0.55, 0.65], [0.02, 0.08]], lrZero: [100, 3, 400, 20],
      presence: [0.01, 0.01, 0.01, 0.01], present: [true, false, true, true], shown: [true, false, true, true],
      groups: [{ id: "EUR", members: [0, 1, 2], share: 0.95, ci95: [0.92, 0.98] }, { id: "EUR:broadly", members: [1], share: 0.05, ci95: [0, 0.1] }],
      snpsUsed: 1, iterations: 1, logLik: 0, phi: 1, calibrated: true, settings: { alleleError: 0, referenceUncertainty: true },
    };
    const tree = ancestryTree(adm, { labels: { EUR: "European" } });
    expect(tree.nodes.map((x) => x.id)).toEqual(["EUR", "ASJ", "NW", "EUR:broadly", "EAS"]);
    expect(tree.nodes[0]!.ci95).toEqual([0.92, 0.98]);
    expect(tree.nodes.find((x) => x.id === "EUR:broadly")!.label).toBe("Broadly European");
  });

  it("holds back a region whose held-out precision at its share is too low", () => {
    // Calibrated precision: NW is right only half the time below 10%.
    const R = 2;
    const tierComp = new Uint8Array(coreIndex.length * R);
    coreIndex.forEach((i, k) => { tierComp[k * R] = refCounts[0]![i]!; tierComp[k * R + 1] = refCounts[1]![i]!; });
    const p = decodeReferencePanel(encodeReferencePanel({ ...panel, header: { ...panel.header } }));
    attachTier(p, decodePanelTier(encodePanelTier({
      header: { continent: "C0", coreSnp: coreIndex.length, populations: [], popAlleles: [], popScale: [], components: [
        { id: "A", label: "A", populations: [], alleles: AN, scale: AN, parent: "C0", level: "region" },
        { id: "B", label: "B", populations: [], alleles: AN, scale: AN, parent: "C0", level: "region" }] },
      popFreq: new Uint8Array(0), compFreq: tierComp,
    })));
    const x = genome(650, [1, 0, 0], 2);
    const cal = { components: { phi: 1, presence: {}, precision: { bins: [1], byId: { A: [0.5], B: [0.99] } } } };
    const a = componentAdmixture(p, x.g, { level: "region", calibration: cal });
    expect(a.present[0]).toBe(true);
    expect(a.shown[0]).toBe(false);
    const tree = ancestryTree(a);
    expect(tree.nodes.some((n) => n.kind === "broadly" && n.parent === "C0" && n.share > 0.5)).toBe(true);
  });

  it("fits regional components from an attached tier", () => {
    // Tier for C0: two regions that are both C0's population, so together they must equal C0's share.
    const R = 2;
    const tierComp = new Uint8Array(coreIndex.length * R);
    coreIndex.forEach((i, k) => { tierComp[k * R] = refCounts[0]![i]!; tierComp[k * R + 1] = refCounts[0]![i]!; });
    const p = decodeReferencePanel(encodeReferencePanel({ ...panel, header: { ...panel.header } }));
    attachTier(p, decodePanelTier(encodePanelTier({
      header: { continent: "C0", coreSnp: coreIndex.length, populations: [], popAlleles: [], popScale: [], components: [
        { id: "C0a", label: "West", populations: [], alleles: AN, scale: AN, parent: "C0", level: "region" },
        { id: "C0b", label: "East", populations: [], alleles: AN, scale: AN, parent: "C0", level: "region" }] },
      popFreq: new Uint8Array(0), compFreq: tierComp,
    })));
    const x = genome(601, [0.7, 0.3, 0], 6);
    const cont = componentAdmixture(p, x.g, { intervals: false });
    const reg = componentAdmixture(p, x.g, { level: "region" });
    expect(reg.components).toEqual(["C0a", "C0b", "C1", "C2"]);
    expect(reg.proportions[0]! + reg.proportions[1]!).toBeCloseTo(cont.proportions[0]!, 2);
    // The continent's own interval comes from the profile over the sum, and it holds the sum.
    const c0 = reg.groups.find((gr) => gr.id === "C0")!;
    expect(c0.ci95[0]).toBeLessThanOrEqual(c0.share);
    expect(c0.ci95[1]).toBeGreaterThanOrEqual(c0.share);
    expect(c0.ci95[1] - c0.ci95[0]).toBeLessThan(reg.ci95[0]![1] - reg.ci95[0]![0] + reg.ci95[1]![1] - reg.ci95[1]![0]);
  });
});

describe("painting", () => {
  it("chooses the number of generations from the genome", () => {
    const recent = genome(701, [0.5, 0.5, 0], 2), old = genome(702, [0.5, 0.5, 0], 24);
    const q = [0.5, 0.5, 0];
    const tr = paintChromosomes(panel, recent.g, q, map).settings.generations;
    const to = paintChromosomes(panel, old.g, q, map).settings.generations;
    expect(tr).toBeLessThan(to);
  });

  it("flags a genome from a population the reference lacks", () => {
    const inside = [genome(801, [1, 0, 0], 1), genome(802, [0.5, 0.5, 0], 6)].map((x) => paintChromosomes(panel, x.g, componentAdmixture(panel, x.g, { intervals: false }).proportions, map).fit.z);
    const outsider = genome(803, [0, 0, 0, 1], 1);
    const zOut = paintChromosomes(panel, outsider.g, componentAdmixture(panel, outsider.g, { intervals: false }).proportions, map).fit.z;
    for (const z of inside) expect(z).toBeGreaterThan(-4);
    expect(zOut).toBeLessThan(-8);
  });

  it("applies the isotonic calibration to window posteriors", () => {
    const x = genome(901, [0.5, 0.5, 0], 6);
    const q = componentAdmixture(panel, x.g, { intervals: false }).proportions;
    const p = paintChromosomes(panel, x.g, q, map, { calibration: { painting: { isotonic: { x: [0, 1], y: [0, 0.5] } } } });
    const w = p.chromosomes[0]!.windows[0]!;
    expect(w.posterior).toBeCloseTo(w.rawPosterior / 2, 9);
  });
});

describe("PCA shrinkage", () => {
  it("reproduces the hold-out shrinkage the pipeline measured on 1000 Genomes", () => {
    // Sample eigenvalues as variance explained x SNPs, 85,700 core SNPs, 2,504 genomes (panel.1000g.json).
    const gamma = 85_700 / 2504;
    expect(lzwShrinkage(0.06528842 * 85_700, gamma)).toBeCloseTo(0.992, 2);
    expect(lzwShrinkage(0.00179809 * 85_700, gamma)).toBeCloseTo(0.776, 1);
    expect(Number.isNaN(lzwShrinkage(10, gamma))).toBe(true);
  });

  it("gives a bootstrap covariance for the projected scores", () => {
    const p = projectPca(panel, genome(1001, [1, 0, 0], 1).g, { map, replicates: 20 });
    expect(p.cov).toBeDefined();
    expect(p.cov![0]![0]).toBeGreaterThan(0);
    expect(Math.sqrt(p.cov![0]![0]!)).toBeLessThan(Math.abs(p.pcs[0]!));
  });
});

describe("calibration helpers", () => {
  it("fits and applies an isotonic map", () => {
    const iso = fitIsotonic([0.1, 0.2, 0.3, 0.4], [0, 1, 0, 1]);
    for (let i = 1; i < iso.y.length; i++) expect(iso.y[i]!).toBeGreaterThanOrEqual(iso.y[i - 1]!);
    expect(applyIsotonic(0.5, { x: [0, 1], y: [0.2, 0.8] })).toBeCloseTo(0.5, 9);
    expect(quantileSorted([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });
});
