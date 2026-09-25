/**
 * The network ledger: every request this page has made, as the browser
 * itself records them (Resource Timing), split into requests to this site
 * and requests anywhere else. It lets the privacy claim be checked on the
 * page instead of taken on trust. The Content-Security-Policy set in
 * vercel.json (connect-src 'self') is what actually prevents other requests.
 */
export interface LedgerEntry { url: string; bytes: number; type: string; sameOrigin: boolean }

const entries: LedgerEntry[] = [];
const listeners = new Set<() => void>();

function add(e: PerformanceResourceTiming): void {
  let sameOrigin = false;
  try { sameOrigin = new URL(e.name).origin === location.origin; } catch { sameOrigin = false; }
  if (e.name.startsWith("data:") || e.name.startsWith("blob:")) return;
  entries.push({ url: e.name, bytes: e.transferSize || e.encodedBodySize || 0, type: e.initiatorType, sameOrigin });
}

export function startLedger(): void {
  for (const e of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) add(e);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) add(e);
      for (const l of listeners) l();
    }).observe({ type: "resource", buffered: false });
  } catch { /* very old browsers: the list stays as it was at load */ }
}

/** Requests made by the analysis worker, which it reports from its own Resource Timing. */
export function addWorkerRequests(list: Array<{ url: string; bytes: number; type: string }>): void {
  for (const e of list) {
    let sameOrigin = false;
    try { sameOrigin = new URL(e.url).origin === location.origin; } catch { sameOrigin = false; }
    if (e.url.startsWith("data:") || e.url.startsWith("blob:")) continue;
    entries.push({ url: e.url, bytes: e.bytes, type: e.type, sameOrigin });
  }
  for (const l of listeners) l();
}

export function ledger(): { total: number; elsewhere: LedgerEntry[]; bytes: number; entries: LedgerEntry[] } {
  return { total: entries.length + 1, elsewhere: entries.filter((e) => !e.sameOrigin), bytes: entries.reduce((a, e) => a + e.bytes, 0), entries };
}

export function onLedger(fn: () => void): void { listeners.add(fn); }
