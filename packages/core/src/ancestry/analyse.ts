/**
 * Ancestry analyses against the bundled reference panel.
 *
 *  - populationSimilarity: for each reference population, the log-likelihood
 *    of the genotypes if both copies of the genome were drawn from that
 *    population, with its frequencies' sampling error and a genotype error
 *    term (likelihood.ts), on the LD-pruned core. Calibrated (calibration.ts),
 *    it becomes probabilities and a 95% conformal set of populations.
 *  - componentAdmixture: the share of the genome best explained by each
 *    component, by EM with the component frequencies held fixed (ADMIXTURE's
 *    projection mode), with intervals from a bootstrap over blocks of
 *    genetic map that also redraws the reference frequencies, and a presence
 *    test measured on genomes that lack each ancestry.
 *  - projectPca: least-squares projection onto the reference PCA (smartpca's
 *    lsqproject, so SNPs missing from a chip drop out), divided by the
 *    shrinkage of Lee, Zou & Wright (2010), with a bootstrap covariance.
 *  - paintChromosomes: continental ancestry along each autosome from an HMM
 *    whose hidden state is the pair of components carried by the two copies;
 *    the file is unphased and the model never phases it (phase-free local
 *    ancestry beats phase-based on realistically phased data: Avadhanam &
 *    Williams 2025). The number of generations since admixture is chosen per
 *    genome by likelihood; posteriors pass through the validated isotonic
 *    map; each window's fit to its painted pair is checked.
 */
import type { GeneticMap } from "../compare/geneticmap.js";
import { mulberry32 } from "../util/random.js";
import { type Calibration, applyIsotonic, quantileSorted } from "./calibration.js";
import { DEFAULT_ALLELE_ERROR, type GroupTable, groupTable, pairProbs } from "./likelihood.js";
import {
  type PanelComponent, type PanelGenotypes, type ReferencePanelData, compAlleles, compScale, popAlleles, popScale,
} from "./reference.js";

/* ------------------------------------------------------------------ */
/* Shared: blocks of genetic map                                        */
/* ------------------------------------------------------------------ */

/**
 * Split a list of dense SNP indices (in panel order) into contiguous blocks
 * of about `blockCm` of genetic map, never across chromosomes. Without a map,
 * blocks of `fallbackSnps` SNPs.
 */
export function mapBlocks(panel: ReferencePanelData, dense: ArrayLike<number>, map?: GeneticMap, blockCm = 5, fallbackSnps = 50): Int32Array {
  const out = new Int32Array(dense.length);
  let block = -1, startCm = 0, count = 0, chrom = -1;
  for (let t = 0; t < dense.length; t++) {
    const i = dense[t]!;
    const c = panel.chromIdx[i]!;
    const cm = map?.cM(panel.header.chromosomes[c]!, panel.pos[i]!);
    const newChrom = c !== chrom;
    const full = map && cm !== undefined ? cm - startCm >= blockCm : count >= fallbackSnps;
    if (newChrom || full || block < 0) { block++; startCm = cm ?? 0; count = 0; chrom = c; }
    out[t] = block;
    count++;
  }
  return out;
}

