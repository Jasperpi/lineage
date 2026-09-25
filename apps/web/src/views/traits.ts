/**
 * Traits: fifteen benign, well-replicated variants, each with its paper and
 * its frequency around the world. A variant states a tendency established in
 * particular populations, never a prediction about a person.
 */
import type { TraitCall } from "@lineage/core";
import { h, fmt, clear } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { ensureTraits } from "../lib/actions.js";
import { figure, responsive, segmented } from "../charts/common.js";
import { frequencyStrip } from "../charts/freqstrip.js";
import { worldMap } from "../charts/worldmap.js";
import { componentColor } from "../lib/colors.js";
import { populationIndex, traitFrequencies } from "../lib/reference.js";
import { cite, paperUrl } from "../lib/citations.js";
import { emptyState } from "./empty.js";

const CATEGORY: Record<string, string> = { pigmentation: "Pigmentation", diet: "Diet", sensory: "Taste", muscle: "Muscle", morphology: "Hair and body", metabolism: "Metabolism", "ancestry-informative": "Ancestry-informative" };
let view: "strip" | "map" = "strip";

export function traits(): HTMLElement {
  if (!state.you) return emptyState("Traits", "Fifteen variants, each with its paper attached", "Open a raw data file, or use the demo family, to see which of the curated trait variants are on the chip and what the cited studies found.");
  if (!state.traits) { void ensureTraits(); return h("div", { class: "loading" }, h("div", { class: "spinner" })); }
  const calls = state.traits;
  const called = calls.filter((c) => c.status === "called" || c.status === "strand-flipped");
  const missing = calls.filter((c) => !called.includes(c));
  const root = h("div", { class: "fade-in" }, h("div", { class: "loading" }, h("div", { class: "spinner" })));
  Promise.all([populationIndex(), traitFrequencies()]).then(([pi, tf]) => {
    const categories = [...new Set(called.map((c) => c.variant.category))];
    const pig = called.filter((c) => c.variant.category === "pigmentation");
    clear(root,
      h("div", { class: "page-head" },
        h("p", { class: "kicker" }, state.you?.demo ? "Traits · demo" : "Traits"),
        h("h1", { class: "h1" }, `${called.length} of ${calls.length} variants, `, h("em", {}, "each with its paper")),
        h("p", { class: "lede" }, "Only benign, visible or dietary traits with a primary study are included; disease, carrier and drug-response variants are out of scope by design. Alleles and positions come from Ensembl, and every PubMed ID was checked against NCBI.")),
      pig.length ? h("div", { class: "card", style: "margin-bottom:28px" },
        h("p", { class: "kicker" }, "Pigmentation at a glance"),
        h("h3", { class: "h2", style: "margin-bottom:6px" }, `${state.you?.demo ? "Leo's" : "Your"} genotypes at the best-known pigmentation loci`),
        h("p", { class: "small muted" }, "Not a portrait: each locus nudges eye, hair or skin colour in the populations where it was studied, and dozens of other variants and the sun matter too. Lineage does not predict faces; published attempts do little better than guessing from sex and ancestry (", h("a", { href: paperUrl("lippert2017"), target: "_blank", rel: "noopener" }, cite("lippert2017")), " and the critiques of it)."),
        h("div", { class: "grid g3", style: "margin-top:12px" }, ...pig.map((c) => h("div", { class: "stat" },
          h("div", { class: "label" }, `${c.variant.gene} · ${c.variant.rsid}`),
          h("div", { style: "display:flex;align-items:center;gap:10px;margin-top:8px" }, genotype(c), h("span", { class: "small", style: "font-weight:600" }, shortName(c.variant.name))),
          h("div", { class: "sub" }, `${c.effectAlleleCount} cop${c.effectAlleleCount === 1 ? "y" : "ies"} of ${c.variant.effectAllele}`))))) : null,
      h("div", { class: "row between", style: "margin-bottom:14px" },
        h("h2", { class: "h2" }, "Every variant"),
        segmented<"strip" | "map">([["strip", "Frequencies as a strip"], ["map", "Frequencies on a map"]], view, (v) => { view = v; root.replaceWith(traits()); })),
      ...categories.map((cat) => h("div", { class: "section", style: "margin-top:24px" },
        h("p", { class: "kicker" }, CATEGORY[cat] ?? cat),
        h("div", { class: "stack" }, ...called.filter((c) => c.variant.category === cat).map((c) => traitCard(c, pi, tf))))),
      missing.length ? h("details", { class: "card flat more", style: "margin-top:28px" }, h("summary", {}, `${missing.length} variants not callable on this chip`),
        h("ul", { class: "small muted" }, ...missing.map((c) => h("li", {}, `${c.variant.name} (${c.variant.rsid}): ${c.status.replace(/-/g, " ")}${c.note ? `, ${c.note}` : ""}`)))) : null);
  });
  return root;
}

