/**
 * Descriptive statistics for a single kit: call rate, per-chromosome counts,
 * sex inference and runs of homozygosity.
 */
import { AUTOSOMES, type Chrom, isInXPar } from "../genome.js";
import type { Kit } from "./kit.js";

export interface ChromStats { chrom: Chrom; variants: number; called: number; heterozygous: number }

export interface KitSummary {
  format: string;
  build: number;
  variants: number;
  called: number;
  callRate: number;
  /** Heterozygosity among called autosomal diploid SNPs. */
  autosomalHeterozygosity: number;
  perChromosome: ChromStats[];
}

export function summariseKit(kit: Kit): KitSummary {
  const per = new Map<Chrom, ChromStats>();
  let called = 0, autoCalled = 0, autoHet = 0;
  for (let i = 0; i < kit.size; i++) {
    const c = kit.chromAt(i);
    let s = per.get(c);
    if (!s) { s = { chrom: c, variants: 0, called: 0, heterozygous: 0 }; per.set(c, s); }
    s.variants++;
    const g = kit.genotype[i]!;
    if (!g) continue;
    s.called++; called++;
    const het = g.length === 2 && g[0] !== g[1];
    if (het) s.heterozygous++;
    if (kit.isAutosomeIdx(i) && g.length === 2) { autoCalled++; if (het) autoHet++; }
  }
  return {
    format: kit.meta.format,
    build: kit.meta.build,
    variants: kit.size,
    called,
    callRate: kit.size ? called / kit.size : 0,
    autosomalHeterozygosity: autoCalled ? autoHet / autoCalled : 0,
    perChromosome: [...per.values()],
  };
}

export interface SexInference {
  inferred: "male" | "female" | "undetermined";
  /** Fraction of non-PAR X SNPs called heterozygous. Males are ~0 (only genotyping error). */
  xHeterozygosity: number;
  xCalled: number;
  /** Number of Y-chromosome SNPs with a call. Females have (nearly) none. */
  yCalled: number;
  yTotal: number;
  rationale: string;
}

/**
 * Infer genetic sex from the kit itself. Two independent signals: Y-chromosome
 * call rate, and heterozygosity on the non-pseudo-autosomal X. They should agree;
 * when they do not (e.g. XXY, XO, or a vendor that blanks Y for females), the
 * result is "undetermined" and the numbers are surfaced.
 */
export function inferSex(kit: Kit): SexInference {
  let xCalled = 0, xHet = 0;
  const [xs, xe] = kit.range("X");
  for (let i = xs; i < xe; i++) {
    const g = kit.genotype[i]!;
    if (!g || isInXPar(kit.pos[i]!)) continue;
    xCalled++;
    if (g.length === 2 && g[0] !== g[1]) xHet++;
  }
  const [ys, ye] = kit.range("Y");
  let yCalled = 0;
  for (let i = ys; i < ye; i++) if (kit.genotype[i]) yCalled++;
  const yTotal = ye - ys;
  const xHetRate = xCalled ? xHet / xCalled : 0;
  const yRate = yTotal ? yCalled / yTotal : 0;

  // Empirical thresholds: female X het is typically 0.15-0.35 on consumer chips;
  // male X het is < 0.02 (errors only). Y call rate for females is < 0.1.
  const ySaysMale = yTotal >= 100 && yRate > 0.5;
  const ySaysFemale = yTotal >= 100 && yRate < 0.1;
  const xSaysMale = xCalled >= 200 && xHetRate < 0.03;
  const xSaysFemale = xCalled >= 200 && xHetRate > 0.08;

  let inferred: SexInference["inferred"] = "undetermined";
  let rationale: string;
  if ((ySaysMale || yTotal < 100) && xSaysMale) {
    inferred = "male";
    rationale = `X heterozygosity ${(xHetRate * 100).toFixed(2)}% (hemizygous pattern)` + (ySaysMale ? `; ${yCalled} Y SNPs called` : "");
  } else if ((ySaysFemale || yTotal < 100) && xSaysFemale) {
    inferred = "female";
    rationale = `X heterozygosity ${(xHetRate * 100).toFixed(1)}% (diploid pattern)` + (ySaysFemale ? `; only ${yCalled}/${yTotal} Y SNPs called` : "");
  } else {
    rationale = `Signals disagree or are insufficient: X het ${(xHetRate * 100).toFixed(2)}% over ${xCalled} SNPs, Y calls ${yCalled}/${yTotal}`;
  }
  return { inferred, xHeterozygosity: xHetRate, xCalled, yCalled, yTotal, rationale };
}

export interface RohSegment {
  chrom: Chrom;
  start: number;
  end: number;
  lengthBp: number;
  snps: number;
  heterozygousCalls: number;
}

export interface RohOptions {
  /** Minimum SNPs in a run. Default 200. */
  minSnps?: number;
  /** Minimum span in bp. Default 4 Mb (rough, unmapped equivalent of ~4 cM). */
  minLengthBp?: number;
  /** Heterozygous calls tolerated per run (genotyping error). Default 2. */
  maxHetPerRun?: number;
  /** Max gap in bp between consecutive called SNPs before a run breaks. Default 1 Mb. */
  maxGapBp?: number;
}

/**
 * Runs of homozygosity on the autosomes. Long runs indicate that the two
 * parental haplotypes descend from a recent common ancestor; total ROH length
 * is the classical proxy for parental relatedness (F_ROH). This is a
 * SNP-count sliding scan, not a model-based HMM, so treat the boundaries as
 * approximate.
 */
export function runsOfHomozygosity(kit: Kit, opts: RohOptions = {}): RohSegment[] {
  const minSnps = opts.minSnps ?? 200;
  const minLen = opts.minLengthBp ?? 4_000_000;
  const maxHet = opts.maxHetPerRun ?? 2;
  const maxGap = opts.maxGapBp ?? 1_000_000;
  const out: RohSegment[] = [];

  for (const chrom of AUTOSOMES) {
    const [s, e] = kit.range(chrom);
    let runStart = -1, snps = 0, hets = 0, lastPos = -1, lastIdx = -1;
    const flush = () => {
      if (runStart >= 0 && snps >= minSnps) {
        const start = kit.pos[runStart]!, end = kit.pos[lastIdx]!;
        if (end - start >= minLen) out.push({ chrom, start, end, lengthBp: end - start, snps, heterozygousCalls: hets });
      }
      runStart = -1; snps = 0; hets = 0;
    };
    for (let i = s; i < e; i++) {
      const g = kit.genotype[i]!;
      if (g.length !== 2) continue;
      const pos = kit.pos[i]!;
      if (lastPos >= 0 && pos - lastPos > maxGap) flush();
      const het = g[0] !== g[1];
      if (het) {
        if (runStart >= 0 && hets < maxHet) { hets++; snps++; }
        else { flush(); }
      } else {
        if (runStart < 0) { runStart = i; hets = 0; snps = 0; }
        snps++;
      }
      lastPos = pos; lastIdx = i;
    }
    flush();
    lastPos = -1;
  }
  return out;
}

export function totalRohBp(segments: RohSegment[]): number {
  return segments.reduce((a, s) => a + s.lengthBp, 0);
}
