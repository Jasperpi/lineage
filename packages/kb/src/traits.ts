/**
 * Curated trait knowledge base.
 *
 * Inclusion rule: a variant is listed only if (1) the association is
 * established by a primary paper with a PubMed ID that was checked against
 * NCBI, (2) its forward-strand alleles and positions were pulled from Ensembl
 * (GRCh38 and GRCh37) rather than typed from memory, and (3) the trait is a
 * benign, visible or dietary characteristic. Medical, pharmacogenetic and
 * disease-risk variants are deliberately out of scope for this knowledge base.
 *
 * Positions, alleles and 1000 Genomes phase 3 super-population frequencies
 * come from data/kb/ensembl-verified-2026-09-24.json (Ensembl REST, retrieved
 * 2026-09-24). Interpretations are written to state what the cited evidence
 * supports and no more.
 */
import type { Chrom, Citation, TraitVariant } from "@lineage/core";
import verified from "./ensembl-verified.json" with { type: "json" };

type Verified = Record<string, { chrom: string; pos38: number; pos37: number; alleles: string[]; frequencies: Array<{ population: string; allele: string; frequency: number }> }>;
const V = verified as Verified;

const FREQ_SOURCE = { name: "1000 Genomes Project phase 3 via Ensembl REST", retrieved: "2026-09-24", url: "https://rest.ensembl.org/variation/homo_sapiens" };

const CITE = {
  enattah2002: { title: "Identification of a variant associated with adult-type hypolactasia", authors: "Enattah NS, Sahi T, Savilahti E, Terwilliger JD, Peltonen L, Järvelä I", journal: "Nat Genet", year: 2002, pmid: "11788828" },
  sturm2008: { title: "A single SNP in an evolutionary conserved region within intron 86 of the HERC2 gene determines human blue-brown eye color", authors: "Sturm RA et al.", journal: "Am J Hum Genet", year: 2008, pmid: "18252222" },
  eiberg2008: { title: "Blue eye color in humans may be caused by a perfectly associated founder mutation in a regulatory element located within the HERC2 gene inhibiting OCA2 expression", authors: "Eiberg H et al.", journal: "Hum Genet", year: 2008, pmid: "18172690" },
  lamason2005: { title: "SLC24A5, a putative cation exchanger, affects pigmentation in zebrafish and humans", authors: "Lamason RL et al.", journal: "Science", year: 2005, pmid: "16357253" },
  graf2005: { title: "Single nucleotide polymorphisms in the MATP gene are associated with normal human pigmentation variation", authors: "Graf J, Hodgson R, van Daal A", journal: "Hum Mutat", year: 2005, pmid: "15714523" },
  sulem2007: { title: "Genetic determinants of hair, eye and skin pigmentation in Europeans", authors: "Sulem P et al.", journal: "Nat Genet", year: 2007, pmid: "17952075" },
  han2008: { title: "A genome-wide association study identifies novel alleles associated with hair color and skin pigmentation", authors: "Han J et al.", journal: "PLoS Genet", year: 2008, pmid: "18483556" },
  edwards2010: { title: "Association of the OCA2 polymorphism His615Arg with melanin content in east Asian populations", authors: "Edwards M et al.", journal: "PLoS Genet", year: 2010, pmid: "20221248" },
  fujimoto2008: { title: "A scan for genetic determinants of human hair morphology: EDAR is associated with Asian hair thickness", authors: "Fujimoto A et al.", journal: "Hum Mol Genet", year: 2008, pmid: "18065779" },
  valverde1995: { title: "Variants of the melanocyte-stimulating hormone receptor gene are associated with red hair and fair skin in humans", authors: "Valverde P et al.", journal: "Nat Genet", year: 1995, pmid: "7581459" },
  north1999: { title: "A common nonsense mutation results in alpha-actinin-3 deficiency in the general population", authors: "North KN et al.", journal: "Nat Genet", year: 1999, pmid: "10192379" },
  yang2003: { title: "ACTN3 genotype is associated with human elite athletic performance", authors: "Yang N et al.", journal: "Am J Hum Genet", year: 2003, pmid: "12879365" },
  yoshiura2006: { title: "A SNP in the ABCC11 gene is the determinant of human earwax type", authors: "Yoshiura K et al.", journal: "Nat Genet", year: 2006, pmid: "16444273" },
  kim2003: { title: "Positional cloning of the human quantitative trait locus underlying taste sensitivity to phenylthiocarbamide", authors: "Kim UK et al.", journal: "Science", year: 2003, pmid: "12595690" },
} satisfies Record<string, Citation>;

