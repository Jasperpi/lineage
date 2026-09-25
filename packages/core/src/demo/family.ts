/**
 * The demo family: four fictional generations whose genomes are generated
 * on the spot from the bundled reference data, so every part of the app has
 * something real-shaped to show without shipping anyone's DNA.
 *
 *  - Founders' two genome copies are drawn allele by allele from the 1000
 *    Genomes frequencies of a population (population frequencies on the core
 *    SNPs, that population's mean mix of continental component frequencies
 *    elsewhere). There is no linkage disequilibrium between neighbouring
 *    SNPs, which is the main way these genomes are cleaner than real ones.
 *  - Children inherit one recombined copy from each parent: crossovers are
 *    placed along each chromosome by genetic distance on the bundled map, so
 *    relatives share segments of realistic number and length.
 *  - X is inherited the way X is (a father gives his only X to daughters);
 *    Y calls exist only for males. X and Y use placeholder sites, enough for
 *    sex inference and nothing else.
 *  - The trait knowledge base's real markers are included, with alleles drawn
 *    from the matching continental 1000 Genomes frequency.
 *  - More distant cousins exist only as match-list rows: their shared
 *    segments come from the relationship simulator, and the demo keeps the
 *    true relationship so the app can reveal it next to its estimate.
 *
 * Nobody here exists.
 */
import { AUTOSOMES, type Chrom, GRCH37_LENGTH } from "../genome.js";
import { Kit, type Variant } from "../kit/kit.js";
import { mulberry32 } from "../util/random.js";
import type { GeneticMap } from "../compare/geneticmap.js";
import { compareKits } from "../compare/hir.js";
import { BASE_CODES, type ReferencePanelData } from "../ancestry/reference.js";
import { DEFAULT_RELATIONSHIPS, simulatePairSegments } from "../relationship/simulate.js";
import type { MatchSegment } from "../segments/parse.js";

export interface DemoTraitSite { rsid: string; chrom: Chrom; pos: number; effect: string; other: string; freq: Record<string, number> }

