#!/usr/bin/env node
/**
 * Step 1. Genetic map, GRCh37.
 *
 * Source: the HapMap Phase II genetic map lifted to GRCh37 (Adam Auton) in the
 * PLINK layout Brian Browning distributes with Beagle. The map is piecewise
 * linear between its points, so it is simplified by dropping every point that
 * linear interpolation between the kept neighbours reproduces to within
 * TOLERANCE_CM. That turns 346,000 points into about 55,000 without changing any
 * position's genetic coordinate by more than the tolerance.
 *
 * Output: data/reference/genetic-map.grch37.json
 *   chromosomes[c].pos  base-pair positions, delta-encoded
 *   chromosomes[c].cm   centimorgans x 10^4, delta-encoded integers
 */
import { download, REFERENCE, source, unzipList, unzipText, writeJson } from "./lib.mjs";

const URL = "https://bochet.gcc.biostat.washington.edu/beagle/genetic_maps/plink.GRCh37.map.zip";
const TOLERANCE_CM = 0.02;
const CHROMS = [...Array.from({ length: 22 }, (_, i) => String(i + 1)), "X"];

/** Keep indices of a piecewise-linear curve so every dropped point lies within `tol` of the chord. */
function simplify(pos, cm, tol) {
  const keep = [0];
  let a = 0;
  while (a < pos.length - 1) {
    let lastOk = a + 1;
    for (let b = a + 2; b < pos.length && b - a <= 5000; b++) {
      const slope = (cm[b] - cm[a]) / (pos[b] - pos[a] || 1);
      let ok = true;
      for (let k = a + 1; k < b; k++) {
        if (Math.abs(cm[a] + slope * (pos[k] - pos[a]) - cm[k]) > tol) { ok = false; break; }
      }
      if (!ok) break;
      lastOk = b;
    }
    keep.push(lastOk);
    a = lastOk;
  }
  return keep;
}

const zip = await download(URL);
const entries = unzipList(zip);
const readme = unzipText(zip, entries.find((e) => e.endsWith("README.txt") && !e.includes("plink"))).trim();
const chromosomes = {};
const lengths = {};
let pointsIn = 0, pointsOut = 0;
for (const c of CHROMS) {
  const entry = entries.find((e) => e.endsWith(`plink.chr${c}.GRCh37.map`));
  const rows = unzipText(zip, entry).trim().split("\n").map((l) => l.trim().split(/\s+/));
  const pos = rows.map((r) => Number(r[3]));
  const cm = rows.map((r) => Number(r[2]));
  for (let i = 1; i < pos.length; i++) if (pos[i] <= pos[i - 1] || cm[i] < cm[i - 1]) throw new Error(`chr${c}: map not monotone at row ${i}`);
  const keep = simplify(pos, cm, TOLERANCE_CM);
  const dp = [], dc = [];
  let lp = 0, lc = 0;
  for (const k of keep) {
    const p = pos[k], q = Math.round(cm[k] * 1e4);
    dp.push(p - lp); dc.push(q - lc); lp = p; lc = q;
  }
  chromosomes[c] = { pos: dp, cm: dc };
  lengths[c] = Number((cm[cm.length - 1] - cm[0]).toFixed(4));
  pointsIn += pos.length; pointsOut += keep.length;
}
const autosomal = CHROMS.filter((c) => c !== "X").reduce((a, c) => a + lengths[c], 0);

writeJson(`${REFERENCE}/genetic-map.grch37.json`, {
  id: "genetic-map.grch37",
  title: "HapMap Phase II genetic map, GRCh37",
  build: 37,
  provenance: {
    sources: [source("Beagle PLINK-format GRCh37 genetic map (HapMap Phase II, lifted to GRCh37)", URL, zip)],
    citation: "The International HapMap Consortium (2007). A second generation human haplotype map of over 3.1 million SNPs. Nature 449:851-861. PMID 17943122",
    notes: readme,
    method: `Points dropped where linear interpolation between kept neighbours reproduces the original within ${TOLERANCE_CM} cM (${pointsIn.toLocaleString()} points in, ${pointsOut.toLocaleString()} kept). Chromosome X is the non-pseudo-autosomal map.`,
    script: "scripts/data/01-genetic-map.mjs",
  },
  toleranceCm: TOLERANCE_CM,
  encoding: { pos: "base pairs, delta-encoded", cm: "centimorgans x 10^4, delta-encoded integers" },
  lengthsCm: lengths,
  autosomalLengthCm: Number(autosomal.toFixed(2)),
  chromosomes,
});
