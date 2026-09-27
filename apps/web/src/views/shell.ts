/** The frame around every page: top bar, progress, errors, footer with the network ledger. */
import { h, icon, mark, clear, fmt } from "../lib/dom.js";
import { state, subscribe, update } from "../lib/store.js";
import { ledger, onLedger } from "../lib/ledger.js";
import { go } from "../lib/actions.js";

export const NAV: Array<[string, string]> = [
  ["overview", "Your genome"], ["ancestry", "Ancestry"], ["relatives", "Relatives"], ["tree", "Family tree"], ["traits", "Traits"], ["evidence", "Evidence"],
];

export function shell(): { root: HTMLElement; main: HTMLElement; setRoute: (r: string) => void } {
  const nav = h("nav", { class: "nav", "aria-label": "Sections" }, ...NAV.map(([r, label]) => h("a", { href: `#/${r}`, "data-route": r }, label)));
  const fileChip = h("button", { class: "chip file", type: "button", title: "The loaded file", onClick: () => go("overview") });
  const ledgerChip = h("button", { class: "chip", type: "button", title: "Every request this page has made", onClick: () => { go("evidence"); setTimeout(() => document.getElementById("privacy")?.scrollIntoView(), 60); } });
  const themeBtn = h("button", { class: "chip theme-toggle", type: "button", "aria-label": "Switch between light and dark", onClick: () => toggleTheme() });
  const progress = h("div", { class: "progress", style: "height:3px;border-radius:0;display:none" }, h("i"));
  const busyLine = h("div", { class: "tiny mono", style: "display:none;max-width:var(--page);margin:0 auto;padding:6px 24px;color:var(--ink-3)" });
  const errorBox = h("div", { style: "display:none;max-width:var(--page);margin:14px auto 0;padding:0 24px" });
  const main = h("main", { class: "page", id: "main", tabindex: "-1" });
  const ledgerLine = h("p", { class: "ledger-line" });
  const topbar = h("header", { class: "topbar" },
    h("div", { class: "topbar-in" },
      h("a", { class: "brand", href: "#/", "aria-label": "Lineage home" }, mark(26), h("b", {}, "Lineage")),
      nav,
      h("div", { class: "status" }, fileChip, ledgerChip, themeBtn)),
    progress, busyLine);
  const footer = h("footer", { class: "footer" },
    h("div", { class: "footer-in" },
      h("div", {},
        h("p", {}, h("strong", { style: "color:var(--ink-2)" }, "Lineage"), " reads consumer DNA files and family trees in your browser. It is open source (", h("a", { href: "https://github.com/Jasperpi/lineage", target: "_blank", rel: "noopener" }, "the code and data scripts"), ", MIT licence); it makes no accounts, runs no analytics, and is not a medical device."),
        h("p", {}, "Reference data: 1000 Genomes Project phase 3 (2,504 genomes, 26 populations); HapMap II genetic map on GRCh37; Illumina GSA and OmniExpress manifests; Shared cM Project v4 (Bettinger 2020, via DNA Painter). Details and checksums on the ", h("a", { href: "#/evidence" }, "Evidence"), " page."),
        ledgerLine),
      h("div", {},
        h("p", {}, "Part of ", h("a", { href: "https://jaspermeller.com", target: "_top" }, "jaspermeller.com"), "."),
        h("p", {}, "Genetic similarity to reference samples is not ethnicity, nationality or identity. Relationship estimates are probabilities under a stated model, never proof."))));
  const root = h("div", { class: "shell" }, h("a", { href: "#main", class: "sr" }, "Skip to content"), topbar, errorBox, main, footer);

  const paintStatus = () => {
    const you = state.you;
    fileChip.style.display = you ? "" : "none";
    if (you) clear(fileChip, icon("dna"), you.demo ? "Demo: Leo Tanaka" : you.name);
    const l = ledger();
    clear(ledgerChip, h("span", { class: "dot", style: l.elsewhere.length ? "background:var(--bad)" : "" }), l.elsewhere.length ? `${l.elsewhere.length} requests elsewhere` : "No DNA sent");
    ledgerChip.title = l.elsewhere.length ? `${l.elsewhere.length} requests went to other sites; the Evidence page lists them` : `All ${l.total} requests so far went to this site, and none carries your files`;
    ledgerLine.textContent = `Network ledger: ${l.total} requests so far, ${l.elsewhere.length === 0 ? "all to this site" : `${l.elsewhere.length} to other sites`} (${fmt.bytes(l.bytes)} received). Your files are read in this tab; nothing about them is sent anywhere.`;
    const b = state.busy;
    progress.style.display = b ? "" : "none";
    busyLine.style.display = b ? "" : "none";
    if (b) { (progress.firstChild as HTMLElement).style.width = `${Math.round((b.fraction ?? 0.1) * 100)}%`; busyLine.textContent = `${b.label}…`; }
    if (state.error) {
      errorBox.style.display = "";
      clear(errorBox, h("div", { class: "note warn", role: "alert" }, h("strong", {}, "That didn't work. "), state.error, " ", h("button", { class: "btn ghost small", type: "button", onClick: () => update({ error: undefined }) }, "Dismiss")));
    } else errorBox.style.display = "none";
    const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    clear(themeBtn, icon(dark ? "sun" : "moon"));
  };
  subscribe(paintStatus);
  onLedger(paintStatus);
  paintStatus();

  // On phones the nav scrolls sideways: mark when it is scrolled to the end (drops the edge fade),
  // and bring the current page's link into view.
  const markEnd = () => nav.toggleAttribute("data-end", nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
  nav.addEventListener("scroll", markEnd, { passive: true });
  new ResizeObserver(markEnd).observe(nav);
  const setRoute = (r: string) => {
    for (const a of nav.querySelectorAll("a")) a.setAttribute("aria-current", a.dataset.route === r ? "page" : "false");
    const active = nav.querySelector<HTMLElement>(`a[data-route="${r}"]`);
    if (active && nav.scrollWidth > nav.clientWidth) {
      const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2);
    }
    markEnd();
    paintStatus();
  };
  return { root, main, setRoute };
}

function toggleTheme(): void {
  const el = document.documentElement;
  const dark = el.dataset.theme === "dark" || (!el.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  el.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("lineage.theme", el.dataset.theme); } catch { /* storage unavailable */ }
  update({});
}

export function restoreTheme(): void {
  try { const t = localStorage.getItem("lineage.theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch { /* storage unavailable */ }
}
