/**
 * Relatives: two files compared directly, a match list read from a vendor
 * export, a centimorgan calculator, and an inheritance simulator. Every
 * relationship estimate is a probability under a stated simulation model,
 * shown next to the empirical ranges of the Shared cM Project.
 */
import { h, s, fmt, tip, clear, icon } from "../lib/dom.js";
import { state, update, refresh } from "../lib/store.js";
import { call } from "../lib/engine.js";
import { figure, responsive } from "../charts/common.js";
import { chromosomeChart, AUTOSOME_NAMES } from "../charts/chromosomes.js";
import { probabilityBars, ridgelines } from "../charts/relationship.js";
import { cite, paperUrl } from "../lib/citations.js";
import { dropZone } from "./home.js";
import type { CompareView, MatchRow, Posterior, DistributionSketch, SimulatedView } from "../lib/protocol.js";

type Tab = "compare" | "matches" | "calculator" | "simulator";
let tab: Tab = "compare";
let selectedMatch: string | undefined;
let revealed = new Set<string>();
const TRUTH_LABEL: Record<string, string> = { parent: "Parent or child", sibling: "Full sibling", "aunt-uncle": "Aunt, uncle, niece or nephew", "1C": "First cousin", "2C": "Second cousin", "2C1R": "Second cousin once removed", "3C": "Third cousin", "3C1R": "Third cousin once removed", "4C": "Fourth cousin", "half-1C": "Half first cousin", "1C1R": "First cousin once removed", unrelated: "Unrelated" };

export function relatives(): HTMLElement {
  const body = h("div");
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const draw = () => {
    clear(tabs, ...([["compare", "Compare two files"], ["matches", "Match list"], ["calculator", "cM calculator"], ["simulator", "Inheritance simulator"]] as Array<[Tab, string]>)
      .map(([k, label]) => h("button", { role: "tab", "aria-selected": String(tab === k), type: "button", onClick: () => { tab = k; draw(); } }, label)));
    clear(body, tab === "compare" ? compareTab() : tab === "matches" ? matchesTab() : tab === "calculator" ? calculatorTab() : simulatorTab());
  };
  draw();
  return h("div", { class: "fade-in" },
    h("div", { class: "page-head" },
      h("p", { class: "kicker" }, "Relatives"),
      h("h1", { class: "h1" }, "Shared DNA, and ", h("em", {}, "the odds of each relationship")),
      h("p", { class: "lede" }, "Segments are measured in centimorgans on the HapMap genetic map. Relationship probabilities come from 46,000 simulated pairs of relatives and are shown beside the crowd-sourced Shared cM Project ranges.")),
    tabs, body);
}

/* ------------------------------------------------------------------ */
/* Compare                                                             */
/* ------------------------------------------------------------------ */
function compareTab(): HTMLElement {
  const out = h("div");
  if (!state.you) return h("div", { class: "note" }, "Open your own file first (from the ", h("a", { href: "#/" }, "front page"), "), or use the demo family. The comparison needs two files.");
  const run = async (slot: string, name: string) => {
    update({ busy: { label: `Comparing with ${name}`, fraction: 0.3 } });
    try {
      const view = await call("compare", { a: "you", b: slot }, (st, f) => update({ busy: { label: st, fraction: f } }));
      update({ compare: view, other: { slot, name }, busy: undefined });
    } catch (e) { update({ busy: undefined, error: (e as Error).message }); }
  };
  const chooser = state.demo
    ? h("div", { class: "card" },
        h("p", { class: "kicker navy" }, "Demo family"),
        h("h3", { class: "h3" }, "Compare Leo with someone"),
        h("div", { class: "row", style: "margin-top:12px" }, ...state.demo.kits.map((k) => h("button", { class: `btn ${state.other?.slot === k.slot ? "primary" : "secondary"} small`, type: "button", onClick: () => void run(k.slot, k.name) }, k.name))),
        h("p", { class: "small faded", style: "margin:12px 0 0" }, "Their relationships are hidden in the results until you choose to reveal them."))
    : h("div", { class: "card" },
        h("p", { class: "kicker navy" }, "Second file"),
        dropZone(async (f) => {
          update({ busy: { label: "Reading the second file", fraction: 0.1 } });
          try { await call("loadFile", { slot: "other", file: f, name: f.name }, (st, fr) => update({ busy: { label: st, fraction: fr } })); await run("other", f.name); }
          catch (e) { update({ busy: undefined, error: (e as Error).message }); }
        }, "Open a relative's raw data file", "It is compared with yours in this tab. Neither file leaves the device."));
  out.append(chooser);
  if (state.compare && state.other) out.append(h("div", { class: "stack-l", style: "margin-top:28px" }, ...compareResult(state.compare, state.other.name, state.other.slot)));
  return out;
}

