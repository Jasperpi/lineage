#!/usr/bin/env node
/**
 * Release smoke test for the web app. Serves apps/web/dist with the headers
 * from apps/web/vercel.json (so the Content-Security-Policy is the real one),
 * opens every page in Chromium at desktop and phone sizes with the demo family
 * loaded, and fails on:
 *   - any request to another origin (the privacy claim),
 *   - any CSP violation or console error,
 *   - horizontal scrolling at either width,
 *   - the app not working offline: after one visit, the server is stopped
 *     and every page must still load and analyse from the service worker,
 *   - the Evidence page's file check not matching SHA256SUMS.
 * Screenshots go to $SHOTS (default: a temp directory).
 *
 *   npm run build && node scripts/smoke.mjs
 * Chromium: set CHROMIUM (defaults to /opt/pw-browsers/chromium when present).
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = join(ROOT, "apps/web/dist");
const SHOTS = process.env.SHOTS ?? join(tmpdir(), "lineage-smoke");
mkdirSync(SHOTS, { recursive: true });
const vercel = JSON.parse(readFileSync(join(ROOT, "apps/web/vercel.json"), "utf8"));
const headers = Object.fromEntries(vercel.headers.find((h) => h.source === "/(.*)").headers.map((h) => [h.key, h.value]));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".gz": "application/gzip", ".webmanifest": "application/manifest+json" };

const sockets = new Set();
const server = createServer((req, res) => {
  let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (path.endsWith("/")) path += "index.html";
  const file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { ...headers, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(0);
server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
const origin = `http://localhost:${server.address().port}`;

/** Opens the demo family and every page, checking each; screenshots when asked. */
async function walk(page, tag, shots) {
  await page.getByRole("button", { name: "Explore the demo family" }).first().click();
  await page.waitForFunction(() => location.hash === "#/overview" && document.querySelector(".stats"), null, { timeout: 60_000 });
  for (const route of ROUTES) {
    await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
    await page.waitForTimeout(route === "ancestry" ? 1500 : 600);
    if (route === "ancestry") await page.waitForSelector("text=Fig. 6", { timeout: 60_000 });
    if (route === "relatives") { await page.getByRole("button", { name: "Sophie Walker" }).click(); await page.waitForSelector("text=Most likely", { timeout: 30_000 }); }
    if (route === "traits") await page.waitForSelector("text=Every variant", { timeout: 30_000 });
    if (route === "evidence") {
      await page.waitForSelector("text=Data room", { timeout: 30_000 });
      await page.getByRole("button", { name: "Check the files this page runs" }).click();
      const verdict = await page.waitForSelector("text=/files (checked match|differ from) SHA256SUMS/", { timeout: 30_000 });
      const text = await verdict.textContent();
      if (!/checked match/.test(text)) failures.push(`${tag}: ${text}`);
    }
    if (route === "tree") await page.waitForSelector("text=Relationship calculator", { timeout: 30_000 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) failures.push(`${tag}: ${route} scrolls horizontally by ${overflow}px`);
    if (shots) await page.screenshot({ path: join(SHOTS, `${route}-${tag}.png`), fullPage: true });
  }
}

const executablePath = process.env.CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({ executablePath });
const failures = [];
const ROUTES = ["overview", "ancestry", "relatives", "tree", "traits", "evidence"];

for (const [width, height, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: tag === "phone" ? 2 : 1 });
  const page = await context.newPage();
  const seen = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (!["http:", "https:"].includes(u.protocol)) return; seen.push({ path: u.pathname, other: u.origin !== origin }); if (u.origin !== origin) failures.push(`${tag}: request to another origin: ${r.url()}`); });
  page.on("console", (m) => { if (m.type() === "error") failures.push(`${tag}: console error: ${m.text()}`); });
  page.on("pageerror", (e) => failures.push(`${tag}: page error: ${e.message}`));
  await page.addInitScript(() => { document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)); });
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: join(SHOTS, `home-${tag}.png`) });
  await walk(page, tag, true);
  // The reference panel is fetched only by the analysis worker: seeing it proves worker requests are watched too.
  if (!seen.some((r) => r.path.endsWith("/data/panel.1000g.bin.gz"))) failures.push(`${tag}: the worker's requests were not observed`);
  const footer = await page.evaluate(() => document.querySelector(".ledger-line")?.textContent ?? "");
  if (!/panel|requests/.test(footer)) failures.push(`${tag}: no network ledger in the footer`);
  console.log(`${tag}: ${seen.length} requests observed (page and worker), ${seen.filter((r) => r.other).length} to other origins. ${footer}`);
  await context.close();
}

// Offline: one visit stores the app and the data its pages load; then the server goes away.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const tag = "offline";
  page.on("console", (m) => { if (m.type() === "error") failures.push(`${tag}: console error: ${m.text()}`); });
  page.on("pageerror", (e) => failures.push(`${tag}: page error: ${e.message}`));
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  await walk(page, "online first visit", false);
  server.close();
  for (const s of sockets) s.destroy();
  await page.goto(origin + "/", { waitUntil: "load" });
  await walk(page, tag, true);
  console.log("offline: every page loaded and analysed with the server stopped");
  await context.close();
}
await browser.close();
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`smoke test passed; screenshots in ${SHOTS}`);
