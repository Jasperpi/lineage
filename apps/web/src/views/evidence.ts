/**
 * The evidence room: the network ledger, every bundled dataset with its
 * provenance, how well the methods do on data where the answer is known,
 * the methods with their papers, and the loaded file's numbered facts.
 */
import type { Report } from "@lineage/core";
import { h, s, fmt, clear, tip, download, icon } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { call } from "../lib/engine.js";
import { ledger } from "../lib/ledger.js";
import { figure, responsive } from "../charts/common.js";
import { load, panelMeta, populationIndex, simSummary, type Provenance } from "../lib/reference.js";
import { PAPERS, cite, paperUrl, type PaperKey } from "../lib/citations.js";
import { componentColor } from "../lib/colors.js";

export function evidence(): HTMLElement {
  const root = h("div", { class: "fade-in" },
    h("div", { class: "page-head" },
      h("p", { class: "kicker" }, "Evidence"),
      h("h1", { class: "h1" }, "What we know, ", h("em", {}, "and how we know it")),
      h("p", { class: "lede" }, "Every dataset Lineage uses, where it came from and on what terms; how well each method does where the right answer is known; and every result for your file as a numbered fact with its evidence.")));
  const body = h("div", { class: "stack-l" }, privacy());
  root.append(body);
  Promise.all([dataRoom(), validation()]).then(([room, val]) => {
    body.append(room, val, methods(), factsRegister(), notDoing());
  });
  return root;
}

/* ------------------------------------------------------------------ */
function privacy(): HTMLElement {
  const l = ledger();
  const byPath = l.entries.map((e) => { try { const u = new URL(e.url); return { path: u.origin === location.origin ? u.pathname : u.href, bytes: e.bytes, same: e.sameOrigin, type: e.type }; } catch { return { path: e.url, bytes: e.bytes, same: e.sameOrigin, type: e.type }; } });
  return h("section", { class: "figure", id: "privacy" },
    h("div", { class: "fig-head" },
      h("p", { class: "kicker" }, "Privacy you can check"),
      h("h3", {}, l.elsewhere.length === 0 ? `${l.total} requests, all to this site` : `${l.elsewhere.length} requests went to other sites`),
      h("p", {}, "These are the requests this page has made, as your browser recorded them. The app code, fonts and reference data all come from this site; your files are read from your disk into this tab and are never part of any request. The site's security policy (below) stops the page from contacting any other server even if it tried.")),
    h("div", { class: "fig-body" },
      h("div", { class: "table-wrap" }, h("table", { class: "data" },
        h("thead", {}, h("tr", {}, h("th", {}, "Request"), h("th", {}, "Kind"), h("th", { class: "n" }, "Received"))),
        h("tbody", {}, h("tr", {}, h("td", { class: "mono" }, location.pathname || "/"), h("td", {}, "page"), h("td", { class: "n mono" }, "–")),
          ...byPath.map((e) => h("tr", {}, h("td", { class: "mono", style: e.same ? "" : "color:var(--bad)" }, e.path.length > 70 ? `…${e.path.slice(-68)}` : e.path), h("td", {}, e.type), h("td", { class: "n mono" }, e.bytes ? fmt.bytes(e.bytes) : "cached")))))),
      h("details", { class: "more" }, h("summary", {}, "The security policy and how to verify it yourself"),
        h("p", { class: "small muted" }, "Lineage is served with this Content-Security-Policy header, which browsers enforce:"),
        h("pre", { class: "mono small", style: "white-space:pre-wrap;background:var(--paper-2);padding:12px;border-radius:10px" }, "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' https://jaspermeller.com https://*.jaspermeller.com"),
        h("p", { class: "small muted", style: "margin:0" }, "To check: open your browser's developer tools on the Network tab and load a file; no request carries it. Or let the page load its reference files (they appear in the table above), switch off your network, and keep working."))),
    h("div", { class: "fig-foot" }, "No accounts, cookies, analytics or third-party scripts. The only thing stored on this device is your light or dark preference."));
}

