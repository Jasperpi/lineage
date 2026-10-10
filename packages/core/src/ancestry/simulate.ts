/**
 * Admixed genomes with known ancestry, for testing and validating the
 * ancestry engine. The same code drives the unit tests (on synthetic
 * haplotypes) and the validation harness (scripts/data/08-validate.mjs, on
 * phased reference haplotypes held out of every fit).
 *
 * Two ways to make a genome, following haptools simgenotype (Massarat et al.
 * 2023) and the pedigree simulator in relationship/simulate.ts:
 *  - mosaicHaplotype: old admixture. Along each chromosome, ancestry switches
 *    at the points of a Poisson process of rate `generations` per Morgan;
 *    each tract takes its ancestry from `q` and its alleles from a donor
 *    haplotype of that ancestry drawn afresh.
 *  - meiosis: one meiosis, with a Poisson number of crossovers (mean = the
 *    chromosome's length in Morgans; Haldane's model), for recent pedigrees
 *    (four grandparents of chosen ancestry give shares of 25, 12.5 and 6.25%).
 * toGenotypes then applies what a consumer chip does to a genome: a SNP mask,
 * no-calls and misread alleles.
 */
import type { GeneticMap } from "../compare/geneticmap.js";
import type { PanelGenotypes, ReferencePanelData } from "./reference.js";

/** One chromosome copy across the whole panel: an allele (0 = REF, 1 = ALT) and an ancestry label per dense SNP. */
export interface Haplotype { alleles: Uint8Array; labels: Uint8Array }

/** cM position of every dense SNP (0 where the map lacks the chromosome). */
export function panelCm(panel: ReferencePanelData, map: GeneticMap): Float64Array {
  const out = new Float64Array(panel.header.nSnp);
  for (let i = 0; i < out.length; i++) out[i] = map.cM(panel.header.chromosomes[panel.chromIdx[i]!]!, panel.pos[i]!) ?? 0;
  return out;
}

function chromRanges(panel: ReferencePanelData): Array<[number, number]> {
  const r: Array<[number, number]> = [];
  for (let i = 0; i < panel.header.nSnp; i++) {
    if (i === 0 || panel.chromIdx[i] !== panel.chromIdx[i - 1]) r.push([i, i + 1]); else r[r.length - 1]![1] = i + 1;
  }
  return r;
}

function exp(rng: () => number, rate: number): number {
  return -Math.log(1 - rng()) / rate;
}

function pick(rng: () => number, q: number[]): number {
  let u = rng(), k = 0;
  for (; k < q.length - 1; k++) { u -= q[k]!; if (u < 0) break; }
  return k;
}

/**
 * One haplotype of a population admixed `generations` ago in proportions `q`.
 * `donors[k]` lists haplotypes (alleles per dense SNP) of ancestry k.
 */
export function mosaicHaplotype(rng: () => number, panel: ReferencePanelData, cm: Float64Array, donors: Uint8Array[][], q: number[], generations: number): Haplotype {
  const n = panel.header.nSnp;
  const alleles = new Uint8Array(n), labels = new Uint8Array(n);
  const ratePerCm = generations / 100;
  for (const [s, e] of chromRanges(panel)) {
    let label = pick(rng, q), donor = donors[label]![Math.floor(rng() * donors[label]!.length)]!;
    let next = cm[s]! + (ratePerCm > 0 ? exp(rng, ratePerCm) : Infinity);
    for (let i = s; i < e; i++) {
      while (cm[i]! >= next) {
        label = pick(rng, q);
        donor = donors[label]![Math.floor(rng() * donors[label]!.length)]!;
        next += exp(rng, ratePerCm);
      }
      alleles[i] = donor[i]!;
      labels[i] = label;
    }
  }
  return { alleles, labels };
}

/** A haplotype copied whole from one donor (a founder of known ancestry). */
export function founderHaplotype(donor: Uint8Array, label: number): Haplotype {
  return { alleles: donor, labels: new Uint8Array(donor.length).fill(label) };
}

