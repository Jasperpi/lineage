/**
 * Shared helpers for the reference-data pipeline. Every step downloads its
 * sources into data/.cache (never committed), records where each file came
 * from and its SHA-256, and writes a compact output under data/reference with
 * that provenance attached.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CACHE = process.env.LINEAGE_CACHE ?? join(ROOT, "data/.cache");
export const REFERENCE = join(ROOT, "data/reference");
mkdirSync(CACHE, { recursive: true });
mkdirSync(REFERENCE, { recursive: true });

export const today = () => new Date().toISOString().slice(0, 10);

/** Download `url` into the cache once; returns the local path. */
export async function download(url, name = url.split("/").pop()) {
  const path = join(CACHE, name);
  if (existsSync(path) && statSync(path).size > 0) return path;
  process.stderr.write(`downloading ${url}\n`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path + ".part"));
  execFileSync("mv", [path + ".part", path]);
  return path;
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Text of one entry of a zip archive (uses the system `unzip`). */
export function unzipText(zipPath, entry) {
  return execFileSync("unzip", ["-p", zipPath, entry], { maxBuffer: 1 << 30 }).toString("utf8");
}

export function unzipList(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath]).toString("utf8").split("\n").filter(Boolean);
}

export function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value) + "\n");
  process.stderr.write(`wrote ${path} (${statSync(path).size.toLocaleString()} bytes)\n`);
}

/** A source record for provenance blocks. */
export function source(name, url, path, extra = {}) {
  return { name, url, sha256: sha256(path), bytes: statSync(path).size, retrieved: today(), ...extra };
}