/* ------------------------------------------------------------------ */
interface AnyRef { id?: string; title?: string; provenance?: Provenance & { sources?: Provenance["sources"] }; [k: string]: unknown }
async function dataRoom(): Promise<HTMLElement> {
  const [map, pops, meta, sim, tf] = await Promise.all([load<AnyRef>("genetic-map.grch37.json"), load<AnyRef>("populations.json"), panelMeta(), simSummary(), load<AnyRef>("trait-frequencies.json")]);
  const card = (title: string, rows: Array<[string, unknown]>, sources?: Array<{ name: string; url: string; sha256?: string; bytes?: number; retrieved?: string }>) =>
    h("div", { class: "card dataset" },
      h("h3", { class: "h3" }, title),
      h("dl", {}, ...rows.filter(([, v]) => v !== undefined && v !== "").flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v as string | Node)])),
      sources?.length ? h("details", { class: "more" }, h("summary", {}, `${sources.length} source file${sources.length === 1 ? "" : "s"}`),
        h("ul", { class: "tiny mono", style: "padding-left:16px;margin:0;display:grid;gap:6px" }, ...sources.map((src) => h("li", {}, h("a", { href: src.url, target: "_blank", rel: "noopener" }, src.name), src.sha256 ? ` · sha256 ${src.sha256.slice(0, 16)}…` : "", src.bytes ? ` · ${fmt.bytes(src.bytes)}` : "", src.retrieved ? ` · ${src.retrieved}` : "")))) : null);
  const a = (href: string, text: string) => h("a", { href, target: "_blank", rel: "noopener" }, text);
  return h("section", {},
    h("div", { class: "section-head" }, h("div", {}, h("p", { class: "kicker" }, "Data room"), h("h2", { class: "h2" }, "Every dataset, with its source and checksum"), h("p", { class: "lede" }, "All reference data is fetched from public releases by the scripts in lineage/scripts/data, reduced to what the app needs, and published with the hashes of what was downloaded. Nothing is typed in by hand."))),
    h("div", { class: "grid g2" },
      card("Reference panel: 1000 Genomes phase 3", [
        ["What", `${fmt.int(meta.qc.dense)} SNPs present on both consumer chip families, with allele frequencies in 26 populations on an LD-pruned core of ${fmt.int(meta.qc.core)}, five continental components and PCA loadings.`],
        ["Counted from", `${fmt.int(2504)} genomes in the phase 3 genotype files (release 20130502)`],
        ["QC", `${fmt.int(meta.qc.input)} SNPs in; ${fmt.int(meta.qc.palindromic)} A/T or C/G removed; ${fmt.int(meta.qc.rare)} with minor allele frequency under 1% removed`],
        ["Terms", a("https://www.internationalgenome.org/IGSR_disclaimer", "IGSR: available without embargo, cite the project")],
        ["Cite", a(paperUrl("kg2015"), `${cite("kg2015")}, ${PAPERS.kg2015.journal}`)],
        ["File", `panel.1000g.bin.gz · ${fmt.bytes(meta.bytes)} · sha256 ${meta.sha256.slice(0, 16)}…`],
        ["Built", `${meta.provenance.generated} by ${meta.provenance.script}`],
      ], [...meta.provenance.genotypes.sources.slice(0, 3), ...meta.provenance.chips.sources]),
      card("Consumer chip content", [
        ["What", `SNPs whose rsID, chromosome and GRCh37 position agree on both arrays: ${fmt.int(meta.provenance.chips.shared)}`],
        ["Arrays", meta.provenance.chips.arrays.map((x) => `${x.name} (${fmt.int(x.snps)})`).join("; ")],
        ["Why", "The Global Screening Array underlies the chips of 23andMe v5, MyHeritage, FamilyTreeDNA and Living DNA; OmniExpress is the lineage of AncestryDNA's chip. SNPs on both overlap every major file."],
        ["Terms", "Illumina product support files, publicly downloadable"],
      ], meta.provenance.chips.sources),
      card("Genetic map, GRCh37", [
        ["What", `HapMap Phase II map lifted to GRCh37; ${fmt.int(3545.83)} cM across the autosomes`],
        ["Reduced", String(map.provenance?.method ?? "")],
        ["Terms", "Distributed by the Beagle project; no licence is attached to the map itself (see the plan)"],
        ["Cite", a(paperUrl("hapmap2007"), `${cite("hapmap2007")}, ${PAPERS.hapmap2007.journal}`)],
      ], map.provenance?.sources),
      card("Populations and sampling sites", [
        ["What", "26 populations with names, descriptions and sampling coordinates; counts from the phase 3 panel file"],
        ["Terms", String(pops.provenance?.terms ?? "")],
      ], pops.provenance?.sources),
      card("Relationship simulations", [
        ["What", `${sim.relationships.length} relationships × ${fmt.int(sim.provenance.model.pairsPerRelationship)} simulated pairs, seed ${sim.provenance.model.seed}, threshold ${sim.provenance.model.minSegmentCm} cM, genome ${fmt.int(sim.provenance.model.genomeCm)} cM`],
        ["Model", sim.provenance.method],
        ["Refs", h("span", {}, a(paperUrl("pedsim2019"), cite("pedsim2019")), "; ", a(paperUrl("ersa2011"), cite("ersa2011")))],
        ["Check", h("span", {}, "Compared with ", a(sim.provenance.empiricalCheck.url, sim.provenance.empiricalCheck.title), ` (${sim.provenance.empiricalCheck.author}), retrieved ${sim.provenance.empiricalCheck.retrieved}`)],
      ]),
      card("Trait markers", [
        ["What", "15 benign variants: positions and alleles from Ensembl (GRCh38 and GRCh37), papers checked on PubMed, and allele counts in all 26 populations from the phase 3 genotype files"],
        ["Scope", "No disease, carrier or drug-response variants"],
        ["Built", String(tf.provenance?.retrieved ?? "")],
      ])));
}

