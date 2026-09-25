/** The front page: what Lineage is, the two ways in, and why running it locally matters. */
import { h, s, icon, fmt } from "../lib/dom.js";
import { figure, responsive } from "../charts/common.js";
import { worldMap } from "../charts/worldmap.js";
import { componentColor, populationColor } from "../lib/colors.js";
import { populationIndex } from "../lib/reference.js";
import { openDemo, openFile, go } from "../lib/actions.js";
import { state } from "../lib/store.js";

export function dropZone(onFile: (f: File) => void, title = "Open your raw data file", hint = "Drop the .zip or .txt from 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA or Living DNA. It is read here and never leaves this device."): HTMLElement {
  const input = h("input", { type: "file", accept: ".txt,.csv,.tsv,.zip,.gz", "aria-label": title });
  const zone = h("label", { class: "drop" }, icon("upload"), h("strong", {}, title), h("span", {}, hint), input);
  (zone.firstChild as SVGElement).setAttribute("class", "drop-icon");
  input.addEventListener("change", () => { const f = input.files?.[0]; if (f) onFile(f); input.value = ""; });
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); const f = e.dataTransfer?.files[0]; if (f) onFile(f); });
  return zone;
}

async function startFile(f: File) { if (await openFile(f)) go("overview"); }
async function startDemo() { if (await openDemo()) go("overview"); }

