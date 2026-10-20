#!/usr/bin/env node
/**
 * Checks that a deployed Lineage site serves exactly the files of a local
 * build. Build the source first; then this fetches the site's SHA256SUMS,
 * compares it line by line with apps/web/dist/SHA256SUMS, and downloads and
 * hashes every file the site lists, so a site that published honest sums but
 * served other files is caught too.
 *
 *   npm ci && npm run build --workspace=apps/web
 *   node scripts/verify-build.mjs https://lineage.jaspermeller.com/
 *
 * With no URL it checks the local build against its own SHA256SUMS.
 * Exits 1 on any difference.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(resolve(fileURLToPath(new URL(".", import.meta.url)), ".."), "apps/web/dist");
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const parse = (text) => new Map(text.trim().split("\n").map((l) => [l.slice(66), l.slice(0, 64)]));

if (!existsSync(join(DIST, "SHA256SUMS"))) {
  console.error("No local build: run `npm ci && npm run build --workspace=apps/web` first.");
  process.exit(1);
}
const localText = readFileSync(join(DIST, "SHA256SUMS"), "utf8");
const local = parse(localText);
const site = process.argv[2] ? new URL(process.argv[2].endsWith("/") ? process.argv[2] : process.argv[2] + "/") : null;
const problems = [];

// identity: hash the bytes as stored, not as a server might recompress them.
const get = async (path) => {
  const r = await fetch(new URL(path, site), { headers: { "Accept-Encoding": "identity" }, cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

let remote = local;
let remoteText = localText;
if (site) {
  remoteText = (await get("SHA256SUMS")).toString("utf8");
  remote = parse(remoteText);
  for (const [path, sha] of local) {
    if (!remote.has(path)) problems.push(`missing from the site's list: ${path}`);
    else if (remote.get(path) !== sha) problems.push(`different in the site's list: ${path}`);
  }
  for (const path of remote.keys()) if (!local.has(path)) problems.push(`not in the local build: ${path}`);
}

for (const [path, sha] of remote) {
  try {
    const bytes = site ? await get(path) : readFileSync(join(DIST, path));
    if (sha256(bytes) !== sha) problems.push(`${site ? "served" : "built"} file does not match its listed hash: ${path}`);
  } catch (e) {
    problems.push(String(e.message ?? e));
  }
}

console.log(`local build hash ${sha256(localText)}`);
if (site) console.log(`site build hash  ${sha256(remoteText)} (${site.href})`);
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`${problems.length} difference${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`all ${remote.size} files match`);
