import { describe, expect, it } from "vitest";
import {
  AUTOSOMES, InterpolatedGeneticMap, compareKits, decodeReferencePanel, encodeReferencePanel, findRelationship, inferSex,
  makeDemoFamily, mulberry32, parseGedcom, parseSegmentTable, summariseMatches, callTrait, type TraitVariant,
} from "../index.js";

/* A small panel covering every autosome with six named populations, enough to exercise the generator. */
const POPS = ["YRI", "MXL", "JPT", "FIN", "GBR", "TSI"];
const K = 3, SCALE = 250, PER = 300;
const rng = mulberry32(5);
const n = AUTOSOMES.length * PER;
const chromIdx = Uint8Array.from({ length: n }, (_, i) => Math.floor(i / PER));
const pos = Uint32Array.from({ length: n }, (_, i) => 1_000_000 + (i % PER) * 150_000);
const coreIndex = Uint32Array.from({ length: n / 3 }, (_, k) => k * 3);
const panel = decodeReferencePanel(encodeReferencePanel({
  header: {
    version: 1, build: 37, chromosomes: [...AUTOSOMES], freqScale: SCALE, populations: POPS,
    components: [{ id: "A", label: "a", populations: [] }, { id: "B", label: "b", populations: [] }, { id: "C", label: "c", populations: [] }],
    core: { nSnp: coreIndex.length }, pca: { nPc: 1, loadingScale: [1], shrinkage: [1], eigenvalues: [1] },
  },
  chromIdx, pos, ref: new Uint8Array(n).fill(0), alt: new Uint8Array(n).fill(2),
  compFreq: Uint8Array.from({ length: n * K }, () => Math.round((0.1 + 0.8 * rng()) * SCALE)),
  coreIndex, popFreq: Uint8Array.from({ length: coreIndex.length * POPS.length }, () => Math.round((0.1 + 0.8 * rng()) * SCALE)),
  pooledFreq: new Uint16Array(coreIndex.length).fill(32768), loadings: new Int16Array(coreIndex.length),
}));
const map = new InterpolatedGeneticMap();
for (const c of AUTOSOMES) map.add(c, [[1_000_000, 0], [1_000_000 + PER * 150_000, 120]]);
const trait: TraitVariant = {
  id: "t", rsid: "rs12913832", gene: "HERC2", name: "Eye colour", category: "pigmentation", chrom: "15", pos38: 28120472, pos37: 28365618,
  alleles: ["A", "G"], effectAllele: "G", interpretation: { 0: "zero", 1: "one", 2: "two" }, evidenceSummary: "", caveats: "", sources: [], frequencies: [],
  frequenciesSource: { name: "", retrieved: "", url: "" },
};

describe("demo family", () => {
  const fam = makeDemoFamily({
    panel, map, meanProportions: Object.fromEntries(POPS.map((p) => [p, [1 / 3, 1 / 3, 1 / 3]])),
    traits: [{ rsid: trait.rsid, chrom: "15", pos: 28365618, effect: "G", other: "A", freq: { EUR: 0.64, EAS: 0.01, AMR: 0.2, AFR: 0.03, SAS: 0.07 } }],
  });
  const tester = fam.kits.get("I17")!;

  it("generates the genotyped members with the right genetic sex", () => {
    expect([...fam.kits.keys()].sort()).toEqual(["I13", "I14", "I15", "I17", "I18", "I19", "U1"]);
    expect(inferSex(tester).inferred).toBe("male");
    expect(inferSex(fam.kits.get("I18")!).inferred).toBe("female");
  });

  it("gives relatives realistic sharing: a parent everywhere, a first cousin about a quarter, a stranger nothing", () => {
    const genome = AUTOSOMES.reduce((a, c) => a + (map.length(c) ?? 0), 0);
    const share = (id: string) => (compareKits(tester, fam.kits.get(id)!, { map, includeX: false }).totals.halfCm ?? 0) / genome;
    expect(share("I13")).toBeGreaterThan(0.95);
    expect(share("I19")).toBeGreaterThan(0.08);
    expect(share("I19")).toBeLessThan(0.45);
    expect(share("U1")).toBeLessThan(0.02);
  });

  it("writes a tree that parses and relates the tester to his cousin correctly", () => {
    const tree = parseGedcom(fam.gedcom);
    expect(tree.warnings).toEqual([]);
    expect(findRelationship(tree, "@I17@", "@I19@")?.description).toBe("first cousin");
    expect(findRelationship(tree, "@I17@", "@I1@")?.description).toBe("great-grandfather");
  });

  it("writes a match list whose rows parse and carry the known relationships", () => {
    const { segments } = parseSegmentTable(fam.segmentsCsv);
    const rows = summariseMatches(segments);
    expect(rows[0]!.match).toBe("Elena Rossi");
    expect(rows.length).toBeGreaterThanOrEqual(14);
    expect(fam.truth["Kaisa Laine"]).toBe("2C");
  });

  it("includes the real trait markers", () => {
    expect(callTrait(tester, trait).status).toBe("called");
  });
});
