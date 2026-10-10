/** Messages between the page and the analysis worker, and the shapes of their results. */
import type {
  AncestryTree, BuildCheck, ComponentAdmixture, Painting, PcaProjection, PopulationScore, RelationshipSpec, Report, SexInference, SimilarityResult, TraitCall,
} from "@lineage/core";
export type { PopulationScore };

export interface KitOverview {
  slot: string;
  name: string;
  format: string;
  build: number;
  chipVersion?: string;
  variants: number;
  called: number;
  callRate: number;
  heterozygosity: number;
  perChromosome: Array<{ chrom: string; variants: number; called: number; heterozygous: number }>;
  /** SNP counts in 2 Mb bins per chromosome, for the karyogram. */
  density: Record<string, number[]>;
  sex: SexInference;
  roh: Array<{ chrom: string; start: number; end: number; lengthBp: number; lengthCm: number; snps: number }>;
  rohTotalCm: number;
  parse: { rowsRead: number; rowsKept: number; skipped: number; ms: number; bytes: number; compressed?: string };
  demo?: boolean;
}

export interface AncestryResult {
  components: Array<{ id: string; label: string; populations: string[] }>;
  populations: string[];
  coverage: { called: number; total: number; strandFlipped: number; alleleMismatch: number; notOnChip: number; noCall: number; conflicting: number; perChromosome: number[] };
  /** The build the kit's positions matched: 37, 38 (read through the panel's GRCh38 positions) or "unknown". */
  build: BuildCheck;
  similarity: SimilarityResult;
  /** Continental components. */
  admixture: ComponentAdmixture;
  /** Regional components, when tiers for the person's continents were loaded. */
  regional?: ComponentAdmixture;
  /** Continents, shown regions and "Broadly" remainders, ready to display. */
  tree: AncestryTree;
  pca: PcaProjection;
  painting: Painting;
  /** Whether a validation calibration was loaded, and when it was made. */
  calibration: { loaded: boolean; generated?: string; windowZ?: number; conformalCoverage?: number; intervalCoverage?: number };
  /** Tier files loaded for regional detail. */
  tiers: string[];
  ms: number;
}

export interface Posterior { id: string; label: string; probability: number; likelihood: number; sharedCmId?: string; up: number; down: number; half: boolean }

export interface DistributionSketch {
  id: string;
  label: string;
  /** Histogram of simulated totals: bin edges in cM and the share of pairs per bin. */
  edges: number[];
  share: number[];
  noSharing: number;
  mean: number;
  p01: number;
  p99: number;
  v4?: { average: number; min: number; max: number };
}

export interface CompareView {
  a: string;
  b: string;
  comparableSnps: number;
  sharedSnps: number;
  oppositeHomozygousRate: number;
  half: Array<{ chrom: string; start: number; end: number; cm: number; snps: number }>;
  full: Array<{ chrom: string; start: number; end: number; cm: number; snps: number }>;
  totalCm: number;
  fullCm: number;
  segments: number;
  longestCm: number;
  posteriors: Posterior[];
  sketches: DistributionSketch[];
}

export interface MatchRow {
  match: string;
  totalCm: number;
  autosomalCm: number;
  xCm: number;
  segments: number;
  segmentsOver7: number;
  longestCm: number;
  posteriors: Posterior[];
  truth?: string;
}

export interface MatchesView {
  rows: MatchRow[];
  segments: Array<{ match: string; chrom: string; start: number; end: number; cm: number }>;
  clusters: Array<{ chrom: string; start: number; end: number; matches: string[] }>;
  skipped: number;
}

export interface DemoView {
  people: Array<{ id: string; name: string; sex: "M" | "F"; role?: string; birthYear: number; birthPlace: string; population?: string; kit?: boolean }>;
  gedcom: string;
  segmentsCsv: string;
  truth: Record<string, string>;
  kits: Array<{ slot: string; name: string; role: string }>;
  overview: KitOverview;
}

export interface SimulatedView {
  relationship: RelationshipSpec;
  totalCm: number;
  segments: number;
  longestCm: number;
  fullCm: number;
  pieces: Array<{ chrom: string; startCm: number; endCm: number; lengthCm: number; kind: "half" | "full" }>;
  chromosomeCm: number[];
}

export interface Methods {
  init: { params: { dataBase: string }; result: { relationships: RelationshipSpec[] } };
  loadFile: { params: { slot: string; file: Blob; name: string }; result: KitOverview };
  loadDemo: { params: Record<string, never>; result: DemoView };
  overview: { params: { slot: string }; result: KitOverview };
  ancestry: { params: { slot: string }; result: AncestryResult };
  traits: { params: { slot: string }; result: TraitCall[] };
  compare: { params: { a: string; b: string }; result: CompareView };
  predict: { params: { totalCm: number; segments?: number; fullCm?: number }; result: { posteriors: Posterior[]; sketches: DistributionSketch[] } };
  matches: { params: { csv: string; truth?: Record<string, string> }; result: MatchesView };
  simulate: { params: { relationship: string; seed: number }; result: SimulatedView };
  report: { params: { slot: string }; result: Report };
  drop: { params: { slot: string }; result: boolean };
}
export type Method = keyof Methods;

export type Request = { id: number; method: Method; params: unknown };
export type Response =
  | { id: number; kind: "result"; result: unknown }
  | { id: number; kind: "error"; error: string }
  | { id: number; kind: "progress"; stage: string; fraction?: number }
  /** Requests the worker made, from its own Resource Timing (the page cannot see them). */
  | { id: 0; kind: "resources"; entries: Array<{ url: string; bytes: number; type: string }> };
