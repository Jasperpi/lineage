# Ancestry robustness: reference panels, methods, calibration (research notes)

Collected 2026-09-27 for the ancestry overhaul. Everything here was checked
against a primary source in that session unless marked **[unverified]**. PubMed
IDs were re-checked against NCBI's esummary the same day. This extends
`../DNA analysis landscape and open data/methods_models.md` (Q3) and
`open_datasets.md` (§2–§4); it does not repeat them.

## A. Reference panels that can be redistributed

### gnomAD HGDP+1KG harmonized callset
- Koenig Z, Yohannes MT, Nkambule LL, et al. "A harmonized public resource of
  deeply sequenced diverse human genomes." *Genome Research* 34:796–809 (2024).
  PMID 38749656, doi 10.1101/gr.278378.123.
- 4,150 samples before QC, **4,094 after** (3,400 unrelated), 153.9M variants,
  GRCh38, phased with SHAPEIT5; 599 families (593 trios, 6 duos).
- Metadata `gnomad_meta_updated.tsv` (6.16 MB) at
  `gs://gcp-public-data--gnomad/release/3.1/secondary_analyses/hgdp_1kg_v2/metadata_and_qc/`.
  Parsed: **78 populations**; region totals AFR 1003, EAS 825, CSA 790, EUR 788,
  AMR 552, MID 162, OCE 30. `high_quality=true` keeps 3,942 in 73 populations.
  MID = Bedouin 46, Palestinian 46, Druze 42, Mozabite 28. OCE = Papuan 17,
  Melanesian 13.
- Phased haplotypes as BCF at
  `gs://gcp-public-data--gnomad/resources/hgdp_1kg/phased_haplotypes_v2/`
  (chr1 1.50 GB, chr20 427 MB, chr22 279 MB; `.csi` 27–168 KB).
- The v3.1.2 `hgdp_tgp` VCFs carry `AF_<population>` INFO fields for HGDP and
  1KG populations (header read in the earlier research).
- Terms (gnomAD browser `about/policies/terms.md`): "The primary data from the
  gnomAD exomes and genomes are available free of restrictions under the
  Creative Commons Zero Public Domain Dedication… we request that you actively
  acknowledge and give attribution"; "All users of gnomAD data agree to not
  attempt to reidentify participants"; a request not to put "gnomAD" in a
  tool's name.
- **Verdict: use; it replaces 1000 Genomes phase 3 as the genotype source.**

### HGDP (Bergström 2020)
- Bergström A, McCarthy SA, Hui R, et al. "Insights into human genetic
  variation and population history from 929 diverse genomes." *Science*
  367:eaay5012 (2020). PMID 32193295. "Freely available with no restrictions."
- Regional coverage 1000G lacks: Middle East (Bedouin 46, Druze 42, Mozabite
  27, Palestinian 46); Europe (Adygei 16, Basque 23, Bergamo Italian 12, French
  28, Orcadian 15, Russian 25, Sardinian 28, Tuscan 8); nine Central/South
  Asian populations (Balochi 24, Brahui 25, Burusho 24, Hazara 19, Kalash 22,
  Makrani 25, Pathan 24, Sindhi 24, Uygur 10); **America: Colombian 7,
  Karitiana 12, Maya 21, Pima 13, Surui 8 (61)**; Oceania (Bougainville 11,
  Papuan Highlands 9, Papuan Sepik 8).
- Included in the gnomAD harmonized set above; the 61 Indigenous American
  genomes can fit an Indigenous American component directly, instead of
  learning it from admixed 1000G samples.

### gnomAD genomes, ASJ (Ashkenazi Jewish) and MID groups
- v3.1 genome counts: afr 20,744, ami 456, amr 7,647, **asj 1,736**, eas 2,604,
  fin 5,316, nfe 34,029, **mid 158**, sas 2,419, oth 1,047. v3.1 was the first
  release with a Middle Eastern label. The v4.1 genomes are the same samples.
- v4.1 sites VCFs carry only coarse groups (`afr, ami, amr, asj, eas, fin, mid,
  nfe, remaining, sas`) and are large (chr22 alone 8.73 GB; `.tbi` 37 KB), so
  rows are pulled by tabix range requests at chosen positions.
