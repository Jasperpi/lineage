# Ancestry that Knows What It Doesn't Know

Lineage's ancestry figures were built on the 26 populations of 1000 Genomes phase 3 and five continental components. That leaves out most of the world between Europe and South Asia. There is no Middle Eastern, North African, Jewish, Central Asian, Siberian or Oceanian reference, and the "Indigenous American" component was learned from admixed Latin American genomes, half of it from Peruvians. A person whose ancestry is mostly Ashkenazi Jewish gets numbers that describe the nearest populations the panel does have, and nothing on the page says the fit is poor. The statistics also claim more than they know. Reference frequencies from 61–113 genomes are treated as exact, a single miscalled genotype can cost six log units, the 95% intervals come from 2 draws in each tail of 60, and the validation tested the model on genomes it had learned from. This report sets out the open data and published methods that fix both problems, and the rules Lineage adopts. The sources are in `../research_notes/Ancestry robustness/`.

## The data exists, and most of it is CC0

**The gnomAD HGDP+1KG callset** (Koenig et al. 2024) re-sequenced and jointly called the 1000 Genomes and HGDP samples: 4,094 genomes after QC, 3,400 unrelated, in 78 populations, phased with SHAPEIT5 and released under CC0. It adds what 1000 Genomes lacks. The Middle East comes in as Bedouin 46, Palestinian 46, Druze 42 and Mozabite 28. Oceania adds 30 genomes, and nine Central and South Asian populations join. There are 61 unadmixed Indigenous Americans (Karitiana, Surui, Maya, Pima, Colombian), enough to fit that component directly instead of extracting it from admixed samples. Lineage replaces 1000 Genomes phase 3 with it. Only the rows at the panel's positions are read, one chromosome at a time.

**Ashkenazi Jewish ancestry** has exactly one large open source: gnomAD's `asj` group, 1,736 genomes, available only as allele frequencies, under CC0. That is enough for everything Lineage computes from frequencies (similarity, components, the painter's emissions), because none of them needs individual genotypes. It cannot place Ashkenazi genomes on the PCA, and it cannot be validated by simulating from real Ashkenazi genomes. The signal is real: 23andMe's own cross-validation separates Ashkenazi ancestry at 99.3% precision. But 23andMe needed 1,007 reference genomes to do it, none of them public. Lineage therefore describes it as similarity to a reference group, and tests it in two ways. It should detect the 8 Ashkenazi genomes in the AADR, and it should not fire on anyone else.

**The AADR's present-day Human Origins samples** (v66.p1, CC0) include ten Jewish groups, the Levant, Arabia, North Africa, the Caucasus, Iran and much of Europe, genotyped on a different array from a different study. That makes them the best available test of how Lineage behaves on people outside its training data. They are used as test genomes, not reference frequencies. Only the CC0 Dataverse release is read: 478 of the original Human Origins samples were released under a signed letter that forbids redistribution, and the curators have withdrawn samples released in error before.

**What stays out.**
- The Estonian Biocentre's Jewish dataset (Behar 2010; 18 Ashkenazi, 19 Sephardi and most Mizrahi groups at 556k SNPs) is the best open Jewish genotype set at chip density, but its only terms are "please cite", which is not permission to redistribute derived tables.
- SGDP has one to three genomes per West Eurasian group.
- POPRES is controlled access.

**No open panel can split north-west Europe by country.** AncestryDNA, with 185,063 reference samples, reports its own single-origin precision for the Netherlands at 42.6%, north-west Germany 36.5% and France 34.1%. Lineage will say "North-western European" and cite those numbers.

## The statistics Lineage adopts

**Reference frequencies carry their sample size.** A population's frequency at a SNP is an estimate from x copies in 2n. With a Beta(½, ½) prior (the 1/k prior usually attributed to Rannala & Mountain 1997) the frequency's posterior is Beta(a, b) with a = x + ½, b = 2n − x + ½, s = a + b. The chance that a new member of the population carries each genotype, averaged over that uncertainty, is:

- P(2 copies) = a(a+1) / (s(s+1))
- P(1 copy) = 2ab / (s(s+1))
- P(0 copies) = b(b+1) / (s(s+1))

The three sum to one because (a+b)² + (a+b) = s(s+1). The formulas replace the frequency clamp, which treated a population of 61 and one of 1,736 alike. fastNGSadmix (Jørsboe 2017) makes the same correction for small reference panels, and Toyama et al. (2020) show why it matters when reference sizes are unbalanced. The panel stores allele counts and each population's n instead of rounded frequencies.

**Calls can be wrong.** Each allele is taken to be misread with probability e, so an allele-frequency f is observed as e + (1 − 2e)f. The model is linear in f, so the admixture EM keeps its form. At e = 0.001 a homozygous call against a frequency near zero no longer dominates a genome's likelihood.

