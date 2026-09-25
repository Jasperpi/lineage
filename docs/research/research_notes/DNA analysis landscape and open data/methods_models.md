# Published statistical methods for browser-based consumer DNA analysis (relationship, ancestry, ancient ancestry, pigmentation, faces, ROH)

Scope note: every model below is given with its primary citation (PMID/DOI where
obtained) and, where I could read the primary text, the actual equations and
parameter values. Items I could not verify inside the tool budget are listed
under **Gaps** rather than guessed at. Two source-quality warnings apply
throughout: (a) several fetches returned summaries produced by a small
extraction model — where I could not read the primary text directly I say so;
(b) the session's web-search budget was exhausted partway through, so some
sub-questions (GEDmatch thresholds, Parabon-specific peer-reviewed criticism,
Shared cM Project licence) are unresolved.

## Q1. Relationship inference from shared segments (ERSA, ped-sim, AncestryDNA, Shared cM Project v4, WATO, segment count / longest segment, the X)

### Takeaway
ERSA gives a complete, implementable likelihood-ratio model over segment
*count* and *length* that a browser app can implement exactly; the Shared cM
Project v4 is an empirical range table (means, SDs, min/max, N) with a
documented but crude outlier rule and no published licence; DNA Painter's
probabilities are *not* from the Shared cM Project but from digitising
AncestryDNA's simulation figure. Segment count, longest segment and the X are
each informative for separating the second-degree relationships, and ped-sim
quantifies the maternal/paternal half-sibling split (51.9 vs 37.1 segments).

### Cited Findings — ERSA (Huff et al. 2011)

