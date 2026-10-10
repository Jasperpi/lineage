/**
 * The bundled reference panel, computed by scripts/data/05-panel.py.
 *
 * Binary layout ("LNGP"), little-endian:
 *   0  "LNGP"
 *   4  u32 byte length of a UTF-8 JSON header
 *   8  the header, then zero padding to a multiple of 4
 *   .. blocks in the order the header lists them, each padded to 4 bytes
 *
 * A core file (`kind` absent or "core") has two layers in one SNP order
 * (chromosome, then position):
 *   dense  every SNP that passed QC: positions, alleles, continental component
 *          frequencies, optionally a chip mask and GRCh38 positions
 *   core   an LD-pruned subset, by index into dense: population frequencies,
 *          the pooled frequency and PCA loadings
 * A tier file (`kind: "tier"`, version 2) adds one continent's populations and
 * regional components at the core SNPs of the core file it was built with. The
 * worker loads a tier only when the person carries that continent.
 *
 * Frequencies are of the ALT allele, stored as round(f x scale) in a byte. In
 * version 1 every group uses `freqScale` and no sample sizes are stored; in
 * version 2 each population and component carries its allele count
 * (`popAlleles`, `components[].alleles`) and its own scale, and for groups of
 * up to 127 genomes the byte is the allele count itself (scale = alleles).
 */
import { type Chrom, AUTOSOMES } from "../genome.js";
import type { Kit } from "../kit/kit.js";
import { complement } from "../util/alleles.js";

export interface PanelComponent {
  id: string;
  label: string;
  populations: string[];
  /** Version 2: the continent a regional component belongs to. */
  parent?: string;
  level?: "continent" | "region";
  /** Effective number of reference chromosomes behind the component's frequencies. */
  alleles?: number;
  /** Stored value = round(f x scale); defaults to the header's freqScale. */
  scale?: number;
  /** True when the reference exists only as allele frequencies (no genomes), e.g. gnomAD's Ashkenazi group. */
  frequencyOnly?: boolean;
}

export interface PanelHeader {
  version: 1 | 2;
  kind?: "core";
  build: 37;
  chromosomes: Chrom[];
  chromCounts: number[];
  nSnp: number;
  freqScale: number;
  populations: string[];
  /** Version 2: reference chromosomes (2 x genomes) per population, and each population's scale. */
  popAlleles?: number[];
  popScale?: number[];
  components: PanelComponent[];
  core: { nSnp: number };
  pca: {
    nPc: number; loadingScale: number[]; shrinkage: number[]; eigenvalues: number[];
    /** Version 2: sample eigenvalues in units of the mean per-SNP variance, and SNPs / genomes, for the closed-form shrinkage. */
    spikes?: number[]; gamma?: number;
  };
  /** Version 2: names of the chips whose bits the chipMask block carries. */
  chips?: string[];
  /** Version 2: the tier files that go with this core file. */
  tiers?: Array<{ continent: string; file: string; bytes?: number; sha256?: string }>;
  blocks: Array<{ name: string; type: "u8" | "u16" | "u32" | "i16" | "f32"; length: number }>;
  provenance?: unknown;
}

export interface TierHeader {
  version: 2;
  kind: "tier";
  continent: string;
  coreSnp: number;
  populations: string[];
  popAlleles: number[];
  popScale: number[];
  components: PanelComponent[];
  blocks: PanelHeader["blocks"];
  provenance?: unknown;
}

export interface PanelTier {
  header: TierHeader;
  /** core x populations. */
  popFreq: Uint8Array;
  /** core x regional components. */
  compFreq: Uint8Array;
}