/* ------------------------------------------------------------------ */
interface ValidationFile {
  method: string; caveat: string; generated: string;
  donors?: Record<string, number>;
  overall: Record<string, { accuracy: number; painted: number; windows: number }>;
  controls: Record<string, { accuracy: number; painted: number; windows: number }>;
  byPair: Record<string, { genomes: number; componentMae: number } & Record<string, { accuracy: number; painted: number; windows: number }>>;
  componentMae: number;
}

function paintingValidation(v: ValidationFile): HTMLElement {
  const levels: Array<[string, string]> = [["cautious", "Cautious (95%)"], ["standard", "Standard (80%)"], ["complete", "Complete (50%)"]];
  const std = v.overall.standard!;
  return figure({
    kicker: "Fig. 3 · Chromosome painting on spliced genomes",
    title: `At the Standard setting ${fmt.pct(std.accuracy, 1)} of painted windows are right, and ${fmt.pct(std.painted, 0)} of windows get painted`,
    caption: "Test genomes built from real 1000 Genomes chromosomes cut into 15-60 cM blocks, each block from one continent on both copies or from two continents one copy each, so the true answer is known for every window. The painter is the same code the page runs.",
    body: h("div", {},
      h("div", { class: "table-wrap" }, h("table", { class: "data" },
        h("thead", {}, h("tr", {}, h("th", {}, "Setting"), h("th", { class: "n" }, "Correct when painted"), h("th", { class: "n" }, "Windows painted"), h("th", { class: "n" }, "Controls correct"))),
        h("tbody", {}, ...levels.map(([k, label]) => h("tr", {}, h("td", {}, label), h("td", { class: "n mono" }, fmt.pct(v.overall[k]!.accuracy, 1)), h("td", { class: "n mono" }, fmt.pct(v.overall[k]!.painted, 0)), h("td", { class: "n mono" }, fmt.pct(v.controls[k]!.accuracy, 1))))))),
      h("details", { class: "more" }, h("summary", {}, "By pair of continents"),
        h("div", { class: "table-wrap" }, h("table", { class: "data" },
          h("thead", {}, h("tr", {}, h("th", {}, "Pair"), h("th", { class: "n" }, "Genomes"), h("th", { class: "n" }, "Correct (Standard)"), h("th", { class: "n" }, "Painted"), h("th", { class: "n" }, "Component error"))),
          h("tbody", {}, ...Object.entries(v.byPair).map(([pair, r]) => h("tr", {}, h("td", { class: "mono" }, pair), h("td", { class: "n mono" }, String(r.genomes)), h("td", { class: "n mono" }, fmt.pct(r.standard!.accuracy, 1)), h("td", { class: "n mono" }, fmt.pct(r.standard!.painted, 0)), h("td", { class: "n mono" }, `${(r.componentMae * 100).toFixed(1)} pts`))))))),
      h("p", { class: "small faded", style: "margin:12px 0 0" }, `Component estimates on the same genomes are off by ${(v.componentMae * 100).toFixed(1)} percentage points on average per component. ${v.caveat}`)),
    foot: `${v.method}${v.donors ? ` Donor genomes per component: ${Object.entries(v.donors).map(([c, n]) => `${c} ${fmt.int(n)}`).join(", ")}.` : ""} Generated ${v.generated} by scripts/data/08-validate.mjs.`,
  });
}