**Similarity becomes a probability and a set.** Log-likelihoods summed over SNPs that are still in some linkage are too confident. Lineage divides them by a temperature c fitted on held-out reference genomes, so that the softmax probabilities are calibrated. It then reports a **95% conformal set** of populations: split conformal prediction on held-out genomes, with non-conformity 1 − π(true population), guarantees that the set contains the true population 95% of the time for genomes like the reference. The page says "closest to one of GBR, CEU" rather than naming one population when the data cannot choose.

**Intervals are resampled at the scale of ancestry.** Bootstrap blocks become 5 cM on the bundled genetic map, instead of 50 SNPs (about 1.7 cM, shorter than admixture tracts, so anti-conservative). Each replicate also redraws every component frequency from its Beta posterior, so reference uncertainty reaches the interval. Coverage is then measured on simulated admixed genomes. If held-out coverage falls short of 95%, the intervals are widened by the fitted factor, and the measured coverage is shown beside them. AncestryDNA runs the same check on its ranges.

**"Present" is a test, not a threshold.** A component counts as present only if its estimate exceeds the level that held-out genomes with none of that ancestry reach 1% of the time, measured for each component and each chip. Components the fit reports in genomes that lack them are the classic artefact of errors in the reference frequencies (Alexander et al. 2009), so the level is measured, not assumed.

**Detail is earned.** Regions are estimated in one fit, then added up a tree (region, continent). This follows 23andMe's rule of assigning at the lowest node whose support clears a precision threshold. A region is shown only if it passes the presence test and its held-out precision at that share is at least 90%; otherwise its share is reported as "Broadly" its continent. The regions themselves are chosen by the same test: a region that cannot reach 90% single-origin precision is merged into its parent before release.

**Painting stays unphased.** No phaser runs in a browser, a haplotype panel would be at least 54 MB, and phase-free local ancestry is more accurate than phase-based on realistically phased data (Avadhanam & Williams 2025). What changes:
- The number of generations since admixture is chosen per genome by likelihood over 1–32.
- Emissions include the error term.
- Window posteriors pass through an isotonic calibration curve fitted on held-out simulations (Gnomix's recipe), so a window shown at 95% is right about 95% of the time.

**PCA projection uses the published shrinkage.** A new genome projected on loadings learned from n samples lands closer to the origin than the samples did. Lee, Zou & Wright (2010) give the factor in closed form. With γ = SNPs/samples, recover the population eigenvalue λ from the sample eigenvalue by solving λ̂ = λ + γλ/(λ − 1); the shrinkage is then (λ − 1)/(λ + γ − 1). On the current panel (γ = 34.2) it gives 0.994 for PC1, 0.777 for PC5 and 0.731 for PC6, against the pipeline's five-fold hold-out measurements of 0.992, 0.776 and 0.721. OADP (Zhang, Dey & Lee 2020) builds on the same result. The closed form replaces the measured scalars; the hold-out remains as its check.

**The page says when the reference does not fit.** Under the fitted proportions every SNP has a known distribution of genotypes, so the log-likelihood of a genome has an expected value and a variance. A genome whose observed likelihood falls far below its expectation (beyond the level that 1% of held-out genomes reach, after an LD inflation factor measured in validation) is not well described by the reference populations. The page says so, and shows which stretches of the genome are responsible. Leaving populations out of the reference tests it: their genomes should trip the check.

## Validation that does not flatter

The model is fitted on 80% of each reference population. Everything is measured on the held-out 20%, on admixed genomes simulated from their phased haplotypes, and on the AADR's test genomes.

**Simulations.**
- Recent mixtures: four grandparents from different populations, so shares of 25, 12.5 and 6.25% are tested.
- Old admixture: 5–15 generations, with minor shares of 1–10%.
- Three-way mixtures.
- Genomes from populations removed from the reference.

**Chip conditions.** Each genome is masked to the SNPs of the GSA and OmniExpress chips, with 0.1–0.5% genotype error and 1–3% no-calls.

**Metrics.**
- Error on components that are truly present, reported separately from false positives on those that are not.
- Interval coverage by share.
- Single-origin precision and recall for every node of the tree.
- Conformal-set coverage.
- A reliability diagram for the painter.
- The false-alarm rate and power of the fit check.

Every figure is compared with the same harness run on the previous model, and a release fails if any gets worse.

## What Lineage will not do

- **Country-level splits of north-west Europe.** The largest vendor reports 35–43% precision.
- **Phasing, a haplotype panel, or fine-scale haplotype painting.** There is no open donor panel, and the data would dwarf the app.
- **A "Genetic Communities" analogue.** It needs hundreds of thousands of genotyped customers and millions of family-tree records.
- **Ancestry labels from panels whose terms forbid redistribution**, however good the data.