export interface ReferencePanelData {
  header: PanelHeader;
  /** Dense layer. */
  chromIdx: Uint8Array;
  pos: Uint32Array;
  ref: Uint8Array;   // 0-3 = A, C, G, T
  alt: Uint8Array;
  compFreq: Uint8Array; // nSnp x K
  /** Version 2: bit c set when the SNP is on chip `header.chips[c]`. */
  chipMask?: Uint8Array;
  /** Version 2: GRCh38 positions (0 where the SNP has none). */
  pos38?: Uint32Array;
  /** Core layer. */
  coreIndex: Uint32Array;
  popFreq: Uint8Array;  // core x P
  pooledFreq: Uint16Array; // core, p x 65535
  loadings: Int16Array; // core x nPc
  /** Regional tiers attached with attachTier(). */
  tiers: PanelTier[];
}

export const BASE_CODES = ["A", "C", "G", "T"] as const;

const ARRAY = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i16: Int16Array, f32: Float32Array } as const;
const BYTES = { u8: 1, u16: 2, u32: 4, i16: 2, f32: 4 } as const;
const pad4 = (n: number) => (n + 3) & ~3;

function readBlocks(buf: ArrayBuffer): { header: unknown; blocks: Record<string, ArrayLike<number>> } {
  const bytes = new Uint8Array(buf);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== "LNGP") throw new Error("Not a Lineage reference panel (bad magic)");
  const hLen = new DataView(buf).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hLen))) as { version: number; blocks: PanelHeader["blocks"] };
  if (header.version !== 1 && header.version !== 2) throw new Error(`Unsupported panel version ${header.version}`);
  let off = pad4(8 + hLen);
  const blocks: Record<string, ArrayLike<number>> = {};
  for (const b of header.blocks) {
    const size = b.length * BYTES[b.type];
    if (off + size > buf.byteLength) throw new Error(`Panel block ${b.name} runs past the end of the file`);
    // Copy into an aligned buffer: typed-array views need aligned offsets.
    blocks[b.name] = new ARRAY[b.type](buf.slice(off, off + size));
    off = pad4(off + size);
  }
  return { header, blocks };
}

/** Decode an uncompressed LNGP core file. */
export function decodeReferencePanel(buf: ArrayBuffer): ReferencePanelData {
  const { header: h, blocks } = readBlocks(buf);
  const header = h as PanelHeader;
  if ((header as { kind?: string }).kind === "tier") throw new Error("This is a tier file; decode it with decodePanelTier");
  const posDelta = blocks.posDelta as Uint32Array;
  const pos = new Uint32Array(header.nSnp);
  const chromIdx = new Uint8Array(header.nSnp);
  let i = 0;
  header.chromCounts.forEach((count, c) => {
    let p = 0;
    for (let k = 0; k < count; k++, i++) { p += posDelta[i]!; pos[i] = p; chromIdx[i] = c; }
  });
  const alleles = blocks.alleles as Uint8Array;
  const ref = new Uint8Array(header.nSnp), alt = new Uint8Array(header.nSnp);
  for (let k = 0; k < header.nSnp; k++) { ref[k] = alleles[k]! >> 4; alt[k] = alleles[k]! & 15; }
  const coreDelta = blocks.coreIndexDelta as Uint32Array;
  const coreIndex = new Uint32Array(header.core.nSnp);
  let acc = 0;
  for (let k = 0; k < header.core.nSnp; k++) { acc += coreDelta[k]!; coreIndex[k] = acc; }
  let pos38: Uint32Array | undefined;
  if (blocks.pos38) {
    // Stored as GRCh38 position per dense SNP (0 = none); not delta-coded because the order differs.
    pos38 = blocks.pos38 as Uint32Array;
  }
  return {
    header, chromIdx, pos, ref, alt,
    compFreq: blocks.compFreq as Uint8Array,
    chipMask: blocks.chipMask as Uint8Array | undefined,
    pos38,
    coreIndex,
    popFreq: (blocks.popFreq as Uint8Array | undefined) ?? new Uint8Array(0),
    pooledFreq: blocks.pooledFreq as Uint16Array,
    loadings: blocks.loadings as Int16Array,
    tiers: [],
  };
}

