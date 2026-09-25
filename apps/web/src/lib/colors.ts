/**
 * Colours for continental components and the 26 populations. Components use
 * the Okabe-Ito hues defined in the stylesheet (they stay distinct under the
 * common colour-vision deficiencies); each population is a lighter or darker
 * step of its continent's hue, and charts always label populations directly
 * rather than relying on colour alone.
 */
export const COMPONENT_VAR: Record<string, string> = { AFR: "--c-AFR", EUR: "--c-EUR", EAS: "--c-EAS", SAS: "--c-SAS", NAT: "--c-NAT", AMR: "--c-AMR" };

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export function componentColor(id: string): string {
  return `var(${COMPONENT_VAR[id] ?? "--ink-3"})`;
}

/** Hex colour of a component resolved for the current theme (for canvas and gradients). */
export function componentHex(id: string): string {
  return cssVar(COMPONENT_VAR[id] ?? "--ink-3");
}

/** A shade of the continent's hue for population `i` of `n` in that continent. */
export function populationColor(superpop: string, i: number, n: number): string {
  const base = `var(${COMPONENT_VAR[superpop] ?? "--ink-3"})`;
  if (n <= 1) return base;
  const t = i / (n - 1); // 0..1
  const mix = Math.round(-28 + t * 56); // darker to lighter
  return mix < 0 ? `color-mix(in srgb, ${base} ${100 + mix}%, black)` : `color-mix(in srgb, ${base} ${100 - mix}%, white)`;
}

export const SUPER_LABEL: Record<string, string> = {
  AFR: "African", AMR: "Admixed American", EAS: "East Asian", EUR: "European", SAS: "South Asian",
};
