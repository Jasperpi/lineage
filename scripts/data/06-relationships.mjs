#!/usr/bin/env node
/**
 * Step 6. Simulated shared-DNA distributions for 23 relationships.
 *
 * Runs the pedigree simulator in @lineage/core (Haldane crossovers on the
 * bundled GRCh37 map, 7 cM detection threshold) for 2,000 pairs per
 * relationship from a fixed seed, and stores every simulated pair rounded to
 * whole centimorgans. The browser turns these into likelihoods by kernel
 * density; nothing here is fitted to the Shared cM Project, which is kept
 * alongside only as the empirical check.
 *
 * Requires the core package to be built (npm run build).
 * Output: data/reference/relationships.sim.json
 */
import { readFileSync } from "node:fs";
import { REFERENCE, today, writeJson } from "./lib.mjs";
import { DEFAULT_RELATIONSHIPS, SHARED_CM_V4, SHARED_CM_SOURCE, simulateRelationships } from "../../packages/core/dist/index.js";

const PAIRS = 2000, SEED = 20260925, MIN_CM = 7;
const map = JSON.parse(readFileSync(`${REFERENCE}/genetic-map.grch37.json`, "utf8"));
const lengths = Array.from({ length: 22 }, (_, i) => map.lengthsCm[String(i + 1)]);

const t0 = Date.now();
const dists = simulateRelationships(DEFAULT_RELATIONSHIPS, { chromosomeCm: lengths, pairs: PAIRS, seed: SEED, minSegmentCm: MIN_CM });
const round = (x) => Math.round(x);

writeJson(`${REFERENCE}/relationships.sim.json`, {
  id: "relationships.sim",
  title: "Simulated shared DNA by relationship",
  provenance: {
    method: "Pedigree simulation: Poisson crossovers (Haldane, no interference) on the sex-averaged HapMap II GRCh37 map; founders carry distinct haplotypes; shared regions merged into segments; segments and fully identical runs under the threshold are not counted.",
    model: { pairsPerRelationship: PAIRS, seed: SEED, minSegmentCm: MIN_CM, genomeCm: Number(lengths.reduce((a, b) => a + b, 0).toFixed(2)), map: "genetic-map.grch37" },
    references: [
      "Caballero M, Seidman DN, Qiao Y, Sannerud J, Dyer TD, Lehman DM, Curran JE, Duggirala R, Blangero J, Carmi S, Williams AL (2019). Crossover interference and sex-specific genetic maps shape identical by descent sharing in close relatives. PLoS Genet 15(12):e1007979. PMID 31860654",
      "Huff CD, Witherspoon DJ, Simonson TS, Xing J, Watkins WS, Zhang Y, Tuohy TM, Neklason DW, Burt RW, Guthery SL, Woodward SR, Jorde LB (2011). Maximum-likelihood estimation of recent shared ancestry (ERSA). Genome Res 21(5):768-774. PMID 21324875",
    ],
    empiricalCheck: SHARED_CM_SOURCE,
    generated: today(),
    runtimeMs: Date.now() - t0,
    script: "scripts/data/06-relationships.mjs",
  },
  relationships: dists.map((d) => {
    const v4 = SHARED_CM_V4.find((e) => e.id === d.spec.sharedCmId);
    return {
      ...d.spec,
      summary: Object.fromEntries(Object.entries(d.summary).map(([k, v]) => [k, Number(v.toFixed(k === "noSharing" ? 4 : 1))])),
      sharedCmV4: v4 ? { average: v4.average, min: v4.min, max: v4.max } : undefined,
      totalCm: d.pairs.map((p) => round(p.totalCm)),
      segments: d.pairs.map((p) => p.segments),
      longestCm: d.pairs.map((p) => round(p.longestCm)),
      fullCm: d.pairs.map((p) => round(p.fullCm)),
    };
  }),
});