/** Decode an uncompressed LNGP tier file. */
export function decodePanelTier(buf: ArrayBuffer): PanelTier {
  const { header: h, blocks } = readBlocks(buf);
  const header = h as TierHeader;
  if (header.kind !== "tier") throw new Error("Not a tier file");
  return { header, popFreq: (blocks.popFreq as Uint8Array) ?? new Uint8Array(0), compFreq: (blocks.compFreq as Uint8Array) ?? new Uint8Array(0) };
}

/** Attach a tier to its core panel (checks that it was built on the same core SNPs). */
export function attachTier(panel: ReferencePanelData, tier: PanelTier): void {
  if (tier.header.coreSnp !== panel.header.core.nSnp) throw new Error(`Tier ${tier.header.continent} was built for ${tier.header.coreSnp} core SNPs, the panel has ${panel.header.core.nSnp}`);
  panel.tiers = panel.tiers.filter((t) => t.header.continent !== tier.header.continent).concat(tier);
}

type Part = [string, PanelHeader["blocks"][number]["type"], ArrayLike<number> & { buffer: ArrayBufferLike; byteLength: number; byteOffset: number }];

function writeFile(header: { blocks: PanelHeader["blocks"]; [key: string]: unknown }, parts: Part[]): ArrayBuffer {
  header.blocks = parts.map(([name, type, arr]) => ({ name, type, length: arr.length }));
  const hBytes = new TextEncoder().encode(JSON.stringify(header));
  let size = pad4(8 + hBytes.length);
  for (const [, , arr] of parts) size += pad4(arr.byteLength);
  const out = new Uint8Array(size);
  out.set(new TextEncoder().encode("LNGP"), 0);
  new DataView(out.buffer).setUint32(4, hBytes.length, true);
  out.set(hBytes, 8);
  let off = pad4(8 + hBytes.length);
  for (const [, , arr] of parts) {
    out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), off);
    off = pad4(off + arr.byteLength);
  }
  return out.buffer;
}

/** Encode a core panel (used by tests and the harness; the pipeline writes the same layout from Python). */
export function encodeReferencePanel(p: Omit<ReferencePanelData, "header" | "tiers"> & { tiers?: PanelTier[]; header: Omit<PanelHeader, "blocks" | "chromCounts" | "nSnp"> & Partial<PanelHeader> }): ArrayBuffer {
  const n = p.pos.length;
  const chromCounts = p.header.chromosomes.map((_, c) => p.chromIdx.filter((x) => x === c).length);
  const posDelta = new Uint32Array(n);
  for (let i = 0; i < n; i++) posDelta[i] = i === 0 || p.chromIdx[i] !== p.chromIdx[i - 1] ? p.pos[i]! : p.pos[i]! - p.pos[i - 1]!;
  const alleles = new Uint8Array(n);
  for (let i = 0; i < n; i++) alleles[i] = (p.ref[i]! << 4) | p.alt[i]!;
  const coreDelta = new Uint32Array(p.coreIndex.length);
  for (let k = 0; k < p.coreIndex.length; k++) coreDelta[k] = p.coreIndex[k]! - (k ? p.coreIndex[k - 1]! : 0);
  const parts: Part[] = [["posDelta", "u32", posDelta], ["alleles", "u8", alleles], ["compFreq", "u8", p.compFreq]];
  if (p.chipMask) parts.push(["chipMask", "u8", p.chipMask]);
  if (p.pos38) parts.push(["pos38", "u32", p.pos38]);
  parts.push(["coreIndexDelta", "u32", coreDelta], ["popFreq", "u8", p.popFreq], ["pooledFreq", "u16", p.pooledFreq], ["loadings", "i16", p.loadings]);
  const version = p.header.version ?? 1;
  const header = { ...(p.header as PanelHeader), version, build: 37 as const, chromCounts, nSnp: n, core: { nSnp: p.coreIndex.length }, blocks: [] };
  return writeFile(header, parts);
}

