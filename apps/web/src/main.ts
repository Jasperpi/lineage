import {
  parseRawKit, summariseKit, inferSex, runsOfHomozygosity, compareKits, parseSegmentTable, summariseMatches,
  predictRelationship, parseGedcom, gedcomStats, findRelationship, matrilineage, patrilineage, callTraits,
  estimateAdmixture, GRCH37_LENGTH, AUTOSOMES, type Kit, type ParsedKit, type Chrom, type ReferencePanel,
  type SharedSegment, type TraitCall, type GedcomFile, type MatchSegment,
} from "@lineage/core";
import { TRAITS } from "@lineage/kb";
import { buildThousandGenomesPanel } from "@lineage/fetch";

/* ------------------------------------------------------------------ */
/* Tiny DOM helpers                                                    */
/* ------------------------------------------------------------------ */
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}
const svgNS = "http://www.w3.org/2000/svg";
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}
const fmt = {
  int: (n: number) => n.toLocaleString(),
  pct: (x: number, d = 1) => `${(x * 100).toFixed(d)}%`,
  mb: (bp: number) => `${(bp / 1e6).toFixed(1)} Mb`,
  cm: (x: number) => `${x.toFixed(1)} cM`,
};
const tooltip = h("div", { class: "tooltip", role: "status" });
document.body.append(tooltip);
function hover(el: Element, text: () => string) {
  el.addEventListener("mousemove", (e: Event) => {
    const m = e as MouseEvent;
    tooltip.textContent = text();
    tooltip.style.opacity = "1";
    tooltip.style.left = `${Math.min(m.clientX + 12, window.innerWidth - 270)}px`;
    tooltip.style.top = `${m.clientY + 12}px`;
  });
  el.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
}

function dropZone(label: string, accept: string, onText: (text: string, name: string) => void): HTMLElement {
  const input = h("input", { type: "file", accept });
  const zone = h("label", { class: "drop" }, label, input);
  input.addEventListener("change", () => { const f = input.files?.[0]; if (f) f.text().then((t) => onText(t, f.name)); });
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); const f = e.dataTransfer?.files[0]; if (f) f.text().then((t) => onText(t, f.name)); });
  return zone;
}
async function sample(path: string): Promise<string> { const r = await fetch(`${import.meta.env.BASE_URL}samples/${path}`); if (!r.ok) throw new Error(`Could not load sample ${path}`); return r.text(); }
function table(headers: Array<[string, boolean?]>, rows: Array<Array<string | Node>>, numericCols: number[] = []): HTMLElement {
  return h("table", {},
    h("thead", {}, h("tr", {}, ...headers.map(([t], i) => h("th", { class: numericCols.includes(i) ? "num" : "" }, t)))),
    h("tbody", {}, ...rows.map((r) => h("tr", {}, ...r.map((c, i) => h("td", { class: numericCols.includes(i) ? "num" : "" }, c))))));
}
function conf(c: string) { return h("span", { class: `pill ${c.slice(0, 3)}` }, c); }

/* ------------------------------------------------------------------ */
/* Shared state                                                        */
/* ------------------------------------------------------------------ */
const state: { kit?: ParsedKit; kitName?: string; other?: ParsedKit; otherName?: string; panel?: ReferencePanel; gedcom?: GedcomFile; segments?: MatchSegment[] } = {};
const listeners: Array<() => void> = [];
function notify() { for (const l of listeners) l(); }

/* ------------------------------------------------------------------ */
/* Tab: Your file                                                      */
/* ------------------------------------------------------------------ */
function kitTab(): HTMLElement {
  const status = h("p", { class: "status" });
  const results = h("div");
  const load = (text: string, name: string) => {
    status.textContent = `Parsing ${name}…`;
    setTimeout(() => {
      try {
        const t0 = performance.now();
        state.kit = parseRawKit(text); state.kitName = name;
        status.textContent = `${name}: ${state.kit.report.format}, ${fmt.int(state.kit.report.rowsKept)} variants parsed in ${(performance.now() - t0).toFixed(0)} ms${state.kit.report.rowsRead - state.kit.report.rowsKept ? `, ${state.kit.report.rowsRead - state.kit.report.rowsKept} rows skipped` : ""}.`;
        renderKit(results, state.kit.kit); notify();
      } catch (e) { status.textContent = `Could not parse: ${(e as Error).message}`; status.classList.add("error"); }
    }, 10);
  };
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, "Your raw data file"),
      h("p", { class: "lead" }, "Drop the raw download from 23andMe, AncestryDNA, FamilyTreeDNA, MyHeritage or Living DNA. The file is read here, in your browser, and nowhere else."),
      dropZone("Drop a raw DNA file here, or click to choose one", ".txt,.csv,.tsv", load),
      h("div", { class: "row" },
        h("button", { class: "btn secondary", onClick: () => sample("tester.txt").then((t) => load(t, "tester.txt (synthetic)")) }, "Try the synthetic sample"),
        status)),
    results);
}

