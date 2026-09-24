import type { Kit } from "../kit/kit.js";
import { complement, isPalindromic } from "../util/alleles.js";
import type { TraitCall, TraitVariant } from "./types.js";

/**
 * Look a trait variant up in a kit and interpret it. Strand handling:
 * consumer files report the forward strand, the same strand the knowledge base
 * uses, so a direct match is expected. If the kit's alleles are the complement
 * of the known alleles (and the SNP is not palindromic) the genotype is flipped
 * and the call flagged, because that indicates a vendor/version reporting on the
 * other strand. Palindromic SNPs whose alleles do not match are left uncalled
 * rather than guessed.
 */
export function callTrait(kit: Kit, variant: TraitVariant): TraitCall {
  const v = kit.get(variant.rsid);
  if (!v) return { variant, genotype: undefined, effectAlleleCount: undefined, interpretation: undefined, status: "not-on-chip" };
  if (!v.genotype) return { variant, genotype: "", effectAlleleCount: undefined, interpretation: undefined, status: "no-call" };

  const known = new Set(variant.alleles);
  // Strand ambiguity is a property of the reference/effect pair, not of the full multi-allelic list.
  const palindromic = isPalindromic([variant.alleles[0] ?? "", variant.effectAllele]);
  let genotype = v.genotype;
  let status: TraitCall["status"] = "called";
  const observed = new Set(genotype.split(""));
  const allKnown = [...observed].every((a) => known.has(a));
  if (!allKnown) {
    const flipped = complement(genotype);
    const flippedKnown = flipped.split("").every((a) => known.has(a));
    if (flippedKnown && !palindromic) { genotype = flipped.split("").sort().join(""); status = "strand-flipped"; }
    else return { variant, genotype: v.genotype, effectAlleleCount: undefined, interpretation: undefined, status: "allele-mismatch", note: `Kit alleles ${v.genotype} are not among the known alleles ${variant.alleles.join("/")}` };
  } else if (palindromic && observed.size === 1 && kit.meta.strand !== "plus") {
    // Homozygous at a palindromic SNP with unknown strand: A/A could be T/T on the other strand.
    return { variant, genotype: v.genotype, effectAlleleCount: undefined, interpretation: undefined, status: "strand-ambiguous", note: "Palindromic SNP with unknown file strand; cannot orient the genotype." };
  }

  let count = genotype.split("").filter((a) => a === variant.effectAllele).length;
  if (genotype.length === 1) count *= 2; // haploid call (X/Y/MT in a male): treat as homozygous
  const c = Math.min(2, count) as 0 | 1 | 2;
  return { variant, genotype, effectAlleleCount: c, interpretation: variant.interpretation[c], status };
}

export function callTraits(kit: Kit, variants: readonly TraitVariant[]): TraitCall[] {
  return variants.map((v) => callTrait(kit, v));
}
