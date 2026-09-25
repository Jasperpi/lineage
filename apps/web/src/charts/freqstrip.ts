/**
 * Allele frequency in each of the 26 populations: one row per continental
 * group, a dot per population with its 95% Wilson interval, labelled on
 * hover and listed in full under the chart.
 */
import { s, h, tip, fmt } from "../lib/dom.js";
import { wilson } from "./common.js";
import type { Population } from "../lib/reference.js";

export function frequencyStrip(o: {
  width: number;
  groups: Array<{ code: string; name: string; pops: Population[] }>;
  freq: (code: string) => number | undefined;
  n: (code: string) => number;
  color: (superpop: string) => string;
  allele: string;
  compact?: boolean;
}): SVGSVGElement {
  const W = o.width, rowH = o.compact ? 20 : 28, m = { l: o.compact ? 42 : 120, r: 14, t: 6, b: 22 };
  const H = m.t + o.groups.length * rowH + m.b;
  const x = (v: number) => m.l + v * (W - m.l - m.r);
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Frequency of the ${o.allele} allele in 26 populations` });
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    svg.append(s("line", { x1: x(t), x2: x(t), y1: m.t, y2: H - m.b, stroke: "var(--rule-2)" }));
    svg.append(s("text", { x: x(t), y: H - 6, "text-anchor": "middle", class: "lbl", "font-size": 10 }, `${t * 100}%`));
  }
  o.groups.forEach((g, i) => {
    const y = m.t + i * rowH + rowH / 2;
    svg.append(s("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "lbl", "font-size": 11 }, o.compact ? g.code : g.name));
    svg.append(s("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: "var(--rule)" }));
    for (const p of g.pops) {
      const f = o.freq(p.code);
      if (f === undefined) continue;
      const [lo, hi] = wilson(f, o.n(p.code));
      const c = o.color(g.code);
      const grp = s("g", {},
        s("line", { x1: x(lo), x2: x(hi), y1: y, y2: y, stroke: c, "stroke-width": 3, opacity: 0.35, "stroke-linecap": "round" }),
        s("circle", { cx: x(f), cy: y, r: o.compact ? 3.6 : 4.6, fill: c, stroke: "var(--card)", "stroke-width": 1.2 }),
        s("circle", { cx: x(f), cy: y, r: 10, fill: "transparent" }));
      tip(grp, () => h("span", {}, h("b", {}, `${p.code} · ${p.name}`), h("br"), `${o.allele} allele: ${fmt.pct(f, 1)} of ${fmt.int(o.n(p.code))} chromosomes`, h("br"), h("span", { class: "mono" }, `95% interval ${fmt.pct(lo, 0)}–${fmt.pct(hi, 0)}`)));
      svg.append(grp);
    }
  });
  return svg;
}