/** One gamete from a person with haplotypes a and b: crossovers at Poisson(length in Morgans) uniform cM points. */
export function meiosis(rng: () => number, panel: ReferencePanelData, cm: Float64Array, a: Haplotype, b: Haplotype): Haplotype {
  const n = panel.header.nSnp;
  const alleles = new Uint8Array(n), labels = new Uint8Array(n);
  for (const [s, e] of chromRanges(panel)) {
    const start = cm[s]!, len = cm[e - 1]! - start;
    const cuts: number[] = [];
    // Poisson count by inversion, then uniform positions.
    let k = 0, p = Math.exp(-len / 100), sum = p;
    const u = rng();
    while (u > sum && k < 50) { k++; p *= len / 100 / k; sum += p; }
    for (let c = 0; c < k; c++) cuts.push(start + rng() * len);
    cuts.sort((x, y) => x - y);
    let from = rng() < 0.5 ? a : b, ci = 0;
    for (let i = s; i < e; i++) {
      while (ci < cuts.length && cm[i]! >= cuts[ci]!) { from = from === a ? b : a; ci++; }
      alleles[i] = from.alleles[i]!;
      labels[i] = from.labels[i]!;
    }
  }
  return { alleles, labels };
}

export interface ChipConditions {
  /** Dense SNPs the chip carries (1) or not (0); all when absent. */
  mask?: Uint8Array;
  /** Share of carried SNPs with no call. */
  noCall?: number;
  /** Chance that each allele is misread. */
  alleleError?: number;
}

/** The panel genotypes a chip would report for a person with haplotypes h0 and h1. */
export function toGenotypes(rng: () => number, h0: Haplotype, h1: Haplotype, cond: ChipConditions = {}, panel?: ReferencePanelData): PanelGenotypes {
  const n = h0.alleles.length;
  const dosage = new Int8Array(n).fill(-1);
  let called = 0, notOnChip = 0, noCall = 0;
  const e = cond.alleleError ?? 0, nc = cond.noCall ?? 0;
  const perChromosome = panel ? new Array<number>(panel.header.chromosomes.length).fill(0) : [];
  for (let i = 0; i < n; i++) {
    if (cond.mask && !cond.mask[i]) { notOnChip++; continue; }
    if (nc > 0 && rng() < nc) { noCall++; continue; }
    let a = h0.alleles[i]!, b = h1.alleles[i]!;
    if (e > 0) { if (rng() < e) a ^= 1; if (rng() < e) b ^= 1; }
    dosage[i] = a + b;
    called++;
    if (panel) perChromosome[panel.chromIdx[i]!]!++;
  }
  return { dosage, called, strandFlipped: 0, alleleMismatch: 0, notOnChip, noCall, conflicting: 0, perChromosome, build: 37 };
}

/** True ancestry proportions of a person, by cM of genetic map (the same measure the painter's totals use) or by SNP. */
export function trueProportions(h0: Haplotype, h1: Haplotype, K: number, cm?: Float64Array, panel?: ReferencePanelData): number[] {
  const out = new Array<number>(K).fill(0);
  let total = 0;
  for (let i = 0; i < h0.labels.length; i++) {
    let w = 1;
    if (cm && panel) {
      const same = (j: number) => j >= 0 && j < h0.labels.length && panel.chromIdx[j] === panel.chromIdx[i];
      const lo = same(i - 1) ? (cm[i]! + cm[i - 1]!) / 2 : cm[i]!;
      const hi = same(i + 1) ? (cm[i]! + cm[i + 1]!) / 2 : cm[i]!;
      w = Math.max(0, hi - lo);
    }
    out[h0.labels[i]!]! += w; out[h1.labels[i]!]! += w;
    total += 2 * w;
  }
  return out.map((x) => (total ? x / total : 0));
}

/** The true unordered ancestry pair at a dense SNP. */
export function truePair(h0: Haplotype, h1: Haplotype, i: number): [number, number] {
  const a = h0.labels[i]!, b = h1.labels[i]!;
  return a <= b ? [a, b] : [b, a];
}

/** Draw a vector from a Dirichlet(alpha) distribution (Gamma draws by Marsaglia & Tsang). */
export function dirichlet(rng: () => number, alpha: number[]): number[] {
  const gamma = (a: number): number => {
    if (a < 1) return gamma(1 + a) * Math.pow(rng(), 1 / a);
    const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = 0, v = 0;
      do {
        const u1 = Math.max(1e-12, rng()), u2 = rng();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const g = alpha.map(gamma);
  const s = g.reduce((a, b) => a + b, 0);
  return g.map((x) => x / s);
}