function entry(rsid: string, fields: Omit<TraitVariant, "rsid" | "chrom" | "pos38" | "pos37" | "alleles" | "frequencies" | "frequenciesSource">): TraitVariant {
  const v = V[rsid];
  if (!v) throw new Error(`No verified Ensembl record for ${rsid}`);
  if (!v.alleles.includes(fields.effectAllele)) throw new Error(`${rsid}: effect allele ${fields.effectAllele} not in ${v.alleles.join("/")}`);
  return { rsid, chrom: v.chrom as Chrom, pos38: v.pos38, pos37: v.pos37, alleles: v.alleles, frequencies: v.frequencies, frequenciesSource: FREQ_SOURCE, ...fields };
}

export const TRAITS: readonly TraitVariant[] = [
  entry("rs4988235", {
    id: "lct-13910", gene: "MCM6 (LCT enhancer)", name: "Lactase persistence, European allele (-13910*T)", category: "diet", effectAllele: "A",
    interpretation: {
      0: "No copies of the European lactase-persistence allele. Lactase production typically declines after childhood with this genotype in European-ancestry populations. Other persistence alleles found in Africa and the Middle East are not tested by this marker.",
      1: "One copy of the lactase-persistence allele. Persistence is inherited as a dominant trait, so one copy is generally associated with continued lactase production into adulthood.",
      2: "Two copies of the lactase-persistence allele, associated with continued lactase production into adulthood.",
    },
    evidenceSummary: "The -13910*T allele (forward-strand A) showed complete association with lactase persistence in Finnish families.",
    caveats: "Established in European populations; different persistence alleles predominate in East Africa and the Arabian Peninsula. Genotype describes enzyme persistence, not tolerance of any particular food.",
    sources: [CITE.enattah2002],
  }),
  entry("rs182549", {
    id: "lct-22018", gene: "MCM6 (LCT enhancer)", name: "Lactase persistence linked marker (-22018*A)", category: "diet", effectAllele: "T",
    interpretation: {
      0: "No copies of the -22018 linked allele. In Europeans this almost always accompanies the non-persistence genotype at -13910.",
      1: "One copy of the -22018 linked allele. In Europeans this almost always travels with one copy of the -13910 persistence allele.",
      2: "Two copies of the -22018 linked allele, in Europeans nearly always paired with two -13910 persistence alleles.",
    },
    evidenceSummary: "Reported alongside -13910 in the same study; the two variants are in near-complete linkage disequilibrium in Europeans.",
    caveats: "A linked marker, not the functional variant; useful as a consistency check on rs4988235. Linkage differs outside Europe.",
    sources: [CITE.enattah2002],
  }),
  entry("rs12913832", {
    id: "herc2-eye", gene: "HERC2 (OCA2 regulatory region)", name: "Blue versus brown eye colour", category: "pigmentation", effectAllele: "G",
    interpretation: {
      0: "Two copies of the brown-associated allele (A/A). Brown eyes are the most common outcome in people of European ancestry with this genotype.",
      1: "One copy each of the brown- and blue-associated alleles (A/G). Brown or intermediate eye colour is most common, though blue eyes do occur.",
      2: "Two copies of the blue-associated allele (G/G). Blue or light eyes are the most common outcome in people of European ancestry with this genotype.",
    },
    evidenceSummary: "The SNP lies in a conserved OCA2 regulatory element and is the single strongest predictor of blue versus brown eye colour in Europeans.",
    caveats: "Eye colour is polygenic; other variants in OCA2, TYR, SLC24A4 and IRF4 modify the outcome, and the predictive value was established in European-ancestry samples.",
    sources: [CITE.sturm2008, CITE.eiberg2008],
  }),
  entry("rs1426654", {
    id: "slc24a5", gene: "SLC24A5", name: "Skin pigmentation, SLC24A5 Ala111Thr", category: "pigmentation", effectAllele: "A",
    interpretation: {
      0: "Two copies of the ancestral allele, the near-universal genotype in East Asian and sub-Saharan African populations.",
      1: "One copy of the derived Thr111 allele, associated with lighter skin pigmentation.",
      2: "Two copies of the derived Thr111 allele, the near-fixed genotype in European populations and associated with lighter skin pigmentation.",
    },
    evidenceSummary: "The derived allele is associated with lighter skin in admixed African-American and African-Caribbean samples and was estimated to account for 25-38% of the European-African difference in skin melanin index.",
    caveats: "One of several major pigmentation loci; skin tone is polygenic and strongly shaped by sun exposure.",
    sources: [CITE.lamason2005],
  }),
  entry("rs16891982", {
    id: "slc45a2", gene: "SLC45A2 (MATP)", name: "Skin and hair pigmentation, SLC45A2 Leu374Phe", category: "pigmentation", effectAllele: "G",
    interpretation: {
      0: "Two copies of the ancestral Leu374 allele, the common genotype outside Europe.",
      1: "One copy of the derived Phe374 allele, associated with lighter pigmentation.",
      2: "Two copies of the derived Phe374 allele, the predominant genotype in Europeans and associated with lighter skin and hair.",
    },
    evidenceSummary: "The Phe374 allele is associated with lighter skin, hair and eye colour in samples of European ancestry and is at high frequency in Europe and rare elsewhere.",
    caveats: "Polygenic trait; effect sizes are modest relative to the whole set of pigmentation loci.",
    sources: [CITE.graf2005],
  }),
  entry("rs1042602", {
    id: "tyr-s192y", gene: "TYR", name: "Tyrosinase Ser192Tyr (eye colour and freckling)", category: "pigmentation", effectAllele: "A",
    interpretation: {
      0: "No copies of the Tyr192 allele.",
      1: "One copy of the Tyr192 allele, a coding variant in tyrosinase associated with eye colour and freckling in Europeans.",
      2: "Two copies of the Tyr192 allele, a coding variant in tyrosinase associated with eye colour and freckling in Europeans.",
    },
    evidenceSummary: "One of two coding TYR variants reaching genome-wide significance for eye colour and freckles in Icelandic and Dutch samples.",
    caveats: "Small effect; reported in European-ancestry samples only.",
    sources: [CITE.sulem2007],
  }),
  entry("rs1393350", {
    id: "tyr-intron", gene: "TYR", name: "Tyrosinase intronic variant (eye colour and freckling)", category: "pigmentation", effectAllele: "A",
    interpretation: {
      0: "No copies of the minor allele at this TYR variant.",
      1: "One copy of the minor allele, associated with eye colour and freckling in Europeans.",
      2: "Two copies of the minor allele, associated with eye colour and freckling in Europeans.",
    },
    evidenceSummary: "Associated with eye colour and freckles at genome-wide significance in the Icelandic and Dutch pigmentation scan.",
    caveats: "Small effect; European-ancestry samples only.",
    sources: [CITE.sulem2007],
  }),
  entry("rs12203592", {
    id: "irf4", gene: "IRF4", name: "IRF4 hair colour, skin colour and tanning variant", category: "pigmentation", effectAllele: "T",
    interpretation: {
      0: "No copies of the IRF4 T allele.",
      1: "One copy of the IRF4 T allele, associated with lighter hair, lighter skin and reduced tanning response in Europeans.",
      2: "Two copies of the IRF4 T allele, associated with lighter hair, lighter skin and reduced tanning response in Europeans.",
    },
    evidenceSummary: "Strongly associated with hair colour, and also with skin colour, eye colour and tanning response, in over 10,000 people of European ancestry.",
    caveats: "European-ancestry samples; the allele is rare outside Europe.",
    sources: [CITE.han2008],
  }),
  entry("rs1800414", {
    id: "oca2-h615r", gene: "OCA2", name: "OCA2 His615Arg (East Asian skin pigmentation)", category: "pigmentation", effectAllele: "C",
    interpretation: {
      0: "No copies of the Arg615 allele, the usual genotype outside East Asia.",
      1: "One copy of the Arg615 allele, associated with lighter skin pigmentation in East Asian populations.",
      2: "Two copies of the Arg615 allele, associated with lighter skin pigmentation in East Asian populations.",
    },
    evidenceSummary: "Associated with quantitatively measured skin pigmentation in East Asian samples and replicated in an independent Chinese sample; the allele is essentially confined to East Asia.",
    caveats: "Studied in East Asian populations; polygenic trait.",
    sources: [CITE.edwards2010],
  }),
  entry("rs3827760", {
    id: "edar", gene: "EDAR", name: "EDAR Val370Ala (hair thickness)", category: "morphology", effectAllele: "G",
    interpretation: {
      0: "No copies of the Ala370 allele, the usual genotype outside East Asia and the Americas.",
      1: "One copy of the Ala370 allele, associated with thicker scalp hair fibres in East Asian populations.",
      2: "Two copies of the Ala370 allele, associated with thicker scalp hair fibres in East Asian populations.",
    },
    evidenceSummary: "The derived allele is associated with increased hair fibre thickness in Thai and Indonesian samples and is at high frequency across East Asia and Native American populations.",
    caveats: "Established in East Asian samples; the allele is rare in Europe and Africa.",
    sources: [CITE.fujimoto2008],
  }),
  entry("rs1805007", {
    id: "mc1r-r151c", gene: "MC1R", name: "MC1R Arg151Cys (red hair variant)", category: "pigmentation", effectAllele: "T",
    interpretation: {
      0: "No copies of the Cys151 red-hair variant at this position.",
      1: "One copy of the Cys151 red-hair variant. Carriers often have fair skin and freckling; red hair usually requires two MC1R loss-of-function variants (at this or other MC1R positions).",
      2: "Two copies of the Cys151 red-hair variant, strongly associated with red hair and fair skin.",
    },
    evidenceSummary: "Arg151Cys is one of the MC1R variants associated with red hair and fair skin in the original MC1R study.",
    caveats: "Only two of several MC1R red-hair variants are tested here; a person can carry two red-hair alleles across different MC1R positions and still show no copies at this one.",
    sources: [CITE.valverde1995],
  }),
  entry("rs1805008", {
    id: "mc1r-r160w", gene: "MC1R", name: "MC1R Arg160Trp (red hair variant)", category: "pigmentation", effectAllele: "T",
    interpretation: {
      0: "No copies of the Trp160 red-hair variant at this position.",
      1: "One copy of the Trp160 red-hair variant. Carriers often have fair skin and freckling; red hair usually requires two MC1R loss-of-function variants.",
      2: "Two copies of the Trp160 red-hair variant, strongly associated with red hair and fair skin.",
    },
    evidenceSummary: "Arg160Trp is one of the MC1R variants associated with red hair and fair skin in the original MC1R study.",
    caveats: "See rs1805007; other MC1R variants are not tested by this marker.",
    sources: [CITE.valverde1995],
  }),
  entry("rs1815739", {
    id: "actn3", gene: "ACTN3", name: "ACTN3 Arg577Ter (alpha-actinin-3 in fast-twitch muscle)", category: "muscle", effectAllele: "T",
    interpretation: {
      0: "Two functional copies of ACTN3 (R/R); alpha-actinin-3 is produced in fast-twitch muscle fibres.",
      1: "One functional and one stop copy (R/X); alpha-actinin-3 is still produced.",
      2: "Two stop copies (X/X): no alpha-actinin-3 protein in fast-twitch fibres, a common and benign genotype found in roughly a fifth of Europeans.",
    },
    evidenceSummary: "The 577X stop allele abolishes alpha-actinin-3 without disease; the X/X genotype was under-represented among elite sprint and power athletes in an Australian cohort.",
    caveats: "Athletic performance is overwhelmingly determined by training, physiology and many other genes; this genotype is a weak population-level association, not a personal prediction.",
    sources: [CITE.north1999, CITE.yang2003],
  }),
  entry("rs17822931", {
    id: "abcc11", gene: "ABCC11", name: "ABCC11 Gly180Arg (earwax type)", category: "morphology", effectAllele: "T",
    interpretation: {
      0: "Two copies of the wet-earwax allele (C/C): wet earwax.",
      1: "One copy each (C/T): wet earwax, since the wet allele is dominant.",
      2: "Two copies of the dry-earwax allele (T/T): dry earwax, the predominant type in East Asia.",
    },
    evidenceSummary: "The T allele was shown to be the determinant of dry earwax, inherited as a recessive trait, with striking frequency differences between East Asian and other populations.",
    caveats: "Essentially Mendelian for earwax type; the same variant has been linked to axillary odour in later studies not cited here.",
    sources: [CITE.yoshiura2006],
  }),
  entry("rs713598", {
    id: "tas2r38", gene: "TAS2R38", name: "TAS2R38 Ala49Pro (bitter taste of PTC/PROP)", category: "sensory", effectAllele: "G",
    interpretation: {
      0: "No copies of the taster (Pro49) allele: most likely a non-taster of the bitter compounds PTC and PROP.",
      1: "One copy of the taster (Pro49) allele: most likely able to taste PTC and PROP as bitter, since the taster haplotype is largely dominant.",
      2: "Two copies of the taster (Pro49) allele: most likely a strong taster of PTC and PROP.",
    },
    evidenceSummary: "TAS2R38 was identified as the PTC-tasting locus; Ala49Pro is the first of three coding sites that define the taster (PAV) and non-taster (AVI) haplotypes.",
    caveats: "Taster status is set by the three-site haplotype; this single marker tags it well in most populations but not perfectly.",
    sources: [CITE.kim2003],
  }),
];

export const TRAITS_BY_RSID: ReadonlyMap<string, TraitVariant> = new Map(TRAITS.map((t) => [t.rsid, t]));