- **ASJ is the only large, open (CC0) Ashkenazi allele-frequency resource.**
  MID (158) is too small and mixed to be a Middle Eastern reference on its own.

### AADR v66.p1 Human Origins, present-day samples
- Mallick S, Micco A, Mah M, et al. "The Allen Ancient DNA Resource (AADR)."
  *Scientific Data* 11:182 (2024). PMID 38341426. CC0 1.0 on Harvard
  Dataverse; GRCh37 (hg19).
- Present-day counts in the HO `.anno`: Jewish — Ashkenazi 8, Georgian 7,
  Iranian 8, Iraqi 8, Libyan 9, Moroccan 6, Tunisian 7, Turkish 8, Yemenite 10,
  Cochin 5. Levant/Arabia — Palestinian 83, Druze 83, BedouinA 50, BedouinB 40,
  Jordanian 12, Lebanese 8 (+ Christian 9, Muslim 11), Syrian 7, Saudi 7,
  Yemeni groups 79. North Africa — Mozabite 49, Egyptian 18, Moroccan 10,
  Tunisian 8, Algerian 7, Saharawi 8, Libyan 5, Berber 5. Anatolia, Caucasus,
  Iran — Turkish 48 (+ Trabzon 9), Armenian 15, Assyrian 15, Kurd 8, Iranian 39
  (+ Zoroastrian 24, Bandari 8), Georgian 24, Abkhasian 11, Adygei 48, Chechen
  10, Lezgin 11, Ossetian 18, Azeri 12. Europe — English 22, Scottish 7,
  Orcadian 30, Icelandic 14, Norwegian 12, Finnish 17, Estonian 12, French 91,
  Basque 54, Sardinian 58, Spanish 228, Italian North 61 / Central 16 / South
  22, Sicilian 11, Maltese 8, Greek 19, Hungarian 22, Czech 11, **Polish 1**,
  Ukrainian 13 (+ North 8), Belarusian 10, Lithuanian 10, Russian 98.
