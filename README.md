# Lineage

An open framework for DNA and genealogy analysis that treats accuracy as an engineering requirement. It reads consumer raw-data files and GEDCOM family trees, computes what can actually be computed from them against open reference data, records every result as a sourced fact, and lets an AI narrator explain those facts without being allowed to add anything of its own.

Everything runs client-side in the browser or locally on the command line. Raw genotypes never leave the machine, and the web app makes no request to any site but its own.

**Hold no DNA, show every source.** Why that is the position, and what comes next, is in [`PLAN.md`](PLAN.md); the research behind it is in [`docs/research/`](docs/research/).

## What it does today

| Area | Capability | Where |
|---|---|---|
| Raw files | Parses 23andMe, AncestryDNA, FamilyTreeDNA, MyHeritage, Living DNA and generic layouts into one columnar model, straight from the vendor's `.zip` or a `.gz`; reports skipped rows instead of dropping them silently | `packages/core/src/raw`, `apps/web/src/worker` |
| Kit statistics | Call rate, heterozygosity, genetic sex from X heterozygosity and Y calls, runs of homozygosity read against published landmarks | `packages/core/src/kit` |
| Reference panel | 1000 Genomes phase 3 counted from the genotype files at the SNPs both consumer chip families carry: 26 populations, five continental components, PCA of 2,504 genomes; built by a reproducible pipeline with checksums | `scripts/data`, `data/reference`, `packages/core/src/ancestry` |
| Ancestry | Similarity to 26 populations; continental components with 95% block-bootstrap intervals; least-squares PCA projection with measured shrinkage correction; continental chromosome painting by HMM with a confidence threshold, its accuracy measured on genomes spliced from real reference chromosomes (`scripts/data/08-validate.mjs`) | `packages/core/src/ancestry` |
| One-to-one comparison | Half- and fully-identical segments in cM on the bundled HapMap II GRCh37 map, error-tolerant | `packages/core/src/compare` |
| Relationships | Probabilities from 46,000 simulated pairs (23 relationships) using total cM, segment count and fully identical cM, beside the Shared cM Project v4 ranges | `packages/core/src/relationship`, `segments` |
| Matches | Segment exports from GEDmatch, DNA Painter, 23andMe, FTDNA, MyHeritage; per-match estimates; overlap clusters | `packages/core/src/segments` |
| Family trees | GEDCOM 5.5 / 5.5.1 / 7 with integrity checks, Ahnentafel numbering, fan charts, relationship discovery through the nearest common ancestors with coefficient of relationship and expected shared DNA | `packages/core/src/gedcom`, `pedigree` |
| Traits | 15 benign, well-replicated variants with strand-aware calling, their PubMed papers, and allele frequencies in all 26 populations | `packages/kb`, `data/reference/trait-frequencies.json` |
| Haplogroups | Tree-walking caller for Y and mtDNA with loaders for ISOGG-style CSVs and simple trees; reports coverage, never a bare label (CLI) | `packages/core/src/haplogroup` |
| Demo family | Four fictional generations generated in the browser from reference data, with a GEDCOM and a match list whose true relationships can be revealed | `packages/core/src/demo` |
| Reports | Every result becomes a `Fact` with id, evidence, source and confidence; JSON and Markdown export | `packages/core/src/report` |
| Narration | Claude writes an explanation in which every paragraph cites fact ids; citations are verified mechanically (CLI) | `packages/ai` |
| Web app | Home, Your genome, Ancestry, Relatives, Family tree, Traits and an Evidence room with the network ledger, data provenance and validation | `apps/web` |
| CLI | `lineage inspect | traits | compare | segments | gedcom | panel | admixture | haplogroup | report | narrate` | `packages/cli` |

## Accuracy policy

1. **Nothing from memory.** Reference data is downloaded from public releases by `scripts/data`, which records every source's SHA-256; the trait knowledge base's alleles and positions come from Ensembl; every PubMed ID is checked against NCBI (`node scripts/data/verify-citations.mjs`).
2. **Scope is explicit.** The trait knowledge base admits only benign, visible or dietary characteristics with a primary paper. Disease, carrier and pharmacogenetic variants are out of scope by design.
3. **Probabilities need a model you can read.** Relationship probabilities come from a documented simulation with a fixed seed and are shown next to the empirical Shared cM Project ranges, with equal priors stated. Where no model exists, ranges stay ranges.
4. **Missing inputs are named, not guessed.** A panel SNP that fits neither strand is left out and counted; with no haplogroup tree there is no haplogroup call.
5. **Uncertainty is in the primary view.** Intervals on percentages, "could be none" where an interval touches zero, grey where the painter is unsure, validation on the Evidence page.
6. **The narrator cannot add facts.** The AI layer only receives the report's facts and must cite them by id; the code verifies every citation.
7. **Limitations travel with results.**

## Quick start

```bash
cd lineage
npm install
npm run build
npm test                      # 75 tests: parsers, relationships by simulation, ancestry on planted panels, demo family, GEDCOM

# Web app (http://localhost:5173); the reference data in data/reference is served at /data/
npm run web

# Release smoke test: real CSP headers, every page at 1440 and 390 px, fails on any third-party request,
# then stops the server and checks every page still loads and analyses offline
npm run build --workspace=apps/web && node scripts/smoke.mjs

# Check a deployed site serves exactly the files of your local build (dist/SHA256SUMS)
node scripts/verify-build.mjs https://lineage.jaspermeller.com/

# Command line, on the synthetic samples
node packages/cli/dist/index.js inspect  data/samples/tester.txt
node packages/cli/dist/index.js compare  data/samples/mother.txt data/samples/tester.txt
node packages/cli/dist/index.js segments data/samples/segments.csv
node packages/cli/dist/index.js gedcom   data/samples/family.ged --rel @I5@ @I9@
node packages/cli/dist/index.js report   data/samples/tester.txt --gedcom data/samples/family.ged --out report.json
node packages/cli/dist/index.js narrate  report.json --md report.md   # needs ANTHROPIC_API_KEY
```