async function validation(): Promise<HTMLElement> {
  const [sim, meta, pi, paintVal] = await Promise.all([simSummary(), panelMeta(), populationIndex(), load<ValidationFile>("validation.json").catch(() => undefined)]);
  const rels = sim.relationships.filter((r) => r.sharedCmV4 && r.id !== "twin");
  const dumbbell = responsive((w) => {
    // Room for the longest label ("Great-grandparent or great-grandchild") in 11 px mono; phones get short ids.
    const W = w, rowH = 22, m = { l: w < 520 ? 118 : Math.max(...rels.map((r) => r.label.length)) * 6.7 + 14, r: 16, t: 8, b: 26 };
    const H = m.t + rels.length * rowH + m.b;
    const max = 3800;
    const x = (v: number) => m.l + Math.sqrt(v / max) * (W - m.l - m.r);
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Simulated mean shared cM against the Shared cM Project average, by relationship" });
    for (const t of [0, 10, 50, 100, 250, 500, 1000, 2000, 3500]) {
      svg.append(s("line", { x1: x(t), x2: x(t), y1: m.t, y2: H - m.b, stroke: "var(--rule-2)" }), s("text", { x: x(t), y: H - 8, "text-anchor": "middle", class: "lbl", "font-size": 9.5 }, fmt.int(t)));
    }
    rels.forEach((r, i) => {
      const y = m.t + i * rowH + rowH / 2;
      const v4 = r.sharedCmV4!;
      svg.append(s("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "lbl", "font-size": w < 520 ? 10 : 11 }, w < 520 ? r.id : r.label));
      svg.append(s("line", { x1: x(v4.min), x2: x(v4.max), y1: y, y2: y, stroke: "var(--brick)", "stroke-width": 2, opacity: 0.35 }));
      svg.append(s("line", { x1: x(r.summary.meanCm), x2: x(v4.average), y1: y, y2: y, stroke: "var(--ink-3)", "stroke-width": 1.5 }));
      const g = s("g", {}, s("circle", { cx: x(v4.average), cy: y, r: 4.5, fill: "var(--brick)" }), s("circle", { cx: x(r.summary.meanCm), cy: y, r: 4.5, fill: "var(--navy)" }), s("rect", { x: m.l, y: y - rowH / 2, width: W - m.l - m.r, height: rowH, fill: "transparent" }));
      tip(g, () => h("span", {}, h("b", {}, r.label), h("br"), `Simulated mean ${fmt.int(r.summary.meanCm)} cM (${fmt.num(r.summary.meanSegments, 1)} segments${r.summary.noSharing > 0.001 ? `, ${fmt.pct(r.summary.noSharing, 0)} share none` : ""})`, h("br"), `Shared cM Project average ${fmt.int(v4.average)}, range ${fmt.int(v4.min)}–${fmt.int(v4.max)}`));
      svg.append(g);
    });
    return svg;
  });
  const close = rels.filter((r) => r.summary.meanCm > 700);
  const worst = Math.max(...close.map((r) => Math.abs(r.summary.meanCm - r.sharedCmV4!.average) / r.sharedCmV4!.average));
  const popOrder = pi.groups.flatMap((g) => g.pops);
  const loo = h("div", { class: "grid g2", style: "gap:2px 28px" }, ...pi.groups.map((g) => h("div", {},
    h("p", { class: "kicker", style: "margin:12px 0 4px;color:var(--ink-3)" }, g.name),
    ...g.pops.map((p) => {
      const v = meta.similarityValidation[p.code]!;
      return h("div", { class: "bar-row", style: "grid-template-columns:minmax(80px,175px) 1fr 92px;padding:3px 0" },
        h("span", { class: "name" }, h("span", { class: "mono", style: "color:var(--ink-3);margin-right:6px" }, p.code), p.name),
        h("span", { class: "bar-track", style: "height:9px" }, h("i", { style: `width:${v.sameContinentFirst * 100}%;background:${componentColor(g.code === "AMR" ? "NAT" : g.code)};opacity:.3` }), h("i", { style: `width:${v.ownFirst * 100}%;background:${componentColor(g.code === "AMR" ? "NAT" : g.code)}` })),
        h("span", { class: "val", title: v.mostCommonOther ? `Most often confused with ${v.mostCommonOther}` : "" }, `${fmt.pct0(v.ownFirst)}${v.mostCommonOther ? ` · ${v.mostCommonOther}` : ""}`));
    }))));
  const meanOwn = popOrder.reduce((a, p) => a + meta.similarityValidation[p.code]!.ownFirst * meta.similarityValidation[p.code]!.samples, 0) / 2504;
  const meanCont = popOrder.reduce((a, p) => a + meta.similarityValidation[p.code]!.sameContinentFirst * meta.similarityValidation[p.code]!.samples, 0) / 2504;
  return h("section", { class: "stack-l" },
    h("div", { class: "section-head" }, h("div", {}, h("p", { class: "kicker" }, "Validation"), h("h2", { class: "h2" }, "How the methods do where the answer is known"))),
    figure({
      kicker: "Fig. 1 · Relationship model against the crowd",
      title: `For close relatives the simulation's averages are within ${fmt.pct(worst, 0)} of the Shared cM Project's`,
      caption: "Navy: the simulation's mean shared cM for each relationship. Brick: the Shared cM Project average, with its observed range as the pale bar (square-root scale). For distant cousins the crowd-sourced averages are higher, as expected: pairs sharing nothing never appear in match lists, and false small segments add to reported totals.",
      body: dumbbell,
      foot: h("span", {}, `${fmt.int(sim.provenance.model.pairsPerRelationship)} simulated pairs per relationship. Shared cM Project v4: `, cite("sharedcm2020"), "."),
    }),
    figure({
      kicker: "Fig. 2 · Population similarity, leave-one-out",
      title: `Each reference genome, ranked against the other 2,503: its own population comes first ${fmt.pct0(meanOwn)} of the time, its own continent ${fmt.pct0(meanCont)}`,
      caption: "Dark bar: share of each population's genomes whose own population ranks first when their genome is removed from its frequencies. Pale bar: share whose top population is on the same continent. The code on the right is the population they are most often mistaken for; close neighbours (British and CEU, the two Han Chinese samples) swap often, which is why Lineage shows the whole ranking.",
      body: loo,
      foot: `${fmt.int(meta.qc.core)} LD-pruned SNPs; frequencies stored at the same 1/250 precision the app uses.`,
    }),
    paintVal ? paintingValidation(paintVal) : null,
    h("div", { class: "grid g2" },
      h("div", { class: "card" },
        h("p", { class: "kicker" }, "PCA"),
        h("h3", { class: "h3" }, "Variance explained and shrinkage"),
        h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "PC"), h("th", { class: "n" }, "Variance"), h("th", { class: "n" }, "Shrinkage"))),
          h("tbody", {}, ...meta.pca.varianceExplained.map((v, i) => h("tr", {}, h("td", {}, `PC${i + 1}`), h("td", { class: "n mono" }, fmt.pct(v, 2)), h("td", { class: "n mono" }, meta.pca.shrinkage[i]!.toFixed(3))))))),
        h("p", { class: "small faded", style: "margin:10px 0 0" }, "Shrinkage is the spread of held-out genomes' projections divided by the spread of in-sample scores, averaged over five folds; projected positions are divided by it.")),
      h("div", { class: "card" },
        h("p", { class: "kicker" }, "Continental components"),
        h("h3", { class: "h3" }, "What each component is made of"),
        h("ul", { class: "small muted", style: "padding-left:18px" }, ...meta.components.map((c) => h("li", {}, h("strong", {}, c.label), c.reference?.length
          ? `: defined by the ${c.reference.join(", ")} genomes, fixed as wholly this component.`
          : `: learned from the admixed ${(meta.admixture.estimated ?? []).join(", ")} genomes, started from ${c.initialisedFrom}; ${c.populations.length ? `${c.populations.join(", ")} average over 80% of it` : "no population averages over 80% of it"}.`))),
        h("p", { class: "small faded", style: "margin:0" }, `ADMIXTURE's supervised mode: the reference genomes are fixed, the admixed ones estimated with all five components' frequencies; ${meta.admixture.iterations} EM updates with SQUAREM acceleration (`, h("a", { href: paperUrl("admixture2009"), target: "_blank", rel: "noopener" }, cite("admixture2009")), "). Run unsupervised, the same fit gave every European genome about 6% of the Indigenous American component and 11% of the South Asian one, shares a reader would take for ancestry; the supervised mode avoids that."))));
}

