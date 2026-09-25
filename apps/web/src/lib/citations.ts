/**
 * Every paper the web app cites. Each PubMed ID was checked against NCBI on
 * 2026-09-25 (title, journal, year and first author);
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