function renderKit(root: HTMLElement, kit: Kit) {
  root.replaceChildren();
  const summary = summariseKit(kit), sex = inferSex(kit), roh = runsOfHomozygosity(kit);
  root.append(h("section", { class: "panel" },
    h("h2", {}, "What the file contains"),
    h("div", { class: "kv" },
      tile("Format", summary.format, `build ${summary.build}`),
      tile("Variants", fmt.int(summary.variants), `${fmt.pct(summary.callRate, 2)} called`),
      tile("Autosomal heterozygosity", fmt.pct(summary.autosomalHeterozygosity), "typical range 30-40% on consumer chips"),
      tile("Genetic sex", sex.inferred, sex.rationale),
      tile("Runs of homozygosity", `${roh.length}`, roh.length ? `${fmt.mb(roh.reduce((a, r) => a + r.lengthBp, 0))} total, over 4 Mb each` : "none over 4 Mb")),
    h("details", {}, h("summary", {}, "Per-chromosome counts"),
      table([["Chromosome"], ["Variants"], ["Called"], ["Heterozygous"]], summary.perChromosome.map((c) => [c.chrom, fmt.int(c.variants), fmt.int(c.called), fmt.int(c.heterozygous)]), [1, 2, 3])),
    roh.length ? h("div", {}, h("h3", {}, "Runs of homozygosity"), h("p", { class: "note" }, "Long stretches where both parental copies are identical. A total above roughly 100 Mb usually reflects parents who share recent ancestry or a small founder population; short totals are normal. Boundaries are approximate (no genetic map)."),
      table([["Chr"], ["Start"], ["End"], ["Length"], ["SNPs"]], roh.map((r) => [r.chrom, fmt.int(r.start), fmt.int(r.end), fmt.mb(r.lengthBp), fmt.int(r.snps)]), [1, 2, 3, 4])) : null,
  ));
  root.append(traitsPanel(callTraits(kit, TRAITS)));
}
function tile(label: string, value: string, sub?: string) { return h("div", { class: "tile" }, h("div", { class: "label" }, label), h("div", { class: "value" }, value), sub ? h("div", { class: "sub" }, sub) : null); }

function traitsPanel(calls: TraitCall[]): HTMLElement {
  const called = calls.filter((c) => c.status === "called" || c.status === "strand-flipped");
  const missing = calls.filter((c) => !called.includes(c));
  return h("section", { class: "panel" },
    h("h2", {}, "Traits"),
    h("p", { class: "lead" }, `${called.length} of ${calls.length} curated markers are on this chip and called. Each line states what the cited study found and no more; these are tendencies established in specific populations, not predictions about you.`),
    ...called.map((c) => h("div", { style: "margin: 0 0 14px" },
      h("div", {}, h("strong", {}, c.variant.name), h("span", { class: "mono" }, ` ${c.variant.gene} · ${c.variant.rsid} · ${c.genotype}`), conf("probable"), c.status === "strand-flipped" ? h("span", { class: "pill sug" }, "strand flipped") : null),
      h("div", {}, c.interpretation),
      h("div", { class: "src" }, `Evidence: ${c.variant.evidenceSummary} Caveat: ${c.variant.caveats} `,
        ...c.variant.sources.flatMap((src, i) => [i ? "; " : "", h("a", { href: `https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`, target: "_blank", rel: "noopener" }, `${src.authors.split(",")[0]} ${src.year}, PMID ${src.pmid}`)]),
        h("span", {}, ` · ${freqLine(c)}`)))),
    missing.length ? h("details", {}, h("summary", {}, `${missing.length} markers not callable`), h("ul", {}, ...missing.map((c) => h("li", {}, `${c.variant.name} (${c.variant.rsid}): ${c.status}${c.note ? `, ${c.note}` : ""}`)))) : null);
}
function freqLine(c: TraitCall): string {
  const f = c.variant.frequencies.filter((x) => x.allele === c.variant.effectAllele);
  return `${c.variant.effectAllele} allele frequency, 1000 Genomes: ` + f.map((x) => `${x.population.split(":").pop()} ${(x.frequency * 100).toFixed(0)}%`).join(", ");
}

