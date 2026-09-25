/**
 * One row per chromosome, widths proportional to length (base pairs or cM).
 * Everything drawn on chromosomes goes through this: marker density, runs of
 * homozygosity, painted ancestry, shared segments, match overlays, and the
 * inheritance simulator.
 */
import { GRCH37_LENGTH, type Chrom } from "@lineage/core";
import { s } from "../lib/dom.js";

export const AUTOSOME_NAMES = Array.from({ length: 22 }, (_, i) => String(i + 1));

export interface Track {
  /** Draw into `g`; x maps a position in the chart's unit to pixels. */
  draw: (chrom: string, g: SVGGElement, x: (u: number) => number, y: number, h: number) => void;
}

export interface ChromChartOpts {
  width: number;
  chroms?: string[];
  /** Length of each chromosome in the chart's unit. Default GRCh37 base pairs. */
  length?: (chrom: string) => number;
  rowH?: number;
  gap?: number;
  /** Text at the right end of each row (e.g. a cM total). */
  right?: (chrom: string) => string;
  rightW?: number;
  base?: boolean;
  tracks: Track[];
  label?: string;
}

export function chromosomeChart(o: ChromChartOpts): SVGSVGElement {
  const chroms = o.chroms ?? AUTOSOME_NAMES;
  const len = o.length ?? ((c: string) => GRCH37_LENGTH[c as Chrom] ?? 0);
  const rowH = o.rowH ?? (o.width < 520 ? 12 : 14);
  const gap = o.gap ?? (o.width < 520 ? 7 : 8);
  const labelW = 26, rightW = o.right ? (o.rightW ?? (o.width < 520 ? 64 : 84)) : 4;
  const maxLen = Math.max(...chroms.map(len));
  const inner = o.width - labelW - rightW;
  const H = chroms.length * (rowH + gap) - gap + 4;
  const svg = s("svg", { width: o.width, height: H, viewBox: `0 0 ${o.width} ${H}`, role: "img", "aria-label": o.label ?? "Chromosomes" });
  chroms.forEach((c, i) => {
    const y = 2 + i * (rowH + gap);
    const L = len(c);
    const x = (u: number) => labelW + (Math.max(0, Math.min(L, u)) / maxLen) * inner;
    svg.append(s("text", { x: labelW - 7, y: y + rowH * 0.78, "text-anchor": "end", class: "lbl", "font-size": 11 }, c));
    const g = s("g");
    if (o.base !== false) g.append(s("rect", { x: labelW, y, width: (L / maxLen) * inner, height: rowH, rx: rowH / 2, fill: "var(--paper-2)", stroke: "var(--rule)", "stroke-width": 0.8 }));
    const clipId = `clip-${Math.random().toString(36).slice(2)}`;
    const clip = s("clipPath", { id: clipId }, s("rect", { x: labelW, y, width: (L / maxLen) * inner, height: rowH, rx: rowH / 2 }));
    const content = s("g", { "clip-path": `url(#${clipId})` });
    for (const t of o.tracks) t.draw(c, content, x, y, rowH);
    g.append(clip, content);
    svg.append(g);
    if (o.right) svg.append(s("text", { x: o.width - 2, y: y + rowH * 0.78, "text-anchor": "end", class: "lbl", "font-size": 11 }, o.right(c)));
  });
  // Hatch pattern for fully identical segments, so they differ by texture as well as colour.
  svg.prepend(s("defs", {}, s("pattern", { id: "hatch", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
    s("rect", { width: 5, height: 5, fill: "var(--full)" }), s("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "var(--card)", "stroke-width": 1.6 }))));
  return svg;
}
