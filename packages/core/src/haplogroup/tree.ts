/**
 * Haplogroup calling against a phylogenetic tree of defining variants.
 *
 * The framework ships no tree of its own: Y-DNA trees (ISOGG, YFull) and the
 * mtDNA tree (PhyloTree) are large, versioned, and separately licensed, so
 * they are loaded from files. Two loaders are provided:
 *  - ISOGG-style Y SNP index CSV (Name, Subgroup Name, Alternate Names,
 *    rs numbers, Build 37 Number, Build 38 Number, Mutation Info), where the
 *    hierarchy is encoded in long-form names ("R1b1a1b" is a child of "R1b1a1"),
 *  - a plain tab-separated tree: haplogroup <TAB> parent <TAB> mutations,
 *    with mutations written as e.g. "A263G" (mtDNA, rCRS positions) or
 *    "12345678 A>G" (Y, physical position).
 *
 * The caller walks from the root, scoring each child by derived vs ancestral
 * calls on the chip. Consumer chips test only a few thousand Y SNPs and a few
 * thousand mtDNA positions, so most branches have zero coverage; the result
 * therefore reports the deepest branch with positive evidence AND the
 * coverage it rests on, never a bare label.
 */
import type { Chrom } from "../genome.js";
import type { Kit } from "../kit/kit.js";
import { complement } from "../util/alleles.js";
import { detectDelimiter, findColumn, iterateLines, splitDelimited } from "../util/csv.js";

export interface DefiningVariant {
  /** Physical position on the chromosome (build 37 for Y kits; rCRS for MT). */
  pos: number;
  ancestral: string;
  derived: string;
  name?: string;
  rsid?: string;
}

export interface HaploNode {
  name: string;
  parent?: string;
  children: string[];
  variants: DefiningVariant[];
}

export interface HaploTree {
  chrom: "Y" | "MT";
  build: 37 | 38 | "rCRS";
  root: string;
  nodes: Map<string, HaploNode>;
  source?: string;
}

export interface NodeEvidence { node: string; derived: number; ancestral: number; noCall: number; untested: number; derivedNames: string[]; ancestralNames: string[] }

export interface HaplogroupCall {
  chrom: "Y" | "MT";
  /** Deepest branch supported by at least one derived call with no contradicting ancestral call along the path. */
  haplogroup: string | undefined;
  /** Path from the root to the call, with evidence per step. */
  path: NodeEvidence[];
  /** Branches below the call that had derived calls but also contradictions or no calls, for human review. */
  ambiguous: NodeEvidence[];
  coverage: { treeVariants: number; testedOnChip: number };
  note: string;
}

function testVariant(kit: Kit, chrom: Chrom, v: DefiningVariant): "derived" | "ancestral" | "nocall" | "untested" {
  const i = kit.indexAt(chrom, v.pos);
  if (i === undefined) return "untested";
  const g = kit.genotype[i]!;
  if (!g) return "nocall";
  const alleles = new Set(g.split(""));
  // Vendor files are on the forward strand, as are ISOGG/PhyloTree mutations, so match exactly.
  // Only a file of unknown strand is allowed a complement match, and never at a palindromic site
  // (C>G or A>T), where the complement is indistinguishable from the other allele.
  const palindromic = complement(v.ancestral) === v.derived;
  const has = (a: string) => alleles.has(a) || (kit.meta.strand !== "plus" && !palindromic && alleles.has(complement(a)));
  const der = has(v.derived), anc = has(v.ancestral);
  if (der && !anc) return "derived";
  if (anc && !der) return "ancestral";
  return "nocall"; // heterozygous on a haploid chromosome = unreliable
}

function evidence(kit: Kit, tree: HaploTree, node: HaploNode): NodeEvidence {
  const e: NodeEvidence = { node: node.name, derived: 0, ancestral: 0, noCall: 0, untested: 0, derivedNames: [], ancestralNames: [] };
  for (const v of node.variants) {
    const r = testVariant(kit, tree.chrom, v);
    const label = v.name ?? `${v.pos}${v.ancestral}>${v.derived}`;
    if (r === "derived") { e.derived++; e.derivedNames.push(label); }
    else if (r === "ancestral") { e.ancestral++; e.ancestralNames.push(label); }
    else if (r === "nocall") e.noCall++;
    else e.untested++;
  }
  return e;
}

export function callHaplogroup(kit: Kit, tree: HaploTree, opts: { maxAncestralTolerance?: number } = {}): HaplogroupCall {
  const tol = opts.maxAncestralTolerance ?? 0;
  let treeVariants = 0, tested = 0;
  for (const n of tree.nodes.values()) for (const v of n.variants) { treeVariants++; if (kit.indexAt(tree.chrom, v.pos) !== undefined) tested++; }

  const path: NodeEvidence[] = [];
  const ambiguous: NodeEvidence[] = [];
  let cur = tree.nodes.get(tree.root);
  let call: string | undefined;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.name)) {
    guard.add(cur.name);
    const scored = cur.children.map((c) => tree.nodes.get(c)).filter((n): n is HaploNode => !!n).map((n) => evidence(kit, tree, n));
    const supported = scored.filter((e) => e.derived > 0 && e.ancestral <= tol && e.derived > e.ancestral);
    for (const e of scored) if (e.derived > 0 && !supported.includes(e)) ambiguous.push(e);
    if (supported.length === 0) break;
    supported.sort((a, b) => (b.derived - b.ancestral) - (a.derived - a.ancestral));
    if (supported.length > 1 && (supported[0]!.derived - supported[0]!.ancestral) === (supported[1]!.derived - supported[1]!.ancestral)) {
      // Two sibling branches equally supported: cannot choose; stop here and report both.
      ambiguous.push(...supported);
      break;
    }
    const best = supported[0]!;
    path.push(best);
    call = best.node;
    cur = tree.nodes.get(best.node);
  }
  const note = call
    ? `Deepest supported branch ${call} on ${path.reduce((a, e) => a + e.derived, 0)} derived calls; ${tested}/${treeVariants} tree variants are on this chip.`
    : `No branch below the root had a derived call on this chip (${tested}/${treeVariants} tree variants tested).`;
  return { chrom: tree.chrom, haplogroup: call, path, ambiguous, coverage: { treeVariants, testedOnChip: tested }, note };
}