/* ------------------------------------------------------------------ */
/* Tab: Compare two files                                              */
/* ------------------------------------------------------------------ */
function compareTab(): HTMLElement {
  const status = h("p", { class: "status" });
  const results = h("div");
  const run = () => {
    if (!state.kit || !state.other) return;
    const r = compareKits(state.kit.kit, state.other.kit);
    results.replaceChildren(
      h("section", { class: "panel" },
        h("h2", {}, `${state.kitName} vs ${state.otherName}`),
        h("div", { class: "kv" },
          tile("Comparable SNPs", fmt.int(r.comparableSnps), `of ${fmt.int(r.sharedSnps)} shared positions`),
          tile("Opposite homozygous", fmt.pct(r.oppositeHomozygousRate, 2), "≈0% parent/child, 2-4% siblings, 6-12% unrelated"),
          tile("Half-identical", `${r.halfIdentical.length} segments`, fmt.mb(r.totals.halfBp)),
          tile("Fully identical", `${r.fullyIdentical.length} segments`, fmt.mb(r.totals.fullBp))),
        interpretation(r.oppositeHomozygousRate, r.totals.halfBp, r.totals.fullBp),
        chromosomeMap([...r.halfIdentical, ...r.fullyIdentical]),
        h("p", { class: "note" }, "Lengths are physical (Mb) because no genetic map is loaded; the command line accepts a HapMap-format map for centimorgans. Sparse or low-quality files produce fewer, shorter segments."),
        r.halfIdentical.length ? table([["Chr"], ["Start"], ["End"], ["Length"], ["SNPs"], ["Kind"]],
          [...r.halfIdentical, ...r.fullyIdentical].sort((a, b) => AUTOSOMES.indexOf(a.chrom) - AUTOSOMES.indexOf(b.chrom) || a.start - b.start).map((x) => [x.chrom, fmt.int(x.start), fmt.int(x.end), fmt.mb(x.lengthBp), fmt.int(x.snps), x.kind === "half" ? "half-identical" : "fully identical"]), [1, 2, 3, 4]) : null));
  };
  const load = (text: string, name: string) => {
    status.textContent = `Parsing ${name}…`;
    setTimeout(() => { try { state.other = parseRawKit(text); state.otherName = name; status.textContent = `${name}: ${fmt.int(state.other.report.rowsKept)} variants.`; run(); } catch (e) { status.textContent = (e as Error).message; } }, 10);
  };
  listeners.push(run);
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, "Compare two files"),
      h("p", { class: "lead" }, "Load a second raw file to find the stretches of chromosome you share. This is the one-to-one comparison behind every matching service, computed directly from the genotypes."),
      dropZone("Drop the second raw DNA file here", ".txt,.csv,.tsv", load),
      h("div", { class: "row" },
        ...(["mother", "sibling", "cousin", "unrelated"] as const).map((n) => h("button", { class: "btn secondary", onClick: () => sample(`${n}.txt`).then((t) => load(t, `${n}.txt (synthetic)`)) }, `Sample: ${n}`)),
        status),
      h("p", { class: "status" }, "The first file comes from the \"Your file\" tab.")),
    results);
}
function interpretation(opp: number, halfBp: number, fullBp: number): HTMLElement {
  const total = 2.88e9; // autosomal GRCh37 length
  const half = halfBp / total, full = fullBp / total;
  let text: string;
  if (opp < 0.005 && half > 0.8) text = "Almost no opposite-homozygous SNPs and a half-identical match along essentially every chromosome: the parent/child pattern.";
  else if (full > 0.08 && half > 0.4) text = "Substantial fully-identical regions alongside broad half-identical coverage: the full-sibling pattern (only full siblings share both copies of a region).";
  else if (half > 0.35) text = "Roughly half the genome half-identical without sibling-scale fully-identical regions: consistent with a half sibling, grandparent/grandchild, or aunt/uncle.";
  else if (half > 0.15) text = "About a quarter of the genome in shared segments: consistent with first cousins or an equivalent relationship.";
  else if (halfBp > 0) text = "Some shared segments: a more distant relationship, or chance identity in sparse data. Compare against the Shared cM ranges on the Matches tab once you have centimorgan values.";
  else text = "No shared segments above threshold: no detectable recent relationship in this data.";
  return h("p", { class: "note" }, text, ` (half-identical ${fmt.pct(half, 0)}, fully identical ${fmt.pct(full, 0)} of the autosomes)`);
}
function chromosomeMap(segments: SharedSegment[]): HTMLElement {
  const W = 900, rowH = 16, gap = 6, left = 34;
  const chroms: Chrom[] = [...AUTOSOMES, "X"];
  const maxLen = GRCH37_LENGTH["1"];
  const svg = s("svg", { viewBox: `0 0 ${W} ${chroms.length * (rowH + gap)}`, class: "chrom-map", role: "img", "aria-label": "Shared segments by chromosome" });
  chroms.forEach((c, i) => {
    const y = i * (rowH + gap);
    const len = (GRCH37_LENGTH[c] / maxLen) * (W - left - 4);
    svg.append(s("text", { x: 0, y: y + rowH - 3, class: "lbl" }, c));
    svg.append(s("rect", { x: left, y, width: len, height: rowH, rx: 4, fill: "var(--rule)" }));
    for (const seg of segments.filter((x) => x.chrom === c)) {
      const x = left + (seg.start / maxLen) * (W - left - 4), w = Math.max(2, ((seg.end - seg.start) / maxLen) * (W - left - 4));
      const r = s("rect", { x, y: seg.kind === "full" ? y + 2 : y, width: w, height: seg.kind === "full" ? rowH - 4 : rowH, rx: 3, fill: seg.kind === "full" ? "var(--s2)" : "var(--s1)", stroke: "var(--surface-1)", "stroke-width": 1 });
      hover(r, () => `chr${seg.chrom} ${fmt.int(seg.start)}–${fmt.int(seg.end)}: ${fmt.mb(seg.lengthBp)}, ${seg.snps} SNPs, ${seg.kind === "full" ? "fully" : "half"} identical`);
      svg.append(r);
    }
  });
  return h("div", { class: "chart" }, svg, h("div", { class: "legend" }, h("span", {}, h("i", { class: "sw", style: "background: var(--s1)" }), "half-identical"), h("span", {}, h("i", { class: "sw", style: "background: var(--s2)" }), "fully identical")));
}

