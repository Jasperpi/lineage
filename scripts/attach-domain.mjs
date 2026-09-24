#!/usr/bin/env node
/**
 * Attach lineage.jaspermeller.com to the `web` Vercel project and create the
 * Cloudflare CNAME, exactly as the Atlas subdomain was set up.
 *
 * Needs two read-write tokens in the environment (never pasted into a chat):
 *   VERCEL_TOKEN          https://vercel.com/account/tokens
 *   CLOUDFLARE_API_TOKEN  a token with DNS:Edit on the jaspermeller.com zone
 * Optional: VERCEL_TEAM_ID (the team slug or id that owns the project),
 *           VERCEL_PROJECT (default "web"), DOMAIN (default lineage.jaspermeller.com).
 *
 *   node lineage/scripts/attach-domain.mjs
 *
 * Both calls are idempotent: an existing domain or record is reported, not duplicated.
 */
const DOMAIN = process.env.DOMAIN ?? "lineage.jaspermeller.com";
const ZONE = DOMAIN.split(".").slice(-2).join(".");
const PROJECT = process.env.VERCEL_PROJECT ?? "web";
const { VERCEL_TOKEN, CLOUDFLARE_API_TOKEN, VERCEL_TEAM_ID } = process.env;
if (!VERCEL_TOKEN || !CLOUDFLARE_API_TOKEN) {
  console.error("Set VERCEL_TOKEN and CLOUDFLARE_API_TOKEN in the environment first.");
  process.exit(2);
}
const team = VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : "";
const vercel = async (path, init = {}) => {
  const r = await fetch(`https://api.vercel.com${path}${team}`, { ...init, headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
};
const cf = async (path, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success !== false, status: r.status, body: j };
};

// 1. Vercel: add the domain to the project.
const add = await vercel(`/v10/projects/${encodeURIComponent(PROJECT)}/domains`, { method: "POST", body: JSON.stringify({ name: DOMAIN }) });
if (add.ok) console.log(`Vercel: ${DOMAIN} added to project ${PROJECT}`);
else if (add.body?.error?.code === "domain_already_exists" || add.status === 409) console.log(`Vercel: ${DOMAIN} is already on project ${PROJECT}`);
else { console.error("Vercel error:", add.status, JSON.stringify(add.body)); process.exit(1); }

// 2. Cloudflare: CNAME lineage -> cname.vercel-dns.com (DNS only, not proxied, as for mitsqanaqan).
const zones = await cf(`/zones?name=${ZONE}`);
const zoneId = zones.body?.result?.[0]?.id;
if (!zoneId) { console.error(`Cloudflare: zone ${ZONE} not visible to this token`); process.exit(1); }
const existing = await cf(`/zones/${zoneId}/dns_records?name=${DOMAIN}`);
const rec = existing.body?.result?.[0];
if (rec) {
  console.log(`Cloudflare: record exists, ${rec.type} ${rec.name} -> ${rec.content} (proxied: ${rec.proxied})`);
} else {
  const made = await cf(`/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify({ type: "CNAME", name: DOMAIN.split(".")[0], content: "cname.vercel-dns.com", ttl: 1, proxied: false, comment: "Lineage, Vercel project web" }) });
  if (!made.ok) { console.error("Cloudflare error:", made.status, JSON.stringify(made.body)); process.exit(1); }
  console.log(`Cloudflare: CNAME ${DOMAIN} -> cname.vercel-dns.com created`);
}

// 3. Report what Vercel now says about the domain (verification and config state).
const info = await vercel(`/v9/projects/${encodeURIComponent(PROJECT)}/domains/${DOMAIN}`);
console.log("Vercel domain state:", JSON.stringify({ verified: info.body?.verified, verification: info.body?.verification ?? null }));
console.log(`Done. DNS usually resolves within a few minutes; then https://${DOMAIN}/ serves Lineage.`);