/** Encode a tier file (tests and the harness). */
export function encodePanelTier(t: { header: Omit<TierHeader, "blocks" | "version" | "kind">; popFreq: Uint8Array; compFreq: Uint8Array }): ArrayBuffer {
  return writeFile({ ...t.header, version: 2, kind: "tier", blocks: [] }, [["popFreq", "u8", t.popFreq], ["compFreq", "u8", t.compFreq]]);
}

/* ------------------------------------------------------------------ */
/* Reference sizes                                                     */
/* ------------------------------------------------------------------ */

/**
 * A version-1 panel stores no sample sizes. Fill them in from the population
 * table (samples per population) and, for components, the mean proportions
 * the pipeline fitted in each population, so each component's frequencies
 * carry the number of genome-equivalents actually behind them (NAT's are about
 * 138, not the 347 genomes of the populations it was learned from).
 */
export function applyGroupSizes(panel: ReferencePanelData, samples: Record<string, number>, meanProportions?: Record<string, number[]>): void {
  const h = panel.header;
  if (!h.popAlleles) h.popAlleles = h.populations.map((p) => (samples[p] ? 2 * samples[p]! : 0));
  h.components.forEach((c, k) => {
    if (c.alleles !== undefined) return;
    let genomes = 0;
    if (meanProportions) for (const [pop, q] of Object.entries(meanProportions)) genomes += (samples[pop] ?? 0) * (q[k] ?? 0);
    else for (const pop of c.populations) genomes += samples[pop] ?? 0;
    c.alleles = genomes > 0 ? 2 * genomes : undefined;
  });
}

export const popAlleles = (panel: ReferencePanelData, p: number) => panel.header.popAlleles?.[p] ?? 0;
export const popScale = (panel: ReferencePanelData, p: number) => panel.header.popScale?.[p] ?? panel.header.freqScale;
export const compAlleles = (panel: ReferencePanelData, k: number) => panel.header.components[k]!.alleles ?? 0;
export const compScale = (panel: ReferencePanelData, k: number) => panel.header.components[k]!.scale ?? panel.header.freqScale;

/* ------------------------------------------------------------------ */
/* Matching a kit to the panel                                         */
/* ------------------------------------------------------------------ */

export interface PanelGenotypes {
  /** ALT allele copies per dense SNP: 0, 1, 2, or -1 when missing or unusable. */
  dosage: Int8Array;
  called: number;
  strandFlipped: number;
  alleleMismatch: number;
  notOnChip: number;
  noCall: number;
  /** Positions the kit lists more than once with different calls (left out). */
  conflicting: number;
  /** Called SNPs per autosome, for coverage displays. */
  perChromosome: number[];
  /** The kit's build as matched against the panel. */
  build: 37 | 38;
}

export interface BuildCheck {
  /** 37 or 38 when one clearly matches, "unknown" when neither does. */
  build: 37 | 38 | "unknown";
  tested: number;
  hits37: number;
  /** Undefined when the panel carries no GRCh38 positions. */
  hits38?: number;
}

/**
 * Which build the kit's positions are on, judged by how many panel SNPs each
 * build's positions find in the kit. A GRCh37 consumer file finds most of them
 * on GRCh37 and almost none on GRCh38, and the other way round.
 */
export function detectBuild(kit: Kit, panel: ReferencePanelData, every = 25): BuildCheck {
  let tested = 0, hits37 = 0, hits38 = 0;
  for (let i = 0; i < panel.header.nSnp; i += every) {
    const chrom = panel.header.chromosomes[panel.chromIdx[i]!]!;
    tested++;
    if (kit.indexAt(chrom, panel.pos[i]!) !== undefined) hits37++;
    const p38 = panel.pos38?.[i];
    if (p38 && kit.indexAt(chrom, p38) !== undefined) hits38++;
  }
  const min = Math.max(20, 0.05 * tested);
  let build: BuildCheck["build"] = "unknown";
  if (hits37 >= min && hits37 >= hits38) build = 37;
  else if (panel.pos38 && hits38 >= min) build = 38;
  return { build, tested, hits37, hits38: panel.pos38 ? hits38 : undefined };
}