function blockRanges(blockOf: Int32Array): Array<[number, number]> {
  const r: Array<[number, number]> = [];
  for (let t = 0; t < blockOf.length; t++) {
    if (t === 0 || blockOf[t] !== blockOf[t - 1]) r.push([t, t + 1]); else r[r.length - 1]![1] = t + 1;
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Population similarity                                               */
/* ------------------------------------------------------------------ */

export interface PopulationScore {
  population: string;
  logLik: number;
  /** Log-likelihood per SNP. */
  perSnp: number;
  /** How much worse than the best population, in log-likelihood units per 1,000 SNPs (0 for the best). */
  gapPer1000: number;
  rank: number;
  /** Calibrated probability that this is the closest reference population (only with a calibration). */
  probability?: number;
  /** In the 95% conformal set. */
  inSet?: boolean;
}

export interface SimilarityResult {
  snps: number;
  scores: PopulationScore[];
  calibrated: boolean;
  /** Populations in the 95% conformal set, most probable first (only with a calibration). */
  set?: string[];
  /**
   * How well the closest population explains the genotypes compared with how well it explains
   * its own members: the observed log-likelihood against its expectation for a member, as a
   * z-score scaled for linkage between core SNPs. Strongly negative when no single reference
   * population fits (ancestry from several, or from one the panel lacks). `outside` needs a calibration.
   */
  fit: { population: string; z: number; inflation: number; gapPer1000: number; outside?: boolean };
}

interface PopSource { id: string; table: GroupTable; values: Uint8Array; stride: number; offset: number }

function popSources(panel: ReferencePanelData, e: number): PopSource[] {
  const P = panel.header.populations.length;
  const out: PopSource[] = panel.header.populations.map((id, p) => ({ id, table: groupTable(popScale(panel, p), popAlleles(panel, p), e), values: panel.popFreq, stride: P, offset: p }));
  for (const t of panel.tiers) {
    const Q = t.header.populations.length;
    t.header.populations.forEach((id, p) => out.push({ id, table: groupTable(t.header.popScale[p]!, t.header.popAlleles[p]!, e), values: t.popFreq, stride: Q, offset: p }));
  }
  return out;
}

export function populationSimilarity(panel: ReferencePanelData, g: PanelGenotypes, opts: { calibration?: Calibration; alleleError?: number } = {}): SimilarityResult {
  const e = opts.alleleError ?? opts.calibration?.alleleError ?? DEFAULT_ALLELE_ERROR;
  const src = popSources(panel, e);
  const ll = new Float64Array(src.length);
  const usedCore: number[] = [];
  for (let k = 0; k < panel.coreIndex.length; k++) {
    const d = g.dosage[panel.coreIndex[k]!]!;
    if (d < 0) continue;
    usedCore.push(k);
    for (let p = 0; p < src.length; p++) {
      const s = src[p]!;
      ll[p]! += s.table.logP[s.values[k * s.stride + s.offset]! * 3 + d]!;
    }
  }
  const snps = usedCore.length;
  const best = Math.max(...ll);
  const scores: PopulationScore[] = src.map((s, p) => ({
    population: s.id, logLik: ll[p]!, perSnp: snps ? ll[p]! / snps : NaN,
    gapPer1000: snps ? ((best - ll[p]!) / snps) * 1000 : NaN, rank: 0,
  }));
  [...scores].sort((a, b) => b.logLik - a.logLik).forEach((s, i) => { s.rank = i + 1; });
  // Fit of the closest population: residuals against a member's expectation, in blocks of 50 core
  // SNPs so linkage within a block is allowed for by the spread of the block z-scores.
  const bi = ll.indexOf(best);
  const bs = src[bi]!;
  let R = 0, V = 0, bR = 0, bV = 0, n = 0;
  const blockZ: number[] = [];
  for (const k of usedCore) {
    const v = bs.values[k * bs.stride + bs.offset]!, d = g.dosage[panel.coreIndex[k]!]!;
    const r = bs.table.logP[v * 3 + d]! - bs.table.expLog[v]!;
    R += r; V += bs.table.varLog[v]!; bR += r; bV += bs.table.varLog[v]!;
    if (++n % 50 === 0 && bV > 0) { blockZ.push(bR / Math.sqrt(bV)); bR = 0; bV = 0; }
  }
  const zm = blockZ.reduce((a, b) => a + b, 0) / Math.max(1, blockZ.length);
  const inflation = Math.max(1, blockZ.reduce((a, z) => a + (z - zm) ** 2, 0) / Math.max(1, blockZ.length - 1));
  const fitZ = V > 0 ? R / Math.sqrt(inflation * V) : 0;
  const cal = opts.calibration?.similarity;
  const fit = { population: bs.id, z: fitZ, inflation, gapPer1000: snps ? (-R / snps) * 1000 : NaN, outside: cal?.fitZ01 !== undefined ? fitZ < cal.fitZ01 : undefined };
  if (!cal || !snps) return { snps, scores, calibrated: false, fit };
  const probs = similarityProbabilities(scores.map((s) => s.logLik), cal.temperature);
  scores.forEach((s, p) => { s.probability = probs[p]!; s.inSet = 1 - probs[p]! <= cal.conformalQ95 || s.rank === 1; });
  const set = scores.filter((s) => s.inSet).sort((a, b) => b.probability! - a.probability!).map((s) => s.population);
  return { snps, scores, calibrated: true, set, fit };
}

/** Softmax of log-likelihoods divided by a temperature. */
export function similarityProbabilities(logLiks: number[], temperature: number): number[] {
  const x = logLiks.map((l) => l / temperature);
  const m = Math.max(...x);
  const w = x.map((v) => Math.exp(v - m));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / s);
}

/* ------------------------------------------------------------------ */
/* Admixture against fixed component frequencies                       */
/* ------------------------------------------------------------------ */

export interface AncestryGroup {
  /** A continent id, or `<continent>:broadly` for the regional shares of a continent not shown on their own. */
  id: string;
  members: number[];
  share: number;
  ci95: [number, number];
}

export interface ComponentAdmixture {
  components: string[];
  labels: string[];
  /** Continent of each component (itself for a continental component). */
  parents: string[];
  level: "continent" | "region";
  proportions: number[];
  /** 95% profile-likelihood intervals. */
  ci95: Array<[number, number]>;
  /**
   * Likelihood-ratio statistic for "none of this component" (scaled by phi); the
   * boundary test at 1% needs it above 5.41.
   */
  lrZero: number[];
  /** Share at or below which a component is not called present (the calibrated false-positive level). */
  presence: number[];
  present: boolean[];
  /** Regional components shown on their own (the rest are folded into "Broadly" their continent). */
  shown: boolean[];
  /** Continents (summed regions) and "Broadly" remainders, with their own profile intervals. */
  groups: AncestryGroup[];
  snpsUsed: number;
  iterations: number;
  logLik: number;
  /** Inflation of the likelihood ratio for linkage and overdispersion (1 when uncalibrated). */
  phi: number;
  calibrated: boolean;
  settings: { alleleError: number; referenceUncertainty: boolean };
  /** With `truth`: 2 x (log-likelihood at the estimate - profile log-likelihood at each true share). */
  lrTruth?: number[];
}

export interface ComponentAdmixtureOptions {
  calibration?: Calibration;
  /** "continent" (the core file's components) or "region" (the attached tiers' regions, plus continents with no tier). */
  level?: "continent" | "region";
  alleleError?: number;
  /** Integrate the reference frequencies' sampling error into the likelihood. Default true. */
  referenceUncertainty?: boolean;
  /** Skip the intervals (for quick fits inside other analyses). */
  intervals?: boolean;
  /** Minimum held-out precision for a region to be shown (default 0.9). */
  minPrecision?: number;
  /**
   * Known true shares, one per component (validation only): the result then carries the
   * likelihood ratio of each truth against the estimate, unscaled, in `lrTruth`.
   */
  truth?: number[];
}

/**
 * Ancestry proportions with the component frequencies fixed (ADMIXTURE's projection), by EM
 * accelerated with SQUAREM (Varadhan & Roland 2008, scheme S3). Plain EM crawls towards
 * proportions of zero, which is where most components of most people belong; the extrapolation
 * gets there in tens of passes instead of thousands. Stops when no proportion moves by more than
 * `qTol` in a cycle or the log-likelihood gains less than `tol` of itself, or after `maxPasses`.
 * `F` holds observed-allele frequencies (SNP-major, K per SNP), strictly inside (0, 1).
 *
 * With `D` (the same shape: (1 - 2e)^2 x the posterior variance of each component's
 * frequency), the likelihood integrates the reference frequencies' sampling error
 * instead of treating them as exact. Both alleles of a SNP that come from the same
 * component see the same unknown frequency, so
 *   P(g) = Binomial(g; 2, p) + c_g sum_k q_k^2 D_k,   c = (1, -2, 1) for g = (0, 1, 2),
 * and the EM stays O(K) per SNP: the expected number of the genotype's alleles from
 * component k is 2 q_k [B_k(g) + c_g q_k D_k] / P(g), with B_k(2) = F_k p,
 * B_k(0) = (1 - F_k)(1 - p), B_k(1) = F_k (1 - p) + (1 - F_k) p. With D = 0 this is
 * ADMIXTURE's update.
 *
 * With `fix`, the components in `fix.mask` are held to a total of `fix.total` (the rest to
 * 1 - total): each EM step is followed by rescaling within the two groups, which is exactly
 * the constrained M-step. That gives the profile likelihood of any sum of components.
 */
export function emFixedF(dos: Int8Array, F: Float64Array, K: number, idx: ArrayLike<number>, maxPasses: number, tol: number, qTol: number, start?: number[], D?: Float64Array, fix?: { mask: Uint8Array; total: number }): { q: number[]; ll: number; it: number } {
  const n = idx.length;
  const project = (v: number[]): number[] => {
    if (!fix) return v;
    let a = 0, b = 0;
    for (let k = 0; k < K; k++) if (fix.mask[k]) a += v[k]!; else b += v[k]!;
    return v.map((x, k) => (fix.mask[k] ? (a > 0 ? (x * fix.total) / a : 0) : b > 0 ? (x * (1 - fix.total)) / b : 0));
  };
  const simplex = (v: number[]) => { const c = v.map((x) => Math.max(1e-12, x)); const sum = c.reduce((a, b) => a + b, 0); return project(c.map((x) => x / sum)); };
  /** One EM update; returns the new proportions and (when asked) the log-likelihood at the input. */
  const step = (q: number[], withLl = true): { q: number[]; ll: number } => {
    const acc = new Float64Array(K);
    let ll = 0;
    if (!D) {
      for (let t = 0; t < n; t++) {
        const j = idx[t]!, gA = dos[j]!, gB = 2 - gA, base = j * K;
        let p = 0;
        for (let k = 0; k < K; k++) p += q[k]! * F[base + k]!;
        if (withLl) ll += gA * Math.log(p) + gB * Math.log(1 - p);
        const a = gA / p, b = gB / (1 - p);
        for (let k = 0; k < K; k++) { const f = F[base + k]!; acc[k]! += a * f + b * (1 - f); }
      }
      return { q: project(Array.from(acc, (x, k) => (q[k]! * x) / (2 * n))), ll };
    }
    for (let t = 0; t < n; t++) {
      const j = idx[t]!, g = dos[j]!, base = j * K;
      let p = 0, S = 0;
      for (let k = 0; k < K; k++) { p += q[k]! * F[base + k]!; S += q[k]! * q[k]! * D[base + k]!; }
      const c = g === 1 ? -2 : 1;
      const L = Math.max(1e-300, (g === 2 ? p * p : g === 0 ? (1 - p) * (1 - p) : 2 * p * (1 - p)) + c * S);
      if (withLl) ll += Math.log(L);
      for (let k = 0; k < K; k++) {
        const f = F[base + k]!;
        const B = g === 2 ? f * p : g === 0 ? (1 - f) * (1 - p) : f * (1 - p) + (1 - f) * p;
        acc[k]! += (B + c * q[k]! * D[base + k]!) / L;
      }
    }
    return { q: project(Array.from(acc, (x, k) => (q[k]! * x) / n)), ll };
  };
  let q = start ? simplex(start) : simplex(new Array<number>(K).fill(1 / K));
  let ll = -Infinity, prev = -Infinity, passes = 0;
  if (K === 1) return { q: [1], ll: step([1]).ll, it: 1 };
  while (passes < maxPasses) {
    const s1 = step(q, false), s2 = step(s1.q);
    passes += 2;
    const r = s1.q.map((x, k) => x - q[k]!), v = s2.q.map((x, k) => x - s1.q[k]! - r[k]!);
    const rn = Math.hypot(...r), vn = Math.hypot(...v);
    let next = s2.q;
    ll = s2.ll;
    // Shorten the step until no proportion shrinks more than tenfold: EM's updates are
    // multiplicative, so a component thrown to nearly zero could never climb back.
    let alpha = vn > 0 ? Math.min(-1, -rn / vn) : -1, qp: number[] | undefined;
    for (let tries = 0; tries < 10 && alpha < -1.01; tries++, alpha = (alpha - 1) / 2) {
      const cand = q.map((x, k) => x - 2 * alpha * r[k]! + alpha * alpha * v[k]!);
      if (cand.every((x, k) => x >= q[k]! / 10)) { qp = simplex(cand); break; }
    }
    if (qp) {
      const s3 = step(qp);
      passes++;
      // Keep the extrapolated point only if it is at least as likely as one plain step.
      if (s3.ll >= s2.ll) { next = s3.q; ll = s3.ll; }
    }
    const dq = Math.max(...next.map((x, k) => Math.abs(x - q[k]!)));
    q = next;
    if (dq < qTol || Math.abs(ll - prev) < tol * Math.max(1, Math.abs(ll))) break;
    prev = ll;
  }
  // The log-likelihood at the returned point.
  return { q, ll: step(q).ll, it: passes + 1 };
}

interface ComponentColumn { id: string; label: string; parent: string; table: GroupTable; values: Uint8Array; stride: number; offset: number; /** true: values are indexed by core SNP; false: by dense SNP. */ core: boolean; frequencyOnly: boolean }

/** The components an admixture fit uses at the chosen level. */
export function componentColumns(panel: ReferencePanelData, level: "continent" | "region", e: number): ComponentColumn[] {
  const K = panel.header.components.length;
  const out: ComponentColumn[] = [];
  panel.header.components.forEach((c, k) => {
    const tier = level === "region" ? panel.tiers.find((t) => t.header.continent === c.id) : undefined;
    // A continent with no tier loaded, or whose tier defines no regions, stays one component.
    if (!tier || tier.header.components.length === 0) {
      out.push({ id: c.id, label: c.label, parent: c.parent ?? c.id, table: groupTable(compScale(panel, k), compAlleles(panel, k), e), values: panel.compFreq, stride: K, offset: k, core: false, frequencyOnly: !!c.frequencyOnly });
      return;
    }
    const R = tier.header.components.length;
    tier.header.components.forEach((r: PanelComponent, j) => out.push({
      id: r.id, label: r.label, parent: c.id, table: groupTable(r.scale ?? panel.header.freqScale, r.alleles ?? 0, e),
      values: tier.compFreq, stride: R, offset: j, core: true, frequencyOnly: !!r.frequencyOnly,
    }));
  });
  return out;
}

/** Share below which an uncalibrated fit never calls a component present. */
const DEFAULT_PRESENCE = 0.01;
/** chi-square(1) 95% point: the profile interval is where the likelihood ratio stays below it. */
const CHI2_95 = 3.841459;
/** The 1% point of the boundary mixture 0.5 chi2(0) + 0.5 chi2(1) (Self & Liang 1987). */
const CHI2BAR_99 = 5.411894;

/** Held-out precision of a component at a share, from the calibration table. */
export function precisionAt(cal: Calibration | undefined, id: string, share: number): number | undefined {
  const p = cal?.components?.precision;
  const row = p?.byId[id];
  if (!p || !row) return undefined;
  let b = p.bins.findIndex((edge) => share <= edge);
  if (b < 0) b = p.bins.length - 1;
  return row[b];
}

/**
 * Observed information of the admixture likelihood at q, and from it the Wald standard error of
 * any sum of components (a contrast against the rest, on the simplex).
 */
function observedSe(dos: Int8Array, F: Float64Array, D: Float64Array | undefined, K: number, M: number, q: number[]): (mask: Uint8Array) => number {
  const H = new Float64Array(K * K);
  const gk = new Float64Array(K);
  for (let t = 0; t < M; t++) {
    const g = dos[t]!, base = t * K;
    let p = 0, S = 0;
    for (let k = 0; k < K; k++) { p += q[k]! * F[base + k]!; if (D) S += q[k]! * q[k]! * D[base + k]!; }
    const c = g === 1 ? -2 : 1;
    const L = Math.max(1e-300, (g === 2 ? p * p : g === 0 ? (1 - p) * (1 - p) : 2 * p * (1 - p)) + c * S);
    const d1 = g === 2 ? 2 * p : g === 0 ? -2 * (1 - p) : 2 - 4 * p;
    const d2 = g === 1 ? -4 : 2;
    for (let k = 0; k < K; k++) gk[k] = (d1 * F[base + k]! + (D ? 2 * c * q[k]! * D[base + k]! : 0)) / L;
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
      const second = (d2 * F[base + i]! * F[base + j]! + (D && i === j ? 2 * c * D[base + i]! : 0)) / L;
      H[i * K + j]! -= second - gk[i]! * gk[j]!;
    }
  }
  return (mask: Uint8Array) => {
    // Direction: raise the masked components in proportion to their shares, lower the rest likewise.
    const inA = q.reduce((a, x, k) => a + (mask[k] ? x : 0), 0), inB = 1 - inA;
    const d = q.map((x, k) => (mask[k] ? (inA > 1e-9 ? x / inA : 1 / Math.max(1, mask.reduce((a, m) => a + m, 0))) : inB > 1e-9 ? -x / inB : 0));
    let info = 0;
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) info += d[i]! * H[i * K + j]! * d[j]!;
    return info > 0 ? 1 / Math.sqrt(info) : NaN;
  };
}

