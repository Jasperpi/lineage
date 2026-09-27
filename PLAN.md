# Lineage: the plan

How Lineage gets better than the small DNA-testing and DNA-upload companies, and
the process that keeps it honest while it does. Written 2026-09-25, after the
research in `docs/research/` and the redesign that shipped with it. Keep this
file current: sessions do not share memory, and a decision not written here is a
decision the next session does not have.

## The position in one paragraph

Lineage cannot beat the upload companies at matching strangers, because that
needs a database of other people's DNA, and holding one is the liability that
sank 23andMe's reputation and its balance sheet. It beats them by giving away
the analysis layer they charge for, running it on the user's own device, and
putting a public dataset, a published method, a sample size and an interval
behind every number. The market has moved this way on its own: MyHeritage
stopped taking uploads in May 2025, openSNP shut down in April 2025,
FamilyTreeDNA retired its upload unlock in August 2026, and GEDmatch (owned by
the forensic firm Qiagen) raised Tier 1 to $15 a month for new subscribers on
1 September 2026. Sources for all of this are in the research report.

Tagline: **hold no DNA, show every source.**

## What shipped in this release (2026-09-25)

The web app was rewritten, and the engine and data behind it were rebuilt.

| Area | Before | Now |
|---|---|---|
| Reference data | Live Ensembl calls from the browser for 2,000-8,000 rsIDs (about 20 minutes for 4,000; sends the chip's rsIDs to a third party) | A bundled panel counted from the 1000 Genomes phase 3 genotype files: SNPs on both consumer chip families, 26 populations, five continental components (ADMIXTURE's supervised mode: 20 reference populations fixed, the Indigenous American component learned from the six admixed ones), PCA. Zero third-party requests |
| Genetic map | None: lengths in Mb | HapMap II on GRCh37, 55k points, lengths in cM everywhere |
| Relationships | Shared cM Project ranges only, no probabilities | Probabilities from 46,000 simulated pairs using total cM, segment count and fully identical cM, beside the Shared cM Project ranges |
| Ancestry | Five super-populations, one bar chart | Similarity to 26 populations on a world map; five components with 95% intervals and Cautious/Standard/Complete views; PCA among 2,504 genomes; continental chromosome painting with a confidence threshold; the reference panel's own structure plot |
| Traits | Text list | Cards with genotype chips, papers and each allele's frequency in 26 populations (strip or world map) |
| Family tree | Stats and a calculator | Fan chart (by side, expected DNA, birth country), relationship path diagram, predicted DNA distribution |
| Demo | Six small synthetic files | A four-generation fictional family generated in the browser from reference data, with a GEDCOM and a match list whose true relationships can be revealed next to the estimates |
| Evidence | An About tab | An evidence room: network ledger, every dataset with source, terms and SHA-256, validation figures, methods with verified citations, the file's numbered facts with JSON and Markdown export |
| Validation | None | On the Evidence page: the similarity ranking checked leave-one-out on all 2,504 genomes (own population first 89%, own continent 99.4%); the simulator against the Shared cM Project (close relatives within 2%); PCA shrinkage from five-fold hold-out; painting and components on genomes spliced from real chromosomes (at the Standard setting 96.2% of painted windows right, 89% painted; components off by 0.8 points on average) |
| Privacy | "Nothing is uploaded" in the header | A strict Content-Security-Policy (`connect-src 'self'`), self-hosted fonts, no analytics, and an on-page ledger of every request the browser made |

Also fixed: `findRelationship` reported first cousins as second cousins whenever
the tree recorded the shared grandparents' parents (regression test added).

## What makes it different

1. **Privacy that can be checked, not promised.** No server receives genetic
   data; the CSP forbids the page from contacting any other origin; the ledger
   shows every request; the code is public. Next: offline use and published
   build hashes.
2. **Reference data counted from source.** The panel is not someone else's
   summary. `scripts/data` downloads the 1000 Genomes genotype VCFs, Illumina's
   chip manifests and the HapMap map, records each file's SHA-256, and counts.
   Anyone can rerun it: the downloads are checksummed and the counting is
   exact, while the fitted parts (PCA, components) run in multithreaded
   floating point and can differ in the last stored digit between machines.
3. **Probabilities with a model you can read.** Relationship odds come from a
   documented pedigree simulation with a fixed seed, and the page shows how it
   compares with the crowd-sourced Shared cM Project (close relatives within
   2%; distant cousins lower, for reasons the page explains).