function compareResult(c: CompareView, name: string, slot: string): HTMLElement[] {
  const best = c.posteriors[0]!;
  const truth = state.demo ? demoTruth(slot) : undefined;
  const reveal = truth ? revealButton(slot, truth) : null;
  const headline = h("div", { class: "card" },
    h("div", { class: "grid g-side", style: "align-items:center" },
      h("div", {},
        h("p", { class: "kicker" }, `${state.you?.demo ? "Leo" : "You"} and ${name}`),
        h("div", { class: "headline-number" }, fmt.int(c.totalCm), h("small", {}, "cM shared")),
        h("p", { class: "muted", style: "margin:10px 0 0" }, `${c.segments} segments of 7 cM or more, the longest ${fmt.cm(c.longestCm)}. `, c.fullCm > 0 ? `${fmt.int(c.fullCm)} cM is shared on both copies (fully identical), which only full siblings and double relatives do. ` : "No fully identical stretches. ", `Opposite homozygotes at ${fmt.pct(c.oppositeHomozygousRate, 2)} of ${fmt.int(c.comparableSnps)} SNPs.`),
        reveal),
      h("div", {},
        h("p", { class: "kicker navy" }, "Most likely"),
        h("h3", { class: "h2", style: "margin-bottom:10px" }, best.label, h("span", { class: "faded", style: "font-size:.6em;margin-left:8px" }, fmt.prob(best.probability))),
        probabilityBars(c.posteriors, { limit: 5, truth: truth && revealed.has(slot) ? truth : undefined }))));
  const ridge = figure({
    kicker: "Fig. 1 · Where this total falls",
    title: `${fmt.int(c.totalCm)} cM against the simulated range of each candidate`,
    caption: "Shaded: how often 2,000 simulated pairs of each relationship share each amount (50 cM bins). Brick bracket: the lowest and highest totals in the Shared cM Project. Dashed line: this pair. The probabilities above also use the number of segments and the fully identical total, which the shapes here leave out.",
    body: responsive((w) => ridgelines(c.sketches, c.totalCm, w)),
    foot: h("span", {}, "Model: ", h("a", { href: paperUrl("pedsim2019"), target: "_blank", rel: "noopener" }, "pedigree simulation as in Ped-sim"), ", Haldane crossovers on the HapMap II map, 7 cM threshold, equal prior for each relationship. Ranges: ", h("a", { href: paperUrl("sharedcm2020"), target: "_blank", rel: "noopener" }, cite("sharedcm2020")), "."),
  });
  const segFig = figure({
    kicker: "Fig. 2 · The segments",
    title: `${c.segments} shared segments, ${c.full.length ? `${c.full.length} of them on both copies in places` : "all on one copy"}`,
    caption: "Rows are autosomes drawn to genetic length. Navy: half identical (one copy shared). Brick with hatching: fully identical (both copies shared). The number at the end of each row is the cM shared on it.",
    body: h("div", {}, responsive((w) => chromosomeChart({
      width: w, right: (ch) => { const t = c.half.filter((x) => x.chrom === ch).reduce((a, x) => a + x.cm, 0); return t ? `${fmt.num(t, 0)} cM` : "–"; },
      tracks: [{ draw: (ch, g, x, y, hh) => {
        for (const sgm of c.half.filter((q) => q.chrom === ch)) { const el = s("rect", { x: x(sgm.start), y, width: Math.max(2, x(sgm.end) - x(sgm.start)), height: hh, fill: "var(--half)", rx: 2 }); tip(el, () => segTip(ch, sgm)); g.append(el); }
        for (const sgm of c.full.filter((q) => q.chrom === ch)) { const el = s("rect", { x: x(sgm.start), y: y + 2, width: Math.max(2, x(sgm.end) - x(sgm.start)), height: hh - 4, fill: "url(#hatch)", rx: 2 }); tip(el, () => segTip(ch, sgm, true)); g.append(el); }
      } }],
    })), h("div", { class: "legend", style: "margin-top:10px" }, h("span", {}, h("i", { class: "swatch", style: "background:var(--half)" }), "half identical"), h("span", {}, h("i", { class: "swatch", style: "background:var(--full)" }), "fully identical"))),
    foot: h("span", {}, "Detected directly from both genotype files: runs with no opposite homozygotes (a small error budget allowed), at least 7 cM."),
  });
  const table = h("details", { class: "more" }, h("summary", {}, `All ${c.half.length + c.full.length} segments as a table`),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", {}, h("tr", {}, h("th", {}, "Chr"), h("th", { class: "n" }, "Start"), h("th", { class: "n" }, "End"), h("th", { class: "n" }, "cM"), h("th", { class: "n" }, "SNPs"), h("th", {}, "Kind"))),
      h("tbody", {}, ...[...c.half.map((x) => ({ ...x, k: "half" })), ...c.full.map((x) => ({ ...x, k: "full" }))].sort((a, b) => AUTOSOME_NAMES.indexOf(a.chrom) - AUTOSOME_NAMES.indexOf(b.chrom) || a.start - b.start)
        .map((x) => h("tr", {}, h("td", {}, x.chrom), h("td", { class: "n mono" }, fmt.bp(x.start)), h("td", { class: "n mono" }, fmt.bp(x.end)), h("td", { class: "n mono" }, fmt.num(x.cm, 1)), h("td", { class: "n mono" }, fmt.int(x.snps)), h("td", {}, x.k === "full" ? "fully identical" : "half identical")))))));
  segFig.querySelector(".fig-body")!.append(table);
  return [headline, ridge, segFig, howSure()];
}

