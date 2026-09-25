/** Chart helpers shared by every figure: responsive rendering and figure chrome. */
import { h, type Child } from "../lib/dom.js";

/**
 * Render `draw(width)` into a container and redraw when its width changes by
 * more than a few pixels, so charts are laid out at real pixel sizes and
 * their text stays legible on phones instead of shrinking with a viewBox.
 */
export function responsive(draw: (width: number, first: boolean) => Element, opts: { min?: number } = {}): HTMLElement {
  const box = h("div", { class: "chart" });
  let last = -1;
  const render = () => {
    const w = Math.max(opts.min ?? 280, Math.floor(box.clientWidth));
    if (Math.abs(w - last) < 6) return;
    // `first` lets a chart animate its entrance once, not again on every resize.
    const first = last < 0;
    last = w;
    box.replaceChildren(draw(w, first));
  };
  const ro = new ResizeObserver(() => render());
  ro.observe(box);
  requestAnimationFrame(render);
  return box;
}

export interface FigureOpts {
  kicker?: string;
  title: Child;
  caption?: Child;
  body: Child;
  foot?: Child;
  tools?: Child;
  id?: string;
}

/** A numbered figure: kicker, a title that states the finding, caption, chart, and a source line. */
export function figure(o: FigureOpts): HTMLElement {
  return h("section", { class: "figure fade-in", id: o.id },
    h("div", { class: "fig-head" },
      o.kicker ? h("p", { class: "kicker" }, o.kicker) : null,
      h("h3", {}, o.title),
      o.caption ? h("p", {}, o.caption) : null,
      o.tools ? h("div", { class: "fig-tools" }, o.tools) : null),
    h("div", { class: "fig-body" }, o.body),
    o.foot ? h("div", { class: "fig-foot" }, o.foot) : null);
}

/** Segmented control. */
export function segmented<T extends string>(options: Array<[T, string]>, value: T, onChange: (v: T) => void): HTMLElement {
  const el = h("div", { class: "seg", role: "group" });
  const draw = (v: T) => el.replaceChildren(...options.map(([k, label]) => h("button", { type: "button", "aria-pressed": String(k === v), onClick: () => { draw(k); onChange(k); } }, label)));
  draw(value);
  return el;
}

/** A 95% Wilson score interval for a proportion. */
export function wilson(p: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1];
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}

export function niceTicks(max: number, count = 5): number[] {
  const step0 = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
