#!/usr/bin/env node
/**
 * Check every PubMed ID the app and the knowledge base cite: the record must
 * exist and its title must match the one we quote. Run before a release.
 *   node scripts/data/verify-citations.mjs
 * (Node 22.18+ reads the TypeScript citation module directly.)
 */
import { PAPERS } from "../../apps/web/src/lib/citations.ts";

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const papers = Object.values(PAPERS).filter((p) => p.pmid);
const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${papers.map((p) => p.pmid).join(",")}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`PubMed ${res.status}`);
const { result } = await res.json();
let bad = 0;
for (const p of papers) {
  const r = result[p.pmid];
  const ok = r && norm(r.title).startsWith(norm(p.title).slice(0, 40));
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${p.pmid.padEnd(9)} ${p.key.padEnd(14)} ${r ? r.title : "(no record)"}`);
}
if (bad) { console.error(`${bad} citation(s) did not verify`); process.exit(1); }
console.log(`${papers.length} citations verified against PubMed`);