function segTip(ch: string, sgm: { start: number; end: number; cm: number; snps: number }, full = false) {
  return h("span", {}, h("b", {}, `chr${ch} · ${fmt.cm(sgm.cm)}`), h("br"), `${full ? "Fully" : "Half"} identical, ${fmt.int(sgm.snps)} SNPs`, h("br"), h("span", { class: "mono" }, `${fmt.bp(sgm.start)}–${fmt.bp(sgm.end)}`));
}

function demoTruth(slot: string): string | undefined {
  const id = slot.replace("demo:", "");
  const role = state.demo?.people.find((p) => p.id === id)?.role;
  return ({ Mother: "parent", Father: "parent", Sister: "sibling", Aunt: "aunt-uncle", "First cousin": "1C", Unrelated: "unrelated" } as Record<string, string>)[role ?? ""];
}

function revealButton(key: string, truth: string): HTMLElement {
  const box = h("div", { style: "margin-top:12px" });
  const draw = () => clear(box, revealed.has(key)
    ? h("span", { class: "pill good" }, icon("check"), `In the demo we know the answer: ${TRUTH_LABEL[truth] ?? truth}`)
    : h("button", { class: "btn ghost small", type: "button", onClick: () => { revealed.add(key); draw(); refresh(); } }, "Reveal the true relationship"));
  draw();
  return box;
}

