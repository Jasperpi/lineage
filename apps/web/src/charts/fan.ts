/**
 * A pedigree fan chart: the focus person at the centre of a half circle,
 * each ring one generation further back, father's side on the left and
 * mother's on the right. Rings can be coloured by side or by the share of
 * DNA expected from that ancestor, with the outer rings marked where an
 * ancestor may have left no DNA at all.
 */
import { s, tip, h } from "../lib/dom.js";
import type { AhnentafelEntry } from "@lineage/core";

export type FanMode = "side" | "dna" | "country";

export function fanChart(o: { width: number; entries: AhnentafelEntry[]; generations: number; mode: FanMode; onPick?: (id: string) => void; countryColor?: (place?: string) => string }): SVGSVGElement {
  const W = o.width, G = o.generations;
  const R = Math.min(W / 2 - 6, 360);
  const r0 = R * 0.2;
  const ring = (R - r0) / G;
  const H = R + 18;
  const cx = W / 2, cy = R + 4;
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Fan chart of ancestors" });
  const byNumber = new Map(o.entries.map((e) => [e.number, e]));
  const arc = (r1: number, r2: number, a1: number, a2: number) => {
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    const large = a2 - a1 > Math.PI ? 1 : 0;
    return `M${p(r1, a1)} A${r1},${r1} 0 ${large} 1 ${p(r1, a2)} L${p(r2, a2)} A${r2},${r2} 0 ${large} 0 ${p(r2, a1)} Z`;
  };
  // Centre.
  const root = byNumber.get(1);
  // The centre label must fit the chord of the half disc at its baseline: full name, else the
  // given name, else a shortened given name. Size goes in `style` so the class cannot override it.
  const fsC = Math.max(9, Math.min(13, r0 / 3));
  const room = 2 * Math.sqrt(r0 * r0 - (r0 * 0.35) ** 2) * 0.86;
  const fits = (t: string) => t.length * fsC * 0.6 <= room;
  const full = root?.individual.name ?? "?", given = root?.individual.given ?? full.split(" ")[0] ?? full;
  const centreLabel = fits(full) ? full : fits(given) ? given : short(given, Math.max(2, Math.floor(room / (fsC * 0.6))));
  const centre = s("g", { style: "cursor:default" },
    s("path", { d: `M${cx - r0},${cy} A${r0},${r0} 0 0 1 ${cx + r0},${cy} Z`, fill: "var(--ink)" }),
    s("text", { x: cx, y: cy - r0 * 0.35, "text-anchor": "middle", class: "lbl-strong", style: `fill:var(--paper);font-size:${fsC.toFixed(1)}px` }, centreLabel),
    s("title", {}, full));
  svg.append(centre);
  for (let g = 1; g <= G; g++) {
    const n = 2 ** g;
    for (let k = 0; k < n; k++) {
      const number = n + k;
      const a1 = Math.PI + (k / n) * Math.PI, a2 = Math.PI + ((k + 1) / n) * Math.PI;
      const r1 = r0 + (g - 1) * ring, r2 = r0 + g * ring - 1.5;
      const e = byNumber.get(number);
      const paternal = k < n / 2;
      let fill = "var(--paper-2)";
      if (e) {
        if (o.mode === "side") fill = `color-mix(in srgb, ${paternal ? "var(--navy)" : "var(--brick)"} ${Math.max(18, 70 - g * 11)}%, var(--card))`;
        else if (o.mode === "dna") fill = `color-mix(in srgb, var(--navy) ${Math.round(100 * Math.pow(0.5, g) * 1.6 + 8)}%, var(--card))`;
        else fill = o.countryColor?.(e.individual.birth?.place) ?? "var(--paper-2)";
      }
      const seg = s("path", { d: arc(r1, r2, a1, a2), fill, stroke: "var(--card)", "stroke-width": 1.5, style: e && o.onPick ? "cursor:pointer" : undefined });
      if (o.mode === "dna" && g >= 5) seg.setAttribute("stroke-dasharray", "2 2");
      const grp = s("g", {}, seg);
      if (e) {
        const mid = (a1 + a2) / 2, rm = (r1 + r2) / 2;
        const tx = cx + rm * Math.cos(mid), ty = cy + rm * Math.sin(mid);
        const span = (a2 - a1) * rm;
        const deg = (mid * 180) / Math.PI; // 180 (left) through 270 (top) to 360 (right)
        const radial = span < 46;
        // Keep every label upright: tangential labels follow the arc, radial ones point outwards.
        const rot = radial ? (deg > 270 ? deg - 360 : deg - 180) : deg - 270;
        const maxChars = Math.floor((radial ? ring - 6 : span - 6) / 6.2);
        if (maxChars >= 3) grp.append(s("text", { x: tx, y: ty + 3.5, "text-anchor": "middle", class: "lbl", "font-size": g >= 4 ? 9.5 : 11, transform: `rotate(${rot} ${tx} ${ty})` }, short(e.individual.given ?? e.individual.name, maxChars)));
        const share = Math.pow(0.5, g);
        tip(grp, () => h("span", {}, h("b", {}, e.individual.name), h("br"),
          `${e.individual.birth?.year ? `Born ${e.individual.birth.year}` : "Birth year unknown"}${e.individual.birth?.place ? `, ${e.individual.birth.place}` : ""}`, h("br"),
          h("span", { class: "mono" }, `Generation ${g} · expected share ${share >= 0.01 ? `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%` : `${(share * 100).toFixed(2)}%`}${g >= 6 ? " · may be 0%" : ""}`)));
        if (o.onPick) grp.addEventListener("click", () => o.onPick!(e.id));
      }
      svg.append(grp);
    }
  }
  svg.append(s("text", { x: cx - R + 4, y: H - 2, class: "lbl", "font-size": 10 }, "Father's side"), s("text", { x: cx + R - 4, y: H - 2, "text-anchor": "end", class: "lbl", "font-size": 10 }, "Mother's side"));
  return svg;
}

function short(t: string, n: number): string {
  return t.length <= n ? t : t.slice(0, Math.max(1, n - 1)) + "…";
}
