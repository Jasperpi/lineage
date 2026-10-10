import { describe, expect, it } from "vitest";
import {
  AUTOSOMES, BASE_CODES, InterpolatedGeneticMap, Kit, componentAdmixture, decodeReferencePanel, encodeReferencePanel,
  mulberry32, paintChromosomes, panelGenotypes, populationSimilarity, projectPca, type Chrom, type ReferencePanelData,
} from "../index.js";

/* A synthetic panel: 3 continental components, 4 populations (two pure, one per component, plus a 50/50 mix). */
const K = 3, SCALE = 250, PER_CHROM = 400;
const rng = mulberry32(42);
const n = AUTOSOMES.length * PER_CHROM;
const chromIdx = new Uint8Array(n), pos = new Uint32Array(n), ref = new Uint8Array(n), alt = new Uint8Array(n);
const comp = new Float64Array(n * K);
const compFreq = new Uint8Array(n * K);
for (let i = 0; i < n; i++) {
  chromIdx[i] = Math.floor(i / PER_CHROM);
  pos[i] = 1_000_000 + (i % PER_CHROM) * 100_000;
  ref[i] = 0; alt[i] = 2; // A/G, never palindromic
  for (let k = 0; k < K; k++) {
    // Strongly differentiated frequencies so small tests are decisive.
    const f = rng() < 0.5 ? 0.05 + 0.15 * rng() : 0.8 + 0.15 * rng();
    comp[i * K + k] = f;
    compFreq[i * K + k] = Math.round(f * SCALE);
  }
}
const coreIndex = Uint32Array.from({ length: n / 2 }, (_, k) => k * 2);
const POPS = ["P0", "P1", "P2", "MIX01"];
const popFreq = new Uint8Array(coreIndex.length * POPS.length);
const pooled = new Uint16Array(coreIndex.length);
coreIndex.forEach((i, k) => {
  const f = [comp[i * K]!, comp[i * K + 1]!, comp[i * K + 2]!, (comp[i * K]! + comp[i * K + 1]!) / 2];
  f.forEach((x, p) => { popFreq[k * POPS.length + p] = Math.round(x * SCALE); });
  pooled[k] = Math.round(((f[0]! + f[1]! + f[2]!) / 3) * 65535);
});
// One PC that separates component 0 from component 1: loading proportional to f0 - f1, normalised.
const raw = Array.from(coreIndex, (i) => comp[i * K]! - comp[i * K + 1]!);
const norm = Math.sqrt(raw.reduce((a, b) => a + b * b, 0));
const maxAbs = Math.max(...raw.map((x) => Math.abs(x / norm)));
const loadings = Int16Array.from(raw, (x) => Math.round((x / norm / maxAbs) * 32767));

const panelSpec = {
  header: {
    version: 1 as const, build: 37 as const, chromosomes: [...AUTOSOMES], freqScale: SCALE, populations: POPS,
    components: [{ id: "C0", label: "zero", populations: ["P0"] }, { id: "C1", label: "one", populations: ["P1"] }, { id: "C2", label: "two", populations: ["P2"] }],
    core: { nSnp: coreIndex.length }, pca: { nPc: 1, loadingScale: [maxAbs / 32767], shrinkage: [1], eigenvalues: [1] },
  },
  chromIdx, pos, ref, alt, compFreq, coreIndex, popFreq, pooledFreq: pooled, loadings,
};
const panel: ReferencePanelData = decodeReferencePanel(encodeReferencePanel(panelSpec));

/** A kit whose two copies come from the given components, per chromosome half. */
function person(seed: number, copyA: (i: number) => number, copyB: (i: number) => number): Kit {
  const r = mulberry32(seed);
  const rows = Array.from({ length: n }, (_, i) => {
    const a = r() < comp[i * K + copyA(i)]! ? "G" : "A";
    const b = r() < comp[i * K + copyB(i)]! ? "G" : "A";
    return { rsid: `rs${i + 1}`, chrom: AUTOSOMES[chromIdx[i]!]! as Chrom, pos: pos[i]!, genotype: [a, b].sort().join("") };
  });
  return new Kit({ format: "23andme", build: 37, headerLines: [], strand: "plus" }, rows);
}
const map = new InterpolatedGeneticMap();
for (const c of AUTOSOMES) map.add(c, [[1_000_000, 0], [1_000_000 + PER_CHROM * 100_000, 40]]);

