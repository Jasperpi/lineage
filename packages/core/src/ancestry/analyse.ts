/**
 * Ancestry analyses against the bundled reference panel.
 *
 *  - populationSimilarity: for each reference population, the log-likelihood
 *    of the genotypes if both copies of the genome were drawn from that
 *    population's allele frequencies (Hardy-Weinberg, SNPs treated as
 *    independent on the LD-pruned core). This is ADMIXTURE's likelihood with
 *    the ancestry vector fixed to one population; it ranks populations and is
 *    not a probability.
 *  - componentAdmixture: the share of the genome best explained by each
 *    continental component, by EM with the component frequencies held fixed
 *    (ADMIXTURE's projection mode), with block-bootstrap intervals.
 *  - projectPca: least-squares projection onto the reference PCA (the same
 *    equations as smartpca's lsqproject, so SNPs missing from a chip simply
 *    drop out), scaled by the shrinkage factors measured on held-out
 *    reference genomes.
 *  - paintChromosomes: continental ancestry along each autosome from an
 *    HMM whose hidden state is the pair of components carried by the two
 *    copies, windows of SNPs as emissions, and ancestry switches whose rate
 *    grows with genetic distance.
 */
import type { GeneticMap } from "../compare/geneticmap.js";
import { mulberry32 } from "../util/random.js";
import type { PanelGenotypes, ReferencePanelData } from "./reference.js";

const clampF = (f: number, scale: number) => {
  const lo = 1 / (2 * scale);
  return f < lo ? lo : f > 1 - lo ? 1 - lo : f;
};

function genoLogLik(g: number, f: number): number {
  return g === 2 ? 2 * Math.log(f) : g === 1 ? Math.LN2 + Math.log(f) + Math.log(1 - f) : 2 * Math.log(1 - f);
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
}

export function populationSimilarity(panel: ReferencePanelData, g: PanelGenotypes): { snps: number; scores: PopulationScore[] } {
  const P = panel.header.populations.length, scale = panel.header.freqScale;
  const ll = new Float64Array(P);
  let snps = 0;
  for (let k = 0; k < panel.coreIndex.length; k++) {
    const d = g.dosage[panel.coreIndex[k]!]!;
    if (d < 0) continue;
    snps++;
    for (let p = 0; p < P; p++) ll[p]! += genoLogLik(d, clampF(panel.popFreq[k * P + p]! / scale, scale));
  }
  const best = Math.max(...ll);
  const scores = panel.header.populations.map((population, p) => ({
    population, logLik: ll[p]!, perSnp: snps ? ll[p]! / snps : NaN,
    gapPer1000: snps ? ((best - ll[p]!) / snps) * 1000 : NaN, rank: 0,
  }));
  [...scores].sort((a, b) => b.logLik - a.logLik).forEach((s, i) => { s.rank = i + 1; });
  return { snps, scores };
}

/* ------------------------------------------------------------------ */
/* Admixture against fixed component frequencies                       */
/* ------------------------------------------------------------------ */

export interface ComponentAdmixture {
  components: string[];
  proportions: number[];
  ci95: Array<[number, number]>;
  snpsUsed: number;
  iterations: number;
  logLik: number;
  replicates: number;
}

/**
 * Ancestry proportions with the component frequencies fixed (ADMIXTURE's projection), by EM
 * accelerated with SQUAREM (Varadhan & Roland 2008, scheme S3). Plain EM crawls towards
 * proportions of zero, which is where most components of most people belong; the extrapolation
 * gets there in tens of passes instead of thousands. Stops when no proportion moves by more than
 * `qTol` in a cycle or the log-likelihood gains less than `tol` of itself, or after `maxPasses`.
 */
function emFixedF(dos: Int8Array, F: Float64Array, K: number, idx: ArrayLike<number>, maxPasses: number, tol: number, qTol: number, start?: number[]): { q: number[]; ll: number; it: number } {
  const n = idx.length;
  const simplex = (v: number[]) => { const c = v.map((x) => Math.max(1e-12, x)); const sum = c.reduce((a, b) => a + b, 0); return c.map((x) => x / sum); };
  /** One EM update; returns the new proportions and (when asked) the log-likelihood at the input. */
  const step = (q: number[], withLl = true): { q: number[]; ll: number } => {
    const acc = new Float64Array(K);
    let ll = 0;
    for (let t = 0; t < n; t++) {
      const j = idx[t]!, gA = dos[j]!, gB = 2 - gA, base = j * K;
      let p = 0;
      for (let k = 0; k < K; k++) p += q[k]! * F[base + k]!;
      if (withLl) ll += gA * Math.log(p) + gB * Math.log(1 - p);
      const a = gA / p, b = gB / (1 - p);
      for (let k = 0; k < K; k++) { const f = F[base + k]!; acc[k]! += a * f + b * (1 - f); }
    }
    return { q: Array.from(acc, (x, k) => (q[k]! * x) / (2 * n)), ll };
  };
  let q = start ? simplex(start) : new Array<number>(K).fill(1 / K);
  let ll = -Infinity, prev = -Infinity, passes = 0;
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
  return { q, ll, it: passes };
}

