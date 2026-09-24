/** Nucleotide helpers shared across the framework. */

export type Base = "A" | "C" | "G" | "T";
export const BASES: readonly Base[] = ["A", "C", "G", "T"];

const COMPLEMENT: Record<string, string> = {
  A: "T", T: "A", C: "G", G: "C", D: "D", I: "I", "-": "-", "0": "0",
};

export function complement(allele: string): string {
  return allele.split("").map((c) => COMPLEMENT[c] ?? c).join("");
}

/** True when an allele pair reads the same on both strands (A/T or C/G). */
export function isPalindromic(alleles: Iterable<string>): boolean {
  const set = new Set(alleles);
  return (set.has("A") && set.has("T")) || (set.has("C") && set.has("G"));
}

export function isBase(s: string): s is Base {
  return s === "A" || s === "C" || s === "G" || s === "T";
}

/** Canonical genotype spelling: alleles sorted, e.g. "GA" -> "AG". */
export function canonicalGenotype(g: string): string {
  return g.split("").sort().join("");
}
