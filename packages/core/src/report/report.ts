/**
 * The report is the contract between the computational engine and any
 * narrative layer (human or AI). Every statement in it is a Fact with an id,
 * a machine-readable value, the evidence it rests on, and a source. A
 * narrator may only restate facts by id; anything it cannot point to a fact
 * for must not be said. That is the whole accuracy model of this framework.
 */
import type { KitSummary, RohSegment, SexInference } from "../kit/stats.js";
import type { CompareResult } from "../compare/hir.js";
import type { MatchSummary } from "../segments/parse.js";
import type { RelationshipPrediction } from "../segments/sharedcm.js";
import type { TraitCall } from "../traits/types.js";
import type { AdmixtureResult } from "../admixture/supervised.js";
import type { HaplogroupCall } from "../haplogroup/tree.js";
import type { GedcomStats, FoundRelationship } from "../gedcom/parse.js";

export type Confidence = "established" | "probable" | "suggestive" | "unknown";

export interface Fact {
  id: string;
  kind: string;
  statement: string;
  value?: unknown;
  evidence?: string;
  source?: string;
  confidence: Confidence;
}

export interface Report {
  version: "1";
  generated: string;
  subject: { label: string; kitFormat?: string };
  facts: Fact[];
  sections: {
    kit?: KitSummary;
    sex?: SexInference;
    roh?: RohSegment[];
    traits?: TraitCall[];
    admixture?: AdmixtureResult;
    haplogroups?: HaplogroupCall[];
    comparison?: CompareResult;
    matches?: Array<MatchSummary & { prediction: RelationshipPrediction }>;
    gedcom?: GedcomStats;
    relationships?: FoundRelationship[];
  };
  limitations: string[];
}

export class ReportBuilder {
  private readonly facts: Fact[] = [];
  private readonly sections: Report["sections"] = {};
  private readonly limitations = new Set<string>([
    "Consumer genotyping chips sample roughly 600,000-700,000 of ~3 billion positions; absence of a variant from this report does not mean absence from the genome.",
    "Genotyping error rates of ~0.1-0.5% mean any single surprising call should be confirmed before it is relied on.",
  ]);
  private n = 0;
  constructor(private readonly subject: Report["subject"]) {}

  private id(prefix: string): string { return `${prefix}-${++this.n}`; }

  fact(kind: string, statement: string, extra: Partial<Omit<Fact, "id" | "kind" | "statement">> = {}): Fact {
    const f: Fact = { id: this.id(kind), kind, statement, confidence: extra.confidence ?? "established", ...extra };
    this.facts.push(f);
    return f;
  }

  limitation(text: string): void { this.limitations.add(text); }

  kit(summary: KitSummary): this {
    this.sections.kit = summary;
    this.fact("kit", `The file is in ${summary.format} format on build ${summary.build}, with ${summary.variants.toLocaleString()} variants and a ${(summary.callRate * 100).toFixed(2)}% call rate.`, { value: { variants: summary.variants, callRate: summary.callRate }, evidence: "parsed file" });
    return this;
  }

  sex(s: SexInference): this {
    this.sections.sex = s;
    this.fact("sex", s.inferred === "undetermined" ? "Genetic sex could not be determined from the X and Y calls." : `Genetic sex inferred as ${s.inferred}.`, { value: s.inferred, evidence: s.rationale, confidence: s.inferred === "undetermined" ? "unknown" : "established" });
    return this;
  }

  roh(segs: RohSegment[]): this {
    this.sections.roh = segs;
    const total = segs.reduce((a, s) => a + s.lengthBp, 0);
    this.fact("roh", `${segs.length} run${segs.length === 1 ? "" : "s"} of homozygosity over 4 Mb, totalling ${(total / 1e6).toFixed(1)} Mb.`, { value: { count: segs.length, totalBp: total }, evidence: "SNP-count scan, no genetic map", confidence: "probable" });
    if (total > 100e6) this.limitation("Long total runs of homozygosity can reflect recent parental relatedness or a small founder population; interpretation requires family context.");
    return this;
  }

  traits(calls: TraitCall[]): this {
    this.sections.traits = calls;
    for (const c of calls) {
      if (c.status === "called" || c.status === "strand-flipped") {
        this.fact("trait", `${c.variant.name} (${c.variant.gene} ${c.variant.rsid}): genotype ${c.genotype}, ${c.effectAlleleCount} cop${c.effectAlleleCount === 1 ? "y" : "ies"} of ${c.variant.effectAllele}. ${c.interpretation}`, {
          value: { rsid: c.variant.rsid, genotype: c.genotype, effectAlleleCount: c.effectAlleleCount },
          evidence: c.variant.evidenceSummary,
          source: c.variant.sources.map((s) => `${s.authors} (${s.year}) ${s.journal}${s.pmid ? ` PMID:${s.pmid}` : ""}`).join("; "),
          confidence: "probable",
        });
      } else {
        this.fact("trait", `${c.variant.name} (${c.variant.rsid}) could not be called: ${c.status}${c.note ? ` (${c.note})` : ""}.`, { value: { rsid: c.variant.rsid, status: c.status }, confidence: "unknown" });
      }
    }
    this.limitation("Trait calls describe single well-replicated variants; most traits are polygenic and environment-dependent, so a variant states a tendency, not an outcome.");
    return this;
  }

