/**
 * Pairwise kit comparison: half-identical regions (HIR) and fully-identical
 * regions (FIR), the primitives every "one-to-one" match tool is built on.
 *
 * At each SNP typed in both kits with a diploid call in both, the pair is
 *   - opposite homozygous  (AA vs GG)      -> cannot share either chromosome here
 *   - half identical       (AA vs AG, AA vs AA, AG vs AG) -> compatible with sharing one
 *   - fully identical      (AA vs AA, AG vs AG) -> compatible with sharing both
 * A HIR is a stretch with no opposite-homozygous SNPs; a FIR is a stretch where
 * every SNP is fully identical. Because two random people are half-identical
 * at most SNPs by chance, short runs are meaningless: only runs above a SNP
 * count and a length threshold are reported. Sporadic genotyping errors are
 * tolerated via a small mismatch budget.
 *
 * Without a genetic map, lengths are reported in bp; with one, in cM as well.
 */
import { AUTOSOMES, type Chrom } from "../genome.js";
import type { Kit } from "../kit/kit.js";
import type { GeneticMap } from "./geneticmap.js";

export interface SharedSegment {
  chrom: Chrom;
  start: number;
  end: number;
  lengthBp: number;
  lengthCm?: number;
  snps: number;
  /** Opposite-homozygous SNPs tolerated inside the segment (should be near 0). */
  mismatches: number;
  kind: "half" | "full";
}

export interface CompareOptions {
  minSnps?: number;          // default: density-aware, 100-500 for HIR, 60% of that for FIR
  minLengthBp?: number;      // default 7 Mb (roughly 7 cM without a map)
  minLengthCm?: number;      // default 7 cM when a map is provided
  maxMismatches?: number;    // default: 1 tolerated per 200 SNPs in the run
  includeX?: boolean;        // default true
  map?: GeneticMap;
}

export interface CompareResult {
  halfIdentical: SharedSegment[];
  fullyIdentical: SharedSegment[];
  sharedSnps: number;
  comparableSnps: number;
  /** Fraction of comparable SNPs that are opposite homozygous; ~0.07-0.10 for unrelated Europeans, ~0 for parent/child. */
  oppositeHomozygousRate: number;
  totals: { halfBp: number; fullBp: number; halfCm?: number; fullCm?: number };
  unit: "bp" | "cM";
}

function classify(a: string, b: string): "opp" | "half" | "full" | "skip" {
  if (a.length !== 2 || b.length !== 2) return "skip";
  if (a === b) return "full";
  const aHom = a[0] === a[1], bHom = b[0] === b[1];
  if (aHom && bHom) return "opp";
  // one het, or both het but different (AG vs CT cannot happen for biallelic; treat as half)
  return "half";
}

export function compareKits(a: Kit, b: Kit, opts: CompareOptions = {}): CompareResult {
  const map = opts.map;
  const minBp = opts.minLengthBp ?? 7_000_000;
  // Default SNP minimum: what a 7 Mb window holds at this pair's density, capped at 500
  // (full consumer density) and floored at 100, below which chance runs between unrelated
  // people become common (at ~8% opposite homozygosity, P(100 clean SNPs) ~ 2e-4).
  const density = Math.min(a.size, b.size) / 3.1e9;
  const minSnpsHalf = opts.minSnps ?? Math.max(100, Math.min(500, Math.round(density * minBp)));
  const minSnpsFull = Math.max(20, Math.floor(minSnpsHalf * 0.6));
  const minCm = opts.minLengthCm ?? 7;
  const chroms: Chrom[] = opts.includeX === false ? [...AUTOSOMES] : [...AUTOSOMES, "X"];

  const half: SharedSegment[] = [], full: SharedSegment[] = [];
  let sharedSnps = 0, comparable = 0, opp = 0;

  for (const chrom of chroms) {
    // Walk both sorted position arrays like a merge.
    const [as, ae] = a.range(chrom), [bs, be] = b.range(chrom);
    let i = as, j = bs;
    const positions: number[] = [], classes: Array<"opp" | "half" | "full"> = [];
    while (i < ae && j < be) {
      const pa = a.pos[i]!, pb = b.pos[j]!;
      if (pa === pb) {
        sharedSnps++;
        const c = classify(a.genotype[i]!, b.genotype[j]!);
        if (c !== "skip") { comparable++; if (c === "opp") opp++; positions.push(pa); classes.push(c); }
        i++; j++;
      } else if (pa < pb) i++; else j++;
    }
    if (chrom === "X") {
      // Only meaningful when both are diploid on X (two females); males are hemizygous
      // and their X calls are stored as single alleles, so classify() skips them.
    }
    half.push(...scan(chrom, positions, classes, (c) => c !== "opp", minSnpsHalf, minBp, minCm, opts.maxMismatches, map, "half"));
    full.push(...scan(chrom, positions, classes, (c) => c === "full", minSnpsFull, minBp, minCm, opts.maxMismatches, map, "full"));
  }

  const sum = (segs: SharedSegment[], k: "lengthBp" | "lengthCm") => segs.reduce((acc, s) => acc + (s[k] ?? 0), 0);
  const totals: CompareResult["totals"] = { halfBp: sum(half, "lengthBp"), fullBp: sum(full, "lengthBp") };
  if (map) { totals.halfCm = sum(half, "lengthCm"); totals.fullCm = sum(full, "lengthCm"); }
  return {
    halfIdentical: half, fullyIdentical: full, sharedSnps, comparableSnps: comparable,
    oppositeHomozygousRate: comparable ? opp / comparable : 0, totals, unit: map ? "cM" : "bp",
  };
}

/**
 * Error-tolerant run scan. A run continues while the number of "breaking" SNPs
 * inside a trailing window stays within budget; a run ends when the budget is
 * exceeded, and is trimmed back to the last passing SNP.
 */
function scan(
  chrom: Chrom, positions: number[], classes: Array<"opp" | "half" | "full">,
  pass: (c: "opp" | "half" | "full") => boolean,
  minSnps: number, minBp: number, minCm: number, maxMismatchOpt: number | undefined,
  map: GeneticMap | undefined, kind: "half" | "full",
): SharedSegment[] {
  const out: SharedSegment[] = [];
  const n = positions.length;
  let start = -1, lastGood = -1, mismatches = 0, snps = 0;
  const budgetFor = (count: number) => maxMismatchOpt ?? Math.floor(count / 200);
  const emit = () => {
    if (start >= 0 && lastGood >= start && snps >= minSnps) {
      const s = positions[start]!, e = positions[lastGood]!;
      const lengthBp = e - s;
      const seg: SharedSegment = { chrom, start: s, end: e, lengthBp, snps, mismatches, kind };
      if (map) {
        const c0 = map.cM(chrom, s), c1 = map.cM(chrom, e);
        if (c0 !== undefined && c1 !== undefined) seg.lengthCm = c1 - c0;
      }
      const longEnough = seg.lengthCm !== undefined ? seg.lengthCm >= minCm : lengthBp >= minBp;
      if (longEnough) out.push(seg);
    }
    start = -1; lastGood = -1; mismatches = 0; snps = 0;
  };
  for (let k = 0; k < n; k++) {
    if (pass(classes[k]!)) {
      if (start < 0) { start = k; mismatches = 0; snps = 0; }
      lastGood = k; snps++;
    } else if (start >= 0) {
      mismatches++;
      snps++;
      if (mismatches > budgetFor(snps)) { snps -= mismatches; mismatches = 0; emit(); }
    }
  }
  emit();
  return out;
}
