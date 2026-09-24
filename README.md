# Lineage

An open framework for DNA and genealogy analysis that treats accuracy as an engineering requirement. It reads consumer raw-data files and GEDCOM family trees, computes what can actually be computed from them, records every result as a sourced fact, and lets an AI narrator explain those facts without being allowed to add anything of its own.

Everything runs client-side in the browser or locally on the command line. Raw genotypes never leave the machine.

## What it does today

| Area | Capability | Where |
|---|---|---|
| Raw files | Parses 23andMe, AncestryDNA, FamilyTreeDNA, MyHeritage, Living DNA and generic layouts into one columnar model; reports skipped rows instead of dropping them silently | `packages/core/src/raw` |
| Kit statistics | Call rate, heterozygosity, genetic sex from X heterozygosity and Y calls, runs of homozygosity | `packages/core/src/kit` |
| One-to-one comparison | Half-identical and fully-identical regions between two kits with error tolerance; cM when a HapMap-format genetic map is supplied | `packages/core/src/compare` |
| Matches | Parses segment exports from GEDmatch, DNA Painter, 23andMe, FTDNA, MyHeritage; per-match totals; relationships consistent with the Shared cM Project v4 ranges; overlap clusters | `packages/core/src/segments` |
| Family trees | GEDCOM 5.5 / 5.5.1 / 7 parser with integrity checks, Ahnentafel numbering, matrilineal and patrilineal lines, relationship discovery between any two people with coefficient of relationship, kinship coefficient and expected shared DNA | `packages/core/src/gedcom`, `pedigree` |
| Traits | 15 benign, well-replicated variants (lactase persistence, eye, skin and hair pigmentation, hair thickness, red hair, earwax type, bitter taste, ACTN3) with strand-aware calling | `packages/kb` |
| Ancestry | Supervised admixture by EM maximum likelihood against a reference panel, with block-bootstrap intervals; panel builder that pulls 1000 Genomes frequencies from Ensembl for SNPs on the user's own chip | `packages/core/src/admixture`, `packages/fetch` |
| Haplogroups | Tree-walking caller for Y and mtDNA with loaders for ISOGG SNP-index CSVs and simple tab-separated trees; reports coverage, never a bare label | `packages/core/src/haplogroup` |
| Reports | Every result becomes a `Fact` with id, evidence, source and confidence | `packages/core/src/report` |
| Narration | Claude writes a structured explanation in which every paragraph cites fact ids; citations are verified mechanically and unverifiable paragraphs are rejected | `packages/ai` |
| Web app | Single-page, fully client-side app covering all of the above | `apps/web` |
| CLI | `lineage inspect | traits | compare | segments | gedcom | panel | admixture | haplogroup | report | narrate` | `packages/cli` |

## Accuracy policy

1. **Nothing from memory.** Allele orientation, positions (GRCh37 and GRCh38) and population frequencies for every knowledge-base variant were retrieved from Ensembl REST and stored in `data/kb/ensembl-verified-2026-09-24.json`. The Shared cM Project v4 table was extracted from DNA Painter's published tool and stored in `data/sharedcm/sharedcm_v4.json`. Every PubMed ID was checked against NCBI; three recalled IDs turned out to be wrong and were corrected before inclusion.
2. **Scope is explicit.** The trait knowledge base admits only benign, visible or dietary characteristics with a primary paper. Disease, carrier and pharmacogenetic variants are out of scope by design.
3. **Ranges are ranges.** Relationship predictions list every relationship whose observed cM range contains the total, and say that ranges overlap. No probabilities are invented.
4. **Missing inputs are named, not guessed.** Without a genetic map, lengths are in Mb and the report says so. Without a haplogroup tree, there is no haplogroup call.
5. **The narrator cannot add facts.** The AI layer only receives the report's facts and must cite them by id; the code verifies every citation.
6. **Limitations travel with results.** Reports carry a limitations list that grows as sections are added (chip coverage, genotyping error, polygenic traits, panel coverage).