export function componentAdmixture(panel: ReferencePanelData, g: PanelGenotypes, opts: ComponentAdmixtureOptions = {}): ComponentAdmixture {
  const cal = opts.calibration;
  const e = opts.alleleError ?? cal?.alleleError ?? DEFAULT_ALLELE_ERROR;
  const level = opts.level ?? "continent";
  const useD = opts.referenceUncertainty ?? true;
  const cols = componentColumns(panel, level, e);
  const K = cols.length;
  // Work on the LD-pruned core, where the independence assumption is least wrong.
  const used: number[] = [];
  for (let k = 0; k < panel.coreIndex.length; k++) if (g.dosage[panel.coreIndex[k]!]! >= 0) used.push(k);
  const M = used.length;
  const dos = new Int8Array(M);
  const F = new Float64Array(M * K);   // observed-allele frequency (posterior mean + error)
  const D = new Float64Array(M * K);   // (1 - 2e)^2 x posterior variance: the likelihood's frequency-error term
  const q1 = 1 - 2 * e;
  used.forEach((k, t) => {
    const i = panel.coreIndex[k]!;
    dos[t] = g.dosage[i]!;
    for (let c = 0; c < K; c++) {
      const col = cols[c]!;
      const v = col.values[(col.core ? k : i) * col.stride + col.offset]!;
      F[t * K + c] = Math.min(1 - 1e-9, Math.max(1e-9, col.table.mean[v]!));
      const sd = col.table.sd[v]!;
      D[t * K + c] = q1 * q1 * sd * sd;
    }
  });
  const components = cols.map((c) => c.id), parents = cols.map((c) => c.parent);
  const phi = (level === "region" ? cal?.components?.phiRegion : undefined) ?? cal?.components?.phi ?? 1;
  const base = { components, labels: cols.map((c) => c.label), parents, level, calibrated: !!cal?.components, phi, settings: { alleleError: e, referenceUncertainty: useD } };
  if (M === 0) {
    return { ...base, proportions: new Array(K).fill(NaN), ci95: new Array(K).fill([NaN, NaN]), lrZero: new Array(K).fill(NaN), presence: new Array(K).fill(NaN), present: new Array(K).fill(false), shown: new Array(K).fill(false), groups: [], snpsUsed: 0, iterations: 0, logLik: NaN };
  }
  const Dx = useD ? D : undefined;
  const all = Array.from({ length: M }, (_, t) => t);
  const main = emFixedF(dos, F, K, all, 3000, 1e-13, 1e-8, undefined, Dx);
  const qhat = main.q;

  /**
   * Profile log-likelihood of "the components in `mask` sum to v", warm-started. The interval ends
   * are needed to about 0.05 of a percentage point, so the inner fits stop at a log-likelihood
   * change of 1e-4 (the likelihood ratio is compared with 3.84 phi).
   */
  const profile = (mask: Uint8Array, v: number, start: number[], maxPasses = 400) =>
    emFixedF(dos, F, K, all, maxPasses, 1e-4 / Math.max(1, Math.abs(main.ll)), 1e-6, start.map((x, k) => (mask[k] ? Math.max(x, 1e-6) : Math.max(x, 1e-9))), Dx, { mask, total: v });
  const drop = (CHI2_95 / 2) * phi;
  const target = main.ll - drop;
  // Wald standard errors from the observed information at the estimate: only a first guess for
  // where each profile interval ends (the profile itself decides).
  const waldSe = observedSe(dos, F, Dx, K, M, qhat);
  /** Profile interval and the likelihood ratio at zero for a set of components. */
  const interval = (members: number[]): { ci: [number, number]; lr0: number } => {
    const mask = new Uint8Array(K);
    for (const k of members) mask[k] = 1;
    const est = members.reduce((a, k) => a + qhat[k]!, 0);
    const se = waldSe(mask) * Math.sqrt(phi);
    /**
     * Where the profile falls `drop` below its maximum, between the estimate and `to` (0 or 1).
     * Starts from the Wald guess, brackets by stepping out, then Illinois regula falsi.
     */
    const bound = (to: number): number => {
      const dir = Math.sign(to - est);
      let a = est, fa = drop, warm = qhat;
      let x = est + dir * 1.96 * (Number.isFinite(se) && se > 0 ? se : 0.01);
      let b = NaN, fb = NaN, side = 0;
      for (let it = 0; it < 40; it++) {
        if (dir > 0 ? x >= to : x <= to) x = to;
        const r = profile(mask, x, warm);
        warm = r.q;
        const fx = r.ll - target;
        if (Number.isNaN(b)) {
          if (fx >= 0) {
            if (x === to) return to;
            a = x; fa = fx;
            x = est + (x - est) * 2; // not far enough yet: step out
            continue;
          }
          b = x; fb = fx;
        } else {
          if (Math.abs(fx) < 0.05 * phi || Math.abs(b - a) < 1e-3) return x;
          if (fx > 0) { a = x; fa = fx; if (side === 1) fb /= 2; side = 1; }
          else { b = x; fb = fx; if (side === -1) fa /= 2; side = -1; }
        }
        if (Math.abs(b - a) < 1e-3) return (a + b) / 2;
        x = (a * fb - b * fa) / (fb - fa);
        if (!(x > Math.min(a, b) && x < Math.max(a, b))) x = (a + b) / 2;
      }
      return Number.isNaN(b) ? to : (a + b) / 2;
    };
    // Well inside (0, 1) the log-likelihood is close to quadratic and the profile interval is the
    // Wald interval; profile only where a boundary is near, which is where the two differ.
    const w = 1.96 * se;
    if (Number.isFinite(se) && est - 6 * se > 0 && est + 6 * se < 1) return { ci: [est - w, est + w], lr0: Infinity };
    // A share of essentially nothing: no test to run, and the upper end is the Wald one.
    if (est < 1e-3 && Number.isFinite(se)) {
      const zero = profile(mask, 0, qhat);
      return { ci: [0, Math.min(1, est + w)], lr0: Math.max(0, (2 * (main.ll - zero.ll)) / phi) };
    }
    // The likelihood ratio at zero is the presence test; for a share that is plainly present it is
    // not worth a fit (and the lower end is found from the estimate's side).
    let lr0 = Infinity, lo: number;
    if (est <= 1e-6) { lr0 = 0; lo = 0; }
    else if (est < 0.2) {
      const zero = profile(mask, 0, qhat);
      lr0 = Math.max(0, (2 * (main.ll - zero.ll)) / phi);
      lo = zero.ll >= target ? 0 : bound(0);
    } else {
      lo = bound(0);
      // With little data even a large share may not exclude zero: then it needs the test after all.
      if (lo <= 0) lr0 = Math.max(0, (2 * (main.ll - profile(mask, 0, qhat).ll)) / phi);
    }
    const hi = est >= 1 - 1e-6 ? 1 : bound(1);
    return { ci: [Math.max(0, Math.min(lo, est)), Math.min(1, Math.max(hi, est))], lr0 };
  };
  const wantIntervals = opts.intervals ?? true;
  const ci95: Array<[number, number]> = [], lrZero: number[] = [];
  for (let k = 0; k < K; k++) {
    // A component with no support at all: interval from zero, no test needed beyond its upper end.
    if (!wantIntervals) { ci95.push([qhat[k]!, qhat[k]!]); lrZero.push(NaN); continue; }
    const r = interval([k]);
    ci95.push(r.ci); lrZero.push(r.lr0);
  }
  const presence = components.map((id) => cal?.components?.presence[id] ?? DEFAULT_PRESENCE);
  const present = qhat.map((q, k) => q > presence[k]! && (!wantIntervals || lrZero[k]! > CHI2BAR_99));
  // Regions earn a line of their own; the rest of each continent is "Broadly" it.
  const minPrecision = opts.minPrecision ?? 0.9;
  const shown = qhat.map((q, k) => {
    if (cols[k]!.parent === components[k]) return present[k]!;
    const prec = precisionAt(cal, components[k]!, q);
    return present[k]! && (prec === undefined ? !cal?.components?.precision : prec >= minPrecision);
  });
  const groups: AncestryGroup[] = [];
  if (level === "region") {
    const conts = [...new Set(parents)];
    for (const c of conts) {
      const members = parents.map((p, k) => (p === c ? k : -1)).filter((k) => k >= 0);
      if (members.length === 1 && components[members[0]!] === c) continue;
      const share = members.reduce((a, k) => a + qhat[k]!, 0);
      groups.push({ id: c, members, share, ci95: wantIntervals ? interval(members).ci : [share, share] });
      const rest = members.filter((k) => !shown[k]);
      const restShare = rest.reduce((a, k) => a + qhat[k]!, 0);
      if (rest.length && rest.length < members.length) groups.push({ id: `${c}:broadly`, members: rest, share: restShare, ci95: wantIntervals ? interval(rest).ci : [restShare, restShare] });
      else if (rest.length) groups.push({ id: `${c}:broadly`, members: rest, share: restShare, ci95: groups[groups.length - 1]!.ci95 });
    }
  }
  const lrTruth = opts.truth?.map((t, k) => {
    const mask = new Uint8Array(K);
    mask[k] = 1;
    return Math.max(0, 2 * (main.ll - profile(mask, Math.min(1, Math.max(0, t)), qhat).ll));
  });
  return { ...base, proportions: qhat, ci95, lrZero, presence, present, shown, groups, snpsUsed: M, iterations: main.it, logLik: main.ll, lrTruth };
}