export interface DemoPerson {
  id: string;
  given: string;
  surname: string;
  sex: "M" | "F";
  birthYear: number;
  birthDate: string;
  birthPlace: string;
  death?: { date: string; place: string };
  mother?: string;
  father?: string;
  /** 1000 Genomes population a founder's genome is drawn from. */
  population?: string;
  /** Genotyped: has a kit in the demo. */
  kit?: boolean;
  role?: string;
}

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  { id: "I1", given: "Eino", surname: "Virtanen", sex: "M", birthYear: 1912, birthDate: "3 FEB 1912", birthPlace: "Tampere, Finland", death: { date: "1988", place: "Tampere, Finland" } },
  { id: "I2", given: "Helmi", surname: "Laine", sex: "F", birthYear: 1915, birthDate: "21 JUL 1915", birthPlace: "Tampere, Finland", death: { date: "1996", place: "Tampere, Finland" } },
  { id: "I3", given: "Giuseppe", surname: "Rossi", sex: "M", birthYear: 1910, birthDate: "9 NOV 1910", birthPlace: "Siena, Tuscany, Italy", death: { date: "1979", place: "Siena, Tuscany, Italy" } },
  { id: "I4", given: "Maria", surname: "Bianchi", sex: "F", birthYear: 1913, birthDate: "14 APR 1913", birthPlace: "Siena, Tuscany, Italy", death: { date: "1990", place: "Siena, Tuscany, Italy" } },
  { id: "I5", given: "Takeshi", surname: "Tanaka", sex: "M", birthYear: 1909, birthDate: "30 MAR 1909", birthPlace: "Kyoto, Japan", death: { date: "1981", place: "Kyoto, Japan" } },
  { id: "I6", given: "Yoshiko", surname: "Sato", sex: "F", birthYear: 1912, birthDate: "2 SEP 1912", birthPlace: "Kyoto, Japan", death: { date: "1999", place: "Kyoto, Japan" } },
  { id: "I7", given: "José", surname: "Hernández", sex: "M", birthYear: 1914, birthDate: "19 JAN 1914", birthPlace: "Guadalajara, Jalisco, Mexico", death: { date: "1985", place: "Guadalajara, Jalisco, Mexico" } },
  { id: "I8", given: "Rosa", surname: "López", sex: "F", birthYear: 1918, birthDate: "7 AUG 1918", birthPlace: "Guadalajara, Jalisco, Mexico", death: { date: "2003", place: "Los Angeles, California, USA" } },
  { id: "I9", given: "Aino", surname: "Virtanen", sex: "F", birthYear: 1941, birthDate: "12 JUN 1941", birthPlace: "Tampere, Finland", mother: "I2", father: "I1", population: "FIN" },
  { id: "I10", given: "Marco", surname: "Rossi", sex: "M", birthYear: 1938, birthDate: "25 DEC 1938", birthPlace: "Siena, Tuscany, Italy", mother: "I4", father: "I3", population: "TSI", death: { date: "2019", place: "Siena, Tuscany, Italy" } },
  { id: "I11", given: "Hiroshi", surname: "Tanaka", sex: "M", birthYear: 1936, birthDate: "11 FEB 1936", birthPlace: "Kyoto, Japan", mother: "I6", father: "I5", population: "JPT", death: { date: "2014", place: "Los Angeles, California, USA" } },
  { id: "I12", given: "María", surname: "Hernández", sex: "F", birthYear: 1940, birthDate: "5 MAY 1940", birthPlace: "Guadalajara, Jalisco, Mexico", mother: "I8", father: "I7", population: "MXL" },
  { id: "I13", given: "Elena", surname: "Rossi", sex: "F", birthYear: 1968, birthDate: "17 OCT 1968", birthPlace: "Siena, Tuscany, Italy", mother: "I9", father: "I10", kit: true, role: "Mother" },
  { id: "I14", given: "Laura", surname: "Rossi", sex: "F", birthYear: 1971, birthDate: "3 MAR 1971", birthPlace: "Siena, Tuscany, Italy", mother: "I9", father: "I10", kit: true, role: "Aunt" },
  { id: "I15", given: "Kenji", surname: "Tanaka", sex: "M", birthYear: 1965, birthDate: "22 JAN 1965", birthPlace: "Los Angeles, California, USA", mother: "I12", father: "I11", kit: true, role: "Father" },
  { id: "I16", given: "James", surname: "Walker", sex: "M", birthYear: 1969, birthDate: "8 JUL 1969", birthPlace: "Leeds, England, United Kingdom", population: "GBR" },
  { id: "I17", given: "Leo", surname: "Tanaka", sex: "M", birthYear: 1995, birthDate: "29 APR 1995", birthPlace: "San Francisco, California, USA", mother: "I13", father: "I15", kit: true, role: "You (the tester)" },
  { id: "I18", given: "Mia", surname: "Tanaka", sex: "F", birthYear: 1998, birthDate: "14 NOV 1998", birthPlace: "San Francisco, California, USA", mother: "I13", father: "I15", kit: true, role: "Sister" },
  { id: "I19", given: "Sophie", surname: "Walker", sex: "F", birthYear: 1999, birthDate: "6 FEB 1999", birthPlace: "Leeds, England, United Kingdom", mother: "I14", father: "I16", kit: true, role: "First cousin" },
];
/** An unrelated person with a kit, outside the tree. */
export const DEMO_UNRELATED: DemoPerson = { id: "U1", given: "Adaeze", surname: "Okafor", sex: "F", birthYear: 1990, birthDate: "1990", birthPlace: "Lagos, Nigeria", population: "YRI", kit: true, role: "Unrelated" };

/** Match-list-only relatives: segments drawn from the simulator for a known relationship. */
export const DEMO_DISTANT: ReadonlyArray<{ name: string; relationship: string; note: string }> = [
  { name: "Kaisa Laine", relationship: "2C", note: "Great-grandmother Helmi Laine's side" },
  { name: "Tommi Laine", relationship: "2C1R", note: "Great-grandmother Helmi Laine's side" },
  { name: "Giulia Bianchi", relationship: "2C", note: "Great-grandmother Maria Bianchi's side" },
  { name: "Luca Bianchi", relationship: "3C", note: "Maria Bianchi's grandparents' side" },
  { name: "Carmen López", relationship: "2C", note: "Great-grandmother Rosa López's side" },
  { name: "Diego López", relationship: "3C1R", note: "Rosa López's grandparents' side" },
  { name: "Aiko Sato", relationship: "3C", note: "Great-grandmother Yoshiko Sato's side" },
  { name: "Ren Sato", relationship: "4C", note: "Yoshiko Sato's great-grandparents' side" },
  { name: "Pedro Hernández", relationship: "half-1C", note: "José Hernández's son by a first marriage" },
  { name: "Matti Virtanen", relationship: "1C1R", note: "Aino Virtanen's brother's grandson" },
];

