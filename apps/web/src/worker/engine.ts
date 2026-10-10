/**
 * The analysis worker. Every computation on genetic data happens here, off
 * the page's main thread, and nothing here ever sends data anywhere: the
 * only network requests are for the app's own reference files, fetched from
 * the same origin.
 */
import {
  AUTOSOMES, DEFAULT_RELATIONSHIPS, GRCH37_LENGTH, Kit, ReportBuilder, ancestryTree, applyGroupSizes, attachTier, callTraits, compareKits, componentAdmixture,
  decodePanelTier, decodeReferencePanel, detectBuild, geneticMapFromCompact, inferSex, makeDemoFamily, overlapClusters, paintChromosomes, panelGenotypes,
  parseRawKit, parseSegmentTable, populationSimilarity, projectPca, relationshipPosteriors, runsOfHomozygosity, simulatePairSegments,
  summariseKit, summariseMatches, mulberry32, openRawText,
  type CompactGeneticMap, type InterpolatedGeneticMap, type PanelGenotypes, type ReferencePanelData, type RelationshipDistribution,
  type RelationshipSpec, type SimulatedPair, type DemoTraitSite, type Calibration,
} from "@lineage/core";
import { TRAITS } from "@lineage/kb";
import type {
  AncestryResult, CompareView, DemoView, DistributionSketch, KitOverview, MatchesView, Methods, Method, Posterior, Request, Response, SimulatedView,
} from "../lib/protocol.js";

const ctx = self as unknown as { postMessage(m: Response): void; onmessage: ((e: MessageEvent<Request>) => void) | null };

// A worker keeps its own Resource Timing, which the page's network ledger cannot read, so every
// request made from here (the reference files) is reported to the page as it completes.
try {
  new PerformanceObserver((list) => {
    const entries = (list.getEntries() as PerformanceResourceTiming[]).map((e) => ({ url: e.name, bytes: e.transferSize || e.encodedBodySize || 0, type: `${e.initiatorType} (worker)` }));
    if (entries.length) ctx.postMessage({ id: 0, kind: "resources", entries });
  }).observe({ type: "resource", buffered: true });
} catch { /* no Resource Timing in this worker: the page's own ledger still covers the page */ }

let dataBase = "";
const kits = new Map<string, { kit: Kit; name: string; overview?: KitOverview; genotypes?: PanelGenotypes; ancestry?: AncestryResult; demo?: boolean }>();
let mapPromise: Promise<InterpolatedGeneticMap> | undefined;
let panelPromise: Promise<{ panel: ReferencePanelData; meta: PanelMeta }> | undefined;
let simPromise: Promise<RelationshipDistribution[]> | undefined;

interface PanelMeta { admixture: { meanProportions: Record<string, number[]> }; /** The validation's calibration file, once one exists. */ calibration?: string }
interface PopulationsJson { populations: Array<{ code: string; samples: number }> }

