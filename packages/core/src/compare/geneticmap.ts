/**
 * Genetic map support. Physical positions (bp) only become centimorgans (cM)
 * through a genetic map. The framework does not embed one (they are large and
 * build-specific); load a HapMap-style map when you need cM, otherwise
 * results are reported in bp with an explicit note.
 *
 * HapMap / 1000G map text format (per chromosome file):
 *   Chromosome  Position(bp)  Rate(cM/Mb)  Map(cM)
 */
import type { Chrom } from "../genome.js";
import { normaliseChrom } from "../genome.js";
import { iterateLines } from "../util/csv.js";

export interface GeneticMap {
  /** Interpolated genetic position in cM; undefined if the chromosome is missing. */
  cM(chrom: Chrom, pos: number): number | undefined;
  /** Total mapped length in cM for a chromosome. */
  length(chrom: Chrom): number | undefined;
  chromosomes(): Chrom[];
}

interface ChromMap { pos: Float64Array; cm: Float64Array }

export class InterpolatedGeneticMap implements GeneticMap {
  private readonly maps = new Map<Chrom, ChromMap>();

  add(chrom: Chrom, points: Array<[number, number]>): void {
    points.sort((a, b) => a[0] - b[0]);
    this.maps.set(chrom, {
      pos: Float64Array.from(points, (p) => p[0]),
      cm: Float64Array.from(points, (p) => p[1]),
    });
  }

  cM(chrom: Chrom, p: number): number | undefined {
    const m = this.maps.get(chrom);
    if (!m || m.pos.length === 0) return undefined;
    const n = m.pos.length;
    if (p <= m.pos[0]!) return m.cm[0]!;
    if (p >= m.pos[n - 1]!) return m.cm[n - 1]!;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (m.pos[mid]! <= p) lo = mid; else hi = mid;
    }
    const p0 = m.pos[lo]!, p1 = m.pos[hi]!, c0 = m.cm[lo]!, c1 = m.cm[hi]!;
    return p1 === p0 ? c0 : c0 + ((p - p0) / (p1 - p0)) * (c1 - c0);
  }

  length(chrom: Chrom): number | undefined {
    const m = this.maps.get(chrom);
    return m && m.cm.length ? m.cm[m.cm.length - 1]! - m.cm[0]! : undefined;
  }

  chromosomes(): Chrom[] { return [...this.maps.keys()]; }
}

/** Parse one or many HapMap-format map files concatenated together. */
export function parseHapMapGeneticMap(text: string, into = new InterpolatedGeneticMap()): InterpolatedGeneticMap {
  const buckets = new Map<Chrom, Array<[number, number]>>();
  for (const line of iterateLines(text)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 4 || !/^\d/.test(f[1] ?? "")) continue;
    const chrom = normaliseChrom(f[0]!);
    if (!chrom) continue;
    const pos = Number(f[1]), cm = Number(f[3]);
    if (!Number.isFinite(pos) || !Number.isFinite(cm)) continue;
    let b = buckets.get(chrom);
    if (!b) { b = []; buckets.set(chrom, b); }
    b.push([pos, cm]);
  }
  for (const [c, pts] of buckets) into.add(c, pts);
  return into;
}