export function componentAdmixture(panel: ReferencePanelData, g: PanelGenotypes, opts: { replicates?: number; block?: number; seed?: number } = {}): ComponentAdmixture {
  const K = panel.header.components.length, scale = panel.header.freqScale;
  // Work on the LD-pruned core, where the independence assumption is least wrong.
  const used: number[] = [];
  for (let k = 0; k < panel.coreIndex.length; k++) if (g.dosage[panel.coreIndex[k]!]! >= 0) used.push(k);
  const dos = new Int8Array(used.length);
  const F = new Float64Array(used.length * K);
  used.forEach((k, t) => {
    const i = panel.coreIndex[k]!;
    dos[t] = g.dosage[i]!;
    for (let c = 0; c < K; c++) F[t * K + c] = clampF(panel.compFreq[i * K + c]! / scale, scale);
  });
  const all = Array.from({ length: used.length }, (_, t) => t);
  const components = panel.header.components.map((c) => c.id);
  if (used.length === 0) return { components, proportions: new Array(K).fill(NaN), ci95: new Array(K).fill([NaN, NaN]), snpsUsed: 0, iterations: 0, logLik: NaN, replicates: 0 };
  const main = emFixedF(dos, F, K, all, 3000, 1e-12, 1e-7);
  const reps = opts.replicates ?? 60, block = opts.block ?? 50;
  const rng = mulberry32(opts.seed ?? 7);
  const nBlocks = Math.ceil(used.length / block);
  const samples: number[][] = [];
  for (let r = 0; r < reps; r++) {
    const idx: number[] = [];
    for (let b = 0; b < nBlocks; b++) {
      const start = Math.floor(rng() * nBlocks) * block;
      for (let t = start; t < Math.min(start + block, used.length); t++) idx.push(t);
    }
    // Start each replicate at the full-data estimate, with every component at least 0.001 so one
    // the resample supports can still grow; intervals are shown to 0.1%, so 1e-5 is converged.
    samples.push(emFixedF(dos, F, K, idx, 1500, 1e-11, 1e-4, main.q.map((x) => Math.max(x, 1e-3))).q);
  }
  const ci95 = components.map((_, k) => {
    const col = samples.map((s) => s[k]!).sort((a, b) => a - b);
    return [col[Math.floor(0.025 * (col.length - 1))]!, col[Math.ceil(0.975 * (col.length - 1))]!] as [number, number];
  });
  return { components, proportions: main.q, ci95, snpsUsed: used.length, iterations: main.it, logLik: main.ll, replicates: reps };
}

/* ------------------------------------------------------------------ */
/* PCA projection                                                      */
/* ------------------------------------------------------------------ */

export interface PcaProjection { pcs: number[]; snpsUsed: number }

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

export function projectPca(panel: ReferencePanelData, g: PanelGenotypes): PcaProjection {
  const nPc = panel.header.pca.nPc, scale = panel.header.pca.loadingScale;
  const A = Array.from({ length: nPc }, () => new Array<number>(nPc).fill(0));
  const b = new Array<number>(nPc).fill(0);
  let used = 0;
  const v = new Array<number>(nPc);
  for (let k = 0; k < panel.coreIndex.length; k++) {
    const d = g.dosage[panel.coreIndex[k]!]!;
    if (d < 0) continue;
    const p = panel.pooledFreq[k]! / 65535;
    const sd = Math.sqrt(2 * p * (1 - p));
    if (!(sd > 0)) continue;
    const x = (d - 2 * p) / sd;
    for (let c = 0; c < nPc; c++) v[c] = panel.loadings[k * nPc + c]! * scale[c]!;
    for (let r = 0; r < nPc; r++) {
      b[r]! += v[r]! * x;
      for (let c = 0; c < nPc; c++) A[r]![c]! += v[r]! * v[c]!;
    }
    used++;
  }
  const t = solve(A, b);
  return { pcs: t.map((x, c) => x / (panel.header.pca.shrinkage[c] ?? 1)), snpsUsed: used };
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
  /** Most probable unordered pair of components (indices), and its posterior probability. */
  pair: [number, number];
  posterior: number;
  /** Expected copies of each component in this window (0-2), averaged over the posterior. */
  copies: number[];
}