/* ------------------------------------------------------------------ */
/* PCA projection                                                      */
/* ------------------------------------------------------------------ */

export interface PcaProjection {
  pcs: number[];
  snpsUsed: number;
  /** Shrinkage each raw score was divided by. */
  shrinkage: number[];
  /** Bootstrap covariance of the scores (nPc x nPc), when a replicate count was given. */
  cov?: number[][];
}

/**
 * The factor by which a new genome's projection falls short of the in-sample scores
 * (Lee, Zou & Wright 2010): with gamma = SNPs / genomes and the sample eigenvalue `spike`
 * in units of the mean per-SNP variance, solve spike = l + gamma l / (l - 1) for the
 * population eigenvalue l; the shrinkage is (l - 1) / (l + gamma - 1). NaN below the
 * detection edge, where the PC carries no signal a projection can recover.
 */
export function lzwShrinkage(spike: number, gamma: number): number {
  const B = spike + 1 - gamma, disc = B * B - 4 * spike;
  if (B <= 0 || disc <= 0) return NaN;
  const l = (B + Math.sqrt(disc)) / 2;
  return (l - 1) / (l + gamma - 1);
}

export function pcaShrinkage(panel: ReferencePanelData): number[] {
  const p = panel.header.pca;
  if (p.spikes && p.gamma) return p.spikes.map((s, c) => { const d = lzwShrinkage(s, p.gamma!); return Number.isFinite(d) ? d : p.shrinkage[c] ?? 1; });
  return p.shrinkage;
}