function howSure(): HTMLElement {
  return h("details", { class: "card flat more", style: "border-top:1px solid var(--rule)" },
    h("summary", {}, "How sure is this?"),
    h("div", { class: "small muted stack", style: "margin-top:8px" },
      h("p", {}, "The probabilities compare the listed relationships with each other, assuming each was equally likely before looking at the DNA. In real families some are far more common than others: most people have many more third cousins than half siblings."),
      h("p", {}, "The simulation places crossovers at random along the sex-averaged HapMap map. Real crossovers repel each other (interference) and differ between mothers and fathers, which makes real segment counts a little less variable than simulated ones. ", h("a", { href: paperUrl("pedsim2019"), target: "_blank", rel: "noopener" }, cite("pedsim2019")), " show both effects matter for close relatives."),
      h("p", {}, "The simulator's means match the Shared cM Project's averages for close relatives to within 2%. For distant cousins the crowd-sourced averages are higher, because pairs who share nothing never appear in a match list and small false segments inflate totals; the Evidence page shows the comparison."),
      h("p", { style: "margin:0" }, "Segments under 7 cM are not counted: most small segments in unphased data are false (", h("a", { href: paperUrl("ersa2011"), target: "_blank", rel: "noopener" }, cite("ersa2011")), " model the background of false sharing explicitly).")));
}

