/**
 * Supervised admixture estimation.
 *
 * Given reference allele frequencies F[k][l] for K populations at L unlinked
 * SNPs and an individual's genotype g[l] in {0,1,2} copies of the counted
 * allele, find the mixing proportions q (sum to 1) that maximise
 *
 *   log L(q) = sum_l [ g_l log(p_l) + (2 - g_l) log(1 - p_l) ],  p_l = sum_k q_k F[k][l]
 *
 * This is the "supervised" mode of ADMIXTURE / frappe with the reference
 * frequencies held fixed, solved here by the standard EM update
 *
 *   q_k <- (1 / 2L) * sum_l [ g_l * q_k F_kl / p_l  +  (2 - g_l) * q_k (1 - F_kl) / (1 - p_l) ]
 *
 * which is monotone in the likelihood and converges to the MLE on the simplex.
 *
 * Honest limitations, surfaced in the result:
 *  - the answer is only as good as the reference panel: a person from a
 *    population that is not in the panel is forced onto the nearest ones;
 *  - SNPs are assumed unlinked; thin the panel (>= 100 kb spacing) before use;
 *  - the confidence intervals are block-bootstrap intervals over SNPs and
 *    reflect sampling noise only, not panel misspecification.
 */
import type { Chrom } from "../genome.js";
import type { Kit } from "../kit/kit.js";
import { complement } from "../util/alleles.js";
import { mulberry32 } from "../util/random.js";

export interface PanelSnp {
  rsid: string;
  chrom: Chrom;
  /** Position on the panel's build. */
  pos: number;
  /** The counted allele (forward strand). */
  allele: string;
  /** The other allele, used for strand checks. */
  other: string;
  /** Frequency of `allele` in each panel population, aligned with ReferencePanel.populations. */
  freq: number[];
}

export interface ReferencePanel {
  name: string;
  build: 37 | 38;
  populations: string[];
  snps: PanelSnp[];
  source: { name: string; url: string; retrieved: string };
}

export interface AdmixtureResult {
  populations: string[];
  proportions: number[];
  /** 95% block-bootstrap interval per population. */
  ci95: Array<[number, number]>;
  logLikelihood: number;
  snpsUsed: number;
  snpsSkipped: { missing: number; noCall: number; alleleMismatch: number; strandFlipped: number };
  iterations: number;
  caveats: string[];
}

interface Obs { g: number; f: number[] }

function extract(kit: Kit, panel: ReferencePanel): { obs: Obs[]; skipped: AdmixtureResult["snpsSkipped"] } {
  const obs: Obs[] = [];
  const skipped = { missing: 0, noCall: 0, alleleMismatch: 0, strandFlipped: 0 };
  for (const s of panel.snps) {
    const v = kit.get(s.rsid);
    if (!v) { skipped.missing++; continue; }
    if (!v.genotype || v.genotype.length !== 2) { skipped.noCall++; continue; }
    let geno = v.genotype;
    const ok = (g: string) => g.split("").every((a) => a === s.allele || a === s.other);
    if (!ok(geno)) {
      const flipped = complement(geno);
      const palindromic = complement(s.allele) === s.other;
      if (ok(flipped) && !palindromic) { geno = flipped; skipped.strandFlipped++; }
      else { skipped.alleleMismatch++; continue; }
    }
    const g = geno.split("").filter((a) => a === s.allele).length;
    // Clamp reference frequencies away from 0/1 so a single SNP cannot zero the likelihood.
    obs.push({ g, f: s.freq.map((x) => Math.min(0.999, Math.max(0.001, x))) });
  }
  return { obs, skipped };
}