/* ------------------------------------------------------------------ */
/* Tab: Matches (segment exports)                                      */
/* ------------------------------------------------------------------ */
function matchesTab(): HTMLElement {
  const status = h("p", { class: "status" });
  const results = h("div");
  const manual = h("input", { type: "text", placeholder: "total shared cM, e.g. 866", style: "width: 200px" });
  const showTotal = (total: number) => {
    const p = predictRelationship(total);
    results.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, `${fmt.cm(total)} shared`),
      h("p", { class: "note" }, p.note, " Ranges are observed minimums and maximums from submitted matches; they overlap, so every relationship listed is possible and none is proven."),
      table([["Relationship"], ["Average"], ["Observed range"], ["Where this total falls"]], p.candidates.map((c) => [c.entry.label, fmt.int(c.entry.average), `${c.entry.min}–${c.entry.max}`, rangeBar(c.entry.min, c.entry.max, total)]), [1, 2])));
  };
  const load = (text: string, name: string) => {
    try {
      const { segments, skipped } = parseSegmentTable(text);
      state.segments = segments;
      const rows = summariseMatches(segments);
      status.textContent = `${name}: ${segments.length} segments across ${rows.length} matches${skipped ? `, ${skipped} rows skipped` : ""}.`;
      results.replaceChildren(h("section", { class: "panel" },
        h("h2", {}, "Matches"),
        h("p", { class: "lead" }, "Each match's autosomal total against the Shared cM Project v4 ranges. Click a name for the full list of consistent relationships."),
        table([["Match"], ["Autosomal cM"], ["X cM"], ["Segments"], ["Longest"], ["Consistent with"]], rows.map((m) => {
          const p = predictRelationship(m.autosomalCm);
          return [h("a", { href: "#", onClick: (e: Event) => { e.preventDefault(); showTotal(m.autosomalCm); } }, m.match), m.autosomalCm.toFixed(1), m.xCm.toFixed(1), String(m.segments), m.longestCm.toFixed(1), p.candidates.slice(0, 4).map((c) => c.entry.label).join(", ") || "—"];
        }), [1, 2, 3, 4]),
        cmBars(rows.map((m) => [m.match, m.autosomalCm] as [string, number]))));
    } catch (e) { status.textContent = (e as Error).message; }
  };
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, "Matches and relationship ranges"),
      h("p", { class: "lead" }, "Load a segment export (GEDmatch, DNA Painter, 23andMe, FamilyTreeDNA or MyHeritage layouts) or type a total to see which relationships the Shared cM Project's observed ranges allow."),
      dropZone("Drop a matching-segments CSV here", ".csv,.tsv,.txt", load),
      h("div", { class: "row" },
        h("button", { class: "btn secondary", onClick: () => sample("segments.csv").then((t) => load(t, "segments.csv (synthetic)")) }, "Try the sample export"),
        manual, h("button", { class: "btn", onClick: () => { const v = Number(manual.value); if (v >= 0) showTotal(v); } }, "Look up total"),
        status)),
    results);
}
function rangeBar(min: number, max: number, v: number): Node {
  const W = 160, lo = 0, hi = 3720;
  const x = (t: number) => ((t - lo) / (hi - lo)) * W;
  const svg = s("svg", { viewBox: `0 0 ${W} 12`, width: W, height: 12, role: "img", "aria-label": `range ${min} to ${max}, value ${v}` });
  svg.append(s("rect", { x: 0, y: 4, width: W, height: 4, rx: 2, fill: "var(--rule)" }));
  svg.append(s("rect", { x: x(min), y: 4, width: Math.max(2, x(max) - x(min)), height: 4, rx: 2, fill: "var(--s1)" }));
  svg.append(s("circle", { cx: x(v), cy: 6, r: 4, fill: "var(--ink)", stroke: "var(--surface-1)", "stroke-width": 1.5 }));
  return svg;
}
function cmBars(rows: Array<[string, number]>): HTMLElement {
  const top = rows.slice(0, 25);
  const max = Math.max(...top.map((r) => r[1]), 1);
  const W = 900, rowH = 18, labelW = 170;
  const svg = s("svg", { viewBox: `0 0 ${W} ${top.length * rowH + 4}`, role: "img", "aria-label": "Shared centimorgans per match" });
  top.forEach(([name, cm], i) => {
    const y = i * rowH + 2, w = ((W - labelW - 70) * cm) / max;
    svg.append(s("text", { x: labelW - 8, y: y + 12, "text-anchor": "end", class: "lbl", style: "font: 12px system-ui; fill: var(--ink-2)" }, name.length > 24 ? name.slice(0, 23) + "…" : name));
    const r = s("rect", { x: labelW, y, width: Math.max(2, w), height: rowH - 4, rx: 4, fill: "var(--s1)" });
    hover(r, () => `${name}: ${fmt.cm(cm)}`);
    svg.append(r);
    svg.append(s("text", { x: labelW + Math.max(2, w) + 6, y: y + 12, style: "font: 12px system-ui; fill: var(--ink-2)" }, cm.toFixed(1)));
  });
  return h("div", { class: "chart" }, h("h3", { style: "margin-top:0" }, "Autosomal cM per match"), svg);
}