- **2,244 of Lazaridis 2014's 2,722 Human Origins samples are free; 478
  require a signed letter** ("will not distribute… will not post it
  publicly… not for commercial purposes"). v66.p1 exists partly because 161
  modern individuals were released in error. Build only from the CC0
  Dataverse release, pin the version, keep `ASSESSMENT` = PASS.
- German, Dutch, Danish and Swedish samples are absent or tiny, so no open
  panel separates British from German/Dutch from Scandinavian.
- **Verdict: use as out-of-sample test genomes (a different platform and
  cohort); not as reference frequencies yet.**

### 1000 Genomes NYGC 30x (Byrska-Bishop 2022)
- *Cell* 185:3426–3440 (2022), PMID 36055201; 3,202 samples including 602
  trios; phased panel under `…/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/`.
- Same 26 populations; the gnomAD harmonized set already carries 1000G at high
  coverage, so this is not needed separately.

### Not usable
- **SGDP** (Mallick 2016, *Nature* 538:201, PMID 27654912): 279 public
  genomes, but West Eurasian groups have 1–3 each (frequency SE ≈ ±0.2).
- **Estonian Biocentre** (`evolbio.ut.ee`): Behar 2010 Jewish set, 466
  samples at 555,737 GRCh37 SNPs (Ashkenazi 18, Sephardi 19, Moroccan 15,
  Yemenite 15, Ethiopian 13, Iraqi 11, Indian 8 …, plus Jordan, Iran, Turkey,
  Syria, Egypt, Cyprus, Saudi, Lebanon, Armenia comparators). The only terms
  are "please cite the papers and contact mait@ebc.ee": **no licence to
  redistribute derived tables.** Blocked unless the authors grant it.
- **POPRES**: dbGaP controlled access.
- **rye** (Conley 2023, *NAR* 51:e44, PMID 36928108): method only; ships no panel.

## B. Methods for one unphased genome

### 23andMe Ancestry Composition (Durand et al., 2014, updated 2020)
- White paper: `https://permalinks.23andme.com/pdf/23-16_ancestry_composition.pdf`.
- String-kernel SVM on 300-marker windows (~0.6 cM), then an autoregressive
  pair-HMM with an explicit phase-switch indicator, fitted per person by EM.
- Confidence by **posterior aggregation up a four-level hierarchy**: each
  window is assigned to the lowest node whose summed posterior exceeds a
  precision threshold t ∈ [0.5, 1).
- Reference: ~14,445 people in 45 populations, only 2,027 public. Ashkenazi
  Jewish 1,007 (none public); Levant 400 (52); Britain & Ireland 1,014 (79);
  Central & West Europe 957 (21); Scandinavia 631 (0); Finland 364 (85).
- Five-fold CV precision / recall at t = 0.5: **Ashkenazi 99.3 / 98.6**;
  Finland 93.5 / 95.3; Britain & Ireland 95.4 / 88.5; Scandinavia 90.8 / 90.7;
  **Central & West Europe 79.7 / 81.3**; East Europe 85.9 / 88.8; Levant 93.8 /
  70.5; Arabia 88.2 / 70.3; Turkey 86.2 / 67.6; Caucasus, Assyria & Iran 67.1 /
  92.9; Maghreb 97.4 / 89.9.
- Lesson: Ashkenazi ancestry is separable at ~99% precision, but it took 1,007
  reference genomes, none public; ~950 Central & West Europeans still give 80%.

### AncestryDNA Ancestral Regions white paper (9 Oct 2025)
- 185,063 reference samples, 146 regions. Public contributions: ~1,000 HGDP
  (49 populations), ~2,500 1000G (19), ~900 Human Origins (84).
- SideView phasing, 1,001 windows, BEAGLE haplotype-cluster emissions trained
  on ~50,000 people, an HMM with K×K×2 states (two parents' populations and
  which haplotype is which), so **phase error is modelled, not assumed away**;
  Viterbi for the estimate and **1,000 posterior path samples for the range**.
- Single-origin validation (17,625 people; overlap / precision): Ashkenazi in
  Eastern Europe & Russia 65.4 / 63.5; Finland 98.5 / 75.1; Norway 95.7 / 73.0;
  **Netherlands 89.4 / 42.6; NW Germany 79.8 / 36.5; S Germany 71.5 / 35.2;
  France 45.7 / 34.1**. Mean 84.3 / 72.0. Admixed simulation (30,249):
  precision 88.3%; Eastern Czechia 7.1%.
- Lesson: report single-origin and admixed validation separately; they
  diverge. Country-level splits of north-west Europe are not supported even
  with 185k references.

### Phase-free local ancestry
- Avadhanam S, Williams AL. "Phase-free local ancestry inference mitigates the
  impact of switch errors on phase-based methods." *G3* 15:jkaf122 (2025).
  PMID 40471844, CC BY 4.0.
- On simulated African/European admixture, HAPMIX and LAMP-LD (phase-free)
  correlate 2.6–4.6% better with truth than RFMix v2 and FLARE (phase-based),
  still 2.4–3.8% after TRACTOR correction. Phase-based tracts bias admixture
  time upward by ≈10 generations; phase-free calls show virtually none.
- **The justification for Lineage's unphased painter.**

### Gnomix
- Hilmarsson H, et al. "Scalable high resolution ancestry deconvolution for
  genomic data." *Nature Communications* 17 (2026). PMID 42649165, CC BY.
- Window classifier + learned smoother; on array data small windows perform
  poorly and non-linear window models help. Probabilities are calibrated by
  **isotonic regression fitted on data not used to train the smoother and
  evaluated on a separate test set**. Needs phased input.
- **Use the calibration recipe.**

### Others
- **FLARE** (Browning 2023, PMID 36610402): needs phased, complete genotypes;
  Apache 2.0. Model form already borrowed.
- **Recomb-Mix** (2025): degrades on array data. No.
- **Orchestra / SALAI-Net**: large models, non-redistributable training data. No.
- **Loter** (Dias-Alves 2018, PMID 29931083): needs phased haplotypes. No.
- **rye**: NNLS on PC coordinates; R² 0.998–1.00 against RFMix/ADMIXTURE for
  three-way admixture. Possible second estimator later.
- **OADP** (Zhang, Dey, Lee 2020, *Bioinformatics* 36:3439, PMID 32196066):
  projection from loadings is biased toward zero; fix with the asymptotic
  shrinkage of Dey & Lee 2019 (*J Multivar Anal* 173:145, PMID 32831421),
  which generalises Lee, Zou & Wright 2010 (*Ann Stat* 38:3605, PMID 21442047).
- **fastNGSadmix** (Jørsboe 2017, PMID 28957500): corrects for small reference
  populations by carrying each population's size (`nInd`) and re-estimating
  frequencies jointly; site bootstrap for intervals.
- **iAdmix** (Bansal & Libiger 2015): ML admixture from reference frequencies
  alone; precedent for frequency-only references.
- **SNPweights** (Chen 2013, *Bioinformatics* 29:1399, PMID 23539302): a
  European-American model with NW European, SE European and Ashkenazi
  ancestral populations; precedent for an Ashkenazi reference inside Europe.
- **SCOPE**: unsupervised, cohort-scale. No.
- **FRAME** (Shakya 2026, *Bioinformatics Advances* 6:vbag006): "panel
  refinement" (filtering references to homogeneous individuals) improved
  Gnomix RMSE 15–23%; swapping 1KG for HGDP changes estimates for the same
  person. Supports reference curation and naming the panel on the page.

## C. Calibration and validation standards
- **haptools simgenotype** (Massarat 2023, *Bioinformatics* 39:btad104,
  PMID 36847450): admixed genomes with known breakpoints from 1000G under a
  stated model. The standard replacement for splicing blocks.
- **stdpopsim** `AmericanAdmixture_4B18` (admixture 12 generations ago; 1/6
  AFR, 1/3 EUR, 1/2 Asia): a known generative model for interval checks.
- **Reliability**: "predictions assigned a probability of X% should be correct
  X% of the time" (Gnomix), enforced by isotonic regression on held-out data.
- **Held-out designs**: 23andMe five-fold stratified CV; AncestryDNA reserves
  up to 500 test + 500 validation samples per panel; both report single-origin
  and admixed results separately.
- **Interval coverage**: AncestryDNA "run[s] a separate analysis to validate
  the range results in our simulation datasets to ensure that the expected
  value is captured within the range most of the time."

## D. Phasing and haplotype-based fine-scale ancestry in a browser
- No JavaScript/WASM phaser exists (weIMPUTE and EagleImp-Web are server
  side; genotype-workbench does no phasing or local ancestry).
- Size: Beagle's GRCh37 1000G bref3 is 513 MB for chr1; a 2,504-sample
  haplotype panel at 85.7k sites is ~54 MB raw before anything else.
- ChromoPainter/fineSTRUCTURE (Lawson 2012, *PLoS Genet* 8:e1002453, PMID
  22291602) and AncestryDNA's Genetic Communities (Han 2017, *Nat Commun*
  8:14238; 774,516 customers, 20M genealogical records) need donor haplotypes
  that are not open (People of the British Isles could not be confirmed as
  downloadable; POPRES is controlled).
- **Verdict: no phaser, no haplotype panel, no fine-scale painting.** With the
  phase-free result above this is a defensible design, not a gap.

## E. Uncertainty from few SNPs
- **Reference frequencies are estimates.** Rannala B, Mountain JL. "Detecting
  immigration by using multilocus genotypes." *PNAS* 94:9197–9201 (1997). PMID
  9256459. Integrates allele frequencies out under a Dirichlet prior using the
  reference counts. The equations could not be read in the session; the
  biallelic form used by Lineage is re-derived in the report (Beta(½,½), the
  1/k prior as usually attributed to Rannala & Mountain).
- An Ashkenazi group of 8 (AADR) has a frequency SE ≈ 0.12 at p = 0.5; gnomAD
  ASJ (1,736) ≈ 0.008.
- **Unbalanced references bias admixture** (Toyama 2020, *Mol Ecol Resour*
  20:1769, PMID 32735380): weak differentiation and drift amplify it; more
  markers reduce it.
- **Block bootstrap**: blocks should be defined in cM (5–10 cM), longer than
  the admixture tracts that make neighbouring SNPs co-vary; 50-SNP blocks
  (~1.7 cM) are anti-conservative. Check coverage on simulated genomes.