export interface DemoFamily {
  people: DemoPerson[];
  kits: Map<string, Kit>;
  gedcom: string;
  segmentsCsv: string;
  /** True relationship of each match-list row, keyed by match name, for revealing next to estimates. */
  truth: Record<string, string>;
}

const SUPER: Record<string, string> = { FIN: "EUR", TSI: "EUR", GBR: "EUR", CEU: "EUR", IBS: "EUR", JPT: "EAS", CHB: "EAS", CHS: "EAS", CDX: "EAS", KHV: "EAS", MXL: "AMR", PUR: "AMR", CLM: "AMR", PEL: "AMR", YRI: "AFR", LWK: "AFR", GWD: "AFR", MSL: "AFR", ESN: "AFR", ASW: "AFR", ACB: "AFR", GIH: "SAS", PJL: "SAS", BEB: "SAS", STU: "SAS", ITU: "SAS" };

interface Genome { auto: [Uint8Array, Uint8Array]; x: Uint8Array[]; traits: [Uint8Array, Uint8Array] }

export interface DemoInputs {
  panel: ReferencePanelData;
  map: GeneticMap;
  /** Mean continental component proportions of each 1000 Genomes population (from the panel metadata). */
  meanProportions: Record<string, number[]>;
  traits: DemoTraitSite[];
  seed?: number;
}