## Rebuilding the reference data

See [`scripts/data/README.md`](scripts/data/README.md). In short: eight scripts fetch the HapMap map, the Illumina chip manifests and the 1000 Genomes genotype files, count, prune, run the PCA and the component EM, simulate relationships, count the trait markers, measure the painting's accuracy, and write `data/reference/` with provenance. Step 3 is download-bound (about 40 minutes) and resumable.

## Deploying the web app

Lineage deploys as its own Vercel project, `web`, whose Root Directory is `lineage/apps/web`; `apps/web/vercel.json` installs the workspace from the repo root, builds the core packages and the site, and sets the headers, including the Content-Security-Policy (`default-src 'self'; connect-src 'self'`) that stops the page from contacting any other origin. Each build writes `dist/SHA256SUMS` (every served file's SHA-256, in `sha256sum -c` format) and `dist/sw.js`, a service worker that keeps that exact build on the device so the app works offline; the build hash is the SHA-256 of `SHA256SUMS`, shown on the Evidence page. The build is deterministic, so anyone can rebuild the source and compare with `scripts/verify-build.mjs`. Its address is `lineage.jaspermeller.com`; the portfolio redirects `/lineage` there and frames it on its laptop and phone.

## Library use

```ts
import { parseRawKit, compareKits, geneticMapFromCompact, relationshipPosteriors, decodeReferencePanel, panelGenotypes, componentAdmixture } from "@lineage/core";

const { kit } = parseRawKit(await file.text());
const map = geneticMapFromCompact(await (await fetch("/data/genetic-map.grch37.json")).json());
const shared = compareKits(kit, otherKit, { map });                       // segments in cM
const panel = decodeReferencePanel(gunzipped);                             // data/reference/panel.1000g.bin.gz
const q = componentAdmixture(panel, panelGenotypes(kit, panel));          // proportions with 95% intervals
```

## Data sources and licences

- **1000 Genomes Project phase 3**, genotype VCFs (release 20130502) and the IGSR population API: available without embargo; cite The 1000 Genomes Project Consortium (2015), Nature 526:68-74.
- **Illumina** Global Screening Array v3.0 and OmniExpress v1.3 product files (rsIDs and GRCh37 coordinates): public support downloads.
- **HapMap Phase II genetic map on GRCh37**, as distributed with Beagle: no explicit licence is attached (see `PLAN.md`, risks); cite The International HapMap Consortium (2007).
- **Shared cM Project v4**, Blaine T. Bettinger (2020), as published in the DNA Painter Shared cM Tool, which credits it CC BY 4.0. https://dnapainter.com/tools/sharedcmv4
- **Ensembl REST** for trait-variant mappings; **PubMed** for citation verification.
- **Natural Earth** land outlines via `world-atlas` (public domain; ISC package).
- **ISOGG Y-DNA SNP index** and **PhyloTree** are not bundled; load them from files under their own terms (Release 2 plans YFull YTree, CC BY 4.0, and PhyloTree 17 via Haplogrep, MIT).

## Sample data

`data/samples` holds a small synthetic family for the CLI and tests (tester, sibling, mother, first cousin, unrelated person, GEDCOM, segment export), generated by `data/samples/make-samples.ts` from a seeded PRNG. The web app's demo family is generated in the browser instead (`packages/core/src/demo`), from the reference panel's frequencies and the genetic map. No person in either exists.

## Roadmap

[`PLAN.md`](PLAN.md) sets out three releases: evidence-first genealogy (crossover interference and sex-specific maps, match clusters, WATO-style hypotheses, HGDP populations, Y and mtDNA haplogroups, VCF import, offline use), then an open ancient-DNA and appearance layer (the AADR time map, shared-branch cards, HIrisPlex-S colour probabilities once licensed). It also lists what not to build: faces from DNA, personal ancient percentages, health reports, and a public database of user results, which would recreate the custody risk Lineage exists to avoid.

## Layout

```
lineage/
  packages/core    engine (no dependencies): parsing, comparison, relationships, ancestry, demo, reports
  packages/kb      curated trait knowledge base with verified data
  packages/fetch   Ensembl and PubMed clients, reference panel builder (CLI)
  packages/ai      grounded narration with Claude
  packages/cli     command line
  apps/web         client-side web app (Vite): views, charts, analysis worker
  scripts/data     reference-data pipeline;  scripts/smoke.mjs release smoke test
  data/reference   bundled reference data with provenance (served at /data/)
  data/samples     synthetic samples for the CLI and tests
  docs/research    the research report and its notes
```

## Source and licence

The code is open source under the MIT licence ([`LICENSE`](LICENSE)). It is
published at [github.com/Jasperpi/lineage](https://github.com/Jasperpi/lineage),
a copy of the `lineage/` folder of the private repository that also holds
jaspermeller.com, with its history, updated at each release. The reference
data in `data/reference` is derived from sources with their own terms, listed
in [`scripts/data/README.md`](scripts/data/README.md).

Not a medical device; nothing here is medical advice.
