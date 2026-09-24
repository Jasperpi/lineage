/**
 * Build a supervised-admixture reference panel from Ensembl's 1000 Genomes
 * phase 3 super-population frequencies, using SNPs that are actually on the
 * user's chip. This makes admixture estimates reproducible from public data
 * with no proprietary reference set.
 *
 * Selection: sample rsIDs from the kit (autosomal, called, evenly spaced),
 * fetch their frequencies, keep biallelic SNPs with frequency data in all five
 * super-populations, prefer informative SNPs (large frequency spread), and
 * thin to the requested spacing.
 */
import { type Kit, type ReferencePanel, type PanelSnp, type Chrom, AUTOSOMES, thinPanel, complement } from "@lineage/core";
import { EnsemblClient, THOUSAND_GENOMES_SUPERPOPS, thousandGenomesFrequencies, type SuperPop } from "./ensembl.js";

export interface PanelBuildOptions {
  /** rsIDs to query. Default: up to `maxSnps` sampled from the kit. */
  rsids?: string[];
  maxSnps?: number;          // default 4000 (20 POST requests)
  minSpacingBp?: number;     // default 250 kb
  /** Keep only SNPs whose max-min frequency across populations exceeds this. Default 0.1 */
  minSpread?: number;
  build?: "GRCh37" | "GRCh38";
  client?: EnsemblClient;
  onProgress?: (done: number, total: number) => void;
}

export function sampleRsidsFromKit(kit: Kit, max: number, seed = 1): string[] {
  const candidates: string[] = [];
  for (const c of AUTOSOMES) {
    const [s, e] = kit.range(c);
    for (let i = s; i < e; i++) {
      const rs = kit.rsid[i]!, g = kit.genotype[i]!;
      if (rs.startsWith("rs") && g.length === 2) candidates.push(rs);
    }
  }
  if (candidates.length <= max) return candidates;
  // Even stride across the genome, offset by seed, so the sample is spread out.
  const stride = candidates.length / max;
  const out: string[] = [];
  for (let k = 0; k < max; k++) out.push(candidates[Math.floor((k + (seed % 1)) * stride)]!);
  return out;
}

export async function buildThousandGenomesPanel(kit: Kit, opts: PanelBuildOptions = {}): Promise<ReferencePanel> {
  const build = opts.build ?? "GRCh37";
  const client = opts.client ?? new EnsemblClient({ build });
  const rsids = opts.rsids ?? sampleRsidsFromKit(kit, opts.maxSnps ?? 4000);
  const data = await client.variations(rsids, true, opts.onProgress);
  const pops = [...THOUSAND_GENOMES_SUPERPOPS];
  const snps: PanelSnp[] = [];
  for (const rs of rsids) {
    const v = data[rs];
    if (!v) continue;
    const m = v.mappings.find((x) => x.assembly_name === build && /^(\d+|X)$/.test(x.seq_region_name));
    if (!m || m.strand !== 1) continue;
    const alleles = m.allele_string.split("/");
    if (alleles.some((a) => a.length !== 1)) continue; // SNPs only, no indels
    const f = thousandGenomesFrequencies(v);
    if (!pops.every((p) => f[p as SuperPop])) continue;
    // Ensembl lists rare third alleles for many common SNPs (e.g. G/A/C/T). Treat the SNP as
    // biallelic on the reference allele and the most frequent alternative, provided those two
    // account for essentially all chromosomes in every population.
    const ref = alleles[0]!;
    const altCandidates = alleles.slice(1);
    const altFreqSum = (a: string) => pops.reduce((acc, p) => acc + (f[p as SuperPop]![a] ?? 0), 0);
    const alt = altCandidates.sort((a, b) => altFreqSum(b) - altFreqSum(a))[0];
    if (!alt) continue;
    if (complement(ref) === alt) continue; // palindromic: strand cannot be verified
    const freq = pops.map((p) => {
      const table = f[p as SuperPop]!;
      const fr = table[ref] ?? 0, fa = table[alt] ?? 0;
      return fr + fa >= 0.99 ? fa : NaN;
    });
    if (freq.some((x) => !Number.isFinite(x))) continue;
    const spread = Math.max(...freq) - Math.min(...freq);
    if (spread < (opts.minSpread ?? 0.1)) continue;
    snps.push({ rsid: rs, chrom: m.seq_region_name as Chrom, pos: m.start, allele: alt, other: ref, freq });
  }
  const thinned = thinPanel({ name: "", build: 37, populations: pops, snps, source: { name: "", url: "", retrieved: "" } }, opts.minSpacingBp ?? 250_000).snps;
  const panel: ReferencePanel = {
    name: `1000 Genomes phase 3 super-populations (${thinned.length} SNPs)`,
    build: build === "GRCh37" ? 37 : 38,
    populations: pops,
    snps: thinned,
    source: { name: "1000 Genomes Project phase 3 via Ensembl REST", url: `https://${build === "GRCh37" ? "grch37." : ""}rest.ensembl.org/variation/homo_sapiens`, retrieved: new Date().toISOString().slice(0, 10) },
  };
  return panel;
}
