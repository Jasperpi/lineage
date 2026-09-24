/**
 * GEDCOM parser (5.5, 5.5.1 and the 7.0 line grammar). Produces individuals
 * and families with the fields genealogists actually use, keeps every raw tag
 * so nothing is lost, and exposes pedigree navigation (ancestors, descendants,
 * matrilineal / patrilineal lines, relationship discovery).
 */
import { type AncestryPath, relationshipMath, nameRelationship, type RelationshipMath } from "../pedigree/relationship.js";
import { iterateLines } from "../util/csv.js";

export interface GedcomNode { level: number; xref?: string; tag: string; value: string; children: GedcomNode[] }

export interface GedcomEvent { type: string; date?: string; place?: string; /** ISO year if parseable */ year?: number }

export interface Individual {
  id: string;
  name: string;
  given?: string;
  surname?: string;
  sex?: "M" | "F";
  birth?: GedcomEvent;
  death?: GedcomEvent;
  /** Family ids in which this person is a child (usually one). */
  famc: string[];
  /** Family ids in which this person is a spouse/parent. */
  fams: string[];
  raw: GedcomNode;
}

export interface Family {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriage?: GedcomEvent;
  raw: GedcomNode;
}

export interface GedcomFile {
  version?: string;
  source?: string;
  charset?: string;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  warnings: string[];
}

export function parseGedcomLines(text: string): GedcomNode[] {
  const roots: GedcomNode[] = [];
  const stack: GedcomNode[] = [];
  let lineNo = 0;
  for (let line of iterateLines(text)) {
    lineNo++;
    if (lineNo === 1) line = line.replace(/^﻿/, "");
    if (!line.trim()) continue;
    const m = line.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/);
    if (!m) continue;
    const level = Number(m[1]);
    const node: GedcomNode = { level, xref: m[2], tag: m[3]!.toUpperCase(), value: m[4] ?? "", children: [] };
    if (node.tag === "CONT" || node.tag === "CONC") {
      const parent = stack[stack.length - 1];
      if (parent) parent.value += (node.tag === "CONT" ? "\n" : "") + node.value;
      continue;
    }
    while (stack.length > level) stack.pop();
    if (level === 0) roots.push(node); else stack[stack.length - 1]?.children.push(node);
    stack.push(node);
  }
  return roots;
}

function child(node: GedcomNode, tag: string): GedcomNode | undefined { return node.children.find((c) => c.tag === tag); }
function childrenOf(node: GedcomNode, tag: string): GedcomNode[] { return node.children.filter((c) => c.tag === tag); }

function parseEvent(node: GedcomNode | undefined): GedcomEvent | undefined {
  if (!node) return undefined;
  const date = child(node, "DATE")?.value.trim();
  const place = child(node, "PLAC")?.value.trim();
  const yearMatch = date?.match(/(\d{4})/);
  return { type: node.tag, date: date || undefined, place: place || undefined, year: yearMatch ? Number(yearMatch[1]) : undefined };
}

