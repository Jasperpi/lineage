/**
 * Ancestry: genetic similarity to reference samples, reported with its
 * uncertainty in the primary view. Every figure's title states its finding,
 * and says less when the evidence supports less: a set of populations
 * instead of one, "Broadly" a continent instead of a region, a notice when
 * the reference does not describe the genome well.
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
import { cite, paperUrl, type PaperKey } from "../lib/citations.js";
import { emptyState } from "./empty.js";
import type { AncestryResult } from "../lib/protocol.js";
import type { AncestryNode } from "@lineage/core";

type Caution = "cautious" | "standard" | "complete";
const THRESHOLD: Record<Caution, number> = { cautious: 0.95, standard: 0.8, complete: 0.5 };
let caution: Caution = "standard";
let pcs: [number, number] = [0, 1];

export function ancestry(): HTMLElement {
  if (!state.you) return emptyState("Ancestry", "Genetic similarity, with its uncertainty on show", "Open a raw data file, or use the demo family, to compare a genome with the reference genomes of Lineage's panel.");
  if (!state.ancestry) {
    void ensureAncestry();
    return h("div", { class: "loading" }, h("div", { class: "spinner" }), h("div", {}, "Comparing your file with the reference panel. This takes a few seconds and happens entirely in this tab."));
  }
  const a = state.ancestry;
  const root = h("div", { class: "fade-in" }, h("div", { class: "loading" }, h("div", { class: "spinner" })));
  Promise.all([populationIndex(), panelMeta(), referenceSamples(), load<ValidationFile>("validation.json").catch(() => undefined)])
    .then(([pi, meta, ref, val]) => clear(root, ...page(a, pi, meta, ref, val)));
  return root;
}

/** The painting accuracy by threshold, from either version of validation.json. */
interface ValidationFile {
  overall?: Record<Caution, { accuracy: number; painted: number }>;
  painting?: { byThreshold?: Record<Caution, { accuracy: number; painted: number }> };
}

const link = (key: PaperKey, text?: string) => h("a", { href: paperUrl(key), target: "_blank", rel: "noopener" }, text ?? cite(key));