function traitCard(c: TraitCall, pi: Awaited<ReturnType<typeof populationIndex>>, tf: Awaited<ReturnType<typeof traitFrequencies>>): HTMLElement {
  const v = c.variant;
  const marker = tf.markers[v.rsid];
  const freqOf = (code: string) => marker?.frequencies[code]?.[v.effectAllele];
  const nOf = (code: string) => marker?.chromosomes[code] ?? 0;
  const ranked = marker ? pi.groups.flatMap((g) => g.pops).map((p) => ({ p, f: freqOf(p.code) ?? 0 })).sort((a, b) => b.f - a.f) : [];
  const chart = marker ? (view === "strip"
    ? responsive((w) => frequencyStrip({ width: w, groups: pi.groups, freq: freqOf, n: nOf, color: (sp) => componentColor(sp === "AMR" ? "NAT" : sp), allele: v.effectAllele, compact: w < 560 }))
    : responsive((w) => worldMap(pi.groups.flatMap((g) => g.pops.map((p) => ({
        code: p.code, lat: p.lat, lon: p.lon, r: w < 520 ? 5 : 7, color: componentColor(g.code === "AMR" ? "NAT" : g.code), pie: freqOf(p.code) ?? 0, hollow: p.diaspora,
        tip: () => h("span", {}, h("b", {}, `${p.code} · ${p.name}`), h("br"), `${v.effectAllele}: ${fmt.pct(freqOf(p.code) ?? 0, 1)} of ${nOf(p.code)} chromosomes`),
      }))), { width: w, latTop: 66, latBottom: -40 }))) : h("p", { class: "small faded" }, "No 26-population frequencies for this marker.");
  return figure({
    kicker: `${v.gene} · ${v.rsid}`,
    title: h("span", {}, v.name),
    body: h("div", { class: "grid g-side", style: "align-items:start" },
      h("div", { class: "trait-card" },
        h("div", { style: "display:flex;align-items:center;gap:12px" }, genotype(c), h("span", { class: "small faded" }, `${c.effectAlleleCount} cop${c.effectAlleleCount === 1 ? "y" : "ies"} of the ${v.effectAllele} allele${c.status === "strand-flipped" ? " · read on the other strand" : ""}`)),
        h("p", { style: "margin:4px 0 0;font-size:16px" }, c.interpretation ?? ""),
        h("details", { class: "more" }, h("summary", {}, "Evidence and caveats"),
          h("p", { class: "small muted" }, h("strong", {}, "Evidence. "), v.evidenceSummary),
          h("p", { class: "small muted" }, h("strong", {}, "Caveats. "), v.caveats),
          h("p", { class: "small" }, ...v.sources.flatMap((src, i) => [i ? " · " : "", h("a", { href: `https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`, target: "_blank", rel: "noopener" }, `${src.authors.split(",")[0]} ${src.year}, ${src.journal}, PMID ${src.pmid}`)])))),
      h("div", {},
        h("p", { class: "kicker", style: "color:var(--ink-3);margin-bottom:6px" }, `How common is ${v.effectAllele}?`),
        chart,
        ranked.length ? h("p", { class: "chart-note" }, `Most common in ${ranked.slice(0, 2).map((r) => `${r.p.name} (${fmt.pct0(r.f)})`).join(" and ")}; rarest in ${ranked.slice(-2).map((r) => `${r.p.name} (${fmt.pct0(r.f)})`).join(" and ")}.`) : null)),
    foot: h("span", {}, `Frequencies counted from the 1000 Genomes phase 3 genotype files${view === "strip" ? "; whiskers are 95% Wilson intervals for each population's sample size" : "; each pie's filled share is the frequency"}.`),
  });
}

function genotype(c: TraitCall): HTMLElement {
  const g = c.genotype ?? "";
  return h("span", { class: "geno", "aria-label": `Genotype ${g}` }, ...g.split("").map((a) => h("b", { class: a === c.variant.effectAllele ? "eff" : "" }, a)));
}

function shortName(name: string): string {
  const short = name.replace(/\s*\(.*\)\s*$/, "").replace(/^[A-Z0-9]+\s+/, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}
