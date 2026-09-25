# Genealogy DNA upload, matching and analysis platforms: the competitive landscape as of September 2026

Research date: 2026-09-25. Conventions used below:
- "observed 2026-09-25" means the price or feature was read directly from the vendor's own page on that date.
- "(search excerpt)" means the claim came from a search engine's summary of the linked page, not from a direct fetch of that page. Treat these as lower confidence. Several vendor help centres (FamilyTreeDNA, Living DNA), genealogyalacarte.ca and all of reddit.com refused automated fetching.
- "Historical" marks anything that is no longer current, with its date.

## 1. What each platform offers, how it works, what is paid, and what it costs

### Takeaway
Between 2023 and 2026 the market for uploading raw DNA from another company contracted sharply:
- Geneanet ended its DNA features (Dec 2023).
- MyHeritage stopped accepting uploads (late May 2025).
- openSNP shut down (Apr 2025).
- FamilyTreeDNA retired its $19 unlock for uploaded kits (18 Aug 2026).
- GEDmatch, now the main upload-analysis site, is owned by forensic firm Verogen/Qiagen. It raised Tier 1 to $15/month or $150/year for new subscribers from 1 Sep 2026 and is rebuilding its interface.

The benchmark companies accept no uploads. Ancestry (~30M kits) and 23andMe (<14M) keep moving analysis features behind extra paywalls: Ancestry Pro Tools costs $10/month and includes match clusters; the 23andMe chromosome browser needs 23andMe+. Two vendors are also moving from genotyping chips to sequencing, which changes the raw-file formats that third-party tools must read: FamilyTreeDNA's Family Finder now runs on a Twist NGS panel (Mar 2026), and MyHeritage kits use low-pass WGS (Oct 2025).

### Cited Findings