async function json<T>(name: string): Promise<T> {
  const r = await fetch(dataBase + name);
  if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
  return (await r.json()) as T;
}
const geneticMap = () => (mapPromise ??= json<CompactGeneticMap>("genetic-map.grch37.json").then((j) => geneticMapFromCompact(j)));
/** Fetch a gzipped binary reference file (or one the server already un-gzipped on the way in). */
async function gunzipped(name: string): Promise<ArrayBuffer> {
  const r = await fetch(dataBase + name);
  if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
  const raw = new Uint8Array(await r.arrayBuffer());
  return raw[0] === 0x1f && raw[1] === 0x8b
    ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : raw.buffer;
}
const referencePanel = () => (panelPromise ??= (async () => {
  const [panel, meta] = [decodeReferencePanel(await gunzipped("panel.1000g.bin.gz")), await json<PanelMeta>("panel.1000g.json")];
  // A version-1 panel carries no sample sizes: take them from the population table and the fitted
  // proportions, so each frequency's sampling error enters the likelihood.
  if (panel.header.version === 1) {
    const pops = await json<PopulationsJson>("populations.json");
    applyGroupSizes(panel, Object.fromEntries(pops.populations.map((p) => [p.code, p.samples])), meta.admixture.meanProportions);
  }
  return { panel, meta };
})());
/** The validation's calibration; the engine runs uncalibrated (and says so) when it is missing. */
let calPromise: Promise<Calibration | undefined> | undefined;
const calibration = () => (calPromise ??= referencePanel().then(({ meta }) => (meta.calibration ? json<Calibration>(meta.calibration) : undefined)));
/** Tier files are loaded once each, only for continents a person carries. */
const tierLoads = new Map<string, Promise<void>>();
function loadTier(panel: ReferencePanelData, continent: string): Promise<void> {
  const t = panel.header.tiers?.find((x) => x.continent === continent);
  if (!t) return Promise.resolve();
  let p = tierLoads.get(continent);
  if (!p) { p = gunzipped(t.file).then((buf) => attachTier(panel, decodePanelTier(buf))); tierLoads.set(continent, p); }
  return p;
}
/** Share of a continent above which its regional tier is worth loading. */
const TIER_SHARE = 0.02;
interface SimJson { relationships: Array<RelationshipSpec & { totalCm: number[]; segments: number[]; longestCm: number[]; fullCm: number[]; summary: RelationshipDistribution["summary"]; sharedCmV4?: { average: number; min: number; max: number } }> }
let simRaw: SimJson | undefined;
const distributions = () => (simPromise ??= json<SimJson>("relationships.sim.json").then((j) => {
  simRaw = j;
  return j.relationships.map((r) => ({
    spec: { id: r.id, label: r.label, up: r.up, down: r.down, half: r.half, sharedCmId: r.sharedCmId },
    pairs: r.totalCm.map((t, i): SimulatedPair => ({ totalCm: t, segments: r.segments[i]!, longestCm: r.longestCm[i]!, fullCm: r.fullCm[i]! })),
    summary: r.summary,
  }));
}));

/* ------------------------------------------------------------------ */
/* Overviews                                                           */
/* ------------------------------------------------------------------ */
async function overviewOf(slot: string): Promise<KitOverview> {
  const entry = kits.get(slot);
  if (!entry) throw new Error(`No file loaded in ${slot}`);
  if (entry.overview) return entry.overview;
  const { kit } = entry;
  const map = await geneticMap();
  const summary = summariseKit(kit), sex = inferSex(kit);
  const roh = runsOfHomozygosity(kit).map((r) => ({ chrom: r.chrom, start: r.start, end: r.end, lengthBp: r.lengthBp, snps: r.snps, lengthCm: (map.cM(r.chrom, r.end) ?? 0) - (map.cM(r.chrom, r.start) ?? 0) }));
  const density: Record<string, number[]> = {};
  for (const c of [...AUTOSOMES, "X", "Y"] as const) {
    const bins = new Array<number>(Math.ceil(GRCH37_LENGTH[c] / 2e6)).fill(0);
    const [s, e] = kit.range(c);
    for (let i = s; i < e; i++) if (kit.genotype[i]) bins[Math.min(bins.length - 1, Math.floor(kit.pos[i]! / 2e6))]!++;
    density[c] = bins;
  }
  entry.overview = {
    slot, name: entry.name, format: summary.format, build: summary.build, chipVersion: kit.meta.chipVersion, variants: summary.variants,
    called: summary.called, callRate: summary.callRate, heterozygosity: summary.autosomalHeterozygosity,
    perChromosome: summary.perChromosome.map((c) => ({ chrom: c.chrom, variants: c.variants, called: c.called, heterozygous: c.heterozygous })),
    density, sex, roh, rohTotalCm: roh.reduce((a, r) => a + r.lengthCm, 0),
    parse: { rowsRead: summary.variants, rowsKept: summary.variants, skipped: 0, ms: 0, bytes: 0 },
    demo: entry.demo,
  };
  return entry.overview;
}

/* ------------------------------------------------------------------ */
/* Relationship helpers                                                */
/* ------------------------------------------------------------------ */
function toPosteriors(post: ReturnType<typeof relationshipPosteriors>): Posterior[] {
  return post.map((p) => ({ id: p.spec.id, label: p.spec.label, probability: p.probability, likelihood: p.likelihood, sharedCmId: p.spec.sharedCmId, up: p.spec.up, down: p.spec.down, half: p.spec.half }));
}