export function home(): HTMLElement {
  const mapBox = h("div", {}, h("div", { class: "loading" }, h("div", { class: "spinner" })));
  populationIndex().then(({ groups }) => {
    const points = groups.flatMap((g) => g.pops.map((p, i) => ({
      code: p.code, lat: p.lat, lon: p.lon, r: 5.5, color: populationColor(g.code, i, g.pops.length), hollow: p.diaspora, origin: p.origin, halo: 0.5,
      tip: () => h("span", {}, h("b", {}, `${p.code} · ${p.name}`), h("br"), p.description, h("br"), h("span", { class: "mono" }, `${p.samples} genomes`), p.note ? h("span", {}, h("br"), p.note) : null),
    })));
    mapBox.replaceChildren(responsive((w, first) => worldMap(points, { width: w, labelSize: w < 520 ? 9 : 10, animate: first, pointScale: w < 420 ? 0.8 : 1 }), { min: 260 }),
      h("div", { class: "legend", style: "margin-top:10px" }, ...groups.map((g) => h("span", {}, h("i", { class: "swatch", style: `background:${componentColor(g.code)}` }), g.name)), h("span", {}, h("i", { class: "swatch", style: "background:var(--card);border:2px solid var(--ink-3)" }), "sampled away from ancestral region")));
  });

  const hero = h("section", { class: "hero" },
    h("div", {},
      h("p", { class: "kicker" }, "Open data, published methods · runs in your browser"),
      h("h1", { class: "display" }, "Read your DNA ", h("em", {}, "without handing it over.")),
      h("p", { class: "lede" }, "Lineage analyses the raw data file from your DNA test on your own device, against open scientific reference data, and shows the evidence behind every number: where the data came from, how the method works, and how sure it is."),
      h("div", { class: "hero-cta" },
        h("label", { class: "btn primary", style: "position:relative;overflow:hidden" }, icon("upload"), "Open your raw data file",
          (() => { const i = h("input", { type: "file", accept: ".txt,.csv,.tsv,.zip,.gz", style: "position:absolute;inset:0;opacity:0;cursor:pointer" }); i.addEventListener("change", () => { const f = i.files?.[0]; if (f) void startFile(f); }); return i; })()),
        h("button", { class: "btn secondary", type: "button", onClick: () => void startDemo() }, icon("family"), "Explore the demo family")),
      h("div", { class: "hero-badges" }, ...["23andMe", "AncestryDNA", "MyHeritage", "FamilyTreeDNA", "Living DNA", ".zip, .txt, .csv"].map((t) => h("span", { class: "pill" }, t)))),
    h("div", { class: "hero-visual" },
      figure({
        kicker: "The reference",
        title: "2,504 genomes from 26 populations",
        caption: "Every ancestry result compares your file with these published, openly available samples from the 1000 Genomes Project. Each point is where a population was sampled.",
        body: mapBox,
        foot: h("span", {}, "Source: 1000 Genomes Project phase 3 (2015); sampling sites from the International Genome Sample Resource. Map: Natural Earth."),
      })));

  const trust = h("div", { class: "trust" },
    h("div", {}, h("b", {}, "0 bytes"), h("span", {}, "of your DNA sent anywhere. There is no server to receive it.")),
    h("div", {}, h("b", {}, "2,504"), h("span", {}, "reference genomes, counted by Lineage from the 1000 Genomes release files")),
    h("div", {}, h("b", {}, "175,406"), h("span", {}, "SNPs that the two major consumer chip families share, checked in your file")),
    h("div", {}, h("b", {}, "46,000"), h("span", {}, "simulated relative pairs behind every relationship estimate")));

  const feature = (route: string, title: string, text: string, art: SVGSVGElement) =>
    h("a", { class: "card feature", href: `#/${route}` }, h("div", { class: "thumb" }, art), h("h3", { class: "h3" }, title), h("p", {}, text), h("span", { class: "small", style: "color:var(--navy);font-weight:600" }, "Open ", icon("arrow")));

  const features = h("div", { class: "grid g3" },
    feature("ancestry", "Ancestry, with intervals", "Your similarity to 26 reference populations on a world map, five continental components with 95% intervals, your position among 2,504 genomes, and continental painting of each chromosome.", artAncestry()),
    feature("relatives", "Relatives, with odds", "Load a relative's file or your match list. Shared segments in centimorgans, and the probability of each relationship from 46,000 simulated pairs.", artRelatives()),
    feature("tree", "Your tree, in rings", "A GEDCOM from any genealogy program becomes a fan chart, with how any two people are related and how much DNA that predicts.", artTree()),
    feature("traits", "Traits with their papers", "Fifteen benign, well-replicated variants, each with its PubMed source and its frequency in 26 populations.", artTraits()),
    feature("evidence", "The evidence room", "Every dataset with its source, licence terms and checksum; every method with its citation; every result as a numbered fact you can export.", artEvidence()),
    feature("relatives", "How much DNA do you share?", "An inheritance simulator: pick a relationship, roll the dice of recombination, and watch how much two relatives end up sharing.", artDice()));

  const why = h("ul", { class: "why-list" },
    event("Dec 2023", "23andMe confirms that attackers took ancestry data on about 6.9 million people through its relative-matching feature.", "TechCrunch", "https://techcrunch.com/2023/12/04/23andme-confirms-hackers-stole-ancestry-data-on-6-9-million-users/"),
    event("Apr 2025", "openSNP, the open genotype-sharing site, announces it will shut down and delete its data, citing 23andMe's collapse and authoritarian governments.", "TechCrunch", "https://techcrunch.com/2025/04/01/genetic-sharing-site-opensnp-to-shut-down-citing-concerns-of-data-privacy-and-rise-in-authoritarian-governments/"),
    event("May 2025", "MyHeritage stops accepting DNA files from other companies.", "The DNA Geek", "https://thednageek.com/the-end-of-an-era-uploads-at-myheritage/"),
    event("Jun 2025", "A bankruptcy court approves the sale of 23andMe, its genetic database included, for $305 million.", "23andMe", "https://www.23andme.org/media-center/press-releases/23andme-receives-court-approval-sale-ttam-research-institute/"),
    event("Sep 2026", "GEDmatch, owned by the forensic company Qiagen, raises its Tier 1 price to $15 a month for new subscribers.", "GEDmatch", "https://www.gedmatch.com/blog/see-whats-coming-the-new-gedmatch-interface-preview-is-now-on-youtube/"));

  return h("div", { class: "fade-in" },
    hero,
    h("div", { class: "section" }, trust),
    h("div", { class: "section" },
      h("div", { class: "section-head" }, h("div", {}, h("p", { class: "kicker" }, "What you get"), h("h2", { class: "h2" }, "The analyses upload sites charge for, done here"))),
      features),
    h("div", { class: "section grid g2", style: "align-items:start" },
      h("div", { class: "card" },
        h("p", { class: "kicker" }, "Why run it here"),
        h("h2", { class: "h2", style: "margin-bottom:10px" }, "A database of DNA is a liability"),
        h("p", { class: "muted" }, "Privacy is now the most common reason Americans give for not taking a DNA test (42% in a ", h("a", { href: "https://yougov.com/en-us/articles/51527-what-americans-think-about-home-dna-tests-poll", target: "_blank", rel: "noopener" }, "YouGov poll"), "). Lineage holds nothing, so there is nothing to breach, sell or subpoena."),
        why),
      h("div", { class: "stack" },
        h("div", { class: "card" },
          h("p", { class: "kicker navy" }, "Start"),
          h("h2", { class: "h2", style: "margin-bottom:14px" }, "Three steps, one tab"),
          h("ol", { class: "steps" },
            h("li", {}, h("div", {}, h("strong", {}, "Download your raw data"), h("p", { class: "muted small", style: "margin:2px 0 0" }, "Every major test lets you download it from account settings. Keep the .zip; Lineage opens it directly."))),
            h("li", {}, h("div", {}, h("strong", {}, "Open it here"), h("p", { class: "muted small", style: "margin:2px 0 0" }, "It is parsed in a background thread of this tab, in about a second. Nothing is uploaded, and there is no account."))),
            h("li", {}, h("div", {}, h("strong", {}, "Explore, export, close"), h("p", { class: "muted small", style: "margin:2px 0 0" }, "Export a report of numbered facts if you like. Closing the tab forgets everything.")))),
          h("div", { style: "margin-top:18px" }, dropZone((f) => void startFile(f)))),
        h("div", { class: "card flat" },
          h("p", { class: "kicker" }, "What Lineage will not do"),
          h("ul", { class: "small muted", style: "margin:0;padding-left:18px;display:grid;gap:6px" },
            h("li", {}, h("strong", {}, "Draw your face from DNA. "), "Published attempts predict little beyond sex and ancestry; a co-developer of the forensic eye-, hair- and skin-colour test says the science cannot yet do a nose (", h("a", { href: "https://theintercept.com/2025/02/02/forensic-dna-phenotyping-parabon-nanolabs-police/", target: "_blank", rel: "noopener" }, "The Intercept"), ")."),
            h("li", {}, h("strong", {}, "Give you a personal \"% Yamnaya\". "), "Ancient-DNA models describe populations, not one person."),
            h("li", {}, h("strong", {}, "Report disease risk. "), "Health variants are out of scope by design."),
            h("li", {}, h("strong", {}, "Match you with strangers. "), "That needs a database of other people's DNA, which is the thing Lineage refuses to hold."))))),
    state.error ? null : h("div", { class: "section", style: "text-align:center" },
      h("p", { class: "kicker navy" }, "No file handy?"),
      h("h2", { class: "h2", style: "margin-bottom:12px" }, "Meet the Tanakas, a family that does not exist"),
      h("p", { class: "lede", style: "margin:0 auto 18px" }, "Four generations with roots in Finland, Tuscany, Kyoto and Guadalajara, generated in your browser from the reference data: seven genomes, a GEDCOM tree and a match list with the true relationships hidden until you ask."),
      h("button", { class: "btn primary", type: "button", onClick: () => void startDemo() }, icon("family"), "Explore the demo family")));
}

