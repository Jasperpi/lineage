/**
 * Relationship likelihoods by pedigree simulation.
 *
 * Shared-cM tables list which relationships have been observed at a given
 * total, but the ranges overlap so heavily that a total alone cannot choose
 * between, say, a half sibling, a grandparent and an aunt. Those three differ
 * in how their shared DNA is cut up: one meiosis separates a grandchild from a
 * grandparent, two separate half siblings, so the same expected total arrives
 * in fewer, longer segments for the grandparent. Simulation captures that.
 *
 * Model (the standard one used by pedigree IBD simulators such as Ped-sim):
 *  - the genome is the 22 autosomes with genetic lengths from the bundled map;
 *  - each meiosis places a Poisson number of crossovers (mean = length in
 *    Morgans) uniformly along each chromosome and starts on a random parental
 *    haplotype (Haldane's model: no crossover interference, sex-averaged map);
 *  - the common ancestors carry distinct founder haplotypes, every spouse
 *    marrying into either line carries haplotypes of their own, and a
 *    position is shared when the two relatives carry the same founder
 *    haplotype there;
 *  - shared positions are merged into segments and only segments at or above
 *    a detection threshold (default 7 cM) are counted, the way match lists do;
 *    stretches shared on both copies ("fully identical", as full siblings
 *    have) are counted the same way.
 *
 * Ignoring interference and sex differences in recombination widens the
 * simulated spread of segment counts slightly; the result says so.
 */
import { mulberry32 } from "../util/random.js";

/** A relationship described by its pedigree: generations up from A and down to B, via one or two common ancestors. */
export interface RelationshipSpec {
  id: string;
  label: string;
  up: number;
  down: number;
  /** One common ancestor (half relationship) instead of an ancestral couple. */
  half: boolean;
  /** Matching id in the Shared cM Project v4 table, when there is one. */
  sharedCmId?: string;
}

/** Interval of a chromosome (in cM) carrying one founder haplotype. */
interface Piece { start: number; end: number; label: number }
type Haplotype = Piece[];
type Genome = Haplotype[][]; // [chromosome][0|1] pieces

export interface SimulatedPair { totalCm: number; segments: number; longestCm: number; fullCm: number }

export interface SimulationOptions {
  /** Genetic length of each autosome in cM, in order 1-22. */
  chromosomeCm: number[];
  pairs?: number;
  seed?: number;
  /** Segments shorter than this are not counted (match lists use 6-8 cM). Default 7. */
  minSegmentCm?: number;
}

export const DEFAULT_RELATIONSHIPS: readonly RelationshipSpec[] = [
  { id: "twin", label: "Identical twin, or the same person", up: 0, down: 0, half: false },
  { id: "parent", label: "Parent or child", up: 1, down: 0, half: false, sharedCmId: "Parent" },
  { id: "sibling", label: "Full sibling", up: 1, down: 1, half: false, sharedCmId: "Sibling" },
  { id: "half-sibling", label: "Half sibling", up: 1, down: 1, half: true, sharedCmId: "Half_Sibling" },
  { id: "grandparent", label: "Grandparent or grandchild", up: 2, down: 0, half: false, sharedCmId: "Grandparent" },
  { id: "aunt-uncle", label: "Aunt, uncle, niece or nephew", up: 2, down: 1, half: false, sharedCmId: "Aunt_/_Uncle" },
  { id: "great-grandparent", label: "Great-grandparent or great-grandchild", up: 3, down: 0, half: false, sharedCmId: "Great-Grandparent" },
  { id: "half-aunt-uncle", label: "Half aunt, uncle, niece or nephew", up: 2, down: 1, half: true, sharedCmId: "Half_Aunt_/_Uncle" },
  { id: "great-aunt-uncle", label: "Great-aunt or great-uncle", up: 3, down: 1, half: false, sharedCmId: "Great-Aunt_/_Uncle" },
  { id: "1C", label: "First cousin", up: 2, down: 2, half: false, sharedCmId: "1C" },
  { id: "half-1C", label: "Half first cousin", up: 2, down: 2, half: true, sharedCmId: "Half_1C" },
  { id: "1C1R", label: "First cousin once removed", up: 2, down: 3, half: false, sharedCmId: "1C1R" },
  { id: "half-1C1R", label: "Half first cousin once removed", up: 2, down: 3, half: true, sharedCmId: "Half_1C1R" },
  { id: "1C2R", label: "First cousin twice removed", up: 2, down: 4, half: false, sharedCmId: "1C2R" },
  { id: "2C", label: "Second cousin", up: 3, down: 3, half: false, sharedCmId: "2C" },
  { id: "half-2C", label: "Half second cousin", up: 3, down: 3, half: true, sharedCmId: "Half_2C" },
  { id: "2C1R", label: "Second cousin once removed", up: 3, down: 4, half: false, sharedCmId: "2C1R" },
  { id: "2C2R", label: "Second cousin twice removed", up: 3, down: 5, half: false, sharedCmId: "2C2R" },
  { id: "3C", label: "Third cousin", up: 4, down: 4, half: false, sharedCmId: "3C" },
  { id: "3C1R", label: "Third cousin once removed", up: 4, down: 5, half: false, sharedCmId: "3C1R" },
  { id: "4C", label: "Fourth cousin", up: 5, down: 5, half: false, sharedCmId: "4C" },
  { id: "5C", label: "Fifth cousin", up: 6, down: 6, half: false, sharedCmId: "5C" },
  { id: "6C", label: "Sixth cousin", up: 7, down: 7, half: false, sharedCmId: "6C" },
];