4. **Uncertainty in the primary view.** Intervals on every percentage, "could
   be none" for components whose interval touches zero, grey where the painter
   is unsure, validation numbers on the Evidence page.
5. **Every result is a numbered fact.** The report is the contract; the
   command-line narrator may only restate facts by id, and its citations are
   checked mechanically.
6. **Free where others charge.** Cluster views, chromosome browsers, relationship
   odds and ancient-DNA context cost $55 a year to $844 a tier elsewhere.

## The process

Every number that reaches the page goes through the same steps.

1. **Source.** Data comes only from a public release with stated terms, fetched
   by a script in `scripts/data`, never typed in. The script writes a
   provenance block (URL, SHA-256, bytes, retrieval date, method) into the
   output file.
2. **Scope.** Traits must be benign, visible or dietary, with a primary paper.
   Disease, carrier and drug-response variants are out by rule.
3. **Method.** Every model has a primary citation. Every PubMed ID lives in
   `apps/web/src/lib/citations.ts` or the trait knowledge base, and
   `node scripts/data/verify-citations.mjs` checks them against NCBI.
4. **Test.** Each analysis has tests on data where the answer is known:
   simulated pedigrees for relationships, synthetic panels with planted
   ancestry blocks for painting and admixture, a deeper GEDCOM for the
   relationship finder (`npm test`, 75 tests as of this release).
5. **Validate.** Results on real reference genomes are published on the
   Evidence page: leave-one-out population ranking, simulation against the
   Shared cM Project, PCA shrinkage, and painting and component accuracy on
   genomes spliced from real chromosomes (`scripts/data/08-validate.mjs`). A
   method with no validation figure is not finished.
6. **Present.** Titles state the finding; intervals and sources sit in the
   figure; limitations travel with the result.
7. **Release.** Rebuild data (`scripts/data/README.md`), run tests, typecheck
   and build, check the page at 1440x900 and 390x844 and inside the portfolio's
   laptop and phone frames, confirm zero third-party requests, commit.

## Roadmap

### Release 1, still to do