/* ------------------------------------------------------------------ */
function methods(): HTMLElement {
  const m = (title: string, text: string, keys: PaperKey[]) => h("div", { class: "card" },
    h("h3", { class: "h3" }, title), h("p", { class: "small muted", style: "margin-top:6px" }, text),
    h("p", { class: "tiny", style: "margin:0" }, ...keys.flatMap((k, i) => [i ? " · " : "", h("a", { href: paperUrl(k), target: "_blank", rel: "noopener" }, `${cite(k)}, ${(PAPERS[k] as { journal: string }).journal}`)])));
  return h("section", {},
    h("div", { class: "section-head" }, h("div", {}, h("p", { class: "kicker" }, "Methods"), h("h2", { class: "h2" }, "Each analysis and the paper behind it"))),
    h("div", { class: "grid g3" },
      m("Shared segments", "Positions typed in both files are walked in order; a segment is a run with no opposite homozygotes (a small error budget allowed) of at least 7 cM on the map. Fully identical runs are found the same way.", ["hapmap2007"]),
      m("Relationship probabilities", "Pedigree simulation of 23 relationships, 2,000 pairs each, and kernel density likelihoods from total cM, number of segments and fully identical cM. Equal priors; the model ignores crossover interference and sex-specific maps.", ["pedsim2019", "ersa2011"]),
      m("Population similarity", "Hardy-Weinberg log-likelihood of the genotypes under each population's allele frequencies. A ranking, not a probability.", ["kg2015", "admixture2009"]),
      m("Continental components", "Five components fitted in ADMIXTURE's supervised mode: 20 reference populations define four of them, and the Indigenous American one is learned from the admixed samples. Your proportions come from EM with the components' frequencies fixed; 95% intervals from resampling blocks of 50 SNPs.", ["admixture2009"]),
      m("PCA position", "PCA of the reference genotypes; your genome projected by least squares and corrected for projection shrinkage measured on held-out genomes.", ["eigen2006"]),
      m("Chromosome painting", "A hidden Markov model over pairs of continental components, with emissions from windows of SNPs and switches that grow with genetic distance. Continental resolution only.", ["flare2023"]),
      m("Runs of homozygosity", "A SNP-count scan for runs over 4 Mb, read against published landmarks rather than turned into a label.", ["ceballos2018"]),
      m("Allele-frequency maps", "Counts of each trait allele in the 26 populations, shown with 95% Wilson intervals, following the Geography of Genetic Variants.", ["ggv2017", "kg2015"]),
      m("Ancient DNA (not individual)", "Three-source models of Europe are statements about populations; qpAdm-style models of one person are poorly identified, so Lineage does not give personal ancient percentages.", ["lazaridis2014", "haak2015", "harney2021", "aadr2024"])));
}