#### Snapshot (Sept 2026)
| Platform | Accepts uploads from other companies? | Matching database (date) | Main paid layer and price | Segment data for users | Law-enforcement matching |
|---|---|---|---|---|---|
| GEDmatch | Yes ([privacy page](https://www.gedmatch.com/privacy-security/)) | ~2.2M, projected; not published (Mar 2026, [DNA Geek](https://thednageek.com/database-sizes-march-2026/)) | Tier 1: $15/mo or $150/yr for new subscribers from 2026-09-01; was $10/$100 ([GEDmatch blog, 2026-07-07](https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/)) | Per-match and bulk ([DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)) | Opt-in only, violent crimes and remains ([ToS 2024-11-22](https://www.gedmatch.com/terms-of-service-november-22-2024/)) |
| MyHeritage | **No**, since late May 2025 ([help centre, updated 2026-07-21](https://www.myheritage.com/help/en/articles/12852724-why-can-t-i-upload-my-dna-data-file); [DNA Geek](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)) | 9.6M (Mar 2026, [DNA Geek](https://thednageek.com/database-sizes-march-2026/)) | Site subscription for advanced DNA features; $29 unlock applied only to past uploads ([help centre](https://www.myheritage.com/help/en/articles/12852419-what-are-the-advanced-myheritage-dna-features)) | Per-match download; bulk export removed Oct 2023 ([DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)) | Prohibited by its terms, but the FBI used it anyway ([Spokesman-Review](https://www.spokesman.com/stories/2025/jan/24/kohbergers-idaho-attorneys-argue-fbi-skirted-polic/)) |
| FamilyTreeDNA | Yes. Matching free; $19 unlock retired 2026-08-18 ([DNAeXplained](https://dna-explained.com/2026/08/13/autosomal-dna-unlock-at-familytreedna-to-be-retired-august-18th/)) | Family Finder just under 1.8M (Mar 2026, [DNA Geek](https://thednageek.com/database-sizes-march-2026/)) | Family Finder NGS upgrade, $29 promo ([DNAeXplained](https://dna-explained.com/2026/08/13/autosomal-dna-unlock-at-familytreedna-to-be-retired-august-18th/)); Y/mtDNA tests | Per-match and bulk, restored Aug 2024 ([DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)) | Opt-in ("IGGM"), default off ([Your DNA Guide](https://www.yourdnaguide.com/family-tree-dna-opt-out-law-enforcement)) |
| Living DNA | Yes, free ([upload page](https://livingdna.com/free-dna-upload)) | <300,000 samples ([Wikipedia](https://en.wikipedia.org/wiki/Living_DNA), undated) | Full-ancestry unlock for uploads, price not shown | Per-match browser since Jul 2023; no bulk ([DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)) | Not researched (see Gaps) |
| AncestryDNA | No ([DNAeXplained](https://dna-explained.com/2025/10/14/myheritage-introduces-a-low-pass-whole-genome-autosomal-dna-test-why-it-matters/)) | ~30M (Mar 2026, [DNA Geek](https://thednageek.com/database-sizes-march-2026/)) | Pro Tools $10/mo on top of a membership ([Ancestry offer page](https://www.ancestry.com/offers/join?feature=proTools), search excerpt) | Never offered ([DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)) | Prohibited; warrant required ([transparency report](https://www.ancestry.com/c/transparency/govt-and-law-enforcement)) |
| 23andMe (TTAM) | No ([DNAeXplained](https://dna-explained.com/2025/10/14/myheritage-introduces-a-low-pass-whole-genome-autosomal-dna-test-why-it-matters/)) | Just under 14M; 11.1M in relative matching (Mar 2026, [DNA Geek](https://thednageek.com/database-sizes-march-2026/)) | 23andMe+ needed for the chromosome browser ([Through the Trees](https://throughthetreesblog.tumblr.com/post/810909158988709888/23andme-an-unfortunate-update)) | Limited per-match for 23andMe+ on the V5 chip; no downloads ([DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)) | No data released to date ([transparency report](https://www.23andme.com/transparency-report/)) |

#### GEDmatch
- Founded in 2010 by Curtis Rogers and John Olson in Lake Worth, Florida — [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch)
- Ownership: GEDmatch "is operated by Verogen, Inc. ... a subsidiary of Qiagen N.V." (ToS effective 2024-11-22). Verogen also runs the GEDmatch PRO portal for law enforcement. — [GEDmatch ToS](https://www.gedmatch.com/terms-of-service-november-22-2024/)
- Verogen bought GEDmatch in Dec 2019, when the database held 1.2M profiles (historical) — [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch)
- Qiagen completed its acquisition of Verogen in Jan 2023 for $150M cash — [QIAGEN press release](https://corporate.qiagen.com/English/newsroom/press-releases/press-release-details/2023/QIAGEN-Completes-Acquisition-of-Verogen-Strengthening-Leadership-in-Human-ID--Forensics-With-NGS-Technologies/default.aspx); [The Legal Genealogist, 2023-01-19 "GEDmatch sold again"](https://www.legalgenealogist.com/2023/01/19/gedmatch-sold-again/)
- A privacy policy dated 2025-10-21 is the latest policy document found — [GEDmatch privacy policy](https://www.gedmatch.com/privacy-policy-october-21-2025/)
- Database size: GEDmatch does not publish it. The DNA Geek projects ~2.2M kits as of March 2026. Historical figures: 929,000 (May 2018) and 1.45M (fall 2020). — [DNA Geek, Mar 2026](https://thednageek.com/database-sizes-march-2026/); [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch)
- How it works: server-side upload. GEDmatch says: "When you upload your data, the information is encoded and the raw file deleted." — [GEDmatch privacy & security](https://www.gedmatch.com/privacy-security/)
- Free vs paid (historical baseline, from 2022-05-01): free users may hold up to 5 kits; existing kits are never deleted. Tier 1 recurring plans were $10/month or $100/year. Pay-as-you-go prices rose to $15 (1 month), $45 (3 months) and $90 (6 months). — [GEDmatch announcement, 2022-04-19](https://gedmatch.launchnotes.io/announcements/changes-to-free-and-tier-1-accounts-starting-may-1)
- **Current Tier 1 price (observed 2026-09-25):** "Starting September 1, 2026, new subscribers pay $15/month or $150/year (previously $10/month or $100/year)". Current members are grandfathered. — [GEDmatch blog, 2026-07-07](https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/)
- American Ancestors members are offered 10% off Tier 1 — [American Ancestors](https://www.americanancestors.org/gedmatch) (search excerpt)
- One-to-Many matching:
  - Free: shows 50 matches by default, expandable to 3,000.
  - Tier 1: shows all matches (the example given is up to 100,000). It adds an adjustable overlap cutoff, source-company and SNP-overlap columns, tag-group options, and multiple-kit selection for analysis and visualisation.
  - [GEDmatch education page](https://www.gedmatch.com/education/upgrading-your-one-to-many-matching-with-tier-1/) (undated)
- Tier 1 tools (as of Dec 2023): Tier 1 One-to-Many, Q-Matching One-to-One, Segment Search, Phasing, Triangulation, AutoSegment, AutoKinship, Multiple Kit Analysis, Lazarus (reconstructs an ancestor from descendants), My Evil Twin, Superkit (combine kits), and basic single-kit Clusters — [Who Are You Made Of?](https://whoareyoumadeof.com/blog/what-is-tier-1-on-gedmatch/) (search excerpt)
- Several Tier 1 tools are licensed from Genetic Affairs, for example the AutoSegment triangulation cluster tool (2021) — [DNAeXplained, 2021-10-18](https://dna-explained.com/2021/10/18/autosegment-triangulation-cluster-tool-at-gedmatch/)
- Free admixture ("ethnicity") calculators, from hobbyist projects:
  - Dodecad
  - Eurogenes: K13 (most used), K36 and Jtest
  - MDLP: World-22, with four Native American components
  - HarappaWorld
  - 4-Ancestors Oracle
  - Ancient Eurasia K6
  - Sources: [ISOGG wiki: Admixture analyses](https://isogg.org/wiki/Admixture_analyses); [GEDmatch Admixture Heritage tool](https://www.gedmatch.com/applications/admixture-heritage-tool/); [Who Are You Made Of?](https://whoareyoumadeof.com/blog/which-gedmatch-admixture-to-use/) (search excerpts)
- **New interface (announced 2026-07-07):**
  - Timeline: beta at beta.gedmatch.com from August 2026, full operation by the end of 2026, and "The current site retires in March 2027."
  - Features: kit and data management in one place; a searchable, categorised tool catalogue; folders, column controls and site-wide search; match highlighting in One-to-Many; a combined One-to-One autosomal and X view; "My Clipboard" for multi-kit research lists; optional user profiles.
  - [GEDmatch blog](https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/)

#### MyHeritage DNA
- Ownership: Francisco Partners signed to acquire MyHeritage on 2021-02-24 and completed in April 2021. The price was reported at ~$600M. Founder Gilad Japhet remained CEO. — [MyHeritage blog, Apr 2021](https://blog.myheritage.com/2021/04/myheritage-acquired-by-leading-private-equity-firm-francisco-partners/); [CTech](https://www.calcalistech.com/ctech/articles/0,7340,L-3895378,00.html)
- **Possible sale (2025-12-24):** "MyHeritage has hired Jefferies to lead a potential sale valuing the company at around $1 billion." The company reports 104M+ registered users and ~21B historical records. — [CTech](https://www.calcalistech.com/ctechnews/article/syr4gmfmzl)
- Database size:
  - 9.6M kits used for genealogical matching (March 2026, from MyHeritage's "About" page) — [DNA Geek](https://thednageek.com/database-sizes-march-2026/)
  - 9.3M in May 2025, described as the second-largest genealogical database — [DNA Geek](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)
- **Uploads ended.** The help centre (updated 2026-07-21) says: "DNA uploads are no longer supported at MyHeritage. This means you cannot upload DNA data from other testing services." It also says: "To receive DNA matches and ethnicity reports on MyHeritage, you will need to purchase a MyHeritage DNA kit instead." — [MyHeritage help](https://www.myheritage.com/help/en/articles/12852724-why-can-t-i-upload-my-dna-data-file)
- When uploads stopped: a phased rollout began about a week before 2025-05-29. MyHeritage gave no official reason in that article. Leah Larkin links the timing to CeCe Moore's Dateline appearance on 2025-05-09 about the FBI's use of MyHeritage. — [The DNA Geek, 2025-05-29](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)
- Advanced DNA features:
  - The features: review a match's tree, Shared DNA Matches, Pedigree Chart, Shared ancestral places, Theory of Family Relativity, and AutoClusters.
  - Access requires a site subscription (Premium, PremiumPlus, Complete or Omni). Users who uploaded "in the past" could instead pay a "one-time only Unlock fee of US$29.00 (or equivalent in different currencies)" per kit.
  - [MyHeritage help, updated 2026-07-21](https://www.myheritage.com/help/en/articles/12852419-what-are-the-advanced-myheritage-dna-features)
- Historical: MyHeritage periodically waived the unlock fee as a promotion, for example in Oct 2023 and Mar 2025 — [MyHeritage blog, Oct 2023](https://blog.myheritage.com/2023/10/upload-your-dna-data-to-myheritage-and-enjoy-free-access-to-all-dna-features/); [MyHeritage blog, Mar 2025](https://blog.myheritage.com/2025/03/upload-your-dna-data-and-enjoy-free-access-to-advanced-dna-features/)
- Theory of Family Relativity (launched Feb 2019) proposes how you may be related to a match using MyHeritage's trees and records. It is a premium feature that requires a site subscription. — [Kitty Cooper, Feb 2019](https://blog.kittycooper.com/2019/02/myheritages-theory-of-family-relativity/); [MyHeritage Knowledge Base](https://education.myheritage.com/article/the-theory-of-family-relativity-for-dna-matches/) (search excerpt)
- AutoClusters (2019) "groups together DNA Matches that likely descend from common ancestors in a compelling visual chart" and is based purely on DNA — [MyHeritage Knowledge Base](https://education.myheritage.com/article/autoclusters-for-dna-matches/) (search excerpt); [Hound on the Hunt, Mar 2019](https://blog.familyhistoryhound.com/2019/03/myheritage-autoclusters/)
- Ethnicity Estimate v2.5 (announced 2025-02-02/06):
  - The number of ethnicities rose from 42 to 79: 24 percentage-based European ethnicities and 15 Jewish ethnicities, some unique to MyHeritage (for example Armenian).
  - Existing customers can opt in free; it runs on older chips.
  - [MyHeritage blog](https://blog.myheritage.com/2025/02/introducing-ethnicity-estimate-v2-5-improved-dna-ethnicity-model/); [DNAeXplained, 2025-02-06](https://dna-explained.com/2025/02/06/myheritage-introduces-ethnicity-v2-5/)
- Cousin Finder (2025-10-09) is tree-based and needs no DNA test — [DNAeXplained 2025 retrospective](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/); [MyHeritage 2025 year in review](https://blog.myheritage.com/2025/12/myheritage-2025-year-in-review/) (search excerpt)
- **Kits switched to low-pass whole-genome sequencing (announced 2025-10-14):**
  - Roberta Estes reports 2x coverage on Ultima Genomics equipment, "likely" with imputation. MyHeritage says every new kit moved to WGS at no price increase, "covering 3 billion data points instead of the 700,000" of chips.
  - Price: $89 regular, $36 on sale.
  - Raw data is to be provided as **CRAM** files.
  - FamilyTreeDNA said it was preparing to accept these files "by year-end" 2025.
  - The test is backward compatible with MyHeritage's chip-based kits for matching.
  - [DNAeXplained, 2025-10-14](https://dna-explained.com/2025/10/14/myheritage-introduces-a-low-pass-whole-genome-autosomal-dna-test-why-it-matters/); [MyHeritage blog, Oct 2025](https://blog.myheritage.com/2025/10/myheritage-upgrades-its-dna-tests-to-whole-genome-sequencing/)
- Promethease and SNPedia: MyHeritage announced on 2019-09-07 that it had acquired them, by buying their owner Rover Road Bio. Promethease was made free through the end of 2019. — [MyHeritage blog](https://blog.myheritage.com/2019/09/myheritage-acquires-promethease-and-snpedia/); [GenomeWeb](https://www.genomeweb.com/genetic-research/myheritage-acquires-promethease-snpedia-owner-rover-road-bio)
- Segment data: shared-segment information can be downloaded per match (Advanced options, "Download shared DNA info", sometimes behind two-factor authentication). Bulk segment download was removed in October 2023. The chromosome browser is available. — [DNA Painter, updated Feb 2026](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)

#### FamilyTreeDNA (FTDNA)
- Founded in 2000 by Bennett Greenspan, Max Blankfeld and Jim Warren. Family Finder, an autosomal microarray test, launched in May 2010. — [Wikipedia](https://en.wikipedia.org/wiki/FamilyTreeDNA)
- Ownership: Gene by Gene and FamilyTreeDNA merged into the Australian company myDNA on 2021-01-07, with CEO Dr. Lior Rauchberger. The founders moved to the board. — [DNAeXplained, 2021-01-07](https://dna-explained.com/2021/01/07/mydna-merges-with-familytreedna-and-gene-by-gene/); [myDNA](https://www.mydna.life/en-us/gene-by-gene-familytreedna-merger/)
- A May 2026 review says the Houston lab still handles U.S. samples — [Know Your DNA, updated 2026-05-20](https://knowyourdna.com/family-tree-dna-review/)
- 2025-2026 company status: I found no reports of a sale, layoffs or closure. FTDNA shipped several products in this period (below). Revenue and headcount estimates exist only on data-broker profiles, which I did not treat as reliable ([Owler](https://www.owler.com/company/familytreedna)).
- Database: the Family Finder database is just under 1.8M (March 2026, company figure) — [DNA Geek](https://thednageek.com/database-sizes-march-2026/)
- Total testers exceed 2M, and FTDNA holds the largest consumer Y-DNA and full-mtDNA databases — [Know Your DNA, 2026-05-20](https://knowyourdna.com/family-tree-dna-review/)
- **Family Finder moved to NGS (2026):**
  - From 2026-03-02, Family Finder runs as a targeted next-generation sequencing panel built with Twist Bioscience.
  - It covers ~280 million base pairs, including the ~700,000 SNPs of the old Global Screening Array chip.
  - The price is unchanged, and the panel is compatible with older Family Finder tests and supported transfers.
  - [FTDNA Twist Family Finder FAQ](https://help.familytreedna.com/hc/en-us/articles/15269010238991-Twist-Family-Finder-FAQ) (search excerpt; page returned 403); [press release, Feb 2026](https://www.einpresswire.com/article/893145322/familytreedna-advances-genetic-genealogy-with-precision-genomics-partnership)
- **Autosomal transfers after 2026-08-18:**
  - Uploads from other vendors are still accepted. Matching, the match matrix, shared matches and segment-data download remain free.
  - The $19 unlock is retired. To get advanced features, customers must buy the new Family Finder NGS upgrade, $29 at a promotional price, which requires testing a sample.
  - FTDNA's stated reason: "the new Family Finder NGS test provides substantially more coverage than a transfer test", and upcoming features "cannot be supported on files from other vendors."
  - Kits already unlocked are unaffected.
  - [DNAeXplained, 2026-08-13](https://dna-explained.com/2026/08/13/autosomal-dna-unlock-at-familytreedna-to-be-retired-august-18th/)
- Historical: the $19 unlock opened the Chromosome Browser, myOrigins and ancientOrigins for transferred kits — [FTDNA help](https://help.familytreedna.com/hc/en-us/articles/12692882238863-Purchasing-Autosomal-DNA-Transfer-Unlocks) (search excerpt)
- Test prices (as of May 2026, third-party review): Family Finder $79, Y-37 $119, Y-111 $249, Big Y-700 $449, mtFull Sequence $159. Sales run often. — [Know Your DNA, 2026-05-20](https://knowyourdna.com/family-tree-dna-review/)
- Y-DNA: Y-37 to Y-111 STR tests, and Big Y (2013), which reads ~15 million Y positions. FTDNA had identified 50,000+ Y branches by the end of 2021. — [Wikipedia](https://en.wikipedia.org/wiki/FamilyTreeDNA)
- mtDNA:
  - Mitotree launched 2025-02-25 — [DNAeXplained](https://dna-explained.com/2025/02/25/mitotree-is-born/)
  - mtDNA Discover offers "a dozen reports plus one more", Globetrekker, an interactive haplogroup map — [DNAeXplained, 2025-09-02](https://dna-explained.com/2025/09/02/mitochondrial-dna-a-z-a-step-by-step-guide-to-matches-mitotree-and-mtdna-discover/)
  - A public mtDNA haplotree is online — [FTDNA public haplotree](https://www.familytreedna.com/public/mt-dna-haplotree)
  - One tree update added 35,000 new branches — [FTDNA blog](https://blog.familytreedna.com/updated-mtdna-tree-35000-new-branches/)
  - On 2025-11-24, "Mitotree Sprouts 12,773 new branches and includes ancient DNA" — [DNAeXplained retrospective](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- Other 2025 features: a match matrix showing how matches relate to each other (2025-02-12); a "Share" feature that blurs private match information (2025-04-01); WikiTree integration (2025-06-25). — [DNAeXplained 2025 retrospective](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- Segment data: individual and bulk downloads are available. They were disabled in Nov 2023 and restored in Aug 2024. — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)

#### Living DNA
- Founded in September 2016 in Frome, Somerset, England, by David Nicholson (CEO), Tricia Nicholson and Hannah Morden-Nicholson. It is private. It partnered with Findmypast from 2018; that partnership ended in 2023. — [Wikipedia](https://en.wikipedia.org/wiki/Living_DNA)
- Database: "fewer than 300,000 samples" (date unspecified) — [Wikipedia](https://en.wikipedia.org/wiki/Living_DNA)
- Free upload (observed 2026-09-25):
  - An upload gets "8 continental ancestry regions" and Family Matching; users must opt in to "Family Networks".
  - Accepted files: TXT, CSV, ZIP or GZ from AncestryDNA, 23andMe, MyHeritage, FTDNA Family Finder, Gene by Gene and Genographic Geno 2.0. Processing takes up to 48h.
  - Kits start at $95.
  - [Living DNA free upload](https://livingdna.com/free-dna-upload)
- Living DNA's help centre says matching "is currently in an extensive Beta testing stage" — [Living DNA support](https://support.livingdna.com/hc/en-us/articles/360026178111-What-will-I-receive-if-I-upload-my-raw-data) (search excerpt)
- Paid upgrades: Recent Ancestry, Full Ancestry, Wellbeing (11-14 traits), personalised vitamins, Neanderthal/Denisovan, Viking, and a printed book. No prices appear on the page (observed 2026-09-25). — [Living DNA upgrades](https://livingdna.com/dna-upgrades)
- A search summary put the unlock for uploads at £29. I could not verify this on a Living DNA page. — [Living DNA upload page](https://livingdna.com/free-dna-upload) (search excerpt)
- Region counts conflict:
  - "80 regions" worldwide with a 21-region UK breakdown — [Wikipedia](https://en.wikipedia.org/wiki/Living_DNA)
  - "over 150 worldwide regions, including 21 sub-regions within the British Isles"; the British and Irish panel is applied automatically above 20% British/Irish ancestry — [Living DNA support](https://support.livingdna.com/hc/en-us/articles/360019480992-Which-regions-can-we-compare-your-ancestry-with) (search excerpt)
- Product changes: Classical Ancestry (early 2024); a new portal design was "in the final stages of testing" going into 2025 — [Living DNA blog](https://livingdna.com/blog/what-a-year-highlights-from-2024-and-a-peek-ahead-at-2025)
- Segment data: an individual chromosome browser has been available since July 2023; there is no bulk export — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)

#### DNA Painter
- **Price (observed 2026-09-25):** "The cost 55 US dollars for one year" (credit card or PayPal) — [DNA Painter pricing](https://dnapainter.com/help/how-much)
- An older DNA Painter blog post mentions $30 for six months. It is undated and possibly historical. — [DNA Painter blog](https://blog.dnapainter.com/blog/dna-painter-subscriptions/) (search excerpt)
- Free vs subscriber:
  - Free accounts get 1 tree, 1 chromosome map and 1 matrix, plus all standalone tools.
  - Subscribers get up to 50 trees, maps and matrices, unlimited bulk import, text-file import, age-based probabilities and extended GEDCOM import.
  - [DNA Painter pricing](https://dnapainter.com/help/how-much)
- WATO+ (What Are The Odds): one tree is free and more need a subscription. Subscribers can bulk-import segment and match lists from MyHeritage, 23andMe and FTDNA, and repeat imports add only new matches. — [DNA Painter blog](https://blog.dnapainter.com/blog/dna-painter-subscriptions/) (search excerpt)
- Shared cM tool:
  - It uses Shared cM Project v4.0 (March 2020, "nearly 60,000 known relationships"). Its probabilities come from Ancestry's matching white paper (Figure 5.2, simulations).
  - It shows histograms for each relationship and "clearly identifies disagreements between crowd-sourced data and simulation-based probabilities".
  - [DNA Painter blog, 2020-03-27](https://dnapainter.com/blog/introducing-the-updated-shared-cm-tool/); [tool](https://dnapainter.com/tools/sharedcmv4); [Shared cM Project v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- DNA Painter keeps a per-vendor tracker of segment-data availability (first posted 2023-11-20, updated through Feb 2026) — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)

#### Genetic Affairs
- **Pricing (observed 2026-09-25):**
  - Free trial at $0 with 200 credits for new users. It includes AutoCluster, AutoTree, AutoSegment and CSV-based AutoCluster.
  - "Subscriber" plans cost "$5-50 monthly" and add AutoKinship, AutoLineage, hybrid AutoSegment and FTDNA Y-DNA/mtDNA analysis.
  - The page does not list credit allowances per tier.
  - [Genetic Affairs prices](https://geneticaffairs.com/prices.html)
- User write-ups say the lowest tier is $5/month for 550 credits, and an AutoCluster run costs ~25 credits (~$0.25). I did not verify this. — [Dana Leeds](https://www.danaleeds.com/getting-started-autocluster/) (search excerpt)
- How it works: server-side. "Genetic Affairs functions based on the amount of server time a particular tool takes, so it's not possible to just 'run everything.'" — [DNAeXplained, 2026-02-10](https://dna-explained.com/2026/02/10/autokinship-by-genetic-affairs-builds-family-trees-from-your-matches-at-familytreedna-and-more/)
- Inputs as of Feb 2026: automated analysis mainly of FTDNA Family Finder matches (matches, shared matches and trees). It also accepts GEDCOM files, Gephi files from GEDmatch, and Ancestry data via saved HTML or copy/paste. — [DNAeXplained, 2026-02-10](https://dna-explained.com/2026/02/10/autokinship-by-genetic-affairs-builds-family-trees-from-your-matches-at-familytreedna-and-more/)
- Historical: Ancestry sent Genetic Affairs a cease-and-desist in June 2020, ending direct AutoCluster runs on Ancestry — [Dana Leeds](https://www.danaleeds.com/ancestry_genetic_affairs_cease/)
- AutoCluster also exists as a built-in MyHeritage tool and as paid tools on GEDmatch Tier 1 — [DNAeXplained, MyHeritage AutoClusters, 2020-10-28](https://dna-explained.com/2020/10/28/utilizing-myheritage-autoclusters-to-analyze-your-dna-matches/); [DNAeXplained, GEDmatch, 2021](https://dna-explained.com/2021/10/18/autosegment-triangulation-cluster-tool-at-gedmatch/)

#### DNAGedcom
- A desktop client for Windows, macOS, Linux and Chromebook. It downloads matches, shared segments, in-common-with lists, haplogroups, ethnicity estimates and trees.
- Status (observed 2026-09-25): Ancestry, 23andMe and FTDNA work; "Support for MyHeritage and GEDMatch gathering is temporarily offline".
- Analysis tools: Warthen Interactive Cluster, Collins-Leeds Method, Shared Clustering and Chromosome Matrix, with triangulation and mapping via GDAT. The older ADSA, JWorks, KWorks and GWorks programs are retired.
- [DNAGedcom](https://www.dnagedcom.com/)
- Price: none is shown on the homepage. Silver and Gold tiers existed, historically $5/month or $50/year. — [DNAGedcom FAQ](https://www.dnagedcom.com/faq.html#people-tools) (search excerpt)

#### Borland Genetics
- A free toolkit for reconstructing the genomes of deceased relatives from living relatives' raw data. Tools include "The Creeper" (a workflow planner), Phoenix and Darkside (partial or full phased parent kits), and Missing Parent. — [ISOGG wiki](https://isogg.org/wiki/Borland_Genetics); [Borland Genetics](https://borlandgenetics.com/); [Getting started, Sept 2024](https://borlandgenetics.blogspot.com/2024/09/getting-started-with-borland-genetics.html)
- A desktop toolkit also exists — [ISOGG wiki](https://isogg.org/wiki/Borland_Genetics_Desktop_Toolkit)

#### AncestryDNA (the benchmark)
- Database: approaching 30M kits (announced at RootsTech, March 2026), "larger than all of the other genealogical DNA databases combined" — [DNA Geek](https://thednageek.com/database-sizes-march-2026/)
- Accepts no uploads — [DNAeXplained](https://dna-explained.com/2025/10/14/myheritage-introduces-a-low-pass-whole-genome-autosomal-dna-test-why-it-matters/)
- The kit is advertised from $99 — [Know Your DNA](https://knowyourdna.com/ancestry-kit-review/) (search excerpt)
- ThruLines needs an Ancestry membership and a public family tree linked to the test — [Ancestry help](https://help.ancestry.com/hc/en-us/articles/53933348722195-AncestryDNA-and-Memberships) (search excerpt)
- **Pro Tools:**
  - Contents: Tree checker, Tree mapper, Tree insights, Charts & reports, Smart filters, Networks, "Enhanced shared matches" (shared cM and predicted relationships between your matches) and "Matches by cluster". It requires an active Ancestry membership. — [Ancestry help](https://help.ancestry.com/hc/en-us/articles/53933348842131)
  - Price: renews at $10/month — [Ancestry offer page](https://www.ancestry.com/offers/join?feature=proTools) (search excerpt); [MyFamilyPattern](https://myfamilypattern.com/enhanced-shared-matches/)
- Match clustering was released 2025-07-10. A new ThruLines pedigree view went to beta on 2025-12-03 and was reverted on 2025-12-06 for more work. — [DNAeXplained 2025 retrospective](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- Ethnicity, 2025 update (Oct 2025):
  - Regions available rose "from 107 regions to 146".
  - The reference panel exceeds 185,000 samples, and Ancestry holds genome-wide data for 25M+ customers.
  - [Ancestry 2025 white paper](https://www.ancestrycdn.com/support/us/2025/10/2025ancestralregionswhitepaper.pdf) (search excerpt)
  - The update added nested "macro-regions" and retired the sub-regions introduced in 2024 — [KnowWhoWearsTheGenes](https://www.knowwhowearsthegenesinyourfamily.com/blog/my-2025-ancestrydna-origins-update-the-biggest-ethnicity-update-yet) (search excerpt)
  - Ancestry says it can connect members to "more than 3,600 places" (communities) — [Ancestry news](https://www.ancestry.com/c/ancestry-blog/ancestry-news/ancestrydna-announces-more-precise-ethnicity-estimates-powered-worlds-largest-consumer-dna) (search excerpt)
- **Ethnicity, 2026 update (announced 2026-09-24):**
  - It "doubled the number of regions", enlarged the reference panel "by nearly 60%", and introduces "a brand new region assignment algorithm" that "directly compares your DNA with that of the people in our reference panel".
  - It adds state-level detail in Mexico and 93 African ethnic groups, and is free.
  - [Ancestry blog](https://www.ancestry.com/c/ancestry-blog/dna/2026-ancestral-origins-coming-soon)
  - A new "DNA Highlights" feature arrives in the app in the US, CA, AU and UK — [Ancestry](https://www.ancestry.com/c/ancestry-blog/dna/2026-ancestral-origins-coming-soon) (search excerpt)
- Historical (2020): the minimum match rose from 6 cM to 8 cM. By 2020-09-01, matches below 8 cM were hidden unless the user had annotated them. — [The Legal Genealogist, 2020-07-19](https://www.legalgenealogist.com/2020/07/19/chilling-with-ancestrydna/); [The Genetic Genealogist, 2020-07-17](https://thegeneticgenealogist.com/2020/07/17/losing-distant-matches-at-ancestrydna/) (search excerpts)
- Segment data: Ancestry "Never made segment data available" (no chromosome browser, no segment download) — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)

#### 23andMe (the benchmark)
- **Bankruptcy and sale:**
  - 23andMe filed for bankruptcy on 2025-03-25 — [DNAeXplained retrospective](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
  - Regeneron won the May 2025 auction with $256M — [TechCrunch](https://techcrunch.com/2025/06/11/23andme-says-15-of-customers-asked-to-delete-their-genetic-data-since-bankruptcy/)
  - TTAM Research Institute, Anne Wojcicki's nonprofit public benefit corporation, outbid it at $305M and completed the purchase on 2025-07-14 — [GlobeNewswire](https://www.globenewswire.com/news-release/2025/07/14/3114916/0/en/TTAM-Research-Institute-A-Nonprofit-Public-Benefit-Corporation-Completes-The-Acquisition-of-23andMe-Assets.html)
- About 1.9M customers (~15% of 15M) asked for their data to be deleted after the bankruptcy, according to interim CEO Joseph Selsavage's House testimony — [TechCrunch, 2025-06-11](https://techcrunch.com/2025/06/11/23andme-says-15-of-customers-asked-to-delete-their-genetic-data-since-bankruptcy/)
- Database (March 2026): just under 14M (down from ~15M in Oct 2024). About 11.1M take part in relative matching and ~8.8M in segment matching. — [DNA Geek](https://thednageek.com/database-sizes-march-2026/)
- DNA Relatives match cap:
  - Historical: in Oct 2020 the standard cap fell from 2,000 to 1,500. The then-new 23andMe+ offered up to 4,500 matches for $29/year and required a V5-chip retest. — [DNAeXplained, 2020-10-08](https://dna-explained.com/2020/10/08/23andme-changes-download-matches-now-or-lose-many/)
  - A later summary says ~5,000 with a subscription. This conflicts with the 4,500 figure. — [Data Mining DNA](https://dataminingdna.com/23andme-surprise-purge-of-dna-matches-how-it-impacts-you/) (search excerpt)
- Ancestry Composition: "4,000+" regions as of March 2025 — [23andMe blog](https://blog.23andme.com/articles/ancestry-composition-4000-regions)
- Version 7 (Sept 2025) added 33 European and 6 American populations and removed "Broadly" and "Unassigned" from the default view — [23andMe blog](https://blog.23andme.com/articles/ancestry-composition-version-7-is-here) (search excerpt)
- **Segment data:**
  - Disabled in Oct 2023 after the credential-stuffing breach.
  - Partly restored on 2026-02-27, only for 23andMe+ subscribers tested on the V5 chip with "Ancestry+Health". They can compare only their own, managed or connected profiles against relatives. No one can download match segments.
  - [Through the Trees, 2026-03-12](https://throughthetreesblog.tumblr.com/post/810909158988709888/23andme-an-unfortunate-update); [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)
- Premium tiers are marketed with "Advanced DNA Relative Finder + DNA Relatives Clustering" — [Know Your DNA, 23andMe review](https://knowyourdna.com/23andme-dna-kit-review/) (search excerpt)

#### Other upload sites and GEDmatch alternatives (mostly closures)
- Geneanet DNA (launched Feb 2020, owned by Ancestry) was removed on 2023-12-20, and all raw files were deleted that day (historical) — [Geneanet blog](https://en.geneanet.org/genealogyblog/post/2023/11/geneanet-dna-features-will-be-discontinued); [DNAeXplained](https://dna-explained.com/2023/11/20/geneanet-dna-to-end-on-december-20-2023/)
- openSNP, an open genotype-sharing site with ~13,000 users mostly contributing 23andMe files, shut down on 2025-04-30 and deleted all data. It cited 23andMe's collapse and the "rise in authoritarian governments". — [TechCrunch, 2025-04-01](https://techcrunch.com/2025/04/01/genetic-sharing-site-opensnp-to-shut-down-citing-concerns-of-data-privacy-and-rise-in-authoritarian-governments/); [founder's retrospective](https://tzovar.as/sunsetting-opensnp/)
- Genomelink markets itself as a "Free DNA Upload Site For Ancestry & Traits" (not researched further) — [Genomelink](https://genomelink.io/)
- Local, desktop-side tools already exist:
  - DNAGedcom Client — [DNAGedcom](https://www.dnagedcom.com/)
  - GDAT (Genealogical DNA Analysis Tool) — [GDAT site](https://sites.google.com/view/genealogical-dna-analysis-tool/import-data-menu/23andme)
  - Borland Genetics Desktop Toolkit — [ISOGG](https://isogg.org/wiki/Borland_Genetics_Desktop_Toolkit)

#### Timeline of notable changes and launches, 2023-2026
- 2023-10: 23andMe disables its chromosome browser and segment data after the breach. MyHeritage removes bulk segment download. — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)
- 2023-12-20: Geneanet DNA closes — [Geneanet](https://en.geneanet.org/genealogyblog/post/2023/11/geneanet-dna-features-will-be-discontinued)
- 2024-08: FTDNA restores bulk segment download — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)
- 2025-02: MyHeritage Ethnicity v2.5 (42 to 79 ethnicities). FTDNA match matrix (02-12) and Mitotree (02-25). — [DNAeXplained retrospective](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- 2025-03-25: 23andMe files for bankruptcy. 2025-07-14: TTAM completes the purchase. — [DNAeXplained](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/); [GlobeNewswire](https://www.globenewswire.com/news-release/2025/07/14/3114916/0/en/TTAM-Research-Institute-A-Nonprofit-Public-Benefit-Corporation-Completes-The-Acquisition-of-23andMe-Assets.html)
- 2025-04-30: openSNP shuts down — [TechCrunch](https://techcrunch.com/2025/04/01/genetic-sharing-site-opensnp-to-shut-down-citing-concerns-of-data-privacy-and-rise-in-authoritarian-governments/)
- Late May 2025: MyHeritage stops accepting uploads — [DNA Geek](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)
- 2025-07-10: Ancestry match clustering. 2025-12-03/06: ThruLines pedigree view in beta, then reverted. — [DNAeXplained](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- 2025-09: 23andMe Ancestry Composition v7 — [23andMe](https://blog.23andme.com/articles/ancestry-composition-version-7-is-here)
- 2025-10: Ancestry 2025 ethnicity update (146 regions). MyHeritage moves to low-pass WGS kits ($89) and launches Cousin Finder. — [Ancestry white paper](https://www.ancestrycdn.com/support/us/2025/10/2025ancestralregionswhitepaper.pdf); [DNAeXplained](https://dna-explained.com/2025/10/14/myheritage-introduces-a-low-pass-whole-genome-autosomal-dna-test-why-it-matters/)
- 2025-12-24: MyHeritage reportedly exploring a ~$1B sale — [CTech](https://www.calcalistech.com/ctechnews/article/syr4gmfmzl)
- 2026-02: FTDNA runs AutoKinship through Genetic Affairs. 2026-02-27: 23andMe partly restores segment data for 23andMe+. — [DNAeXplained](https://dna-explained.com/2026/02/10/autokinship-by-genetic-affairs-builds-family-trees-from-your-matches-at-familytreedna-and-more/); [Through the Trees](https://throughthetreesblog.tumblr.com/post/810909158988709888/23andme-an-unfortunate-update)
- 2026-03-02: FTDNA Family Finder moves to the Twist NGS panel — [press release](https://www.einpresswire.com/article/893145322/familytreedna-advances-genetic-genealogy-with-precision-genomics-partnership)
- 2026-07-07: GEDmatch announces its new interface (beta Aug 2026; old site retires Mar 2027) and the price rise effective 2026-09-01 — [GEDmatch blog](https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/)
- 2026-08-18: FTDNA retires the unlock for uploaded kits — [DNAeXplained](https://dna-explained.com/2026/08/13/autosomal-dna-unlock-at-familytreedna-to-be-retired-august-18th/)
- 2026-09-24: Ancestry announces its 2026 ethnicity update, doubling regions — [Ancestry](https://www.ancestry.com/c/ancestry-blog/dna/2026-ancestral-origins-coming-soon)

### Inferences
- As of Sept 2026, someone holding a raw file from another company has three places to get new matches: GEDmatch, FTDNA (matching free, advanced tools only after retesting) and Living DNA (matching still called beta). All three are server-side uploads. Analysis with no upload is effectively unserved except by desktop tools (DNAGedcom, GDAT, Borland), which need installing and, for DNAGedcom, a subscription.
- Continental-level ancestry is a commodity. GEDmatch gives many admixture calculators free, and Living DNA gives 8 continental regions free on upload. Lineage's 1000-Genomes continental estimate will not stand out on resolution. It can stand out on method disclosure, uncertainty and stability, since both Ancestry and MyHeritage roughly doubled their region counts in 2025-2026 updates.
- File formats are diverging. MyHeritage WGS produces CRAM files; FTDNA's NGS panel covers ~280 Mbp. A browser tool that reads only the classic 23andMe/Ancestry-style text genotype files will cover a shrinking share of new tests. Reading VCF or derived genotype files, or at least documenting how to convert, may matter. The download formats for FTDNA NGS and for MyHeritage in 2026 are unverified.
- Paywalls on analysis now sit on top of test purchases:
  - GEDmatch Tier 1: $150/year for new subscribers.
  - Ancestry Pro Tools: $10/month on top of a membership.
  - 23andMe+: needed for the chromosome browser.
  - MyHeritage: a subscription for AutoClusters and Theory of Family Relativity.
  - FTDNA: a new test for advanced tools on uploads.

  Free local tools for clustering, chromosome mapping and relationship odds, working from files users can already export, would fill a real gap.

### Gaps
- FTDNA's help centre and forum returned 403. Twist panel details come from a search excerpt and a press release. The raw-data download format for NGS Family Finder kits is not confirmed.
- MyHeritage subscription prices for 2026 (Premium, PremiumPlus, Complete, Omni) were not collected. It is also unconfirmed whether kits uploaded before May 2025 still receive new matches; the help page implies they persist but does not say so.
- 23andMe: current (2026) kit and 23andMe+ prices were not verified. The subscriber match cap conflicts (4,500 in 2020 vs ~5,000 later).
- Living DNA: the £29 upload unlock is unverified, the region count conflicts (80 vs 150+), there is no current matching-database size, and 2026 company status and financial health are unknown.
- GEDmatch does not publish its database size (2.2M is a projection). I found no evidence of any ownership change after Qiagen (the Nov 2024 ToS still names Verogen/Qiagen), but did not confirm this for Sept 2026. Pay-as-you-go prices after 2026-09-01 were not confirmed.
- DNAGedcom's current price is not shown on its site.
- A search excerpt (from DNAGedcom documentation, possibly doc.dnagedcom.com) said Ancestry changed its match-list API in April 2026 so that match names, photos and gender are no longer returned in the main list. I could not open the source page, so this is unverified.
- MyHeritage's "Genetic Groups" feature and its count were not verified in this pass.
- Shared cM Project: I found no public version newer than v4.0 (March 2020). One search summary claimed a February 2025 update, but the details it gave (~60,000 relationships, +147% vs v3) are those of v4.0, so it appears to be a confusion.

## 2. Ownership, privacy and law-enforcement policies (including breaches)

### Takeaway
Only GEDmatch (explicit opt-in; owned by forensic company Verogen/Qiagen) and FamilyTreeDNA (IGGM opt-in, default off since 2024) allow law-enforcement matching. Ancestry, 23andMe and MyHeritage forbid it, yet the FBI used MyHeritage and GEDmatch in violation of their terms in the Kohberger case.

Security incidents recur across the sector:
- GEDmatch's 2020 breach briefly opted every kit in to police matching.
- A 2019-2023 GEDmatch loophole exposed opted-out kits.
- 23andMe's 2023 breach exposed 6.9M people through DNA Relatives.
- 23andMe's 2025 bankruptcy triggered 1.9M deletion requests.
- Academic work showed that uploads alone can extract other users' genotypes.

### Cited Findings

#### GEDmatch
- Historical, 2018: police used GEDmatch to identify the Golden State Killer suspect (arrest April 2018) — [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch)
- Historical, May 2019: GEDmatch moved to an opt-in model for law-enforcement matching after it was used in a non-homicide assault case in Utah — [BuzzFeed News](https://www.buzzfeednews.com/article/peteraldhous/this-genealogy-database-helped-solve-dozens-of-crimes-but); [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch)
- About 260,000 users had opted in by May 2020 — [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch)
- **Historical, 2020-07-19 breach:**
  - All 1.45M profiles were briefly opted in to law-enforcement matching, when only ~280,000 had opted in.
  - Law-enforcement kits also became visible to users.
  - It lasted roughly 3 hours.
  - [BuzzFeed News](https://www.buzzfeednews.com/article/peteraldhous/hackers-gedmatch-dna-privacy); [Wikipedia](https://en.wikipedia.org/wiki/GEDmatch); [DNAeXplained, 2020-07-21](https://dna-explained.com/2020/07/21/gedmatch-security-breach/); [The Legal Genealogist](https://www.legalgenealogist.com/2020/07/21/gedmatch-security-breach/)
  - Search summaries also mention a second breach that set all permissions to opt-out. I did not verify this. — [BuzzFeed News](https://www.buzzfeednews.com/article/peteraldhous/hackers-gedmatch-dna-privacy) (search excerpt)
- **Historical, 2019-2023 loophole:**
  - Practitioners could "manipulate search fields within a DNA comparison tool to trick the system into showing opted-out profiles".
  - This became public at a July 2023 conference. The DNA Doe Project admitted using it between May 2019 and Jan 2021.
  - Verogen did not comment, and "as of this month [Aug 2023], the back door was still open."
  - [The Intercept, 2023-08-18](https://theintercept.com/2023/08/18/gedmatch-dna-police-forensic-genetic-genealogy/)
- In Nov 2023 Verogen announced that forensic genealogy practitioners had circumvented privacy settings and "doctored reports" — [Wikipedia, citing Verogen's 2023-11-13 release](https://en.wikipedia.org/wiki/GEDmatch)
- **Current policy (ToS effective 2024-11-22):**
  - Four kit classes: Private, Opt-in (compared with all, including law enforcement), Opt-out (not compared with law-enforcement kits for violent crimes), and Personal Research (can compare, but the kit is hidden from others' results).
  - Qualifying violent crimes are "murder, nonnegligent manslaughter, aggravated rape, robbery or aggravated assault".
  - [GEDmatch ToS](https://www.gedmatch.com/terms-of-service-november-22-2024/)
  - Law enforcement may also upload kits to identify human remains — [GEDmatch privacy & security](https://www.gedmatch.com/privacy-security/)
- Expert criticism (historical, 2021-05-04):
  - Leah Larkin wrote that "GEDmatch belongs to law enforcement now, not genealogists".
  - She criticised defaults that expose new uploads, and a redefinition of what counts as law-enforcement work that lets "Doe" (unidentified remains) kits be compared with all public kits.
  - [The DNA Geek](https://thednageek.com/gedmatch-has-a-makeover-but-its-purely-cosmetic/)
- **Attacks that need only an upload (security research):**
  - Ney, Ceze and Kohno (NDSS 2020) showed GEDmatch was vulnerable to an adversary who "only uploads normally formatted genetic data files and runs relative matching queries". A target's genotype can be extracted with ~10-20 specially designed kits, and false relatives can be fabricated. — [NDSS paper](https://www.ndss-symposium.org/ndss-paper/genotype-extraction-and-false-relative-attacks-security-risks-to-third-party-genetic-genealogy-services-beyond-identity-inference/); [UW news](https://news.cs.washington.edu/2019/10/29/uncle-phil-is-that-really-you-allen-school-researchers-decode-vulnerabilities-in-online-genetic-genealogy-services/)
  - Edge and Coop independently described similar attacks — [bioRxiv](https://www.biorxiv.org/content/10.1101/798272v2.full)

#### FamilyTreeDNA
- Historical:
  - Dec 2018: the terms were changed to allow FBI access for violent crimes.
  - Jan 2019: BuzzFeed revealed the cooperation.
  - Mar 2019: an opt-out was added, with EU customers opted out by default and others opted in by default.
  - Spring 2020: only ~3% of ~2M users had opted out.
  - Aug 2020: FTDNA reported at least 27 cases helped.
  - [Wikipedia](https://en.wikipedia.org/wiki/FamilyTreeDNA)
- Current: the setting is called "Investigative Genetic Genealogy Matching (IGGM)". "As of 2024 ... users are automatically opted out" and must opt in. — [Your DNA Guide](https://www.yourdnaguide.com/family-tree-dna-opt-out-law-enforcement)
- "New accounts are not visible in law-enforcement searches unless the user explicitly opts in" — [Know Your DNA, 2026-05-20](https://knowyourdna.com/family-tree-dna-review/)
- The privacy statement lets agencies get IGGM access "directly through FamilyTreeDNA or via third-party licensees", with opt-in acting as consent to both. Opted-out users still see law-enforcement kits as matches. — [FTDNA privacy statement](https://www.familytreedna.com/legal/privacy-statement) (search excerpt; the page is JavaScript-rendered and did not fetch)

#### MyHeritage
- MyHeritage's terms prohibit law-enforcement use. The FBI used MyHeritage (and GEDmatch) in the University of Idaho murders investigation, which became public in Feb 2025. — [The DNA Geek, 2025-05-29](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)
- Kohberger's defence argued that the FBI violated the DOJ interim policy and the sites' terms — [Spokesman-Review, 2025-01-24](https://www.spokesman.com/stories/2025/jan/24/kohbergers-idaho-attorneys-argue-fbi-skirted-polic/)
- The judge refused to throw out the DNA evidence, holding that terms-of-service violations do not implicate the Fourth Amendment — [AOL/AP](https://www.aol.com/man-accused-idaho-college-student-205000822.html) (search excerpt)
- Uploads ended in late May 2025, a move widely read as a response to that misuse; MyHeritage gave no stated reason in the DNA Geek's account — [The DNA Geek](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)
- Larkin's view: "If genealogists want to assist forensic investigations, they can do so at GEDmatch and FamilyTreeDNA ... The rest of us should be able to do genetic genealogy without government intrusion." — [The DNA Geek](https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/)
- Private-equity owner Francisco Partners (since 2021) is reportedly exploring a sale (Dec 2025) — [CTech](https://www.calcalistech.com/ctechnews/article/syr4gmfmzl)

#### AncestryDNA
- 2025 transparency report (Jan-Dec 2025): 0 valid requests for DNA data. There were 9 valid non-DNA requests (all criminal subpoenas), and Ancestry complied with 7.
- Ancestry says: "At a minimum, we insist on a court order or search warrant before we will consider producing customer DNA data."
- [Ancestry transparency](https://www.ancestry.com/c/transparency/govt-and-law-enforcement)
- Law enforcement may not use Ancestry's DNA tools to investigate crimes or identify remains — [Ancestry Guide for Law Enforcement](https://www.ancestry.com/c/legal/lawenforcement)

#### 23andMe / TTAM
- Transparency report (last updated 2026-04-30): 23andMe "has not released any customer information to law enforcement to date" and requires express written consent before disclosing relatives' identities — [23andMe transparency report](https://www.23andme.com/transparency-report/) (search excerpt)
- Historical, 2023 breach: credential stuffing into ~14,000 accounts exposed data on ~6.9M people through DNA Relatives — [AlternativeTo news](https://alternativeto.net/news/2023/12/massive-data-breach-at-23andme-personal-data-of-6-9-million-users-compromised)
- The UK ICO fined 23andMe £2.31M in June 2025 — [The Register, 2025-06-17](https://www.theregister.com/2025/06/17/23andme_ico_fine/)
- Bankruptcy fallout: 1.9M deletion requests. A House committee criticised the lack of an opt-in model for transferring data in the sale. — [TechCrunch](https://techcrunch.com/2025/06/11/23andme-says-15-of-customers-asked-to-delete-their-genetic-data-since-bankruptcy/); [Malwarebytes](https://www.malwarebytes.com/blog/news/2025/06/23andme-raked-by-congress-on-privacy-sale-of-genetic-data)
- TTAM says customers keep the choice to change their research-participation decision — [GlobeNewswire](https://www.globenewswire.com/news-release/2025/07/14/3114916/0/en/TTAM-Research-Institute-A-Nonprofit-Public-Benefit-Corporation-Completes-The-Acquisition-of-23andMe-Assets.html)

#### Others
- openSNP's founder said keeping the data could invite misuse by "private forensic firms, law enforcement agencies, and governments" — [TechCrunch](https://techcrunch.com/2025/04/01/genetic-sharing-site-opensnp-to-shut-down-citing-concerns-of-data-privacy-and-rise-in-authoritarian-governments/)
- Living DNA's Wikipedia entry records 2020 research warning that "hackers using creative means could easily exploit the upload process" at smaller genealogy platforms — [Wikipedia](https://en.wikipedia.org/wiki/Living_DNA)

### Inferences
- A tool that never receives genotype data avoids the whole class of risks above: breaches, loopholes, subpoenas, bankruptcy transfers and upload-based genotype extraction. This is Lineage's clearest structural difference, and it can be stated plainly with the incidents above as evidence.
- The trade-off is that a local tool cannot match you against strangers. Lineage should present itself as the analysis layer for data users already hold (their own raw files, a relative's file, match and segment exports), not as a matching network.
- Being operated by a forensic company, with published crime categories, is part of GEDmatch's trust problem. An open-source tool with no server-side DNA storage can say, verifiably, that it holds nothing to hand over.

### Gaps
- Living DNA's law-enforcement policy and any transparency report were not researched.
- MyHeritage's current terms-of-service wording on law enforcement was not fetched directly; it is inferred from the DNA Geek and court reporting.
- I found no MyHeritage public statement explaining the end of uploads.
- The 23andMe transparency report page was not fetched directly (search excerpt only).

## 3. Visualisations offered and how they are received

### Takeaway
The recurring visuals are:
- chromosome browsers and segment painting (GEDmatch, FTDNA, MyHeritage, Living DNA, DNA Painter; restricted at 23andMe; absent at Ancestry)
- cluster heatmaps (Genetic Affairs' AutoCluster, reused in MyHeritage and GEDmatch; Ancestry since 2025, behind Pro Tools)
- relationship-hypothesis trees (MyHeritage Theory of Family Relativity, Ancestry ThruLines, Genetic Affairs AutoTree/AutoKinship, DNA Painter WATO)
- ethnicity maps
- Y/mtDNA haplotrees and migration maps (FTDNA)

The reception evidence found concerns usability and stability more than any individual chart.

### Cited Findings
- **Chromosome browsers and segment data**, per vendor (DNA Painter tracker, Feb 2026):
  - FTDNA and GEDmatch: individual and bulk segments.
  - MyHeritage: individual only; bulk removed Oct 2023.
  - Living DNA: individual browser since July 2023.
  - 23andMe: individual only for 23andMe+ (Feb 2026).
  - Ancestry: none, ever.
  - Jonny Perl notes that communication from testing companies has been "patchy".
  - [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)
- **Reception of 23andMe's restricted chromosome browser:** the change was called "desperate, tone deaf, and extortionist" and "revoking access to standard features that have existed since the late 2000s". The V5-chip requirement excludes deceased relatives who cannot retest. — [Through the Trees, 2026-03-12](https://throughthetreesblog.tumblr.com/post/810909158988709888/23andme-an-unfortunate-update)
- **Cluster heatmaps:**
  - MyHeritage AutoClusters show matches that "likely descend from common ancestors in a compelling visual chart" — [MyHeritage Knowledge Base](https://education.myheritage.com/article/autoclusters-for-dna-matches/) (search excerpt)
  - Genetic Affairs' free tier includes AutoCluster, AutoTree and AutoSegment — [Genetic Affairs prices](https://geneticaffairs.com/prices.html)
  - Ancestry added "Matches by cluster: visual grouping of DNA matches with common ancestors" to Pro Tools — [Ancestry help](https://help.ancestry.com/hc/en-us/articles/53933348842131)
  - Ancestry released clustering on 2025-07-10 — [DNAeXplained](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- **Trees:**
  - Ancestry's new ThruLines pedigree view lasted three days in beta (2025-12-03 to 12-06) before being withdrawn for more work, and was expected back in 2026 — [DNAeXplained](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
  - MyHeritage's Theory of Family Relativity (2019) was greeted as "An Exciting New Tool" by Dana Leeds — [Dana Leeds](https://www.danaleeds.com/myheritages-theory-of-family-relativity-an-exciting-new-tool/)
  - MyHeritage advises users to re-check theories regularly because they change — [MyHeritage Knowledge Base](https://education.myheritage.com/article/why-you-should-check-your-theories-of-family-relativity-regularly/)
  - Genetic Affairs AutoKinship builds hypothesis trees from matches, shared matches and archived trees — [DNAeXplained, 2026-02-10](https://dna-explained.com/2026/02/10/autokinship-by-genetic-affairs-builds-family-trees-from-your-matches-at-familytreedna-and-more/)
- **Relationship-probability visuals:**
  - DNA Painter's Shared cM tool shows per-relationship histograms and flags where crowd-sourced data conflicts with simulated probabilities — [DNA Painter, 2020-03-27](https://dnapainter.com/blog/introducing-the-updated-shared-cm-tool/)
  - It is "the most common usage of The Shared cM Project results" — [Shared cM Project search summary citing DNA Painter](https://dnapainter.com/tools/sharedcmv4) (search excerpt)
  - The DNA Geek features it in her "What's in your toolbox?" series — [The DNA Geek](https://thednageek.com/whats-in-your-toolbox-dna-painter-shared-cm-project-tool/)
- **Match matrix:** FTDNA released a matrix showing how matches relate to each other on 2025-02-12 — [DNAeXplained](https://dna-explained.com/2025/12/31/2025-genetic-genealogy-retrospective-wow-what-a-year/)
- **Ethnicity visuals:**
  - GEDmatch admixture calculators include chromosome painting across many hobbyist models — [ISOGG wiki](https://isogg.org/wiki/Admixture_analyses)
  - Ancestry's new app "DNA Highlights" pairs statistics with shareable images and videos — [Ancestry](https://www.ancestry.com/c/ancestry-blog/dna/2026-ancestral-origins-coming-soon) (search excerpt)
- **Haplogroup visuals:** FTDNA's Globetrekker is an "interactive haplogroup map" within mtDNA Discover, and it has public haplotrees — [DNAeXplained](https://dna-explained.com/2025/09/02/mitochondrial-dna-a-z-a-step-by-step-guide-to-matches-mitotree-and-mtdna-discover/); [FTDNA mt haplotree](https://www.familytreedna.com/public/mt-dna-haplotree)
- **GEDmatch usability (historical, 2021):**
  - Leah Larkin found the 2021 redesign "purely cosmetic": "There is no explanation of offset, limit, cM size, tag groups, or overlap cutoff". The new site was "_very_ slow", and tools went missing at launch.
  - [The DNA Geek, 2021-05-04](https://thednageek.com/gedmatch-has-a-makeover-but-its-purely-cosmetic/)
  - The 2026 redesign's stated goals ("an easier learning curve", "clearer navigation") implicitly acknowledge this — [GEDmatch blog](https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/)

### Inferences
- Cluster heatmaps and chromosome maps are now expected features. What stays scarce is visuals that show **uncertainty and provenance**: which segments support a claimed relationship, how confident an ethnicity segment is, and what changed between versions.
- Relationship tools present one predicted relationship; DNA Painter is the partial exception. Showing the full distribution, with the data source version (Shared cM v4, 2020) and simulated probabilities side by side, is a proven pattern users value.

### Gaps
- No systematic user-reception data (surveys or ratings) exists for specific visualisations. Reception evidence is expert blogs and forum threads.
- Reddit could not be searched (see Section 4 Gaps).
- No first-hand reviews of the GEDmatch 2026 beta were found; the beta began in Aug 2026.

## 4. Recurring user complaints

### Takeaway
The recurring complaints are:
1. Ethnicity results change dramatically between updates and sometimes contradict paper trails.
2. Paywalls and price rises layered on existing purchases (23andMe+, GEDmatch Tier 1, Ancestry Pro Tools, FTDNA's retest requirement, MyHeritage ending uploads).
3. Privacy and law-enforcement exposure (GEDmatch, FBI misuse, 23andMe's breach and bankruptcy).
4. Confusing or dated interfaces (GEDmatch above all).
5. Loss of data access (segment data, third-party tools blocked).
6. Relationship predictions and false small matches.

### Cited Findings
- **Ethnicity volatility:**
  - The Mumsnet thread on Ancestry's 2025 update (started 2025-10-11) includes: "27% Germanic Europe to 0%"; "from 33% Scottish to not at all"; Yorkshire "renamed...as the East Midlands; quite a blooper!"; "I don't like the way they have lumped Central Scotland and N Ireland together"; loss of documented "Orkney roots". Some praise: it "sorted out the Irish thing"; "more credible than the last one". — [Mumsnet](https://www.mumsnet.com/talk/genealogy/5425817-ancestry-dna-update-2025)
  - Ancestry itself warns that with the 2026 algorithm "nearly all customers are likely to see either their exact percentages or their regions change" and that some regions "have disappeared" — [Ancestry 2026 update](https://www.ancestry.com/c/ancestry-blog/dna/2026-ancestral-origins-coming-soon) (search excerpt)
  - The 2025 update retired the sub-regions introduced only in 2024 — [KnowWhoWearsTheGenes](https://www.knowwhowearsthegenesinyourfamily.com/blog/my-2025-ancestrydna-origins-update-the-biggest-ethnicity-update-yet) (search excerpt)
  - 23andMe v7 removed "Broadly" and "Unassigned" categories from the default view — [23andMe blog](https://blog.23andme.com/articles/ancestry-composition-version-7-is-here) (search excerpt)
  - An African-ancestry blog judged the autumn 2025 Ancestry and 23andMe updates "nothing worthwhile yet for African DNA", except 23andMe's new African genetic groups — [Tracing African Roots, 2025-11-12](https://tracingafricanroots.wordpress.com/2025/11/12/ancestry-23andme-updates-nothing-worthwile-yet-for-african-dna-but-hold-on-for-it/)
- **Paywalls and price rises:**
  - 23andMe+ is now required for the chromosome browser — [Through the Trees](https://throughthetreesblog.tumblr.com/post/810909158988709888/23andme-an-unfortunate-update)
  - GEDmatch Tier 1 rose to $15/$150 for new subscribers from 2026-09-01 — [GEDmatch](https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/)
  - A reviewer asks whether Ancestry Enhanced Shared Matches is "worth $10 per month" — [MyFamilyPattern](https://myfamilypattern.com/enhanced-shared-matches/)
  - FTDNA now requires a new NGS test ($29 promo) to unlock uploaded kits. Roberta Estes advised buying the old unlock immediately if "the tester cannot retest". — [DNAeXplained](https://dna-explained.com/2026/08/13/autosomal-dna-unlock-at-familytreedna-to-be-retired-august-18th/)
  - MyHeritage now says to buy its kit instead of uploading — [MyHeritage help](https://www.myheritage.com/help/en/articles/12852724-why-can-t-i-upload-my-dna-data-file)
  - In 2020, 23andMe cut the free match list from 2,000 to 1,500 and sold 4,500 matches via a $29/year subscription — [DNAeXplained](https://dna-explained.com/2020/10/08/23andme-changes-download-matches-now-or-lose-many/)
- **Privacy and law enforcement:** see Section 2. Examples include the GEDmatch breach and loophole ([BuzzFeed](https://www.buzzfeednews.com/article/peteraldhous/hackers-gedmatch-dna-privacy); [The Intercept](https://theintercept.com/2023/08/18/gedmatch-dna-police-forensic-genetic-genealogy/)), 1.9M 23andMe deletion requests ([TechCrunch](https://techcrunch.com/2025/06/11/23andme-says-15-of-customers-asked-to-delete-their-genetic-data-since-bankruptcy/)) and openSNP's closure ([TechCrunch](https://techcrunch.com/2025/04/01/genetic-sharing-site-opensnp-to-shut-down-citing-concerns-of-data-privacy-and-rise-in-authoritarian-governments/)).
- **Dated or confusing UI:**
  - Larkin's 2021 GEDmatch critique — [The DNA Geek](https://thednageek.com/gedmatch-has-a-makeover-but-its-purely-cosmetic/)
  - Trustpilot reviewers describe GEDmatch as hard to navigate. One reports taking ~15 minutes to find how to access an account; another doubts renewing Tier 1 despite liking the tools. — [Trustpilot (AT)](https://at.trustpilot.com/review/gedmatch.com) (search excerpt)
- **Loss of data access:**
  - DNAGedcom's MyHeritage and GEDmatch gathering is "temporarily offline" — [DNAGedcom](https://www.dnagedcom.com/)
  - Ancestry's 2020 cease-and-desist ended direct Genetic Affairs runs — [Dana Leeds](https://www.danaleeds.com/ancestry_genetic_affairs_cease/)
  - Segment exports are restricted at 23andMe and MyHeritage and absent at Ancestry — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)
  - Genetic Affairs' credit model means users cannot "just 'run everything'" — [DNAeXplained](https://dna-explained.com/2026/02/10/autokinship-by-genetic-affairs-builds-family-trees-from-your-matches-at-familytreedna-and-more/)
- **Relationship and match accuracy (historical, 2020):**
  - Ancestry dropped matches below 8 cM, citing research that the change removed about two-thirds of false matches. In parent-child trio data, ~40% of a child's matches in that range matched neither parent.
  - [The Legal Genealogist](https://www.legalgenealogist.com/2020/07/19/chilling-with-ancestrydna/); [The Genetic Genealogist](https://thegeneticgenealogist.com/2020/07/17/losing-distant-matches-at-ancestrydna/); [The DNA Geek](https://thednageek.com/ancestrydnas-2020-matching-white-paper/) (search excerpts)
- **Theory of Family Relativity instability:** MyHeritage recommends re-checking theories regularly because they change — [MyHeritage Knowledge Base](https://education.myheritage.com/article/why-you-should-check-your-theories-of-family-relativity-regularly/)

### Inferences
- Complaints cluster where users cannot see why a result changed or how it was computed: ethnicity reshuffles, disappearing matches, and theories that change. A tool that versions its reference data and methods, and shows a diff between versions, answers the most common frustration directly.
- Paywall anger is sharpest when features are removed and resold (23andMe) or when uploads are pushed toward retesting (FTDNA, MyHeritage). A free, open tool that never withdraws features is a credible, differentiating promise.

### Gaps
- **Reddit (r/AncestryDNA, r/Genealogy, r/23andme) could not be searched or fetched.** The search tool refuses the reddit.com domain ("not accessible to our user agent"), so no specific Reddit threads are cited. User sentiment here comes from Mumsnet, Trustpilot, blogs and blog comments instead. A human pass over Reddit is recommended if thread-level citations are required.
- There is no quantitative complaint data (review-score trends, support-ticket volumes) for any platform.

## 5. What none of them do well that an open, local, source-cited tool could do

### Takeaway
Every platform that analyses DNA does so on its own servers, with proprietary reference panels and algorithms that change between releases. None publishes its methods and reference data in a form users can inspect, reproduce, run offline or compare across versions. Relationship predictions carry little uncertainty, apart from DNA Painter's histograms. Access to segment data, the raw material of chromosome mapping, is shrinking.

An open, browser-only, source-cited tool can compete on four things the incumbents structurally do not offer: evidence, uncertainty, method transparency and zero data custody. It cannot compete on match-database size.

### Cited Findings
- **No upload-free analysis at scale:**
  - GEDmatch stores an encoded genotype after deleting the raw file — [GEDmatch](https://www.gedmatch.com/privacy-security/)
  - MyHeritage, FTDNA, Living DNA, Ancestry and 23andMe all process server-side. Genetic Affairs runs on server time. — [DNAeXplained](https://dna-explained.com/2026/02/10/autokinship-by-genetic-affairs-builds-family-trees-from-your-matches-at-familytreedna-and-more/)
  - The only local options found are desktop programs (DNAGedcom Client, GDAT, Borland Desktop Toolkit) — [DNAGedcom](https://www.dnagedcom.com/); [GDAT](https://sites.google.com/view/genealogical-dna-analysis-tool/import-data-menu/23andme); [ISOGG](https://isogg.org/wiki/Borland_Genetics_Desktop_Toolkit)
- **Upload destinations are closing:**
  - MyHeritage (2025) — [MyHeritage help](https://www.myheritage.com/help/en/articles/12852724-why-can-t-i-upload-my-dna-data-file)
  - Geneanet (2023) — [Geneanet](https://en.geneanet.org/genealogyblog/post/2023/11/geneanet-dna-features-will-be-discontinued)
  - openSNP (2025) — [TechCrunch](https://techcrunch.com/2025/04/01/genetic-sharing-site-opensnp-to-shut-down-citing-concerns-of-data-privacy-and-rise-in-authoritarian-governments/)
  - FTDNA's advanced tools for uploads (2026) — [DNAeXplained](https://dna-explained.com/2026/08/13/autosomal-dna-unlock-at-familytreedna-to-be-retired-august-18th/)
- **Uploading is itself a risk:** genotype extraction with ~10-20 crafted kits ([NDSS 2020](https://www.ndss-symposium.org/ndss-paper/genotype-extraction-and-false-relative-attacks-security-risks-to-third-party-genetic-genealogy-services-beyond-identity-inference/)); the GEDmatch breach ([BuzzFeed](https://www.buzzfeednews.com/article/peteraldhous/hackers-gedmatch-dna-privacy)); FBI misuse of sites that forbid it ([Spokesman-Review](https://www.spokesman.com/stories/2025/jan/24/kohbergers-idaho-attorneys-argue-fbi-skirted-polic/))
- **Opaque, shifting ancestry methods:**
  - Ancestry's 2026 update replaces the region-assignment algorithm and grows the reference panel ~60% — [Ancestry](https://www.ancestry.com/c/ancestry-blog/dna/2026-ancestral-origins-coming-soon)
  - Ancestry does publish white papers, but the reference panel (185,000+ samples in 2025) is private — [Ancestry 2025 white paper](https://www.ancestrycdn.com/support/us/2025/10/2025ancestralregionswhitepaper.pdf) (search excerpt)
  - MyHeritage went from 42 to 79 ethnicities in one release — [MyHeritage](https://blog.myheritage.com/2025/02/introducing-ethnicity-estimate-v2-5-improved-dna-ethnicity-model/)
  - GEDmatch's hobbyist admixture calculators are free but explained mainly by third-party guides — [ISOGG](https://isogg.org/wiki/Admixture_analyses); [Data Mining DNA](https://dataminingdna.com/best-gedmatch-calculator/)
- **Undocumented parameters:** GEDmatch gives "no explanation of offset, limit, cM size, tag groups, or overlap cutoff" (2021) — [The DNA Geek](https://thednageek.com/gedmatch-has-a-makeover-but-its-purely-cosmetic/)
- **Relationship prediction with provenance is rare:**
  - DNA Painter's tool is the reference implementation: Shared cM v4 (2020) plus Ancestry's simulated probabilities, histograms, and flagged conflicts — [DNA Painter](https://dnapainter.com/blog/introducing-the-updated-shared-cm-tool/)
  - The underlying crowd-sourced dataset dates from March 2020 — [Shared cM Project v4 PDF](https://thegeneticgenealogist.com/wp-content/uploads/2020/03/Shared-cM-Project-Version-4.pdf)
- **Segment data scarcity:** as of Feb 2026, bulk segment exports are available only from FTDNA and GEDmatch; MyHeritage and Living DNA give per-match data; 23andMe gives restricted per-match data to paying subscribers; Ancestry gives none — [DNA Painter](https://dnapainter.com/blog/what-is-going-on-with-segment-data/)
- **New raw formats:** MyHeritage WGS delivers CRAM files ([DNAeXplained](https://dna-explained.com/2025/10/14/myheritage-introduces-a-low-pass-whole-genome-autosomal-dna-test-why-it-matters/)); FTDNA Family Finder is now a ~280 Mbp NGS panel ([press release](https://www.einpresswire.com/article/893145322/familytreedna-advances-genetic-genealogy-with-precision-genomics-partnership))

### Inferences (opportunities for Lineage, derived from the findings above)
1. **Zero custody, provably.** Analysis runs in the browser, is open source, works offline, and nothing leaves the device. Pair this with a plain account of why it matters, citing the GEDmatch breach and loophole, the 23andMe breach and bankruptcy, Kohberger, and NDSS 2020. No competitor can make this claim.
2. **Evidence for every claim.**
   - Relationship predictions shown as full likelihood distributions over candidate relationships, citing the data used (Shared cM Project v4, March 2020; simulation-based probabilities) and flagging where they disagree, as DNA Painter does.
   - Segment lists and chromosome maps shown as the evidence behind each prediction.
   - Explicit warnings where the math is weak: half vs full relationships, endogamy, small segments under ~8 cM (Ancestry's own false-match finding).
3. **Transparent, stable ancestry.**
   - A continental estimate from public 1000 Genomes data, with the reference populations, SNP count, algorithm, per-chromosome painting and confidence intervals all visible.
   - A versioned changelog and "what changed since the last version" diffs. This answers the most common complaint, results that move between updates, which incumbents now warn about openly.
4. **Free versions of paywalled analysis, run on files users can already export:**
   - FTDNA and GEDmatch bulk segment CSVs, MyHeritage per-match segment downloads, and 23andMe's limited exports.
   - Kit-to-kit comparison of two raw files (GEDmatch One-to-One without the upload).
   - Chromosome mapping, triangulation and cluster heatmaps from shared-match exports.

   This undercuts GEDmatch Tier 1 ($150/yr), Ancestry Pro Tools ($10/mo) and 23andMe+ for users with the files. Lineage should rely on user-exported files only, never scraping; Ancestry sent a cease-and-desist to Genetic Affairs in 2020.
5. **Format readiness.** Early support for (or clear conversion guidance for) genotype VCFs derived from the new sequencing products (FTDNA NGS, MyHeritage WGS/CRAM) would make Lineage one of the first tools that can read them. Parsing CRAM itself in a browser is heavy and needs a reference genome; this is an engineering inference, not a verified finding.
6. **Method pages as a product.** Each tool gets a method page citing its sources: Shared cM Project, 1000 Genomes, the genetic maps used for cM, and SNP-overlap thresholds. This fixes the documentation gap Larkin flagged at GEDmatch and matches the "real, transparent process" the owner wants.

### Gaps
- I did not find any other browser-only (client-side) genealogy DNA analysis tool to compare against, but did not run a dedicated search. A GitHub project, [CameronD73/529renew](https://github.com/CameronD73/529renew), surfaced in results as related to 23andMe segment data and was not investigated.
- Whether DNA Painter processes imported data in the browser or on its servers was not verified. Its accounts store maps and trees, which implies server storage, but this was not confirmed.
- Licensing of the Shared cM Project data for reuse in an open-source tool was not checked.
- Whether FTDNA NGS kits or MyHeritage WGS kits give customers a downloadable genotype file that an existing parser could read, and in what format, is unverified for 2026.
- No data were found on how many consumers hold raw files but have no remaining upload destination, so the size of the "local analysis" audience is not quantified.
