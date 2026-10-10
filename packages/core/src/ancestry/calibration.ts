/**
 * Calibration: the numbers that turn the model's raw outputs into statements
 * that hold up on genomes it has not seen. Every value here is measured by
 * the validation harness (scripts/data/08-validate.mjs) on held-out and
 * simulated genomes and shipped as data/reference/calibration.json. Without
 * it the engine still runs, reports `calibrated: false`, and the page shows
 * only what needs no calibration.
 */

export interface Calibration {
  /** Harness version and date, shown on the Evidence page. */
  generated?: string;
  /** Per-allele error rate chosen by validation. */
  alleleError?: number;
  similarity?: {
    /** Divides population log-likelihoods before the softmax (LD and overdispersion). */
    temperature: number;
    /** Split-conformal threshold on 1 - probability(true population) for 95% sets. */
    conformalQ95: number;
    /** Measured coverage of those sets on held-out genomes. */
    coverage?: number;
    /** Fit z of the closest population below which no single population describes the genome (1% of held-out single-origin genomes). */
    fitZ01?: number;
  };
  components?: {
    /**
     * Inflation of the likelihood ratio for linkage between core SNPs and overdispersion,
     * fitted so that 95% profile intervals cover held-out truth 95% of the time.
     */
    phi: number;
    /** The same for the regional fit (more, closer components); defaults to `phi`. */
    phiRegion?: number;
    /** Measured coverage with that phi. */
    coverage?: number;
    /**
     * Presence thresholds by component id: the 99th percentile of the estimate in held-out
     * genomes that have none of that ancestry. A share at or below it is not called present.
     */
    presence: Record<string, number>;
    /** Held-out precision of each component or region, by share bin (bin upper edges in `bins`). */
    precision?: { bins: number[]; byId: Record<string, number[]> };
  };
  painting?: {
    /** Power on window likelihoods chosen by validation. */
    tempering?: number;
    /** Isotonic map from the painter's posterior to the measured probability of being right. */
    isotonic?: { x: number[]; y: number[] };
    /** Window fit z below which a window is flagged as not well described. */
    windowZ?: number;
  };
  fit?: {
    /** Genome-level fit z below which the page says the reference does not describe the genome (1% of held-out genomes). */
    z01: number;
  };
}

/** Linear interpolation through an isotonic (non-decreasing) step map; identity outside or when absent. */
export function applyIsotonic(p: number, iso?: { x: number[]; y: number[] }): number {
  if (!iso || iso.x.length === 0) return p;
  const { x, y } = iso;
  if (p <= x[0]!) return y[0]!;
  if (p >= x[x.length - 1]!) return y[y.length - 1]!;
  let lo = 0, hi = x.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (x[m]! <= p) lo = m; else hi = m; }
  const t = (p - x[lo]!) / (x[hi]! - x[lo]! || 1);
  return y[lo]! + t * (y[hi]! - y[lo]!);
}

/**
 * Pool-adjacent-violators: the non-decreasing fit of `y` on `x` (least squares).
 * Returns knots suitable for applyIsotonic. Used by the validation harness.
 */
export function fitIsotonic(xs: number[], ys: number[], weights?: number[]): { x: number[]; y: number[] } {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
  const blocks: Array<{ x0: number; x1: number; sum: number; w: number }> = [];
  for (const i of idx) {
    const w = weights?.[i] ?? 1;
    blocks.push({ x0: xs[i]!, x1: xs[i]!, sum: ys[i]! * w, w });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]!, a = blocks[blocks.length - 2]!;
      if (a.sum / a.w <= b.sum / b.w) break;
      blocks.splice(blocks.length - 2, 2, { x0: a.x0, x1: b.x1, sum: a.sum + b.sum, w: a.w + b.w });
    }
  }
  const x: number[] = [], y: number[] = [];
  for (const b of blocks) {
    const v = b.sum / b.w;
    x.push(b.x0); y.push(v);
    if (b.x1 !== b.x0) { x.push(b.x1); y.push(v); }
  }
  return { x, y };
}

/** Type-7 sample quantile of a sorted array. */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

/** The split-conformal threshold: the ceil((n+1)(1-alpha))-th smallest non-conformity score. */
export function conformalThreshold(scores: number[], alpha = 0.05): number {
  const s = [...scores].sort((a, b) => a - b);
  const k = Math.min(s.length, Math.ceil((s.length + 1) * (1 - alpha)));
  return s[k - 1] ?? 1;
}

/** Normal quantile (Acklam's rational approximation), for the few places a z is needed. */
export function normalQuantile(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}