  admixture(a: AdmixtureResult): this {
    this.sections.admixture = a;
    const parts = a.populations.map((p, i) => `${p} ${(a.proportions[i]! * 100).toFixed(1)}% (95% CI ${(a.ci95[i]![0] * 100).toFixed(0)}-${(a.ci95[i]![1] * 100).toFixed(0)}%)`);
    this.fact("admixture", `Supervised admixture against ${a.populations.length} reference populations over ${a.snpsUsed.toLocaleString()} SNPs: ${parts.join(", ")}.`, { value: { populations: a.populations, proportions: a.proportions, ci95: a.ci95 }, evidence: `EM maximum likelihood, ${a.iterations} iterations; block bootstrap intervals`, confidence: a.snpsUsed >= 1000 ? "probable" : "suggestive" });
    for (const c of a.caveats) this.limitation(c);
    return this;
  }

  haplogroup(h: HaplogroupCall): this {
    (this.sections.haplogroups ??= []).push(h);
    this.fact("haplogroup", h.haplogroup ? `${h.chrom === "Y" ? "Y-DNA" : "mtDNA"} haplogroup: deepest supported branch ${h.haplogroup}.` : `${h.chrom === "Y" ? "Y-DNA" : "mtDNA"} haplogroup could not be resolved below the root on this chip.`, { value: h.haplogroup, evidence: h.note, confidence: h.haplogroup ? (h.path.reduce((a, e) => a + e.derived, 0) >= 3 ? "probable" : "suggestive") : "unknown" });
    return this;
  }

  comparison(label: string, c: CompareResult): this {
    this.sections.comparison = c;
    const unit = c.unit;
    const half = unit === "cM" ? `${c.totals.halfCm!.toFixed(1)} cM` : `${(c.totals.halfBp / 1e6).toFixed(1)} Mb`;
    const full = unit === "cM" ? `${c.totals.fullCm!.toFixed(1)} cM` : `${(c.totals.fullBp / 1e6).toFixed(1)} Mb`;
    this.fact("comparison", `Against ${label}: ${c.halfIdentical.length} half-identical segments totalling ${half}, ${c.fullyIdentical.length} fully-identical segments totalling ${full}; opposite-homozygous rate ${(c.oppositeHomozygousRate * 100).toFixed(2)}% over ${c.comparableSnps.toLocaleString()} shared SNPs.`, { value: c.totals, evidence: "direct genotype comparison", confidence: "established" });
    if (unit === "bp") this.limitation("No genetic map was supplied, so segment lengths are physical (Mb), which only approximates genetic distance (cM).");
    return this;
  }

  matches(rows: Array<MatchSummary & { prediction: RelationshipPrediction }>): this {
    this.sections.matches = rows;
    for (const m of rows.slice(0, 50)) {
      const top = m.prediction.candidates.slice(0, 4).map((c) => c.entry.label).join(", ");
      this.fact("match", `${m.match}: ${m.autosomalCm.toFixed(1)} autosomal cM over ${m.segments} segments (longest ${m.longestCm.toFixed(1)} cM). Consistent with: ${top || "no listed relationship"}.`, { value: { match: m.match, autosomalCm: m.autosomalCm, candidates: m.prediction.candidates.map((c) => c.entry.id) }, source: "Shared cM Project v4 (Bettinger 2020) via DNA Painter", confidence: "probable" });
    }
    return this;
  }

  gedcom(s: GedcomStats): this {
    this.sections.gedcom = s;
    this.fact("gedcom", `The family tree contains ${s.individuals.toLocaleString()} individuals in ${s.families.toLocaleString()} families${s.earliestBirthYear ? `, with birth years from ${s.earliestBirthYear} to ${s.latestBirthYear}` : ""}.`, { value: s, evidence: "parsed GEDCOM" });
    return this;
  }

  relationship(r: FoundRelationship, aName: string, bName: string): this {
    (this.sections.relationships ??= []).push(r);
    this.fact("relationship", `${bName} is ${aName}'s ${r.description} (coefficient of relationship ${r.math.coefficientOfRelationship.toFixed(4)}; expected ~${(r.math.expectedHalfIdenticalFraction * 100).toFixed(1)}% shared DNA).`, { value: r.math, evidence: `${r.paths.length} path(s) through ${r.commonAncestors.join(", ")}`, source: "family tree as recorded" , confidence: "established" });
    return this;
  }

  build(): Report {
    return { version: "1", generated: new Date().toISOString(), subject: this.subject, facts: [...this.facts], sections: this.sections, limitations: [...this.limitations] };
  }
}