/** Solve A x = b for a small symmetric positive-definite A by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) return new Array(n).fill(NaN);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

export function projectPca(panel: ReferencePanelData, g: PanelGenotypes, opts: { map?: GeneticMap; replicates?: number; blockCm?: number; seed?: number } = {}): PcaProjection {
  const nPc = panel.header.pca.nPc, scale = panel.header.pca.loadingScale;
  const shrinkage = pcaShrinkage(panel);
  const usedCore: number[] = [], xs: number[] = [];
  for (let k = 0; k < panel.coreIndex.length; k++) {
    const d = g.dosage[panel.coreIndex[k]!]!;
    if (d < 0) continue;
    const p = panel.pooledFreq[k]! / 65535;
    const sd = Math.sqrt(2 * p * (1 - p));
    if (!(sd > 0)) continue;
    usedCore.push(k); xs.push((d - 2 * p) / sd);
  }
  // Sufficient statistics per block, so a bootstrap replicate is a sum and a 6x6 solve.
  const blockOf = mapBlocks(panel, usedCore.map((k) => panel.coreIndex[k]!), opts.map, opts.blockCm ?? 5);
  const ranges = blockRanges(blockOf);
  const bA = ranges.map(() => new Float64Array(nPc * nPc)), bb = ranges.map(() => new Float64Array(nPc));
  const v = new Array<number>(nPc);
  ranges.forEach(([s, t], r) => {
    const A = bA[r]!, b = bb[r]!;
    for (let u = s; u < t; u++) {
      const k = usedCore[u]!, x = xs[u]!;
      for (let c = 0; c < nPc; c++) v[c] = panel.loadings[k * nPc + c]! * scale[c]!;
      for (let i = 0; i < nPc; i++) { b[i]! += v[i]! * x; for (let j = 0; j < nPc; j++) A[i * nPc + j]! += v[i]! * v[j]!; }
    }
  });
  const project = (pick: (r: number) => number, n: number): number[] => {
    const A = Array.from({ length: nPc }, () => new Array<number>(nPc).fill(0)), b = new Array<number>(nPc).fill(0);
    for (let s = 0; s < n; s++) {
      const r = pick(s), Ab = bA[r]!, bv = bb[r]!;
      for (let i = 0; i < nPc; i++) { b[i]! += bv[i]!; for (let j = 0; j < nPc; j++) A[i]![j]! += Ab[i * nPc + j]!; }
    }
    return solve(A, b).map((x, c) => x / (shrinkage[c] ?? 1));
  };
  const pcs = project((s) => s, ranges.length);
  const out: PcaProjection = { pcs, snpsUsed: usedCore.length, shrinkage };
  const reps = opts.replicates ?? 0;
  if (reps > 1 && ranges.length > 1) {
    const rng = mulberry32(opts.seed ?? 11);
    const draws = Array.from({ length: reps }, () => project(() => Math.floor(rng() * ranges.length), ranges.length));
    const mean = pcs.map((_, c) => draws.reduce((a, d) => a + d[c]!, 0) / reps);
    out.cov = pcs.map((_, i) => pcs.map((_, j) => draws.reduce((a, d) => a + (d[i]! - mean[i]!) * (d[j]! - mean[j]!), 0) / (reps - 1)));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Chromosome painting                                                 */
