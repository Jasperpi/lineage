/** The page's handle on the analysis worker: typed calls with progress. */
import type { Method, Methods, Request, Response } from "./protocol.js";
import { addWorkerRequests } from "./ledger.js";

const worker = new Worker(new URL("../worker/engine.ts", import.meta.url), { type: "module" });
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; progress?: (stage: string, fraction?: number) => void }>();

worker.onmessage = (e: MessageEvent<Response>) => {
  const msg = e.data;
  if (msg.kind === "resources") { addWorkerRequests(msg.entries); return; }
  const p = pending.get(msg.id);
  if (!p) return;
  if (msg.kind === "progress") { p.progress?.(msg.stage, msg.fraction); return; }
  pending.delete(msg.id);
  if (msg.kind === "result") p.resolve(msg.result);
  else p.reject(new Error(msg.error));
};
worker.onerror = (e) => {
  for (const p of pending.values()) p.reject(new Error(e.message || "The analysis worker stopped."));
  pending.clear();
};

export function call<M extends Method>(method: M, params: Methods[M]["params"], progress?: (stage: string, fraction?: number) => void): Promise<Methods[M]["result"]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress });
    worker.postMessage({ id, method, params } satisfies Request);
  });
}

export const dataBase = new URL("data/", document.baseURI).href;
export const ready = call("init", { dataBase });