/* ------------------------------------------------------------------ */
function factsRegister(): HTMLElement {
  const box = h("section", { class: "figure" },
    h("div", { class: "fig-head" }, h("p", { class: "kicker" }, "Facts register"), h("h3", {}, state.you ? "Every result for this file, as a numbered fact" : "Open a file to see its facts"),
      h("p", {}, "The report is the contract between the engine and anything that explains it, human or AI: each statement has an id, the evidence it rests on, a source and a confidence level. The command-line narrator may only restate these facts by id, and its citations are checked mechanically.")));
  if (!state.you) return box;
  const list = h("div", { class: "fig-body" }, h("div", { class: "loading" }, h("div", { class: "spinner" })));
  box.append(list);
  call("report", { slot: "you" }).then((r: Report) => {
    clear(list,
      h("div", { class: "row", style: "margin-bottom:12px" },
        h("button", { class: "btn secondary small", type: "button", onClick: () => download("lineage-report.json", JSON.stringify(r, null, 2)) }, icon("download"), "JSON"),
        h("button", { class: "btn secondary small", type: "button", onClick: () => download("lineage-report.md", toMarkdown(r), "text/markdown") }, icon("download"), "Markdown"),
        h("span", { class: "small faded" }, `${r.facts.length} facts, generated ${new Date(r.generated).toLocaleString()}`)),
      ...r.facts.map((f) => h("div", { class: "fact" },
        h("div", {}, h("code", {}, f.id), h("div", { class: "meta" }, h("span", { class: `pill ${f.confidence === "established" ? "good" : f.confidence === "probable" ? "navy" : "warn"}` }, f.confidence))),
        h("div", {}, f.statement, f.evidence || f.source ? h("div", { class: "meta" }, [f.evidence, f.source].filter(Boolean).join(" · ")) : null))),
      h("h3", { class: "h3", style: "margin-top:18px" }, "Limitations"),
      h("ul", { class: "small muted" }, ...r.limitations.map((l) => h("li", {}, l))));
  });
  return box;
}

