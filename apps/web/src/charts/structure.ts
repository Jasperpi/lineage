/**
 * The reference panel as a population-genetics bar plot: one thin column per
 * 1000 Genomes genome, stacked by its continental component proportions,
 * grouped by population. It shows what the components mean and how admixed
 * the reference populations themselves are (the American and diaspora
 * samples most of all).
 */
import { s, tip, h } from "../lib/dom.js";
import type { ReferenceSamplesFile, Population } from "../lib/reference.js";

export function structurePlot(o: { width: number; ref: ReferenceSamplesFile; order: string[]; colors: string[]; popInfo: Map<string, Population>; highlight?: string }): SVGSVGElement {
  const W = o.width, barH = W < 520 ? 90 : 120, labH = W < 520 ? 34 : 40;
  const H = barH + labH;
  const K = o.ref.components.length;
  const idxByPop = new Map<number, number[]>();
  o.ref.pop.forEach((p, i) => { const a = idxByPop.get(p) ?? []; a.push(i); idxByPop.set(p, a); });
  const blocks = o.order.map((code) => {
    const pi = o.ref.populations.indexOf(code);
    const ids = (idxByPop.get(pi) ?? []).slice();
    // Sort within the population by its main component, then by that share.
    const mean = new Array<number>(K).fill(0);
    ids.forEach((i) => o.ref.q[i]!.forEach((v, k) => { mean[k]! += v; }));
    const main = mean.indexOf(Math.max(...mean));
    ids.sort((a, b) => o.ref.q[b]![main]! - o.ref.q[a]![main]!);
    return { code, ids };
  });
  const n = blocks.reduce((a, b) => a + b.ids.length, 0);
  const gapPx = 2;
  const colW = (W - gapPx * (blocks.length - 1)) / n;
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Continental component proportions of the 2,504 reference genomes, by population" });
  const paths = Array.from({ length: K }, () => [] as string[]);
  let x = 0;
  for (const b of blocks) {
    const bx = x;
    for (const i of b.ids) {
      let y = 0;
      o.ref.q[i]!.forEach((v, k) => {
        const hgt = (v / 1000) * barH;
        if (hgt > 0.05) paths[k]!.push(`M${x.toFixed(2)},${y.toFixed(2)}h${(colW + 0.35).toFixed(2)}v${hgt.toFixed(2)}h-${(colW + 0.35).toFixed(2)}z`);
        y += hgt;
      });
      x += colW;
    }
    const mid = (bx + x) / 2;
    const g = s("g");
    g.append(s("rect", { x: bx, y: 0, width: x - bx, height: barH, fill: "transparent" }));
    const p = o.popInfo.get(b.code);
    tip(g, () => h("span", {}, h("b", {}, `${b.code} · ${p?.name ?? ""}`), h("br"), `${b.ids.length} genomes. ${p?.description ?? ""}`));
    svg.append(g);
    const small = W < 520;
    svg.append(s("text", { x: mid, y: barH + 12, "text-anchor": small ? "end" : "middle", class: "ann", "font-size": small ? 8.5 : 10, transform: small ? `rotate(-60 ${mid} ${barH + 8})` : undefined, "font-weight": b.code === o.highlight ? 700 : 400 }, b.code));
    x += gapPx;
  }
  paths.forEach((d, k) => svg.prepend(s("path", { d: d.join(""), fill: o.colors[k]! })));
  return svg;
}