/* ------------------------------------------------------------------ */
/* Match list                                                          */
/* ------------------------------------------------------------------ */
function matchesTab(): HTMLElement {
  const out = h("div");
  const load = async (csv: string, name: string) => {
    update({ busy: { label: "Reading the match list", fraction: 0.3 } });
    try {
      const view = await call("matches", { csv, truth: state.demo?.truth });
      selectedMatch = view.rows[0]?.match;
      update({ matches: view, matchesName: name, busy: undefined });
    } catch (e) { update({ busy: undefined, error: (e as Error).message }); }
  };
  if (!state.matches && state.demo) { void load(state.demo.segmentsCsv, "Leo's match list (demo)"); return h("div", { class: "loading" }, h("div", { class: "spinner" })); }
  out.append(h("div", { class: "grid g2", style: "align-items:start" },
    h("div", { class: "card" },
      h("p", { class: "kicker navy" }, "Segment export"),
      dropZone(async (f) => load(await f.text(), f.name), "Open a matching-segments file", "A CSV from GEDmatch, FamilyTreeDNA, MyHeritage, 23andMe or DNA Painter. Read in this tab only.")),
    h("div", { class: "card flat" },
      h("p", { class: "kicker" }, "Where to get one"),
      h("p", { class: "small muted" }, "FamilyTreeDNA and GEDmatch export every match's segments in one file. MyHeritage and Living DNA export per match. Ancestry does not export segments. Lineage recognises the column names each of them uses."),
      state.demo ? h("button", { class: "btn secondary small", type: "button", onClick: () => void load(state.demo!.segmentsCsv, "Leo's match list (demo)") }, "Reload the demo match list") : null)));
  const m = state.matches;
  if (!m) return out;
  const selected = m.rows.find((r) => r.match === selectedMatch) ?? m.rows[0];
  const PALETTE = ["var(--navy)", "var(--brick)", "var(--c-EAS)", "var(--c-SAS)", "var(--c-NAT)", "var(--c-AFR)", "var(--gold)"];
  const colorOf = new Map(m.rows.slice(0, 7).map((r, i) => [r.match, PALETTE[i]!]));
  const table = h("div", { class: "table-wrap" }, h("table", { class: "data" },
    h("thead", {}, h("tr", {}, h("th", {}, "Match"), h("th", { class: "n" }, "cM"), h("th", { class: "n" }, "Segments ≥7"), h("th", { class: "n" }, "Longest"), h("th", {}, "Most likely"), h("th", { class: "n" }, "Prob."))),
    h("tbody", {}, ...m.rows.map((r) => h("tr", { class: r.match === selected?.match ? "sel" : "", style: "cursor:pointer", onClick: () => { selectedMatch = r.match; refresh(); } },
      h("td", {}, colorOf.has(r.match) ? h("i", { class: "swatch", style: `background:${colorOf.get(r.match)}` }) : h("i", { class: "swatch", style: "background:var(--rule)" }), r.match),
      h("td", { class: "n mono" }, fmt.num(r.autosomalCm, 0)), h("td", { class: "n mono" }, String(r.segmentsOver7)), h("td", { class: "n mono" }, fmt.num(r.longestCm, 1)),
      h("td", {}, r.posteriors[0]?.label ?? "–"), h("td", { class: "n mono" }, r.posteriors[0] ? fmt.prob(r.posteriors[0].probability) : "–"))))));
  const overlay = figure({
    kicker: "Fig. 1 · Where your matches share DNA with you",
    title: `${m.rows.length} matches, ${m.segments.length} segments`,
    caption: "The seven closest matches in their own colours, the rest in grey. Overlapping segments from different matches can point to a shared ancestor on that stretch, but only if those matches also match each other.",
    body: h("div", {}, responsive((w) => chromosomeChart({
      width: w, rowH: w < 520 ? 16 : 20, gap: 7,
      tracks: [{ draw: (ch, g, x, y, hh) => {
        const segs = m.segments.filter((q) => q.chrom === ch && q.cm >= 7);
        const lanes: number[] = [];
        for (const sg of [...segs].sort((a, b) => a.start - b.start)) {
          let lane = lanes.findIndex((end) => end < sg.start);
          if (lane < 0) { lane = lanes.length; lanes.push(0); }
          lanes[lane] = sg.end;
          const nl = Math.max(3, lanes.length);
          const el = s("rect", { x: x(sg.start), y: y + (lane % nl) * (hh / nl), width: Math.max(2, x(sg.end) - x(sg.start)), height: hh / nl - 0.5, fill: colorOf.get(sg.match) ?? "var(--ink-3)", opacity: colorOf.has(sg.match) ? 0.95 : 0.35 });
          tip(el, () => h("span", {}, h("b", {}, sg.match), h("br"), `chr${ch} · ${fmt.cm(sg.cm)}`, h("br"), h("span", { class: "mono" }, `${fmt.bp(sg.start)}–${fmt.bp(sg.end)}`)));
          g.append(el);
        }
      } }],
    })), h("div", { class: "legend", style: "margin-top:10px" }, ...[...colorOf].map(([name, c]) => h("span", {}, h("i", { class: "swatch", style: `background:${c}` }), name)))),
    foot: h("span", {}, `${m.clusters.length} regions where two or more matches overlap by at least 3 Mb.${m.skipped ? ` ${m.skipped} unreadable rows skipped.` : ""}`),
  });
  const detail = selected ? matchDetail(selected) : h("div");
  out.append(h("div", { class: "stack-l", style: "margin-top:28px" },
    figure({ kicker: state.matchesName ?? "Matches", title: `${state.you?.demo ? "Leo's" : "Your"} match list, with an estimate for each`, caption: "Click a match for its probabilities. Estimates use the total and the number of segments of at least 7 cM; smaller segments are left out of both.", body: table }),
    detail, overlay));
  return out;
}

function matchDetail(r: MatchRow): HTMLElement {
  const box = h("div", { class: "card" });
  const truth = r.truth;
  box.append(h("div", { class: "grid g-side", style: "align-items:start" },
    h("div", {},
      h("p", { class: "kicker" }, r.match),
      h("div", { class: "headline-number" }, fmt.int(r.autosomalCm), h("small", {}, `cM in ${r.segmentsOver7} segments`)),
      truth ? revealButton(`match:${r.match}`, truth) : null,
      h("div", { style: "margin-top:14px" }, probabilityBars(r.posteriors, { limit: 5, truth: truth && revealed.has(`match:${r.match}`) ? truth : undefined }))),
    h("div", {}, (() => {
      const holder = h("div", {}, h("div", { class: "loading" }, h("div", { class: "spinner" })));
      call("predict", { totalCm: r.autosomalCm, segments: r.segmentsOver7 }).then((p) => clear(holder, responsive((w) => ridgelines(p.sketches, r.autosomalCm, w))));
      return holder;
    })())));
  return box;
}