/* ------------------------------------------------------------------ */
/* Loaders                                                             */
/* ------------------------------------------------------------------ */

export function parseMutation(s: string): DefiningVariant | undefined {
  const t = s.trim();
  let m = t.match(/^([ACGT])(\d+)([ACGT])!*$/i); // A263G (mtDNA)
  if (m) return { pos: Number(m[2]), ancestral: m[1]!.toUpperCase(), derived: m[3]!.toUpperCase(), name: t };
  m = t.match(/^(\d+)\s*[:\s]?\s*([ACGT])\s*(?:->|>|\/)\s*([ACGT])$/i); // 12345 A>G
  if (m) return { pos: Number(m[1]), ancestral: m[2]!.toUpperCase(), derived: m[3]!.toUpperCase() };
  return undefined;
}

/** Plain tree: haplogroup<TAB>parent<TAB>mutation1,mutation2 (parent blank for root). */
export function parseSimpleTree(text: string, chrom: "Y" | "MT", build: HaploTree["build"]): HaploTree {
  const nodes = new Map<string, HaploNode>();
  let root: string | undefined;
  for (const line of iterateLines(text)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [name, parent, muts] = line.split("\t").map((x) => x?.trim() ?? "");
    if (!name) continue;
    const variants = (muts ?? "").split(/[,;]+/).map(parseMutation).filter((v): v is DefiningVariant => !!v);
    nodes.set(name, { name, parent: parent || undefined, children: [], variants });
    if (!parent) root = root ?? name;
  }
  for (const n of nodes.values()) if (n.parent) nodes.get(n.parent)?.children.push(n.name);
  if (!root) throw new Error("Tree has no root (a line with an empty parent column)");
  return { chrom, build, root, nodes };
}

/**
 * ISOGG Y-DNA SNP index. Long-form haplogroup names encode the hierarchy:
 * the parent of a name is its longest proper prefix that is also a haplogroup.
 * Names ending in "~" are provisional and kept as-is.
 */
export function parseIsoggSnpIndex(text: string, build: 37 | 38 = 37): HaploTree {
  const delim = detectDelimiter(text.slice(0, 5000));
  let cols: { name: number; group: number; rs: number; pos: number; mut: number } | undefined;
  const byGroup = new Map<string, DefiningVariant[]>();
  for (const raw of iterateLines(text)) {
    if (!raw.trim()) continue;
    const f = splitDelimited(raw, delim).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (!cols) {
      const name = findColumn(f, ["name", "snp"]);
      const group = findColumn(f, ["subgroup name", "haplogroup", "subgroup"]);
      if (name === -1 || group === -1) continue;
      cols = {
        name, group,
        rs: findColumn(f, ["rs numbers", "rsid", "rs"]),
        pos: findColumn(f, [build === 37 ? "build 37 number" : "build 38 number", "build 37", "build 38", "position"]),
        mut: findColumn(f, ["mutation info", "mutation", "alleles"]),
      };
      continue;
    }
    const group = f[cols.group] ?? "";
    const pos = Number((f[cols.pos] ?? "").replace(/[^\d]/g, ""));
    const mut = (f[cols.mut] ?? "").match(/([ACGT])\s*(?:->|>|to)\s*([ACGT])/i);
    if (!group || !pos || !mut) continue;
    const v: DefiningVariant = { pos, ancestral: mut[1]!.toUpperCase(), derived: mut[2]!.toUpperCase(), name: f[cols.name], rsid: f[cols.rs] || undefined };
    let arr = byGroup.get(group); if (!arr) { arr = []; byGroup.set(group, arr); }
    arr.push(v);
  }
  const names = [...byGroup.keys()];
  const nodes = new Map<string, HaploNode>();
  const rootName = "Y-Adam";
  nodes.set(rootName, { name: rootName, children: [], variants: [] });
  const nameSet = new Set(names);
  for (const n of names) nodes.set(n, { name: n, children: [], variants: byGroup.get(n)! });
  for (const n of names) {
    let parent: string | undefined;
    for (let len = n.length - 1; len >= 1; len--) {
      const prefix = n.slice(0, len).replace(/~$/, "");
      if (nameSet.has(prefix) && prefix !== n) { parent = prefix; break; }
    }
    const node = nodes.get(n)!;
    node.parent = parent ?? rootName;
    nodes.get(node.parent)!.children.push(n);
  }
  return { chrom: "Y", build, root: rootName, nodes, source: "ISOGG SNP index" };
}