function event(when: string, text: string, source: string, url: string): HTMLElement {
  return h("li", {}, h("time", {}, when), h("div", {}, h("p", {}, text), h("a", { href: url, target: "_blank", rel: "noopener" }, source, " ↗")));
}

/* Small illustrations for the feature cards (static, drawn from shapes, no data). */
function artAncestry(): SVGSVGElement {
  const cols = ["--c-EUR", "--c-EAS", "--c-NAT", "--c-AFR", "--c-SAS"];
  const svg = s("svg", { viewBox: "0 0 320 180", preserveAspectRatio: "xMidYMid slice" });
  const pts: Array<[number, number, number]> = [[148, 58, 0], [160, 50, 0], [138, 66, 0], [250, 72, 1], [262, 84, 1], [240, 96, 1], [86, 104, 2], [98, 126, 2], [160, 110, 3], [176, 122, 3], [150, 128, 3], [214, 90, 4], [222, 102, 4]];
  for (const [x, y, c] of pts) svg.append(s("circle", { cx: x, cy: y, r: 14, fill: `var(${cols[c]})`, opacity: 0.18 }), s("circle", { cx: x, cy: y, r: 5, fill: `var(${cols[c]})` }));
  return svg;
}
function artRelatives(): SVGSVGElement {
  const svg = s("svg", { viewBox: "0 0 320 180", preserveAspectRatio: "xMidYMid slice" });
  const curve = (y: number, mid: number, wdt: number, o: number) => s("path", { d: `M20,${y} C${mid - wdt},${y} ${mid - wdt / 3},${y - 46} ${mid},${y - 46} S${mid + wdt},${y} 300,${y} Z`, fill: "var(--navy)", opacity: o });
  svg.append(curve(70, 150, 60, 0.3), curve(118, 180, 70, 0.16), curve(166, 120, 50, 0.16), s("line", { x1: 162, x2: 162, y1: 14, y2: 170, stroke: "var(--ink)", "stroke-width": 2, "stroke-dasharray": "5 4" }));
  return svg;
}
function artTree(): SVGSVGElement {
  const svg = s("svg", { viewBox: "0 0 320 180", preserveAspectRatio: "xMidYMid slice" });
  const cx = 160, cy = 168;
  for (let g = 0; g < 4; g++) {
    const n = 2 ** (g + 1);
    for (let k = 0; k < n; k++) {
      const a1 = Math.PI + (k / n) * Math.PI, a2 = Math.PI + ((k + 1) / n) * Math.PI, r1 = 36 + g * 32, r2 = r1 + 30;
      const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      svg.append(s("path", { d: `M${p(r1, a1)} A${r1},${r1} 0 0 1 ${p(r1, a2)} L${p(r2, a2)} A${r2},${r2} 0 0 0 ${p(r2, a1)} Z`, fill: k < n / 2 ? "var(--navy)" : "var(--brick)", opacity: 0.75 - g * 0.16, stroke: "var(--paper-2)", "stroke-width": 2 }));
    }
  }
  svg.append(s("circle", { cx, cy, r: 30, fill: "var(--ink)" }));
  return svg;
}
function artTraits(): SVGSVGElement {
  const svg = s("svg", { viewBox: "0 0 320 180", preserveAspectRatio: "xMidYMid slice" });
  const chip = (x: number, y: number, t: string, on: boolean) => [s("rect", { x, y, width: 40, height: 40, rx: 9, fill: on ? "var(--navy)" : "var(--card)", stroke: on ? "var(--navy)" : "var(--rule)" }), s("text", { x: x + 20, y: y + 27, "text-anchor": "middle", "font-size": 20, "font-weight": 600, fill: on ? "#fff" : "var(--ink)", style: "font-family:var(--mono)" }, t)];
  svg.append(...chip(96, 50, "G", true), ...chip(142, 50, "A", false), ...chip(190, 50, "C", false), ...chip(236, 50, "C", false));
  for (let i = 0; i < 26; i++) svg.append(s("circle", { cx: 40 + i * 9.6, cy: 128 + ((i * 37) % 11) - 5, r: 3.5, fill: `var(${["--c-AFR", "--c-NAT", "--c-EAS", "--c-EUR", "--c-SAS"][Math.floor(i / 5.3)]})` }));
  return svg;
}
function artEvidence(): SVGSVGElement {
  const svg = s("svg", { viewBox: "0 0 320 180", preserveAspectRatio: "xMidYMid slice" });
  for (let i = 0; i < 5; i++) svg.append(
    s("rect", { x: 40, y: 26 + i * 28, width: 240, height: 20, rx: 5, fill: "var(--card)", stroke: "var(--rule)" }),
    s("text", { x: 50, y: 40 + i * 28, "font-size": 10, fill: "var(--brick)", style: "font-family:var(--mono)" }, `fact-${i + 1}`),
    s("rect", { x: 100, y: 33 + i * 28, width: 70 + ((i * 41) % 90), height: 6, rx: 3, fill: "var(--ink-3)", opacity: 0.5 }));
  return svg;
}
function artDice(): SVGSVGElement {
  const svg = s("svg", { viewBox: "0 0 320 180", preserveAspectRatio: "xMidYMid slice" });
  for (let i = 0; i < 6; i++) {
    const y = 26 + i * 24, len = 250 - i * 22;
    svg.append(s("rect", { x: 36, y, width: len, height: 12, rx: 6, fill: "var(--card)", stroke: "var(--rule)" }));
    const a = 36 + ((i * 53) % 80), w = 40 + ((i * 29) % 70);
    svg.append(s("rect", { x: a, y, width: Math.min(w, len - (a - 36)), height: 12, rx: 6, fill: "var(--navy)", opacity: 0.8 }));
  }
  return svg;
}

export { fmt };
