/** "Your genome": what the file contains, where the chip looked, and what it says on its own. */
import { h, s, fmt, icon, tip, download } from "../lib/dom.js";
import { state, resetYou } from "../lib/store.js";
import { figure, responsive } from "../charts/common.js";
import { chromosomeChart, AUTOSOME_NAMES } from "../charts/chromosomes.js";
import { go } from "../lib/actions.js";
import { call } from "../lib/engine.js";
import { cite, paperUrl } from "../lib/citations.js";
import { emptyState } from "./empty.js";

export function overview(): HTMLElement {
  const o = state.you;
  if (!o) return emptyState("Your genome", "Open a raw data file to see what it contains", "Lineage reads the file in this tab: how many positions the chip tested, how complete the calls are, your genetic sex from the X and Y calls, and long runs where both of your copies match.");
  const demo = !!o.demo;
  // Scale the shading to a high percentile, not the maximum: the HLA region on chr6 is so dense
  // that scaling to it would wash out every other window.
  const filled = Object.values(o.density).flat().filter((n) => n > 0).sort((a, b) => a - b);
  const maxBin = Math.max(filled[Math.floor(0.95 * (filled.length - 1))] ?? 1, 1);
  const rohMb = o.roh.reduce((a, r) => a + r.lengthBp, 0) / 1e6;
  const rohOver10 = o.roh.filter((r) => r.lengthBp > 10e6).reduce((a, r) => a + r.lengthBp, 0) / 1e6;

  const karyo = responsive((w) => chromosomeChart({
    width: w, chroms: [...AUTOSOME_NAMES, "X", "Y"], label: "Where the chip looked, and runs of homozygosity",
    right: (c) => { const pc = o.perChromosome.find((x) => x.chrom === c); return pc ? `${fmt.int(pc.called)}` : "0"; },
    tracks: [
      { draw: (c, g, x, y, hh) => {
        const bins = o.density[c] ?? [];
        bins.forEach((n, i) => { if (n > 0) g.append(s("rect", { x: x(i * 2e6), y, width: Math.max(0.6, x((i + 1) * 2e6) - x(i * 2e6)), height: hh, fill: "var(--navy)", opacity: 0.08 + 0.72 * Math.min(1, n / maxBin) })); });
      } },
      { draw: (c, g, x, y, hh) => {
        for (const r of o.roh.filter((z) => z.chrom === c)) {
          const el = s("rect", { x: x(r.start), y: y - 1, width: Math.max(3, x(r.end) - x(r.start)), height: hh + 2, fill: "var(--brick)", rx: 2 });
          tip(el, () => h("span", {}, h("b", {}, `Run of homozygosity, chr${c}`), h("br"), `${fmt.mb(r.lengthBp)} (${fmt.cm(r.lengthCm)}), ${fmt.int(r.snps)} SNPs`, h("br"), h("span", { class: "mono" }, `${fmt.bp(r.start)}–${fmt.bp(r.end)}`)));
          g.append(el);
        }
      } },
    ],
  }));

  const sexText = o.sex.inferred === "undetermined" ? "Undetermined" : o.sex.inferred === "male" ? "XY" : "XX";
  const rohReading = rohMb === 0
    ? "No run longer than 4 Mb. Demonstrably outbred people carry runs up to about 4 Mb but not longer."
    : rohMb > 160
      ? `A total above 160 Mb, which ${cite("ceballos2018")} treat as a conservative lower boundary for the equivalent of first-cousin parents. Small, isolated populations also raise totals, so this is a measurement, not a verdict.`
      : `Some runs longer than 4 Mb. They can reflect parents who share ancestry some generations back, or a population with a small historical size. Totals below 160 Mb are below the published first-cousin landmark.`;

  const reportBtn = h("button", { class: "btn secondary small", type: "button", onClick: async () => { const r = await call("report", { slot: "you" }); download(`lineage-report-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(r, null, 2)); } }, icon("download"), "Export report (JSON)");

  return h("div", { class: "fade-in" },
    h("div", { class: "page-head" },
      h("p", { class: "kicker" }, demo ? "Your genome · demo" : "Your genome"),
      h("h1", { class: "h1" }, demo ? h("span", {}, "Leo Tanaka's genome, ", h("em", {}, "generated for the demo")) : h("span", {}, o.name)),
      h("div", { class: "subject" },
        h("span", { class: "pill navy" }, FORMAT_NAME[o.format] ?? o.format), h("span", { class: "pill" }, `GRCh${o.build}`), o.chipVersion ? h("span", { class: "pill" }, `chip ${o.chipVersion}`) : null,
        o.parse.ms ? h("span", { class: "pill" }, `parsed in ${fmt.int(o.parse.ms)} ms`) : null, o.parse.compressed ? h("span", { class: "pill" }, `opened from .${o.parse.compressed === "gzip" ? "gz" : "zip"}`) : null,
        h("span", { class: "pill good" }, icon("shield"), "read in this tab only")),
      demo ? h("div", { class: "note brick" }, h("strong", {}, "This person does not exist. "), "Leo's genome was generated a moment ago in your browser from 1000 Genomes allele frequencies: his grandparents were drawn from Finnish, Tuscan, Japanese and Mexican-American reference samples, and each generation inherited recombined chromosomes on the real genetic map. His parents, sister, aunt, cousin and an unrelated person were generated too.") : null),
    h("div", { class: "stats" },
      stat("Positions tested", fmt.int(o.variants), `${fmt.pct(o.callRate, 2)} with a call. About ${Number((o.variants / 3.1e9 * 100).toPrecision(1))}% of the 3.1 billion positions in a genome.`),
      stat("Genetic sex", sexText, o.sex.rationale),
      stat("Heterozygosity", fmt.pct(o.heterozygosity, 1), "Share of called autosomal SNPs where the two copies differ. Consumer chips typically read 30-40%."),
      stat("Long runs of homozygosity", o.roh.length ? `${fmt.num(rohMb, 0)}` : "0", o.roh.length ? `Mb in ${o.roh.length} run${o.roh.length === 1 ? "" : "s"} over 4 Mb${rohOver10 ? `, ${fmt.num(rohOver10, 0)} Mb in runs over 10 Mb` : ""}` : "No run over 4 Mb", "Mb")),
    h("div", { class: "section", style: "margin-top:28px" },
      figure({
        kicker: "Fig. 1 · Coverage",
        title: `The chip read ${fmt.int(o.called)} positions, spread across every chromosome`,
        caption: "Shading shows how many positions were called in each 2 Mb window; darker is denser. Brick bars mark long runs where both copies of the genome are identical. The number at the end of each row is the positions called on that chromosome.",
        body: h("div", {}, karyo, h("div", { class: "legend", style: "margin-top:12px" },
          h("span", {}, h("i", { class: "swatch", style: "background:var(--navy)" }), "called positions"),
          h("span", {}, h("i", { class: "swatch", style: "background:var(--brick)" }), "run of homozygosity over 4 Mb"))),
        foot: h("span", {}, "Positions are GRCh37. Runs of homozygosity: a SNP-count scan tolerating two heterozygous calls per run, minimum 4 Mb and 200 SNPs; lengths in cM from the HapMap II map."),
      })),
    h("div", { class: "section grid g2", style: "margin-top:24px;align-items:start" },
      h("div", { class: "card" },
        h("p", { class: "kicker" }, "Reading the runs"),
        h("h3", { class: "h3" }, rohMb ? `${fmt.num(rohMb, 0)} Mb in long runs` : "No long runs"),
        h("p", { class: "muted small", style: "margin-top:8px" }, rohReading),
        h("p", { class: "small faded" }, "Landmarks from ", h("a", { href: paperUrl("ceballos2018"), target: "_blank", rel: "noopener" }, `${cite("ceballos2018")}, Nature Reviews Genetics`), ". Siblings differ by about 10 Mb on average, and populations by hundreds, so a total is compared with landmarks rather than turned into a label.")),
      h("div", { class: "card" },
        h("p", { class: "kicker navy" }, "The file itself"),
        h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("tbody", {},
          row("Rows read", fmt.int(o.parse.rowsRead)), row("Rows kept", fmt.int(o.parse.rowsKept)), row("Rows skipped (reported, never silently dropped)", fmt.int(o.parse.skipped)),
          row("X heterozygosity (outside PARs)", fmt.pct(o.sex.xHeterozygosity, 2)), row("Y calls", `${fmt.int(o.sex.yCalled)} of ${fmt.int(o.sex.yTotal)}`),
          o.parse.bytes ? row("File size", fmt.bytes(o.parse.bytes)) : null))),
        h("div", { class: "row", style: "margin-top:14px" }, reportBtn,
          h("button", { class: "btn ghost small", type: "button", onClick: () => { resetYou(); go(""); } }, "Forget this file")))),
    h("div", { class: "section" },
      h("div", { class: "section-head" }, h("div", {}, h("p", { class: "kicker" }, "Next"), h("h2", { class: "h2" }, "What your file can tell you"))),
      h("div", { class: "grid g4" },
        next("ancestry", "Ancestry", "Similarity to 26 populations, continental components with intervals, PCA and painting."),
        next("relatives", "Relatives", demo ? "Compare Leo with his family, and read his match list." : "Compare with a relative's file, or read a match list export."),
        next("traits", "Traits", "Fifteen benign variants with their papers and world frequencies."),
        next("tree", "Family tree", demo ? "The Tanakas' four generations as a fan chart." : "Open a GEDCOM to see your tree and relationship maths."))));
}

const FORMAT_NAME: Record<string, string> = { "23andme": "23andMe", ancestrydna: "AncestryDNA", ftdna: "FamilyTreeDNA", myheritage: "MyHeritage", livingdna: "Living DNA", generic: "generic layout" };

function stat(label: string, value: string, sub: string, unit?: string): HTMLElement {
  return h("div", { class: "stat" }, h("div", { class: "label" }, label), h("div", { class: "value" }, value, unit ? h("small", {}, ` ${unit}`) : null), h("div", { class: "sub" }, sub));
}
function row(k: string, v: string): HTMLElement { return h("tr", {}, h("td", {}, k), h("td", { class: "n mono" }, v)); }
function next(route: string, title: string, text: string): HTMLElement {
  return h("a", { class: "card feature", href: `#/${route}` }, h("h3", { class: "h3" }, title), h("p", {}, text), h("span", { class: "small", style: "color:var(--navy);font-weight:600" }, "Open ", icon("arrow")));
}