function sketches(ids: string[]): DistributionSketch[] {
  if (!simRaw) return [];
  const edges = Array.from({ length: 76 }, (_, i) => i * 50); // 0-3,750 cM in 50 cM bins
  return ids.map((id) => {
    const r = simRaw!.relationships.find((x) => x.id === id)!;
    const share = new Array<number>(edges.length - 1).fill(0);
    let none = 0;
    for (let i = 0; i < r.totalCm.length; i++) {
      if (r.segments[i] === 0) { none++; continue; }
      share[Math.min(share.length - 1, Math.floor(r.totalCm[i]! / 50))]! += 1 / r.totalCm.length;
    }
    return { id, label: r.label, edges, share, noSharing: none / r.totalCm.length, mean: r.summary.meanCm, p01: r.summary.p01, p99: r.summary.p99, v4: r.sharedCmV4 };
  });
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */
type Handler<M extends Method> = (params: Methods[M]["params"], progress: (stage: string, fraction?: number) => void) => Promise<Methods[M]["result"]>;
const handlers: { [M in Method]: Handler<M> } = {
  async init({ dataBase: base }) {
    dataBase = base;
    void geneticMap(); void distributions();
    return { relationships: [...DEFAULT_RELATIONSHIPS] };
  },

  async loadFile({ slot, file, name }, progress) {
    progress("Reading the file", 0.1);
    const t0 = performance.now();
    const { text, compressed } = await openRawText(new Uint8Array(await file.arrayBuffer()));
    progress("Parsing genotypes", 0.35);
    const { kit, report } = parseRawKit(text);
    if (report.rowsKept < 1000) throw new Error(`Only ${report.rowsKept} usable rows were found. Is this a raw DNA data file?`);
    kits.set(slot, { kit, name });
    progress("Summarising", 0.75);
    const overview = await overviewOf(slot);
    overview.parse = { rowsRead: report.rowsRead, rowsKept: report.rowsKept, skipped: report.rowsRead - report.rowsKept, ms: performance.now() - t0, bytes: file.size, compressed };
    return overview;
  },

  async loadDemo(_p, progress) {
    progress("Loading the reference panel", 0.15);
    const [{ panel, meta }, map] = await Promise.all([referencePanel(), geneticMap()]);
    progress("Generating the family's genomes", 0.55);
    const traits: DemoTraitSite[] = TRAITS.map((t) => ({
      rsid: t.rsid, chrom: t.chrom, pos: t.pos37 ?? 0, effect: t.effectAllele, other: t.alleles.find((a) => a !== t.effectAllele) ?? t.alleles[0]!,
      freq: Object.fromEntries(t.frequencies.filter((f) => f.allele === t.effectAllele).map((f) => [f.population.split(":").pop()!, f.frequency])),
    }));
    const fam = makeDemoFamily({ panel, map, meanProportions: meta.admixture.meanProportions, traits });
    for (const [id, kit] of fam.kits) {
      const p = fam.people.find((x) => x.id === id)!;
      const slot = id === "I17" ? "you" : `demo:${id}`;
      kits.set(slot, { kit, name: `${p.given} ${p.surname}`, demo: true });
    }
    progress("Summarising", 0.85);
    const overview = await overviewOf("you");
    return {
      people: fam.people.map((p) => ({ id: p.id, name: `${p.given} ${p.surname}`, sex: p.sex, role: p.role, birthYear: p.birthYear, birthPlace: p.birthPlace, population: p.population, kit: p.kit })),
      gedcom: fam.gedcom, segmentsCsv: fam.segmentsCsv, truth: fam.truth,
      kits: fam.people.filter((p) => p.kit && p.id !== "I17").map((p) => ({ slot: `demo:${p.id}`, name: `${p.given} ${p.surname}`, role: p.role ?? "" })),
      overview,
    } satisfies DemoView;
  },

  async overview({ slot }) { return overviewOf(slot); },

  async ancestry({ slot }, progress) {
    const entry = kits.get(slot);
    if (!entry) throw new Error("Load a raw data file first.");
    if (entry.ancestry) return entry.ancestry;
    progress("Loading the reference panel", 0.1);
    const [{ panel }, map, cal] = await Promise.all([referencePanel(), geneticMap(), calibration()]);
    const t0 = performance.now();
    progress("Matching your SNPs to the panel", 0.25);
    const build = detectBuild(entry.kit, panel);
    const g = entry.genotypes ?? panelGenotypes(entry.kit, panel, { build: build.build === 38 ? 38 : 37 });
    entry.genotypes = g;
    progress("Estimating continental components", 0.4);
    const admixture = componentAdmixture(panel, g, { calibration: cal });
    progress("Painting chromosomes", 0.55);
    const painting = paintChromosomes(panel, g, admixture.proportions, map, { calibration: cal });
    progress("Projecting onto the reference PCA", 0.65);
    const pca = projectPca(panel, g, { map, replicates: 200 });
    // Regional detail: load the tiers of the continents this genome carries, then refit.
    const carried = admixture.components.filter((_, k) => admixture.proportions[k]! >= TIER_SHARE && panel.header.tiers?.some((t) => t.continent === admixture.components[k]));
    let regional: AncestryResult["regional"];
    if (carried.length) {
      progress("Loading regional reference data", 0.75);
      await Promise.all(carried.map((c) => loadTier(panel, c)));
      progress("Estimating regional components", 0.82);
      regional = componentAdmixture(panel, g, { calibration: cal, level: "region" });
    }
    progress("Comparing with the reference populations", 0.92);
    const similarity = populationSimilarity(panel, g, { calibration: cal });
    const labels = Object.fromEntries(panel.header.components.map((c) => [c.id, c.label]));
    const frequencyOnly = Object.fromEntries(panel.tiers.flatMap((t) => t.header.components.filter((c) => c.frequencyOnly).map((c) => [c.id, true])));
    entry.ancestry = {
      components: panel.header.components, populations: similarity.scores.map((s) => s.population),
      coverage: { called: g.called, total: panel.header.nSnp, strandFlipped: g.strandFlipped, alleleMismatch: g.alleleMismatch, notOnChip: g.notOnChip, noCall: g.noCall, conflicting: g.conflicting, perChromosome: g.perChromosome },
      build, similarity, admixture, regional, tree: ancestryTree(regional ?? admixture, { labels, frequencyOnly }), pca, painting,
      calibration: { loaded: !!cal, generated: cal?.generated, windowZ: cal?.painting?.windowZ, conformalCoverage: cal?.similarity?.coverage, intervalCoverage: cal?.components?.coverage }, tiers: panel.tiers.map((t) => t.header.continent),
      ms: performance.now() - t0,
    };
    return entry.ancestry;
  },

  async traits({ slot }) {
    const entry = kits.get(slot);
    if (!entry) throw new Error("Load a raw data file first.");
    return callTraits(entry.kit, TRAITS);
  },

  async compare({ a, b }, progress) {
    const ka = kits.get(a), kb = kits.get(b);
    if (!ka || !kb) throw new Error("Load both files first.");
    progress("Loading the genetic map", 0.1);
    const [map, dists] = await Promise.all([geneticMap(), distributions()]);
    progress("Walking both genomes", 0.4);
    const r = compareKits(ka.kit, kb.kit, { map, includeX: false });
    const half = r.halfIdentical.map((s) => ({ chrom: s.chrom, start: s.start, end: s.end, cm: s.lengthCm ?? 0, snps: s.snps }));
    const full = r.fullyIdentical.map((s) => ({ chrom: s.chrom, start: s.start, end: s.end, cm: s.lengthCm ?? 0, snps: s.snps }));
    const totalCm = half.reduce((x, s) => x + s.cm, 0), fullCm = full.reduce((x, s) => x + s.cm, 0);
    progress("Weighing relationships", 0.8);
    const posteriors = toPosteriors(relationshipPosteriors(dists, { totalCm, segments: half.length, fullCm }));
    return {
      a, b, comparableSnps: r.comparableSnps, sharedSnps: r.sharedSnps, oppositeHomozygousRate: r.oppositeHomozygousRate, half, full,
      totalCm, fullCm, segments: half.length, longestCm: half.reduce((x, s) => Math.max(x, s.cm), 0), posteriors,
      sketches: sketches(posteriors.slice(0, 4).map((p) => p.id)),
    } satisfies CompareView;
  },

  async predict({ totalCm, segments, fullCm }) {
    const dists = await distributions();
    const posteriors = toPosteriors(relationshipPosteriors(dists, { totalCm, segments, fullCm }));
    return { posteriors, sketches: sketches(posteriors.slice(0, 4).map((p) => p.id)) };
  },

  async matches({ csv, truth }) {
    const dists = await distributions();
    const { segments, skipped } = parseSegmentTable(csv);
    const rows = summariseMatches(segments).map((m) => {
      const counted = segments.filter((s) => s.match === m.match && s.chrom !== "X" && s.cm >= 7);
      const total = counted.reduce((a, s) => a + s.cm, 0);
      return {
        match: m.match, totalCm: m.totalCm, autosomalCm: m.autosomalCm, xCm: m.xCm, segments: m.segments, segmentsOver7: m.segmentsOver7, longestCm: m.longestCm,
        posteriors: toPosteriors(relationshipPosteriors(dists, { totalCm: total, segments: counted.length })).slice(0, 6),
        truth: truth?.[m.match],
      };
    });
    return {
      rows,
      segments: segments.map((s) => ({ match: s.match, chrom: s.chrom, start: s.start, end: s.end, cm: s.cm })),
      clusters: overlapClusters(segments).map((c) => ({ chrom: c.chrom, start: c.start, end: c.end, matches: c.matches })),
      skipped,
    } satisfies MatchesView;
  },

  async simulate({ relationship, seed }) {
    const map = await geneticMap();
    const spec = DEFAULT_RELATIONSHIPS.find((r) => r.id === relationship);
    if (!spec) throw new Error(`Unknown relationship ${relationship}`);
    const lengths = AUTOSOMES.map((c) => map.length(c) ?? 0);
    const { pair, segments } = simulatePairSegments(spec, mulberry32(seed), lengths);
    return {
      relationship: spec, totalCm: pair.totalCm, segments: pair.segments, longestCm: pair.longestCm, fullCm: pair.fullCm, chromosomeCm: lengths,
      pieces: segments.map((s) => ({ chrom: AUTOSOMES[s.chromIndex]!, startCm: s.startCm, endCm: s.endCm, lengthCm: s.endCm - s.startCm, kind: s.kind })),
    } satisfies SimulatedView;
  },

  async report({ slot }) {
    const entry = kits.get(slot);
    if (!entry) throw new Error("Load a raw data file first.");
    const o = await overviewOf(slot);
    const b = new ReportBuilder({ label: entry.name, kitFormat: o.format });
    b.kit(summariseKit(entry.kit)).sex(o.sex).roh(runsOfHomozygosity(entry.kit)).traits(callTraits(entry.kit, TRAITS));
    if (entry.ancestry) {
      const a = entry.ancestry;
      const top = [...a.similarity.scores].sort((x, y) => x.rank - y.rank).slice(0, 3);
      b.fact("similarity", `Of the 26 reference populations of 1000 Genomes phase 3, the genotypes are most similar to ${top.map((t) => t.population).join(", then ")} (log-likelihood over ${a.similarity.snps.toLocaleString()} LD-pruned SNPs).`, { value: top, evidence: "Hardy-Weinberg likelihood under each population's allele frequencies", source: "1000 Genomes Project phase 3 (2015)", confidence: a.similarity.snps > 5000 ? "probable" : "suggestive" });
      b.fact("admixture", `Continental components: ${a.admixture.components.map((c, i) => `${c} ${(a.admixture.proportions[i]! * 100).toFixed(1)}% (95% interval ${(a.admixture.ci95[i]![0] * 100).toFixed(1)}-${(a.admixture.ci95[i]![1] * 100).toFixed(1)}%)`).join(", ")}.`, { value: a.admixture, evidence: `EM with fixed component frequencies over ${a.admixture.snpsUsed.toLocaleString()} SNPs, the reference frequencies' sampling error integrated; 95% profile-likelihood intervals${a.calibration.loaded ? " with the validated inflation factor" : " (uncalibrated)"}`, source: "Components defined on 1000 Genomes phase 3 by ADMIXTURE's supervised mode (Alexander et al. 2009): 20 reference populations fixed, the Indigenous American component learned from six admixed populations", confidence: a.admixture.snpsUsed > 5000 ? "probable" : "suggestive" });
      b.limitation("Ancestry results describe genetic similarity to reference samples, not ethnicity, nationality or identity. Populations absent from the reference panel are described in terms of the ones present.");
    }
    return b.build();
  },

  async drop({ slot }) { return kits.delete(slot); },
};

ctx.onmessage = async (e: MessageEvent<Request>) => {
  const { id, method, params } = e.data;
  const progress = (stage: string, fraction?: number) => ctx.postMessage({ id, kind: "progress", stage, fraction });
  try {
    const result = await (handlers[method] as Handler<Method>)(params as never, progress);
    ctx.postMessage({ id, kind: "result", result });
  } catch (err) {
    ctx.postMessage({ id, kind: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
