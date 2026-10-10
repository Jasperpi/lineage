#!/usr/bin/env node
/**
 * Step 2. SNPs on consumer chips.
 *
 * Consumer tests run on Illumina arrays. The Global Screening Array (GSA) is
 * the base of the chips used by 23andMe (v5), MyHeritage, FamilyTreeDNA and
 * Living DNA; the OmniExpress line is the base of older chips (23andMe v3/v4,
 * AncestryDNA v1). Illumina publishes, for each array, the rsID of every probe
 * and its GRCh37 position.
 *
 * Version 1 of the panel kept only SNPs on both arrays (175,406), so a GSA
 * file used about a quarter of its SNPs. Version 2 keeps the union and records
 * which array carries each SNP; the panel prefers SNPs on both where it has to
 * choose (the LD-pruned core), and every kit uses what it has.
 *
 * Output: data/.cache/chip-snps.tsv (rsid, chrom, pos37, on GSA, on OmniExpress)
 * and chip-snps.json (provenance).
 */
import { writeFileSync } from "node:fs";
import { CACHE, download, source, unzipList, unzipText, writeJson } from "./lib.mjs";

const BASE = "https://support.illumina.com/content/dam/illumina-support/documents/downloads/productfiles";
const ARRAYS = [
  {
    id: "GSA", name: "Infinium Global Screening Array-24 v3.0 (A1)",
    rsids: `${BASE}/global-screening-array-24/v3-0/infinium-global-screening-array-24-v3-0-a1-b151-rsids.zip`,
    coords: `${BASE}/global-screening-array-24/v3-0/infinium-global-screening-array-24-v3-0-a1-physical-genetic-coordinates.zip`,
  },
  {
    id: "OMNI", name: "Infinium OmniExpress-24 v1.3 (A1)",
    rsids: `${BASE}/humanomniexpress-24/v1-3/infinium-omniexpress-24-v1-3-a1-b150-rsids.zip`,
    coords: `${BASE}/humanomniexpress-24/v1-3/infinium-omniexpress-24-v1-3-a1-physical-genetic-coordinates.zip`,
  },
];
const CHROMS = new Set([...Array.from({ length: 22 }, (_, i) => String(i + 1)), "X"]);

function table(zip) {
  const entry = unzipList(zip).find((e) => e.endsWith(".txt"));
  return unzipText(zip, entry).trim().split("\n").slice(1).map((l) => l.replace(/\r$/, "").split("\t"));
}

const sources = [];
const arrays = [];
for (const a of ARRAYS) {
  const rz = await download(a.rsids), cz = await download(a.coords);
  sources.push(source(`${a.name}: rsID mapping`, a.rsids, rz), source(`${a.name}: physical coordinates`, a.coords, cz));
  const rs = new Map(table(rz).map(([name, r]) => [name, (r ?? "").trim()]));
  const snps = new Map();
  for (const [name, chr, pos] of table(cz)) {
    const r = rs.get(name);
    if (!r || !/^rs\d+$/.test(r) || !CHROMS.has(chr) || snps.has(r)) continue;
    snps.set(r, { chrom: chr, pos: Number(pos) });
  }
  arrays.push({ ...a, snps });
  process.stderr.write(`${a.name}: ${snps.size.toLocaleString()} rsIDs on 1-22 and X\n`);
}

// The union, keyed by chromosome and position (an rsID placed differently by the two arrays is dropped).
const byPos = new Map();
let disagree = 0;
for (const [ai, a] of arrays.entries()) {
  for (const [rsid, s] of a.snps) {
    const key = `${s.chrom}:${s.pos}`;
    const other = arrays.find((b, bi) => bi !== ai && b.snps.has(rsid));
    if (other) { const o = other.snps.get(rsid); if (o.chrom !== s.chrom || o.pos !== s.pos) { disagree++; continue; } }
    const row = byPos.get(key) ?? { rsid, chrom: s.chrom, pos: s.pos, on: [0, 0] };
    row.on[ai] = 1;
    byPos.set(key, row);
  }
}
const rows = [...byPos.values()];
const order = (c) => (c === "X" ? 23 : Number(c));
rows.sort((a, b) => order(a.chrom) - order(b.chrom) || a.pos - b.pos);
writeFileSync(`${CACHE}/chip-snps.tsv`, rows.map((r) => [r.rsid, r.chrom, r.pos, r.on[0], r.on[1]].join("\t")).join("\n") + "\n");
const both = rows.filter((r) => r.on[0] && r.on[1]).length;
writeJson(`${CACHE}/chip-snps.json`, {
  arrays: arrays.map((a) => ({ id: a.id, name: a.name, snps: a.snps.size })),
  union: rows.length, shared: both, placedDifferently: disagree,
  build: 37,
  sources,
});
process.stderr.write(`union: ${rows.length.toLocaleString()} positions; on both arrays: ${both.toLocaleString()}; rsIDs placed differently by the two arrays (dropped): ${disagree}\n`);
