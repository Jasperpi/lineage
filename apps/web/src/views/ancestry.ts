/**
 * Ancestry: genetic similarity to reference samples, reported with its
 * uncertainty in the primary view. Every figure's title states its finding.
 */
import { h, s, fmt, tip, clear } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { ensureAncestry } from "../lib/actions.js";
import { figure, responsive, segmented } from "../charts/common.js";
import { worldMap } from "../charts/worldmap.js";
import { chromosomeChart } from "../charts/chromosomes.js";
import { pcaScatter } from "../charts/pca.js";
import { structurePlot } from "../charts/structure.js";
import { componentColor, populationColor, SUPER_LABEL } from "../lib/colors.js";
import { load, panelMeta, populationIndex, referenceSamples, type Population } from "../lib/reference.js";
import { cite, paperUrl } from "../lib/citations.js";
import { emptyState } from "./empty.js";
import type { AncestryResult } from "../lib/protocol.js";

type Caution = "cautious" | "standard" | "complete";
const THRESHOLD: Record<Caution, number> = { cautious: 0.95, standard: 0.8, complete: 0.5 };
let caution: Caution = "standard";
let pcs: [number, number] = [0, 1];

export function ancestry(): HTMLElement {
  if (!state.you) return emptyState("Ancestry", "Genetic similarity, with its uncertainty on show", "Open a raw data file, or use the demo family, to compare a genome with 2,504 reference genomes from 26 populations.");
  if (!state.ancestry) {
    void ensureAncestry();
    return h("div", { class: "loading" }, h("div", { class: "spinner" }), h("div", {}, "Comparing your file with the reference panel. This takes a few seconds and happens entirely in this tab."));
  }
  const a = state.ancestry;
  const root = h("div", { class: "fade-in" }, h("div", { class: "loading" }, h("div", { class: "spinner" })));
  Promise.all([populationIndex(), panelMeta(), referenceSamples(), load<PaintingValidation>("validation.json").catch(() => undefined)])
    .then(([pi, meta, ref, val]) => clear(root, ...page(a, pi, meta, ref, val)));
  return root;
}

interface PaintingValidation { overall: Record<Caution, { accuracy: number; painted: number }> }