export function makeDemoFamily(input: DemoInputs): DemoFamily {
  const { panel, map } = input;
  const rng = mulberry32(input.seed ?? 1995);
  const N = panel.header.nSnp, K = panel.header.components.length, P = panel.header.populations.length, scale = panel.header.freqScale;
  const denseToCore = new Int32Array(N).fill(-1);
  panel.coreIndex.forEach((i, k) => { denseToCore[i] = k; });
  const cm = new Float64Array(N);
  for (let i = 0; i < N; i++) cm[i] = map.cM(panel.header.chromosomes[panel.chromIdx[i]!]!, panel.pos[i]!) ?? 0;
  // Chromosome index ranges in the dense layer.
  const ranges: Array<[number, number]> = [];
  { let i = 0; for (let c = 0; c < panel.header.chromosomes.length; c++) { const s = i; while (i < N && panel.chromIdx[i] === c) i++; ranges.push([s, i]); } }
  const X_SITES = 2000;
  const xFreq = Float64Array.from({ length: X_SITES }, () => 0.15 + 0.7 * rng());

  const founder = (pop: string, sex: "M" | "F"): Genome => {
    const p = panel.header.populations.indexOf(pop);
    if (p < 0) throw new Error(`Unknown population ${pop}`);
    const q = input.meanProportions[pop] ?? new Array(K).fill(1 / K);
    const hap = () => {
      const h = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const k = denseToCore[i]!;
        let f: number;
        if (k >= 0) f = panel.popFreq[k * P + p]! / scale;
        else { f = 0; for (let c = 0; c < K; c++) f += q[c]! * (panel.compFreq[i * K + c]! / scale); }
        h[i] = rng() < f ? 1 : 0;
      }
      return h;
    };
    const xHap = () => Uint8Array.from(xFreq, (f) => (rng() < f ? 1 : 0));
    const sup = SUPER[pop] ?? "EUR";
    const tHap = () => Uint8Array.from(input.traits, (t) => (rng() < (t.freq[sup] ?? 0.5) ? 1 : 0));
    return { auto: [hap(), hap()], x: sex === "F" ? [xHap(), xHap()] : [xHap()], traits: [tHap(), tHap()] };
  };

  const recombine = (a: Uint8Array, b: Uint8Array): Uint8Array => {
    const out = new Uint8Array(N);
    for (const [s, e] of ranges) {
      if (e <= s) continue;
      const L = cm[e - 1]! - cm[s]!;
      const cuts: number[] = [];
      // Poisson(L/100) crossovers by inversion.
      const lim = Math.exp(-L / 100); let prod = rng(), k = 0;
      while (prod > lim) { k++; prod *= rng(); }
      for (let j = 0; j < k; j++) cuts.push(cm[s]! + rng() * L);
      cuts.sort((x, y) => x - y);
      let which = rng() < 0.5, c = 0;
      for (let i = s; i < e; i++) {
        while (c < cuts.length && cm[i]! > cuts[c]!) { which = !which; c++; }
        out[i] = which ? a[i]! : b[i]!;
      }
    }
    return out;
  };
  const xGamete = (g: Genome): Uint8Array => {
    if (g.x.length === 1) return g.x[0]!;
    const [a, b] = g.x as [Uint8Array, Uint8Array];
    const out = new Uint8Array(X_SITES);
    let which = rng() < 0.5;
    for (let i = 0; i < X_SITES; i++) { if (rng() < 1.8 / X_SITES) which = !which; out[i] = which ? a[i]! : b[i]!; }
    return out;
  };
  const traitGamete = (g: Genome) => Uint8Array.from(g.traits[0], (_, i) => (rng() < 0.5 ? g.traits[0][i]! : g.traits[1][i]!));
  const child = (mother: Genome, father: Genome, sex: "M" | "F"): Genome => ({
    auto: [recombine(mother.auto[0], mother.auto[1]), recombine(father.auto[0], father.auto[1])],
    x: sex === "F" ? [xGamete(mother), father.x[0]!] : [xGamete(mother)],
    traits: [traitGamete(mother), traitGamete(father)],
  });

  const people = [...DEMO_PEOPLE];
  const genomes = new Map<string, Genome>();
  const byId = new Map(people.map((p) => [p.id, p]));
  const genomeOf = (id: string): Genome => {
    const known = genomes.get(id);
    if (known) return known;
    const p = byId.get(id)!;
    const g = p.population ? founder(p.population, p.sex) : child(genomeOf(p.mother!), genomeOf(p.father!), p.sex);
    genomes.set(id, g);
    return g;
  };

  const toKit = (g: Genome, sex: "M" | "F"): Kit => {
    const rows: Variant[] = [];
    const noCall = 0.004, err = 0.0008;
    for (let i = 0; i < N; i++) {
      if (rng() < noCall) { rows.push({ rsid: `lp${i + 1}`, chrom: panel.header.chromosomes[panel.chromIdx[i]!]!, pos: panel.pos[i]!, genotype: "" }); continue; }
      let a = g.auto[0][i]!, b = g.auto[1][i]!;
      if (rng() < err) a = 1 - a;
      const r = BASE_CODES[panel.ref[i]!]!, t = BASE_CODES[panel.alt[i]!]!;
      rows.push({ rsid: `lp${i + 1}`, chrom: panel.header.chromosomes[panel.chromIdx[i]!]!, pos: panel.pos[i]!, genotype: [a ? t : r, b ? t : r].sort().join("") });
    }
    const xLen = GRCH37_LENGTH.X;
    for (let i = 0; i < X_SITES; i++) {
      const pos = 2_800_000 + Math.floor((i / X_SITES) * (xLen - 5_600_000));
      const al = (v: number) => (v ? "G" : "A");
      rows.push({ rsid: `lpx${i + 1}`, chrom: "X", pos, genotype: sex === "F" ? [al(g.x[0]![i]!), al(g.x[1]![i]!)].sort().join("") : al(g.x[0]![i]!) });
    }
    for (let i = 0; i < 300; i++) rows.push({ rsid: `lpy${i + 1}`, chrom: "Y", pos: 2_800_000 + i * 50_000, genotype: sex === "M" ? (i % 3 === 0 ? "C" : "T") : "" });
    input.traits.forEach((t, i) => {
      const al = (v: number) => (v ? t.effect : t.other);
      rows.push({ rsid: t.rsid, chrom: t.chrom, pos: t.pos, genotype: [al(g.traits[0][i]!), al(g.traits[1][i]!)].sort().join("") });
    });
    return new Kit({ format: "23andme", build: 37, headerLines: ["# Lineage demo family: generated in your browser; not a real person"], strand: "plus", chipVersion: "demo" }, rows);
  };

  const kits = new Map<string, Kit>();
  for (const p of [...people, DEMO_UNRELATED]) {
    if (!p.kit) continue;
    if (p === DEMO_UNRELATED) genomes.set(p.id, founder(p.population!, p.sex));
    kits.set(p.id, toKit(genomeOf(p.id), p.sex));
  }

  // Match list for the tester: real comparisons with the genotyped relatives, simulated rows for the rest.
  const tester = kits.get("I17")!;
  const segs: MatchSegment[] = [];
  const truth: Record<string, string> = {};
  const REL_BY_ROLE: Record<string, string> = { Mother: "parent", Father: "parent", Sister: "sibling", Aunt: "aunt-uncle", "First cousin": "1C", Unrelated: "unrelated" };
  for (const p of [...people, DEMO_UNRELATED]) {
    if (!p.kit || p.id === "I17") continue;
    const name = `${p.given} ${p.surname}`;
    truth[name] = REL_BY_ROLE[p.role ?? ""] ?? "unknown";
    const r = compareKits(tester, kits.get(p.id)!, { map, includeX: false });
    for (const s of r.halfIdentical) segs.push({ match: name, chrom: s.chrom, start: s.start, end: s.end, cm: Number((s.lengthCm ?? 0).toFixed(1)), snps: s.snps });
  }
  const lengths = AUTOSOMES.map((c) => map.length(c) ?? 0);
  for (const d of DEMO_DISTANT) {
    const spec = DEFAULT_RELATIONSHIPS.find((r) => r.id === d.relationship)!;
    truth[d.name] = d.relationship;
    // Redraw until the simulated pair shares something detectable, as anyone on a match list does.
    let sim = simulatePairSegments(spec, rng, lengths);
    for (let tries = 0; sim.pair.segments === 0 && tries < 50; tries++) sim = simulatePairSegments(spec, rng, lengths);
    for (const s of sim.segments) {
      if (s.kind !== "half") continue;
      const chrom = AUTOSOMES[s.chromIndex]!;
      const offset = map.cM(chrom, 0) ?? 0;
      const start = map.bp?.(chrom, s.startCm + offset) ?? 0, end = map.bp?.(chrom, s.endCm + offset) ?? 0;
      segs.push({ match: d.name, chrom, start, end, cm: Number((s.endCm - s.startCm).toFixed(1)), snps: Math.round((end - start) / 1600) });
    }
  }
  const order = (c: string) => (c === "X" ? 23 : Number(c));
  segs.sort((a, b) => a.match.localeCompare(b.match) || order(a.chrom) - order(b.chrom) || a.start - b.start);
  const segmentsCsv = ["Match Name,Chromosome,Start Location,End Location,Centimorgans,Matching SNPs",
    ...segs.map((s) => `${s.match},${s.chrom},${s.start},${s.end},${s.cm},${s.snps ?? ""}`)].join("\n") + "\n";

  return { people: [...people, DEMO_UNRELATED], kits, gedcom: demoGedcom(people), segmentsCsv, truth };
}

