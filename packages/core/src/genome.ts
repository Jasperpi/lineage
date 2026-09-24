/**
 * Reference genome constants.
 *
 * Every consumer DNA test on the market (23andMe, AncestryDNA, FamilyTreeDNA,
 * MyHeritage, Living DNA) reports positions on GRCh37 / hg19 as of 2026, so
 * that is the framework's canonical build. GRCh38 lengths are kept for
 * conversion tooling and for annotation lookups against Ensembl.
 */

export type Chrom =
  | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12"
  | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21" | "22"
  | "X" | "Y" | "MT";

export const AUTOSOMES: readonly Chrom[] = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
  "13", "14", "15", "16", "17", "18", "19", "20", "21", "22",
];

export const CHROMOSOMES: readonly Chrom[] = [...AUTOSOMES, "X", "Y", "MT"];

/** Chromosome lengths in base pairs, GRCh37 (hg19). */
export const GRCH37_LENGTH: Readonly<Record<Chrom, number>> = {
  "1": 249_250_621, "2": 243_199_373, "3": 198_022_430, "4": 191_154_276,
  "5": 180_915_260, "6": 171_115_067, "7": 159_138_663, "8": 146_364_022,
  "9": 141_213_431, "10": 135_534_747, "11": 135_006_516, "12": 133_851_895,
  "13": 115_169_878, "14": 107_349_540, "15": 102_531_392, "16": 90_354_753,
  "17": 81_195_210, "18": 78_077_248, "19": 59_128_983, "20": 63_025_520,
  "21": 48_129_895, "22": 51_304_566, "X": 155_270_560, "Y": 59_373_566,
  "MT": 16_569,
};

/**
 * GRCh37 pseudo-autosomal regions on the X chromosome. Variants here behave
 * autosomally (males are diploid), so sex inference must exclude them.
 * PAR1: Xp22.33, PAR2: Xq28. Coordinates per the GRC assembly definition.
 */
export const GRCH37_X_PAR: ReadonlyArray<readonly [number, number]> = [
  [60_001, 2_699_520],
  [154_931_044, 155_260_560],
];

export function isInXPar(pos: number): boolean {
  return GRCH37_X_PAR.some(([s, e]) => pos >= s && pos <= e);
}

/** Map a chromosome index (1-25) to a Chrom; used by compact columnar storage. */
export const CHROM_BY_INDEX: readonly Chrom[] = CHROMOSOMES;
export const INDEX_BY_CHROM: Readonly<Record<Chrom, number>> = Object.fromEntries(
  CHROMOSOMES.map((c, i) => [c, i]),
) as Record<Chrom, number>;

/**
 * Normalise the many spellings vendors use for chromosome names.
 * Returns undefined for anything that is not a recognised human chromosome.
 */
export function normaliseChrom(raw: string): Chrom | undefined {
  let s = raw.trim().toUpperCase();
  if (s.startsWith("CHR")) s = s.slice(3);
  switch (s) {
    case "23": case "X": return "X";
    case "24": case "Y": return "Y";
    case "25": case "XY": case "PAR": return "X"; // AncestryDNA codes the PAR as 25; FTDNA used XY
    case "26": case "MT": case "M": case "CHRM": return "MT";
    case "0": return undefined;
    default: {
      const n = Number(s);
      if (Number.isInteger(n) && n >= 1 && n <= 22) return String(n) as Chrom;
      return undefined;
    }
  }
}

export function isAutosome(c: Chrom): boolean {
  return c !== "X" && c !== "Y" && c !== "MT";
}
