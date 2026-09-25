/**
 * The bundled reference panel: SNPs on both consumer chip families, with
 * allele frequencies in the 26 populations of 1000 Genomes phase 3, allele
 * frequencies of continental ancestry components learned from those 2,504
 * genomes, and PCA loadings, all computed by scripts/data/05-panel.py.
 *
 * Binary layout ("LNGP", version 1), little-endian:
 *   0  "LNGP"
 *   4  u32 byte length of a UTF-8 JSON header
 *   8  the header, then zero padding to a multiple of 4
 *   .. blocks in the order the header lists them, each padded to 4 bytes
 * Two layers share one SNP order (chromosome, then position):
 *   dense  every SNP that passed QC: positions, alleles, component frequencies
 *   core   an LD-pruned subset, by index into dense: 26 population
 *          frequencies, the pooled frequency and PCA loadings
 * Frequencies are of the ALT allele; population and component frequencies are
 * stored as round(f x freqScale) in a byte.
 */
import { type Chrom, AUTOSOMES } from "../genome.js";
import type { Kit } from "../kit/kit.js";
import { complement } from "../util/alleles.js";

export interface PanelComponent { id: string; label: string; populations: string[] }

export interface PanelHeader {
  version: 1;
  build: 37;
  chromosomes: Chrom[];
  chromCounts: number[];
  nSnp: number;
  freqScale: number;
  populations: string[];
  components: PanelComponent[];
  core: { nSnp: number };
  pca: { nPc: number; loadingScale: number[]; shrinkage: number[]; eigenvalues: number[] };
  blocks: Array<{ name: string; type: "u8" | "u16" | "u32" | "i16" | "f32"; length: number }>;
  provenance?: unknown;
}

export interface ReferencePanelData {
  header: PanelHeader;
  /** Dense layer. */
  chromIdx: Uint8Array;
  pos: Uint32Array;
  ref: Uint8Array;   // 0-3 = A, C, G, T
  alt: Uint8Array;
  compFreq: Uint8Array; // nSnp x K
  /** Core layer. */
  coreIndex: Uint32Array;
  popFreq: Uint8Array;  // core x P
  pooledFreq: Uint16Array; // core, p x 65535
  loadings: Int16Array; // core x nPc
}

export const BASE_CODES = ["A", "C", "G", "T"] as const;

const ARRAY = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i16: Int16Array, f32: Float32Array } as const;
const BYTES = { u8: 1, u16: 2, u32: 4, i16: 2, f32: 4 } as const;
const pad4 = (n: number) => (n + 3) & ~3;

/** Decode an uncompressed LNGP buffer. */
export function decodeReferencePanel(buf: ArrayBuffer): ReferencePanelData {
  const bytes = new Uint8Array(buf);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== "LNGP") throw new Error("Not a Lineage reference panel (bad magic)");
  const view = new DataView(buf);
  const hLen = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hLen))) as PanelHeader;
  if (header.version !== 1) throw new Error(`Unsupported panel version ${header.version}`);
  let off = pad4(8 + hLen);
  const blocks: Record<string, ArrayLike<number>> = {};
  for (const b of header.blocks) {
    const size = b.length * BYTES[b.type];
    // Copy into an aligned buffer: typed-array views need aligned offsets.
    const copy = buf.slice(off, off + size);
    blocks[b.name] = new ARRAY[b.type](copy);
    off = pad4(off + size);
  }
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
  return {
    header, chromIdx, pos, ref, alt,
    compFreq: blocks.compFreq as Uint8Array,
    coreIndex,
    popFreq: blocks.popFreq as Uint8Array,
    pooledFreq: blocks.pooledFreq as Uint16Array,
    loadings: blocks.loadings as Int16Array,
  };
}

