/**
 * Knowledge-base schema for single-variant trait interpretation. Every entry
 * must carry: plus-strand alleles on the stated build (verified against
 * Ensembl), a literature source with a PubMed ID, and population frequencies
 * with their provenance. Entries without a verifiable source do not belong in
 * the knowledge base.
 */
import type { Chrom } from "../genome.js";

export type TraitCategory = "pigmentation" | "diet" | "sensory" | "muscle" | "metabolism" | "morphology" | "ancestry-informative";

export interface Citation {
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid?: string;
  doi?: string;
  url?: string;
}

export interface PopulationFrequency {
  /** e.g. "1000GENOMES:phase_3:EUR" */
  population: string;
  allele: string;
  frequency: number;
}

export interface TraitVariant {
  id: string;
  rsid: string;
  gene: string;
  name: string;
  category: TraitCategory;
  chrom: Chrom;
  /** GRCh38 position (as reported by Ensembl). */
  pos38: number;
  /** GRCh37 position when known. Consumer kits are keyed by rsid, so this is informational. */
  pos37?: number;
  /** All alleles on the forward strand of the reference (Ensembl allele_string). */
  alleles: string[];
  /** The allele whose count the interpretation is keyed on. */
  effectAllele: string;
  /** Interpretation by number of copies of the effect allele: 0, 1, 2. Haploid calls use 0/1 -> 0/2. */
  interpretation: { 0: string; 1: string; 2: string };
  /** What the evidence supports; kept deliberately modest. */
  evidenceSummary: string;
  /** Populations in which the association was established, and caveats. */
  caveats: string;
  sources: Citation[];
  frequencies: PopulationFrequency[];
  frequenciesSource: { name: string; retrieved: string; url: string };
}

export interface TraitCall {
  variant: TraitVariant;
  /** Genotype as found in the kit (possibly after strand flip). */
  genotype: string | undefined;
  effectAlleleCount: 0 | 1 | 2 | undefined;
  interpretation: string | undefined;
  status: "called" | "no-call" | "not-on-chip" | "strand-flipped" | "allele-mismatch" | "strand-ambiguous";
  note?: string;
}
