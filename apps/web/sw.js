/**
 * Lineage's service worker: keeps a copy of this exact build so the app opens
 * and every analysis runs with the network off.
 *
 * The build (vite.config.ts) fills in BUILD with the SHA-256 of the file list
 * and APP with every file except the reference data. On install the app files
 * are cached together; reference data is cached the first time a view needs
 * it, so a phone never downloads the 4.5 MB panel just to open the home page.
 * Everything is served from this build's cache before the network, so the
 * page keeps running the code it installed until a new build replaces it,
 * which happens once every tab of the old one is closed.
 */
const BUILD = "__BUILD__";
const APP = __APP__;
const CACHE = `lineage-${BUILD}`;
const scope = new URL(self.registration.scope);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", ...APP].map((p) => new Request(new URL(p, scope), { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  // Take over the tab that installed it, so the reference data its first visit loads is kept too.
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("lineage-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// The page names reference data it loaded without passing through here; keep a copy of each.
self.addEventListener("message", (event) => {
  const urls = Array.isArray(event.data?.keep) ? event.data.keep : [];
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(urls.map(async (u) => {
    const url = new URL(u, scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname + "data/")) return;
    const key = url.origin + url.pathname;
    if (!(await cache.match(key))) await cache.add(key).catch(() => {});
  }))));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  // Every page of the app is the one index.html; routes live in the #hash.
  const key = req.mode === "navigate" ? new URL("./", scope).href : url.origin + url.pathname;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(key);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && url.pathname.startsWith(scope.pathname + "data/")) await cache.put(key, res.clone());
    return res;
  }));
});