/* ------------------------------------------------------------------ */
/* Tab: Family tree                                                    */
/* ------------------------------------------------------------------ */
function treeTab(): HTMLElement {
  const status = h("p", { class: "status" });
  const results = h("div");
  const load = (text: string, name: string) => {
    try {
      const file = parseGedcom(text); state.gedcom = file;
      const st = gedcomStats(file);
      status.textContent = `${name}: ${fmt.int(st.individuals)} people, ${fmt.int(st.families)} families${file.warnings.length ? `, ${file.warnings.length} integrity warnings` : ""}.`;
      const people = [...file.individuals.values()].sort((a, b) => a.name.localeCompare(b.name));
      const opt = (sel: HTMLSelectElement) => { for (const p of people) sel.append(h("option", { value: p.id }, `${p.name}${p.birth?.year ? ` (b. ${p.birth.year})` : ""}`)); };
      const a = h("select"), b = h("select"); opt(a); opt(b);
      // Default to a related pair so the calculator shows something on load.
      outer: for (let i = 0; i < people.length; i++) for (let j = 0; j < people.length; j++) {
        if (i !== j && findRelationship(file, people[i]!.id, people[j]!.id)) { a.selectedIndex = i; b.selectedIndex = j; break outer; }
      }
      const relOut = h("div");
      const compute = () => {
        const r = findRelationship(file, a.value, b.value);
        const an = file.individuals.get(a.value)!, bn = file.individuals.get(b.value)!;
        if (!r) { relOut.replaceChildren(h("p", { class: "note" }, `${an.name} and ${bn.name} share no recorded ancestor in this tree.`)); return; }
        relOut.replaceChildren(
          h("p", { class: "note" }, h("strong", {}, `${bn.name} is ${an.name}'s ${r.description}.`), ` Common ancestor${r.commonAncestors.length > 1 ? "s" : ""}: ${r.commonAncestors.map((id) => file.individuals.get(id)?.name ?? id).join(" and ")}.`),
          h("div", { class: "kv" },
            tile("Coefficient of relationship", r.math.coefficientOfRelationship.toFixed(4), "r, fraction of genes shared by descent"),
            tile("Kinship coefficient", r.math.kinshipCoefficient.toFixed(4), "φ = r / 2"),
            tile("Expected shared DNA", fmt.pct(r.math.expectedHalfIdenticalFraction), `≈ ${fmt.int(Math.round(r.math.expectedHalfIdenticalFraction * 3485))} cM on a 3,485 cM autosome`),
            tile("Degree", String(r.math.degree), "meioses on the closest path")),
          h("details", {}, h("summary", {}, "Paths"), h("ul", {}, ...r.paths.map((p) => h("li", {}, `${p.up} up, ${p.down} down via ${file.individuals.get(p.ancestorId ?? "")?.name ?? p.ancestorId}${p.viaParentOfA ? ` (through ${an.name}'s ${p.viaParentOfA})` : ""}`)))));
      };
      a.addEventListener("change", compute); b.addEventListener("change", compute);
      const lines = h("div");
      const showLines = () => {
        const id = a.value;
        const m = matrilineage(file, id), p = patrilineage(file, id);
        lines.replaceChildren(
          h("p", {}, h("strong", {}, "Mitochondrial line (mother's mother's…): "), m.map((x) => x.name).join(" → ")),
          h("p", {}, h("strong", {}, "Y line (father's father's…): "), file.individuals.get(id)?.sex === "F" ? "not applicable to a female tester; her father's line is: " + p.slice(1).map((x) => x.name).join(" → ") : p.map((x) => x.name).join(" → ")));
      };
      a.addEventListener("change", showLines);
      results.replaceChildren(
        h("section", { class: "panel" },
          h("h2", {}, "Tree"),
          h("div", { class: "kv" },
            tile("People", fmt.int(st.individuals)), tile("Families", fmt.int(st.families)),
            tile("Birth years", st.earliestBirthYear ? `${st.earliestBirthYear}–${st.latestBirthYear}` : "—", `${st.withBirthYear} with a year`),
            tile("Source", file.source ?? "—", file.version ? `GEDCOM ${file.version}` : undefined)),
          h("p", {}, h("strong", {}, "Surnames: "), st.surnames.map((x) => `${x.surname} (${x.count})`).join(", ")),
          st.places.length ? h("p", {}, h("strong", {}, "Places: "), st.places.map((x) => `${x.place} (${x.count})`).join("; ")) : null,
          file.warnings.length ? h("details", {}, h("summary", {}, "Integrity warnings"), h("ul", {}, ...file.warnings.slice(0, 50).map((w) => h("li", {}, w)))) : null),
        h("section", { class: "panel" },
          h("h2", {}, "Relationship calculator"),
          h("div", { class: "row" }, a, h("span", {}, "and"), b),
          relOut,
          h("h3", {}, "Uniparental lines"), lines));
      compute(); showLines();
    } catch (e) { status.textContent = (e as Error).message; }
  };
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, "Family tree"),
      h("p", { class: "lead" }, "Load a GEDCOM export from any genealogy program. Lineage reads people, families and events, checks the links, and computes how any two people are related and what share of DNA that predicts."),
      dropZone("Drop a .ged file here", ".ged,.gedcom,.txt", load),
      h("div", { class: "row" }, h("button", { class: "btn secondary", onClick: () => sample("family.ged").then((t) => load(t, "family.ged (synthetic)")) }, "Try the sample tree"), status)),
    results);
}

/* ------------------------------------------------------------------ */
/* Tab: Ancestry                                                       */
/* ------------------------------------------------------------------ */
function ancestryTab(): HTMLElement {
  const status = h("p", { class: "status" });
  const results = h("div");
  const build = h("button", { class: "btn" }, "Build panel from Ensembl and estimate");
  const sizeSel = h("select", {}, h("option", { value: "2000" }, "2,000 SNPs (fast, ~10 requests)"), h("option", { value: "4000", selected: true }, "4,000 SNPs (~20 requests)"), h("option", { value: "8000" }, "8,000 SNPs (~40 requests)"));
  build.addEventListener("click", async () => {
    if (!state.kit) { status.textContent = "Load a raw file on the first tab first."; return; }
    build.disabled = true;
    try {
      status.textContent = "Fetching 1000 Genomes frequencies from Ensembl…";
      const panel = await buildThousandGenomesPanel(state.kit.kit, { maxSnps: Number(sizeSel.value), onProgress: (d, t) => { status.textContent = `Fetched ${d} of ${t} rsIDs from Ensembl…`; } });
      state.panel = panel;
      status.textContent = `Panel: ${fmt.int(panel.snps.length)} informative, biallelic, non-palindromic SNPs after thinning to 250 kb spacing. Estimating…`;
      await new Promise((r) => setTimeout(r, 20));
      const r = estimateAdmixture(state.kit.kit, panel);
      status.textContent = `Done: ${fmt.int(r.snpsUsed)} SNPs used, ${r.iterations} EM iterations.`;
      results.replaceChildren(h("section", { class: "panel" },
        h("h2", {}, "Supervised admixture, 1000 Genomes super-populations"),
        admixtureChart(r.populations, r.proportions, r.ci95),
        table([["Population"], ["Estimate"], ["95% interval"]], r.populations.map((p, i) => [popName(p), fmt.pct(r.proportions[i]!), `${fmt.pct(r.ci95[i]![0], 0)} – ${fmt.pct(r.ci95[i]![1], 0)}`]), [1, 2]),
        h("p", { class: "note" }, "How to read this: the five 1000 Genomes super-populations are continental groupings (AFR African, AMR admixed American, EAS East Asian, EUR European, SAS South Asian). Ancestry from anywhere else is forced onto the closest of these, which is why a person of, say, Middle Eastern or Pacific descent gets a split rather than a single label. Intervals reflect SNP sampling only, not the choice of panel."),
        ...r.caveats.map((c) => h("p", { class: "src" }, c))));
    } catch (e) { status.textContent = `Failed: ${(e as Error).message}`; status.classList.add("error"); }
    finally { build.disabled = false; }
  });
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, "Ancestry composition"),
      h("p", { class: "lead" }, "A reproducible estimate from public data. Lineage samples rsIDs from your file, asks Ensembl for their 1000 Genomes population frequencies, and fits your genotypes to those five reference populations by maximum likelihood. Only rsID numbers leave the browser."),
      h("div", { class: "row" }, sizeSel, build, status),
      h("p", { class: "note" }, "This is the same supervised model that ADMIXTURE and similar tools use, at continental resolution. It is honest about what it can and cannot see: with five reference groups it cannot distinguish, for example, Irish from Italian, and it will not pretend to. Finer resolution needs a finer panel, which the framework accepts as a JSON file.")),
    results);
}
const POP_NAMES: Record<string, string> = { AFR: "African", AMR: "Admixed American", EAS: "East Asian", EUR: "European", SAS: "South Asian" };
function popName(p: string) { return `${POP_NAMES[p] ?? p} (${p})`; }
function admixtureChart(pops: string[], q: number[], ci: Array<[number, number]>): HTMLElement {
  const W = 900, rowH = 30, labelW = 190;
  const svg = s("svg", { viewBox: `0 0 ${W} ${pops.length * rowH + 4}`, role: "img", "aria-label": "Admixture proportions with 95% intervals" });
  const scale = (x: number) => labelW + x * (W - labelW - 80);
  pops.forEach((p, i) => {
    const y = i * rowH + 4, v = q[i]!;
    svg.append(s("text", { x: labelW - 10, y: y + 15, "text-anchor": "end", style: "font: 13px system-ui; fill: var(--ink-2)" }, popName(p)));
    const bar = s("rect", { x: scale(0), y, width: Math.max(2, scale(v) - scale(0)), height: rowH - 10, rx: 4, fill: `var(--s${i + 1})` });
    hover(bar, () => `${popName(p)}: ${fmt.pct(v)} (95% interval ${fmt.pct(ci[i]![0], 0)}–${fmt.pct(ci[i]![1], 0)})`);
    svg.append(bar);
    svg.append(s("line", { x1: scale(ci[i]![0]), x2: scale(ci[i]![1]), y1: y + (rowH - 10) / 2, y2: y + (rowH - 10) / 2, stroke: "var(--ink)", "stroke-width": 2 }));
    svg.append(s("text", { x: scale(v) + 8, y: y + 15, style: "font: 13px system-ui; fill: var(--ink-2)" }, fmt.pct(v)));
  });
  return h("div", { class: "chart" }, svg, h("div", { class: "legend" }, ...pops.map((p, i) => h("span", {}, h("i", { class: "sw", style: `background: var(--s${i + 1})` }), popName(p))), h("span", {}, "— 95% interval")));
}

