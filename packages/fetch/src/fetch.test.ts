import { describe, expect, it } from "vitest";
import { syntheticSites, randomPerson, toKit, parseRawKit, toTwentyThreeAndMeText } from "@lineage/core";

/** Synthetic kits use "syn" ids; give this one dbSNP-style ids so the sampler accepts them. */
const rsKit = (perChrom: number, seed: number) => parseRawKit(toTwentyThreeAndMeText(toKit(randomPerson(syntheticSites(perChrom, seed), 1))).replace(/^syn/gm, "rs")).kit;
import { EnsemblClient, thousandGenomesFrequencies, sampleRsidsFromKit, buildThousandGenomesPanel, type EnsemblVariation } from "./index.js";

let nextPos = 1_000_000;
const fake = (rs: string, ref: string, alt: string, freqs: number[], extraAllele?: string): EnsemblVariation => ({
  name: rs,
  mappings: [{ assembly_name: "GRCh37", seq_region_name: "1", start: (nextPos += 1_000_000), end: nextPos, strand: 1, allele_string: `${ref}/${alt}${extraAllele ? "/" + extraAllele : ""}` }],
  populations: ["AFR", "AMR", "EAS", "EUR", "SAS"].flatMap((p, i) => [
    { population: `1000GENOMES:phase_3:${p}`, allele: alt, frequency: freqs[i]! },
    { population: `1000GENOMES:phase_3:${p}`, allele: ref, frequency: 1 - freqs[i]! },
    { population: `gnomADg:ALL`, allele: alt, frequency: 0.5 },
  ]),
});

describe("Ensembl helpers (offline)", () => {
  it("extracts only 1000 Genomes super-population frequencies", () => {
    const f = thousandGenomesFrequencies(fake("rs1", "A", "G", [0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(f.EUR).toEqual({ G: 0.4, A: 0.6 });
    expect(Object.keys(f).sort()).toEqual(["AFR", "AMR", "EAS", "EUR", "SAS"]);
  });

  it("samples evenly spaced autosomal rsIDs from a kit", () => {
    const kit = rsKit(50, 3);
    const ids = sampleRsidsFromKit(kit, 100);
    expect(ids.length).toBe(100);
    expect(new Set(ids).size).toBe(100);
  });

  it("builds a panel from a mocked Ensembl endpoint, dropping palindromic and low-spread SNPs", async () => {
    const kit = rsKit(20, 4);
    const ids = sampleRsidsFromKit(kit, 5);
    const responses: Record<string, EnsemblVariation> = {
      [ids[0]!]: fake(ids[0]!, "A", "G", [0.1, 0.3, 0.5, 0.7, 0.9]),
      [ids[4]!]: fake(ids[4]!, "C", "T", [0.2, 0.4, 0.6, 0.8, 0.9], "A"), // rare third allele listed, still usable
      [ids[1]!]: fake(ids[1]!, "C", "G", [0.1, 0.3, 0.5, 0.7, 0.9]), // palindromic -> dropped
      [ids[2]!]: fake(ids[2]!, "A", "T", [0.5, 0.5, 0.5, 0.5, 0.5]), // palindromic -> dropped
      [ids[3]!]: fake(ids[3]!, "C", "T", [0.50, 0.52, 0.51, 0.53, 0.50]), // low spread -> dropped
    };
    const fetchImpl = (async (_url: any, init?: any) => {
      const body = JSON.parse(init.body);
      const out: Record<string, EnsemblVariation> = {};
      for (const id of body.ids) if (responses[id]) out[id] = responses[id]!;
      return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const client = new EnsemblClient({ build: "GRCh37", fetchImpl, minIntervalMs: 0 });
    const panel = await buildThousandGenomesPanel(kit, { rsids: ids, client });
    expect(panel.populations).toEqual(["AFR", "AMR", "EAS", "EUR", "SAS"]);
    expect(panel.snps.map((s) => s.rsid).sort()).toEqual([ids[0], ids[4]].sort());
    expect(panel.snps[0]!.freq).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
    expect(panel.snps[0]!.allele).toBe("G");
  });
});