/**
 * Look each panel SNP up in the kit by chromosome and position (rsIDs drift
 * between chip versions; positions do not) and count ALT alleles.
 *  - Vendor files are on the forward strand, so their calls must match the
 *    panel's alleles exactly; only a file of unknown strand is allowed the
 *    complement (the panel holds no A/T or C/G SNPs, so a complement is never
 *    ambiguous). Complementing a forward-strand call at a site with a third
 *    allele would count the wrong allele.
 *  - A position listed twice keeps its call when the rows agree (or one is a
 *    no-call) and is left out when they disagree.
 *  - Anything else is marked unusable rather than guessed.
 */
export function panelGenotypes(kit: Kit, panel: ReferencePanelData, opts: { build?: 37 | 38; allowComplement?: boolean } = {}): PanelGenotypes {
  const n = panel.header.nSnp;
  const build = opts.build === 38 && panel.pos38 ? 38 : 37;
  const dosage = new Int8Array(n).fill(-1);
  let called = 0, strandFlipped = 0, alleleMismatch = 0, notOnChip = 0, noCall = 0, conflicting = 0, complementFits = 0;
  const perChromosome = new Array<number>(panel.header.chromosomes.length).fill(0);
  const allowComplement = opts.allowComplement ?? kit.meta.strand !== "plus";
  for (let i = 0; i < n; i++) {
    const chrom = panel.header.chromosomes[panel.chromIdx[i]!]!;
    const at = build === 38 ? panel.pos38![i]! : panel.pos[i]!;
    if (!at) { notOnChip++; continue; }
    const k = kit.indexAt(chrom, at);
    if (k === undefined) { notOnChip++; continue; }
    // Collect every row at this position (rows are sorted, so duplicates are adjacent).
    const [lo, hi] = kit.range(chrom);
    let a = k, b = k;
    while (a > lo && kit.pos[a - 1] === at) a--;
    while (b + 1 < hi && kit.pos[b + 1] === at) b++;
    let g = "";
    let conflict = false;
    for (let j = a; j <= b; j++) {
      const x = kit.genotype[j]!;
      if (x.length !== 2) continue;
      if (!g) g = x; else if (x !== g) conflict = true;
    }
    if (conflict) { conflicting++; continue; }
    if (!g) { noCall++; continue; }
    const r = BASE_CODES[panel.ref[i]!]!, al = BASE_CODES[panel.alt[i]!]!;
    let x = g;
    const fits = (s: string) => (s[0] === r || s[0] === al) && (s[1] === r || s[1] === al);
    if (!fits(x)) {
      const flipped = complement(x);
      if (allowComplement && fits(flipped)) { x = flipped; strandFlipped++; } else { alleleMismatch++; if (fits(flipped)) complementFits++; continue; }
    }
    dosage[i] = (x[0] === al ? 1 : 0) + (x[1] === al ? 1 : 0);
    called++;
    perChromosome[panel.chromIdx[i]!]!++;
  }
  // A file labelled forward-strand whose calls mostly fit only after complementing is not
  // forward-strand (a mislabelled or converted file): read it again allowing the complement.
  if (!allowComplement && opts.allowComplement === undefined && complementFits > 0.2 * (called + alleleMismatch)) {
    return panelGenotypes(kit, panel, { ...opts, allowComplement: true });
  }
  return { dosage, called, strandFlipped, alleleMismatch, notOnChip, noCall, conflicting, perChromosome, build };
}

export function panelChrom(panel: ReferencePanelData, i: number): Chrom {
  return panel.header.chromosomes[panel.chromIdx[i]!]!;
}

export function isPanelAutosome(panel: ReferencePanelData, i: number): boolean {
  return AUTOSOMES.includes(panelChrom(panel, i));
}