/* ------------------------------------------------------------------ */

export interface PaintedWindow {
  start: number;
  end: number;
  startCm: number;
  endCm: number;
  snps: number;
  /** Most probable unordered pair of components (indices), and its calibrated posterior probability. */
  pair: [number, number];
  posterior: number;
  /** The HMM's own posterior for that pair, before calibration. */
  rawPosterior: number;
  /** Expected copies of each component in this window (0-2), averaged over the posterior. */
  copies: number[];
  /** How well the painted pair explains the window's genotypes, as a z-score (LD-scaled); very negative = poorly. */
  fitZ: number;
}

export interface Painting {
  components: string[];
  chromosomes: Array<{ chrom: string; windows: PaintedWindow[] }>;
  /** Share of the painted autosomes (by cM) assigned to each component. */
  totals: number[];
  settings: { windowSnps: number; generations: number; tempering: number; alleleError: number; calibrated: boolean };
  /** Log-likelihood of the genome under each number of generations tried. */
  generationsTried: Array<{ generations: number; logLik: number }>;
  /**
   * Whole-genome fit: the windows' fit residuals summed and scaled by the LD inflation
   * measured across windows. `outside` is set only with a calibration.
   */
  fit: { z: number; inflation: number; windows: number; flagged: number; outside?: boolean };
}