/* ------------------------------------------------------------------ */
/* Calculator                                                          */
/* ------------------------------------------------------------------ */
let calc = { total: 866, segments: "" as string, full: "" as string };
function calculatorTab(): HTMLElement {
  const result = h("div");
  const total = h("input", { class: "input", type: "number", min: "0", max: "4000", step: "1", value: String(calc.total), "aria-label": "Total shared cM" });
  const segs = h("input", { class: "input", type: "number", min: "0", max: "100", step: "1", value: calc.segments, placeholder: "optional", "aria-label": "Number of segments" });
  const full = h("input", { class: "input", type: "number", min: "0", max: "4000", step: "1", value: calc.full, placeholder: "optional", "aria-label": "Fully identical cM" });
  const run = async () => {
    calc = { total: Number(total.value) || 0, segments: segs.value, full: full.value };
    const p = await call("predict", { totalCm: calc.total, segments: calc.segments ? Number(calc.segments) : undefined, fullCm: calc.full ? Number(calc.full) : undefined });
    clear(result, calcResult(p.posteriors, p.sketches, calc.total));
  };
  for (const i of [total, segs, full]) i.addEventListener("input", () => { void run(); });
  void run();
  return h("div", {},
    h("div", { class: "card" },
      h("div", { class: "grid g3" },
        h("label", { class: "field" }, "Total shared cM", total),
        h("label", { class: "field" }, "Segments of 7 cM or more", segs),
        h("label", { class: "field" }, "Fully identical cM (from a two-file comparison)", full)),
      h("p", { class: "small faded", style: "margin:12px 0 0" }, "Try 1,750 cM with 24 segments, then with 40: the total alone cannot tell a grandparent from a half sibling, but the number of segments can.")),
    h("div", { style: "margin-top:24px" }, result));
}

function calcResult(post: Posterior[], sk: DistributionSketch[], total: number): HTMLElement {
  return h("div", { class: "grid g2", style: "align-items:start" },
    figure({ kicker: "Probabilities", title: post[0] ? `Most likely: ${post[0].label} (${fmt.prob(post[0].probability)})` : "No sharing", body: probabilityBars(post, { limit: 8 }), foot: "Equal prior for each of the 23 simulated relationships." }),
    figure({ kicker: "Simulated ranges", title: `${fmt.int(total)} cM against the leading candidates`, body: responsive((w) => ridgelines(sk, total, w)), foot: h("span", {}, "Brick brackets: Shared cM Project v4 observed ranges (", cite("sharedcm2020"), ").") }));
}

/* ------------------------------------------------------------------ */
/* Simulator                                                           */
/* ------------------------------------------------------------------ */
let simRel = "1C";
let simSeed = 1;
const simHistory = new Map<string, number[]>();
function simulatorTab(): HTMLElement {
  const result = h("div");
  const select = h("select", { class: "select", "aria-label": "Relationship to simulate" });
  const opts: Array<[string, string]> = [["sibling", "Full siblings"], ["half-sibling", "Half siblings"], ["grandparent", "Grandparent and grandchild"], ["aunt-uncle", "Aunt or uncle and niece or nephew"], ["1C", "First cousins"], ["1C1R", "First cousins once removed"], ["2C", "Second cousins"], ["3C", "Third cousins"], ["4C", "Fourth cousins"], ["5C", "Fifth cousins"]];
  for (const [v, l] of opts) select.append(h("option", { value: v, selected: v === simRel }, l));
  const roll = async () => {
    simRel = select.value;
    const sim = await call("simulate", { relationship: simRel, seed: simSeed++ * 7919 + 13 });
    const hist = simHistory.get(simRel) ?? [];
    hist.push(sim.totalCm);
    simHistory.set(simRel, hist);
    clear(result, simResult(sim, hist));
  };
  select.addEventListener("change", () => void roll());
  void roll();
  return h("div", {},
    h("div", { class: "card" },
      h("div", { class: "row between" },
        h("div", {}, h("p", { class: "kicker navy" }, "Inheritance simulator"), h("h3", { class: "h3" }, "Two relatives, simulated from the same ancestors")),
        h("div", { class: "row" }, select, h("button", { class: "btn primary", type: "button", onClick: () => void roll() }, icon("dice"), "Roll again"))),
      h("p", { class: "small muted", style: "margin:10px 0 0" }, "Each roll simulates every meiosis between the common ancestors and the two relatives, with crossovers placed along the real genetic map. Roll a few times: the same relationship can share very different amounts.")),
    h("div", { style: "margin-top:24px" }, result));
}

