import { describe, expect, it } from "vitest";
import { parseRawKit, callTraits, isPalindromic } from "@lineage/core";
import { TRAITS } from "./index.js";

describe("trait knowledge base", () => {
  it("every entry has verified coordinates, a PubMed-cited source and frequencies for five super-populations", () => {
    for (const t of TRAITS) {
      expect(t.pos37).toBeGreaterThan(0);
      expect(t.pos38).toBeGreaterThan(0);
      expect(t.alleles).toContain(t.effectAllele);
      expect(t.sources.length).toBeGreaterThan(0);
      for (const s of t.sources) expect(s.pmid).toMatch(/^\d+$/);
      const pops = new Set(t.frequencies.map((f) => f.population.split(":").pop()));
      expect([...pops].sort()).toEqual(["AFR", "AMR", "EAS", "EUR", "SAS"]);
      const eff = t.frequencies.filter((f) => f.allele === t.effectAllele);
      expect(eff.length).toBeGreaterThan(0);
    }
  });

  it("effect-allele frequencies match the known population pattern", () => {
    const eur = (rsid: string, allele: string) => TRAITS.find((t) => t.rsid === rsid)!.frequencies.find((f) => f.population.endsWith("EUR") && f.allele === allele)!.frequency;
    const eas = (rsid: string, allele: string) => TRAITS.find((t) => t.rsid === rsid)!.frequencies.find((f) => f.population.endsWith("EAS") && f.allele === allele)!.frequency;
    expect(eur("rs1426654", "A")).toBeGreaterThan(0.99);   // SLC24A5 derived allele near-fixed in Europe
    expect(eas("rs3827760", "G")).toBeGreaterThan(0.8);    // EDAR derived allele common in East Asia
    expect(eas("rs17822931", "T")).toBeGreaterThan(0.7);   // dry earwax allele common in East Asia
    expect(eur("rs4988235", "A")).toBeGreaterThan(0.4);    // lactase persistence common in Europe
  });

  it("calls a synthetic kit end to end", () => {
    const lines = TRAITS.map((t) => `${t.rsid}\t${t.chrom}\t${t.pos37}\t${t.effectAllele}${t.effectAllele}`);
    const { kit } = parseRawKit("# 23andMe test\n" + lines.join("\n") + "\n");
    const calls = callTraits(kit, TRAITS);
    expect(calls.every((c) => c.status === "called" && c.effectAlleleCount === 2)).toBe(true);
  });

  it("flags palindromic entries so strand issues are visible", () => {
    const pal = TRAITS.filter((t) => isPalindromic([t.alleles[0]!, t.effectAllele]));
    // Two entries are genuine C/G SNPs. Vendor files report the forward strand, so they call
    // correctly; a file of unknown strand will (rightly) leave them uncalled when homozygous.
    expect(pal.map((t) => t.rsid).sort()).toEqual(["rs16891982", "rs713598"]);
  });
});
