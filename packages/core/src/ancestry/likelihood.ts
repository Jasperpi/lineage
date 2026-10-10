/**
 * Genotype probabilities given a reference group's allele count, shared by
 * every ancestry analysis (similarity, components, painting, the fit check).
 *
 * A group's frequency at a SNP is an estimate: x copies of the ALT allele in
 * `alleles` sampled chromosomes. With a Beta(1/2, 1/2) prior (the 1/k prior
 * of Rannala & Mountain 1997 for two alleles) the frequency's posterior is
 * Beta(a, b), a = x + 1/2, b = alleles - x + 1/2, s = a + b, and a new member
 * of the group carries 2, 1 or 0 copies with probability
 *
 *   E[f^2]      = a(a+1) / (s(s+1))
 *   2E[f(1-f)]  = 2ab / (s(s+1))
 *   E[(1-f)^2]  = b(b+1) / (s(s+1))
 *
 * so a population of 61 genomes and one of 1,736 are no longer treated alike,
 * and a frequency of exactly 0 or 1 no longer needs a clamp.
 *
 * On top of that, each allele of the user's genotype is read wrongly with
 * probability `e` (a chip call against a sequenced reference), so a true
 * frequency f is observed as e + (1 - 2e) f. The model is linear in f, which
 * keeps the admixture EM in its usual form.
 *
 * Frequencies are stored in a byte (or two) per group as round(f x scale);
 * when scale equals the group's allele count the byte is the count itself.
 */

/** Chance that one allele of a consumer-chip call is misread (about 0.2% of genotypes). */
export const DEFAULT_ALLELE_ERROR = 0.001;

export interface GroupTable {
  /** Posterior-mean ALT frequency after the error model, by stored value. */
  mean: Float64Array;
  /** log P(genotype = 0, 1, 2 ALT copies) for one member of the group, by stored value (3 per value). */
  logP: Float64Array;
  /** Posterior standard deviation of the frequency itself (no error term), by stored value. */
  sd: Float64Array;
  /** Expected log-probability of a member's genotype, sum_g P log P, and its variance, by stored value. */
  expLog: Float64Array;
  varLog: Float64Array;
}

const cache = new Map<string, GroupTable>();

/**
 * Lookup table for a group whose frequencies are stored as integers 0..scale.
 * `alleles` = 0 or Infinity treats the stored frequency as exact.
 */
export function groupTable(scale: number, alleles: number, e = DEFAULT_ALLELE_ERROR): GroupTable {
  const key = `${scale}|${alleles}|${e}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = Math.round(scale) + 1;
  const mean = new Float64Array(n), sd = new Float64Array(n), logP = new Float64Array(n * 3), expLog = new Float64Array(n), varLog = new Float64Array(n);
  const q = 1 - 2 * e;
  const exact = !(alleles > 0) || !Number.isFinite(alleles);
  for (let v = 0; v < n; v++) {
    const f = v / scale;
    let mu: number, ef2: number, eg2: number, sdv: number;
    if (exact) {
      mu = f; ef2 = f * f; eg2 = (1 - f) * (1 - f); sdv = 0;
    } else {
      const a = f * alleles + 0.5, b = (1 - f) * alleles + 0.5, s = a + b;
      mu = a / s;
      ef2 = (a * (a + 1)) / (s * (s + 1));
      eg2 = (b * (b + 1)) / (s * (s + 1));
      sdv = Math.sqrt((a * b) / (s * s * (s + 1)));
    }
    const p2 = e * e + 2 * e * q * mu + q * q * ef2;
    const p0 = e * e + 2 * e * q * (1 - mu) + q * q * eg2;
    const p1 = Math.max(1e-300, 1 - p2 - p0);
    mean[v] = e + q * mu;
    sd[v] = sdv;
    logP[v * 3] = Math.log(Math.max(1e-300, p0));
    logP[v * 3 + 1] = Math.log(p1);
    logP[v * 3 + 2] = Math.log(Math.max(1e-300, p2));
    let E = 0, E2 = 0;
    for (let d = 0; d < 3; d++) { const l = logP[v * 3 + d]!, p = Math.exp(l); E += p * l; E2 += p * l * l; }
    expLog[v] = E;
    varLog[v] = Math.max(0, E2 - E * E);
  }
  const t = { mean, logP, sd, expLog, varLog };
  cache.set(key, t);
  return t;
}

/** Observed-allele frequency for a true frequency f under the error model. */
export const withError = (f: number, e: number) => e + (1 - 2 * e) * f;

/** Hardy-Weinberg probabilities of 0, 1, 2 ALT copies at frequency p. */
export function hwe(p: number): [number, number, number] {
  return [(1 - p) * (1 - p), 2 * p * (1 - p), p * p];
}

/** Probabilities of 0, 1, 2 ALT copies when the two copies come from groups with frequencies fa and fb. */
export function pairProbs(fa: number, fb: number): [number, number, number] {
  return [(1 - fa) * (1 - fb), fa * (1 - fb) + fb * (1 - fa), fa * fb];
}
