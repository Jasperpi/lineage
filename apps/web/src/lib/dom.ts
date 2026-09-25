/** Tiny DOM helpers: h() for HTML, s() for SVG, and formatters. */
export type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown>;

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

function setAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.setAttribute("class", String(v));
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "html") (el as HTMLElement).innerHTML = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVG = "http://www.w3.org/2000/svg";
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  setAttrs(el, attrs);
  // The chart text classes give a default font in CSS, and any CSS rule outranks an SVG
  // presentation attribute, so an explicit size or weight is repeated as inline style.
  const fs = attrs["font-size"], fw = attrs["font-weight"];
  if (fs !== undefined && fs !== null) el.style.fontSize = typeof fs === "number" ? `${fs}px` : String(fs);
  if (fw !== undefined && fw !== null) el.style.fontWeight = String(fw);
  append(el, children);
  return el;
}

export function frag(...children: Child[]): DocumentFragment {
  const f = document.createDocumentFragment();
  const holder = document.createElement("div");
  append(holder, children);
  while (holder.firstChild) f.append(holder.firstChild);
  return f;
}

export function clear(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

export const fmt = {
  int: (n: number) => Math.round(n).toLocaleString("en-US"),
  num: (n: number, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (x: number, d = 1) => `${(x * 100).toFixed(d)}%`,
  pct0: (x: number) => `${Math.round(x * 100)}%`,
  cm: (x: number, d = 1) => `${x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} cM`,
  mb: (bp: number) => `${(bp / 1e6).toFixed(1)} Mb`,
  bp: (bp: number) => bp.toLocaleString("en-US"),
  bytes: (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${(b / 1e3).toFixed(0)} kB` : `${b} B`),
  prob: (p: number) => (p >= 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`),
};

/** An inline SVG icon from a small built-in set. */
export function icon(name: "upload" | "family" | "shield" | "arrow" | "spark" | "doc" | "sun" | "moon" | "check" | "download" | "dna" | "globe" | "tree" | "dice"): SVGSVGElement {
  const paths: Record<string, string> = {
    upload: "M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
    family: "M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.6-3.4 2.6-5 5-5s4.4 1.6 5 5m0 0c.6-3.4 2.6-5 5-5s4.4 1.6 5 5",
    shield: "M12 3 4.5 6v5.5c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5V6L12 3Zm-3.2 9 2.2 2.2 4.4-4.4",
    arrow: "M5 12h14m0 0-5-5m5 5-5 5",
    spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
    doc: "M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6M9 17h6",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
    check: "m5 12.5 4.5 4.5L19 7.5",
    download: "M12 4v12m0 0-4.5-4.5M12 16l4.5-4.5M4 20h16",
    dna: "M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12s10 6 10 6M8 6h8M8 18h8M9.5 9h5M9.5 15h5",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
    tree: "M12 4v6m0 0H6v4m6-4h6v4M6 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
    dice: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3.5 4.5h.01m7 0h.01m-3.51 3.5h.01m-3.51 3.5h.01m7 0h.01",
  };
  return s("svg", { class: "i", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, s("path", { d: paths[name] }));
}

/** The Lineage mark: two strands crossing, navy and brick. */
export function mark(size = 26): SVGSVGElement {
  return s("svg", { viewBox: "0 0 32 32", width: size, height: size, "aria-hidden": "true" },
    s("path", { d: "M10 3c0 7 12 6 12 13s-12 6-12 13", fill: "none", stroke: "var(--navy)", "stroke-width": 2.6, "stroke-linecap": "round" }),
    s("path", { d: "M22 3c0 7-12 6-12 13s12 6 12 13", fill: "none", stroke: "var(--brick)", "stroke-width": 2.6, "stroke-linecap": "round" }),
    s("path", { d: "M12.5 7.5h7M13 24.5h6M14 16h4", stroke: "var(--ink-3)", "stroke-width": 1.6, "stroke-linecap": "round" }));
}

/** A shared floating tooltip for charts. Works with mouse and touch (tap toggles). */
let tipEl: HTMLDivElement | undefined;
export function tip(target: Element, content: () => Child): void {
  const show = (x: number, y: number) => {
    tipEl ??= document.body.appendChild(h("div", { class: "tip", role: "tooltip" }));
    clear(tipEl, content());
    tipEl.classList.add("on");
    const w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    const left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
    const top = y + 16 + hgt > window.innerHeight ? y - hgt - 12 : y + 16;
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  };
  const hide = () => tipEl?.classList.remove("on");
  target.addEventListener("pointermove", (e) => { const p = e as PointerEvent; if (p.pointerType === "mouse") show(p.clientX, p.clientY); });
  target.addEventListener("pointerleave", hide);
  target.addEventListener("pointerdown", (e) => { const p = e as PointerEvent; if (p.pointerType !== "mouse") { show(p.clientX, p.clientY); setTimeout(hide, 2600); } });
}

export function download(name: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
