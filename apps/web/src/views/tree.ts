/** Family tree: a GEDCOM as a fan chart, the relationship between any two people, and what DNA that predicts. */
import { ahnentafel, demoGedcom, findRelationship, gedcomStats, matrilineage, parentsOf, parseGedcom, patrilineage, type GedcomFile, type Individual } from "@lineage/core";
import { h, s, fmt, clear, icon } from "../lib/dom.js";
import { state, update } from "../lib/store.js";
import { figure, responsive, segmented } from "../charts/common.js";
import { fanChart, type FanMode } from "../charts/fan.js";
import { simSummary } from "../lib/reference.js";
import { cite } from "../lib/citations.js";

let focus: string | undefined;
let mode: FanMode = "side";
let generations = 4;
let pairA: string | undefined;
let pairB: string | undefined;

export function tree(): HTMLElement {
  const g = state.gedcom;
  if (!g) return emptyTree();
  const file = g.file;
  const people = [...file.individuals.values()].sort((a, b) => (a.surname ?? "").localeCompare(b.surname ?? "") || a.name.localeCompare(b.name));
  focus = focus && file.individuals.has(focus) ? focus : defaultFocus(file);
  pairA = pairA && file.individuals.has(pairA) ? pairA : focus;
  pairB = pairB && file.individuals.has(pairB) ? pairB : defaultOther(file, pairA!);
  const st = gedcomStats(file, 8);

  const fanBox = h("div");
  const drawFan = () => {
    const entries = ahnentafel(file, focus!, generations);
    const places = [...new Set(entries.map((e) => country(e.individual.birth?.place)).filter(Boolean))] as string[];
    const PAL = ["var(--c-EUR)", "var(--c-AFR)", "var(--c-EAS)", "var(--c-NAT)", "var(--c-SAS)", "var(--brick)", "var(--gold)", "var(--navy)", "var(--ink-3)"];
    const colorOfCountry = (p?: string) => { const c = country(p); const i = c ? places.indexOf(c) : -1; return i < 0 ? "var(--paper-2)" : `color-mix(in srgb, ${PAL[i % PAL.length]} 55%, var(--card))`; };
    clear(fanBox, responsive((w) => fanChart({ width: w, entries, generations, mode, onPick: (id) => { focus = id; drawFan(); }, countryColor: colorOfCountry })),
      mode === "country" ? h("div", { class: "legend", style: "margin-top:10px" }, ...places.slice(0, 9).map((p) => h("span", {}, h("i", { class: "swatch", style: `background:${colorOfCountry(p)}` }), p))) : null,
      mode === "dna" ? h("p", { class: "chart-note" }, "Darker rings are ancestors you expect more DNA from: 50% from each parent, 25% from each grandparent, halving every generation. Dashed rings are far enough back that an ancestor may have passed you nothing at all.") : null);
  };
  drawFan();
  const focusSelect = personSelect(people, focus!, (id) => { focus = id; drawFan(); });

  const relBox = h("div");
  const drawRel = () => clear(relBox, relationshipPanel(file, pairA!, pairB!));
  drawRel();

  const m = matrilineage(file, focus!), p = patrilineage(file, focus!);
  const focusPerson = file.individuals.get(focus!)!;

  return h("div", { class: "fade-in" },
    h("div", { class: "page-head" },
      h("p", { class: "kicker" }, g.name.includes("Demo") ? "Family tree · demo" : "Family tree"),
      h("h1", { class: "h1" }, `${fmt.int(st.individuals)} people, `, h("em", {}, st.earliestBirthYear ? `${st.earliestBirthYear} to ${st.latestBirthYear}` : `${fmt.int(st.families)} families`)),
      h("div", { class: "subject" }, h("span", { class: "pill navy" }, g.name), file.version ? h("span", { class: "pill" }, `GEDCOM ${file.version}`) : null, h("span", { class: "pill" }, `${fmt.int(st.families)} families`), h("span", { class: `pill ${file.warnings.length ? "warn" : "good"}` }, file.warnings.length ? `${file.warnings.length} integrity warnings` : "links check out"),
        h("button", { class: "btn ghost small", type: "button", onClick: () => { update({ gedcom: undefined }); } }, "Open another tree"))),
    h("div", { class: "stack-l" },
      figure({
        kicker: "Fig. 1 · Ancestors",
        title: `${focusPerson.name}'s ancestors, ${generations} generations back`,
        caption: "Father's side on the left, mother's on the right, each ring one generation further back. Click an ancestor to put them at the centre.",
        tools: h("div", { class: "row" }, focusSelect,
          segmented<FanMode>([["side", "By side"], ["dna", "Expected DNA"], ["country", "Birth country"]], mode, (v) => { mode = v; drawFan(); }),
          segmented<string>([["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]], String(generations), (v) => { generations = Number(v); drawFan(); })),
        body: fanBox,
        foot: "Ahnentafel numbering: 1 is the centre, 2n is the father of n, 2n + 1 the mother.",
      }),
      figure({
        kicker: "Fig. 2 · Relationship calculator",
        title: "How any two people in the tree are related, and what DNA that predicts",
        tools: h("div", { class: "row" }, personSelect(people, pairA!, (id) => { pairA = id; drawRel(); }), h("span", { class: "faded" }, "and"), personSelect(people, pairB!, (id) => { pairB = id; drawRel(); })),
        body: relBox,
        foot: h("span", {}, "Coefficient of relationship r sums (1/2)^(n) over every path through the nearest common ancestors; expected sharing treats paths through different parents as independent. Distributions: the Lineage relationship simulation; ranges: ", cite("sharedcm2020"), "."),
      }),
      h("div", { class: "grid g2", style: "align-items:start" },
        h("div", { class: "card" },
          h("p", { class: "kicker" }, "Direct lines"),
          h("h3", { class: "h3" }, "Mitochondrial line"), h("p", { class: "small faded", style: "margin:2px 0 8px" }, "Mother's mother's mother: the line mtDNA follows."),
          lineChips(m),
          h("h3", { class: "h3", style: "margin-top:16px" }, "Y line"), h("p", { class: "small faded", style: "margin:2px 0 8px" }, focusPerson.sex === "F" ? "Father's father's line; a woman does not carry a Y chromosome, but her father did." : "Father's father's father: the line the Y chromosome follows."),
          lineChips(p)),
        h("div", { class: "card" },
          h("p", { class: "kicker navy" }, "The tree in numbers"),
          births(file),
          h("div", { class: "grid g2", style: "margin-top:12px" },
            h("div", {}, h("p", { class: "h3" }, "Surnames"), h("ul", { class: "small muted", style: "margin:6px 0 0;padding-left:18px" }, ...st.surnames.map((x) => h("li", {}, `${x.surname} (${x.count})`)))),
            h("div", {}, h("p", { class: "h3" }, "Places"), h("ul", { class: "small muted", style: "margin:6px 0 0;padding-left:18px" }, ...st.places.slice(0, 8).map((x) => h("li", {}, `${x.place} (${x.count})`))))),
          file.warnings.length ? h("details", { class: "more" }, h("summary", {}, "Integrity warnings"), h("ul", { class: "small" }, ...file.warnings.slice(0, 40).map((w) => h("li", {}, w)))) : null))));
}

function emptyTree(): HTMLElement {
  const input = h("input", { type: "file", accept: ".ged,.gedcom,.txt", "aria-label": "Open a GEDCOM file" });
  input.addEventListener("change", async () => {
    const f = input.files?.[0];
    if (!f) return;
    try { const text = await f.text(); update({ gedcom: { file: parseGedcom(text), name: f.name, text } }); } catch (e) { update({ error: `Could not read that GEDCOM: ${(e as Error).message}` }); }
  });
  return h("div", { class: "empty fade-in" },
    h("p", { class: "kicker" }, "Family tree"),
    h("h1", { class: "h2" }, "Your tree as a fan chart, with the maths of every relationship"),
    h("p", { class: "lede" }, "Export a GEDCOM (.ged) from Ancestry, MyHeritage, FamilySearch, Gramps or any genealogy program and open it here. It is read in this tab and never uploaded."),
    h("div", { class: "row", style: "justify-content:center" },
      h("label", { class: "btn primary", style: "position:relative;overflow:hidden" }, icon("tree"), "Open a GEDCOM file", (() => { input.setAttribute("style", "position:absolute;inset:0;opacity:0;cursor:pointer"); return input; })()),
      h("button", { class: "btn secondary", type: "button", onClick: () => { const text = demoGedcom(); update({ gedcom: { file: parseGedcom(text), name: "Demo family tree", text } }); } }, icon("family"), "Open the demo tree")));
}

function defaultFocus(file: GedcomFile): string {
  if (file.individuals.has("@I17@")) return "@I17@";
  let best = [...file.individuals.keys()][0]!, n = -1;
  for (const id of file.individuals.keys()) { const k = ahnentafel(file, id, 6).length; if (k > n) { n = k; best = id; } }
  return best;
}
function defaultOther(file: GedcomFile, a: string): string {
  if (a === "@I17@" && file.individuals.has("@I19@")) return "@I19@";
  for (const id of file.individuals.keys()) if (id !== a && findRelationship(file, a, id)) return id;
  return a;
}

function personSelect(people: Individual[], value: string, onChange: (id: string) => void): HTMLSelectElement {
  const sel = h("select", { class: "select", style: "max-width:240px" }, ...people.map((p) => h("option", { value: p.id, selected: p.id === value }, `${p.name}${p.birth?.year ? ` (${p.birth.year})` : ""}`)));
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function relationshipPanel(file: GedcomFile, a: string, b: string): HTMLElement {
  const A = file.individuals.get(a)!, B = file.individuals.get(b)!;
  if (a === b) return h("p", { class: "muted" }, "Pick two different people.");
  const r = findRelationship(file, a, b);
  if (!r) return h("div", { class: "note" }, `${A.name} and ${B.name} share no recorded ancestor in this tree. They may still be related through people the tree does not contain.`);
  const path = r.paths[0]!;
  const chainA = chain(file, a, path.ancestorId!, path.up), chainB = chain(file, b, path.ancestorId!, path.down);
  const expectedCm = r.math.expectedHalfIdenticalFraction * 3485;
  const box = h("div", { class: "grid g-side", style: "align-items:start" });
  const left = h("div", {},
    h("p", { class: "kicker" }, "In the tree"),
    h("h3", { class: "h2", style: "margin-bottom:10px" }, `${B.name} is ${A.name}'s ${r.description}`),
    h("div", { class: "pathline", style: "margin:10px 0 16px" },
      ...chainA.flatMap((p, i) => [h("span", { class: `node${i === 0 ? " end" : ""}` }, p.name), h("span", { class: "arrow" }, "→")]).slice(0, -1),
      ...(chainB.length > 1 ? [h("span", { class: "arrow" }, "←"), ...chainB.slice(0, -1).reverse().flatMap((p, i, arr) => [h("span", { class: `node${i === arr.length - 1 ? " end" : ""}` }, p.name), i < arr.length - 1 ? h("span", { class: "arrow" }, "←") : null])] : [])),
    h("div", { class: "stats" },
      h("div", { class: "stat" }, h("div", { class: "label" }, "Coefficient r"), h("div", { class: "value" }, r.math.coefficientOfRelationship.toFixed(4)), h("div", { class: "sub" }, "Share of genes identical by descent")),
      h("div", { class: "stat" }, h("div", { class: "label" }, "Expected DNA"), h("div", { class: "value" }, fmt.pct(r.math.expectedHalfIdenticalFraction, 1)), h("div", { class: "sub" }, `≈ ${fmt.int(expectedCm)} cM of a 3,485 cM genome`)),
      h("div", { class: "stat" }, h("div", { class: "label" }, "Common ancestors"), h("div", { class: "value", style: "font-size:17px" }, r.commonAncestors.map((id) => file.individuals.get(id)?.name ?? id).join(" & ")), h("div", { class: "sub" }, `${r.paths.length} path${r.paths.length === 1 ? "" : "s"}`))));
  const right = h("div", {}, h("div", { class: "loading" }, h("div", { class: "spinner" })));
  simSummary().then((sim) => {
    const up = Math.min(path.up, path.down), down = Math.max(path.up, path.down);
    const half = r.description.startsWith("half");
    const rel = sim.relationships.find((x) => Math.min(x.up, x.down) === up && Math.max(x.up, x.down) === down && x.half === half);
    if (!rel) { clear(right, h("p", { class: "small faded" }, "This relationship is outside the simulated set.")); return; }
    clear(right,
      h("p", { class: "kicker navy" }, "What DNA would show"),
      h("p", { class: "small muted" }, `Simulated ${rel.label.toLowerCase()} pairs share ${fmt.int(rel.summary.p01)}–${fmt.int(rel.summary.p99)} cM in 98% of cases (mean ${fmt.int(rel.summary.meanCm)}, ${fmt.num(rel.summary.meanSegments, 1)} segments)${rel.summary.noSharing > 0.01 ? `; ${fmt.pct(rel.summary.noSharing, 0)} share nothing detectable` : ""}.`),
      responsive((w) => miniHist(rel.totalCm, rel.segments, w, rel.sharedCmV4)),
      rel.sharedCmV4 ? h("p", { class: "small faded", style: "margin-top:6px" }, `Shared cM Project: average ${fmt.int(rel.sharedCmV4.average)}, observed ${fmt.int(rel.sharedCmV4.min)}–${fmt.int(rel.sharedCmV4.max)} cM.`) : null);
  });
  box.append(left, right);
  return box;
}

function chain(file: GedcomFile, from: string, ancestor: string, depth: number): Individual[] {
  const walk = (id: string, d: number): string[] | undefined => {
    if (d === 0) return id === ancestor ? [id] : undefined;
    const { father, mother } = parentsOf(file, id);
    for (const p of [father, mother]) { if (!p) continue; const rest = walk(p, d - 1); if (rest) return [id, ...rest]; }
    return undefined;
  };
  return (walk(from, depth) ?? [from]).map((id) => file.individuals.get(id)!).filter(Boolean);
}

function miniHist(totals: number[], segments: number[], width: number, v4?: { min: number; max: number }): SVGSVGElement {
  const W = width, H = 110, max = Math.max(...totals, v4?.max ?? 0, 50);
  const bins = 40, counts = new Array<number>(bins).fill(0);
  let none = 0;
  totals.forEach((t, i) => { if (segments[i] === 0) none++; else counts[Math.min(bins - 1, Math.floor((t / max) * bins))]!++; });
  const peak = Math.max(...counts, 1);
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const bw = (W - 10) / bins;
  counts.forEach((c, i) => svg.append(s("rect", { x: 5 + i * bw, y: 80 - (c / peak) * 70, width: Math.max(1, bw - 1), height: (c / peak) * 70, fill: "var(--navy)", opacity: 0.7 })));
  if (v4) svg.append(s("line", { x1: 5 + (v4.min / max) * (W - 10), x2: 5 + (Math.min(v4.max, max) / max) * (W - 10), y1: 88, y2: 88, stroke: "var(--brick)", "stroke-width": 2.5 }));
  svg.append(s("text", { x: 5, y: 104, class: "lbl", "font-size": 10 }, "0"), s("text", { x: W - 5, y: 104, "text-anchor": "end", class: "lbl", "font-size": 10 }, `${fmt.int(max)} cM`));
  if (none) svg.append(s("text", { x: W / 2, y: 104, "text-anchor": "middle", class: "lbl", "font-size": 10 }, `${fmt.pct(none / totals.length, 0)} share none`));
  return svg;
}

function lineChips(people: Individual[]): HTMLElement {
  return h("div", { class: "pathline" }, ...people.flatMap((p, i) => [h("span", { class: `node${i === 0 ? " end" : ""}`, title: p.birth?.place ?? "" }, `${p.name}${p.birth?.year ? ` · ${p.birth.year}` : ""}`), i < people.length - 1 ? h("span", { class: "arrow" }, "→") : null]));
}

function births(file: GedcomFile): HTMLElement {
  const years = [...file.individuals.values()].map((i) => i.birth?.year).filter((y): y is number => !!y);
  if (!years.length) return h("p", { class: "small faded" }, "No birth years recorded.");
  const lo = Math.floor(Math.min(...years) / 10) * 10, hi = Math.floor(Math.max(...years) / 10) * 10;
  const decades: Array<[number, number]> = [];
  for (let d = lo; d <= hi; d += 10) decades.push([d, years.filter((y) => y >= d && y < d + 10).length]);
  const peak = Math.max(...decades.map((d) => d[1]));
  return h("div", {}, h("p", { class: "h3" }, "Births by decade"),
    h("div", { style: `display:grid;grid-template-columns:repeat(${decades.length},1fr);gap:3px;align-items:end;height:70px;margin-top:8px` },
      ...decades.map(([d, n]) => h("div", { title: `${d}s: ${n}`, style: `height:${Math.max(4, (n / peak) * 100)}%;background:${n ? "var(--navy)" : "var(--rule)"};border-radius:3px 3px 0 0;opacity:${n ? 0.8 : 0.4}` }))),
    h("div", { class: "row between tiny faded mono", style: "margin-top:4px" }, h("span", {}, `${lo}s`), h("span", {}, `${hi}s`)));
}

function country(place?: string): string | undefined {
  if (!place) return undefined;
  const parts = place.split(",").map((x) => x.trim()).filter(Boolean);
  return parts[parts.length - 1];
}

