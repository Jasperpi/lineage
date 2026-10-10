/** Reference files the page itself draws from (the worker loads its own copies of the analysis data). */
import { dataBase } from "./engine.js";

export interface Population {
  code: string; name: string; description: string; superpopulation: string; lat: number; lon: number;
  samples: number; female: number; male: number; diaspora?: boolean; note?: string; origin?: string;
}
export interface PopulationsFile { provenance: Provenance; superpopulations: Array<{ code: string; name: string }>; populations: Population[] }
export interface Provenance { sources?: Array<{ name: string; url: string; sha256?: string; bytes?: number; retrieved?: string }>; citation?: string; terms?: string; notes?: string; method?: string; script?: string; [k: string]: unknown }

export interface PanelMetaFile {
  id: string; title: string; file: string; sha256: string; bytes: number;
  provenance: { genotypes: { citation: string; retrieved: string; sources: Array<{ name: string; url: string; sha256: string; bytes: number }> }; chips: { arrays: Array<{ name: string; snps: number }>; shared: number; sources: Array<{ name: string; url: string; sha256: string }> }; script: string; generated: string };
  qc: { input: number; palindromic: number; incomplete: number; rare: number; kept: number; dense: number; core: number; ldPrune: { r2: number; windowKb: number; lastKept: number; minMaf: number } };
  components: Array<{ id: string; label: string; reference?: string[]; initialisedFrom: string; populations: string[] }>;
  admixture: { mode?: string; estimated?: string[]; iterations: number; logLikelihood: number; meanProportions: Record<string, number[]> };
  pca: { varianceExplained: number[]; shrinkage: number[]; folds: number };
  similarityValidation: Record<string, { samples: number; ownFirst: number; sameContinentFirst: number; mostCommonOther: string | null }>;
  /** Version 2 panels: what the reference cannot describe, and how the components were made, in the page's words. */
  notes?: { limitations?: string[]; components?: string; referenceName?: string; genomes?: number };
}
export interface ReferenceSamplesFile { populations: string[]; components: string[]; pop: number[]; q: number[][]; pcs: number[][] }
export interface SimSummaryFile {
  provenance: { method: string; model: { pairsPerRelationship: number; seed: number; minSegmentCm: number; genomeCm: number }; references: string[]; empiricalCheck: { title: string; author: string; url: string; license: string; retrieved: string } };
  relationships: Array<{ id: string; label: string; up: number; down: number; half: boolean; sharedCmId?: string; summary: { meanCm: number; sdCm: number; p01: number; p50: number; p99: number; meanSegments: number; noSharing: number }; sharedCmV4?: { average: number; min: number; max: number }; totalCm: number[]; segments: number[] }>;
}
export interface TraitFrequencyFile { provenance: Provenance; populations: string[]; markers: Record<string, { alleles: string[]; frequencies: Record<string, Record<string, number>>; chromosomes: Record<string, number> }> }
export interface MapFile { title: string; toleranceCm: number; lengthsCm: Record<string, number>; autosomalLengthCm: number; provenance: Provenance }

const cache = new Map<string, Promise<unknown>>();
export function load<T>(name: string): Promise<T> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(dataBase + name).then((r) => { if (!r.ok) throw new Error(`Could not load ${name}`); return r.json(); });
    cache.set(name, p);
  }
  return p as Promise<T>;
}

export const populations = () => load<PopulationsFile>("populations.json");
export const panelMeta = () => load<PanelMetaFile>("panel.1000g.json");
export const referenceSamples = () => load<ReferenceSamplesFile>("reference-samples.json");
export const simSummary = () => load<SimSummaryFile>("relationships.sim.json");
export const traitFrequencies = () => load<TraitFrequencyFile>("trait-frequencies.json");
export const mapInfo = () => load<MapFile>("genetic-map.grch37.json");

/** Superpopulation of each population code, and populations grouped in display order. */
export async function populationIndex(): Promise<{ byCode: Map<string, Population>; groups: Array<{ code: string; name: string; pops: Population[] }> }> {
  const f = await populations();
  const byCode = new Map(f.populations.map((p) => [p.code, p]));
  const groups = f.superpopulations.map((s) => ({ code: s.code, name: s.name, pops: f.populations.filter((p) => p.superpopulation === s.code) }));
  return { byCode, groups };
}
