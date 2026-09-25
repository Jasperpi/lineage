import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource-variable/public-sans/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/app.css";
import { state, subscribe, type State } from "./lib/store.js";
import { startLedger } from "./lib/ledger.js";
import { ready } from "./lib/engine.js";
import { shell, restoreTheme } from "./views/shell.js";
import { home } from "./views/home.js";
import { overview } from "./views/overview.js";
import { ancestry } from "./views/ancestry.js";
import { relatives } from "./views/relatives.js";
import { tree } from "./views/tree.js";
import { traits } from "./views/traits.js";
import { evidence } from "./views/evidence.js";

restoreTheme();
startLedger();

/** Each route and the pieces of state that should redraw it. */
const ROUTES: Record<string, { view: () => HTMLElement; deps: Array<keyof State>; title: string }> = {
  "": { view: home, deps: ["error"], title: "Lineage: read your DNA without handing it over" },
  overview: { view: overview, deps: ["you"], title: "Your genome · Lineage" },
  ancestry: { view: ancestry, deps: ["you", "ancestry"], title: "Ancestry · Lineage" },
  relatives: { view: relatives, deps: ["you", "demo", "compare", "other", "matches", "matchesName", "tick"], title: "Relatives · Lineage" },
  tree: { view: tree, deps: ["gedcom"], title: "Family tree · Lineage" },
  traits: { view: traits, deps: ["you", "traits"], title: "Traits · Lineage" },
  evidence: { view: evidence, deps: ["you"], title: "Evidence · Lineage" },
};

const app = document.getElementById("app")!;
const { root, main, setRoute } = shell();
app.replaceChildren(root);

let current = "";
let seen: unknown[] = [];

function routeName(): string {
  const r = location.hash.replace(/^#\/?/, "").split("?")[0] ?? "";
  return r in ROUTES ? r : "";
}

function render(scrollTop: boolean): void {
  const r = ROUTES[current]!;
  seen = r.deps.map((k) => state[k]);
  main.replaceChildren(r.view());
  document.title = r.title;
  setRoute(current);
  if (scrollTop) window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", () => {
  if (location.hash === "#main") return;
  current = routeName();
  render(true);
  main.focus({ preventScroll: true });
});

// Redraw the current view when the state it depends on changes, keeping the scroll position.
subscribe(() => {
  const r = ROUTES[current]!;
  if (r.deps.some((k, i) => state[k] !== seen[i])) {
    const y = window.scrollY;
    render(false);
    window.scrollTo({ top: y });
  }
});

current = routeName();
render(false);
void ready;