function simResult(sim: SimulatedView, hist: number[]): HTMLElement {
  const lengths = new Map(AUTOSOME_NAMES.map((c, i) => [c, sim.chromosomeCm[i]!]));
  return figure({
    kicker: `Roll ${hist.length} · ${sim.relationship.label}`,
    title: `This pair shares ${fmt.int(sim.totalCm)} cM in ${sim.segments} segments`,
    caption: sim.segments === 0 ? "No segment of 7 cM or more survived the meioses: they share ancestors but no detectable DNA, which is common for distant cousins." : `Longest segment ${fmt.cm(sim.longestCm)}.${sim.fullCm ? ` ${fmt.int(sim.fullCm)} cM on both copies.` : ""} Chromosomes are drawn to genetic length (cM).`,
    body: h("div", {},
      responsive((w) => chromosomeChart({
        width: w, length: (c) => lengths.get(c) ?? 0,
        right: (c) => { const t = sim.pieces.filter((p) => p.chrom === c && p.kind === "half").reduce((a, p) => a + p.lengthCm, 0); return t ? `${fmt.num(t, 0)} cM` : "–"; },
        tracks: [{ draw: (c, g, x, y, hh) => {
          for (const p of sim.pieces.filter((q) => q.chrom === c)) {
            g.append(s("rect", { x: x(p.startCm), y: p.kind === "full" ? y + 2 : y, width: Math.max(2, x(p.endCm) - x(p.startCm)), height: p.kind === "full" ? hh - 4 : hh, fill: p.kind === "full" ? "url(#hatch)" : "var(--half)", rx: 2 }));
          }
        } }],
      })),
      h("div", { style: "margin-top:18px" }, h("p", { class: "kicker", style: "color:var(--ink-3)" }, `Your ${hist.length} roll${hist.length === 1 ? "" : "s"} of ${sim.relationship.label.toLowerCase()}`), rollStrip(hist))),
    foot: h("span", {}, "Same model as the relationship probabilities: Poisson crossovers on the HapMap II map, 7 cM threshold."),
  });
}

function rollStrip(hist: number[]): SVGSVGElement | HTMLElement {
  const holder = h("div");
  requestAnimationFrame(() => {
    const W = holder.clientWidth || 600, H = 46, max = Math.max(200, ...hist) * 1.1;
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    svg.append(s("line", { x1: 0, x2: W, y1: 30, y2: 30, stroke: "var(--rule)" }));
    hist.forEach((v, i) => svg.append(s("circle", { cx: 6 + (v / max) * (W - 12), cy: 30 - (i % 4) * 6, r: i === hist.length - 1 ? 5 : 3.5, fill: i === hist.length - 1 ? "var(--brick)" : "var(--navy)", opacity: i === hist.length - 1 ? 1 : 0.5 })));
    svg.append(s("text", { x: 2, y: 44, class: "lbl", "font-size": 10 }, "0 cM"), s("text", { x: W - 2, y: 44, "text-anchor": "end", class: "lbl", "font-size": 10 }, `${fmt.int(max)} cM`));
    holder.replaceChildren(svg);
  });
  return holder;
}

