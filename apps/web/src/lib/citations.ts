/**
 * Every paper the web app cites. Each PubMed ID was checked against NCBI on
 * 2026-09-25, the ancestry papers on 2026-09-27 (title, journal, year and first author);
 * scripts/data/verify-citations.mjs repeats the check. Add a paper here, with
 * its PMID, before citing it anywhere in the interface.
 */
export interface Paper { key: string; authors: string; year: number; title: string; journal: string; pmid?: string; doi?: string; url?: string }

export const PAPERS = {
  kg2015: { key: "kg2015", authors: "1000 Genomes Project Consortium", year: 2015, title: "A global reference for human genetic variation", journal: "Nature 526:68-74", pmid: "26432245", doi: "10.1038/nature15393" },
  hapmap2007: { key: "hapmap2007", authors: "International HapMap Consortium", year: 2007, title: "A second generation human haplotype map of over 3.1 million SNPs", journal: "Nature 449:851-861", pmid: "17943122" },
  admixture2009: { key: "admixture2009", authors: "Alexander DH, Novembre J, Lange K", year: 2009, title: "Fast model-based estimation of ancestry in unrelated individuals", journal: "Genome Research 19:1655-1664", pmid: "19648217", doi: "10.1101/gr.094052.109" },
  eigen2006: { key: "eigen2006", authors: "Patterson N, Price AL, Reich D", year: 2006, title: "Population structure and eigenanalysis", journal: "PLoS Genetics 2:e190", pmid: "17194218", doi: "10.1371/journal.pgen.0020190" },
  flare2023: { key: "flare2023", authors: "Browning SR, Waples RK, Browning BL", year: 2023, title: "Fast, accurate local ancestry inference with FLARE", journal: "American Journal of Human Genetics 110:326-335", pmid: "36610402", doi: "10.1016/j.ajhg.2022.12.010" },
  pedsim2019: { key: "pedsim2019", authors: "Caballero M, Seidman DN, Qiao Y, et al.", year: 2019, title: "Crossover interference and sex-specific genetic maps shape identical by descent sharing in close relatives", journal: "PLoS Genetics 15:e1007979", pmid: "31860654" },
  ersa2011: { key: "ersa2011", authors: "Huff CD, Witherspoon DJ, Simonson TS, et al.", year: 2011, title: "Maximum-likelihood estimation of recent shared ancestry (ERSA)", journal: "Genome Research 21:768-774", pmid: "21324875" },
  ceballos2018: { key: "ceballos2018", authors: "Ceballos FC, Joshi PK, Clark DW, Ramsay M, Wilson JF", year: 2018, title: "Runs of homozygosity: windows into population history and trait architecture", journal: "Nature Reviews Genetics 19:220-234", pmid: "29335644", doi: "10.1038/nrg.2017.109" },
  ggv2017: { key: "ggv2017", authors: "Marcus JH, Novembre J", year: 2017, title: "Visualizing the geography of genetic variants", journal: "Bioinformatics 33:594-595", pmid: "27742697" },
  haak2015: { key: "haak2015", authors: "Haak W, Lazaridis I, Patterson N, et al.", year: 2015, title: "Massive migration from the steppe was a source for Indo-European languages in Europe", journal: "Nature 522:207-211", pmid: "25731166", doi: "10.1038/nature14317" },
  lazaridis2014: { key: "lazaridis2014", authors: "Lazaridis I, Patterson N, Mittnik A, et al.", year: 2014, title: "Ancient human genomes suggest three ancestral populations for present-day Europeans", journal: "Nature 513:409-413", pmid: "25230663", doi: "10.1038/nature13673" },
  harney2021: { key: "harney2021", authors: "Harney É, Patterson N, Reich D, Wakeley J", year: 2021, title: "Assessing the performance of qpAdm: a statistical tool for studying population admixture", journal: "Genetics 217:iyaa045", pmid: "33772284", doi: "10.1093/genetics/iyaa045" },
  aadr2024: { key: "aadr2024", authors: "Mallick S, Micco A, Mah M, et al.", year: 2024, title: "The Allen Ancient DNA Resource (AADR): a curated compendium of ancient human genomes", journal: "Scientific Data 11:182", pmid: "38341426", doi: "10.1038/s41597-024-03031-7" },
  lippert2017: { key: "lippert2017", authors: "Lippert C, Sabatini R, Maher MC, et al.", year: 2017, title: "Identification of individuals by trait prediction using whole-genome sequencing data", journal: "PNAS 114:10166-10171", pmid: "28874526", doi: "10.1073/pnas.1711125114" },
  sharedcm2020: { key: "sharedcm2020", authors: "Bettinger BT", year: 2020, title: "The Shared cM Project 4.0 (tool by Jonny Perl, DNA Painter)", journal: "dnapainter.com/tools/sharedcmv4", url: "https://dnapainter.com/tools/sharedcmv4" },
  // Ancestry references and methods, added 2026-09-27 (docs/research/reports/Ancestry methods and reference data.md).
  koenig2024: { key: "koenig2024", authors: "Koenig Z, Yohannes MT, Nkambule LL, et al.", year: 2024, title: "A harmonized public resource of deeply sequenced diverse human genomes", journal: "Genome Research 34:796-809", pmid: "38749656", doi: "10.1101/gr.278378.123" },
  bergstrom2020: { key: "bergstrom2020", authors: "Bergström A, McCarthy SA, Hui R, et al.", year: 2020, title: "Insights into human genetic variation and population history from 929 diverse genomes", journal: "Science 367:eaay5012", pmid: "32193295", doi: "10.1126/science.aay5012" },
  rannala1997: { key: "rannala1997", authors: "Rannala B, Mountain JL", year: 1997, title: "Detecting immigration by using multilocus genotypes", journal: "PNAS 94:9197-9201", pmid: "9256459", doi: "10.1073/pnas.94.17.9197" },
  jorsboe2017: { key: "jorsboe2017", authors: "Jørsboe E, Hanghøj K, Albrechtsen A", year: 2017, title: "fastNGSadmix: admixture proportions and principal component analysis of a single NGS sample", journal: "Bioinformatics 33:3148-3150", pmid: "28957500", doi: "10.1093/bioinformatics/btx474" },
  toyama2020: { key: "toyama2020", authors: "Toyama KS, Crochet PA, Leblois R", year: 2020, title: "Sampling schemes and drift can bias admixture proportions inferred by structure", journal: "Molecular Ecology Resources 20:1769-1785", pmid: "32735380", doi: "10.1111/1755-0998.13234" },
  lee2010: { key: "lee2010", authors: "Lee S, Zou F, Wright FA", year: 2010, title: "Convergence and prediction of principal component scores in high-dimensional settings", journal: "Annals of Statistics 38:3605-3629", pmid: "21442047", doi: "10.1214/10-AOS821" },
  zhang2020: { key: "zhang2020", authors: "Zhang D, Dey R, Lee S", year: 2020, title: "Fast and robust ancestry prediction using principal component analysis", journal: "Bioinformatics 36:3439-3446", pmid: "32196066", doi: "10.1093/bioinformatics/btaa152" },
  avadhanam2025: { key: "avadhanam2025", authors: "Avadhanam S, Williams AL", year: 2025, title: "Phase-free local ancestry inference mitigates the impact of switch errors on phase-based methods", journal: "G3 15:jkaf122", pmid: "40471844", doi: "10.1093/g3journal/jkaf122" },
  hilmarsson2026: { key: "hilmarsson2026", authors: "Hilmarsson H, Kumar AS, Barrabés M, et al.", year: 2026, title: "Scalable high resolution ancestry deconvolution for genomic data", journal: "Nature Communications 17", pmid: "42649165", doi: "10.1038/s41467-026-75391-0" },
  massarat2023: { key: "massarat2023", authors: "Massarat AR, Lamkin M, Reeve C, et al.", year: 2023, title: "Haptools: a toolkit for admixture and haplotype analysis", journal: "Bioinformatics 39:btad104", pmid: "36847450", doi: "10.1093/bioinformatics/btad104" },
  durand2014: { key: "durand2014", authors: "Durand EY, Do CB, Mountain JL, Macpherson JM", year: 2014, title: "Ancestry Composition: a novel, efficient pipeline for ancestry deconvolution (23andMe white paper 23-16, updated 2020)", journal: "23andMe", url: "https://permalinks.23andme.com/pdf/23-16_ancestry_composition.pdf" },
  ancestrydna2025: { key: "ancestrydna2025", authors: "AncestryDNA", year: 2025, title: "Ancestral Regions 2025 White Paper", journal: "Ancestry", url: "https://www.ancestrycdn.com/support/us/2025/10/2025ancestralregionswhitepaper.pdf" },
} satisfies Record<string, Paper>;

export type PaperKey = keyof typeof PAPERS;

export function cite(key: PaperKey): string {
  const p = PAPERS[key] as Paper;
  return `${p.authors.split(",")[0]}${p.authors.includes(",") ? " et al." : ""} (${p.year})`;
}

export function paperUrl(key: PaperKey): string {
  const p = PAPERS[key] as Paper;
  return p.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` : p.url ?? (p.doi ? `https://doi.org/${p.doi}` : "#");
}