## Quick start

```bash
cd lineage
npm install
npm run build
npm test                      # 47 tests: parsers, synthetic families, relationship math, admixture recovery, haplogroup walks

# Command line, on the synthetic samples
node packages/cli/dist/index.js inspect  data/samples/tester.txt
node packages/cli/dist/index.js traits   data/samples/tester.txt
node packages/cli/dist/index.js compare  data/samples/mother.txt data/samples/tester.txt
node packages/cli/dist/index.js segments data/samples/segments.csv
node packages/cli/dist/index.js gedcom   data/samples/family.ged --rel @I5@ @I9@
node packages/cli/dist/index.js report   data/samples/tester.txt --gedcom data/samples/family.ged --rel @I5@ @I9@ --segments data/samples/segments.csv --out report.json

# Ancestry from public data (network: Ensembl REST, rsIDs only)
node packages/cli/dist/index.js panel     your-kit.txt --out panel.json
node packages/cli/dist/index.js admixture your-kit.txt --panel panel.json

# Grounded narration (needs ANTHROPIC_API_KEY or `ant auth login`)
node packages/cli/dist/index.js narrate report.json --md report.md

# Web app
npm run web                   # http://localhost:5173
```

## Library use

```ts
import { parseRawKit, compareKits, callTraits, parseGedcom, findRelationship } from "@lineage/core";
import { TRAITS } from "@lineage/kb";

const { kit } = parseRawKit(await file.text());
const traits = callTraits(kit, TRAITS);
const shared = compareKits(kit, otherKit, { map });        // map optional
const tree = parseGedcom(gedcomText);
const rel = findRelationship(tree, "@I5@", "@I9@");        // -> "first cousin", r = 0.125, expected 25%
```

## Data sources and licences

- **Shared cM Project v4**, Blaine T. Bettinger (2020), as published in the DNA Painter Shared cM Tool, CC BY 4.0. https://dnapainter.com/tools/sharedcmv4
- **Ensembl REST** for variant mappings and **1000 Genomes Project phase 3** super-population frequencies. https://rest.ensembl.org
- **PubMed** for citation verification. Trait papers are cited in `packages/kb/src/traits.ts`.
- **ISOGG Y-DNA SNP index** and **PhyloTree** are not bundled; load them from files under their own terms.
- Genetic maps (HapMap / 1000 Genomes) are not bundled; the comparison tools accept the standard four-column text format.

## Sample data

`data/samples` holds a synthetic family (tester, sibling, mother, first cousin, unrelated person), a matching GEDCOM and a segment export. They are generated by `data/samples/make-samples.ts` from a seeded PRNG with Mendelian transmission and recombination. The 15 real knowledge-base markers are included with genotypes drawn from 1000 Genomes European frequencies so the trait demo works. No person in the samples exists. The samples are deliberately sparse (about 6,000 SNPs) to keep the repository small; the comparison thresholds adapt to density.

## Roadmap

- Bundle a permissively licensed genetic map so cM is available out of the box.
- Finer ancestry panels (1000 Genomes 26 populations, HGDP) with the same supervised model, and an unsupervised mode.
- Phased IBD detection for better segment boundaries and half-versus-full sibling discrimination.
- mtDNA calling against PhyloTree with a first-class loader, and Y calling against YFull's tree export.
- A public, opt-in research database where people contribute anonymised results; the fact-and-source model above is what makes such a database worth trusting.

## Layout

```
lineage/
  packages/core    engine (no dependencies)
  packages/kb      curated trait knowledge base with verified data
  packages/fetch   Ensembl and PubMed clients, reference panel builder
  packages/ai      grounded narration with Claude
  packages/cli     command line
  apps/web         client-side web app (Vite)
  data/            verified source data and synthetic samples
```

MIT licensed. Not a medical device; nothing here is medical advice.