describe("reference panel format", () => {
  it("round-trips through the binary encoding", () => {
    expect(panel.header.nSnp).toBe(n);
    expect(Array.from(panel.pos.subarray(0, 3))).toEqual([1_000_000, 1_100_000, 1_200_000]);
    expect(panel.coreIndex[5]).toBe(10);
    expect(BASE_CODES[panel.alt[0]!]).toBe("G");
    expect(panel.compFreq[7]).toBe(compFreq[7]);
  });

  it("matches kits by position and counts ALT alleles, flipping strand when needed", () => {
    const kit = new Kit({ format: "generic", build: 37, headerLines: [], strand: "unknown" }, [
      { rsid: "x1", chrom: "1", pos: 1_000_000, genotype: "GG" },
      { rsid: "x2", chrom: "1", pos: 1_100_000, genotype: "CT" }, // complement of AG
      { rsid: "x3", chrom: "1", pos: 1_200_000, genotype: "CC" }, // complement of GG
      { rsid: "x4", chrom: "1", pos: 1_300_000, genotype: "AT" }, // fits neither strand
    ]);
    const g = panelGenotypes(kit, panel);
    expect(Array.from(g.dosage.subarray(0, 5))).toEqual([2, 1, 2, -1, -1]);
    expect(g.strandFlipped).toBe(2);
    expect(g.alleleMismatch).toBe(1);
  });
});

describe("ancestry analyses", () => {
  const pure0 = panelGenotypes(person(1, () => 0, () => 0), panel);
  const mixed = panelGenotypes(person(2, () => 0, () => 1), panel);

  it("ranks the source population first for an unmixed genome", () => {
    const sim = populationSimilarity(panel, pure0);
    const best = sim.scores.find((s) => s.rank === 1)!;
    expect(best.population).toBe("P0");
    expect(best.gapPer1000).toBe(0);
  });

  it("ranks the matching mixed population first for a 50/50 genome", () => {
    const sim = populationSimilarity(panel, mixed);
    expect(sim.scores.find((s) => s.rank === 1)!.population).toBe("MIX01");
  });

  it("recovers admixture proportions with intervals that contain them", () => {
    const a = componentAdmixture(panel, mixed);
    expect(a.proportions[0]).toBeGreaterThan(0.42);
    expect(a.proportions[0]).toBeLessThan(0.58);
    expect(a.proportions[2]).toBeLessThan(0.05);
    expect(a.ci95[0]![0]).toBeLessThanOrEqual(a.proportions[0]!);
    expect(a.ci95[0]![1]).toBeGreaterThanOrEqual(a.proportions[0]!);
    const p = componentAdmixture(panel, pure0);
    expect(p.proportions[0]).toBeGreaterThan(0.95);
  });

  it("keeps every estimate inside its own interval, including components at zero", () => {
    // A property real genomes once broke: bootstrap replicates that stopped short of convergence
    // gave a British genome 99.9% European with an "interval" of 98.6-99.3%. Profile intervals
    // contain their estimate by construction; this keeps it that way.
    const p = componentAdmixture(panel, pure0);
    p.proportions.forEach((x, k) => {
      expect(p.ci95[k]![0]).toBeLessThanOrEqual(x + 1e-3);
      expect(p.ci95[k]![1]).toBeGreaterThanOrEqual(x - 1e-3);
    });
    expect(p.proportions.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it("projects genomes to opposite sides of a PC that separates two components", () => {
    const pc0 = projectPca(panel, pure0).pcs[0]!;
    const pc1 = projectPca(panel, panelGenotypes(person(3, () => 1, () => 1), panel)).pcs[0]!;
    const mid = projectPca(panel, mixed).pcs[0]!;
    expect(pc0).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(pc1);
  });

  it("paints known ancestry blocks back", () => {
    // Copy A is component 0 everywhere; copy B is component 0 on the first half of each chromosome, component 2 on the second.
    const kit = person(4, () => 0, (i) => ((i % PER_CHROM) < PER_CHROM / 2 ? 0 : 2));
    const g = panelGenotypes(kit, panel);
    const q = componentAdmixture(panel, g, { intervals: false }).proportions;
    const painting = paintChromosomes(panel, g, q, map, { windowSnps: 20 });
    let right = 0, total = 0;
    for (const c of painting.chromosomes) for (const w of c.windows) {
      const firstHalf = w.end < 1_000_000 + (PER_CHROM / 2) * 100_000;
      const want = firstHalf ? "0,0" : "0,2";
      total++;
      if (w.pair.join(",") === want) right++;
    }
    expect(right / total).toBeGreaterThan(0.9);
    expect(painting.totals[0]).toBeGreaterThan(0.65);
    expect(painting.totals[0]).toBeLessThan(0.85);
    expect(painting.totals[2]).toBeGreaterThan(0.15);
  });
});