export interface PaintOptions {
  /** Observed SNPs per window. Default 40. */
  windowSnps?: number;
  /** Generations since admixture; default: chosen per genome from `generationGrid` by likelihood. */
  generations?: number;
  generationGrid?: number[];
  /** Power applied to window likelihoods to discount LD between neighbouring SNPs. Default 0.5 or the calibrated value. */
  tempering?: number;
  alleleError?: number;
  calibration?: Calibration;
}

interface ChromWindows { chrom: string; wins: number[][]; logE: Float64Array[]; mid: number[]; cm: (j: number) => number }

/**
 * Local ancestry along each autosome. The hidden state is an ordered pair of
 * components (one per chromosome copy); a window's emission is the product of
 * per-SNP genotype probabilities given the two components' frequencies (with
 * the frequencies' sampling error when both copies share a component, and the
 * genotype error term), raised to a tempering power because neighbouring SNPs
 * are not independent; between windows d cM apart each copy switches ancestry
 * with probability 1 - exp(-generations x d / 100), to a component drawn from
 * the genome-wide proportions `q`. Forward-backward gives posteriors; ordered
 * states are folded into unordered pairs because the file is unphased.
 */
export function paintChromosomes(panel: ReferencePanelData, g: PanelGenotypes, q: number[], map: GeneticMap, opts: PaintOptions = {}): Painting {
  const K = panel.header.components.length;
  const cal = opts.calibration;
  const e = opts.alleleError ?? cal?.alleleError ?? DEFAULT_ALLELE_ERROR;
  const W = opts.windowSnps ?? 40, tau = opts.tempering ?? cal?.painting?.tempering ?? 0.5;
  const tables = panel.header.components.map((_, k) => groupTable(compScale(panel, k), compAlleles(panel, k), e));
  const prior = q.map((x) => Math.max(1e-4, Number.isFinite(x) ? x : 1 / K));
  const ps = prior.reduce((a, b) => a + b, 0);
  for (let k = 0; k < K; k++) prior[k] = prior[k]! / ps;
  const S = K * K;

  /** log P(genotype d | the two copies' components a, b) at dense SNP j. */
  const logPair = (j: number, d: number, a: number, b: number): number => {
    const va = panel.compFreq[j * K + a]!;
    if (a === b) return tables[a]!.logP[va * 3 + d]!;
    const vb = panel.compFreq[j * K + b]!;
    return Math.log(Math.max(1e-300, pairProbs(tables[a]!.mean[va]!, tables[b]!.mean[vb]!)[d]!));
  };

  // Windows and emissions per chromosome (shared by every value of T tried).
  const chroms: ChromWindows[] = [];
  const chromNames = panel.header.chromosomes;
  let i = 0;
  for (let c = 0; c < chromNames.length; c++) {
    const chrom = chromNames[c]!;
    const begin = i;
    while (i < panel.header.nSnp && panel.chromIdx[i] === c) i++;
    const wins: number[][] = [];
    let cur: number[] = [];
    for (let j = begin; j < i; j++) {
      if (g.dosage[j]! < 0) continue;
      cur.push(j);
      if (cur.length === W) { wins.push(cur); cur = []; }
    }
    if (cur.length >= W / 2 || (cur.length && wins.length === 0)) wins.push(cur);
    else if (cur.length && wins.length) wins[wins.length - 1]!.push(...cur);
    if (!wins.length) continue;
    const logE = wins.map((w) => {
      const em = new Float64Array(S);
      for (const j of w) {
        const d = g.dosage[j]!;
        for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
          const l = logPair(j, d, a, b);
          em[a * K + b]! += l;
          if (a !== b) em[b * K + a]! += l;
        }
      }
      for (let s = 0; s < S; s++) em[s] = em[s]! * tau;
      return em;
    });
    const cm = (j: number) => map.cM(chrom, panel.pos[j]!) ?? 0;
    const mid = wins.map((w) => (cm(w[0]!) + cm(w[w.length - 1]!)) / 2);
    chroms.push({ chrom, wins, logE, mid, cm });
  }

  const forward = (ch: ChromWindows, T: number, keep: boolean): { ll: number; fwd?: Float64Array[]; emis: Float64Array[] } => {
    const n = ch.wins.length;
    const emisMax = ch.logE.map((le) => Math.max(...le));
    const emis = ch.logE.map((le, t) => Float64Array.from(le, (x) => Math.exp(x - emisMax[t]!)));
    const fwd = keep ? Array.from({ length: n }, () => new Float64Array(S)) : undefined;
    let prev = new Float64Array(S), ll = 0;
    for (let s = 0; s < S; s++) prev[s] = prior[Math.floor(s / K)]! * prior[s % K]! * emis[0]![s]!;
    ll += Math.log(normalise(prev)) + emisMax[0]!;
    if (fwd) fwd[0]!.set(prev);
    for (let t = 1; t < n; t++) {
      const r = 1 - Math.exp((-T * Math.max(0, ch.mid[t]! - ch.mid[t - 1]!)) / 100);
      const cur = new Float64Array(S);
      // Factorised transition: first move copy A, then copy B. Each copy stays with
      // probability 1 - r, else redraws from the prior.
      const tmp = new Float64Array(S);
      for (let b = 0; b < K; b++) {
        let colSum = 0;
        for (let a0 = 0; a0 < K; a0++) colSum += prev[a0 * K + b]!;
        for (let a = 0; a < K; a++) tmp[a * K + b] = (1 - r) * prev[a * K + b]! + r * prior[a]! * colSum;
      }
      for (let a = 0; a < K; a++) {
        let rowSum = 0;
        for (let b0 = 0; b0 < K; b0++) rowSum += tmp[a * K + b0]!;
        for (let b = 0; b < K; b++) cur[a * K + b] = ((1 - r) * tmp[a * K + b]! + r * prior[b]! * rowSum) * emis[t]![a * K + b]!;
      }
      ll += Math.log(normalise(cur)) + emisMax[t]!;
      if (fwd) fwd[t]!.set(cur);
      prev = cur;
    }
    return { ll, fwd, emis };
  };

  // Choose the number of generations by likelihood unless it is given.
  const grid = opts.generations !== undefined ? [opts.generations] : opts.generationGrid ?? [1, 2, 4, 8, 16, 32];
  const generationsTried = grid.map((T) => ({ generations: T, logLik: chroms.reduce((a, ch) => a + forward(ch, T, false).ll, 0) }));
  const T = generationsTried.reduce((b, x) => (x.logLik > b.logLik ? x : b)).generations;

  const chromosomes: Painting["chromosomes"] = [];
  const cmTotals = new Array<number>(K).fill(0);
  let cmAll = 0;
  const resid: number[] = [], vars: number[] = [];
  for (const ch of chroms) {
    const n = ch.wins.length;
    const { fwd, emis } = forward(ch, T, true);
    const bwd = Array.from({ length: n }, () => new Float64Array(S));
    bwd[n - 1]!.fill(1);
    for (let t = n - 2; t >= 0; t--) {
      const r = 1 - Math.exp((-T * Math.max(0, ch.mid[t + 1]! - ch.mid[t]!)) / 100);
      const w = new Float64Array(S);
      for (let s = 0; s < S; s++) w[s] = bwd[t + 1]![s]! * emis[t + 1]![s]!;
      const tmp = new Float64Array(S);
      for (let a = 0; a < K; a++) {
        let dot = 0;
        for (let b = 0; b < K; b++) dot += prior[b]! * w[a * K + b]!;
        for (let b0 = 0; b0 < K; b0++) tmp[a * K + b0] = (1 - r) * w[a * K + b0]! + r * dot;
      }
      for (let b0 = 0; b0 < K; b0++) {
        let dot = 0;
        for (let a = 0; a < K; a++) dot += prior[a]! * tmp[a * K + b0]!;
        for (let a0 = 0; a0 < K; a0++) bwd[t]![a0 * K + b0] = (1 - r) * tmp[a0 * K + b0]! + r * dot;
      }
      normalise(bwd[t]!);
    }
    const windows: PaintedWindow[] = ch.wins.map((w, t) => {
      const post = new Float64Array(S);
      for (let s = 0; s < S; s++) post[s] = fwd![t]![s]! * bwd[t]![s]!;
      normalise(post);
      let bestA = 0, bestB = 0, bestP = -1;
      const copies = new Array<number>(K).fill(0);
      for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
        const pr = a === b ? post[a * K + b]! : post[a * K + b]! + post[b * K + a]!;
        if (pr > bestP) { bestP = pr; bestA = a; bestB = b; }
        copies[a]! += pr; copies[b]! += pr;
      }
      // Fit of the painted pair: observed minus expected log-likelihood over the window.
      let rsum = 0, vsum = 0;
      for (const j of w) {
        const lp = [0, 1, 2].map((d) => logPair(j, d, bestA, bestB));
        let E = 0, E2 = 0;
        for (let d = 0; d < 3; d++) { const p = Math.exp(lp[d]!); E += p * lp[d]!; E2 += p * lp[d]! * lp[d]!; }
        rsum += lp[g.dosage[j]!]! - E; vsum += Math.max(0, E2 - E * E);
      }
      resid.push(rsum); vars.push(vsum);
      const first = w[0]!, last = w[w.length - 1]!;
      return {
        start: panel.pos[first]!, end: panel.pos[last]!, startCm: ch.cm(first), endCm: ch.cm(last),
        snps: w.length, pair: [bestA, bestB], posterior: applyIsotonic(bestP, cal?.painting?.isotonic), rawPosterior: bestP, copies,
        fitZ: vsum > 0 ? rsum / Math.sqrt(vsum) : 0,
      };
    });
    for (const w of windows) {
      const len = Math.max(0, w.endCm - w.startCm);
      cmAll += 2 * len;
      w.copies.forEach((x, k) => { cmTotals[k]! += x * len; });
    }
    chromosomes.push({ chrom: ch.chrom, windows });
  }

  // LD inflation: the spread of the windows' z-scores around their mean (1 if SNPs were independent).
  const zs = resid.map((r, t) => (vars[t]! > 0 ? r / Math.sqrt(vars[t]!) : 0));
  const zMean = zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length);
  const inflation = Math.max(1, zs.reduce((a, z) => a + (z - zMean) ** 2, 0) / Math.max(1, zs.length - 1));
  const R = resid.reduce((a, b) => a + b, 0), V = vars.reduce((a, b) => a + b, 0);
  const z = V > 0 ? R / Math.sqrt(inflation * V) : 0;
  const sq = Math.sqrt(inflation);
  let flagged = 0;
  for (const c of chromosomes) for (const w of c.windows) {
    w.fitZ /= sq;
    if (cal?.painting?.windowZ !== undefined && w.fitZ < cal.painting.windowZ) flagged++;
  }
  return {
    components: panel.header.components.map((c) => c.id),
    chromosomes,
    totals: cmTotals.map((x) => (cmAll ? x / cmAll : 0)),
    settings: { windowSnps: W, generations: T, tempering: tau, alleleError: e, calibrated: !!cal?.painting?.isotonic },
    generationsTried,
    fit: { z, inflation, windows: zs.length, flagged, outside: cal?.fit ? z < cal.fit.z01 : undefined },
  };
}

function normalise(v: Float64Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]!;
  if (s > 0) for (let i = 0; i < v.length; i++) v[i] = v[i]! / s;
  return s;
}

/** Called panel SNPs by autosome, for coverage plots. */
export function panelCoverage(panel: ReferencePanelData, g: PanelGenotypes): Array<{ chrom: string; total: number; called: number }> {
  const out = panel.header.chromosomes.map((chrom) => ({ chrom: chrom as string, total: 0, called: 0 }));
  for (let i = 0; i < panel.header.nSnp; i++) {
    const row = out[panel.chromIdx[i]!]!;
    row.total++;
    if (g.dosage[i]! >= 0) row.called++;
  }
  return out;
}
