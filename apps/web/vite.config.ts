import { defineConfig } from "vite";

export default defineConfig({
  // The synthetic sample files are served at /samples/* so the demo buttons work.
  base: "./",
  publicDir: "public",
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
  server: { port: 5173 },
});
