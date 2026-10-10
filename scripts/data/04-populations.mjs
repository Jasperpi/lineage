#!/usr/bin/env node
/**
 * Step 4. The 26 reference populations of 1000 Genomes phase 3.
 *
 * Names, descriptions and sampling coordinates come from the International
 * Genome Sample Resource (IGSR) population API. Sample counts come from the
 * phase 3 panel file itself (IGSR's counts include samples added after phase
 * 3, which are not in the genotypes Lineage uses). Six populations were
 * sampled away from the region their ancestry comes from; they are marked as
 * such, with the country of origin named in IGSR's own description where it
 * names one, so the map can say so instead of implying a location.
 *
 * Output: data/reference/populations.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CACHE, download, REFERENCE, today, writeJson } from "./lib.mjs";
import { createHash } from "node:crypto";

const API = "https://www.internationalgenome.org/api/beta/population/_search";
const PANEL_URL = "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/integrated_call_samples_v3.20130502.ALL.panel";
const POPS = ["YRI", "LWK", "GWD", "MSL", "ESN", "ASW", "ACB", "MXL", "PUR", "CLM", "PEL", "CHB", "JPT", "CHS", "CDX", "KHV", "CEU", "TSI", "FIN", "GBR", "IBS", "GIH", "PJL", "BEB", "STU", "ITU"];
const SUPER = {
  AFR: "African", AMR: "Admixed American", EAS: "East Asian", EUR: "European", SAS: "South Asian",
};
// Populations sampled outside their ancestral region. `origin` is an ISO 3166 country
// code only where IGSR's description names a single country of origin.
const DIASPORA = {
  ASW: { note: "Sampled in the south-western United States; African ancestry." },
  ACB: { note: "Sampled in Barbados; African Caribbean ancestry." },
  CEU: { note: "Sampled in Utah (CEPH families); Northern and Western European ancestry." },
  MXL: { note: "Sampled in Los Angeles; Mexican ancestry.", origin: "MX" },
  GIH: { note: "Sampled in Houston; Gujarati Indian ancestry.", origin: "IN" },
  ITU: { note: "Sampled in the United Kingdom; Telugu Indian ancestry.", origin: "IN" },
  STU: { note: "Sampled in the United Kingdom; Sri Lankan Tamil ancestry.", origin: "LK" },
};

const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: 300 }) });
if (!res.ok) throw new Error(`IGSR API ${res.status}`);
const body = await res.text();
writeFileSync(`${CACHE}/igsr-populations.json`, body);
const hits = JSON.parse(body).hits.hits.map((h) => h._source);

const panelPath = await download(PANEL_URL);
const counts = {};
for (const line of readFileSync(panelPath, "utf8").trim().split("\n").slice(1)) {
  const [, pop, , sex] = line.split("\t");
  counts[pop] ??= { total: 0, female: 0, male: 0 };
  counts[pop].total++;
  counts[pop][sex === "female" ? "female" : "male"]++;
}

const populations = POPS.map((code) => {
  const s = hits.find((h) => h.code === code);
  if (!s) throw new Error(`IGSR has no population ${code}`);
  const d = DIASPORA[code];
  return {
    code,
    name: s.name,
    description: s.description,
    superpopulation: s.superpopulation.code,
    lat: s.latitude,
    lon: s.longitude,
    samples: counts[code].total,
    female: counts[code].female,
    male: counts[code].male,
    ...(d ? { diaspora: true, note: d.note, ...(d.origin ? { origin: d.origin } : {}) } : {}),
  };
});

// Step 4b merges this with the HGDP populations into data/reference/populations.json.
writeJson(`${CACHE}/populations.1000g.json`, {
  id: "populations.1000g-phase3",
  title: "1000 Genomes Project phase 3 populations",
  provenance: {
    sources: [
      { name: "IGSR population API (names, descriptions, sampling coordinates)", url: API, sha256: createHash("sha256").update(body).digest("hex"), retrieved: today() },
      { name: "1000 Genomes phase 3 sample panel (sample counts)", url: PANEL_URL, retrieved: today() },
    ],
    citation: "The 1000 Genomes Project Consortium (2015). A global reference for human genetic variation. Nature 526:68-74.",
    terms: "IGSR: data are available without embargo; cite the 1000 Genomes Project in the usual way. https://www.internationalgenome.org/IGSR_disclaimer",
    script: "scripts/data/04-populations.mjs",
  },
  superpopulations: Object.entries(SUPER).map(([code, name]) => ({ code, name })),
  populations,
});
