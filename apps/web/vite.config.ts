import { defineConfig, type Plugin } from "vite";
import { cpSync, createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));
const DATA = resolve(here, "../../data/reference");

/**
 * The bundled reference data lives once, in lineage/data/reference, next to
 * the scripts that build it. This serves it at /data/ in development and
 * copies it into the build output, so the site fetches it from its own origin.
 */
function referenceData(): Plugin {
  return {
    name: "lineage-reference-data",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const file = join(DATA, decodeURIComponent((req.url ?? "").split("?")[0] ?? ""));
        if (!file.startsWith(DATA) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      cpSync(DATA, resolve(here, "dist/data"), { recursive: true });
    },
  };
}

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
}

/**
 * Publishes the build's hashes and makes it work offline. After the bundle is
 * written (and the reference data copied in), this writes dist/sw.js from
 * ./sw.js with the list of app files and a build id, then dist/SHA256SUMS:
 * one line per file in the format `sha256sum -c` reads. The build hash is the
 * SHA-256 of SHA256SUMS; the Evidence page shows it, and
 * scripts/verify-build.mjs compares a deployed site against a local build.
 */
function buildHashes(): Plugin {
  return {
    name: "lineage-build-hashes",
    closeBundle() {
      const dist = resolve(here, "dist");
      const list = () => files(dist).map((f) => relative(dist, f).split("\\").join("/")).filter((p) => p !== "SHA256SUMS").sort();
      const app = list().filter((p) => p !== "sw.js");
      const id = sha256(app.map((p) => `${sha256(readFileSync(join(dist, p)))}  ${p}\n`).join("")).slice(0, 16);
      const sw = readFileSync(resolve(here, "sw.js"), "utf8")
        .replace('"__BUILD__"', JSON.stringify(id))
        .replace("__APP__", JSON.stringify([...app.filter((p) => !p.startsWith("data/")), "sw.js", "SHA256SUMS"]));
      writeFileSync(join(dist, "sw.js"), sw);
      const sums = list().map((p) => `${sha256(readFileSync(join(dist, p)))}  ${p}\n`).join("");
      writeFileSync(join(dist, "SHA256SUMS"), sums);
      console.log(`build hash ${sha256(sums)}`);
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [referenceData(), buildHashes()],
  worker: { format: "es" },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173 },
});