function toMarkdown(r: Report): string {
  const lines = [`# Lineage report: ${r.subject.label}`, "", `Generated ${r.generated}. Every statement below is a numbered fact with its evidence.`, ""];
  for (const f of r.facts) lines.push(`- **${f.id}** (${f.confidence}): ${f.statement}${f.evidence ? ` _Evidence: ${f.evidence}._` : ""}${f.source ? ` _Source: ${f.source}._` : ""}`);
  lines.push("", "## Limitations", "", ...r.limitations.map((l) => `- ${l}`), "");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
function notDoing(): HTMLElement {
  return h("section", { class: "card flat" },
    h("p", { class: "kicker" }, "Out of scope, on purpose"),
    h("h2", { class: "h2", style: "margin-bottom:10px" }, "What the evidence does not support"),
    h("div", { class: "grid g2 small muted" },
      h("p", {}, h("strong", {}, "Faces from DNA. "), "The best-known attempt to predict faces from genomes identified people mainly through sex, age and ancestry (", h("a", { href: paperUrl("lippert2017"), target: "_blank", rel: "noopener" }, cite("lippert2017")), "), and a critique showed that demographics alone did about as well. Eye colour is well predicted from a handful of variants; a face is not."),
      h("p", {}, h("strong", {}, "A personal \"% Yamnaya\". "), "The three-source picture of European prehistory (", h("a", { href: paperUrl("lazaridis2014"), target: "_blank", rel: "noopener" }, cite("lazaridis2014")), "; ", h("a", { href: paperUrl("haak2015"), target: "_blank", rel: "noopener" }, cite("haak2015")), ") models populations. Fitting it to one person returns three numbers for any input."),
      h("p", {}, h("strong", {}, "Sub-continental painting. "), "Local-ancestry methods that are excellent between continents lose much of their accuracy between close populations (", h("a", { href: paperUrl("flare2023"), target: "_blank", rel: "noopener" }, cite("flare2023")), ")."),
      h("p", {}, h("strong", {}, "Health reports. "), "Disease, carrier and drug-response variants need clinical validation and counselling; they are excluded from the knowledge base by rule.")));
}
