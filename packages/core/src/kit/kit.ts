import { type Chrom, CHROM_BY_INDEX, INDEX_BY_CHROM, isAutosome } from "../genome.js";
import { canonicalGenotype } from "../util/alleles.js";

export type KitFormat =
  | "23andme"
  | "ancestrydna"
  | "ftdna"
  | "myheritage"
  | "livingdna"
  | "generic";

export interface KitMeta {
  format: KitFormat;
  /** Reference build the positions are on. Consumer kits are all GRCh37. */
  build: 37 | 38;
  /** Free-text header lines from the file, kept for provenance. */
  headerLines: string[];
  /** Strand the vendor reports on. All major vendors report the forward (+) strand of the build. */
  strand: "plus" | "unknown";
  /** Detected chip/version string when the header names one. */
  chipVersion?: string;
}

export interface Variant {
  rsid: string;
  chrom: Chrom;
  pos: number;
  /**
   * Genotype string: two alleles ("AG"), one for haploid calls ("A"),
   * or "" for a no-call. Alleles are A/C/G/T, or D/I for 23andMe indel calls.
   * Always canonical (sorted) when diploid.
   */
  genotype: string;
}

/**
 * A raw genotype kit held in columnar storage. Roughly 600k-700k variants
 * per consumer file; keeping columns in typed arrays keeps memory ~1/4 of a
 * naive object-per-row layout, which matters in the browser.
 */
export class Kit {
  readonly meta: KitMeta;
  readonly size: number;
  readonly rsid: string[];
  readonly chromIdx: Uint8Array;
  readonly pos: Uint32Array;
  readonly genotype: string[];
  private readonly byRsid: Map<string, number>;
  private readonly chromRanges: Map<Chrom, [number, number]>;

  constructor(meta: KitMeta, rows: Variant[]) {
    // Sort by chromosome then position so region scans are linear.
    rows.sort((a, b) => (INDEX_BY_CHROM[a.chrom] - INDEX_BY_CHROM[b.chrom]) || (a.pos - b.pos));
    this.meta = meta;
    this.size = rows.length;
    this.rsid = new Array<string>(rows.length);
    this.chromIdx = new Uint8Array(rows.length);
    this.pos = new Uint32Array(rows.length);
    this.genotype = new Array<string>(rows.length);
    this.byRsid = new Map();
    this.chromRanges = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      this.rsid[i] = r.rsid;
      this.chromIdx[i] = INDEX_BY_CHROM[r.chrom];
      this.pos[i] = r.pos;
      this.genotype[i] = r.genotype;
      if (r.rsid) this.byRsid.set(r.rsid, i);
      const range = this.chromRanges.get(r.chrom);
      if (range) range[1] = i + 1; else this.chromRanges.set(r.chrom, [i, i + 1]);
    }
  }

  chromAt(i: number): Chrom { return CHROM_BY_INDEX[this.chromIdx[i]!]!; }

  variantAt(i: number): Variant {
    return { rsid: this.rsid[i]!, chrom: this.chromAt(i), pos: this.pos[i]!, genotype: this.genotype[i]! };
  }

  indexOf(rsid: string): number | undefined { return this.byRsid.get(rsid); }

  get(rsid: string): Variant | undefined {
    const i = this.byRsid.get(rsid);
    return i === undefined ? undefined : this.variantAt(i);
  }

  /** Half-open index range [start, end) for a chromosome; [0,0) when absent. */
  range(chrom: Chrom): [number, number] { return this.chromRanges.get(chrom) ?? [0, 0]; }

  /** Binary search for a position on a chromosome; returns index or undefined. */
  indexAt(chrom: Chrom, pos: number): number | undefined {
    let [lo, hi] = this.range(chrom);
    hi -= 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const p = this.pos[mid]!;
      if (p === pos) return mid;
      if (p < pos) lo = mid + 1; else hi = mid - 1;
    }
    return undefined;
  }

  chromosomes(): Chrom[] { return [...this.chromRanges.keys()]; }

  *variants(chrom?: Chrom): Generator<Variant> {
    const [s, e] = chrom ? this.range(chrom) : [0, this.size];
    for (let i = s; i < e; i++) yield this.variantAt(i);
  }

  /** Convenience: number of variants with a call. */
  called(): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.genotype[i]) n++;
    return n;
  }

  isAutosomeIdx(i: number): boolean { return isAutosome(this.chromAt(i)); }
}

export function makeGenotype(a1: string, a2: string | undefined): string {
  const clean = (a: string) => {
    const u = a.trim().toUpperCase();
    return u === "" || u === "-" || u === "0" || u === "N" || u === "." ? "" : u;
  };
  const x = clean(a1), y = a2 === undefined ? "" : clean(a2);
  if (!x && !y) return "";
  if (!x || !y) return x || y; // haploid call
  return canonicalGenotype(x + y);
}