/** GEDCOM 5.5.1 for the demo tree. */
export function demoGedcom(people: readonly DemoPerson[] = DEMO_PEOPLE): string {
  const lines = ["0 HEAD", "1 SOUR Lineage", "2 VERS 0.2", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8",
    "1 NOTE The Lineage demo family. Every person is fictional; genotyped members' DNA is generated in the browser."];
  const fams = new Map<string, { husb?: string; wife?: string; chil: string[] }>();
  for (const p of people) if (p.mother || p.father) {
    const key = `${p.father ?? ""}+${p.mother ?? ""}`;
    const f = fams.get(key) ?? { husb: p.father, wife: p.mother, chil: [] };
    f.chil.push(p.id);
    fams.set(key, f);
  }
  // James Walker and Laura Rossi are the cousin's parents; every couple becomes a FAM.
  const famIds = new Map<string, string>();
  [...fams.keys()].forEach((k, i) => famIds.set(k, `F${i + 1}`));
  for (const p of people) {
    lines.push(`0 @${p.id}@ INDI`, `1 NAME ${p.given} /${p.surname}/`, `2 GIVN ${p.given}`, `2 SURN ${p.surname}`, `1 SEX ${p.sex}`, "1 BIRT", `2 DATE ${p.birthDate}`, `2 PLAC ${p.birthPlace}`);
    if (p.death) lines.push("1 DEAT", `2 DATE ${p.death.date}`, `2 PLAC ${p.death.place}`);
    if (p.mother || p.father) lines.push(`1 FAMC @${famIds.get(`${p.father ?? ""}+${p.mother ?? ""}`)}@`);
    for (const [k, f] of fams) if (f.husb === p.id || f.wife === p.id) lines.push(`1 FAMS @${famIds.get(k)}@`);
    if (p.role) lines.push(`1 NOTE Demo kit: ${p.role}.`);
  }
  for (const [k, f] of fams) {
    lines.push(`0 @${famIds.get(k)}@ FAM`);
    if (f.husb) lines.push(`1 HUSB @${f.husb}@`);
    if (f.wife) lines.push(`1 WIFE @${f.wife}@`);
    for (const c of f.chil) lines.push(`1 CHIL @${c}@`);
  }
  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}