function page(a: AncestryResult, pi: Awaited<ReturnType<typeof populationIndex>>, meta: Awaited<ReturnType<typeof panelMeta>>, ref: Awaited<ReturnType<typeof referenceSamples>>, val?: PaintingValidation): Node[] {
  const who = state.you?.demo ? "Leo's" : "Your";
  const ranked = [...a.similarity.scores].sort((x, y) => x.rank - y.rank);
  const top = ranked.slice(0, 3).map((r) => pi.byCode.get(r.population)!);
  const colorOfPop = new Map<string, string>();
  for (const g of pi.groups) g.pops.forEach((p, i) => colorOfPop.set(p.code, populationColor(g.code, i, g.pops.length)));
  const comp = a.admixture;
  const coverage = a.coverage.called / a.coverage.total;

  /* ---------------- Fig. 1: map ---------------- */
  const mapPoints = pi.groups.flatMap((g) => g.pops.map((p) => {
    const sc = a.similarity.scores.find((x) => x.population === p.code)!;
    const strength = 1 - (sc.rank - 1) / 25;
    return {
      code: p.code, lat: p.lat, lon: p.lon, color: colorOfPop.get(p.code)!, r: 3 + 6 * strength ** 2, halo: strength ** 3, hollow: p.diaspora, origin: sc.rank <= 3 ? p.origin : undefined,
      label: sc.rank <= 3 ? `${sc.rank}. ${p.code}` : undefined,
      tip: () => h("span", {}, h("b", {}, `#${sc.rank} · ${p.code} · ${p.name}`), h("br"), p.description, h("br"), h("span", { class: "mono" }, sc.rank === 1 ? "best fit" : `${fmt.num(sc.gapPer1000, 1)} log-likelihood units per 1,000 SNPs below the best`), p.note ? h("span", {}, h("br"), p.note) : null),
    };
  }));
  const fig1 = figure({
    kicker: "Fig. 1 · Genetic similarity",
    title: `${who} genotypes are most similar to the ${top[0]!.name} (${top[0]!.code}) reference samples, then ${top[1]!.code} and ${top[2]!.code}`,
    caption: "Each point is a 1000 Genomes population at the place it was sampled. Bigger, stronger points explain these genotypes better. Hollow points were sampled away from their ancestral region; a dashed line, where shown, leads to the country of ancestry. This is similarity to samples, not a statement about nationality or identity.",
    body: h("div", {}, responsive((w, first) => worldMap(mapPoints, { width: w, labelSize: w < 520 ? 10 : 11, animate: first, pointScale: w < 520 ? 0.7 : 1 }), { min: 260 }), topList(ranked.slice(0, 5), pi.byCode, colorOfPop)),
    foot: h("span", {}, `Hardy-Weinberg log-likelihood under each population's allele frequencies, ${fmt.int(a.similarity.snps)} LD-pruned SNPs. Reference: `, h("a", { href: paperUrl("kg2015"), target: "_blank", rel: "noopener" }, "1000 Genomes phase 3"), "."),
  });

  /* ---------------- Fig. 2: components ---------------- */
  const compBox = h("div");
  const paintBox = h("div");
  // One caution level drives both the component list and the painting; each figure carries a copy of the control.
  const toolSlots = [h("span"), h("span")];
  const drawTools = () => toolSlots.forEach((slot) => clear(slot, segmented<Caution>([["cautious", "Cautious"], ["standard", "Standard"], ["complete", "Complete"]], caution, (v) => { caution = v; drawTools(); drawComponents(); })));
  const drawComponents = () => {
    const rows = comp.components.map((id, i) => ({ id, label: a.components[i]!.label, p: comp.proportions[i]!, ci: comp.ci95[i]! }))
      .sort((x, y) => y.p - x.p);
    const mayBeNone = (r: typeof rows[number]) => r.ci[0] < 0.005;
    const shown = rows.filter((r) => caution === "complete" ? true : caution === "standard" ? r.p >= 0.01 : !mayBeNone(r));
    const hidden = rows.filter((r) => !shown.includes(r));
    const unassigned = hidden.reduce((acc, r) => acc + r.p, 0);
    clear(compBox,
      h("div", { style: "display:flex;height:22px;border-radius:999px;overflow:hidden;margin:4px 0 16px;border:1px solid var(--rule)" },
        ...shown.map((r) => h("span", { style: `width:${r.p * 100}%;background:${componentColor(r.id)}`, title: `${r.label} ${fmt.pct(r.p)}` })),
        unassigned > 0 ? h("span", { style: `width:${unassigned * 100}%;background:repeating-linear-gradient(45deg,var(--rule),var(--rule) 3px,var(--card) 3px,var(--card) 6px)`, title: "Not assigned at this caution level" }) : null),
      ...shown.map((r) => h("div", { class: "bar-row stack-sm", style: mayBeNone(r) ? "opacity:.55" : "" },
        h("span", { class: "name" }, h("i", { class: "swatch", style: `background:${componentColor(r.id)}` }), r.label),
        h("span", { class: "bar-track" }, h("i", { style: `width:${r.p * 100}%;background:${componentColor(r.id)}` }), h("span", { class: "ci", style: `left:${r.ci[0] * 100}%;width:${Math.max(0.4, (r.ci[1] - r.ci[0]) * 100)}%` })),
        h("span", { class: "val" }, `${fmt.pct(r.p, r.p < 0.1 ? 1 : 0)}`, h("span", { class: "faded", style: "display:block;font-size:11px" }, mayBeNone(r) ? "could be none" : `${fmt.pct0(r.ci[0])}–${fmt.pct0(r.ci[1])}`)))),
      hidden.length ? h("p", { class: "chart-note" }, `${caution === "cautious" ? "Cautious" : "Standard"} view: ${hidden.map((r) => r.label).join(", ")} (${fmt.pct(unassigned, 1)} together) ${hidden.length === 1 ? "is" : "are"} shown as unassigned because ${caution === "cautious" ? "the interval includes zero" : "the estimate is under 1%"}.`) : null);
    drawPainting();
  };
  const fig2 = figure({
    kicker: "Fig. 2 · Continental components",
    title: `${fmt.pct0(Math.max(...comp.proportions))} of ${state.you?.demo ? "Leo's" : "your"} genome is best explained by the ${a.components[comp.proportions.indexOf(Math.max(...comp.proportions))]!.label} component`,
    caption: "Five continental components, each defined by reference genomes (Fig. 6 shows how). Bars are estimates; the black whiskers are 95% intervals from resampling blocks of SNPs. Small components are the least reliable: this kind of model tends to over-report small shares.",
    tools: toolSlots[0],
    body: compBox,
    foot: h("span", {}, `EM with the component frequencies fixed (ADMIXTURE's projection mode, `, h("a", { href: paperUrl("admixture2009"), target: "_blank", rel: "noopener" }, cite("admixture2009")), `), accelerated with SQUAREM, ${fmt.int(comp.snpsUsed)} SNPs, ${comp.replicates} block-bootstrap replicates of 50-SNP blocks.`),
  });

  /* ---------------- Fig. 3: painting ---------------- */
  const drawPainting = () => {
    const thr = THRESHOLD[caution];
    let painted = 0, total = 0;
    for (const c of a.painting.chromosomes) for (const w of c.windows) { const len = w.endCm - w.startCm; total += len; if (w.posterior >= thr) painted += len; }
    clear(paintBox,
      responsive((width) => chromosomeChart({
        width, rowH: width < 520 ? 14 : 16, label: "Continental ancestry along each autosome",
        tracks: [{ draw: (c, g, x, y, hh) => {
          const ch = a.painting.chromosomes.find((z) => z.chrom === c);
          for (const w of ch?.windows ?? []) {
            const x0 = x(w.start), x1 = Math.max(x0 + 0.8, x(w.end));
            const sure = w.posterior >= thr;
            const [p, q] = w.pair;
            const top = s("rect", { x: x0, y, width: x1 - x0 + 0.4, height: hh / 2, fill: sure ? componentColor(comp.components[p]!) : "var(--rule)" });
            const bottom = s("rect", { x: x0, y: y + hh / 2, width: x1 - x0 + 0.4, height: hh / 2, fill: sure ? componentColor(comp.components[q]!) : "var(--rule)" });
            const grp = s("g", {}, top, bottom);
            tip(grp, () => h("span", {}, h("b", {}, `chr${c}: ${fmt.mb(w.start)}–${fmt.mb(w.end)}`), h("br"),
              `Most likely ${a.components[p]!.label}${p === q ? " on both copies" : ` and ${a.components[q]!.label}`}`, h("br"),
              h("span", { class: "mono" }, `posterior ${fmt.pct0(w.posterior)} · ${w.snps} SNPs${sure ? "" : " · below the caution threshold"}`)));
            g.append(grp);
          }
        } }],
      })),
      h("div", { class: "legend", style: "margin-top:12px" },
        ...comp.components.map((id, i) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(id)}` }), `${a.components[i]!.label} ${fmt.pct(a.painting.totals[i]!, 0)}`)),
        h("span", {}, h("i", { class: "swatch", style: "background:var(--rule)" }), `not painted (${fmt.pct(1 - painted / Math.max(1, total), 0)})`)),
      val ? h("p", { class: "note", style: "margin-top:14px" }, h("strong", {}, "Measured accuracy. "), `On test genomes spliced from real reference chromosomes, where the answer is known, ${fmt.pct(val.overall[caution].accuracy, 1)} of windows painted at the ${caution} setting were right, and ${fmt.pct(val.overall[caution].painted, 0)} of windows were painted. Details on the `, h("a", { href: "#/evidence" }, "Evidence"), " page.") : null);
  };
  const fig3 = figure({
    kicker: "Fig. 3 · Painting, continental resolution only",
    title: "Each chromosome, painted where the evidence is strong enough",
    caption: `Windows of about ${a.painting.settings.windowSnps} SNPs, each assigned the most probable pair of components. The file is unphased, so the two halves of each bar are the two copies in no particular order. A window is painted only when its posterior probability reaches 95% (Cautious), 80% (Standard) or 50% (Complete); the rest stay grey. Lineage does not paint finer than continents: published methods cannot reliably tell close populations apart segment by segment.`,
    tools: toolSlots[1],
    body: paintBox,
    foot: h("span", {}, `Hidden Markov model over component pairs, switch rate from genetic distance (${a.painting.settings.generations} generations), window likelihoods tempered by ${a.painting.settings.tempering} for linkage. Context: `, h("a", { href: paperUrl("flare2023"), target: "_blank", rel: "noopener" }, cite("flare2023")), " report r² 0.993 for three continents but 0.888 when two close populations are included."),
  });

  /* ---------------- Fig. 4: PCA ---------------- */
  const pcaBox = h("div");
  const drawPca = () => clear(pcaBox, responsive((w) => pcaScatter({ width: w, ref, popInfo: pi.byCode, colorOf: (sp) => componentColor(sp === "AMR" ? "NAT" : sp), pcX: pcs[0], pcY: pcs[1], you: a.pca.pcs, youLabel: state.you?.demo ? "Leo" : "You", variance: meta.pca.varianceExplained })),
    h("div", { class: "legend", style: "margin-top:10px" }, ...pi.groups.map((g) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(g.code === "AMR" ? "NAT" : g.code)}` }), SUPER_LABEL[g.code] ?? g.name))));
  drawPca();
  const fig4 = figure({
    kicker: "Fig. 4 · Principal components",
    title: `${state.you?.demo ? "Leo sits" : "You sit"} among 2,504 reference genomes`,
    caption: "Each dot is one reference genome; codes mark population centres. The axes are the directions along which the reference genomes differ most. Your genotypes are projected by least squares, which lets SNPs missing from your chip drop out, and scaled up by factors measured on held-out genomes, because a projected sample otherwise sits too close to the middle.",
    tools: segmented<string>([["0,1", "PC1 × PC2"], ["2,3", "PC3 × PC4"], ["0,4", "PC1 × PC5"]], pcs.join(","), (v) => { pcs = v.split(",").map(Number) as [number, number]; drawPca(); }),
    body: pcaBox,
    foot: h("span", {}, `PCA of ${fmt.int(meta.qc.core)} LD-pruned SNPs in 2,504 genomes (`, h("a", { href: paperUrl("eigen2006"), target: "_blank", rel: "noopener" }, cite("eigen2006")), `); shrinkage factors ${meta.pca.shrinkage.slice(0, 4).map((x) => x.toFixed(2)).join(", ")} from five-fold hold-out; ${fmt.int(a.pca.snpsUsed)} of your SNPs used.`),
  });

  /* ---------------- Fig. 5: full ranking ---------------- */
  const fig5 = figure({
    kicker: "Fig. 5 · All 26 populations",
    title: "The full ranking, grouped by continent",
    caption: "How much worse each population explains these genotypes than the best one, in log-likelihood units per 1,000 SNPs. Shorter bars are closer. Admixed and diaspora populations (Americas, ASW, ACB) often rank high for people with mixed ancestry, because they are mixtures too.",
    body: rankingChart(a, pi.groups, colorOfPop),
    foot: h("span", {}, "Leave-one-out check on the reference itself: see Evidence for how often each population's own genomes rank it first."),
  });

  /* ---------------- Fig. 6: the reference itself ---------------- */
  const order = pi.groups.flatMap((g) => g.pops.map((p) => p.code));
  const fig6 = figure({
    kicker: "Fig. 6 · What the components mean",
    title: "The reference panel itself: 2,504 genomes, each a column",
    caption: "Each thin column is one reference genome, coloured by its share of each component. The African, European, East Asian and South Asian samples define their continents' components, so they are single-coloured by construction. The admixed American, African-American and African-Caribbean samples were estimated: they mix Indigenous American, European and African components, and the Indigenous American component was learned from them, because 1000 Genomes has no unadmixed Indigenous American samples. The components are continental averages, which is why they carry continental names and nothing finer.",
    body: h("div", {}, responsive((w) => structurePlot({ width: w, ref, order, colors: ref.components.map((c) => componentColor(c)), popInfo: pi.byCode, highlight: top[0]!.code })),
      h("div", { class: "legend", style: "margin-top:10px" }, ...a.components.map((c) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(c.id)}` }), c.label)))),
    foot: h("span", {}, `ADMIXTURE's likelihood in its supervised mode, K = 5: 20 reference populations fixed, ${meta.admixture.estimated?.length ?? 6} admixed populations estimated; ${meta.admixture.iterations} EM updates with SQUAREM acceleration (`, h("a", { href: paperUrl("admixture2009"), target: "_blank", rel: "noopener" }, cite("admixture2009")), ").")
  });

  /* ---------------- Method card ---------------- */
  const method = h("div", { class: "grid g2", style: "align-items:start" },
    h("div", { class: "card" },
      h("p", { class: "kicker" }, "How sure is this?"),
      h("ul", { class: "small muted", style: "margin:0;padding-left:18px;display:grid;gap:8px" },
        h("li", {}, `${fmt.int(a.coverage.called)} of the ${fmt.int(a.coverage.total)} reference-panel SNPs were found in this file (${coverage > 0.99 ? fmt.pct(coverage, 1) : fmt.pct0(coverage)}).${a.coverage.strandFlipped ? ` ${fmt.int(a.coverage.strandFlipped)} were read on the other strand and flipped.` : ""}${a.coverage.alleleMismatch ? ` ${fmt.int(a.coverage.alleleMismatch)} had alleles that fit neither strand and were left out.` : ""}`),
        h("li", {}, "The reference has no samples from the Middle East, North Africa, Central Asia, Oceania or unadmixed Indigenous Americans. Ancestry from those places is described in terms of the populations that are present."),
        h("li", {}, "Seven populations were sampled away from their ancestral region: in Utah, Houston, Los Angeles, the south-western US and Barbados, and two in the UK. The map marks them with hollow points."),
        h("li", {}, "Components are continental. Similarity between, say, Tuscan and Iberian samples is real but small, so the ranking can swap close neighbours."))),
    h("div", { class: "card" },
      h("p", { class: "kicker navy" }, "Words we use"),
      h("p", { class: "small muted" }, h("strong", {}, "Genetic similarity"), " means how well a reference group's allele frequencies explain your genotypes. It is not ethnicity, nationality or identity, which are social facts no genome can settle."),
      h("p", { class: "small muted" }, h("strong", {}, "Component"), " means one of five continental groups of reference genomes, described by their allele frequencies; each is a continent-scale average, not a people."),
      h("p", { class: "small muted", style: "margin:0" }, h("strong", {}, "Ancient DNA"), " is not modelled for individuals here. Published three-source models of Europe describe populations, not a person (", h("a", { href: paperUrl("haak2015"), target: "_blank", rel: "noopener" }, cite("haak2015")), "; ", h("a", { href: paperUrl("harney2021"), target: "_blank", rel: "noopener" }, cite("harney2021")), ").")));

  drawTools();
  drawComponents();
  const lowCoverage = a.coverage.called < 20000
    ? h("div", { class: "note warn", style: "margin-bottom:24px" }, h("strong", {}, `Only ${fmt.int(a.coverage.called)} of the reference panel's SNPs were found in this file. `),
        "Consumer chips usually share 100,000 or more. Results below rest on less evidence than usual and their intervals are wider. If this file is not a GRCh37 genotype file from a consumer test, the results may not be meaningful.")
    : null;
  return [
    lowCoverage ?? h("span"),
    h("div", { class: "page-head" },
      h("p", { class: "kicker" }, state.you?.demo ? "Ancestry · demo" : "Ancestry"),
      h("h1", { class: "h1" }, "Genetic similarity, ", h("em", {}, "with its uncertainty on show")),
      h("p", { class: "lede" }, `Compared with 2,504 genomes from 26 populations on ${fmt.int(a.coverage.called)} shared SNPs, in ${fmt.num(a.ms / 1000, 1)} seconds, in this tab.`)),
    h("div", { class: "stack-l" }, fig1, fig2, fig3, fig4, fig5, fig6, method),
  ];
}

function topList(rows: AncestryResult["similarity"]["scores"], byCode: Map<string, Population>, colors: Map<string, string>): HTMLElement {
  return h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:14px" },
    ...rows.map((r) => {
      const p = byCode.get(r.population)!;
      return h("div", { class: "stat", style: "padding:10px 12px" },
        h("div", { class: "label" }, `#${r.rank} · ${p.code}`),
        h("div", { style: "font-weight:600;margin-top:4px;display:flex;align-items:center;gap:6px" }, h("i", { class: "swatch", style: `background:${colors.get(p.code)};margin:0` }), p.name),
        h("div", { class: "sub" }, r.rank === 1 ? "best fit" : `−${fmt.num(r.gapPer1000, 1)} per 1,000 SNPs`));
    }));
}

function rankingChart(a: AncestryResult, groups: Array<{ code: string; name: string; pops: Population[] }>, colors: Map<string, string>): HTMLElement {
  const maxGap = Math.max(...a.similarity.scores.map((s) => s.gapPer1000), 1);
  return h("div", { class: "grid g2", style: "gap:4px 28px" },
    ...groups.map((g) => h("div", {},
      h("p", { class: "kicker", style: "margin:12px 0 4px;color:var(--ink-3)" }, g.name),
      ...g.pops.map((p) => {
        const sc = a.similarity.scores.find((x) => x.population === p.code)!;
        return h("div", { class: "bar-row", style: "grid-template-columns:minmax(90px,180px) 1fr 58px;padding:4px 0" },
          h("span", { class: "name", title: p.description }, h("span", { class: "mono", style: "color:var(--ink-3);margin-right:6px" }, p.code), p.name),
          h("span", { class: "bar-track", style: "height:8px" }, h("i", { style: `width:${Math.max(1.5, (sc.gapPer1000 / maxGap) * 100)}%;background:${colors.get(p.code)};opacity:${sc.rank <= 3 ? 1 : 0.55}` })),
          h("span", { class: "val" }, sc.rank === 1 ? "best" : `#${sc.rank}`));
      }))));
}
