/**
 * The reference PCA: every 1000 Genomes phase 3 genome as a dot, coloured by
 * its continental group, population codes at their centroids, and the user
 * (projected by least squares, corrected for shrinkage) as a labelled ring,
 * with the 95% ellipse of its bootstrap covariance when there is one.
 */
import { s, h, tip } from "../lib/dom.js";
import type { ReferenceSamplesFile, Population } from "../lib/reference.js";

export interface PcaOpts {
  width: number;
  ref: ReferenceSamplesFile;
  popInfo: Map<string, Population>;
  colorOf: (superpop: string) => string;
  pcX: number;
  pcY: number;
  you?: number[];
  /** Covariance of the user's scores (nPc x nPc), for a 95% ellipse. */
  youCov?: number[][];
  youLabel?: string;
  variance?: number[];
}

export function pcaScatter(o: PcaOpts): SVGSVGElement {
  const W = o.width, H = Math.round(Math.min(560, Math.max(300, W * 0.72)));
  const m = { l: 40, r: 14, t: 12, b: 38 };
  const xs = o.ref.pcs.map((p) => p[o.pcX]! / 1000), ys = o.ref.pcs.map((p) => p[o.pcY]! / 1000);
  const all = (arr: number[], extra?: number) => (extra === undefined ? arr : [...arr, extra]);
  const [x0, x1] = extent(all(xs, o.you?.[o.pcX])), [y0, y1] = extent(all(ys, o.you?.[o.pcY]));
  const px = (v: number) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const py = (v: number) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Principal components ${o.pcX + 1} and ${o.pcY + 1} of 2,504 reference genomes` });
  svg.append(s("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "none", stroke: "var(--rule)" }));
  const axis = (t: string, x: number, y: number, rot = 0) => s("text", { x, y, "text-anchor": "middle", class: "lbl", "font-size": 11, transform: rot ? `rotate(${rot} ${x} ${y})` : undefined }, t);
  const pct = (i: number) => (o.variance?.[i] !== undefined ? ` (${(o.variance[i]! * 100).toFixed(1)}% of variance)` : "");
  svg.append(axis(`PC${o.pcX + 1}${pct(o.pcX)}`, (W + m.l) / 2, H - 10), axis(`PC${o.pcY + 1}${pct(o.pcY)}`, 13, (H - m.b + m.t) / 2, -90));
  const dots = s("g");
  const r = W < 520 ? 1.7 : 2.2;
  o.ref.pop.forEach((pi, i) => {
    const pop = o.popInfo.get(o.ref.populations[pi]!);
    dots.append(s("circle", { cx: px(xs[i]!), cy: py(ys[i]!), r, fill: o.colorOf(pop?.superpopulation ?? ""), opacity: 0.55 }));
  });
  svg.append(dots);
  // Population centroids with direct labels. Labels are placed greedily, the user's first, and a
  // population label that would overlap one already placed is left out (its dots and tooltip stay).
  const fs = W < 520 ? 9 : 10;
  const placed: Array<[number, number, number, number]> = [];
  const free = (x0: number, y0: number, x1: number, y1: number) => !placed.some(([a, b, c, d]) => x0 < c && x1 > a && y0 < d && y1 > b);
  const labels = s("g");
  let you: SVGElement[] = [];
  if (o.you) {
    const ux = px(o.you[o.pcX]!), uy = py(o.you[o.pcY]!);
    const text = o.youLabel ?? "You";
    placed.push([ux - 12, uy - 12, ux + 12, uy + 12], [ux + 13, uy - 23, ux + 17 + text.length * 8, uy - 5]);
    const ell = o.youCov ? ellipse(o.you[o.pcX]!, o.you[o.pcY]!, o.youCov, o.pcX, o.pcY) : undefined;
    you = [
      ...(ell ? [s("path", { d: ell.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("") + "Z", fill: "var(--ink)", "fill-opacity": 0.08, stroke: "var(--ink)", "stroke-width": 1, "stroke-dasharray": "3 3" })] : []),
      s("circle", { cx: ux, cy: uy, r: 11, fill: "none", stroke: "var(--ink)", "stroke-width": 2.2 }),
      s("circle", { cx: ux, cy: uy, r: 3.5, fill: "var(--ink)" }),
      s("text", { x: ux + 15, y: uy - 10, class: "lbl-strong", "paint-order": "stroke", stroke: "var(--card)", "stroke-width": 4, "stroke-linejoin": "round" }, text)];
  }
  const centres = o.ref.populations.map((code, pi) => {
    let sx = 0, sy = 0, n = 0;
    o.ref.pop.forEach((p, i) => { if (p === pi) { sx += xs[i]!; sy += ys[i]!; n++; } });
    return { code, n, x: n ? px(sx / n) : 0, y: n ? py(sy / n) : 0 };
  }).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  for (const c of centres) {
    const half = (c.code.length * fs * 0.62) / 2 + 2;
    const box: [number, number, number, number] = [c.x - half, c.y - fs * 0.6, c.x + half, c.y + fs * 0.6];
    if (!free(...box)) continue;
    placed.push(box);
    labels.append(s("text", { x: c.x, y: c.y + 3.5, "text-anchor": "middle", class: "ann", "font-size": fs, "paint-order": "stroke", stroke: "var(--card)", "stroke-width": 3, "stroke-linejoin": "round" }, c.code));
  }
  svg.append(labels, ...you);
  // Nearest-dot tooltip from one listener.
  const hit = s("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
  let nearest = -1;
  hit.addEventListener("pointermove", (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = Infinity;
    for (let i = 0; i < xs.length; i++) { const d = (px(xs[i]!) - mx) ** 2 + (py(ys[i]!) - my) ** 2; if (d < best) { best = d; nearest = i; } }
    if (best > 400) nearest = -1;
  });
  tip(hit, () => {
    if (nearest < 0) return h("span", {}, "Reference genomes from 1000 Genomes phase 3");
    const code = o.ref.populations[o.ref.pop[nearest]!]!, p = o.popInfo.get(code);
    return h("span", {}, h("b", {}, `${code} · ${p?.name ?? ""}`), h("br"), p?.description ?? "", h("br"), h("span", { class: "mono" }, `PC${o.pcX + 1} ${xs[nearest]!.toFixed(2)}, PC${o.pcY + 1} ${ys[nearest]!.toFixed(2)}`));
  });
  svg.append(hit);
  return svg;
}

/** Points on the 95% ellipse of a bivariate normal (chi-square(2) 95% point 5.991). */
function ellipse(mx: number, my: number, cov: number[][], i: number, j: number): Array<[number, number]> | undefined {
  const a = cov[i]?.[i], b = cov[i]?.[j], c = cov[j]?.[j];
  if (a === undefined || b === undefined || c === undefined || !(a >= 0) || !(c >= 0)) return undefined;
  const tr = a + c, det = a * c - b * b, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  const theta = Math.abs(b) < 1e-15 ? (a >= c ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b);
  const r1 = Math.sqrt(5.991 * l1), r2 = Math.sqrt(5.991 * l2);
  return Array.from({ length: 48 }, (_, k) => {
    const t = (2 * Math.PI * k) / 48, x = r1 * Math.cos(t), y = r2 * Math.sin(t);
    return [mx + x * Math.cos(theta) - y * Math.sin(theta), my + x * Math.sin(theta) + y * Math.cos(theta)] as [number, number];
  });
}

function extent(v: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const pad = (hi - lo) * 0.06 || 1;
  return [lo - pad, hi + pad];
}