The source was published on 2026-09-27 at
[github.com/Jasperpi/lineage](https://github.com/Jasperpi/lineage) under the MIT
licence: a copy of `lineage/` with its history, updated at each release. The
repository it comes from stays private, because it also holds other people's
data and unreleased work. The app now says "open source" and links to it.

| Work | Why |
|---|---|
| Offline use and published build hashes | Lets people check that the page they run is the code that was published |
| Settle the three licence questions below | Removes the main legal risks before any wider launch |

### Release 2: evidence-first genealogy and ancestry depth

| Work | Acceptance |
|---|---|
| Crossover interference and sex-specific maps in the simulator (Ped-sim's model; Bhérer 2017 maps once their licence is settled); longest segment and X chromosome as evidence | Simulated segment-count spread matches Ped-sim's published half-sibling figures; X sharing narrows maternal vs paternal candidates |
| Match clusters from exported shared-match files (AutoCluster-style matrix, cards on phones), Leeds colouring, overlap triangulation that checks match-to-match data when supplied | Works on FamilyTreeDNA and GEDmatch exports; no scraping, only files users download |
| Hypothesis scoring against a GEDCOM (WATO-style): place a match in the tree, score each position by the simulated likelihood | Reproduces DNA Painter's WATO ranking on its own worked examples |
| HGDP populations (Bergström 2020, 54 populations with coordinates) added to the panel, via the gnomAD HGDP+1KG release | Middle East, Central Asia, Oceania and Indigenous Americas appear on the map; the panel stays under 8 MB compressed |
| Haplogroups from YFull YTree (CC BY 4.0) and PhyloTree 17 via Haplogrep (MIT), with coverage and branch ages | Calls match Haplogrep on the 1000 Genomes samples' chip-SNP subsets |
| Runs of homozygosity by the Ceballos/ROHgen protocol, shown against the user's nearest population's baseline | Baselines computed from the 2,504 reference genomes and bundled |
| Painting held to its measured accuracy: hidden for any continent pair below a stated level, and the spliced-genome validation repeated with its donors left out of the component fit | The per-pair table on the Evidence page decides what is painted; held-out numbers published beside the current ones |
| Ancestry in two stages: similarity, PCA, point estimates and painting first, then the bootstrap intervals (the 60 replicates are most of the few seconds the page takes) | The first ancestry figures appear within 5 seconds on a mid-range phone |
| VCF import (whole-genome and sequencing-panel files), documented conversion for CRAM | A WGS VCF opens and gives the same ancestry result as its chip-SNP subset |
| Offline and installable (service worker), reproducible builds with published hashes | Loading a file and every analysis work with the network off once the data files are cached |

### Release 3: an open ancient-DNA and appearance layer

| Work | Acceptance |
|---|---|
| AADR v66.p1 time map: dated samples on the map, a histogram by century, sample cards with date, method, site, haplogroups, quality flag and DOI | Only "Pass" samples by default; version pinned; per-individual rows fetched by HTTP range from the CC0 release, never whole files |
| "Shared branch" cards: ancient individuals on the user's own Y or mtDNA branch | A haplogroup fact, with the branch age, not a similarity score |
| Ancient groups ranked by similarity from precomputed CC0 frequencies, once chip overlap with the 1240k panel is measured; published population models shown as history | No personal "% Yamnaya"; the page explains why, with Harney 2021 |
| HIrisPlex-S eye, hair and skin colour probabilities with their published AUCs and the user's marker coverage | Only after the coefficients' reuse terms are confirmed with the authors |
| Explainers: why DNA cannot draw a face, and "how much DNA do you share?" as a scroll story built on the simulator | Every claim cited |
| Version diffs ("then and now" when reference data changes) and a share card that carries no genotypes | The card shows intervals and the method version |

### Later

- Narration in the browser with the user's own API key, sending facts only,
  never genotypes, and only if they opt in.
- Translations; an accessibility audit against Chartability's critical tests.

## What not to build

- **Faces from DNA.** The evidence does not support it (Lippert 2017 and the
  critiques; the HIrisPlex-S co-developer's "we can't even do a nose").
- **Personal ancient percentages or ancient "matches" from chip files.** Models
  describe populations; one person's fit is poorly identified.
- **Global25 coordinates.** Not a published method; the projection space is private.
- **Health, carrier or drug-response reports.** Out of scope by rule.
- **A public research database of user results.** It would recreate the custody
  risk that is Lineage's clearest advantage. (Removed from the README's roadmap.)
- **Anything from SNPedia, the openSNP dump or FamilyTreeDNA's Mitotree**, whose
  licences or creators' wishes rule it out; **scraping** vendor sites.

## Risks and open questions

| Risk | Plan |
|---|---|
| No licence is attached to the HapMap/Beagle genetic map (nor to Bhérer's or deCODE's) | Ask the authors; the HapMap data were released publicly, and the map is widely redistributed by Beagle, IMPUTE and PLINK, but get it in writing |
| The Shared cM Project v4 PDF states no licence (the DNA Painter tool credits it CC BY 4.0) | Ask Blaine Bettinger for a grant covering the bundled table |
| HIrisPlex-S coefficients are not openly published | Ask the Erasmus MC authors before building it |
| New state genetic-privacy laws and the GDPR: does browser-only analysis make the operator a "genetic testing company" or a data controller? | Legal review before any wider launch; the architecture (no server, no storage) is the strongest possible answer |
| New tests ship sequencing files (MyHeritage CRAM, FamilyTreeDNA panel) | VCF import in Release 2; documented conversion for CRAM |
| Panel coverage for chips outside the two families | Coverage is measured and shown per file; the Ensembl panel builder remains in the CLI for other chips |
| Low-end phones: about 6 MB of reference data (the panel alone is 4.7 MB compressed; allele frequencies barely compress) and a few seconds of computation | Data loads only when a view needs it, and analyses run in a worker with progress. Next: find how far the 85,700-SNP core can shrink before the leave-one-out accuracy drops (the core's blocks are about 70% of the compressed file); delta-coding the population frequencies within each continent shrinks their block by only about 20% (measured) |

## How we will know it is better

- **Zero third-party requests**, checked automatically in the release smoke test.
- **Time to first result** under 5 seconds for a 700k-SNP file on a mid-range phone.
- **Coverage** of panel SNPs above 80% for 23andMe v5, AncestryDNA v2, MyHeritage and FamilyTreeDNA files (measure on consenting users' own files, locally).
- **Accuracy numbers on the Evidence page** for every method, and they do not get worse between releases.
- **Every citation verifies**, every dataset has a SHA-256, every figure has a source line.

## Where things are

- `docs/research/reports/` - the research report behind this plan, and `research_notes/` with the sources.
- `scripts/data/` - the reference-data pipeline (see its README).
- `data/reference/` - the bundled, provenance-stamped outputs the app serves at `/data/`.
- `packages/core/src/relationship`, `ancestry`, `demo` - the new engine code.
- `apps/web/src` - the app: `views/` pages, `charts/` figures, `worker/` analysis, `lib/` plumbing.
