/** Relationship figures: probability bars and simulated distributions with the observed value marked. */
import { h, s, fmt, tip } from "../lib/dom.js";
import type { DistributionSketch, Posterior } from "../lib/protocol.js";

/** Ranked probability rows, shown as bars so small values stay visible. */
export function probabilityBars(post: Posterior[], opts: { limit?: number; truth?: string } = {}): HTMLElement {
  const rows = post.filter((p) => p.probability >= 0.005).slice(0, opts.limit ?? 6);
  const rest = post.length - rows.length, restP = post.filter((p) => !rows.includes(p)).reduce((a, p) => a + p.probability, 0);
  return h("div", {},
    ...rows.map((p, i) => h("div", { class: "bar-row stack-sm" },
      h("span", { class: "name", title: p.label }, p.label, opts.truth === p.id ? h("span", { class: "pill good", style: "margin-left:6px" }, "true") : null),
      h("span", { class: "bar-track" }, h("i", { style: `width:${Math.max(1.5, p.probability * 100)}%;background:${i === 0 ? "var(--navy)" : "color-mix(in srgb, var(--navy) 45%, var(--paper-2))"}` })),
      h("span", { class: "val" }, fmt.prob(p.probability)))),
    rest ? h("p", { class: "chart-note" }, `${rest} other relationship${rest === 1 ? "" : "s"} share the remaining ${fmt.prob(restP)}.`) : null);
}

/**
 * Ridgelines of simulated totals for the leading relationships: the share of
 * 2,000 simulated pairs in each 50 cM bin, a bracket for the Shared cM
 * Project's observed range, and a vertical rule at the observed total.
 */
export function ridgelines(sk: DistributionSketch[], observed: number, width: number): SVGSVGElement {
  // Labels sit left of each row when they fit in under a third of the width, otherwise above it.
  const need = Math.max(...sk.map((d) => d.label.length)) * 6.9 + 20;
  const stacked = width < 520 || need > width / 3;
  const W = width, rowH = 52, m = { l: stacked ? 8 : Math.max(150, need), r: 12, t: 8, b: 26 };
  const max = Math.min(3750, Math.max(observed * 1.35, ...sk.map((d) => Math.min(3750, d.p99 * 1.1)), 200));
  const x = (v: number) => m.l + (Math.min(v, max) / max) * (W - m.l - m.r);
  const H = m.t + sk.length * rowH + m.b;
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Simulated shared cM for the most likely relationships" });
  sk.forEach((d, i) => {
    const base = m.t + (i + 1) * rowH - 12;
    const peak = Math.max(...d.share, 1e-9);
    let path = `M${x(0)},${base}`;
    d.share.forEach((v, b) => {
      const x0 = x(d.edges[b]!), x1 = x(d.edges[b + 1]!);
      const y = base - (v / peak) * (rowH - 18);
      path += ` L${x0},${y} L${x1},${y}`;
    });
    path += ` L${x(max)},${base} Z`;
    const color = i === 0 ? "var(--navy)" : "color-mix(in srgb, var(--navy) 40%, var(--ink-3))";
    svg.append(s("path", { d: path, fill: color, opacity: i === 0 ? 0.28 : 0.16, stroke: color, "stroke-width": 1.2 }));
    if (d.v4) {
      svg.append(
        s("line", { x1: x(d.v4.min), x2: x(d.v4.max), y1: base + 6, y2: base + 6, stroke: "var(--brick)", "stroke-width": 2 }),
        s("line", { x1: x(d.v4.min), x2: x(d.v4.min), y1: base + 3, y2: base + 9, stroke: "var(--brick)", "stroke-width": 2 }),
        s("line", { x1: x(d.v4.max), x2: x(d.v4.max), y1: base + 3, y2: base + 9, stroke: "var(--brick)", "stroke-width": 2 }));
    }
    svg.append(s("line", { x1: m.l, x2: W - m.r, y1: base, y2: base, stroke: "var(--rule)" }));
    const label = s("text", { x: stacked ? m.l + 2 : m.l - 10, y: stacked ? base - rowH + 26 : base - 6, "text-anchor": stacked ? "start" : "end", class: "lbl-strong", "font-size": 12 }, d.label);
    svg.append(label);
    const g = s("rect", { x: m.l, y: base - rowH + 12, width: W - m.l - m.r, height: rowH, fill: "transparent" });
    tip(g, () => h("span", {}, h("b", {}, d.label), h("br"), `Simulated mean ${fmt.int(d.mean)} cM; 98% of pairs between ${fmt.int(d.p01)} and ${fmt.int(d.p99)} cM.`,
      d.noSharing > 0.001 ? ` ${fmt.pct(d.noSharing, 0)} share nothing detectable.` : "",
      d.v4 ? h("span", {}, h("br"), `Shared cM Project v4: average ${fmt.int(d.v4.average)}, observed ${fmt.int(d.v4.min)}–${fmt.int(d.v4.max)}.`) : ""));
    svg.append(g);
  });
  // Axis.
  const axisY = H - m.b + 4;
  const step = max > 2000 ? 500 : max > 800 ? 200 : max > 300 ? 100 : 50;
  for (let v = 0; v <= max; v += step) {
    svg.append(s("line", { x1: x(v), x2: x(v), y1: axisY - 4, y2: axisY, stroke: "var(--rule)" }));
    svg.append(s("text", { x: x(v), y: axisY + 12, "text-anchor": "middle", class: "lbl", "font-size": 10 }, fmt.int(v)));
  }
  svg.append(s("text", { x: W - m.r, y: axisY + 24 > H ? axisY + 12 : axisY + 24, "text-anchor": "end", class: "lbl", "font-size": 10 }, "cM"));
  // Observed.
  svg.append(
    s("line", { x1: x(observed), x2: x(observed), y1: m.t - 2, y2: axisY, stroke: "var(--ink)", "stroke-width": 1.6, "stroke-dasharray": "4 3" }),
    s("text", { x: x(observed) + 5, y: m.t + 10, class: "ann", "font-size": 11, "paint-order": "stroke", stroke: "var(--card)", "stroke-width": 3 }, `${fmt.int(observed)} cM`));
  return svg;
}
