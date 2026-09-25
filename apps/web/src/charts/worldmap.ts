/**
 * World map of reference populations. Points sit at the sampling sites IGSR
 * records, on a borderless land outline (Natural Earth via world-atlas), so
 * the map says where samples came from rather than drawing nations. Points
 * sampled away from their ancestral region get a hollow ring and a dashed
 * leader line to the country named in their description.
 */
import { geoEqualEarth, geoPath, geoCentroid, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import { s, tip, type Child } from "../lib/dom.js";

const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }>; land: GeometryCollection }>;
const land = feature(topo, topo.objects.land) as FeatureCollection | Feature;
const countries = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const ORIGIN_NAME: Record<string, string> = { IN: "India", MX: "Mexico", LK: "Sri Lanka" };

export interface MapPoint {
  code: string;
  lat: number;
  lon: number;
  color: string;
  /** Radius in px. */
  r: number;
  opacity?: number;
  /** Draw a halo whose opacity carries a value in 0-1. */
  halo?: number;
  /** Fraction for a two-slice pie (allele frequency maps). */
  pie?: number;
  label?: string;
  hollow?: boolean;
  origin?: string;
  tip?: () => Child;
  onClick?: () => void;
}

export interface MapOptions { width: number; latTop?: number; latBottom?: number; graticule?: boolean; labelSize?: number; animate?: boolean; pointScale?: number }

export function worldMap(input: MapPoint[], o: MapOptions): SVGSVGElement {
  const W = o.width;
  // Smaller maps get smaller points, so the halos of the leading populations do not swamp them.
  const points = o.pointScale && o.pointScale !== 1 ? input.map((p) => ({ ...p, r: p.r * o.pointScale! })) : input;
  const proj = geoEqualEarth().fitWidth(W, { type: "Sphere" });
  const top = proj([0, o.latTop ?? 72])![1], bottom = proj([0, o.latBottom ?? -44])![1];
  const path = geoPath(proj);

  // Place points, then push apart any that sit on top of each other (the UK hosts three samples).
  const placed = points.map((p) => {
    const [x, y] = proj([p.lon, p.lat])!;
    return { p, x, y, x0: x, y0: y };
  });
  const groups = new Map<string, typeof placed>();
  for (const q of placed) {
    const k = `${Math.round(q.x / 6)}:${Math.round(q.y / 6)}`;
    const g = groups.get(k) ?? [];
    g.push(q);
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const rad = Math.max(...g.map((q) => q.p.r)) * 1.25 + 3;
    g.forEach((q, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / g.length; q.x = q.x0 + rad * Math.cos(a); q.y = q.y0 + rad * Math.sin(a); });
  }

  // Crop to the chosen latitudes and clip there (charts otherwise let SVG overflow, and Antarctica
  // would spill into the legend), with just enough room above for the northernmost points' halos.
  const reach = Math.min(...placed.map((q) => q.y - q.p.r * (q.p.halo !== undefined ? 2.4 : 1) - 2));
  const y0 = Math.min(top, reach), H = bottom - y0;
  const svg = s("svg", { viewBox: `0 ${y0} ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "World map of reference populations", style: "overflow:hidden" });
  if (o.graticule) svg.append(s("path", { d: path(geoGraticule10()) ?? "", class: "graticule" }));
  svg.append(s("path", { d: path(land) ?? "", class: "land" }));

  const lines = s("g", { class: "leaders" });
  const dots = s("g");
  const labels = s("g");
  for (const q of placed) {
    const { p } = q;
    if (q.x !== q.x0 || q.y !== q.y0) lines.append(s("line", { x1: q.x0, y1: q.y0, x2: q.x, y2: q.y, stroke: "var(--ink-3)", "stroke-width": 0.8 }));
    if (p.origin && ORIGIN_NAME[p.origin]) {
      const c = countries.features.find((f) => f.properties.name === ORIGIN_NAME[p.origin!]);
      if (c) {
        const [ox, oy] = proj(geoCentroid(c))!;
        lines.append(s("path", { d: `M${q.x},${q.y} Q${(q.x + ox) / 2},${Math.min(q.y, oy) - 40} ${ox},${oy}`, fill: "none", stroke: p.color, "stroke-width": 1.2, "stroke-dasharray": "3 3", opacity: 0.7 }));
        lines.append(s("rect", { x: ox - 3, y: oy - 3, width: 6, height: 6, transform: `rotate(45 ${ox} ${oy})`, fill: p.color, opacity: 0.8 }));
      }
    }
    const order = placed.indexOf(q);
    const g = s("g", { class: o.animate ? "pt pop" : "pt", style: `${p.onClick ? "cursor:pointer;" : ""}${o.animate ? `animation-delay:${order * 28}ms` : ""}`, onClick: p.onClick });
    if (p.halo !== undefined) g.append(s("circle", { cx: q.x, cy: q.y, r: p.r * 2.4, fill: p.color, opacity: 0.12 + 0.4 * p.halo }));
    if (p.pie !== undefined) {
      const f = Math.max(0, Math.min(1, p.pie));
      g.append(s("circle", { cx: q.x, cy: q.y, r: p.r, fill: "var(--card)", stroke: p.color, "stroke-width": 1.2 }));
      if (f >= 0.999) g.append(s("circle", { cx: q.x, cy: q.y, r: p.r, fill: p.color }));
      else if (f > 0.001) {
        const a = f * 2 * Math.PI, x1 = q.x + p.r * Math.sin(a), y1 = q.y - p.r * Math.cos(a);
        g.append(s("path", { d: `M${q.x},${q.y} L${q.x},${q.y - p.r} A${p.r},${p.r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1},${y1} Z`, fill: p.color }));
      }
    } else if (p.hollow) {
      g.append(s("circle", { cx: q.x, cy: q.y, r: p.r, fill: "var(--card)", stroke: p.color, "stroke-width": 2, opacity: p.opacity ?? 1 }));
    } else {
      g.append(s("circle", { cx: q.x, cy: q.y, r: p.r, fill: p.color, stroke: "var(--card)", "stroke-width": 1.2, opacity: p.opacity ?? 1 }));
    }
    // A generous invisible target for touch.
    g.append(s("circle", { cx: q.x, cy: q.y, r: Math.max(12, p.r + 4), fill: "transparent" }));
    if (p.tip) tip(g, p.tip);
    dots.append(g);
    if (p.label) {
      const size = o.labelSize ?? 11;
      labels.append(s("text", { x: q.x + p.r + 4, y: q.y + size * 0.35, class: "ann", "font-size": size, "paint-order": "stroke", stroke: "var(--card)", "stroke-width": 3, "stroke-linejoin": "round" }, p.label));
    }
  }
  svg.append(lines, dots, labels);
  return svg;
}