/** Encode a panel (used by tests; the pipeline writes the same layout from Python). */
export function encodeReferencePanel(p: Omit<ReferencePanelData, "header"> & { header: Omit<PanelHeader, "blocks" | "chromCounts" | "nSnp"> & Partial<PanelHeader> }): ArrayBuffer {
  const n = p.pos.length;
  const chromCounts = p.header.chromosomes.map((_, c) => p.chromIdx.filter((x) => x === c).length);
  const posDelta = new Uint32Array(n);
  for (let i = 0; i < n; i++) posDelta[i] = i === 0 || p.chromIdx[i] !== p.chromIdx[i - 1] ? p.pos[i]! : p.pos[i]! - p.pos[i - 1]!;
  const alleles = new Uint8Array(n);
  for (let i = 0; i < n; i++) alleles[i] = (p.ref[i]! << 4) | p.alt[i]!;
  const coreDelta = new Uint32Array(p.coreIndex.length);
  for (let k = 0; k < p.coreIndex.length; k++) coreDelta[k] = p.coreIndex[k]! - (k ? p.coreIndex[k - 1]! : 0);
  const parts: Array<[string, PanelHeader["blocks"][number]["type"], ArrayLike<number> & { buffer: ArrayBufferLike; byteLength: number; byteOffset: number }]> = [
    ["posDelta", "u32", posDelta], ["alleles", "u8", alleles], ["compFreq", "u8", p.compFreq],
    ["coreIndexDelta", "u32", coreDelta], ["popFreq", "u8", p.popFreq], ["pooledFreq", "u16", p.pooledFreq], ["loadings", "i16", p.loadings],
  ];
  const header: PanelHeader = {
    ...(p.header as PanelHeader), version: 1, build: 37, chromCounts, nSnp: n,
    core: { nSnp: p.coreIndex.length },
    blocks: parts.map(([name, type, arr]) => ({ name, type, length: arr.length })),
  };
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
  /** Called SNPs per autosome, for coverage displays. */
  perChromosome: number[];
}

/**
 * Look each panel SNP up in the kit by chromosome and GRCh37 position (rsIDs
 * drift between chip versions; positions do not) and count ALT alleles.
 * Genotypes whose alleles are not the panel's are tried on the other strand
 * (the panel holds no A/T or C/G SNPs, so a complement is never ambiguous);
 * anything else is marked unusable rather than guessed.
 */
export function panelGenotypes(kit: Kit, panel: ReferencePanelData): PanelGenotypes {
  const n = panel.header.nSnp;
  const dosage = new Int8Array(n).fill(-1);
  let called = 0, strandFlipped = 0, alleleMismatch = 0, notOnChip = 0, noCall = 0;
  const perChromosome = new Array<number>(panel.header.chromosomes.length).fill(0);
  for (let i = 0; i < n; i++) {
    const chrom = panel.header.chromosomes[panel.chromIdx[i]!]!;
    const k = kit.indexAt(chrom, panel.pos[i]!);
    if (k === undefined) { notOnChip++; continue; }
    const g = kit.genotype[k]!;
    if (g.length !== 2) { noCall++; continue; }
    const r = BASE_CODES[panel.ref[i]!]!, a = BASE_CODES[panel.alt[i]!]!;
    let x = g;
    const fits = (s: string) => (s[0] === r || s[0] === a) && (s[1] === r || s[1] === a);
    if (!fits(x)) {
      const flipped = complement(x);
      if (fits(flipped)) { x = flipped; strandFlipped++; } else { alleleMismatch++; continue; }
    }
    dosage[i] = (x[0] === a ? 1 : 0) + (x[1] === a ? 1 : 0);
    called++;
    perChromosome[panel.chromIdx[i]!]!++;
  }
  return { dosage, called, strandFlipped, alleleMismatch, notOnChip, noCall, perChromosome };
}

export function panelChrom(panel: ReferencePanelData, i: number): Chrom {
  return panel.header.chromosomes[panel.chromIdx[i]!]!;
}

export function isPanelAutosome(panel: ReferencePanelData, i: number): boolean {
  return AUTOSOMES.includes(panelChrom(panel, i));
}