/** Poisson draw by inversion; fine for the small means (< 3) of one chromosome. */
function poisson(rng: () => number, mean: number): number {
  const L = Math.exp(-mean);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/** One gamete: a recombinant of a person's two haplotypes on every chromosome. */
function gamete(rng: () => number, g: Genome, lengths: number[]): Haplotype[] {
  return g.map(([h0, h1], c) => {
    const L = lengths[c]!;
    const n = poisson(rng, L / 100);
    const cuts = Array.from({ length: n }, () => rng() * L).sort((a, b) => a - b);
    let which = rng() < 0.5 ? 0 : 1;
    const out: Piece[] = [];
    let from = 0;
    for (const cut of [...cuts, L]) {
      copyRange(which === 0 ? h0! : h1!, from, cut, out);
      from = cut;
      which = 1 - which;
    }
    return out;
  });
}

/** Append the part of `h` within [from, to) to `out`, merging with an equal-label tail. */
function copyRange(h: Haplotype, from: number, to: number, out: Piece[]): void {
  if (to <= from) return;
  for (const p of h) {
    if (p.end <= from || p.start >= to) continue;
    const s = Math.max(p.start, from), e = Math.min(p.end, to);
    const last = out[out.length - 1];
    if (last && last.label === p.label && Math.abs(last.end - s) < 1e-9) last.end = e;
    else out.push({ start: s, end: e, label: p.label });
  }
}

class Labels { private n = 0; next(): number { return ++this.n; } }

function founder(labels: Labels, lengths: number[]): Genome {
  const a = labels.next(), b = labels.next();
  return lengths.map((L) => [[{ start: 0, end: L, label: a }], [{ start: 0, end: L, label: b }]]);
}

function childOf(rng: () => number, mother: Genome, father: Genome, lengths: number[]): Genome {
  const m = gamete(rng, mother, lengths), f = gamete(rng, father, lengths);
  return lengths.map((_, c) => [m[c]!, f[c]!]);
}

/** Walk `generations` meioses down from `start`, each child with a fresh, unrelated spouse. */
function descend(rng: () => number, start: Genome, generations: number, labels: Labels, lengths: number[]): Genome {
  let g = start;
  for (let i = 0; i < generations; i++) g = childOf(rng, g, founder(labels, lengths), lengths);
  return g;
}

/**
 * Simulate one related pair and return its detectable sharing. A is `up`
 * generations below the common ancestor(s), B is `down` generations below;
 * down = 0 means B is the ancestor.
 */
export function simulatePair(spec: RelationshipSpec, rng: () => number, lengths: number[], minSegmentCm = 7): SimulatedPair {
  return simulatePairSegments(spec, rng, lengths, minSegmentCm).pair;
}

/** A shared segment of a simulated pair, in cM along autosome `chromIndex` (0 = chromosome 1). */
export interface SimSegment { chromIndex: number; startCm: number; endCm: number; kind: "half" | "full" }

/** As simulatePair, and also where each detectable shared segment lies (for drawing and demo data). */
export function simulatePairSegments(spec: RelationshipSpec, rng: () => number, lengths: number[], minSegmentCm = 7): { pair: SimulatedPair; segments: SimSegment[] } {
  const labels = new Labels();
  let a: Genome, b: Genome;
  if (spec.down === 0 || spec.up === 0) {
    const anc = founder(labels, lengths);
    const gens = Math.max(spec.up, spec.down);
    b = anc;
    a = descend(rng, anc, gens, labels, lengths);
  } else {
    const p1 = founder(labels, lengths);
    const p2 = spec.half ? undefined : founder(labels, lengths);
    // Each line starts with a child of the common ancestor(s); a half relationship has a different other parent per line.
    const firstA = childOf(rng, p1, p2 ?? founder(labels, lengths), lengths);
    const firstB = childOf(rng, p1, p2 ?? founder(labels, lengths), lengths);
    a = descend(rng, firstA, spec.up - 1, labels, lengths);
    b = descend(rng, firstB, spec.down - 1, labels, lengths);
  }
  const segments: SimSegment[] = [];
  return { pair: shared(a, b, lengths, minSegmentCm, segments), segments };
}

/** Breakpoints of both people's haplotypes, then IBD count (0, 1, 2) on each interval. */
function shared(a: Genome, b: Genome, lengths: number[], minSegmentCm: number, collect?: SimSegment[]): SimulatedPair {
  let totalCm = 0, segments = 0, longestCm = 0, fullCm = 0;
  lengths.forEach((L, c) => {
    const haps = [a[c]![0]!, a[c]![1]!, b[c]![0]!, b[c]![1]!];
    const cuts = new Set<number>([0, L]);
    for (const h of haps) for (const p of h) { cuts.add(p.start); cuts.add(p.end); }
    const xs = [...cuts].sort((x, y) => x - y);
    const labelAt = (h: Haplotype, x: number) => h.find((p) => p.start <= x && x < p.end)?.label ?? -1;
    let runStart = -1, fullStart = -1;
    const close = (end: number) => {
      if (runStart < 0) return;
      const len = end - runStart;
      if (len >= minSegmentCm) {
        totalCm += len; segments++; longestCm = Math.max(longestCm, len);
        collect?.push({ chromIndex: c, startCm: runStart, endCm: end, kind: "half" });
      }
      runStart = -1;
    };
    const closeFull = (end: number) => {
      if (fullStart < 0) return;
      if (end - fullStart >= minSegmentCm) {
        fullCm += end - fullStart;
        collect?.push({ chromIndex: c, startCm: fullStart, endCm: end, kind: "full" });
      }
      fullStart = -1;
    };
    for (let i = 0; i < xs.length - 1; i++) {
      const s = xs[i]!, e = xs[i + 1]!;
      if (e - s < 1e-9) continue;
      const mid = (s + e) / 2;
      const [a0, a1, b0, b1] = haps.map((h) => labelAt(h, mid)) as [number, number, number, number];
      // Count matching haplotype pairs without reusing a haplotype (IBD0/1/2).
      const ibd = (a0 === b0 && a1 === b1) || (a0 === b1 && a1 === b0) ? 2 : a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1 ? 1 : 0;
      if (ibd === 2) { if (fullStart < 0) fullStart = s; }
      else closeFull(s);
      if (ibd > 0) { if (runStart < 0) runStart = s; }
      else close(s);
    }
    closeFull(L);
    close(L);
  });
  return { totalCm, segments, longestCm, fullCm };
}

export interface RelationshipDistribution {
  spec: RelationshipSpec;
  pairs: SimulatedPair[];
  summary: { meanCm: number; sdCm: number; p01: number; p50: number; p99: number; meanSegments: number; noSharing: number };
}

export function simulateRelationships(specs: readonly RelationshipSpec[], opts: SimulationOptions): RelationshipDistribution[] {
  const n = opts.pairs ?? 2000;
  const rng = mulberry32(opts.seed ?? 20260925);
  return specs.map((spec) => {
    const pairs = Array.from({ length: n }, () => simulatePair(spec, rng, opts.chromosomeCm, opts.minSegmentCm ?? 7));
    return { spec, pairs, summary: summarise(pairs) };
  });
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

export function summarise(pairs: SimulatedPair[]): RelationshipDistribution["summary"] {
  const t = pairs.map((p) => p.totalCm).sort((a, b) => a - b);
  const mean = t.reduce((a, b) => a + b, 0) / t.length;
  const sd = Math.sqrt(t.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, t.length - 1));
  return {
    meanCm: mean, sdCm: sd, p01: quantile(t, 0.01), p50: quantile(t, 0.5), p99: quantile(t, 0.99),
    meanSegments: pairs.reduce((a, p) => a + p.segments, 0) / pairs.length,
    noSharing: pairs.filter((p) => p.segments === 0).length / pairs.length,
  };
}

/* ------------------------------------------------------------------ */
/* Likelihoods                                                         */
/* ------------------------------------------------------------------ */

export interface ObservedSharing {
  totalCm: number;
  /** Number of segments at or above the simulation threshold, when known. */
  segments?: number;
  /** Fully identical cM (runs at or above the threshold), known only from a direct two-kit comparison. */
  fullCm?: number;
}

export interface RelationshipPosterior {
  spec: RelationshipSpec;
  likelihood: number;
  probability: number;
}

/**
 * Likelihood of an observation under each simulated relationship, by kernel
 * density estimation over the simulated pairs that share anything: a Gaussian
 * kernel on total cM and, when a segment count is given, a second Gaussian
 * kernel on the count, and when fully identical cM is known a third on that
 * (a product kernel). Each bandwidth follows Silverman's rule of thumb,
 * h = 1.06 sd n^(-1/5), floored at 5 cM (and for the total at 3% of the
 * observed value, the scale on which vendors' genetic maps disagree) and at
 * 0.5 segments. An observation of no sharing is scored by the fraction of
 * simulated pairs that share no detectable segment. Probabilities assume
 * every listed relationship is equally likely beforehand, so they say only
 * how the listed relationships compare with each other.
 */
export function relationshipPosteriors(dists: readonly RelationshipDistribution[], obs: ObservedSharing): RelationshipPosterior[] {
  const sdOf = (xs: number[]) => {
    const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
  };
  const gauss = (z: number, h: number) => Math.exp(-0.5 * z * z) / (h * Math.sqrt(2 * Math.PI));
  const rows = dists.map((dist) => {
    const pairs = dist.pairs;
    const n = pairs.length;
    let like = 0;
    if (obs.totalCm <= 0) {
      like = pairs.filter((p) => p.segments === 0).length / n;
    } else {
      const shared = pairs.filter((p) => p.segments > 0);
      if (shared.length > 1) {
        const rule = 1.06 * Math.pow(shared.length, -1 / 5);
        const hT = Math.max(rule * sdOf(shared.map((p) => p.totalCm)), 0.03 * obs.totalCm, 5);
        const hS = Math.max(rule * sdOf(shared.map((p) => p.segments)), 0.5);
        const hF = Math.max(rule * sdOf(shared.map((p) => p.fullCm)), 5);
        for (const p of shared) {
          let k = gauss((obs.totalCm - p.totalCm) / hT, hT);
          if (obs.segments !== undefined) k *= gauss((obs.segments - p.segments) / hS, hS);
          if (obs.fullCm !== undefined) k *= gauss((obs.fullCm - p.fullCm) / hF, hF);
          like += k;
        }
        like /= n;
      }
    }
    return { spec: dist.spec, likelihood: like };
  });
  const total = rows.reduce((a, r) => a + r.likelihood, 0);
  return rows
    .map((r) => ({ ...r, probability: total > 0 ? r.likelihood / total : 0 }))
    .sort((a, b) => b.probability - a.probability);
}