- ERSA: Huff CD, Witherspoon DJ, Simonson TS, Xing J, Watkins WS, Zhang Y, Tuohy TM, Neklason DW, Burt RW, Guthery SL, Woodward SR, Jorde LB. "Maximum-likelihood estimation of recent shared ancestry (ERSA)." *Genome Research* 21(5):768–774, 2011. PMID 21324875, doi 10.1101/gr.115972.110 — [PubMed](https://pubmed.ncbi.nlm.nih.gov/21324875/), full text PDF read from [Jorde lab copy](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Null hypothesis** (the pair is no more related than two random people from the population). With `s` the set of shared segments longer than threshold `t` and `n = |s|`:
  `L_P(n, s | t) = N_P(n | t) · S_P(s | t)`, where `S_P(s|t) = Π_{i∈s} F_P(i|t)`.
  `N_P(n|t)` is Poisson with mean equal to the **sample mean number of segments shared in the reference population**. Assumes segment count and segment length are independent (approximately true for HapMap CEU). — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Population length distribution**: truncated exponential,
  `F_P(i|t) = e^{-(i-t)/θ} / θ`, where θ = mean shared segment length in the population over segments with length > t and < h. For HapMap CEU with t = 2.5 cM and h = 10 cM, **θ̂ = 3.12 cM**. Segments longer than h = 10 cM are excluded when estimating θ because they violate random mating and are themselves evidence of recent ancestry. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Choice of t**: "set t to the smallest value that can achieve a false-negative rate of 1% or lower." t = 2.5 cM was chosen from GERMLINE's reported 1% false-negative rate for segments ≥ 2.5 cM (Gusev et al. 2009). — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Alternative hypothesis**. `a` = number of shared recent ancestors (1 or 2); `d` = combined number of meioses separating the pair from the ancestor(s) (e.g. d = 6, a = 1 for half-second cousins). Segments partition into recent-ancestry (A) and background (P) subsets:
  `L_R = L_A(n_A, s_A | d, a, t) · L_P(n_P, s_P | t)`, with `n_A + n_P = n`;
  `L_A = N_A(n|d,a,t) · S_A(s_A|d,t)`, `S_A = Π_{i∈s_A} F_A(i|d,t)`. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Segment-count model** (after Thomas et al. 1994): probability of inheriting any particular segment through a d-meiosis path = `1/2^(d-1)`; expected number of candidate shared autosomal segments = `r·d + c` with `c = 22` autosomes and `r ≈ 35.3` recombinations per haploid genome per generation (McVean et al. 2004). Expected number of shared segments = `a(rd + c) / 2^(d-1)`. Truncating at t:
  `N_A(n | d, a, t) = Poisson with mean  λ = a(rd + c)·p(t) / 2^(d-1)`, where `p(t) = e^{-dt/100}`. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Segment-length model**: unconditionally exponential with mean `100/d` cM; conditioned on t,
  `F_A(i | d, t) = e^{-d(i-t)/100} / (100/d)`. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Maximising over the partition**: the likelihood is maximised when the `n_A` segments assigned to recent ancestry are the **longest** `n_A` segments in `s`; the rest go to background. This holds as long as `θ < a(rd + c)`, true whenever the hypothesised ancestry is recent relative to random pairs. Implementation: sort segments descending, evaluate all `n_P ∈ {0,…,n}`, take the maximum. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Test statistic**: `−2 ln(L_R / L_N) ~ χ²` with **2 degrees of freedom**. Although the alternative adds three parameters (d, a, n_A), the authors found empirically that d and a "effectively act as a single parameter." Confidence intervals come from the same χ² approximation. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Accuracy**: exact degree predicted for **66%** of 549 pairs of 1st–5th-degree relatives; within one degree for **97%** of them. Within one degree for >80% of 6th- and 7th-degree and 60% of 8th-degree pairs; accuracy falls off rapidly beyond that. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Power** at α = 0.001: ~100% for 1st–5th degree (all 549 pairs detected), 88% of 7th-degree, 44% of 9th-degree, 12% of 11th-degree. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **False-positive rate**: estimated from CHB–JPT HapMap pairs, 0.0005 (95% CI 1.3×10⁻⁵ to 0.0028) at nominal α = 0.001 — i.e. approximately nominal. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Inputs**: Affymetrix 6.0 arrays (868,155 autosomal SNPs, 18,610 excluded); Beagle 3.2 phasing/imputation against 30 HapMap CEU trios; GERMLINE 1.4.1 with `err_het = 2`, `err_hom = 1`, `min_m = 1 cM`, marker positions on the HapMap r22 genetic map. Runtime 14,196 pairs in ~9 min on one 2.3 GHz Opteron core. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- ERSA was later extended to whole-genome sequence data: Li H et al., *PLOS Genetics* 10(1):e1004144, "Relationship Estimation from Whole-Genome Sequence Data" — [PLOS Genetics](https://journals.plos.org/plosgenetics/article/info:doi/10.1371/journal.pgen.1004144)

### Cited Findings — ped-sim (Caballero et al. 2019)

- Caballero M, Seidman DN, Qiao Y, Sannerud J, Dyer TD, Lehman DM, Curran JE, Duggirala R, Blangero J, Carmi S, Williams AL. "Crossover interference and sex-specific genetic maps shape identical by descent sharing in close relatives." *PLOS Genetics* 15(12):e1007979, 2019. doi 10.1371/journal.pgen.1007979 — [PLOS Genetics](https://journals.plos.org/plosgenetics/article?id=10.1371%2Fjournal.pgen.1007979); code at [github.com/williamslab/ped-sim](https://github.com/williamslab/ped-sim/blob/master/README.md)
- **Crossover model**: Housworth–Stahl two-pathway. Regulated crossovers have gamma-distributed inter-chiasma distances with shape ν and rate 2ν(1−p); unregulated crossovers arrive as a Poisson process with rate p per Morgan; each chiasma becomes a crossover with probability 1/2 (thinning). Sex-specific parameters ν_f, ν_m, p_f, p_m were inferred from **over 18,000 meioses**; sex-averaged values use p_a = (p_f + p_m)/2 with ν_a chosen to match variance. — [PLOS Genetics](https://journals.plos.org/plosgenetics/article?id=10.1371%2Fjournal.pgen.1007979)
- **Genetic maps**: sex-specific and sex-averaged maps built from crossovers in over 100,000 meioses (Bherer et al.), spanning identical physical ranges on all 22 autosomes. — [PLOS Genetics](https://journals.plos.org/plosgenetics/article?id=10.1371%2Fjournal.pgen.1007979)
- **Effect sizes**: modelling crossover interference **decreases** the standard deviation of pairwise IBD proportions by **10.4% on average** across full siblings through second cousins; using sex-specific rather than sex-averaged maps **increases** that standard deviation by **4.2% on average**, and changes the number of segments relatives share. — [bioRxiv](https://www.biorxiv.org/content/10.1101/527655v2), [PMC6944377](https://pmc.ncbi.nlm.nih.gov/articles/PMC6944377/)
- **Half-siblings are bimodal in segment count**: maternal half-siblings share on average **1.4×** as many IBD segments as paternal half-siblings — mean segment numbers **51.9** (maternal) vs **37.1** (paternal). This makes it possible to infer whether real half-sibling and grandparent–grandchild pairs are maternally or paternally related. Mean IBD proportion stays ~0.50 for full sibs (IBD2 mean 0.25) regardless of model. — [PMC6944377](https://pmc.ncbi.nlm.nih.gov/articles/PMC6944377/)
- The sex-specific + interference model (SS+intf) fit the real SAMAFS and Hemani20k data best across multiple statistics. — [PMC6944377](https://pmc.ncbi.nlm.nih.gov/articles/PMC6944377/)

### Cited Findings — AncestryDNA matching white paper (2020)

- AncestryDNA Matching White Paper, 15 July 2020 — [PDF](https://www.ancestrycdn.com/support/us/2020/07/2020whitepaper.pdf) (read directly); a 10 January 2025 revision also exists — [PDF](https://www.ancestrycdn.com/support/us/2025/01/2025matchingwhitepaper.pdf)
- **Phasing**: "Underdog", a modified BEAGLE haplotype-cluster HMM. Phasing windows are 500 SNPs; the model is built recursively by splitting nodes on each SNP, then merging clusters with similar downstream haplotype distributions. Unlike BEAGLE, Underdog allows haplotypes absent from the training set. — [2020 white paper](https://www.ancestrycdn.com/support/us/2020/07/2020whitepaper.pdf)
- **IBD detection** (their GERMLINE implementation), five steps: (1) split each chromosome into windows of **exactly 96 SNPs**; (2) call a "seed match" where one phased haplotype of each individual matches the other's exactly across the whole window; (3) extend each seed in both directions until the chromosome end or a **homozygous mismatch** (a genotype pair incompatible under any phasing, e.g. AA vs GG); (4) convert to cM; (5) **retain the segment only if it is longer than 8 cM**, unless it is dismissed as IBS by Timber. — [2020 white paper](https://www.ancestrycdn.com/support/us/2020/07/2020whitepaper.pdf)
- **Timber** (pile-up / excess-IBD downweighting): take a reference set R of **over 300,000 genotype samples**; use the same 96-SNP windows; for each sample i, count per window the number of GERMLINE matches between i and members of R; use these counts to downweight IBD overlapping regions with anomalously high matching, producing adjusted lengths called **"Timber scores"**. — [2020 white paper](https://www.ancestrycdn.com/support/us/2020/07/2020whitepaper.pdf)
- **Relationship estimation is simulation-based, not ERSA-style.** They simulate reproductive events from a subset of 24,362 customer genotypes filtered to pairs sharing **< 20 cM** IBD; simulated pairs share exactly two ancestors or none. The resulting conditional distributions of total IBD given the number of separating meioses (their Figure 5.2, plotted on a log scale and showing only IBD > 40 cM, for < 10 meioses) give maximum-probability intervals. Because curves overlap, they report a **range** of relationships for distant matches, and they re-examine pairs separated by ≤ 3 meioses with an extra step to catch phasing-error-driven mistakes. — [2020 white paper](https://www.ancestrycdn.com/support/us/2020/07/2020whitepaper.pdf)
- AncestryDNA does not compare segment locations between customers, only total IBD length. — [ISOGG wiki summary via search](https://isogg.org/wiki/Identical_by_descent/en)

### Cited Findings — Shared cM Project v4 and DNA Painter

- Bettinger BT. *The Shared cM Project Version 4.0* (March 2020) — [PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf) (read directly). Prior methods paper: Bettinger, "The Shared cM Project: A Demonstration of the Power of Citizen Science," *Journal of Genetic Genealogy* (2016) 38–42.
- **Derivation**: Google Form collecting Known Relationship, Total Shared cM, Number of Shared Segments, Endogamy/Cousin-Marriage flag, Source (23andMe / AncestryDNA / FTDNA / MyHeritage / GEDmatch / Other); optional Longest Block. **59,714 submissions** between 4 March 2015 and 8 July 2019. Curation removed 1,739 (2.9%) indecipherable or self-contradictory entries → 57,975; **55,418** were used across **48 relationships** (N from 33 for 5C3R to 5,281 for 2C1R). — [SCMP v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- **Outlier removal**: obvious errors removed per relationship, then a flat **1% trim — 0.5% from each tail**. Min/average/max are the post-trim extremes; SD "was calculated using Excel". Where the minimum is 0 cM, averages are computed only over submissions > 0 cM (i.e. they are averages *conditional on detectable sharing*). — [SCMP v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- **Acknowledged data problems**: data-entry errors, misattributed parentage and misunderstood "removed" relationships, undeclared endogamy/pedigree collapse, and differing company matching thresholds (which bias the distant-relationship tails). — [SCMP v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- **Relationship chart (N, Min, Average, Max, SD, Expected cM)**, verbatim from pages 52–53 — [SCMP v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf):

  | Grp | Relationship | N | Min | Avg | Max | SD | Expected |
  |---|---|---|---|---|---|---|---|
  | – | Parent/Child | 2412 | 2376 | 3485 | 3720 | 115 | varies |
  | 1 | Sibling | 2465 | 1613 | 2613 | 3488 | 203 | 2550 |
  | 2 | Aunt/Uncle–Niece/Nephew | 2695 | 1201 | 1741 | 2282 | 180 | 1700 |
  | 2 | Grandparent/Grandchild | 1106 | 984 | 1754 | 2462 | 236 | 1700 |
  | 2 | Half Sibling | 1266 | 1160 | 1759 | 2436 | 207 | 1700 |
  | 3 | 1C | 3337 | 396 | 866 | 1397 | 161 | 850 |
  | 3 | Great-Aunt/Uncle–Niece/Nephew | 833 | 330 | 850 | 1467 | 118 | 850 |
  | 3 | Great-Grandparent/Great-Grandchild | 149 | 485 | 887 | 1486 | 181 | 850 |
  | 3 | Half Aunt/Uncle–Niece/Nephew | 815 | 492 | 871 | 1315 | 165 | 850 |
  | 4 | 1C1R | 3700 | 102 | 433 | 980 | 123 | 425 |
  | 4 | Great-Great-Aunt/Uncle–Niece/Nephew | 137 | 186 | 420 | 713 | 121 | 425 |
  | 4 | Half 1C | 691 | 156 | 449 | 979 | 134 | 425 |
  | 4 | Half Great-Aunt/Uncle–Niece/Nephew | 238 | 184 | 431 | 668 | 105 | 425 |
  | 5 | 1C2R | 1187 | 33 | 221 | 471 | 83 | 213 |
  | 5 | 2C | 4172 | 41 | 229 | 592 | 86 | 213 |
  | 5 | Half 1C1R | 605 | 62 | 224 | 469 | 80 | 213 |
  | 5 | Half Great-Great-Aunt/Uncle | 34 | 103 | 208 | 284 | 43 | 213 |
  | 6 | 1C3R | 202 | 25 | 117 | 238 | 48 | 106 |
  | 6 | 2C1R | 5281 | 14 | 122 | 353 | 59 | 106 |
  | 6 | Half 1C2R | 165 | 16 | 125 | 269 | 54 | 106 |
  | 6 | Half 2C | 512 | 10 | 120 | 325 | 62 | 106 |
  | 7 | 2C2R | 1404 | 0 | 71 | 244 | 42 | 53 |
  | 7 | 3C | 4775 | 0 | 73 | 234 | 43 | 53 |
  | 7 | Half 1C3R | 33 | 0 | 60 | 120 | 32 | 53 |
  | 7 | Half 2C1R | 474 | 0 | 66 | 190 | 39 | 53 |
  | 8 | 2C3R | 163 | 0 | 51 | 154 | 32 | 27 |
  | 8 | 3C1R | 4514 | 0 | 48 | 192 | 32 | 27 |
  | 8 | Half 2C2R | 98 | 0 | 48 | 144 | 32 | 27 |
  | 8 | Half 3C | 302 | 0 | 48 | 168 | 33 | 27 |
  | 9 | 3C2R | 965 | 0 | 36 | 166 | 27 | 13 |
  | 9 | 4C | 2752 | 0 | 35 | 139 | 23 | 13 |
  | 9 | Half 3C1R | 249 | 0 | 37 | 139 | 24 | 13 |
  | 10 | 3C3R | 106 | 0 | 27 | 98 | 19 | 7 |
  | 10 | 4C1R | 2383 | 0 | 28 | 126 | 20 | 7 |
  | 10 | Half 3C2R | 55 | 0 | 27 | 78 | 15 | 7 |
  | 10 | Half 4C | 89 | 0 | 30 | 74 | 18 | 7 |
  | n/a | 4C2R | 603 | 0 | 22 | 93 | 16 | 3.3 |
  | n/a | 5C | 1130 | 0 | 25 | 117 | 18 | 3.3 |
  | n/a | 4C3R | 89 | 0 | 19 | 60 | 12 | 1.7 |
  | n/a | 5C1R | 975 | 0 | 21 | 80 | 15 | 1.7 |
  | n/a | 5C2R | 242 | 0 | 18 | 65 | 12 | 0.8 |
  | n/a | 6C | 441 | 0 | 18 | 71 | 13 | 0.8 |
  | n/a | 5C3R | 34 | 0 | 13 | 30 | 7 | 0.4 |
  | n/a | 6C1R | 441 | 0 | 15 | 56 | 9 | 0.4 |
  | n/a | 6C2R | 161 | 0 | 13 | 45 | 8 | 0.2 |
  | n/a | 7C | 258 | 0 | 14 | 57 | 9 | 0.2 |
  | n/a | 7C1R | 330 | 0 | 12 | 50 | 7 | 0.1 |
  | n/a | 8C | 239 | 0 | 11 | 42 | 5 | 0.05 |

- **Meiosis Groupings** (relationships pooled by separating meioses), with pooled N/min/avg/max/SD: #1 (2 meioses; full sibs) N 2465, 1613 / 2613 / 3488, SD 204; #2 (3 meioses; half sib, aunt/uncle, grandparent) N 5067, 984 / 1749 / 2461, SD 201; #3 N 5134, 330 / 865 / 1486, SD 165; #4 N 4766, 102 / 435 / 980, SD 124; #5 N 5998, 33 / 227 / 592, SD 85; #6 N 6160, 0 / 122 / 353, SD 59; #7 SD 43; #8 SD 32; #9 SD 24; #10 SD 19. Minimums for groupings 6–10 were set to 0 cM by hand. — [SCMP v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- **Segment count is collected but not published as a distribution.** "Number of Shared Segments" is a required submission field, but the v4 document's relationship chart reports only total cM statistics; the histograms are of total cM. — [SCMP v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- **DNA Painter's probabilities do not come from the Shared cM Project data.** The Shared cM Tool v4's relationship probabilities were derived by digitising **Figure 5.2 of AncestryDNA's matching white paper** (Ancestry's *simulations*) with an online plot digitizer, work done with Leah Larkin. The tool then presents relationships grouped by likelihood, most likely first. — [DNA Painter blog](https://dnapainter.com/blog/introducing-the-updated-shared-cm-tool/); tool at [dnapainter.com/tools/sharedcmv4](https://dnapainter.com/tools/sharedcmv4)
- The two data sources are explicitly distinguished by practitioners: the percentages at the top of the Shared cM Tool page are theoretical, while the Shared cM Project numbers are empirical. — [DNAsleuth](https://dnasleuth.wordpress.com/2021/09/01/shared-cm-tool-revisited/); see also [The Legal Genealogist on v4](https://www.legalgenealogist.com/2020/03/29/a-lesson-in-numbers/) and [DNAeXplained](https://dna-explained.com/2020/03/27/the-shared-cm-project-version-4-released/)

### Cited Findings — segment count as information, and the X chromosome

- A dedicated information-theoretic study of segment counts exists: "Evaluating the utility of identity-by-descent segment numbers for relatedness inference via information theory and classification," *G3* 12(6):jkac072 — [G3](https://academic.oup.com/g3journal/article/12/6/jkac072/6554999). (I did not read the full text; treat its specific numbers as unverified here.)
- **X chromosome**: Buffalo V, Mount SM, Coop G. "A Genealogical Look at Shared Ancestry on the X Chromosome." *Genetics* 204(1):57–75, 2016. PMID 27356612, PMCID PMC5012405, doi 10.1534/genetics.116.190041 — [Europe PMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=TITLE%3A%22Genealogical%20Look%20at%20Shared%20Ancestry%20on%20the%20X%20Chromosome%22&format=json&resultType=core&pageSize=2). They derive probability distributions for the **number and length of X segments shared IBD** with an ancestor k generations back, and for half- and full-cousin relationships. Because X homologous recombination occurs **only in females** (outside the PARs), "the number of females along a genealogical lineage is a key quantity." Their distributions marginalise over the unknown number of recombinational meioses, and Bayes' theorem inverts them to **estimate the number of female ancestors between two relatives** — information not available from autosomes alone.

### Inferences

- ERSA is directly implementable in TypeScript today *except* that it needs segment lengths in cM. Lineage currently measures in Mb with no genetic map; every quantity in the ERSA model (t = 2.5, θ = 3.12, mean 100/d, p(t) = e^{−dt/100}, r = 35.3) is in Morgans/cM, so bundling a genetic map (e.g. HapMap II or the Bherer sex-specific maps used by ped-sim) is a prerequisite, not an optimisation.
- The Shared cM Project's "Average" for distant relationships is conditional on non-zero sharing, and its Min/Max are 0.5%-trimmed empirical extremes, not quantiles of a fitted distribution. Presenting "the observed range contains this total" is therefore the *correct* conservative use of it; converting those min/max values into probabilities without a model would misrepresent them. Lineage's existing policy matches the data.
- Because DNA Painter's probabilities trace to AncestryDNA's simulation figure rather than to the SCMP tables, a defensible browser implementation of probabilities has two honest routes: (a) implement ERSA's likelihood directly, or (b) run ped-sim-style simulation offline against a bundled sex-specific map and ship the resulting conditional distributions. Route (b) reproduces what AncestryDNA did, and ped-sim is open source.
- Segment count separates the second-degree relationships in a way total cM cannot: ped-sim's 51.9 vs 37.1 mean segments for maternal vs paternal half-siblings implies a grandparent/half-sibling/avuncular discrimination signal that is *about the sex of the connecting meioses*, not the pedigree shape per se. Combined with the X (Buffalo 2016), a pair's X sharing plus autosomal segment count constrains the number of female links in the path — which is exactly what distinguishes a paternal grandfather from a maternal half-sibling at the same total cM.
- Longest-segment behaviour follows from ERSA's `F_A(i|d,t)`: the longest segment is the maximum of ~Poisson(λ) exponential(mean 100/d) draws, so its expectation grows like (100/d)·(ln λ + γ) + t. For fixed total cM, a pair with fewer, longer segments has smaller d (more recent, fewer meioses) than a pair with many short ones. This is derivable from the verified ERSA equations and needs no extra source.

### Gaps

- **Numeric values of the Housworth–Stahl ν and p parameters per sex in ped-sim** were not extractable from the fetched text (the extraction explicitly said "Specific numerical values are not provided"). An implementer should read Table 1/Methods of the PLOS Genetics paper or `interfere/nu_p_campbell.tsv` in the [ped-sim repo](https://github.com/williamslab/ped-sim).
- **Total genetic map length in cM** for the Bherer male/female/sex-averaged maps was not captured.
- **Licence for the Shared cM Project v4 data**: no licence, copyright or reuse statement appears anywhere in the 56-page PDF (searched for "creative commons", "CC BY", "attribution", "permission", "all rights" — zero hits). The document is published on Bettinger's site with a data-submission form; reuse terms are therefore **unresolved** and should be settled by asking the author before bundling the tables.
- **Published mean/SD of segment *counts* by relationship** from an empirical (non-simulated) source: not found. SCMP collects the field but does not publish its distribution; ped-sim's counts are simulated.
- **WATO's internal probability calculation** (how hypothesis scores are combined across multiple matches) was not obtained beyond the statement that the underlying per-relationship probabilities come from the digitised Ancestry figure.

## Q2. IBD detection from unphased genotypes: IBS-run methods, thresholds, small-segment false positives, and fully-identical regions

### Takeaway
The phase-free, IBS-run approach Lineage already uses has a published,
benchmarked equivalent — IBIS — whose default thresholds (7 cM / 436 markers /
0.004 errors per marker for IBD1; 2 cM / 186 markers / 0.008 for IBD2) are a
defensible starting point. The dominant empirical fact about small segments is
Durand et al.'s trio-validated **>67% false-positive rate for 2–4 cM segments**,
which is why 7–8 cM is the industry floor.

### Cited Findings

- **IBIS**: Seidman DN, Shenoy SA, Kim M, Babu R, Woods IG, Dyer TD, Lehman DM, Curran JE, Duggirala R, Blangero J, Williams AL. "Rapid, Phase-free Detection of Long Identity-by-Descent Segments Enables Effective Relationship Classification." *American Journal of Human Genetics*, 2020. doi 10.1016/j.ajhg.2020.02.012, PMID 32197076 — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0002929720300549) (paywalled to this session; PMID/DOI taken from a [Google Scholar lookup link](https://scholar.google.com/scholar_lookup?doi=10.1016/j.ajhg.2020.02.012&amp=&pmid=32197076) returned in search results — flagged as second-hand).
- **IBIS default parameters** (read from the [official README](https://github.com/williamslab/ibis/blob/master/README.md)):
  - IBD1: minimum length **7 cM** (`-mL` / `-min_l`), minimum **436 markers** (`-mt`), error tolerance **0.004 errors per marker** (`-er` / `-errorRate`).
  - IBD2: minimum length **2 cM** (`-mL2` / `-min_l2`), minimum **186 markers** (`-mt2`), error tolerance **0.008 errors per marker** (`-er2` / `-errorRate2`).
  - Input is PLINK binary; **a genetic map is required** and must be inserted into the `.bim` file; HapMap II is recommended. If genetic positions are absent, IBIS falls back to treating **1 Mb as 1 cM**, and the README marks this "NOT RECOMMENDED".
- **IBIS accuracy and speed**: benchmarked against Refined IBD, GERMLINE and TRUFFLE on 3,000 simulated individuals. IBIS infers **≥7 cM segments at quality comparable to Refined IBD** and classifies first- through third-degree relatives in real Mexican American samples at rates meeting or exceeding the other methods. Speedups of **805–946×** including phasing time (Beagle 5 phasing 4.3 CPU-days + Refined IBD 2.9 h or GERMLINE 1.1 h, vs IBIS 6.8 min, or 7.8 min with IBD2 enabled). — [search summary of the AJHG paper](https://www.sciencedirect.com/science/article/pii/S0002929720300549)
- **Small-segment false positives**: Durand EY, Eriksson N, McLean CY. "Reducing pervasive false-positive identical-by-descent segments detected by large-scale pedigree analysis." *Molecular Biology and Evolution* 31(8), 2014. PMID 24784137, PMCID PMC4104314, doi 10.1093/molbev/msu151 — [Europe PMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=TITLE%3A%22Reducing%20pervasive%20false-positive%20identical-by-descent%20segments%22&format=json&resultType=core&pageSize=2). From 25,432 genotyped Europeans containing **2,952 father–mother–child trios** in the 23andMe data set, GERMLINE showed a **false-positive rate over 67% for 2–4 cM segments**, "in sharp contrast with accuracies reported in simulated data at these sizes." **Nearly all false positives arose from the allowance of haplotype switch errors**, which is itself necessary to retrieve long (>6 cM) segments under imperfect phasing. They introduce **HaploScore**, scoring a segment in proportion to the number of switch errors it contains; at precision 0.8 it gave a **13-fold increase in recall** over length-based filtering. Replicated on 555 Europeans from 1000 Genomes.
- Practitioner summaries of the small-segment literature put roughly half of 6–8 cM segments and essentially all 1 cM segments in the false-positive class; these are secondary sources and the figures should be treated as approximate — [The DNA Geek](https://thednageek.com/the-small-segment-debate-is-over/), [ISOGG "Identical by descent"](https://isogg.org/wiki/Identical_by_descent/en)
- **AncestryDNA's floor is 8 cM** for retaining a segment as a match, applied after phasing and before Timber adjustment (see Q1). — [2020 white paper](https://www.ancestrycdn.com/support/us/2020/07/2020whitepaper.pdf)
- **ERSA's floor is 2.5 cM**, justified by GERMLINE's 1% false-*negative* rate at that length — note that ERSA models the background explicitly, so it can afford a lower threshold than a matching service that reports segments to users. — [Huff 2011 PDF](https://jorde.genetics.utah.edu/pub/Huff_Witherspoon_GenomeRes_2011_ERSA.pdf)
- **Alternatives for unphased/poor-quality data**: TPBWT (templated positional Burrows–Wheeler transform), *Molecular Biology and Evolution* 38(5):2131 — [MBE](https://academic.oup.com/mbe/article/38/5/2131/6045959); clusIBD for unphased poor-quality samples — [PMC12449261](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12449261/); a 2021 review of IBD detection methods — [Frontiers in Genetics 12:722602](https://www.frontiersin.org/journals/genetics/articles/10.3389/fgene.2021.722602/pdf)
- **Fully identical regions (IBD2)**: ped-sim confirms full siblings have mean IBD2 proportion **0.25**. IBIS treats IBD2 as a first-class output with its own thresholds (2 cM / 186 markers), and IBIS's headline claim is that phase-free IBD1+IBD2 "enables effective relationship classification" for first through third degree. — [PMC6944377](https://pmc.ncbi.nlm.nih.gov/articles/PMC6944377/), [IBIS README](https://github.com/williamslab/ibis/blob/master/README.md)

### Inferences

- Lineage's error-tolerant IBS scan is essentially IBIS's algorithm class. Adopting IBIS's published defaults verbatim (7 cM / 436 markers / 0.004 error rate; IBD2 2 cM / 186 / 0.008) gives every threshold a citation, which the accuracy policy requires. Note that 436 markers over 7 cM implies roughly 62 markers per cM — appropriate for the ~600–700k SNP consumer arrays Lineage targets, so the defaults transfer.
- The IBIS README's own warning about the 1 Mb = 1 cM fallback is the clearest published justification for bundling a genetic map: it is the exact substitution Lineage makes today, and the authors of the method mark it as not recommended.
- Durand's finding that switch-error tolerance *causes* the small-segment false positives is important for an unphased scanner: a phase-free IBS scan does not accumulate switch errors, so its failure mode is different (IBS-by-chance runs in low-diversity/high-LD regions rather than phase-flip artefacts). That argues for a pile-up/Timber-style regional downweighting rather than a HaploScore-style switch-error penalty.
- IBD2 is the cleanest single discriminator available to an unphased scanner: full siblings ≈ 25% IBD2, parent–child ≈ 0% IBD2 with ~100% IBD1, and all other second-degree relationships ≈ 0% IBD2. This follows directly from the ped-sim and IBIS material and requires no probability claim.

### Gaps

- **GEDmatch's actual documented thresholds** (default 7 cM / 700 SNPs, mismatch-bunching limits, etc.) could not be verified: isogg.org returned HTTP 403 to this session and the web-search budget was exhausted. Do not state GEDmatch numbers without checking the GEDmatch documentation directly.
- **Published false-positive rates specifically for phase-free IBS-run detectors** (as opposed to GERMLINE-on-phased-data) at each length bin: not located. IBIS's paper reports comparative quality at ≥7 cM but I could not read the per-bin numbers.
- Per-bin false-positive percentages for 4–6 and 6–8 cM from a primary source: only the >67% figure for 2–4 cM is primary-sourced here.

## Q3. Ancestry: supervised EM admixture, PCA projection, nearest-population likelihood, and local ancestry in a browser

### Takeaway
The ADMIXTURE likelihood Lineage already implements is published in closed form
and supervised mode is the *recommended* mode when reference populations are
known and homogeneous; PCA projection of a single genome is only valid with a
correction (least-squares projection, Procrustes/ADP, or shrinkage), and
projecting from an allele-frequency matrix alone is not equivalent to
projecting from genotypes. Local ancestry at continental resolution is
achievable (FLARE r² = 0.993 three-way) but falls apart between closely related
populations (r² = 0.888 FLARE, 0.666 RFMix in a four-way test).

### Cited Findings — supervised admixture (the EM/block-relaxation model)

- Alexander DH, Novembre J, Lange K. "Fast model-based estimation of ancestry in unrelated individuals." *Genome Research* 19(9):1655–1664, 2009. doi 10.1101/gr.094052.109 — [Genome Research](https://genome.cshlp.org/content/19/9/1655.full) (full text behind SSO for this session; model equations read from the authors' own 2011 preprint below).
- Alexander DH, Lange K. "Enhancements to the ADMIXTURE algorithm for individual ancestry estimation." *BMC Bioinformatics* 12:246, 2011 — [author preprint PDF](http://dalexander.github.io/preprints/admixture-enhancements-preprint.pdf) (read directly), [eScholarship](https://escholarship.org/uc/item/25k873h3).
- **The model, verbatim**: genotype `n_ij` for individual i at SNP j is the number of type-"1" alleles. Given K ancestral populations, `n_ij ~ Bin(2, p_ij)` with
  `p_ij = Σ_{k=1..K} q_ik · f_kj`,
  and ADMIXTURE maximises the biconcave log-likelihood
  `L(Q, F) = Σ_{i,j} { n_ij · ln p_ij + (2 − n_ij) · ln(1 − p_ij) }`.
  Q = (q_ik) are ancestry fractions, F = (f_kj) are population allele frequencies (renamed **P** as of v1.20 to match STRUCTURE's notation). Optimisation is **block relaxation**: alternating updates of Q and F, each by sequential quadratic programming, accelerated by a quasi-Newton extrapolation. Typically 3–4 orders of magnitude faster than STRUCTURE. — [Alexander & Lange 2011 preprint](http://dalexander.github.io/preprints/admixture-enhancements-preprint.pdf)
- **Supervised mode**: `--supervised` plus a `.pop` file assigning reference individuals to populations; "it is assumed that all reference samples have 100% ancestry from some ancestral population," and unknown individuals are marked `-`. Fixing those rows of Q reduces the parameter count, shortens run time, and improves accuracy. — [ADMIXTURE manual](https://dalexander.github.io/admixture/admixture-manual.pdf)
- **Measured benefit and the bias it removes**: in their simulation, RMSE in estimating the reference allele-frequency vector f₁ was **0.046 unsupervised vs 0.040 supervised**. Errors in F **inflate F_ST between ancestral populations** (estimated F_ST 0.024 unsupervised vs 0.019 supervised, against a true 0.010), and the flip side is that "individuals will be ascribed a greater degree of admixture than they actually possess" — low-q individuals get upward-biased q̂. — [Alexander & Lange 2011 preprint](http://dalexander.github.io/preprints/admixture-enhancements-preprint.pdf)
- **Explicit caution**: "supervised analysis is only suitable when the reference individuals can be assigned to ancestral populations with certainty and ancestral populations are fairly homogeneous. For exploratory analyses, unsupervised analysis is more appropriate." — [Alexander & Lange 2011 preprint](http://dalexander.github.io/preprints/admixture-enhancements-preprint.pdf)
- **Projection mode**: ADMIXTURE can load learned allele frequencies from a `.P` file and estimate Q for new samples against fixed P — the reference-panel projection workflow. — [ADMIXTURE manual §2.14](https://dalexander.github.io/admixture/admixture-manual.pdf)
- **Choosing K by cross-validation**: v-fold CV masks a fold of non-missing genotypes, refits to get Q̃ and F̃, predicts each masked value by `µ̂_ij = 2 Σ_k q̃_ik f̃_kj`, and averages the squared **binomial deviance residual**
  `d(n_ij, µ̂_ij) = n_ij·log(n_ij/µ̂_ij) + (2 − n_ij)·log[(2 − n_ij)/(2 − µ̂_ij)]`
  over all masked entries; minimising over a grid of K picks K. — [Alexander & Lange 2011 preprint](http://dalexander.github.io/preprints/admixture-enhancements-preprint.pdf)
- ADMIXTURE also supports **bootstrap standard errors** (`-B`, with a PLINK `.map` file required; 2000 replicates suggested for publication-quality intervals) and **penalized estimation** to discourage spurious small admixture coefficients in small datasets or large K. — [ADMIXTURE manual](https://dalexander.github.io/admixture/admixture-manual.pdf)

### Cited Findings — PCA projection of a single genome

- **smartpca `lsqproject`** (EIGENSOFT): "PCA projection is carried out by solving least squares equations rather than an orthogonal projection step. This is appropriate if PCs are calculated using samples with little missing data but it is desired to project samples with much missing data onto the top PCs." — [EIG POPGEN README](https://raw.githubusercontent.com/DReichLab/EIG/master/POPGEN/README)
- **smartpca projection workflow**: `poplistname` restricts eigenvector computation to the listed reference populations; all other individuals are then projected onto those axes. SNPs are normalised by allele-frequency scaling (divide by √[p(1−p)]). `numoutlieriter` defaults to 5 (set 0 to disable outlier removal). — [EIG POPGEN README](https://raw.githubusercontent.com/DReichLab/EIG/master/POPGEN/README)
- **The shrinkage problem is explicitly documented**: samples used to compute the axes "stretch" them, so "2 populations in fact genetically identical … will appear different if one is used to compute axes, and one not." `shrinkmode` corrects this but "is slow and will greatly increase the runtime"; `autoshrink` implements a cheaper eigenvalue-shrinkage alternative with marginally worse results. — [EIG POPGEN README](https://raw.githubusercontent.com/DReichLab/EIG/master/POPGEN/README)
- **LASER / TRACE** (Wang et al.): predict PC scores by **Augmentation, Decomposition and Procrustes transformation (ADP)** — augment the reference genotype matrix by appending the study sample as a column, run SVD on the augmented data, then Procrustes-transform the resulting singular vectors back into the original reference PC space. `laser` handles shotgun sequence reads, `trace` handles genotypes; both place samples into the same ancestry space given a shared reference panel. — [LASER wiki](https://genome.sph.umich.edu/wiki/LASER), [LASER GitHub](https://github.com/statgen/LASER), [LASER server paper, PMC5870850](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5870850/)
- A 2020 methods paper reviews and extends projection approaches (including online/augmented variants): "Fast and robust ancestry prediction using principal component analysis," *Bioinformatics* 36(11):3439 — [Oxford Academic](https://academic.oup.com/bioinformatics/article/36/11/3439/5810493), [PMC7267814](https://pmc.ncbi.nlm.nih.gov/articles/PMC7267814/). (Read only via search summary; treat details as unverified.)

### Cited Findings — local ancestry

- **RFMix**: Maples BK, Gravel S, Kenny EE, Bustamante CD. "RFMix: a discriminative modeling approach for rapid and robust local-ancestry inference." *American Journal of Human Genetics* 93(2):278–288, 2013. PMID 23910464 — [Cell/AJHG](https://www.cell.com/ajhg/fulltext/S0002-9297(13)00289-9), [PubMed](https://pubmed.ncbi.nlm.nih.gov/23910464/). Discriminative (random-forest per window + HMM/CRF smoothing along the chromosome) rather than generative.
- Reported RFMix performance (from search summaries of the RFMix paper and of a 5-way admixture benchmark, **not read in full**): >90% accuracy for 43–91% of loci in sub-continental admixtures; ~89% accuracy in a complex 5-way admixed population; difficulty distinguishing low-divergence pairs such as Japanese vs Chinese. Benchmark paper: "Putting RFMix and ADMIXTURE to the test in a complex admixed population," *BMC Genomic Data* — [Springer](https://link.springer.com/article/10.1186/s12863-020-00845-3), [bioRxiv PDF](https://www.biorxiv.org/content/10.1101/671727.full.pdf)
- **FLARE**: Browning SR, Waples RK, Browning BL. "Fast, accurate local ancestry inference with FLARE." *American Journal of Human Genetics* 110(2):326–335, 2023. doi 10.1016/j.ajhg.2022.12.010, PMID 36610402 — [PMC9943733](https://pmc.ncbi.nlm.nih.gov/articles/PMC9943733/). **HMM form**: the hidden state is a pair (ancestry i, donor reference haplotype h) at each marker; emissions match the reference allele with probability (1 − θ_ij), where θ_ij absorbs recent mutation, genotype error and gene conversion; the ancestry-switch transition probability is `µ_i'·(1 − e^{−d_m·T})` with d_m the inter-marker genetic distance in Morgans and T the generations since admixture, and within-ancestry haplotype switching uses population-specific rates ρ_i.
- **FLARE accuracy**: three-way continental admixture (African/European/Asian) with 10,000 reference individuals per panel gave **r² = 0.993**, with RFMix substantially lower. A four-way panel including Japanese and Chinese gave FLARE **r² = 0.888** vs RFMix **r² = 0.666** — "all methods have difficulty distinguishing the most closely related populations" (split time 100 generations). Simulations used chromosome 20 with ~20,000 SNPs after filtering; for sequence data a minimum allele-count threshold of 50 was applied. — [PMC9943733](https://pmc.ncbi.nlm.nih.gov/articles/PMC9943733/)
- A deep-learning local-ancestry classifier also exists as a comparison point — [arXiv 2011.02081](https://arxiv.org/pdf/2011.02081)

### Inferences

- Lineage's current supervised-EM-against-five-super-populations design matches ADMIXTURE's `--supervised` mode with a fixed P, and the authors' own caveat is the right thing to surface in the UI: supervised results are only meaningful when the reference populations really are the ancestral populations and are homogeneous. The 1000 Genomes super-populations satisfy "homogeneous" only loosely (SAS and EAS in particular), so the honest framing is "proportion of your genome best explained by each reference panel," not "your ancestry."
- The Alexander & Lange bias result gives Lineage a principled statement to display: unsupervised or mis-specified reference sets systematically *over*-report admixture in individuals who have little of it. That is a concrete, cited explanation for the small spurious percentages consumer tools report.
- **Projecting from allele-frequency matrices alone is not a valid substitute for PCA projection.** The smartpca documentation makes the mechanism explicit: projection onto axes computed from other samples shrinks the projected sample toward the origin, and the corrections (lsqproject, shrinkmode/autoshrink, or LASER's Procrustes/ADP) all require either the reference *genotypes* or an explicit shrinkage model — an allele-frequency matrix on its own carries neither the within-reference covariance structure needed for least squares nor the augmentation LASER performs. A browser tool that ships only per-population allele frequencies can legitimately do supervised admixture and nearest-population likelihood, but should not claim a PCA position.
- Nearest-population likelihood ranking is the cheapest defensible product of an allele-frequency matrix: for each reference population k, `ln L_k = Σ_j [ n_j·ln f_kj + (2 − n_j)·ln(1 − f_kj) ]` is exactly the ADMIXTURE log-likelihood with Q fixed to a unit vector. It ranks populations and, unlike PCA projection, needs nothing but the frequencies. Its weakness is that it is not calibrated across populations with different ascertainment or sample sizes, so it should be presented as a ranking with log-likelihood differences, not as probabilities.
- Local ancestry in a browser is feasible for continental resolution with FLARE's model form, which is a plain HMM over reference haplotypes and is simpler to implement than RFMix's random forests. The r² = 0.888 vs 0.666 gap in the four-way test is the number to quote when refusing sub-continental "chromosome painting": at the resolution consumers actually want (e.g. Italian vs Greek), no published method reaches useful accuracy.

### Gaps

- **How many SNPs are needed** for each task: I found no primary source giving a threshold. FLARE's benchmarks used ~20,000 SNPs on one chromosome, and Ceballos recommends ≥300,000 genome-wide for ROH, but neither is a general answer for admixture or local ancestry. Mark this as unresolved rather than inventing a figure.
- **frappe (Tang et al. 2005)** specifically: not fetched. ADMIXTURE's own papers describe it as implementing the same likelihood model (citations [1,2] in the 2011 preprint are Pritchard/STRUCTURE and Tang/frappe), but I did not read frappe's paper.
- **Whether RFMix's reported accuracies are per-marker or per-segment**, and the exact panel/marker densities they were measured at: not verified (paywalled).

## Q4. Ancient ancestry: the three-way European model, qpAdm vs ADMIXTURE vs NNLS on G25

### Takeaway
The WHG / Anatolian-Neolithic / Yamnaya-steppe model is well established for
*populations* studied with capture-enriched ancient genomes, but every primary
paper models groups, not individuals, and Harney et al.'s assessment of qpAdm
shows that non-rejection of a model is weak evidence. A scientifically
defensible browser result is a statement about which published population-level
model the user's *population* fits, with the paper's own uncertainty, not a
personalised "you are 43% Yamnaya".

### Cited Findings

- **Haak et al. 2015**: "Massive migration from the steppe was a source for Indo-European languages in Europe," *Nature* 522:207–211. doi 10.1038/nature14317 — verified via [PMC5048219](https://pmc.ncbi.nlm.nih.gov/articles/PMC5048219/). Present-day Europeans are modelled as deriving from three ancestral populations: **WHG, Early Neolithic (Anatolian-derived farmers) and Yamnaya**. Late Neolithic **Corded Ware carried ~75% Yamnaya-related ancestry**, with the combined-dataset point estimate **73.1 ± 2.2%**; the inferred degree of population turnover was **48–80%** against a Middle Neolithic baseline. Yamnaya-related ancestry is **lower in southern Europe and higher in northern Europe** today. Data: **390k capture targeting 394,577 SNPs**, 69 newly analysed ancient individuals plus 25 from the literature (~94 total). Methods were f-statistics and mixture modelling, with the authors emphasising approaches "robust to uncertainty about the exact population history."
- **Lazaridis et al. 2014**: "Ancient human genomes suggest three ancestral populations for present-day Europeans," *Nature* 513:409–413. doi 10.1038/nature13673 — verified via [PMC4170574](https://pmc.ncbi.nlm.nih.gov/articles/PMC4170574/). Three sources: **WHG** (contributed to all Europeans but not Near Easterners), **ANE** (Ancient North Eurasians, related to Upper Palaeolithic Siberians, contributing to both Europeans and Near Easterners) and **EEF** (Early European Farmers, mainly Near Eastern but themselves carrying WHG-related ancestry). **EEF ranges from ~30% in the Baltic to ~90% in the Mediterranean**; northern Europeans acquired **up to 50% WHG** beyond what came through EEF; **ANE is present in nearly all modern Europeans, up to ~20%**. EEF carried **~44% "Basal Eurasian"** ancestry from a lineage that split before the diversification of other non-African lineages. Data: 9 ancient genomes; 2,345 contemporary humans at **594,924 autosomal SNPs**. Methods: ADMIXTURE, f3/f4-statistics, qpWave/ADMIXTUREGRAPH, PCA, MixMapper, TreeMix.
- **Lazaridis et al.'s own caveats**, quoted in the fetched text: "the finding of three sources could be consistent with a larger number of mixture events" and "the source populations may themselves have been mixed"; specific populations (Sicilians, Finns) fit poorly because of additional gene flow. — [PMC4170574](https://pmc.ncbi.nlm.nih.gov/articles/PMC4170574/)
- **qpAdm assessment**: Harney É, Patterson N, Reich D, Wakeley J. "Assessing the performance of qpAdm: a statistical tool for studying population admixture." *Genetics* 217(4):iyaa045, 2021. doi 10.1093/genetics/iyaa045 — [Oxford Academic](https://academic.oup.com/genetics/article/217/4/iyaa045/6070149), [Reich Lab preprint PDF](https://reich.hms.harvard.edu/sites/reich.hms.harvard.edu/files/inline-files/qpAdm_Harney_biorxiv.pdf), [supplement](https://reich.hms.harvard.edu/sites/reich.hms.harvard.edu/files/inline-files/Harney_2021_Genetics_qpAdm_supplement.pdf).
  - **Robust to**: low coverage, high rates of missing data, DNA damage occurring at similar rates in all populations, **the use of pseudo-haploid data**, small sample size, and ascertainment bias. Pseudohaploidy "has little impact on admixture estimates."
  - **Pitfalls**: (1) multiple plausible models may be found, most of which are not the truth, because **qpAdm uses non-rejection of the null as its criterion for plausibility**; (2) **true models may be rejected if samples from too many populations are included**; (3) results can be difficult to interpret and even misleading **under continuous gene flow**.
- Follow-up work on qpAdm screens: "Performance of qpAdm-based screens for genetic admixture on admixture-graph-shaped histories and stepping-stone landscapes," *Genetics* — [PMC10614728](https://pmc.ncbi.nlm.nih.gov/articles/PMC10614728/) and [Genetics 230(1):iyaf047](https://academic.oup.com/genetics/article/230/1/iyaf047/8102970); and a review of the general problem, "Testing Times: Challenges in Disentangling Admixture Histories in Recent and Complex Demographies" — [PMC10680674](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10680674/)
- A published NNLS-on-PCA-coordinates approach exists: "Fast and reliable ancestral reconstruction on ancient genotype data with non-negative Least square and Principal Component Analysis" — [ResearchGate record](https://www.researchgate.net/publication/380437733_Fast_and_reliable_ancestral_reconstruction_on_ancient_genotype_data_with_non-negative_Least_square_and_Principal_Component_Analysis). I could not obtain the peer-reviewed venue or a DOI for it within budget.

### Inferences

- Everything in the primary literature is a claim about **populations**, estimated from pooled samples with block-jackknife standard errors (Haak's ±2.2% on 73.1% is a population-level SE, not an individual's uncertainty). Applying a three-way qpAdm/NNLS decomposition to one modern consumer genotype inherits none of that error structure: the arithmetic will return three numbers summing to 1 for any input, including a random one.
- The specific failure with pseudo-haploid ancient references and one diploid modern target is not accuracy of the ancient genotypes — Harney et al. show pseudohaploidy is fine — but **model selection**. qpAdm's criterion is non-rejection, and with one target individual the standard errors are large, so almost every candidate model passes. "Multiple plausible scenarios may be found most of which are not the truth" is precisely the regime a single-individual tool operates in.
- **G25 is not a published method.** It is a coordinate set distributed by a blog (Eurogenes) and fitted with NNLS by third-party calculators; none of the searches returned a peer-reviewed description of how the coordinates are produced or validated. A tool with Lineage's accuracy policy should not use it, or should label it explicitly as non-peer-reviewed.
- A defensible "ancient ancestry" result therefore looks like: (a) place the user's genotype against published *population* models by naming the closest reference population(s) and citing the paper's own estimates for that population — e.g. "published models of your closest reference population put Yamnaya-related ancestry at X% (Haak 2015, ±SE)"; (b) show the three-source model as a diagram of a historical finding, not as a personal pie chart; (c) if a per-individual decomposition is computed at all, report it with bootstrap intervals *and* the set of alternative models that were not rejected, which is what Harney et al. recommend. Note this is my inference from the cited caveats, not a recommendation any of these papers makes about consumer tools.

### Gaps

- **The qpAdm estimating equations themselves** (the f4-statistic matrix, the rank/weight solution, the block jackknife) were not read in primary form — only Harney's assessment of the method's behaviour. An implementer needs the ADMIXTOOLS documentation or Patterson et al. 2012 for the algebra. [ADMIXTOOLS overview](https://en.wikipedia.org/wiki/ADMIXTOOLS) is a secondary source only.
- **Lazaridis et al. 2016** (Near East ancient DNA) was not retrieved; its PMID/DOI and the refinements it made to the EEF/Basal Eurasian picture are unverified here.
- **Per-population modern European steppe/EEF/WHG percentage tables** from Haak 2015 Extended Data: not extracted; only the directional statement (higher north, lower south) is verified.
- **G25 methodology, licence and validation**: no primary source found. Blog sources ([Eurogenes](https://eurogenes.blogspot.com/2020/07/ancient-ancestry-proportions-in-present.html)) and commercial sites ([Ancestrify](https://www.ancestrify.io/qpadm)) exist but are not citable as method descriptions.

## Q5. Pigmentation: IrisPlex / HIrisPlex / HIrisPlex-S

### Takeaway
HIrisPlex-S is a set of multinomial logistic regressions over 41 SNPs with
published, forensically validated AUCs; performance is excellent for the
extreme categories (brown eyes AUC ~0.96, blue ~0.88) and poor for every
intermediate category (~0.61), and it degrades sharply outside European
populations. Results should be shown as calibrated per-category probabilities
with the intermediate-category failure stated, never as a single predicted
colour.

### Cited Findings

- **HIrisPlex-S primary paper**: Chaitanya L, Breslin K, Zuñiga S, Wirken L, Pośpiech E, Kukla-Bartoszek M, Sijen T, de Knijff P, Liu F, Branicki W, Kayser M, Walsh S. "The HIrisPlex-S system for eye, hair and skin colour prediction from DNA: Introduction and forensic developmental validation." *Forensic Science International: Genetics*, 2018. **PMID 29753263, doi 10.1016/j.fsigen.2018.04.004** — [Europe PMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=%22HIrisPlex-S%20system%20for%20eye%2C%20hair%20and%20skin%20colour%20prediction%22&format=json&resultType=core&pageSize=3). Two multiplex assays targeting **41 SNPs** total plus three statistical prediction models; the 17-plex gives complete SNP profiles from as little as **63 pg of input DNA**; described as "the first forensically validated tool for skin colour prediction, and … the first forensically validated tool for simultaneous eye, hair and skin colour prediction from DNA."
- **Marker-set lineage**: 6 SNPs (IrisPlex, eye) → 24 SNPs (HIrisPlex, eye + hair) → **41 SNPs** (HIrisPlex-S, adding 17 skin-relevant markers). — [North German evaluation, PMC13116637](https://pmc.ncbi.nlm.nih.gov/articles/PMC13116637/)
- **Model form**: multinomial logistic regression producing probabilities for **3 eye categories** (blue, intermediate, brown), **4 hair colour categories** (blond, brown, black, red) plus **2 hair shade categories** (light, dark), and **5 skin categories** (very pale, pale, intermediate, dark, dark-to-black). Training sets: eye model **9,466 individuals (97.1% European)**, hair model **1,878 (82.6% European)**, skin model **1,423**. — [Int J Legal Med paper on genotyping reliability](https://link.springer.com/article/10.1007/s00414-025-03709-6), [Walsh lab tools page](https://walshlab.indianapolis.iu.edu/tools/hps.html)
- **AUCs as cited from the original publications** and as re-measured in a North German sample (n given per trait in that paper) — [PMC13116637](https://pmc.ncbi.nlm.nih.gov/articles/PMC13116637/):

  | Trait / category | Original HIrisPlex(-S) | North German study |
  |---|---|---|
  | Eye — blue | 0.88–0.89 | 0.8858 |
  | Eye — brown | 0.95–0.96 | 0.9563 |
  | Eye — intermediate | ~0.61 | 0.6136 |
  | Hair — blond | 0.71 | 0.7115 |
  | Hair — brown | 0.68 | 0.6785 |
  | Hair — black | 0.83 | 0.8272 |
  | Skin — very pale | – | 0.8626 |
  | Skin — pale | – | 0.6594 |
  | Skin — intermediate | – | 0.7206 |

- **Prediction-guide threshold**: a probability threshold of **0.7** is recommended for eye and hair colour. In the North German evaluation, applying it **eliminated 74% of hair colour classifications without substantially improving accuracy**. — [PMC13116637](https://pmc.ncbi.nlm.nih.gov/articles/PMC13116637/)
- **The dominant failure mode is the intermediate category**: in that study **all 47 individuals with intermediate eye colour were misclassified as blue or brown**. Hair colour is additionally confounded by age-related darkening, which the model cannot detect, causing blond/brown confusion. — [PMC13116637](https://pmc.ncbi.nlm.nih.gov/articles/PMC13116637/)
- **Population transferability is the second failure mode.** In an admixed Brazilian sample, AUCs were blue eye **0.88**, brown eye **0.67**, black hair **0.69**, fair skin **0.70**, dark skin **0.70**, with intermediate phenotypes lower than the extremes. — [FSI Genetics Supplement Series S1875-1768(19)30146-5](https://www.fsigeneticssup.com/article/S1875-1768(19)30146-5/pdf), [ScienceDirect record](https://www.sciencedirect.com/science/article/abs/pii/S1875176819301465). A Spanish study reported eye AUCs blue 0.993 / brown 0.732 / intermediate 0.621 but hair AUCs of 0.336 (blond), 0.508 (red), 0.339 (brown), 0.278 (black) — [MDPI Genes 15(10):1330](https://www.mdpi.com/2073-4425/15/10/1330). **Flag: AUCs below 0.5 are worse than chance and are almost certainly a class-coding or reporting artefact rather than a real result; do not propagate those hair numbers without checking the paper.**
- The Walsh lab states the system gives "categorical eye, hair and skin color predictions with approx. 80% correct prediction output per trait." — [Walsh lab tools page](https://walshlab.indianapolis.iu.edu/tools/hps.html)
- An MPS/NGS implementation exists for two common forensic platforms — [FSI Genetics, S1872497319302054](https://www.sciencedirect.com/science/article/abs/pii/S1872497319302054); and an imputation-based extension for low-coverage ancient DNA — [Scientific Reports, s41598-026-38372-3](https://www.nature.com/articles/s41598-026-38372-3)

### Inferences

- HIrisPlex-S is the one part of this landscape that transfers cleanly to a browser: multinomial logistic regression over ≤41 genotypes is trivial arithmetic, the categories are published, and the accuracy is documented per category. The blocking issue is coefficient availability (see Gaps), not compute.
- The correct presentation follows from the AUC table: report **all category probabilities**, not a winner; state the published AUC beside each category so a 0.61-AUC "intermediate" is visibly weaker than a 0.96-AUC "brown"; and say plainly that intermediate eye colour is not predictable by this model (0/47 correct in the North German sample). Applying the 0.7 threshold silently would discard three-quarters of hair calls without accuracy gain — so if a threshold is used, the discarded fraction must be shown.
- The training sets are 97.1% and 82.6% European. Any non-European user's result is out of distribution, and the Brazilian AUCs (brown eye 0.67 vs 0.95 in Europeans) quantify how much. That is a citable, specific caveat rather than a generic disclaimer.
- Consumer arrays do not carry all 41 SNPs — notably the MC1R variants that drive red-hair prediction are poorly represented on some chips. A browser implementation must report which of the 41 markers were present in the uploaded file and refuse (or widen) predictions when key markers are missing.

### Gaps

- **The actual α and β coefficients** of the three multinomial models were not obtained. They are distributed with the HIrisPlex-S webtool (hirisplex.erasmusmc.nl) and in the supplementary material of Chaitanya et al. 2018; the Walsh lab page does not host them. **Licence/terms for reusing the coefficients are also unverified** — this must be checked before bundling them.
- **Full original AUC list for all five skin categories** (dark and dark-to-black) from Chaitanya et al. 2018: not obtained (paper paywalled).
- **The claim that red-hair AUC falls from 0.92 to 0.65 when MC1R markers are excluded** appeared in an aggregated search answer without a clearly attributable source; I could not tie it to a specific paper and am **not** treating it as verified.
- **The exact SNP list (rsIDs) for the 41 markers**: not captured here.

## Q6. Faces: what the evidence supports

### Takeaway
No published method predicts a recognisable individual face from DNA. The
best-known claim (Lippert et al. 2017) was shown to be matched by a baseline
using only sex, age and self-reported ethnicity, and its authors' own abstract
concedes that per-trait "predictive accuracy beyond ancestry and demographic
information is limited." Face-shape GWAS have found tens of loci with
global-to-local effects, and the most credible face-related capability
demonstrated is *verification* (matching a face to DNA among candidates), not
*generation* of a face.

### Cited Findings

- **Lippert et al. 2017**: "Identification of individuals by trait prediction using whole-genome sequencing data," *PNAS* 114(38):10166–10171. **PMID 28874526, PMCID PMC5617305, doi 10.1073/pnas.1711125114** — [Europe PMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=TITLE%3A%22Identification%20of%20individuals%20by%20trait%20prediction%20using%20whole-genome%20sequencing%20data%22&format=json&resultType=core&pageSize=2). Cohort: **1,061 participants of diverse ancestry**, whole-genome sequenced (>30×), with 3D facial images, voice recordings and other phenotypes.
- **The authors' own summary of per-trait performance**, verbatim from the abstract: "Individually, for a large fraction of the traits, their predictive accuracy beyond ancestry and demographic information is limited." Their contribution is a **maximum-entropy algorithm that integrates multiple predictions** to decide which genome and which phenotype set come from the same person. They "reidentified an average of >8 of 10 held-out individuals in an ethnically mixed cohort and an average of 5 of either 10 African Americans or 10 Europeans." — [Europe PMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=TITLE%3A%22Identification%20of%20individuals%20by%20trait%20prediction%20using%20whole-genome%20sequencing%20data%22&format=json&resultType=core&pageSize=2)
- **Reported per-trait numbers** (from the full text via [PMC5617305](https://pmc.ncbi.nlm.nih.gov/articles/PMC5617305/)): height R²_CV = **0.53** (mean absolute error 4.9 cm); eye and skin colour modelled as continuous RGB, R²_CV **0.77–0.82** per channel; voice pitch R²_CV **0.70**, but only **3 of 100** identity-vector dimensions exceeded R²_CV of 0.10. For 3D face, accuracy was concentrated in features that differ between African and European populations (nose and lip width, cheekbones). Re-identification: ethnically mixed cohort **74%** select-10 / **83%** match-10; African American subset **44% / 47%**; European subset **50% / 57%**.
- **Erlich's critique**: "Major flaws in 'Identification of individuals by trait prediction using whole-genome sequencing data'," bioRxiv doi 10.1101/185330 — [bioRxiv v1 full text](https://www.biorxiv.org/content/10.1101/185330v1.full-text), [v3](https://www.biorxiv.org/content/10.1101/185330v3). Key numbers from the fetched text:
  - A **baseline using only sex, age and self-reported ethnicity** achieved a **75% success rate at n = 10**, versus the paper's 74%, built "after one hour of work." Across n = 2, 5, 10, 20 the simple procedure was comparable; only at n = 50 was there a notable difference.
  - On height, "nearly 80% of the explained height variance" came from **sex markers alone**, making the prediction a population average rather than a personal one.
  - On faces, "sex and genomic ancestry are the most important covariates for face morphology," with trait-specific SNPs adding minimal predictive value.
  - Age prediction "worked only after sequencing NA12878 for 512 times using the same exact sequencing pipeline" — i.e. it is pipeline-specific, not generalisable.
- **The authors' rebuttal**: "No major flaws in 'Identification of individuals by trait prediction using whole-genome sequencing data'," bioRxiv doi 10.1101/187542 — [bioRxiv](https://www.biorxiv.org/content/10.1101/187542v1). A **correction to the PNAS paper** was published: *PNAS* 114(41):E8800 — [PNAS](https://www.pnas.org/content/114/41/E8800) (content of the correction not read).
- **Reception**: *Nature* news, "Geneticists pan paper that claims to predict a person's face from their DNA" — [nature.com/articles/nature.2017.22580](https://www.nature.com/articles/nature.2017.22580) (paywalled/SSO for this session, headline and framing only). Background on the publication history, including that *Science* rejected the manuscript after critical review by Erlich — [GEN](https://www.genengnews.com/insights/two-sides-of-craig-venters-facial-prediction-study/)
- **Sero et al. 2019**: "Facial recognition from DNA using face-to-DNA classifiers," *Nature Communications* 10:2557. **PMID 31186421, doi 10.1038/s41467-019-10617-y** — [Nature Communications](https://www.nature.com/articles/s41467-019-10617-y), [PubMed](https://pubmed.ncbi.nlm.nih.gov/31186421/). The method **does not predict a face**; it classifies *given* faces by DNA-encoded aspects (sex, genomic background, individual genetic loci) or DNA-inferred aspects (BMI, age). Reported **true positive rates of 83% and 80%** in two cohorts **in verification mode**. Matching was harder within an ethnic population than between populations. — [ScienceDaily summary](https://www.sciencedaily.com/releases/2019/06/190611155603.htm), [OJP abstract](https://www.ojp.gov/ncjrs/virtual-library/abstracts/facial-recognition-dna-using-face-dna-classifiers)
- **Facial-shape GWAS** (all records verified via Europe PMC):
  - Claes P et al. 2018, "Genome-wide mapping of global-to-local genetic effects on human facial shape," *Nature Genetics* 50:414–423. PMID 29459680, PMCID PMC5937280, doi 10.1038/s41588-018-0057-4. **2,329 Europeans**, **38 loci (15 replicated)**, enrichment in active chromatin of cranial neural crest cells.
  - Xiong Z et al. 2019, "Novel genetic loci affecting facial shape variation in humans," *eLife* 8:e49898. PMID 31763980, PMCID PMC6905649, doi 10.7554/eLife.49898. GWAS of **10,115 Europeans**, 24 suggestive loci (17 previously unreported); replication in 7,917 further individuals confirmed **10 loci, 6 of them new**.
  - Bonfante B et al. 2021, "A GWAS in Latin Americans identifies novel face shape loci, implicating VPS13B and a Denisovan introgressed region in facial variation," *Science Advances* 7(6):eabc6160. PMID 33547071, PMCID PMC7864580. **>6,000 individuals**, **32 regions**, "more than doubling the number of robustly associated face morphology loci."
  - Qiao L et al. 2018, "Genome-wide variants of Eurasian facial shape differentiation and a prospective model of DNA based face prediction," *J Genet Genomics*. PMID 30174134, doi 10.1016/j.jgg.2018.07.009. Six significant loci in a Uyghur discovery panel, four replicated.
- **2023–2026 state of the art**: Kayser M et al. 2023, "Recent advances in Forensic DNA Phenotyping of appearance, ancestry and age," *Forensic Science International: Genetics* 65:102870. PMID 37084623, doi 10.1016/j.fsigen.2023.102870. Appearance prediction has "broadened beyond eye, hair and skin color to additionally comprise other traits such as eyebrow color, freckles, hair structure," with forensically validated MPS-based tools available — but "moving reliable appearance, ancestry and age prediction from crime scene DNA to the level of detail and accuracy police investigators may desire, requires further intensified scientific research." — [Europe PMC search record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=%28%22DNA%20phenotyping%22%20OR%20%22face%20prediction%22%20OR%20%22facial%20prediction%22%29%20AND%20%28PUB_YEAR%3A2023%20OR%20PUB_YEAR%3A2024%20OR%20PUB_YEAR%3A2025%20OR%20PUB_YEAR%3A2026%29&format=json&resultType=core&pageSize=8&sort=CITED%20desc)
- Commercial claims in this space continue to outrun the literature; e.g. a company claiming DNA-to-face recognition was covered sceptically by [MIT Technology Review (2022)](https://www.technologyreview.com/2022/01/31/1044576/corsight-face-recognition-from-dna/).

### Inferences

- The whole field's numbers collapse into one pattern: what is predictable from DNA about a face is **sex and continental ancestry**, plus a small amount of BMI/age signal. Erlich's demonstration that sex + age + ethnicity matches the genome-based re-identification rate at n = 10, and his finding that ~80% of the explained height variance is sex, are the cleanest statements of this. Lippert et al.'s own abstract concedes the same point in gentler language.
- The correct distinction for a consumer tool is **prediction vs verification**. Sero et al. achieve 80–83% true positive rates only in verification mode — given a set of candidate faces, rank them — and performance drops within an ethnic group, which is exactly what you would expect if the signal is largely ancestry and sex. Nothing in the literature generates a face.
- The GWAS results are consistent with this: 38 loci in 2,329 individuals (Claes 2018), 10 replicated loci in 10,115 (Xiong 2019), 32 regions in >6,000 Latin Americans (Bonfante 2021). These are loci that shift specific facial modules measurably in aggregate; none of the abstracts I retrieved reports variance explained, and tens of common variants of small effect cannot reconstruct an individual morphology.
- For Lineage, the defensible product is therefore: explain the genetics of facial variation (which loci, which modules, cranial neural crest biology), show the published numbers, and state explicitly that generating a face from a consumer genotype file is not supported by any published method. Building a face-generation feature would violate the project's accuracy policy on its own terms — there is no published or reproducible model to point at.

### Gaps

- **Variance explained (R² or heritability captured) for 3D facial shape by identified loci**: not found in any abstract retrieved. This is the single most useful number for the report and it is missing; the Claes/Xiong/Bonfante full texts would be needed.
- **Peer-reviewed criticism of Parabon Snapshot specifically**: not verified. The critiques I could source are Erlich's (of Lippert) and the general caveats in Kayser et al. 2023. I attempted the Schneider/Prainsack/Kayser 2019 *Dtsch Arztebl Int* review, which would have been the right source, but the PMC ID I tried resolved to an unrelated article and the search budget was exhausted. **Do not attribute Parabon criticism to a source in the report without finding one.**
- **Content of the PNAS correction** (114(41):E8800): not read.
- **2023–2026 primary studies specifically on DNA-to-face prediction**: the Europe PMC query surfaced only the Kayser 2023 review as substantively relevant; the other high-citation hits were about age/methylation or surgical simulation. Either little has been published, or my query missed it — I would not claim the former confidently.

## Q7. Runs of homozygosity: F_ROH, thresholds, and how to present parental relatedness

### Takeaway
F_ROH = sum of ROH above a length threshold divided by autosomal genome length
is the standard estimator, and the ROHgen/Ceballos recommended calling protocol
(PLINK, MAF > 5%, ≥50 SNPs, ≥1.5 Mb, ≥300k SNP array) is directly implementable
in a browser. The honest consumer presentation is a total (S_ROH in Mb) plus the
published landmarks — 0.0625 expected for first-cousin offspring, S_ROH > 160 Mb
as a conservative first-cousin-or-closer boundary, outbred individuals not
carrying ROH beyond ~4 Mb — rather than a named parental relationship.

### Cited Findings

- Ceballos FC, Joshi PK, Clark DW, Ramsay M, Wilson JF. "Runs of homozygosity: windows into population history and trait architecture." *Nature Reviews Genetics* 19:220–234, 2018. doi 10.1038/nrg.2017.109 — [Nature](https://www.nature.com/articles/nrg.2017.109); full text read from [this PDF copy](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf).
- **Definitions**: the inbreeding coefficient F is "the probability that an individual receives two alleles that are identical-by-descent at a given locus," and also the expected autozygous proportion of the genome — **F = 0.0625 for the offspring of first cousins**, **1/64 for second cousins**, **1/8 for the progeny of avuncular or double-first-cousin matings**. **F_ROH** is "the sum total length of ROH (S_ROH) over a specified minimum length threshold as a proportion of the total genome length." N_ROH (the count) is the complementary statistic. F_ROH "captures the total inbreeding coefficient of the individual, irrespective of pedigree accuracy or depth (or absence), within the resolution of the data set available." — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- **Which threshold to use**: F_ROH calculated using **ROH > 1.5 Mb** correlated most strongly (**r = 0.86**) with inbreeding coefficients from six-generation pedigrees in an isolated population. A separate analysis found F_ROH from **ROH > 5 Mb** correlated r = 0.87 with pedigree F, while F_ROH from ROH < 5 Mb did not. — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- **Recommended calling protocol** (the paper's own recommendation, matching the ROHgen consortium): microarray genome-wide with **at least 300,000 SNPs**; call with **PLINK**; consider **SNPs > 5% allele frequency**; require **at least 50 SNPs** and **1.5 Mb** length; allow for missing and heterozygous calls. Results should be reported with standard errors. — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- **PLINK's algorithm**: compute, for each SNP, the proportion of completely homozygous sliding windows encompassing it; if that proportion exceeds a threshold the SNP is designated in-ROH; a variable number of heterozygous or missing SNPs per window is allowed to tolerate genotyping error and new mutation; an ROH is called when the run of consecutive in-ROH SNPs exceeds a threshold in SNP count and/or length. Data may be LD-pruned beforehand. **PLINK outperformed GERMLINE and Beagle in detecting ROH on simulated data.** — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- **Length classes** (from a Gaussian-mixture treatment of the length distribution, implemented in Garlic): very short ROH of tens to hundreds of kb reflect **LD patterns**; intermediate ROH of hundreds of kb to 2 Mb result from **background relatedness owing to genetic drift**; long ROH **over 1–2 Mb arise from recent parental relatedness**. The log-odds/allele-frequency approach gives better sensitivity for short ROH but needs population allele frequencies, and its population-specific class boundaries complicate meta-analysis; in practice the mixture results correlate very highly with PLINK's. — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- **Empirical landmarks for interpreting a single person's total**: demonstrably outbred individuals (no inbreeding loops in at least the last five and probably ten generations) **carried ROH up to 4 Mb in length but not longer**. Siblings differ on average by **10 Mb in S_ROH** — pedigrees give an expectation, ROH give the realised value. Of 3,851 individuals, **112 had S_ROH > 160 Mb, "a conservative lower boundary for the equivalent of offspring of first cousins or closer"**, and only five of those had no ROH > 10 Mb. The most extreme individual had **S_ROH > 500 Mb including 342 Mb in ROH > 10 Mb, probably the result of an avuncular union**. Early studies found offspring of first cousins with autosomal recessive disease had a **mean F_ROH of 11%**, higher than the pedigree prediction, probably from repeated consanguinity across generations. — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- **Population baselines matter**: Africans generally have fewer ROH (larger effective population size); East Asians typically have more ROH than Europeans, who have more than South Asians, who have more than sub-Saharan Africans. Shorter ROH correlate with overland distance from Addis Ababa at **r = 0.82, P < 0.0001**. Admixture reduces ROH to very few short segments; bottlenecks add many short ROH; consanguinity adds a small number of very long ROH and increases the variance of S_ROH. With >3 million SNPs, ROH down to 100 kb can be called, and these total **400–500 Mb in cosmopolitan Europeans and East Asians but only 160 Mb in Yoruba** — so short ROH dominate the total even in inbred individuals. Japanese samples show ~5% of individuals with evidence of recent inbreeding in the S_ROH > 10 Mb tail. — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)
- The first ROH-based survey used ~700,000 SNP microarray genotypes for 209 HapMap individuals and found megabase-scale ROH even among outbred individuals, with cryptically inbred outliers (a Mormon from Utah, two Japanese from Tokyo). — [Ceballos 2018](https://gwern.net/doc/genetics/heritable/2018-ceballos.pdf)

### Inferences

- The expected length of an autozygous tract follows from the same Thomas et al. result that ERSA uses: with `d` meioses around the loop, segment length is exponential with mean `100/d` cM, so for a common ancestor `g` generations back on each side (d = 2g), **E[ROH length] = 100/(2g) cM** — 25 cM for first-cousin offspring (g = 2), 12.5 cM for second-cousin offspring (g = 4). This is a derivation from the verified ERSA equation, not a claim from Ceballos, and it is what makes the 1.5 Mb / 5 Mb / 10 Mb thresholds correspond to progressively more recent loops.
- The right consumer presentation is a **total plus landmarks, not a relationship label**. Ceballos gives three citable anchors that need no probability model: outbred people do not carry ROH longer than ~4 Mb; S_ROH > 160 Mb is a conservative boundary for first-cousin-or-closer; and F = 0.0625 / 0.125 are the pedigree expectations for first-cousin and avuncular/double-first-cousin offspring. Reporting "your S_ROH is X Mb, of which Y Mb in segments > 10 Mb" against those anchors is defensible; reporting "your parents were first cousins" is not, because siblings differ by 10 Mb and populations differ by hundreds.
- Population baseline is not optional. Because East Asian and bottlenecked-isolate baselines are far above sub-Saharan African ones, an F_ROH figure without its reference distribution will systematically mislabel people from historically small populations as consanguineous. A tool should show the user's S_ROH against the distribution for their nearest reference population.
- The ROHgen parameter set (MAF > 5%, ≥50 SNPs, ≥1.5 Mb, ≥300k array) fits Lineage's 600–700k SNP inputs with margin, and PLINK's sliding-window rule is straightforward to implement in TypeScript. Unlike IBD detection, ROH calling does not need a genetic map if the 1.5 Mb physical threshold is used — which makes it the one Q-area Lineage could ship faithfully without bundling a map.

### Gaps

- **Exact PLINK flag values** used by ROHgen (`--homozyg-snp`, `--homozyg-kb`, `--homozyg-density`, `--homozyg-window-snp`, `--homozyg-window-het`, `--homozyg-window-missing`, `--homozyg-gap`) are not given numerically in the Ceballos text beyond "at least 50 SNPs", "1.5 Mb", "SNPs > 5% allele frequency" and "allowance for missing and heterozygous calls". The full parameter set is in the ROHgen consortium paper (reference 20 of Ceballos 2018) — not retrieved.
- **The total autosomal genome length used as the F_ROH denominator** is not stated numerically in the text I read; implementations differ (mapped autosomal length vs total). This must be fixed explicitly and stated in the UI or F_ROH values will not be comparable to published ones.
- **A per-population reference distribution of S_ROH/F_ROH** suitable for bundling (means and SDs by 1000 Genomes population) was not located; Figure 2 of Ceballos 2018 shows it for 3,851 individuals but I could not extract numeric values from the figure.
- An earlier automated summary of this same PDF returned threshold-to-generation mappings ("1.5 Mb ≈ 4–6 generations, 5 Mb ≈ 10–15 generations, 10 Mb ≈ 1–3 generations") and a "length ≈ 100/(2g) cM" attribution that I **could not find in the paper's text** and which are internally inconsistent (a longer threshold cannot mean older ancestry). Those figures are excluded here as probable extraction artefacts; see the Inferences section for the derivation that is sound.
