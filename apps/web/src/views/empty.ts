/** The empty state shown by pages that need a file: two ways in, and a line on what the page will show. */
import { h, icon } from "../lib/dom.js";
import { openDemo, openFile } from "../lib/actions.js";
import { dropZone } from "./home.js";

export function emptyState(kicker: string, title: string, text: string, extra?: HTMLElement): HTMLElement {
  return h("div", { class: "fade-in" },
    h("div", { class: "empty" },
      h("p", { class: "kicker" }, kicker),
      h("h1", { class: "h2" }, title),
      h("p", { class: "lede" }, text),
      h("div", { class: "row", style: "justify-content:center;margin-bottom:22px" },
        h("button", { class: "btn primary", type: "button", onClick: () => void openDemo() }, icon("family"), "Use the demo family")),
      h("div", { style: "max-width:560px;margin:0 auto" }, dropZone((f) => void openFile(f)))),
    extra ?? null);
}
