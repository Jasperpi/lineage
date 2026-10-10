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
 * which is monotone in the likelihood and converges to the MLE on the simplex
 * (the shared, SQUAREM-accelerated implementation in ancestry/analyse.ts).
 *
 * Honest limitations, surfaced in the result:
 *  - the answer is only as good as the reference panel: a person from a
 *    population that is not in the panel is forced onto the nearest ones;
 *  - SNPs are assumed unlinked; thin the panel (>= 100 kb spacing) before use;
 *  - the confidence intervals are block-bootstrap intervals over SNPs and
 *    reflect sampling noise only, not panel misspecification.
 */
import { type Chrom, CHROMOSOMES } from "../genome.js";
import { emFixedF } from "../ancestry/analyse.js";
import { quantileSorted } from "../ancestry/calibration.js";
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

/** Pack observations for the shared EM (ancestry/analyse.ts): dosages and SNP-major frequencies. */
function pack(obs: Obs[], K: number): { dos: Int8Array; F: Float64Array } {
  const dos = new Int8Array(obs.length), F = new Float64Array(obs.length * K);
  obs.forEach((o, t) => { dos[t] = o.g; for (let k = 0; k < K; k++) F[t * K + k] = o.f[k]!; });
  return { dos, F };
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
  const { dos, F } = pack(obs, K);
  const all = Array.from({ length: obs.length }, (_, t) => t);
  const main = emFixedF(dos, F, K, all, opts.maxIterations ?? 3000, 1e-12, 1e-7);

  // Block bootstrap over SNP order (roughly genomic order, so blocks absorb residual LD).
  const reps = opts.bootstrapReplicates ?? 50;
  const block = opts.blockSize ?? 50;
  const rng = mulberry32(opts.seed ?? 7);
  const nBlocks = Math.ceil(obs.length / block);
  const samples: number[][] = [];
  for (let r = 0; r < reps; r++) {
    const idx: number[] = [];
    for (let b = 0; b < nBlocks; b++) {
      const start = Math.floor(rng() * nBlocks) * block;
      for (let i = start; i < Math.min(start + block, obs.length); i++) idx.push(i);
    }
    // Run each replicate to convergence from the full-data estimate (a replicate stopped early
    // sits near its start and makes the interval too narrow).
    samples.push(emFixedF(dos, F, K, idx, 1500, 1e-11, 1e-5, main.q.map((x) => Math.max(x, 1e-3))).q);
  }
  const ci95: Array<[number, number]> = [];
  for (let k = 0; k < K; k++) {
    const col = samples.map((s) => s[k]!).sort((a, b) => a - b);
    const lo = col.length ? quantileSorted(col, 0.025) : NaN;
    const hi = col.length ? quantileSorted(col, 0.975) : NaN;
    ci95.push([lo, hi]);
  }
  return { populations: panel.populations, proportions: main.q, ci95, logLikelihood: main.ll, snpsUsed: obs.length, snpsSkipped: skipped, iterations: main.it, caveats };
}

/** Thin a panel so consecutive SNPs on a chromosome are at least `minSpacing` bp apart (LD control). */
export function thinPanel(panel: ReferencePanel, minSpacing = 100_000): ReferencePanel {
  const order = (c: Chrom) => { const i = CHROMOSOMES.indexOf(c); return i < 0 ? 99 : i; };
  const sorted = [...panel.snps].sort((a, b) => order(a.chrom) - order(b.chrom) || a.pos - b.pos);
  const kept: PanelSnp[] = [];
  let lastChrom: Chrom | undefined, lastPos = -Infinity;
  for (const s of sorted) {
    if (s.chrom !== lastChrom || s.pos - lastPos >= minSpacing) { kept.push(s); lastChrom = s.chrom; lastPos = s.pos; }
  }
  return { ...panel, snps: kept };
}