function page(a: AncestryResult, pi: Awaited<ReturnType<typeof populationIndex>>, meta: Awaited<ReturnType<typeof panelMeta>>, ref: Awaited<ReturnType<typeof referenceSamples>>, val?: ValidationFile): Node[] {
  const demo = !!state.you?.demo;
  const who = demo ? "Leo's" : "Your";
  const refName = meta.notes?.referenceName ?? "1000 Genomes phase 3";
  const genomes = meta.notes?.genomes ?? ref.pop.length;
  const cal = a.calibration;
  const ranked = [...a.similarity.scores].sort((x, y) => x.rank - y.rank);
  const known = ranked.filter((r) => pi.byCode.has(r.population));
  const nameOf = (code: string) => pi.byCode.get(code)?.name ?? code;
  const colorOfPop = new Map<string, string>();
  for (const g of pi.groups) g.pops.forEach((p, i) => colorOfPop.set(p.code, populationColor(g.code, i, g.pops.length)));
  const comp = a.admixture;
  const coverage = a.coverage.called / a.coverage.total;
  const paintVal = val?.painting?.byThreshold ?? val?.overall;

  /* ---------------- Notices ---------------- */
  const notices: HTMLElement[] = [];
  if (a.build.build === 38) notices.push(h("div", { class: "note", style: "margin-bottom:16px" }, h("strong", {}, "This file uses GRCh38 positions. "), "It was matched to the panel through each SNP's GRCh38 position, so nothing was lost; other pages that assume GRCh37 may show less for it."));
  if (a.coverage.called < 20000) notices.push(h("div", { class: "note warn", style: "margin-bottom:16px" }, h("strong", {}, `Only ${fmt.int(a.coverage.called)} of the reference panel's SNPs were found in this file. `),
    a.build.build === "unknown" ? "Its positions match neither GRCh37 nor GRCh38 well, so it may not be a consumer genotype file, or it may use another build. " : "Consumer chips usually share many more. ",
    "Results below rest on less evidence than usual and their intervals are wider."));
  if (a.painting.fit.outside) notices.push(h("div", { class: "note warn", style: "margin-bottom:16px" },
    h("strong", {}, "Part of this genome is not well described by the reference populations. "),
    `Its genotypes fit the painted ancestry worse than 99% of held-out reference genomes do (fit z = ${fmt.num(a.painting.fit.z, 1)}${a.painting.fit.flagged ? `; ${fmt.int(a.painting.fit.flagged)} windows stand out` : ""}). Ancestry from populations the panel lacks is described below in terms of the nearest ones present, so the shares may be misleading. The limitations are listed under "How sure is this?".`));

  /* ---------------- Fig. 1: similarity ---------------- */
  const set = a.similarity.set;
  const mapPoints = known.flatMap((sc) => {
    const p = pi.byCode.get(sc.population)!;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return [];
    const inSet = sc.inSet ?? sc.rank <= 3;
    const strength = sc.probability !== undefined ? Math.max(0.15, Math.sqrt(sc.probability)) : 1 - (sc.rank - 1) / Math.max(1, known.length - 1);
    return [{
      code: p.code, lat: p.lat, lon: p.lon, color: colorOfPop.get(p.code) ?? "var(--ink-3)", r: 3 + 6 * strength ** 2, halo: inSet ? strength ** 2 : strength ** 3, hollow: p.diaspora, origin: inSet ? p.origin : undefined,
      label: inSet && sc.rank <= 4 ? `${sc.rank}. ${p.code}` : undefined,
      tip: () => h("span", {}, h("b", {}, `#${sc.rank} · ${p.code} · ${p.name}`), h("br"), p.description, h("br"),
        h("span", { class: "mono" }, sc.probability !== undefined ? `probability ${fmt.prob(sc.probability)}${sc.inSet ? " · in the 95% set" : ""}` : sc.rank === 1 ? "best fit" : `${fmt.num(sc.gapPer1000, 1)} log-likelihood units per 1,000 SNPs below the best`),
        p.note ? h("span", {}, h("br"), p.note) : null),
    }];
  });
  const top = known.slice(0, 3);
  const fig1Title = set && set.length
    ? set.length === 1
      ? `${who} genotypes are closest to the ${nameOf(set[0]!)} (${set[0]}) reference samples`
      : `${who} genotypes are closest to one of ${set.length} reference populations: ${set.slice(0, 4).join(", ")}${set.length > 4 ? "…" : ""}`
    : `${who} genotypes are most similar to the ${nameOf(top[0]!.population)} (${top[0]!.population}) reference samples, then ${top.slice(1).map((t) => t.population).join(" and ")}`;
  const fig1 = figure({
    kicker: "Fig. 1 · Genetic similarity",
    title: fig1Title,
    caption: set
      ? `Each point is a reference population at the place it was sampled; bigger, stronger points are more probable. The probabilities are calibrated on held-out reference genomes, and the ${set.length > 1 ? `${set.length} populations named in the title form` : "population named in the title forms"} a 95% set: for genomes like the reference, the set contains the right population ${cal.conformalCoverage !== undefined ? fmt.pct0(cal.conformalCoverage) : "95%"} of the time. Close neighbours often cannot be told apart, and the set says so rather than picking one. This is similarity to samples, not nationality or identity.`
      : "Each point is a reference population at the place it was sampled. Bigger, stronger points explain these genotypes better. Hollow points were sampled away from their ancestral region; a dashed line, where shown, leads to the country of ancestry. The ranking is not yet calibrated into probabilities, and close neighbours can swap places. This is similarity to samples, not a statement about nationality or identity.",
    body: h("div", {}, responsive((w, first) => worldMap(mapPoints, { width: w, labelSize: w < 520 ? 10 : 11, animate: first, pointScale: w < 520 ? 0.7 : 1 }), { min: 260 }), topList(known.slice(0, set ? Math.max(3, Math.min(6, set.length)) : 5), pi.byCode, colorOfPop)),
    foot: h("span", {}, `Log-likelihood under each population's allele frequencies, with each frequency's sampling error (`, link("rannala1997"), `) and a genotype-error term, over ${fmt.int(a.similarity.snps)} LD-pruned SNPs. Reference: ${refName}.`),
  });

  /* ---------------- Fig. 2: components ---------------- */
  const nodes = a.tree.nodes;
  const compBox = h("div");
  const paintBox = h("div");
  // One caution level drives both the component list and the painting; each figure carries a copy of the control.
  const toolSlots = [h("span"), h("span")];
  const drawTools = () => toolSlots.forEach((slot) => clear(slot, segmented<Caution>([["cautious", "Cautious"], ["standard", "Standard"], ["complete", "Complete"]], caution, (v) => { caution = v; drawTools(); drawComponents(); })));
  const colorOf = (n: AncestryNode) => {
    if (n.kind === "continent") return componentColor(n.id);
    const siblings = nodes.filter((x) => x.parent === n.parent);
    return n.kind === "broadly" ? componentColor(n.parent!) : populationColor(n.parent!, siblings.indexOf(n), siblings.length + 1);
  };
  const visible = (n: AncestryNode) => caution === "complete" ? n.share >= 0.0005 : caution === "standard" ? n.present || n.share >= 0.01 : n.present;
  const drawComponents = () => {
    const conts = nodes.filter((n) => n.kind === "continent");
    const shownConts = conts.filter(visible);
    const unassigned = conts.filter((n) => !visible(n)).reduce((acc, n) => acc + n.share, 0);
    const rows = nodes.filter((n) => (n.kind === "continent" ? visible(n) : visible(n) && visible(nodes.find((c) => c.id === n.parent)!)));
    clear(compBox,
      h("div", { style: "display:flex;height:22px;border-radius:999px;overflow:hidden;margin:4px 0 16px;border:1px solid var(--rule)" },
        ...shownConts.map((r) => h("span", { style: `width:${r.share * 100}%;background:${colorOf(r)}`, title: `${r.label} ${fmt.pct(r.share)}` })),
        unassigned > 0 ? h("span", { style: `width:${unassigned * 100}%;background:repeating-linear-gradient(45deg,var(--rule),var(--rule) 3px,var(--card) 3px,var(--card) 6px)`, title: "Not assigned at this caution level" }) : null),
      ...rows.map((r) => {
        const sub = r.kind !== "continent";
        return h("div", { class: "bar-row stack-sm", style: `${r.present ? "" : "opacity:.55;"}${sub ? "padding-left:18px;" : ""}` },
          h("span", { class: "name", style: sub ? "font-weight:400" : "font-weight:600" }, h("i", { class: "swatch", style: `background:${colorOf(r)}` }), r.kind === "broadly" ? h("em", {}, r.label) : r.label,
            r.frequencyOnly ? h("span", { class: "faded", title: "This reference group exists only as published allele frequencies (no individual genomes), so its similarity is measured but it cannot appear on the PCA." }, " · frequencies only") : null),
          h("span", { class: "bar-track" }, h("i", { style: `width:${r.share * 100}%;background:${colorOf(r)}` }), h("span", { class: "ci", style: `left:${r.ci95[0] * 100}%;width:${Math.max(0.4, (r.ci95[1] - r.ci95[0]) * 100)}%` })),
          h("span", { class: "val" }, `${fmt.pct(r.share, r.share < 0.1 ? 1 : 0)}`, h("span", { class: "faded", style: "display:block;font-size:11px" }, r.present ? `${fmt.pct(r.ci95[0], r.ci95[0] < 0.1 ? 1 : 0)}–${fmt.pct(r.ci95[1], r.ci95[1] < 0.1 ? 1 : 0)}` : r.ci95[0] > 0 ? "not shown to be present" : "could be none")));
      }),
      unassigned > 0 ? h("p", { class: "chart-note" }, `${caution === "cautious" ? "Cautious" : "Standard"} view: ${fmt.pct(unassigned, 1)} of the genome is shown as unassigned, because the components it went to ${caution === "cautious" ? "did not pass the presence test" : "are under 1% and did not pass the presence test"}.`) : null);
    drawPainting();
  };
  const lead = nodes.find((n) => n.kind === "continent")!;
  const leadRegion = nodes.find((n) => n.parent === lead.id && n.kind === "region");
  const regional = !!a.regional;
  const fig2 = figure({
    kicker: regional ? "Fig. 2 · Continental and regional components" : "Fig. 2 · Continental components",
    title: `${fmt.pct0(lead.share)} of ${demo ? "Leo's" : "your"} genome is best explained by the ${lead.label} component${leadRegion && leadRegion.share >= 0.2 ? `, most of it ${leadRegion.label}` : ""}`,
    caption: `${regional ? "Continents, and within them the regions the evidence supports. A region is listed only when it passes the presence test and, on held-out genomes, is right at least 90% of the time at that share; the rest of a continent is reported as “Broadly” that continent. " : `${comp.components.length} continental components, each defined by reference genomes (Fig. 6 shows how). `}Bars are estimates; the black whiskers are 95% profile-likelihood intervals, which start at zero when the data cannot rule a component out. A component counts as present only if a likelihood-ratio test rejects “none” at 1%${cal.loaded ? " and its share is above the level genomes without that ancestry reach 1% of the time" : ""}. ${cal.loaded ? `On held-out genomes the intervals contained the true share ${cal.intervalCoverage !== undefined ? fmt.pct0(cal.intervalCoverage) : "95%"} of the time.` : "These intervals are not yet calibrated against held-out genomes: they assume the core SNPs are independent, so they may be somewhat narrow."}`,
    tools: toolSlots[0],
    body: compBox,
    foot: h("span", {}, `EM with the component frequencies fixed (ADMIXTURE's projection mode, `, link("admixture2009"), `), each frequency's sampling error part of the likelihood (as in `, link("jorsboe2017"), `), accelerated with SQUAREM; ${fmt.int(comp.snpsUsed)} SNPs.${comp.phi !== 1 ? ` Likelihood ratios scaled by ${fmt.num(comp.phi, 2)} for linkage, as measured in validation.` : ""}`),
  });

  /* ---------------- Fig. 3: painting ---------------- */
  const compLabel = (i: number) => a.components[i]?.label ?? comp.components[i] ?? "";
  const drawPainting = () => {
    const thr = THRESHOLD[caution];
    let painted = 0, total = 0;
    for (const c of a.painting.chromosomes) for (const w of c.windows) { const len = w.endCm - w.startCm; total += len; if (w.posterior >= thr) painted += len; }
    const wz = cal.windowZ;
    clear(paintBox,
      responsive((width) => chromosomeChart({
        width, rowH: width < 520 ? 14 : 16, label: "Continental ancestry along each autosome",
        tracks: [{ draw: (c, g, x, y, hh) => {
          const ch = a.painting.chromosomes.find((z) => z.chrom === c);
          for (const w of ch?.windows ?? []) {
            const x0 = x(w.start), x1 = Math.max(x0 + 0.8, x(w.end));
            const sure = w.posterior >= thr;
            const poor = wz !== undefined && w.fitZ < wz;
            const [p, q] = w.pair;
            const top = s("rect", { x: x0, y, width: x1 - x0 + 0.4, height: hh / 2, fill: sure ? componentColor(comp.components[p]!) : "var(--rule)" });
            const bottom = s("rect", { x: x0, y: y + hh / 2, width: x1 - x0 + 0.4, height: hh / 2, fill: sure ? componentColor(comp.components[q]!) : "var(--rule)" });
            const grp = s("g", {}, top, bottom, poor ? s("rect", { x: x0, y: y - 2, width: x1 - x0 + 0.4, height: 2, fill: "var(--ink)" }) : null);
            tip(grp, () => h("span", {}, h("b", {}, `chr${c}: ${fmt.mb(w.start)}–${fmt.mb(w.end)}`), h("br"),
              `Most likely ${compLabel(p)}${p === q ? " on both copies" : ` and ${compLabel(q)}`}`, h("br"),
              h("span", { class: "mono" }, `probability ${fmt.pct0(w.posterior)} · ${w.snps} SNPs${sure ? "" : " · below the caution threshold"}`),
              poor ? h("span", {}, h("br"), "Poorly explained by any pair of reference components") : null));
            g.append(grp);
          }
        } }],
      })),
      h("div", { class: "legend", style: "margin-top:12px" },
        ...comp.components.map((id, i) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(id)}` }), `${compLabel(i)} ${fmt.pct(a.painting.totals[i]!, 0)}`)),
        h("span", {}, h("i", { class: "swatch", style: "background:var(--rule)" }), `not painted (${fmt.pct(1 - painted / Math.max(1, total), 0)})`),
        wz !== undefined && a.painting.fit.flagged ? h("span", {}, h("i", { class: "swatch", style: "background:var(--ink);height:3px" }), `${fmt.int(a.painting.fit.flagged)} windows poorly explained`) : null),
      paintVal ? h("p", { class: "note", style: "margin-top:14px" }, h("strong", {}, "Measured accuracy. "), `On test genomes where the answer is known, ${fmt.pct(paintVal[caution].accuracy, 1)} of windows painted at the ${caution} setting were right, and ${fmt.pct(paintVal[caution].painted, 0)} of windows were painted. Details on the `, h("a", { href: "#/evidence" }, "Evidence"), " page.") : null);
  };
  const T = a.painting.settings.generations;
  const fig3 = figure({
    kicker: "Fig. 3 · Painting, continental resolution only",
    title: "Each chromosome, painted where the evidence is strong enough",
    caption: `Windows of about ${a.painting.settings.windowSnps} SNPs, each assigned the most probable pair of components. The file is unphased and Lineage does not guess the phase: the two halves of each bar are the two copies in no particular order (on realistically phased data, phase-free painting is the more accurate kind: ${cite("avadhanam2025")}). A window is painted only when its probability reaches 95% (Cautious), 80% (Standard) or 50% (Complete); the rest stay grey. ${a.painting.settings.calibrated ? "The probabilities are calibrated: on held-out genomes, windows shown at 95% were right about 95% of the time." : "The probabilities are the model's own and not yet calibrated against held-out genomes."} Lineage does not paint finer than continents: published methods cannot reliably tell close populations apart segment by segment.`,
    tools: toolSlots[1],
    body: paintBox,
    foot: h("span", {}, `Hidden Markov model over component pairs; ancestry switches with genetic distance at a rate for ${T} generation${T === 1 ? "" : "s"} since admixture, the value from 1 to 32 that best fits this genome; window likelihoods tempered by ${a.painting.settings.tempering} for linkage. Context: `, link("flare2023"), " report r² 0.993 for three continents but 0.888 when two close populations are included."),
  });

  /* ---------------- Fig. 4: PCA ---------------- */
  const pcaBox = h("div");
  const drawPca = () => clear(pcaBox, responsive((w) => pcaScatter({ width: w, ref, popInfo: pi.byCode, colorOf: (sp) => componentColor(sp === "AMR" ? "NAT" : sp), pcX: pcs[0], pcY: pcs[1], you: a.pca.pcs, youCov: a.pca.cov, youLabel: demo ? "Leo" : "You", variance: meta.pca.varianceExplained })),
    h("div", { class: "legend", style: "margin-top:10px" }, ...pi.groups.map((g) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(g.code === "AMR" ? "NAT" : g.code)}` }), SUPER_LABEL[g.code] ?? g.name))));
  drawPca();
  const fig4 = figure({
    kicker: "Fig. 4 · Principal components",
    title: `${demo ? "Leo sits" : "You sit"} among ${fmt.int(genomes)} reference genomes`,
    caption: "Each dot is one reference genome; codes mark population centres. The axes are the directions along which the reference genomes differ most. Your genotypes are projected by least squares, which lets SNPs missing from your chip drop out, and scaled up because a projected genome otherwise sits too close to the middle; the dashed ellipse holds 95% of the positions the same data could have given. Only components whose direction is stable between subsets of the reference are offered.",
    tools: segmented<string>([["0,1", "PC1 × PC2"], ["2,3", "PC3 × PC4"]], pcs.join(","), (v) => { pcs = v.split(",").map(Number) as [number, number]; drawPca(); }),
    body: pcaBox,
    foot: h("span", {}, `PCA of ${fmt.int(meta.qc.core)} LD-pruned SNPs in ${fmt.int(genomes)} genomes (`, link("eigen2006"), `); scores divided by ${a.pca.shrinkage.slice(0, 4).map((x) => x.toFixed(2)).join(", ")}, the shrinkage of `, link("lee2010"), ` (which the pipeline's five-fold hold-out reproduces); ${fmt.int(a.pca.snpsUsed)} of your SNPs used.`),
  });

  /* ---------------- Fig. 5: full ranking ---------------- */
  const fig5 = figure({
    kicker: `Fig. 5 · All ${a.similarity.scores.length} populations`,
    title: "The full ranking, grouped by continent",
    caption: `How much worse each population explains these genotypes than the best one, in log-likelihood units per 1,000 SNPs. Shorter bars are closer.${set ? " Populations in the 95% set are marked." : ""} Admixed and diaspora populations often rank high for people with mixed ancestry, because they are mixtures too.`,
    body: rankingChart(a, pi.groups, colorOfPop),
    foot: h("span", {}, "Leave-one-out check on the reference itself: see Evidence for how often each population's own genomes rank it first."),
  });

  /* ---------------- Fig. 6: the reference itself ---------------- */
  const order = pi.groups.flatMap((g) => g.pops.map((p) => p.code));
  const fig6 = figure({
    kicker: "Fig. 6 · What the components mean",
    title: `The reference panel itself: ${fmt.int(genomes)} genomes, each a column`,
    caption: meta.notes?.components ?? "Each thin column is one reference genome, coloured by its share of each component. The African, European, East Asian and South Asian samples define their continents' components, so they are single-coloured by construction. The admixed American, African-American and African-Caribbean samples were estimated: they mix Indigenous American, European and African components, and the Indigenous American component was learned from them, because 1000 Genomes has no unadmixed Indigenous American samples. The components are continental averages, which is why they carry continental names and nothing finer.",
    body: h("div", {}, responsive((w) => structurePlot({ width: w, ref, order, colors: ref.components.map((c) => componentColor(c)), popInfo: pi.byCode, highlight: top[0]?.population })),
      h("div", { class: "legend", style: "margin-top:10px" }, ...a.components.map((c) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(c.id)}` }), c.label)))),
    foot: h("span", {}, `ADMIXTURE's likelihood in its supervised mode, K = ${a.components.length}; ${meta.admixture.iterations} EM updates with SQUAREM acceleration (`, link("admixture2009"), ").")
  });

  /* ---------------- Method card ---------------- */
  const limitations = meta.notes?.limitations ?? [
    "The reference has no samples from the Middle East, North Africa, Central Asia, Oceania or unadmixed Indigenous Americans, and no Jewish populations. Ancestry from those places is described in terms of the populations that are present.",
    "Seven populations were sampled away from their ancestral region: in Utah, Houston, Los Angeles, the south-western US and Barbados, and two in the UK. The map marks them with hollow points.",
  ];
  const method = h("div", { class: "grid g2", style: "align-items:start" },
    h("div", { class: "card" },
      h("p", { class: "kicker" }, "How sure is this?"),
      h("ul", { class: "small muted", style: "margin:0;padding-left:18px;display:grid;gap:8px" },
        h("li", {}, `${fmt.int(a.coverage.called)} of the ${fmt.int(a.coverage.total)} reference-panel SNPs were found in this file (${coverage > 0.99 ? fmt.pct(coverage, 1) : fmt.pct0(coverage)}).${a.coverage.strandFlipped ? ` ${fmt.int(a.coverage.strandFlipped)} were read on the other strand and flipped.` : ""}${a.coverage.alleleMismatch ? ` ${fmt.int(a.coverage.alleleMismatch)} had alleles that did not match the panel's and were left out.` : ""}${a.coverage.conflicting ? ` ${fmt.int(a.coverage.conflicting)} positions were listed twice with different calls and were left out.` : ""}`),
        h("li", {}, cal.loaded
          ? `Probabilities, intervals and thresholds are calibrated on genomes held out of the reference (validation of ${cal.generated ?? "the current panel"}); the figures are on the Evidence page.`
          : "These results are not yet calibrated against held-out genomes. Until they are, similarity is a ranking rather than probabilities, intervals assume independent SNPs, and the notice for genomes the reference does not describe stays off."),
        h("li", {}, `How well the painted ancestry explains the genotypes: z = ${fmt.num(a.painting.fit.z, 1)} (after allowing ${fmt.num(a.painting.fit.inflation, 1)}× for linkage)${a.painting.fit.outside === undefined ? ", not yet compared with held-out genomes" : a.painting.fit.outside ? ", worse than 99% of held-out genomes" : ", within the range of held-out genomes"}.`),
        ...limitations.map((l) => h("li", {}, l)),
        h("li", {}, "Close populations are hard to tell apart. Similarity between, say, Tuscan and Iberian samples is real but small, so the ranking can swap close neighbours; north-west European countries are not separated at all (even the largest vendor reports 35–43% precision for them: ", link("ancestrydna2025", "AncestryDNA 2025"), ")."))),
    h("div", { class: "card" },
      h("p", { class: "kicker navy" }, "Words we use"),
      h("p", { class: "small muted" }, h("strong", {}, "Genetic similarity"), " means how well a reference group's allele frequencies explain your genotypes. It is not ethnicity, nationality or identity, which are social facts no genome can settle."),
      h("p", { class: "small muted" }, h("strong", {}, "Component"), " means a group of reference genomes, described by their allele frequencies; each is an average over many people, not a people."),
      h("p", { class: "small muted" }, h("strong", {}, "Broadly"), " a continent means the part of your genome the evidence places in that continent but not in any one of its regions (", link("durand2014", "the rule 23andMe uses"), ")."),
      h("p", { class: "small muted", style: "margin:0" }, h("strong", {}, "Ancient DNA"), " is not modelled for individuals here. Published three-source models of Europe describe populations, not a person (", link("haak2015"), "; ", link("harney2021"), ").")));

  drawTools();
  drawComponents();
  return [
    ...notices,
    h("div", { class: "page-head" },
      h("p", { class: "kicker" }, demo ? "Ancestry · demo" : "Ancestry"),
      h("h1", { class: "h1" }, "Genetic similarity, ", h("em", {}, "with its uncertainty on show")),
      h("p", { class: "lede" }, `Compared with ${fmt.int(genomes)} genomes from ${a.similarity.scores.length} populations on ${fmt.int(a.coverage.called)} shared SNPs, in ${fmt.num(a.ms / 1000, 1)} seconds, in this tab.`)),
    h("div", { class: "stack-l" }, fig1, fig2, fig3, fig4, fig5, fig6, method),
  ];
}

function topList(rows: AncestryResult["similarity"]["scores"], byCode: Map<string, Population>, colors: Map<string, string>): HTMLElement {
  return h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:14px" },
    ...rows.map((r) => {
      const p = byCode.get(r.population);
      return h("div", { class: "stat", style: `padding:10px 12px;${r.inSet === false ? "opacity:.6" : ""}` },
        h("div", { class: "label" }, `#${r.rank} · ${r.population}${r.inSet ? " · in set" : ""}`),
        h("div", { style: "font-weight:600;margin-top:4px;display:flex;align-items:center;gap:6px" }, h("i", { class: "swatch", style: `background:${colors.get(r.population) ?? "var(--ink-3)"};margin:0` }), p?.name ?? r.population),
        h("div", { class: "sub" }, r.probability !== undefined ? `probability ${fmt.prob(r.probability)}` : r.rank === 1 ? "best fit" : `−${fmt.num(r.gapPer1000, 1)} per 1,000 SNPs`));
    }));
}

function rankingChart(a: AncestryResult, groups: Array<{ code: string; name: string; pops: Population[] }>, colors: Map<string, string>): HTMLElement {
  const maxGap = Math.max(...a.similarity.scores.map((s) => s.gapPer1000), 1);
  const scored = new Map(a.similarity.scores.map((s) => [s.population, s]));
  return h("div", { class: "grid g2", style: "gap:4px 28px" },
    ...groups.filter((g) => g.pops.some((p) => scored.has(p.code))).map((g) => h("div", {},
      h("p", { class: "kicker", style: "margin:12px 0 4px;color:var(--ink-3)" }, g.name),
      ...g.pops.filter((p) => scored.has(p.code)).map((p) => {
        const sc = scored.get(p.code)!;
        return h("div", { class: "bar-row", style: "grid-template-columns:minmax(90px,180px) 1fr 58px;padding:4px 0" },
          h("span", { class: "name", title: p.description }, h("span", { class: "mono", style: "color:var(--ink-3);margin-right:6px" }, p.code), p.name),
          h("span", { class: "bar-track", style: "height:8px" }, h("i", { style: `width:${Math.max(1.5, (sc.gapPer1000 / maxGap) * 100)}%;background:${colors.get(p.code)};opacity:${sc.inSet ?? sc.rank <= 3 ? 1 : 0.55}` })),
          h("span", { class: "val" }, sc.rank === 1 ? "best" : `#${sc.rank}`, sc.inSet ? h("span", { class: "faded", style: "display:block;font-size:11px" }, "in set") : null));
      }))));
}
