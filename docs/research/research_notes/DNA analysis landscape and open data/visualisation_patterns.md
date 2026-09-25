# Visualisation and interface patterns for ancestry, genetic genealogy and genomics data (as of 25 September 2026)

*Research note: sources were read on 2026-09-25. Items marked "(search summary)" come from search-result summaries of the named page. That page was not opened, so treat those items as lower confidence. Library sizes, colour-vision simulations and contrast ratios were measured locally in this session. The method is given where they appear. Lineage context: the app is vanilla TypeScript and SVG. Its knowledge base currently holds 1000 Genomes phase 3 frequencies for the five super-populations only (AFR, AMR, EAS, EUR, SAS in `packages/kb/src/ensembl-verified.json`), so the 26-population views below are a redesign target.*

## 1. Ancestry displays: 23andMe, AncestryDNA, Journeys, MyHeritage, Living DNA and FTDNA myOrigins

### Takeaway
Every major product uses the same skeleton:
- a ranked list of percentages inside a region hierarchy;
- a map of soft regions;
- optionally, a chromosome painting and a split by parent;
- one visible uncertainty device: 23andMe's 50–90% confidence slider, Living DNA's Cautious/Standard/Complete views, AncestryDNA's percentage ranges that can include zero, or MyHeritage's low/medium/high confidence on genetic groups.

Since 2025 the commercial trend is toward cleaner defaults. 23andMe v7 removed "Broadly" and "Unassigned" from its default view. Research on user reactions shows that disputes cluster where reference panels overlap. An open "what we know" tool should therefore keep uncertainty and reference-panel provenance on the surface, not hide them.

### Cited Findings

