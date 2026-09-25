#!/usr/bin/env node
/**
 * Step 2. SNPs that consumer chips share.
 *
 * Consumer tests run on Illumina arrays. The Global Screening Array (GSA) is
 * the base of the chips used by 23andMe (v5), MyHeritage, FamilyTreeDNA and
 * Living DNA; the OmniExpress line is the base AncestryDNA's chips grew from.
 * Illumina publishes, for each array, the rsID of every probe and its GRCh37
 * position. A reference panel built from SNPs on both arrays overlaps any of
 * these files heavily, which is what lets ancestry run offline from bundled
 * data instead of querying Ensembl per user.
 *
 * Output: data/.cache/chip-snps.tsv (rsid, chrom, pos) and chip-snps.json (provenance).
 */
import { writeFileSync } from "node:fs";
import { CACHE, download, source, unzipList, unzipText, writeJson } from "./lib.mjs";

const BASE = "https://support.illumina.com/content/dam/illumina-support/documents/downloads/productfiles";
const ARRAYS = [
  {
    name: "Infinium Global Screening Array-24 v3.0 (A1)",
    rsids: `${BASE}/global-screening-array-24/v3-0/infinium-global-screening-array-24-v3-0-a1-b151-rsids.zip`,
    coords: `${BASE}/global-screening-array-24/v3-0/infinium-global-screening-array-24-v3-0-a1-physical-genetic-coordinates.zip`,
  },
  {
    name: "Infinium OmniExpress-24 v1.3 (A1)",
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
  arrays.push({ name: a.name, snps });
  process.stderr.write(`${a.name}: ${snps.size.toLocaleString()} rsIDs on 1-22 and X\n`);
}

const [first, ...rest] = arrays;
const shared = [];
for (const [rsid, s] of first.snps) {
  if (rest.every((a) => { const o = a.snps.get(rsid); return o && o.chrom === s.chrom && o.pos === s.pos; })) shared.push([rsid, s.chrom, s.pos]);
}
const order = (c) => (c === "X" ? 23 : Number(c));
shared.sort((a, b) => order(a[1]) - order(b[1]) || a[2] - b[2]);
writeFileSync(`${CACHE}/chip-snps.tsv`, shared.map((r) => r.join("\t")).join("\n") + "\n");
writeJson(`${CACHE}/chip-snps.json`, {
  arrays: arrays.map((a) => ({ name: a.name, snps: a.snps.size })),
  shared: shared.length,
  build: 37,
  sources,
});
process.stderr.write(`shared by all arrays (same rsID, chromosome and position): ${shared.length.toLocaleString()}\n`);