export interface Painting {
  components: string[];
  chromosomes: Array<{ chrom: string; windows: PaintedWindow[] }>;
  /** Share of the painted autosomes (by cM) assigned to each component. */
  totals: number[];
  settings: { windowSnps: number; generations: number; tempering: number };
}

export interface PaintOptions {
  /** Observed SNPs per window. Default 40. */
  windowSnps?: number;
  /** Generations since admixture, for the switch rate. Default 8. */
  generations?: number;
  /** Power applied to window likelihoods to discount LD between neighbouring SNPs. Default 0.5. */
  tempering?: number;
}

/**
 * Local ancestry along each autosome. The hidden state is an ordered pair of
 * components (one per chromosome copy); a window's emission is the product of
 * per-SNP genotype probabilities given the two components' frequencies,
 * raised to a tempering power because neighbouring SNPs are not independent;
 * between windows d cM apart each copy switches ancestry with probability
 * 1 - exp(-generations x d / 100), to a component drawn from the genome-wide
 * proportions `q`. Forward-backward gives posteriors; ordered states are
 * folded into unordered pairs because the file is unphased.
 */
export function paintChromosomes(panel: ReferencePanelData, g: PanelGenotypes, q: number[], map: GeneticMap, opts: PaintOptions = {}): Painting {
  const K = panel.header.components.length, scale = panel.header.freqScale;
  const W = opts.windowSnps ?? 40, T = opts.generations ?? 8, tau = opts.tempering ?? 0.5;
  const prior = q.map((x) => Math.max(1e-4, x));
  const ps = prior.reduce((a, b) => a + b, 0);
  for (let k = 0; k < K; k++) prior[k] = prior[k]! / ps;
  const S = K * K;
  const chromosomes: Painting["chromosomes"] = [];
  const cmTotals = new Array<number>(K).fill(0);
  let cmAll = 0;

  const chromNames = panel.header.chromosomes;
  let i = 0;
  for (let c = 0; c < chromNames.length; c++) {
    const chrom = chromNames[c]!;
    const begin = i;
    while (i < panel.header.nSnp && panel.chromIdx[i] === c) i++;
    // Build windows of W called SNPs.
    const wins: Array<{ idx: number[] }> = [];
    let cur: number[] = [];
    for (let j = begin; j < i; j++) {
      if (g.dosage[j]! < 0) continue;
      cur.push(j);
      if (cur.length === W) { wins.push({ idx: cur }); cur = []; }
    }
    if (cur.length >= W / 2 || (cur.length && wins.length === 0)) wins.push({ idx: cur });
    else if (cur.length && wins.length) wins[wins.length - 1]!.idx.push(...cur);
    if (!wins.length) continue;

    // Emissions (log), ordered states s = a*K + b.
    const logE = wins.map((w) => {
      const e = new Float64Array(S);
      for (const j of w.idx) {
        const d = g.dosage[j]!;
        for (let a = 0; a < K; a++) {
          const fa = clampF(panel.compFreq[j * K + a]! / scale, scale);
          for (let b = a; b < K; b++) {
            const fb = clampF(panel.compFreq[j * K + b]! / scale, scale);
            const p = d === 2 ? fa * fb : d === 1 ? fa * (1 - fb) + fb * (1 - fa) : (1 - fa) * (1 - fb);
            const l = Math.log(p);
            e[a * K + b]! += l;
            if (a !== b) e[b * K + a]! += l;
          }
        }
      }
      for (let s = 0; s < S; s++) e[s] = e[s]! * tau;
      return e;
    });
    const cmOf = (j: number) => map.cM(chrom, panel.pos[j]!) ?? 0;
    const mid = wins.map((w) => (cmOf(w.idx[0]!) + cmOf(w.idx[w.idx.length - 1]!)) / 2);

    // Forward-backward in scaled probability space.
    const n = wins.length;
    const fwd = Array.from({ length: n }, () => new Float64Array(S));
    const bwd = Array.from({ length: n }, () => new Float64Array(S));
    const emis = logE.map((e) => { const m = Math.max(...e); return Float64Array.from(e, (x) => Math.exp(x - m)); });
    const trans = (t: number) => {
      const d = Math.max(0, mid[t + 1]! - mid[t]!);
      const r = 1 - Math.exp((-T * d) / 100);
      // Per-copy transition: stay with prob (1-r), else redraw from prior.
      return (from: number, to: number) => ((from === to ? 1 - r : 0) + r * prior[to]!);
    };
    for (let s = 0; s < S; s++) fwd[0]![s] = prior[Math.floor(s / K)]! * prior[s % K]! * emis[0]![s]!;
    normalise(fwd[0]!);
    for (let t = 1; t < n; t++) {
      const tr = trans(t - 1);
      // Factorised transition: first move copy A, then copy B.
      const tmp = new Float64Array(S);
      for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
        let acc = 0;
        for (let a0 = 0; a0 < K; a0++) acc += fwd[t - 1]![a0 * K + b]! * tr(a0, a);
        tmp[a * K + b] = acc;
      }
      for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
        let acc = 0;
        for (let b0 = 0; b0 < K; b0++) acc += tmp[a * K + b0]! * tr(b0, b);
        fwd[t]![a * K + b] = acc * emis[t]![a * K + b]!;
      }
      normalise(fwd[t]!);
    }
    bwd[n - 1]!.fill(1);
    for (let t = n - 2; t >= 0; t--) {
      const tr = trans(t);
      const w = new Float64Array(S);
      for (let s = 0; s < S; s++) w[s] = bwd[t + 1]![s]! * emis[t + 1]![s]!;
      const tmp = new Float64Array(S);
      for (let a = 0; a < K; a++) for (let b0 = 0; b0 < K; b0++) {
        let acc = 0;
        for (let b = 0; b < K; b++) acc += tr(b0, b) * w[a * K + b]!;
        tmp[a * K + b0] = acc;
      }
      for (let a0 = 0; a0 < K; a0++) for (let b0 = 0; b0 < K; b0++) {
        let acc = 0;
        for (let a = 0; a < K; a++) acc += tr(a0, a) * tmp[a * K + b0]!;
        bwd[t]![a0 * K + b0] = acc;
      }
      normalise(bwd[t]!);
    }
    const windows: PaintedWindow[] = wins.map((w, t) => {
      const post = new Float64Array(S);
      for (let s = 0; s < S; s++) post[s] = fwd[t]![s]! * bwd[t]![s]!;
      normalise(post);
      let bestA = 0, bestB = 0, bestP = -1;
      const copies = new Array<number>(K).fill(0);
      for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
        const pr = a === b ? post[a * K + b]! : post[a * K + b]! + post[b * K + a]!;
        if (pr > bestP) { bestP = pr; bestA = a; bestB = b; }
        copies[a]! += pr; copies[b]! += pr;
      }
      const first = w.idx[0]!, last = w.idx[w.idx.length - 1]!;
      return {
        start: panel.pos[first]!, end: panel.pos[last]!, startCm: cmOf(first), endCm: cmOf(last),
        snps: w.idx.length, pair: [bestA, bestB], posterior: bestP, copies,
      };
    });
    for (const w of windows) {
      const len = Math.max(0, w.endCm - w.startCm);
      cmAll += 2 * len;
      w.copies.forEach((x, k) => { cmTotals[k]! += x * len; });
    }
    chromosomes.push({ chrom, windows });
  }
  return {
    components: panel.header.components.map((c) => c.id),
    chromosomes,
    totals: cmTotals.map((x) => (cmAll ? x / cmAll : 0)),
    settings: { windowSnps: W, generations: T, tempering: tau },
  };
}

function normalise(v: Float64Array): void {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]!;
  if (s > 0) for (let i = 0; i < v.length; i++) v[i] = v[i]! / s;
}

/** Positions of the panel's autosomal SNPs grouped by chromosome, for coverage plots. */
export function panelCoverage(panel: ReferencePanelData, g: PanelGenotypes): Array<{ chrom: string; total: number; called: number }> {
  const out = panel.header.chromosomes.map((chrom) => ({ chrom: chrom as string, total: 0, called: 0 }));
  for (let i = 0; i < panel.header.nSnp; i++) {
    const row = out[panel.chromIdx[i]!]!;
    row.total++;
    if (g.dosage[i]! >= 0) row.called++;
  }
  return out;
}

