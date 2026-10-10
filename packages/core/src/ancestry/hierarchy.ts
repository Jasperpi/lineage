/**
 * Earned detail: regional shares added up to their continent, and shown only
 * where the evidence supports them.
 *
 * componentAdmixture decides which regions are shown: a region needs to pass
 * the presence test (its share above the level genomes without that ancestry
 * reach 1% of the time, and a likelihood ratio against "none" significant at
 * 1%) and, with a calibration, a held-out precision of at least 90% at its
 * share. Every regional share that is not shown goes into "Broadly
 * <continent>" — the rule 23andMe applies window by window (Durand et al.
 * 2014): assign at the lowest level whose support clears the threshold. The
 * continents and the "Broadly" remainders get their own profile intervals
 * (the likelihood profiled over the sum), not sums of the regions' intervals.
 * This module only arranges the result for display.
 */
import type { ComponentAdmixture } from "./analyse.js";

export interface AncestryNode {
  id: string;
  label: string;
  /** Continent id for a region or a "Broadly" remainder; undefined for a continent. */
  parent?: string;
  kind: "continent" | "region" | "broadly";
  share: number;
  ci95: [number, number];
  present: boolean;
  frequencyOnly?: boolean;
}

export interface AncestryTree {
  /** Continents in descending share, each followed by its shown regions and its "Broadly" remainder. */
  nodes: AncestryNode[];
  calibrated: boolean;
}

export function ancestryTree(adm: ComponentAdmixture, opts: { labels?: Record<string, string>; frequencyOnly?: Record<string, boolean> } = {}): AncestryTree {
  const nodes: AncestryNode[] = [];
  const conts = [...new Set(adm.parents)].map((id) => {
    const members = adm.parents.map((p, k) => (p === id ? k : -1)).filter((k) => k >= 0);
    return { id, members, share: members.reduce((a, k) => a + adm.proportions[k]!, 0) };
  }).sort((a, b) => b.share - a.share);
  for (const c of conts) {
    const leaf = c.members.length === 1 && adm.components[c.members[0]!] === c.id;
    if (leaf) {
      const k = c.members[0]!;
      nodes.push({ id: c.id, label: opts.labels?.[c.id] ?? adm.labels[k]!, kind: "continent", share: c.share, ci95: adm.ci95[k]!, present: adm.present[k]! });
      continue;
    }
    const group = adm.groups.find((x) => x.id === c.id);
    const label = opts.labels?.[c.id] ?? c.id;
    const anyShown = c.members.some((k) => adm.shown[k]);
    const broadly = adm.groups.find((x) => x.id === `${c.id}:broadly`);
    nodes.push({
      id: c.id, label, kind: "continent", share: c.share, ci95: group?.ci95 ?? [c.share, c.share],
      present: c.members.some((k) => adm.present[k]) || (broadly !== undefined && broadly.ci95[0] > 0 && c.share > Math.max(...c.members.map((k) => adm.presence[k]!))),
    });
    for (const k of [...c.members].sort((a, b) => adm.proportions[b]! - adm.proportions[a]!)) {
      if (!adm.shown[k]) continue;
      nodes.push({ id: adm.components[k]!, label: adm.labels[k]!, parent: c.id, kind: "region", share: adm.proportions[k]!, ci95: adm.ci95[k]!, present: true, frequencyOnly: opts.frequencyOnly?.[adm.components[k]!] });
    }
    if (broadly && (broadly.share >= 0.005 || !anyShown)) {
      nodes.push({ id: broadly.id, label: `Broadly ${label}`, parent: c.id, kind: "broadly", share: broadly.share, ci95: broadly.ci95, present: broadly.ci95[0] > 0 });
    }
  }
  return { nodes, calibrated: adm.calibrated };
}