/* ------------------------------------------------------------------ */
/* Tab: About                                                          */
/* ------------------------------------------------------------------ */
function aboutTab(): HTMLElement {
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, "How Lineage stays honest"),
      h("ul", {},
        h("li", {}, "Every computed result is a fact with an id, evidence and a source. The optional AI narration layer may only restate facts by id; sentences that cite nothing, or cite something that does not exist, are rejected mechanically."),
        h("li", {}, "The trait knowledge base admits only benign, well-replicated variants whose alleles were pulled from Ensembl and whose primary paper resolves on PubMed. Medical and pharmacogenetic variants are out of scope."),
        h("li", {}, "Relationship ranges are the Shared cM Project v4 values as published, with the caveat that they overlap and never prove a relationship."),
        h("li", {}, "Ancestry estimates come from public 1000 Genomes frequencies through a standard supervised likelihood model, with bootstrap intervals and an explicit statement of what the panel cannot resolve."),
        h("li", {}, "Where a number would need data the framework does not have (a genetic map for cM, a haplogroup tree), it says so instead of guessing.")),
      h("h3", {}, "Command line and library"),
      h("p", {}, "The same engine is a TypeScript library (", h("span", { class: "mono" }, "@lineage/core"), ") and a CLI with commands for inspection, traits, comparison with a genetic map, segment analysis, GEDCOM relationships, Ensembl panel building, admixture, haplogroup calling against ISOGG or PhyloTree-style trees, report generation and grounded narration with Claude."),
      h("h3", {}, "Sample data"),
      h("p", {}, "The samples are a synthetic Norwegian-German-Polish family generated from a seeded random number generator with Mendelian transmission. Their real-marker genotypes were drawn from 1000 Genomes European frequencies so the trait demo has something to show. No person in the samples exists.")));
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
const TABS: Array<[string, string, () => HTMLElement]> = [
  ["file", "Your file", kitTab], ["compare", "Compare", compareTab], ["matches", "Matches", matchesTab],
  ["tree", "Family tree", treeTab], ["ancestry", "Ancestry", ancestryTab], ["about", "About", aboutTab],
];
const app = document.getElementById("app")!, tabsEl = document.getElementById("tabs")!;
const views = new Map<string, HTMLElement>();
function show(id: string) {
  for (const [k, , make] of TABS) {
    if (!views.has(k)) views.set(k, make());
    views.get(k)!.style.display = k === id ? "" : "none";
    if (!views.get(k)!.isConnected) app.append(views.get(k)!);
  }
  for (const b of tabsEl.querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.tab === id));
  try { localStorage.setItem("lineage.tab", id); } catch { /* private mode */ }
}
for (const [id, label] of TABS) tabsEl.append(h("button", { "data-tab": id, role: "tab", onClick: () => show(id) }, label));
let initial = "file";
try { initial = localStorage.getItem("lineage.tab") ?? "file"; } catch { /* ignore */ }
show(TABS.some((t) => t[0] === initial) ? initial : "file");
