import { defineConfig, type Plugin } from "vite";
import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

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

export default defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [referenceData()],
  worker: { format: "es" },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173 },
});
