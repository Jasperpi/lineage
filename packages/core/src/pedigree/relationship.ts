/**
 * Relationship arithmetic. A blood relationship between two people is a set
 * of paths through common ancestors; each path is described by the number of
 * generations up from person A to the ancestor and down to person B.
 *
 * Definitions used here follow standard population genetics:
 *   - coefficient of relationship r  = sum over paths of (1/2)^(up+down)
 *     (each common ancestor contributes one path; a full relationship has two
 *      common ancestors and therefore two paths, a half relationship one)
 *   - kinship coefficient phi = r / 2
 *   - expected proportion of the autosomal genome shared "half-identical or
 *     better", which is what match lists report as shared cM, is r for every
 *     relationship except full siblings, where the two paths run through
 *     different parents and can overlap: P(share via mother OR father)
 *     = 1 - (1 - 1/2)(1 - 1/2) = 3/4, not 2 x 1/2 = 1. Double relationships
 *     (e.g. double first cousins) are handled the same way: paths grouped by
 *     which parent of A they pass through combine as 1 - prod(1 - p).
 */

export interface AncestryPath {
  /** Generations from A up to the common ancestor. 0 if A is the ancestor. */
  up: number;
  /** Generations from the common ancestor down to B. 0 if B is the ancestor. */
  down: number;
  /** Which parent of A this path leaves through (undefined for direct lineal). */
  viaParentOfA?: "father" | "mother";
  ancestorId?: string;
}

export interface RelationshipMath {
  coefficientOfRelationship: number;
  kinshipCoefficient: number;
  /** Expected share of autosomal genome half-identical or better (0-1). */
  expectedHalfIdenticalFraction: number;
  /** Degree of relationship (up + down for the closest path; siblings = 2). */
  degree: number;
}

export function relationshipMath(paths: AncestryPath[]): RelationshipMath {
  if (paths.length === 0) return { coefficientOfRelationship: 0, kinshipCoefficient: 0, expectedHalfIdenticalFraction: 0, degree: Infinity };
  let r = 0;
  let degree = Infinity;
  // Paths are grouped by the parent of A they leave through. Within a group the
  // paths run along the same haplotype of A, so at any locus at most one of them
  // can be IBD: their probabilities add. Across groups (different haplotypes)
  // sharing events are independent: P(any) = 1 - prod(1 - p_group).
  const grouped = new Map<string, number[]>();
  for (const p of paths) {
    const n = p.up + p.down;
    r += Math.pow(0.5, n);
    degree = Math.min(degree, n);
    const share = Math.pow(0.5, Math.max(0, n - 1)); // P(locus IBD along this path) = (1/2)^(n-1)
    const key = p.up === 0 || p.down === 0 ? `lineal:${p.ancestorId ?? "x"}` : (p.viaParentOfA ?? `path:${p.ancestorId ?? "?"}`);
    let arr = grouped.get(key);
    if (!arr) { arr = []; grouped.set(key, arr); }
    arr.push(share);
  }
  let noShare = 1;
  for (const shares of grouped.values()) noShare *= 1 - Math.min(1, shares.reduce((a, b) => a + b, 0));
  return {
    coefficientOfRelationship: r,
    kinshipCoefficient: r / 2,
    expectedHalfIdenticalFraction: 1 - noShare,
    degree,
  };
}

const ORDINAL = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
function ordinal(n: number): string { return ORDINAL[n] ?? `${n}th`; }
function greats(n: number): string { return n <= 0 ? "" : n === 1 ? "great-" : `${n}x great-`; }

/**
 * Name a single path from A's perspective ("B is A's ___").
 * @param bSex  used for gendered terms; omitted -> neutral wording.
 */
export function nameRelationship(up: number, down: number, half = false, bSex?: "M" | "F"): string {
  const h = half ? "half " : "";
  const g = (m: string, f: string, n: string) => (bSex === "M" ? m : bSex === "F" ? f : n);
  if (up === 0 && down === 0) return "self";
  if (up === 0) { // B is a descendant of A
    if (down === 1) return g("son", "daughter", "child");
    if (down === 2) return g("grandson", "granddaughter", "grandchild");
    return `${greats(down - 2)}${g("grandson", "granddaughter", "grandchild")}`;
  }
  if (down === 0) { // B is an ancestor of A
    if (up === 1) return g("father", "mother", "parent");
    if (up === 2) return g("grandfather", "grandmother", "grandparent");
    return `${greats(up - 2)}${g("grandfather", "grandmother", "grandparent")}`;
  }
  if (up === 1 && down === 1) return `${h}${g("brother", "sister", "sibling")}`;
  if (up === 1) { // B descends from A's sibling
    const base = g("nephew", "niece", "nibling");
    return down === 2 ? `${h}${base}` : `${h}${greats(down - 2)}${base}`;
  }
  if (down === 1) { // B is a sibling of A's ancestor
    const base = g("uncle", "aunt", "pibling");
    return up === 2 ? `${h}${base}` : `${h}${greats(up - 2)}${base}`;
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const rem = removed === 0 ? "" : removed === 1 ? " once removed" : removed === 2 ? " twice removed" : ` ${removed} times removed`;
  return `${h}${ordinal(degree)} cousin${rem}`;
}

/** Canonical autosomal genome length in cM for converting expected fractions to cM.
 *  Vendors differ (AncestryDNA ~3,475; 23andMe ~3,600; GEDmatch ~3,587 on its default map).
 *  The Shared cM Project's parent/child average (3,485 cM) is used as the reference. */
export const AUTOSOMAL_CM_REFERENCE = 3485;

export function expectedSharedCm(fraction: number, genomeCm = AUTOSOMAL_CM_REFERENCE): number {
  return fraction * genomeCm;
}