export function parseGedcom(text: string): GedcomFile {
  const roots = parseGedcomLines(text);
  const file: GedcomFile = { individuals: new Map(), families: new Map(), warnings: [] };
  for (const r of roots) {
    if (r.tag === "HEAD") {
      file.source = child(r, "SOUR")?.value;
      file.version = child(child(r, "GEDC") ?? r, "VERS")?.value;
      file.charset = child(r, "CHAR")?.value;
    } else if (r.tag === "INDI" && r.xref) {
      const nameNode = child(r, "NAME");
      const rawName = nameNode?.value ?? "";
      const surnameMatch = rawName.match(/\/([^/]*)\//);
      const surname = child(nameNode ?? r, "SURN")?.value || surnameMatch?.[1]?.trim() || undefined;
      const given = child(nameNode ?? r, "GIVN")?.value || rawName.replace(/\/[^/]*\//, "").trim() || undefined;
      const sexRaw = child(r, "SEX")?.value.trim().toUpperCase();
      file.individuals.set(r.xref, {
        id: r.xref,
        name: rawName.replace(/\//g, "").replace(/\s+/g, " ").trim() || r.xref,
        given, surname,
        sex: sexRaw === "M" || sexRaw === "F" ? sexRaw : undefined,
        birth: parseEvent(child(r, "BIRT")),
        death: parseEvent(child(r, "DEAT")),
        famc: childrenOf(r, "FAMC").map((c) => c.value.trim()),
        fams: childrenOf(r, "FAMS").map((c) => c.value.trim()),
        raw: r,
      });
    } else if (r.tag === "FAM" && r.xref) {
      file.families.set(r.xref, {
        id: r.xref,
        husband: child(r, "HUSB")?.value.trim() || undefined,
        wife: child(r, "WIFE")?.value.trim() || undefined,
        children: childrenOf(r, "CHIL").map((c) => c.value.trim()),
        marriage: parseEvent(child(r, "MARR")),
        raw: r,
      });
    }
  }
  // Integrity checks
  for (const f of file.families.values()) {
    for (const id of [f.husband, f.wife, ...f.children]) if (id && !file.individuals.has(id)) file.warnings.push(`Family ${f.id} references missing individual ${id}`);
  }
  for (const i of file.individuals.values()) {
    for (const id of [...i.famc, ...i.fams]) if (!file.families.has(id)) file.warnings.push(`Individual ${i.id} references missing family ${id}`);
  }
  return file;
}

/* ------------------------------------------------------------------ */
/* Pedigree navigation                                                 */
/* ------------------------------------------------------------------ */

export function parentsOf(file: GedcomFile, id: string): { father?: string; mother?: string } {
  const indi = file.individuals.get(id);
  const famId = indi?.famc[0];
  const fam = famId ? file.families.get(famId) : undefined;
  return { father: fam?.husband, mother: fam?.wife };
}

export function childrenOfPerson(file: GedcomFile, id: string): string[] {
  const indi = file.individuals.get(id);
  if (!indi) return [];
  const out: string[] = [];
  for (const famId of indi.fams) for (const c of file.families.get(famId)?.children ?? []) out.push(c);
  return out;
}

export interface AhnentafelEntry { number: number; generation: number; id: string; individual: Individual }

/** Ancestors in Ahnentafel numbering: 1 = self, 2 = father, 3 = mother, 2n = father of n, 2n+1 = mother of n. */
export function ahnentafel(file: GedcomFile, rootId: string, maxGenerations = 12): AhnentafelEntry[] {
  const out: AhnentafelEntry[] = [];
  const visit = (id: string, n: number, gen: number) => {
    const indi = file.individuals.get(id);
    if (!indi || gen > maxGenerations) return;
    out.push({ number: n, generation: gen, id, individual: indi });
    const { father, mother } = parentsOf(file, id);
    if (father) visit(father, 2 * n, gen + 1);
    if (mother) visit(mother, 2 * n + 1, gen + 1);
  };
  visit(rootId, 1, 0);
  return out.sort((a, b) => a.number - b.number);
}

/** Map ancestorId -> list of (generations up, first parent of root on the path). Includes root at 0. */
export function ancestorDepths(file: GedcomFile, rootId: string, maxGenerations = 15): Map<string, Array<{ up: number; via?: "father" | "mother" }>> {
  const out = new Map<string, Array<{ up: number; via?: "father" | "mother" }>>();
  const walk = (id: string, up: number, via: "father" | "mother" | undefined) => {
    if (up > maxGenerations) return;
    let arr = out.get(id); if (!arr) { arr = []; out.set(id, arr); }
    if (arr.length > 64) return; // pedigree collapse guard
    arr.push({ up, via });
    const { father, mother } = parentsOf(file, id);
    if (father) walk(father, up + 1, via ?? "father");
    if (mother) walk(mother, up + 1, via ?? "mother");
  };
  walk(rootId, 0, undefined);
  return out;
}

export interface FoundRelationship {
  a: string;
  b: string;
  paths: AncestryPath[];
  /** The nearest common ancestors (a couple for a full relationship). */
  commonAncestors: string[];
  /** Description from A's perspective: "B is A's ___". */
  description: string;
  math: RelationshipMath;
}

/**
 * Discover how two individuals are related through blood. Only the NEAREST
 * common ancestors count as relationship paths: an ancestor whose own parents
 * are also common ancestors is skipped (otherwise every cousin would also be a
 * "distant cousin" through each grandparent of the shared couple).
 */
export function findRelationship(file: GedcomFile, aId: string, bId: string): FoundRelationship | undefined {
  const da = ancestorDepths(file, aId), db = ancestorDepths(file, bId);
  const common = [...da.keys()].filter((id) => db.has(id));
  if (common.length === 0) return undefined;
  const commonSet = new Set(common);
  const nearest = common.filter((id) => {
    const { father, mother } = parentsOf(file, id);
    return !((father && commonSet.has(father)) && (mother && commonSet.has(mother)) || (father && commonSet.has(father) && !mother) || (mother && commonSet.has(mother) && !father));
  });
  const paths: AncestryPath[] = [];
  for (const anc of nearest) {
    for (const ua of da.get(anc)!) for (const ub of db.get(anc)!) {
      paths.push({ up: ua.up, down: ub.up, viaParentOfA: ua.via, ancestorId: anc });
    }
  }
  paths.sort((p, q) => (p.up + p.down) - (q.up + q.down));
  const closest = paths[0]!;
  // Half vs full: full if two distinct nearest ancestors share the closest (up, down)
  const sameLevel = paths.filter((p) => p.up === closest.up && p.down === closest.down);
  const distinctAncestors = new Set(sameLevel.map((p) => p.ancestorId));
  const half = distinctAncestors.size < 2 && !(closest.up === 0 || closest.down === 0);
  const bSex = file.individuals.get(bId)?.sex;
  let description = nameRelationship(closest.up, closest.down, half, bSex);
  if (paths.length > sameLevel.length) description += " (plus additional, more distant connections)";
  return { a: aId, b: bId, paths, commonAncestors: nearest, description, math: relationshipMath(paths) };
}

/** Strict maternal line: mother, mother's mother, ... (the mitochondrial DNA line). */
export function matrilineage(file: GedcomFile, id: string): Individual[] {
  const out: Individual[] = [];
  let cur: string | undefined = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const indi = file.individuals.get(cur);
    if (!indi) break;
    out.push(indi);
    cur = parentsOf(file, cur).mother;
  }
  return out;
}

/** Strict paternal line: father, father's father, ... (the Y-chromosome line; only meaningful for a male root). */
export function patrilineage(file: GedcomFile, id: string): Individual[] {
  const out: Individual[] = [];
  let cur: string | undefined = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const indi = file.individuals.get(cur);
    if (!indi) break;
    out.push(indi);
    cur = parentsOf(file, cur).father;
  }
  return out;
}

export interface GedcomStats {
  individuals: number;
  families: number;
  withBirthYear: number;
  earliestBirthYear?: number;
  latestBirthYear?: number;
  surnames: Array<{ surname: string; count: number }>;
  places: Array<{ place: string; count: number }>;
  warnings: number;
}

export function gedcomStats(file: GedcomFile, top = 15): GedcomStats {
  const surnames = new Map<string, number>(), places = new Map<string, number>();
  let withBirth = 0, earliest: number | undefined, latest: number | undefined;
  for (const i of file.individuals.values()) {
    if (i.surname) surnames.set(i.surname, (surnames.get(i.surname) ?? 0) + 1);
    for (const ev of [i.birth, i.death]) if (ev?.place) places.set(ev.place, (places.get(ev.place) ?? 0) + 1);
    if (i.birth?.year) {
      withBirth++;
      earliest = earliest === undefined ? i.birth.year : Math.min(earliest, i.birth.year);
      latest = latest === undefined ? i.birth.year : Math.max(latest, i.birth.year);
    }
  }
  const rank = (m: Map<string, number>, key: "surname" | "place") =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, count]) => ({ [key]: k, count })) as any;
  return {
    individuals: file.individuals.size, families: file.families.size, withBirthYear: withBirth,
    earliestBirthYear: earliest, latestBirthYear: latest,
    surnames: rank(surnames, "surname"), places: rank(places, "place"), warnings: file.warnings.length,
  };
}
