# Reference-data pipeline

Everything in `data/reference/` is produced by these scripts from public
releases. Nothing is typed in by hand. Each file built from downloads carries
a provenance block: source URLs, the SHA-256 and size of what was downloaded,
the retrieval date, and the method. `reference-samples.json` is covered by
`panel.1000g.json`'s block, and the derived files (`relationships.sim.json`,
`validation.json`) name the script and date that made them. Downloads and intermediate tables go to `data/.cache/` (ignored
by git; about 15 GB at the peak of step 3, freed as it goes).

| Step | Script | Output | Source |
|---|---|---|---|
| 1 | `01-genetic-map.mjs` | `genetic-map.grch37.json` (55k points, 550 kB) | HapMap Phase II map on GRCh37, Beagle's PLINK files |
| 2 | `02-chip-snps.mjs` | `.cache/chip-snps.tsv` (175,406 SNPs) | Illumina GSA v3.0 and OmniExpress v1.3 rsID and coordinate files |
| 3 | `03-1000g-frequencies.py` | `.cache/1000g-counts.tsv`, dosage matrices | 1000 Genomes phase 3 genotype VCFs (release 20130502) |
| 4 | `04-populations.mjs` | `populations.json` | IGSR population API; phase 3 sample panel |
| 5 | `05-panel.py` | `panel.1000g.bin.gz`, `panel.1000g.json`, `reference-samples.json` | steps 1-4 |
| 6 | `06-relationships.mjs` | `relationships.sim.json` | the simulator in `@lineage/core` on the step 1 map |
| 7 | `07-trait-frequencies.py` | `trait-frequencies.json` | 1000 Genomes VCFs at the knowledge base's markers (remote tabix) |
| 8 | `08-validate.mjs` | `validation.json` | steps 1, 3 and 5; the painter and component EM in `@lineage/core` |
| - | `verify-citations.mjs` | (check only) | NCBI E-utilities |

## Running it

```bash
cd lineage
npm ci && npm run build            # step 6 uses the built core package
pip install pysam numpy            # steps 3, 5 and 7
node scripts/data/01-genetic-map.mjs
node scripts/data/02-chip-snps.mjs
python3 scripts/data/03-1000g-frequencies.py   # ~40 min, download-bound; resumable
node scripts/data/04-populations.mjs
python3 scripts/data/05-panel.py               # PCA, components, validation; ~10 min, ~5 GB RAM
node scripts/data/06-relationships.mjs
python3 scripts/data/07-trait-frequencies.py
node scripts/data/08-validate.mjs              # painting and components on spliced genomes
node scripts/data/verify-citations.mjs
```

Step 3 downloads each chromosome's VCF once (with `curl`, resuming partial
files), reads it through its tabix index at the target positions only, and
deletes it afterwards unless `KEEP_VCF=1`. An interrupted run resumes at the
first chromosome not yet written.

## What each output is for

- **genetic-map.grch37.json**: centimorgans for every segment the app measures,
  the simulator's chromosome lengths, the painter's switch rates.
- **panel.1000g.bin.gz**: the reference panel in the `LNGP` binary layout
  documented in `packages/core/src/ancestry/reference.ts`. A dense layer
  (every QC-passing SNP: position, alleles, continental component
  frequencies) and an LD-pruned core (frequencies in 26 populations, pooled
  frequency, PCA loadings).
- **panel.1000g.json**: its provenance, QC counts, the components, PCA
  variance and shrinkage, and the leave-one-out validation shown on the
  Evidence page.
- **reference-samples.json**: each of the 2,504 genomes' population, component
  proportions and PC scores, for the PCA and structure figures. No sample
  identifiers.
- **relationships.sim.json**: 2,000 simulated pairs for each of 23
  relationships, from a fixed seed.
- **validation.json**: accuracy of the chromosome painting at each caution
  setting and the error of the component estimates, measured on test genomes
  spliced from real 1000 Genomes chromosomes (step 3's dosage matrices), so
  the answer is known for every window. Shown on the Ancestry and Evidence
  pages.
- **populations.json**, **trait-frequencies.json**: map coordinates and the
  trait pages' world frequencies.

## Terms

1000 Genomes and IGSR data are available without embargo; cite the project.
Illumina's support files are public downloads. The HapMap-derived map carries
no explicit licence (see `PLAN.md`, risks). The AADR (Release 3) is CC0.