function em(obs: Obs[], K: number, maxIter = 500, tol = 1e-7): { q: number[]; ll: number; iterations: number } {
  let q = new Array<number>(K).fill(1 / K);
  let prevLl = -Infinity, ll = -Infinity, it = 0;
  for (it = 0; it < maxIter; it++) {
    const acc = new Array<number>(K).fill(0);
    ll = 0;
    for (const o of obs) {
      let p = 0;
      for (let k = 0; k < K; k++) p += q[k]! * o.f[k]!;
      const gA = o.g, gB = 2 - o.g;
      ll += gA * Math.log(p) + gB * Math.log(1 - p);
      for (let k = 0; k < K; k++) {
        acc[k]! += gA * (q[k]! * o.f[k]!) / p + gB * (q[k]! * (1 - o.f[k]!)) / (1 - p);
      }
    }
    const total = 2 * obs.length;
    q = acc.map((a) => a / total);
    if (Math.abs(ll - prevLl) < tol) break;
    prevLl = ll;
  }
  return { q, ll, iterations: it + 1 };
}

export interface AdmixtureOptions { bootstrapReplicates?: number; blockSize?: number; seed?: number; maxIterations?: number }

export function estimateAdmixture(kit: Kit, panel: ReferencePanel, opts: AdmixtureOptions = {}): AdmixtureResult {
  const K = panel.populations.length;
  const { obs, skipped } = extract(kit, panel);
  const caveats: string[] = [
    "Proportions are relative to the reference populations in the panel only; ancestry from populations absent from the panel is assigned to the closest available ones.",
    "Reference frequencies are treated as exact and SNPs as unlinked; intervals reflect SNP sampling noise, not panel choice.",
  ];
  if (obs.length < 500) caveats.push(`Only ${obs.length} panel SNPs were usable; estimates below ~1,000 SNPs are unstable.`);
  if (obs.length === 0) {
    return { populations: panel.populations, proportions: new Array(K).fill(NaN), ci95: new Array(K).fill([NaN, NaN]), logLikelihood: NaN, snpsUsed: 0, snpsSkipped: skipped, iterations: 0, caveats };
  }
  const main = em(obs, K, opts.maxIterations);

  // Block bootstrap over SNP order (roughly genomic order, so blocks absorb residual LD).
  const reps = opts.bootstrapReplicates ?? 50;
  const block = opts.blockSize ?? 50;
  const rng = mulberry32(opts.seed ?? 7);
  const nBlocks = Math.ceil(obs.length / block);
  const samples: number[][] = [];
  for (let r = 0; r < reps; r++) {
    const boot: Obs[] = [];
    for (let b = 0; b < nBlocks; b++) {
      const start = Math.floor(rng() * nBlocks) * block;
      for (let i = start; i < Math.min(start + block, obs.length); i++) boot.push(obs[i]!);
    }
    samples.push(em(boot, K, 200, 1e-5).q);
  }
  const ci95: Array<[number, number]> = [];
  for (let k = 0; k < K; k++) {
    const col = samples.map((s) => s[k]!).sort((a, b) => a - b);
    const lo = col[Math.floor(0.025 * (col.length - 1))] ?? NaN;
    const hi = col[Math.ceil(0.975 * (col.length - 1))] ?? NaN;
    ci95.push([lo, hi]);
  }
  return { populations: panel.populations, proportions: main.q, ci95, logLikelihood: main.ll, snpsUsed: obs.length, snpsSkipped: skipped, iterations: main.iterations, caveats };
}

/** Thin a panel so consecutive SNPs on a chromosome are at least `minSpacing` bp apart (LD control). */
export function thinPanel(panel: ReferencePanel, minSpacing = 100_000): ReferencePanel {
  const sorted = [...panel.snps].sort((a, b) => a.chrom.localeCompare(b.chrom) || a.pos - b.pos);
  const kept: PanelSnp[] = [];
  let lastChrom: Chrom | undefined, lastPos = -Infinity;
  for (const s of sorted) {
    if (s.chrom !== lastChrom || s.pos - lastPos >= minSpacing) { kept.push(s); lastChrom = s.chrom; lastPos = s.pos; }
  }
  return { ...panel, snps: kept };
}