**23andMe Ancestry Composition (the business is now owned by TTAM Research Institute)**
- TTAM Research Institute, a nonprofit public benefit corporation led by Anne Wojcicki, completed its acquisition of 23andMe's Personal Genome Service in July 2025. 23andMe continues to operate under it — [23andMe media center (search summary)](https://mediacenter.23andme.com/press-releases/ttam-research-institute-nonprofit-public-benefit-corporation/). The old customercare.23andme.com help URLs now redirect to support.23andme.org, which returned HTTP 403 to automated fetches on 2026-09-25 (observed in this session).
- **Chromosome painting layout:** 22 autosome pairs plus the X chromosome(s), with each pair shown as two chromosomes side by side. Each colour is one population in the composition. Hovering a row of the composition list highlights that population's segments, which helps with small percentages — [Data Mining DNA, 27 Aug 2021](https://dataminingdna.com/23andme-chromosome-painting/).
- **Confidence slider:** the painting is computed one small piece of DNA at a time, with a probability for each population. The default requires more than 50% confidence ("allows the most DNA to be assigned"). Example: a segment that is 55% likely Japanese is painted Japanese at 50% but becomes "Broadly East Asian" or "Unassigned" at 60–90%. Raising the level produces more "Broadly" and "Unassigned" DNA — [23andMe Customer Care (search summary)](https://customercare.23andme.com/hc/en-us/articles/212860507-DNA-Painting-23andMe-Ancestry-Results).
- The slider moves in 10% steps from 50% to 90%. The author's 0.2% Nigerian assignment disappeared at 60% and was absorbed into "Broadly West African" — [Data Mining DNA](https://dataminingdna.com/23andme-chromosome-painting/).
- **Split by parent:** when parents have tested, maternal chromosomes are drawn on top and paternal below. Without parental data 23andMe "cannot determine which chromosome is from your mother or your father". Some customers report populations assigned to the wrong parent — [Data Mining DNA](https://dataminingdna.com/23andme-chromosome-painting/).
- **Ancestry Timeline:** estimates how many generations ago the most recent ancestor from each population lived, shown as a range "to allow for the randomness" of inheritance. Examples: a 100% Ashkenazi ancestor 1–2 generations ago, a 100% Iberian ancestor 5–8 generations ago. For admixed groups such as Latinos and African Americans, the single-ancestor assumption may fail and the result is "a place to start" — [23andMe for Healthcare Professionals (search summary)](https://medical.23andme.com/23andmes-new-ancestry-timeline/); [23andMe Customer Care: DNA Ancestry Timeline (search summary)](https://customercare.23andme.com/hc/en-us/articles/115004342967-DNA-Ancestry-Timeline).
- **Version 7 (29 Sep 2025):**
  - adds 33 new populations in Europe and 6 in the Americas;
  - a new phasing pipeline "reduces errors";
  - the algorithm eliminates "Broadly" and "Unassigned" categories in the default results view, and Premium members can access previous versions at different confidence thresholds;
  - a "Version History" section lets customers compare new results with previous ones;
  - the palette became "a gradient across the world", so that populations close together geographically get more similar colours.

  Source: [23andMe blog, v7](https://www.23andme.org/blog/articles/ancestry-composition-version-7-is-here).
- **March 2026 features:**
  - "Reconstructed Ancestors" predicts the ancestry composition of untested parents and grandparents from the DNA of tested relatives, using the GRAMPA algorithm. Each ancestor gets a profile showing "what percentage of their DNA is inherited from that ancestor" and their "likely ancestry".
  - "DNA Relatives Clustering" produces "a map that clusters relatives into specific family branches".
  - Both are for Premium and Total Health subscribers only.

  Sources: [23andMe press release](https://www.23andme.org/media-center/press-releases/23andme-introduces-reconstructed-ancestors-a-first-of-its-kind-dna-discovery-tool/) (the text says launched 17 March 2026) and [GlobeNewswire copy dated 13 March 2026](https://www.globenewswire.com/news-release/2026/03/13/3255434/0/en/23andMe-Introduces-Reconstructed-Ancestors-a-First-of-Its-Kind-DNA-Discovery-Tool.html). The two dates differ.

**AncestryDNA**
- **Current ethnicity page:**
  - an interactive map where you "hover over regions to highlight all the subregions they contain" and "click on a region to zoom in";
  - 146 populations and 3,600+ places;
  - a reference panel of 185,000+ samples (up from 116,800);
  - "macro-regions" that group specific regions;
  - results show "the most likely percentage" first and a "possible percentage range" in the detail view. Ranges can include zero, meaning "there is a chance you have no DNA related to this region";
  - a "By parent" view (SideView) that works "even if they've never taken a DNA test";
  - shareable "DNA Highlights", a "highlight reel" available in the US, UK, CA and AU.

  Source: [Ancestry, next-generation ethnicity estimate](https://www.ancestry.com/c/dna/ancestry-dna-ethnicity-estimate-update).
- The 2025 update was billed as the largest ever. It added regions including the Levant, the Arabian Peninsula, Egypt and Bengal, and some members were not due to receive it until December 2025 — [Know Who Wears the Genes, 2025 update (search summary)](https://www.knowwhowearsthegenesinyourfamily.com/blog/my-2025-ancestrydna-origins-update-the-biggest-ethnicity-update-yet).
- A guide to the 2025 update describes an Origins tab with exploration "by parent" or through a colour-coded map, a side-by-side comparison with relatives, and macro-regions that some users found confusing. It advises comparing current results with previous updates and with close relatives rather than trusting one snapshot — [Genealogy Griot, 12 Nov 2025](https://genealogygriot.com/2025/11/12/how-to-navigate-the-2025-ancestrydna-update/).
- **Chromosome painter** (beta by August 2022, in the "DNA Story" tab): Parent 1 and Parent 2 rows across the 22 autosomes. A commenter found the colours "a challenge to identify". The author found that Ancestry "favors solid chromosomes of a single ethnicity" where 23andMe shows more variation, and suspects the algorithm "penalizes a switch from one ethnicity to another". Whole chromosomes were painted Scottish or Swedish with no documented ancestry there — [The DNA Geek](https://thednageek.com/chromosome-painting-at-ancestry/).
- Ethnicity estimates are "percentages accompanied by colorful maps" reflecting roughly 500–1,000 years ago. "We don't expect them to be perfect–or even close to perfect–for many years." Small reference panels confuse Hawaiian and Māori, and one French/German update was "a big shift in the wrong direction" — [The DNA Geek, 20 Aug 2022](https://thednageek.com/ancestrydna-updates-their-ethnicity-estimates/).
- **Journeys** (formerly Genetic Communities) are groups of members who share recent ancestors (no more than about 325 years back) from the same place. They are built from match networks plus the birth places in linked trees, and shown as a map of places and migration routes with a timeline of historical events. North America has about 1,700 journeys and Oceania 32 — [Family Tree Magazine (search summary)](https://familytreemagazine.com/dna/why-you-should-pay-attention-to-your-ancestrydna-journeys/); [Ancestry support (search summary)](https://support.ancestry.com/s/article/AncestryDNA-Communities?language=en_US); [Ancestral Journeys white paper, Sep 2024](https://www.ancestrycdn.com/support/us/2024/09/ancestraljourneyswhitepaper2024.pdf).

**MyHeritage**
- Ethnicity Estimate v2.5 (February 2025) went from 42 to 79 regions, including 24 percentage-based European ethnicities and 15 Jewish ethnicities. The map outlines Genetic Groups in black, and users can switch between v0.95 and v2.5. Downloadable video summaries are offered. Match ethnicities were hidden after the 23andMe data breach. Commenters reported "erratic" results among siblings and loss of Indigenous American ancestry — [DNAeXplained, 6 Feb 2025](https://dna-explained.com/2025/02/06/myheritage-introduces-ethnicity-v2-5/).
- **Genetic Groups:**
  - there are 2,114 groups;
  - membership has no percentage: you are in a group or not;
  - each group has a low, medium or high confidence level, based on the quality and quantity of shared segments, shown when you hover the name or map polygon;
  - groups are drawn as polygons with a thin border, while ethnicities have no border.

  Sources: [MyHeritage Knowledge Base (search summary)](https://education.myheritage.com/article/genetic-groups-on-myheritage/); [MyHeritage blog, Dec 2020](https://blog.myheritage.com/2020/12/myheritage-launches-genetic-groups/).

**Living DNA**
- Offers 21 sub-regions of Britain and Ireland, 150+ world regions and 72 regions within Africa — [Living DNA (search summary)](https://livingdna.com/british-ancestry); [Wikipedia](https://en.wikipedia.org/wiki/Living_DNA).
- Results have three views:
  - **Cautious** groups similar populations "to provide the highest certainty";
  - **Standard** shows the sources it is most certain about, with the rest "unassigned";
  - **Complete** is the "best estimate of your overall genetic makeup".

  Regions that survive every view are the high-confidence ones — [Who Are You Made Of (search summary)](https://whoareyoumadeof.com/blog/how-to-understand-living-dna-results/).

**FamilyTreeDNA myOrigins 3**
- Population Clusters appear as colour-coded map regions, and clicking one opens its description in a sidebar. Results are hierarchical (super populations within each continent), and colour intensity shows how much of your DNA comes from each place. Europe and the Middle East went from 12 reference populations in v2 to 27 in v3 — [FTDNA Help (search summary)](https://help.familytreedna.com/hc/en-us/articles/4401981569423-Population-Clusters); [FTDNA blog (search summary)](https://blog.familytreedna.com/myorigins-3-is-here/); [DNAeXplained preview (search summary)](https://dna-explained.com/2020/02/28/sneak-preview-familytreednas-myorigins-version-3-0/).

**What users like, dispute and misread**
- **Behnamian, J. Community Genetics, 2026:** 58,133 posts (Reddit 40,000 from Aug 2020–May 2025; YouTube 17,133; Google Play 1,000).
  - Acceptance (9.5%) and excitement (9.4%) were the most common reactions. Dispute appeared in 8.6% of posts.
  - Dispute rates were highest for Turkish (23.5%), Greek (19.7%) and Scandinavian (18.5%) results.
  - Self-identified ethnicity matched results in only 61.8% of cases, and about 46% of posters reported surprise.
  - The authors recommend that high-dispute ancestries get "additional information about reference panel composition, regional genetic overlap, or the distinction between genetic ancestry and ethnic identity".

  Source: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13221540/).
- Users of third-party raw-data interpretation services (Lineage's category) were highly satisfied, yet reported difficulty understanding the results regardless of satisfaction — [Consumer use and response to online third-party raw DNA interpretation services (search summary)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5823680/).

### Inferences
Pattern cards for Lineage. Each gives what it shows, the layout, encodings, uncertainty handling and the phone version.

- **A1. Estimate-and-interval list (the primary view).**
  - Layout: one row per group, nested under its super-population (like Ancestry's macro-regions and FTDNA's super populations).
  - Encodings: a dot for the estimate and a horizontal bar for the interval, on a shared 0–100% axis. Print the figures in mono tabular digits, e.g. `EUR 62% (55–70)`. When an interval includes 0, grey the row and use Ancestry's plain wording: "could be none".
  - Order: by estimate within each group; super-population rows show the summed estimate.
  - Phone: the same list at full width, with the interval bar on its own line under the label. Tap a super-population to open its sub-rows.
  - Why it works: the interval is visible without a click, so users see the range, not a false-precision number.
- **A2. Confidence dial.** A three-stop segmented control: Cautious / Standard / Complete (Living DNA's words, which are clearer than a raw 50–90% slider).
  - At higher confidence, sub-groups merge into their parent ("Broadly European"), and an "Unassigned" row grows.
  - Animate the merge (sub-rows sliding into the parent row) unless `prefers-reduced-motion` is set.
  - 23andMe moved its slider out of the default view in 2025. For a tool about "what we know", keeping it visible is a point of difference.
- **A3. Chromosome painting, only when the method produces per-segment calls.**
  - Desktop: 23andMe layout, 22 pairs plus X as vertical pairs in a grid.
  - Phone: one horizontal bar per chromosome, with width proportional to length.
  - Hovering or tapping a legend row highlights that group's segments.
  - If Lineage only estimates global proportions, do not draw a painting. Ancestry's painter shows how painted output reads as literal truth, even when it is a smoothing artefact.
- **A4. Map of reference samples, not national polygons.**
  - Show each reference population as a point at its sampling place, with a soft halo and no borders. MyHeritage keeps ethnicities borderless and outlines only its high-resolution groups, and the lack of edges reads as fuzziness.
  - Halo opacity shows the person's contribution.
  - The tooltip gives the provenance, e.g. "YRI: Yoruba in Ibadan, Nigeria, 1000 Genomes phase 3".
  - The map is secondary to the list. On a phone it sits below the list as a "where these reference samples come from" locator.
- **A5. Reference-panel card, answering Behnamian's recommendation.** A "Why this might be wrong" panel beside each group:
  - which reference samples define it and how many;
  - which groups it is often confused with (start with the high-dispute ancestries in Behnamian 2026: Turkish, Greek, Scandinavian);
  - a note that genetic similarity is not ethnicity.

  This is the "what we know" display the owner asked for.
- **A6. Version and relative comparison.**
  - Two-column "then and now" dumbbell rows when the reference data or method changes (23andMe Version History, MyHeritage v0.95 vs v2.5).
  - The same rows compare two loaded kits (for example, parent and child), following Genealogy Griot's advice to read results against relatives.
- **A7. Timeline of ancestors, only if Lineage estimates segment-length-based dates.** Draw generation ranges as horizontal bars on a calendar-year axis (for example, "born 1790–1850"), with the admixed-population caveat printed under the chart, as 23andMe does. Otherwise use a static explainer: "these estimates describe roughly the last 500–1,000 years".
- **A8. Colour:** follow 23andMe v7's geographic-gradient idea. Give each super-population a hue family and step lightness within it, so neighbouring populations get similar colours (see section 8 for the colour-vision limits).

### Gaps
- 23andMe's current help pages (support.23andme.org) returned 403, so the slider and split-view details come from older help-page text and a 2021 third-party guide. Whether the slider remains outside Premium after v7 is unverified.
- No first-hand 2026 screenshots of the AncestryDNA 2025 region map or the Journeys migration map were examined. Details come from Ancestry's marketing page and third-party guides.
- MyHeritage AutoClusters and the MyHeritage map encodings (colours, how polygons are drawn) were not verified.
- FTDNA myOrigins 3 margin-of-error display (if any) was not found.

## 2. Allele-frequency maps and per-population values at 26 sampling points (GGV, gnomAD, Ensembl, OWID)

### Takeaway
The reference design is the Geography of Genetic Variants (GGV) browser. It draws one pie per population:
- the pie shows the minor-allele frequency;
- the frequency scale is rescaled so rare variants stay visible;
- transparency encodes sampling error (n < 30 fades);
- a force-directed layout stops pies overlapping while keeping them near their true origin.

Research browsers such as Ensembl and gnomAD pair that kind of graphic with a hierarchical table: super-population rows that expand into sub-populations, with allele counts. For 26 points on a 390px screen, a grouped dot plot with confidence intervals is more legible than 26 pies on a map. The map works best as a secondary "where" view.

### Cited Findings
- **GGV design:**
  - SVG and D3 mapping;
  - "each pie chart represents a population with the blue slice of the pie displaying the frequency of the global minor allele" (the major allele is the yellow slice);
  - "we re-scale frequencies, so that small frequencies become visible", with a colour legend for the transformed scale;
  - "estimated frequencies with higher levels of sampling error (e.g. those from samples with n < 30) are made more transparent";
  - "force-directed layouts of the populations such that no two points are overlapping each other, and yet the points will be pulled towards their true origins";
  - hover shows labels and exact frequencies;
  - datasets: 1000 Genomes and HGDP; lookup by position, rsID or at random.

  Sources: [Marcus & Novembre 2017, Bioinformatics (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5408806/); [OUP](https://academic.oup.com/bioinformatics/article/33/4/594/2608633). The tool is at http://popgen.uchicago.edu/ggv/ and the code at [NovembreLab/ggv](https://github.com/NovembreLab/ggv).
- **Ensembl:**
  - "Population Genetics" pie charts for 1000 Genomes;
  - the five super-populations sit on the top row, and a plus button expands the sub-populations onto rows below;
  - hovering a three-letter code shows the population name;
  - example: AFR A = 0.73, C = 0.27.

  Sources: [Ensembl Help (search summary)](http://www.ensembl.org/Help/View?id=171); [Ensembl populations page](https://grch37.ensembl.org/info/genome/variation/species/populations.html).
- **gnomAD labelling (1 Nov 2023):**
  - "population" became "genetic ancestry group", because these are "inferred, artificially-created clusters of individuals";
  - "Other" became "Remaining individuals", and "Latino/Admixed American" became "Admixed American";
  - groups are assigned by PCA plus a random-forest classifier, and 31,256 v4 samples could not be labelled;
  - "genetic ancestry is a continuous measure".

  Source: [gnomAD news](https://gnomad.broadinstitute.org/news/2023-11-genetic-ancestry/).
- gnomAD's frequency table is split by genetic ancestry group (afr, amr, asj, eas, fin, mid, nfe, remaining, sas) and by sex. Exome and genome data can be toggled, and filtered variants are excluded by default — [gnomAD (search summary)](https://gnomad.broadinstitute.org/news/2023-11-genetic-ancestry/).
- **The 26 phase 3 populations include diaspora samples:**
  - CEU: Utah residents of N/W European ancestry
  - GIH: Gujarati in Houston
  - ASW: African ancestry in the southwestern US
  - ACB: African Caribbean in Barbados
  - STU and ITU: Sri Lankan Tamil and Indian Telugu sampled in the UK
  - MXL: Mexican ancestry in Los Angeles

  Source: [Wikipedia, 1000 Genomes Project](https://en.wikipedia.org/wiki/1000_Genomes_Project). The fetched summary listed 25 populations and dropped PEL (Peruvian in Lima), the fourth AMR population.
- **Our World in Data** always displays the data source prominently, and "Learn more about this data" opens an overlay with more detail — [OWID, redesigning our interactive data visualizations (search summary)](https://ourworldindata.org/redesigning-our-interactive-data-visualizations).
- **FT Visual Vocabulary** lists the options:
  - spatial: choropleth, proportional symbol, flow map, contour map, equalised and scaled cartograms, dot density, heat map;
  - distribution: dot strip plot, dot plot, barcode plot, histogram and others.

  Source: [FT chart-doctor](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary).

### Inferences
- **B1. Grouped dot strip with intervals (the primary view).** 26 rows under 5 super-population headers, at about 18px per row (roughly 470px tall).
  - x axis: 0–100%. Switch to a log or "1 in N chromosomes" axis when the maximum frequency is under 5%.
  - Encodings: a dot for the allele frequency, and a whisker for a 95% binomial interval (Wilson) computed from allele counts.
  - Within each group, sort rows by frequency, or by geography to keep the map order.
  - Pin a "You: 1 copy of G" marker at the top, not on the axis. A genotype is not a frequency.
  - On a phone this needs no horizontal scroll.
- **B2. GGV-style map as the secondary view.**
  - At 390px the Equal Earth world is about 358px wide, so pies shrink to about 12px and crowd over Europe, South Asia and East Asia.
  - Alternative: fixed-size circles filled from a perceptually ordered sequential ramp (Tol iridescent, viridis or cividis). Pies only work for two-allele (biallelic) sites, while filled circles also suit "frequency of your allele".
  - Borrow GGV's opacity rule for small n. Borrow its force layout (d3-force with forceX/forceY toward the true coordinates and forceCollide), which costs about 4.4KB gzip (section 9).
  - For diaspora samples, draw the point at the sampling site with a thin dashed leader to the ancestral region (GIH: Houston to Gujarat), and say so in the tooltip. This teaches how the reference data was collected.
- **B3. Table fallback, gnomAD/Ensembl style.**
  - Columns: group, allele count, allele number, frequency, homozygotes.
  - Super-population rows expand to sub-populations.
  - The table is also the accessible alternative (section 8) and the "Data" tab.
- **B4. Small multiples for trait variants.** One mini dot strip (or mini map) per trait SNP, 2 columns on phones and 4–6 on desktop, all on the same x scale so users can compare variants at a glance.
- **B5. Wording:** use "reference sample" and "genetic ancestry group" (gnomAD's terms), never race labels. Put the source line ("1000 Genomes phase 3 via Ensembl, retrieved 2026-09-24") under every chart, as OWID does.

### Gaps
- GGV's exact rescaling function and colour ramp could not be confirmed from the text. The live site was not opened.
- The GGV paper excerpt did not say whether GGV places diaspora samples at the sampling site or the ancestral region.
- Per-population sample sizes for 1000 Genomes were not retrieved (Ensembl's population page timed out). The IGSR portal should be checked before computing intervals.

## 3. PCA and genetic-similarity scatter plots, and ancient-DNA time maps

### Takeaway
In research, the canonical figure is a PCA cloud of reference individuals coloured by group, with new samples projected on top. Novembre et al. (2008) showed that rotating the PC axes can make European genetic variation mirror the map. gnomAD uses PCA plus a classifier to assign groups.

The known caveats should shape the interface:
- projected samples shrink toward the centre;
- PCA patterns can be biased (Elhaik 2022);
- the National Academies (2023) ask for the words "genetic similarity" rather than "ancestry" labels.

Ancient-DNA explorers (DORA, Human AGEs, AADR Visualizer) share one pattern: a map of dated samples, a time histogram with a range brush, and a detail card with the publication.

### Cited Findings
- **Novembre et al. (Nature, 6 Nov 2008):** 1,387 Europeans. "The PC axes are rotated to emphasize the similarity to the geographic map of Europe", and Italy and Iberia are recognisable — [Nature](https://www.nature.com/articles/nature07331); [PMC figure](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2735096/figure/F1/); [resources repo](https://github.com/NovembreLab/Novembre_etal_2008_misc).
- **Projection shrinkage:** when individuals are projected onto a 1000 Genomes PCA, a shrinkage bias appears that becomes large for PC5 and beyond. Removing LD and correcting the bias is recommended (bigsnpr) — [Privé et al. 2020, Bioinformatics (search summary)](https://academic.oup.com/bioinformatics/article/36/16/4449/5838185).
- **Elhaik (Scientific Reports, 29 Aug 2022):** PCA-based findings in population genetics are "highly biased and must be reevaluated", with implications that reach commercial ancestry tests — [Nature Sci Rep](https://www.nature.com/articles/s41598-022-14395-4).
- **National Academies report (May 2023):** 13 recommendations. Researchers using such measures should "explicitly refer to genetic similarity" rather than use "genetic ancestry" as shorthand, and race and ethnicity should not be used as proxies for genetic ancestry groups — [NHGRI summary](https://www.genome.gov/about-nhgri/Director/genomics-landscape/may-4-2023-nasem-report-population-descriptors-genetics-genomics-research); [NAP report](https://www.nationalacademies.org/read/26902/chapter/2).
- **Probabilistic ancestry maps (Gaspar & Breen, BMC Bioinformatics 2019):**
  - use Generative Topographic Mapping instead of PCA;
  - nodes are "coloured by most probable ancestry" using posterior probabilities;
  - new samples are "directly projected onto a pre-constructed GTM map";
  - the maps separate Japanese from Han Chinese, and Mende from Yoruba, where PCA fails;
  - the method returns class-membership probabilities.

  Source: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6407257/). Code is at [hagax8/ancestry_viz](https://github.com/hagax8/ancestry_viz) and an interactive version at [lovingscience.com/ancestries](https://lovingscience.com/ancestries).
- **gnomAD** assigns genetic ancestry groups by running PCA, then training a random forest on the PCs of labelled samples — [gnomAD](https://gnomad.broadinstitute.org/news/2023-11-genetic-ancestry/).
- **DORA (NAR web-server issue, July 2024):**
  - Natural Earth topographic base in equirectangular projection;
  - AADR samples drawn as dots coloured by a chosen attribute (coverage, date);
  - "a timeline that shows the number of available samples in predefined temporal bins (in 100s of years)" with a slider whose "blue transparent background" sets which samples are shown;
  - a STRUCTURE plot of the displayed samples;
  - CHELSA TraCE21K climate layers.

  Source: [OUP NAR](https://academic.oup.com/nar/article/52/W1/W54/7671306). The tool is at [dora.modelrxiv.org](https://dora.modelrxiv.org).
- **Human AGEs (NAR, May 2023):**
  - OpenLayers and Plotly;
  - a timeline with "two draggable intervals" (one for visibility, one for filter bounds);
  - point and heat-map layers, plus pie charts and tag clouds for attribute frequencies;
  - cluster size depends on sample count;
  - data: Y and mtDNA haplogroups, admixture proportions for K = 2–13, and PCA/UMAP embeddings.

  Source: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10320146/). The tool is at [archeogenomics.eu](https://archeogenomics.eu/).
- **AADR Visualizer (Bioinformatics Advances, 18 Aug 2025):**
  - ArcGIS Online, with "all 13 571 ancient humans from AADR Dataverse 9.0 (v62.0, September 16, 2024)";
  - clustered points coloured by SNP coverage (dark blue under 100,000 SNPs, brown over 500,000) with count labels;
  - a radiocarbon-date slider;
  - pop-ups in three parts: ID and date, a data table, publication links;
  - filters by country, region, haplogroup and Group ID;
  - a linked attribute table for download.

  Source: [OUP](https://academic.oup.com/bioinformaticsadvances/article/5/1/vbaf199/8238351).
- The Poseidon Archive Explorer is a newer ancient-DNA browsing interface from the Poseidon project — [Poseidon blog (title only)](https://blog.poseidon-adna.org/posts/Archive_explorer_Blogpost.html).

### Inferences
- **C1. "You are here" similarity plot.**
  - Reference individuals: small dots at about 0.35 opacity, or one density contour per super-population (d3-contour, about 3KB gzip), so thousands of points do not become a blob.
  - The person: a large ringed marker with thin crosshair lines to both axes and a direct label, "You".
  - Label super-population centroids directly instead of using a legend.
  - Axis titles: "PC1 (x% of variation)".
  - Put the caveat in the caption: "Projected samples are pulled toward the centre, so read distance to clusters loosely." Title it "Genetic similarity to reference samples", following the National Academies wording.
  - Phone: a square at full width (358px) with centroid labels only; tap a cluster to reveal its sub-population codes. Use d3-delaunay (7KB gzip) for nearest-point tap targets.
- **C2. Probability surface instead of hard clusters.** Tint the background by the most probable group, with lightness set by probability (GTM-style), and add a stacked bar of the person's membership probabilities under the plot. Where clusters overlap, the uncertainty then shows directly.
- **C3. Map-aligned toggle, Europe only.** Offer "Rotate to compare with the map" (after Novembre 2008) as an explorable. Do not use it for world-wide PCAs, where the analogy breaks down.
- **C4. Ancient-DNA time map.**
  - Map: Equal Earth on desktop, a cropped regional view on phones. Samples are dots coloured by age on a sequential ramp, or by cluster.
  - A 100-year-bin histogram with a brush sits under the map, as in DORA.
  - A play button slides the window. Disable autoplay under reduced motion.
  - Tapping a dot opens a sample card with date, place, coverage and a publication link (AADR Visualizer). Cluster dense points with count labels.
  - Phone: swap the two-thumb brush for an era stepper ("8000–6000 BP"), because two-thumb sliders are hard to drag on touch screens.

### Gaps
- No consumer-grade "you on a PCA" product was verified (G25/Vahaduo-style tools were not researched because the search budget ran out).
- No usability studies were found on how lay users read PCA plots.
- Details of the Poseidon Archive Explorer were not read.

## 4. Genetic-genealogy tools: segment maps, clusters and relationship probabilities

### Takeaway
The genealogy community has settled visual idioms:
- **Chromosome browsers:** horizontal bars per chromosome, with each shared segment coloured by match or ancestor.
- **Two-tier comparisons**, such as GEDmatch's half/full-identical colours with a threshold bar beneath.
- **Cluster heatmaps:** Genetic Affairs AutoCluster, with grey cells for matches that belong to several clusters.
- **Colour-column spreadsheets:** the Leeds method.
- **Probability displays** that combine a ranked table of relationship groups with a histogram of real observations: DNA Painter's Shared cM tool and "What Are the Odds?" (WATO) hypothesis trees, plus MyHeritage's cM Explainer, which adds age.

### Cited Findings
- **DNA Painter chromosome map (15 Mar 2021):**
  - users paint match segments into colour-coded ancestor groups;
  - "Highlight match" puts "a dark shadow" around that match's segments and darkens a "track that spans the entire height of the chromosome", including overlapping segments on the "unknown or both" row;
  - the chromosome number stays pinned in expanded views;
  - search can be cleared with Escape.

  Source: [DNA Painter blog](https://dnapainter.com/blog/latest-dna-painter-updates-highlighting-a-match-more/).
- **DNA Painter trees:**
  - pedigree, fan and text views, built by hand or from a GEDCOM;
  - colour-coding with preset palettes;
  - DNA inheritance overlays for X, Y and mtDNA;
  - "tree completeness" per generation;
  - hovering a fan-chart node draws the trail from that ancestor to you;
  - pedigree collapse is easy to see.

  Sources: [DNA Painter blog (search summary)](https://blog.dnapainter.com/blog/eight-ways-you-can-use-ancestral-trees-at-dna-painter/); [Trees FAQ (search summary)](https://dnapainter.com/help/trees-faq).
- **DNA Painter Shared cM tool (update of 27 Mar 2020):**
  - enter a cM value to get "a table showing groups of possible relationships grouped by how likely they are, with the most probable at the top". Example: 1,240 cM is about 74% the first-cousin group and about 25% the grandparent group;
  - click any relationship to see "a histogram in an overlay";
  - ranges come from crowd data (parent/child minimum 2,376 cM, with "the vast majority" between 3,300 and 3,900);
  - results can be shared by link;
  - caveats "aren't shown on mobile viewports for space reasons".

  Source: [DNA Painter blog](https://dnapainter.com/blog/introducing-the-updated-shared-cm-tool/). The tool is at [DNA Painter, Shared cM v4](https://dnapainter.com/tools/sharedcmv4).
- The Shared cM tool's probabilities come from Figure 5.2 of Ancestry's matching white paper (simulations), while its histograms come from Shared cM Project submissions. Each histogram bar is labelled with the upper edge of its bin — [Your DNA Guide (search summary)](https://www.yourdnaguide.com/ydgblog/shared-cm-project-histogram); [Deb's Delvings (search summary)](https://debsdelvings.blogspot.com/2021/09/dna-painters-shared-cm-tool-ranges.html).
- **WATO:** places a target in a known tree using cM shared with the people in it. Hover a node and choose "Add hypothesis", or use "Suggest Hypotheses". Each hypothesis gets an odds score, where higher means more likely and zero means impossible — [DNA Painter WATO FAQ (search summary)](https://dnapainter.com/help/wato-faq); [tool](https://dnapainter.com/tools/wato); [The DNA Geek (search summary)](https://thednageek.com/a-major-update-to-what-are-the-odds/).
- **MyHeritage cM Explainer (March 2023):** lists possible relationships with a probability for each, adjusted by an age model. It estimates the likely most recent common ancestor, draws a diagram of the relationship path, and can filter full versus half relationships — [MyHeritage blog (search summary)](https://blog.myheritage.com/2023/03/introducing-cm-explainer-to-predict-relationships-between-dna-matches-with-greater-accuracy/).
- **GEDmatch one-to-one:** green bars mean fully identical, yellow half identical, red no match. A blue bar underneath marks a segment above the threshold — [Nebula GEDmatch tutorial (search summary)](https://nebula.org/blog/gedmatch-tutorial/); [GMP guide (search summary)](https://sites.google.com/view/getgmphelp/part-4-other-information/8-gedmatch-one-to-one-comparison-examples).
- **FamilyTreeDNA chromosome browser:** compares up to seven matches at once. Each gets a colour, shown as a bar above its name and on its segments — [FTDNA Help (search summary)](https://help.familytreedna.com/hc/en-us/articles/360004684575-Chromosome-Browser-Guide).
- **Genetic Affairs AutoCluster (4 Dec 2018 review):**
  - matches run along both axes, and "each tiny square node represents a three-way match";
  - coloured blocks are clusters, and grey squares are matches that "would fall into two different clusters";
  - defaults are 250 cM and 50 cM;
  - a spreadsheet of the qualifying matches sits below the chart;
  - endogamous populations produce many grey squares.

  Source: [DNAeXplained](https://dna-explained.com/2018/12/04/autoclustering-by-genetic-affairs/).
- **AutoTree** reconstructs trees from the GEDCOMs of you and your matches to find common ancestors. It is shown alongside the AutoCluster, with a choice of generations — [Genea-Musings (search summary)](https://www.geneamusings.com/2020/06/my-last-ancestrydna-autocluster.html); [Genetic Affairs manual, Nov 2024](https://www.geneticaffairs.com/images/Manual_Genetic_Affairs.pdf).
- **Leeds method:** a spreadsheet of 2nd–3rd cousin matches (roughly 90–400 cM). Shared matches get the same fill colour, and the result is usually four colour groups for the four grandparent lines — [Dana Leeds (search summary)](https://www.danaleeds.com/the-leeds-method/); [DNAeXplained (search summary)](https://dna-explained.com/2018/09/26/the-leeds-method/).
- **23andMe DNA Relatives Clustering (March 2026)** clusters relatives into family branches "to distinguish your maternal side from your paternal side" — [23andMe press release](https://www.23andme.org/media-center/press-releases/23andme-introduces-reconstructed-ancestors-a-first-of-its-kind-dna-discovery-tool/).

### Inferences
- **D1. Two-kit segment browser (Lineage's shared-segments view).**
  - One row per chromosome (1–22, X), with bar width proportional to genetic length in cM. The Mb option is labelled.
  - Shared segments sit on a top tier: half-identical in a mid tone, fully identical in a dark tone of the same hue plus a diagonal hatch, so the distinction does not depend on colour.
  - A thin bottom tier marks segments above the threshold (GEDmatch's blue bar). Segments below the threshold are drawn at 30% opacity.
  - A cM total and segment count sit at the right of each row, in mono digits.
  - Tap a segment to open a bottom sheet with start and end positions, cM, SNP count and "export row".
  - Phone: the rows stack naturally, at 16px per row plus labels, so 23 rows take about 460px. No horizontal scrolling.
- **D2. Multi-match overlay.** Give each match a colour, following FTDNA's cap of 7, and add DNA Painter's highlight (a shadow plus a full-height track) to single one out. Beyond 7 matches, colour by group (Leeds or cluster) instead of by individual.
- **D3. Relationship likelihood panel.**
  - Top: a ranked list of relationship groups with horizontal probability bars and percentages, the DNA Painter table order.
  - Below: the Shared cM Project histogram for the selected group, with the person's cM value as a labelled vertical line, and the range and "most submissions between x and y" in text.
  - Desktop can add DNA Painter's generational relationship grid, with cells shaded by probability.
  - Phone: the list plus a bottom-sheet histogram. Keep the caveats as a collapsible "How sure is this?" row rather than dropping them, as DNA Painter does on mobile.
- **D4. Hypothesis tree (WATO-like) for GEDCOM plus match data.** Mark each candidate position as a node badge showing its score. Rank the hypotheses in a side list, which becomes a list under the tree on phones.
- **D5. Cluster matrix.**
  - Desktop: an N×N heatmap in cluster order, with cluster colours and grey cells for multi-cluster matches.
  - Phone: at 390px a 50-match matrix gives 7px cells, so switch to cluster cards (members, cM range, shared surnames and places).

### Gaps
- MyHeritage AutoClusters and Genetic Affairs' current clustering algorithm and chart parameters (2024 manual) were not read.
- The screenshots behind the GEDmatch colour conventions date from 2014–2020.
- No usability research on relationship-probability displays was found.

## 5. Family-tree charts: pedigree, fan, hourglass and descendancy, and how they scale

### Takeaway
Current tools handle large trees in three ways:
- they render only a window around a focus person (a configurable number of generations);
- they let the user click any person to re-centre the chart;
- they offer pan and zoom.

Fan charts dominate "at a glance" views because each generation is a ring. FamilySearch's colour modes turn the fan into a data display: birth country, sources, research hints, stories and photos. Libraries exist for GEDCOM (Topola, Apache-2.0), and d3-hierarchy covers hand-rolled layouts at a fraction of the size.

### Cited Findings
- **FamilySearch fan chart:**
  - seven displays and print options;
  - Birth Country view colours "up to the nine most common birth countries";
  - Sources view shades each person by the number of attached sources;
  - Research Helps view uses three coloured categories: Data Problems, Record Hints, Research Suggestions;
  - Stories and Photos views shade by count;
  - colours can be inverted.

  Sources: [FamilySearch blog (search summary)](https://www.familysearch.org/en/blog/genealogy-fan-chart); [FamilySearch help (search summary)](https://www.familysearch.org/en/help/helpcenter/article/how-do-i-use-the-fan-chart-view-in-family-tree).
- **webtrees fan chart (magicsunday):**
  - SVG and D3, with zoom and export;
  - 2–10 generations and a fan size of 180–360°;
  - click to re-centre, right-click for a tooltip with dates, places and images;
  - display modes: names and images, names only, or images only;
  - partners and children as arcs below the ancestors;
  - text follows the arc path in the inner generations.

  Source: [GitHub](https://github.com/magicsunday/webtrees-fan-chart).
- **Gramps Web:** ancestor tree, descendant tree, hourglass, relationship graph and fan chart, all centred on a selected person. Pan with drag and zoom with the wheel or pinch; a preferences dialog sets the maximum generations — [Gramps Web features (search summary)](https://www.grampsweb.org/features/); [user guide (search summary)](https://www.grampsweb.org/user-guide/tree/).
- **Topola:** a TypeScript/JavaScript library that renders SVG with D3. Chart types: Ancestors, Descendants, Hourglass, Relatives, and "Fancy chart" — [README](https://github.com/PeWu/topola/blob/master/README.md). The Topola Viewer parses GEDCOM in the browser, re-focuses on click, exports to PDF, PNG and SVG, and works as a webtrees add-on — [Topola Viewer](https://pewu.github.io/topola-viewer/); [Hostinger listing (search summary)](https://www.hostinger.com/applications/topola-genealogy-viewer).
- **family-chart (donatso):** D3-based, with zoom, pan, TypeScript types and a vanilla JS option. A paid Premium tier adds a "Kinship Engine", tree filtering and performance optimisations — [GitHub](https://github.com/donatso/family-chart); [docs](https://donatso.github.io/family-chart/).
- **Genetic versus genealogical ancestors (Coop):**
  - "nine generations ago the autosomes you receive from (say) your mum are broke, on average, into 286 large chunks", spread over 256 maternal ancestors, so some ancestors contribute nothing;
  - it becomes "increasingly likely that you inherit no autosomal material from a particular ancestor";
  - the share from an ancestor k generations back is centred on 1/2^k.

  Source: [gcbias, 4 Nov 2013](https://gcbias.org/2013/11/04/how-much-of-your-genome-do-you-inherit-from-a-particular-ancestor/).

### Inferences
- **E1. Fan chart as the hero tree.**
  - Desktop: 360° (or 270°) with 5–7 rings. Phone: 180° with a radius of about 170px, showing 4–5 generations legibly.
  - Put names on the arcs only in the first 3 rings; outer rings show initials or colour, with a tooltip or tap.
  - Colour modes, in FamilySearch style:
    - birth country (top 8 plus "other", which fits within Okabe-Ito);
    - completeness or sources on a sequential ramp;
    - DNA path (X, Y or mt inheritance paths, as in DNA Painter);
    - "expected DNA share" (2^-k, with outer rings hatched "may share no DNA").
  - Hovering or tapping a wedge draws the path to the root person (DNA Painter's trail).
- **E2. Pedigree and hourglass for detail.**
  - Pedigree: left to right on desktop; vertical stepping with collapsible generations on phones.
  - Hourglass: ancestors above, descendants below.
  - Render the focus person plus or minus N generations (default 4) and re-centre on click, the Topola/webtrees pattern. This keeps the DOM small for large GEDCOMs.
  - Add a search box and a "tree completeness" bar per generation, e.g. "Generation 5: 11 of 16 known".
- **E3. Descendancy on phones** as an indented list with expand and collapse, not a wide tree.
- **E4. Build choice:**
  - a fan chart is d3-hierarchy `partition` plus `d3.arc`;
  - a pedigree is `tree`;
  - Topola is worth adopting only if hourglass or "relatives" layouts with family nodes are required (see section 9 for sizes).

### Gaps
- No performance numbers were found for Topola or family-chart with large GEDCOMs (thousands of people).
- Phone layouts of FamilySearch and Ancestry apps were not inspected.

## 6. Genomic visual idioms: karyograms, ideograms, runs of homozygosity and circos

### Takeaway
Lay-friendly genomic graphics are linear:
- ideograms with Giemsa-band shading;
- per-chromosome painted bars (23andMe, Ancestry, DNA Painter);
- simple two-tier tracks, as in GEDmatch's runs-of-homozygosity tool.

Ideogram.js supports annotations such as histograms, heatmaps and point markers, but costs about 115KB gzip. The same bands can be drawn from about 5–10KB of cytoband data. No evidence was found that circular (circos) layouts suit lay readers.

### Cited Findings
- **UCSC gieStain values:**
  - gneg, gpos25, gpos50, gpos75 and gpos100 are Giemsa staining intensities;
  - "acen" is centromeric;
  - "stalk" is the short arm of the acrocentric chromosomes 13, 14, 15, 21 and 22;
  - "gvar" is heterochromatin.

  Source: [UCSC genome mailing list (search summary)](https://groups.google.com/a/soe.ucsc.edu/g/genome/c/Lymdl_dJvYQ).
- A typical colour mapping (GenomeSpy): gneg #f0f0f0, gpos25 #e0e0e0, gpos50 #d0d0d0, gpos75 #c0c0c0, gpos100 #a0a0a0, acen #cc4444, stalk #338833, gvar #000000 — [GenomeSpy docs (search summary)](https://genomespy.app/docs/examples/genomic-data/cytobands/).
- **Ideogram.js:** D3 and SVG, drawing band data on the client. The annotation API supports "histograms, heatmaps, overlays, and points of arbitrary shape and color layered in tracks", and it covers human, mouse and other eukaryotes — [GitHub](https://github.com/eweitz/ideogram); [examples](https://eweitz.github.io/ideogram/). Licence CC0-1.0 (npm package 1.53.0, checked locally).
- **PhenoGram** draws ideograms with coloured lines at positions and coloured regions, for GWAS and PheWAS summaries — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4015356/).
- **GEDmatch "Are Your Parents Related?":** for unrelated parents, the upper tier is mostly red with green "flecks". A run of homozygosity (ROH) shows as solid green on top and solid blue below. A grey bottom bar means the ROH is below the threshold. Larger ROH suggest related parents or a shared ethnic background — [The DNA Geek (search summary)](https://thednageek.com/revisiting-the-are-your-parents-related-tool-at-gedmatch/); [GEDmatch education (search summary)](https://www.gedmatch.com/education/are-your-parents-related/).
- **Measured locally:** ideogram's bundled human band data is 17.6KB raw / 4.6KB gzip at 400-band resolution, 25.3 / 6.6KB at 550 bands, and 40.0 / 10.3KB for the default file (`dist/data/bands/native/homo-sapiens*.json` in ideogram 1.53.0, gzip level 9). Example row: `"1 p 36.3 0 451 1 7100000 gneg"`.

### Inferences
- **F1. Horizontal ideogram rows** as the base layer for every positional view (segments, trait variants, marker density).
  - Draw the bands with Tol's greys, or the GenomeSpy greys above, and a pinched waist at the centromere instead of a red block. On a dark theme, invert the shading.
  - Label "1p / 1q" only on desktop.
  - One row per chromosome, 22 plus X (plus Y when present), which reads well on phones.
- **F2. Trait-variant lollipops.** A tick on the ideogram at each trait SNP, with a short label (gene and trait). Tap it to open the evidence card (paper, effect, population caveat), so the variant links straight to its provenance.
- **F3. Raw-file summary track.** Marker density per 1Mb as a small histogram above each chromosome, with no-calls in a contrasting tone. It shows lay users where the chip actually looked, and what it did not look at. Ideogram.js provides this, and it is simple to hand-roll.
- **F4. ROH track** (if Lineage computes it). Use GEDmatch's two-tier idea with a CVD-safe pair (dark blue for ROH above the threshold, light grey for below), with total ROH cM per chromosome and genome-wide. The caption should say that small runs are common and are not evidence of related parents.
- **F5. Circos:** skip it as an analysis view for lay audiences. It could decorate a share card (sparse arcs of shared segments), where precision is not required.

### Gaps
- No empirical study was found comparing lay comprehension of circular and linear genome layouts. The Nusrat, Harbig and Gehlenborg (2019) survey was found, but its layout discussion was not reached — [arXiv](https://arxiv.org/abs/1905.02853).
- Kitty Cooper's 2022 post on false "related parents" results was found but not read — [blog](https://blog.kittycooper.com/2022/09/when-gedmatch-says-your-parents-are-related-but-they-are-not/).

## 7. Presentation and storytelling: scrollytelling, explorables, shareable cards, typography and annotation

### Takeaway
Best practice from data journalism:
- state the takeaway in words on the graphic (the "annotation layer");
- on phones, move annotations into a numbered key below the chart;
- stack static steps instead of scroll-driven animation when the transitions are not essential;
- use tabular lining figures in sans-serif at 12px or larger.

In consumer genetics, companies now ship shareable summaries (Ancestry's DNA Highlights, MyHeritage's video summaries) and version comparisons. Graham Coop's inheritance explainers show the "how much DNA do you share" story that Lineage could tell interactively.

### Cited Findings
- **Pudding, "Responsive scrollytelling" (Russell Samora, April 2017):**
  - on mobile, keep scrolling only when "transitions are truly meaningful"; otherwise stack static charts;
  - size steps with `window.innerHeight` in JavaScript rather than vh units, because collapsing browser bars break the triggers;
  - keep CSS media queries and JavaScript `matchMedia` in sync;
  - separate chart setup from drawing;
  - remove hover on mobile and keep stories "short and sweet".

  Source: [The Pudding](https://pudding.cool/process/responsive-scrollytelling/).
- Amanda Cox (NYT): "the annotation layer is the most important thing we do… otherwise it's a case of here it is, you go figure it out" — [data.europa.eu visualisation guide (search summary)](https://data.europa.eu/apps/data-visualisation-guide/visual-annotations-introduction).
- **Datawrapper responsive annotations (2 Nov 2020):** "On small screens, annotations get numbered and move below the chart". Annotation width is "measured in chart width, not in absolute pixels". A text outline keeps labels readable over data, and lines, arrows and circles connect notes to points — [Datawrapper blog](https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations).
- **Datawrapper typography (Lisa Charlotte Muth, 12 Sep 2022):**
  - use tabular figures ("every number is the same width") and lining numbers, not oldstyle;
  - the default annotation size is 14px, and "anything below 12px will likely be too small";
  - avoid condensed fonts;
  - sans-serif is easier to skim.

  Source: [Datawrapper blog](https://www.datawrapper.de/blog/fonts-for-data-visualization).
- **FT Visual Vocabulary** sorts charts by relationship (deviation, correlation, ranking, distribution, change over time, magnitude, part-to-whole, spatial, flow). It is copyrighted by the FT; republishing needs permission — [GitHub](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary).
- An explorable explanation is "an interactive computer simulation of a given concept… along with guidance" — [Wikipedia](https://en.wikipedia.org/wiki/Explorable_explanation). LabXchange hosts a gene linkage and recombination simulation — [LabXchange (search summary)](https://www.labxchange.org/library/items/lb:LabXchange:013a7416:lx_simulation:1).
- **Coop's explainers:**
  - the grandparent and ancestor posts show inheritance distributions centred on 1/2^k and chromosome diagrams with coloured blocks;
  - third cousins share "a little less than one percent" of their genomes through the shared great-great-grandparents.

  Sources: [gcbias grandparent post](https://gcbias.org/2013/10/20/how-much-of-your-genome-do-you-inherit-from-a-particular-grandparent/); [ancestor post](https://gcbias.org/2013/11/04/how-much-of-your-genome-do-you-inherit-from-a-particular-ancestor/); [genetic genealogy category (search summary)](https://gcbias.org/category/genetic-genealogy/).
- **Shareable summaries:** AncestryDNA "DNA Highlights" are a shareable "highlight reel" ([Ancestry](https://www.ancestry.com/c/dna/ancestry-dna-ethnicity-estimate-update)). MyHeritage offers downloadable video summaries ([DNAeXplained](https://dna-explained.com/2025/02/06/myheritage-introduces-ethnicity-v2-5/)). 23andMe added Version History comparison ([23andMe](https://www.23andme.org/blog/articles/ancestry-composition-version-7-is-here)).
- **NYT, "Why we are doing fewer interactives" (Archie Tse, 2016):** found only as a citation in scrollytelling research — [ACM ECCE 2023](https://dl.acm.org/doi/fullHtml/10.1145/3605655.3605683).

### Inferences
- **G1. "How much DNA do you share?" explainer**, in 5 short steps with a sticky SVG on desktop and stacked static panels on phones:
  1. parent to child, 50/50 across chromosome bars;
  2. recombination, with a "shuffle" button;
  3. grandparents, around 25%, with a histogram building up from simulated draws;
  4. cousins, the Shared cM Project ranges;
  5. genealogical versus genetic ancestors, Coop's 286 chunks for 256 ancestors.

  Use a seeded random number generator so each shuffle can be shared and reproduced. Scrollama is about 2.4KB gzip.
- **G2. Headline-first charts.** Each chart gets a one-sentence finding as its title ("You share 1,240 cM: most likely a first-cousin-level relative (about 74%); a grandparent-level relative is about 25%", using DNA Painter's worked example) and a smaller descriptive subtitle, per Cox. Allow at most 3 annotations; on phones they become a numbered key below the chart, per Datawrapper.
- **G3. "What we know" ledger.** Each claim is a row with:
  - the claim;
  - an evidence level ("replicated in large studies", "single study", "not established");
  - the population it was studied in;
  - source chips (PMID, dataset, retrieval date).

  Follow OWID's "source always visible, details one click away". This fits Lineage's provenance model.
- **G4. Share card.** A 1200×630 SVG rendered to PNG in the browser, with:
  - the top 3 groups with intervals;
  - a mini reference-point map;
  - one "we're not sure about" line;
  - the method and version stamp;
  - no raw genotypes, for privacy.

  html-to-image (about 5KB gzip) works; so does serialising the SVG to a canvas without a library.
- **G5. Typography.** The body sans for labels; IBM Plex Mono (fixed width, so digits line up) for every number; nothing below 12px, which matches Chartability's minimum (section 8). Titles can use a display serif if Lineage adopts the portfolio's Instrument Serif.

### Gaps
- No Pudding, NYT, Reuters or FT genetics-specific interactive was located before the search budget ran out. NYT and Pudding genetics explainers remain unverified examples.
- The content of Archie Tse's 2016 talk was not retrieved.

## 8. Accessibility and colour: palettes for 5–26 populations, dark mode, reduced motion, screen readers and mobile

### Takeaway
Colour-blind-safe categorical palettes stop at about 7–9 hues (Okabe-Ito 8, Tol bright 7 and muted 9). Green-Armytage's 26-colour alphabet is "near the maximum number reliably distinguishable" for normal vision, and it collapses under simulated colour-vision deficiency. So 26 populations need two levels:
- a hue family per super-population (5);
- lightness or pattern within the family, plus direct labels and a table.

No single palette clears 3:1 contrast on both white and near-black backgrounds, so dark mode needs its own palette. Chartability's 14 critical tests and the WAI long-description guidance give a checkable accessibility bar.

### Cited Findings
- **Paul Tol's schemes** (page updated 7 July 2026):
  - Bright: #4477AA #EE6677 #228833 #CCBB44 #66CCEE #AA3377 #BBBBBB (7)
  - Vibrant: #EE7733 #0077BB #33BBEE #EE3377 #CC3311 #009988 #BBBBBB (7)
  - Muted: #CC6677 #332288 #DDCC77 #117733 #88CCEE #882255 #44AA99 #999933 #AA4499, with #DDDDDD for bad data (9)
  - Light: #77AADD #EE8866 #EEDD88 #FFAABB #99DDFF #44BB99 #BBCC33 #AAAA00 #DDDDDD (9), for labelled cells
  - Discrete rainbow: up to 23 colours
  - Sequential: Iridescent (linear luminance, works in greyscale), YlOrBr, Incandescent
  - Diverging: Sunset, Nightfall, BuRd, PRGn

  Source: [Paul Tol's Notes](https://sronpersonalpages.nl/~pault/). The qualitative schemes "must be used as given (no interpolation)" — [khroma vignette (search summary)](https://cran.r-project.org/web/packages/khroma/vignettes/tol.html).
- **Okabe-Ito / Wong:** #000000 #E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7, from Color Universal Design (2002, updated 2008) and popularised by Wong in Nature Methods (2011) — [easystats `see` reference (search summary)](https://easystats.github.io/see/reference/scale_color_okabeito.html).
- **Green-Armytage (2010):** 26 colours proposed as "near the maximum number reliably distinguishable". Beyond 26 distinctions, colour must be supplemented by shapes, letters or numbers — [Wikipedia Help:Distinguishable colors](https://en.wikipedia.org/wiki/Help:Distinguishable_colors); [paper (search summary)](https://www.researchgate.net/publication/237005166_A_Colour_Alphabet_and_the_Limits_of_Colour_Coding).
- In industry, 23andMe's 2025 palette uses a world gradient so neighbouring populations look alike ([23andMe](https://www.23andme.org/blog/articles/ancestry-composition-version-7-is-here)). FamilySearch caps birth-country colours at nine ([FamilySearch (search summary)](https://www.familysearch.org/en/blog/genealogy-fan-chart)). Ancestry's painter colours were called "a challenge to identify" ([The DNA Geek](https://thednageek.com/chromosome-painting-at-ancestry/)).
- **Chartability (POUR-CAF: Perceivable, Operable, Understandable, Robust, Compromising, Assistive, Flexible)** has 14 critical heuristics, including:
  - contrast: "Geometries and large text must have >3:1 contrast… Regular text must have >4.5:1";
  - text never smaller than 9pt/12px;
  - no seizure risk;
  - more than one input modality;
  - interaction cues;
  - an explanation of how to read the chart;
  - a title, summary or caption;
  - reading level grade 9 or lower;
  - a human-readable data table;
  - appropriate data density;
  - skippable repeated content;
  - respect for user style changes.

  Source: [Chartability workbook](https://chartability.github.io/POUR-CAF/); [Chartability](https://chartability.fizz.studio/).
- **W3C WAI complex images:** use a short text alternative plus a long description, placed in an adjacent link, in `<figure>`/`<figcaption>`, or via `aria-describedby`. Making the long description visible to everyone helps all readers — [W3C WAI](https://www.w3.org/WAI/tutorials/images/complex/).
- **Standards:** `prefers-reduced-motion` is the CSS media feature for users who ask to minimise motion — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion). WCAG 2.2 success criterion 2.5.8 sets a minimum pointer-target size (24×24 CSS px) — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- **Mobile precedents:** Datawrapper moves annotations into a key below the chart ([Datawrapper](https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations)). The Pudding stacks steps and removes hover ([Pudding](https://pudding.cool/process/responsive-scrollytelling/)). DNA Painter hides caveats on mobile ([DNA Painter](https://dnapainter.com/blog/introducing-the-updated-shared-cm-tool/)).
- **Local colour-vision simulation** (this session):
  - Method: Machado et al. 2009 matrices at severity 1.0, applied in linear RGB; minimum pairwise CIEDE2000 distance (ΔE00); pairs under ΔE00 = 10 counted as "hard to tell apart for small marks".
  - Results as min ΔE00 for normal / protan / deutan / tritan vision, then pairs under 10 in the same order:

    | Palette | Colours (pairs) | Min ΔE00 (N / P / D / T) | Pairs under 10 (N / P / D / T) |
    |---|---|---|---|
    | Okabe-Ito without black | 7 (21) | 21.7 / 12.2 / 11.6 / 10.9 | 0 / 0 / 0 / 0 |
    | Tol bright | 7 (21) | 20.5 / 14.2 / 14.8 / 8.6 | 0 / 0 / 0 / 1 |
    | Tol muted | 9 (36) | 15.0 / 11.8 / 14.3 / 11.5 | 0 / 0 / 0 / 0 |
    | Tol light | 9 (36) | 9.3 / 8.8 / 7.9 / 7.5 | 1 / 2 / 4 / 1 |
    | d3 schemeTableau10 | 10 (45) | 18.1 / 1.0 / 0.7 / 6.8 | 0 / 6 / 6 / 3 |
    | Green-Armytage | 26 (325) | 6.4 / 0.7 / 2.0 / 5.6 | 2 / 22 / 20 / 8 |

    Tableau10's worst deutan pair is #e15759 against #59a14f (red against green).
- **Local WCAG contrast check** (for marks, 3:1 needed):
  - On white: Okabe-Ito #E69F00 (2.25), #56B4E9 (2.31) and #F0E442 (1.32) fail. So do Tol bright #CCBB44 and #66CCEE, and Tol muted #DDCC77, #88CCEE and #44AA99.
  - On #121212: every Okabe-Ito colour passes (lowest #0072B2 at 3.61). Tol muted #332288 (1.54) and #882255 (2.15) fail.

### Inferences
- **H1. Five super-populations.** Use Okabe-Ito without black, or Tol muted. Both kept every pair above ΔE00 ≈ 10 under all three simulated deficiencies. Avoid d3's schemeTableau10, which has 6 near-identical pairs for protan and deutan viewers.
- **H2. Twenty-six populations.**
  - Give each super-population a hue family and 4–7 lightness steps for its sub-populations. This follows 23andMe's geographic-gradient idea.
  - Always pair colour with a direct label (the three-letter code), stable ordering and grouping. In maps, also add a shape per super-population (circle, square, diamond, triangle, hexagon).
  - Never make a legend of 26 swatches the only key. The 26-hue alphabet had 20–22 confusable pairs under protan and deutan simulation.
  - Avoid browns, beiges and yellows as super-population hues, so colours do not read as skin tones. This is an ethical judgement; no source was found.
- **H3. Dark mode.**
  - Keep hue assignments but switch to lighter tints: Okabe-Ito passes 3:1 on #121212, while Tol muted's #332288 and #882255 need replacing, for example with the Tol bright or light equivalents.
  - On white, the pale Okabe-Ito colours (orange, sky blue, yellow) need a 1px darker outline or should be kept for large fills with labels.
  - Swap cytoband shading and sequential ramps too: a light-to-dark ramp on white becomes dark-to-light on black, with the same order of meaning.
  - Define colours as CSS custom properties with `prefers-color-scheme` variants, matching the portfolio's token approach.
- **H4. Reduced motion.** Under `prefers-reduced-motion: reduce`:
  - disable globe auto-rotation, time-slider autoplay and animated re-sorts;
  - replace transitions with instant updates or 150ms fades;
  - never animate the painting.

  Also pause motion inside the portfolio iframes by default, since they may be visible without focus.
- **H5. Screen readers and keyboard.**
  - Every chart is a `<figure>` with a visible one-sentence takeaway (`<figcaption>`), an SVG with `role="img"` and `aria-labelledby` pointing to its title and description, and a "Show as table" toggle. Chartability rates "no table" as critical.
  - Interactive charts get Tab to focus the chart, arrow keys to move between data points with an `aria-live="polite"` readout, and Escape to leave. Keep a visible focus ring.
  - Anything reachable by hover must also work by tap and keyboard. This matters doubly inside the portfolio, where hover is used for "lean in".
- **H6. Phone rules.**
  - Stack rather than scroll sideways.
  - Show small multiples 2-up.
  - Turn tables into cards.
  - Put annotations in a numbered key below the chart.
  - Make targets at least 24px (WCAG 2.2), preferably 44px for primary controls.
  - Keep text at 12px or more.
  - Collapse caveats rather than removing them.

### Gaps
- No authoritative source on dark-mode chart palettes was retrieved (Datawrapper's dark-mode post returned 404). The dark-mode guidance above rests on the contrast computation.
- No source was found on avoiding skin-tone-like colours for population groups; this is a judgement.
- Okabe-Ito hex values came from a secondary reference, not the original CUD page.

## 9. Open-source libraries for a vanilla TypeScript app: licences and sizes

### Takeaway
For Lineage's needs (a world map with 26 points, dot plots, histograms, ideograms, fan and pedigree charts, a PCA scatter), individual d3 modules plus topojson-client and a 110m world-atlas file come to under about 100KB gzip in total. Heavy options are better avoided:
- ideogram.js (115KB): hand-roll it from about 5–10KB of cytoband data;
- Observable Plot (131KB);
- maplibre-gl (281KB plus tiles);
- igv.js (432KB).

Topola (Apache-2.0, about 52KB) is the one specialised library worth considering, for GEDCOM hourglass and relatives charts.

### Cited Findings
- **Measurement method (this session, 2026-09-25):** npm install, then an esbuild 0.28.2 bundle (ESM, minified, browser). Sizes are shown as minified / gzip -9. The imports are listed so the numbers can be reproduced; shared d3 dependencies overlap, so sums overstate slightly. Versions and licences come from each package's `package.json` and match the npm listings (e.g. [npm: d3-geo](https://www.npmjs.com/package/d3-geo), [npm: ideogram](https://www.npmjs.com/package/ideogram)).

| Package (version, licence) | Imports measured | Min KB | Gzip KB |
|---|---|---|---|
| d3-geo 3.1.1, ISC | geoPath, geoEqualEarth, geoNaturalEarth1, geoOrthographic, geoGraticule10, geoInterpolate, geoDistance | 23.2 | 9.1 |
| d3-geo-projection 4.0.0, ISC | geoRobinson, geoWinkel3 | 17.6 | 7.4 |
| topojson-client 3.1.0, ISC | feature, mesh | 3.2 | 1.3 |
| d3-selection + d3-scale + d3-shape + d3-array + d3-axis (current majors) | select, scales (linear, band, ordinal, sequential, log), line, area, arc, pie, stack, extent, max, bin, group, rollup, axes | 52.0 | 18.6 |
| d3-zoom 3.0.0, ISC | zoom (pulls in transition and interpolate) | 46.9 | 15.9 |
| d3-force 3.0.0, ISC | simulation, x, y, collide | 11.4 | 4.4 |
| d3-contour 4.0.2, ISC | contourDensity | 8.1 | 3.2 |
| d3-delaunay 6.0.4, ISC | Delaunay | 19.2 | 7.1 |
| d3-hierarchy 3.1.2, ISC | hierarchy, partition, tree, cluster | 5.9 | 2.4 |
| d3-scale-chromatic 3.1.0, ISC | Tableau10, viridis, cividis | 6.7 | 3.4 |
| d3 7.9.0, ISC | everything | 276.4 | 93.5 |
| versor 0.2.0, ISC | globe drag rotation | 1.8 | 0.9 |
| ideogram 1.53.0, CC0-1.0 | default (band data loaded separately; the package is 45MB on disk) | 344.7 | 115.4 |
| family-chart 0.9.0 (`package.json` ISC, LICENSE.txt MIT) | all | 159.4 | 48.7 |
| topola 3.10.4, Apache-2.0 | all | 167.3 | 51.7 |
| @observablehq/plot 0.6.17, ISC | all | 384.4 | 130.7 |
| scrollama 3.2.0, MIT | default | 5.4 | 2.4 |
| maplibre-gl 6.11.2, BSD-3-Clause | JS only (plus CSS and vector tiles) | 1040.2 | 280.5 |
| igv 3.8.9, MIT | all | 1487.0 | 432.0 |
| circos 2.1.0, ISC | default | 265.8 | 81.4 |
| html-to-image 1.11.13, MIT | toPng, toSvg | 12.5 | 5.0 |

- **world-atlas 2.0.2 (ISC) TopoJSON sizes, raw / gzip:**

  | File | Raw KB | Gzip KB |
  |---|---|---|
  | land-110m | 53.9 | 20.0 |
  | countries-110m | 105.2 | 37.2 |
  | land-50m | 532.7 | 164.7 |
  | countries-50m | 738.7 | 223.7 |
  | countries-10m | 3,575 | 895 |

  Measured locally; package at [npm: world-atlas](https://www.npmjs.com/package/world-atlas).
- **Dependencies:** topola uses d3-array, d3-flextree, d3-hierarchy, d3-selection, d3-transition, parse-gedcom and array-flat-polyfill. family-chart depends on d3 ^7.9.0. ideogram uses crossfilter2, d3 modules (array, brush, dispatch, fetch, format, scale), fast-kde, fflate, tippy.js, workbox-range-requests and snarkdown. All read from each `package.json`.
- **Library descriptions:**
  - Topola renders Ancestors, Descendants, Hourglass, Relatives and "Fancy" charts with D3 — [GitHub](https://github.com/PeWu/topola).
  - family-chart is a D3 family-tree library with TypeScript types and paid Premium features — [GitHub](https://github.com/donatso/family-chart).
  - Ideogram.js draws chromosomes with annotation tracks — [GitHub](https://github.com/eweitz/ideogram).
  - DORA builds on Natural Earth data — [NAR](https://academic.oup.com/nar/article/52/W1/W54/7671306).

### Inferences
- **Recommended stack (about 85KB gzip before app code):**

  | Part | Gzip KB |
  |---|---|
  | d3-geo with geoEqualEarth for flat maps and geoOrthographic plus versor for a draggable globe hero | about 10 |
  | topojson-client with land-110m | about 21 |
  | the charting subset of d3 modules | about 19 |
  | d3-zoom | about 16 |
  | d3-force for GGV-style de-overlap | about 4 |
  | d3-contour and d3-delaunay for PCA density and tap targets | about 10 |
  | d3-hierarchy for fan and pedigree charts | about 2 |
  | scrollama | about 2 |

  Use countries-110m (37KB) only if borders are needed; points on a land silhouette avoid implying national identity for genetic groups. Load it lazily when the map view opens.
- **Hand-roll instead of importing:**
  - Ideogram: bands from ideogram's 400- or 550-band human JSON (4.6–6.6KB gzip, CC0) drawn with plain SVG `<rect>`/`<path>` elements.
  - Relationship histograms and dot strips: plain SVG with d3-scale.
- **Adopt Topola only** if GEDCOM hourglass or "relatives" charts with multi-spouse families are wanted. Its Apache-2.0 licence is compatible with an open-source app (keep the NOTICE file). Prefer it to family-chart, whose licence metadata is inconsistent (ISC in `package.json`, MIT in LICENSE.txt) and which pulls in d3 v7 as a dependency.
- **Avoid for Lineage:**
  - maplibre-gl: a tile renderer is overkill for 26 points and adds tile hosting;
  - igv.js: a research browser, not a lay view;
  - Observable Plot: good for prototyping, but 131KB is more than the whole recommended stack;
  - circos: see section 6.
- **Iframe performance on the portfolio page:**
  - render SVG once, avoiding continuous `requestAnimationFrame` loops;
  - defer the map and tree bundles until their view opens (dynamic `import()`);
  - keep the first screen legible at thumbnail scale, with large numerals and one bold graphic such as a chromosome painting or a 26-point map, since the laptop and phone mock-ups show the app before the visitor leans in.

### Gaps
- Bundlephobia was not consulted (the search budget was exhausted). The sizes are local esbuild measurements, which reflect the specific imports and are more accurate for this use than whole-package figures.
- Whether world-atlas and Natural Earth boundaries suit sensitive regions was not checked.
- Topola's and family-chart's performance with large GEDCOMs was not measured.
