/**
 * Ensembl REST client (https://rest.ensembl.org). Works in Node 18+ and in
 * browsers (Ensembl sends permissive CORS headers). Respects the documented
 * limits: 15 requests/second and at most 200 ids per POST to /variation.
 * Retries on 429 using the Retry-After header.
 */
export interface EnsemblPopulationFrequency { population: string; allele: string; frequency: number; allele_count?: number }

export interface EnsemblVariation {
  name: string;
  var_class?: string;
  minor_allele?: string | null;
  MAF?: number | null;
  most_severe_consequence?: string;
  ancestral_allele?: string | null;
  mappings: Array<{ assembly_name: string; seq_region_name: string; start: number; end: number; strand: number; allele_string: string }>;
  populations?: EnsemblPopulationFrequency[];
  synonyms?: string[];
}

export interface EnsemblClientOptions {
  /** "GRCh38" (default, rest.ensembl.org) or "GRCh37" (grch37.rest.ensembl.org). */
  build?: "GRCh38" | "GRCh37";
  fetchImpl?: typeof fetch;
  /** Minimum ms between requests. Default 80 ms (~12 req/s). */
  minIntervalMs?: number;
  userAgent?: string;
}

export class EnsemblClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly minInterval: number;
  private last = 0;

  constructor(opts: EnsemblClientOptions = {}) {
    this.base = opts.build === "GRCh37" ? "https://grch37.rest.ensembl.org" : "https://rest.ensembl.org";
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.minInterval = opts.minIntervalMs ?? 80;
  }

  private async throttle(): Promise<void> {
    const wait = this.last + this.minInterval - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
  }

  private async request<T>(path: string, body?: unknown, attempt = 0): Promise<T> {
    await this.throttle();
    const res = await this.fetchImpl(this.base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 5) {
      const retry = Number(res.headers.get("Retry-After") ?? "2");
      await new Promise((r) => setTimeout(r, Math.max(1, retry) * 1000));
      return this.request<T>(path, body, attempt + 1);
    }
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return this.request<T>(path, body, attempt + 1);
    }
    if (!res.ok) throw new Error(`Ensembl ${res.status} ${res.statusText} for ${path}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  /** Look up one variant by rsID, optionally with population frequencies. */
  variation(rsid: string, pops = true): Promise<EnsemblVariation> {
    return this.request<EnsemblVariation>(`/variation/homo_sapiens/${encodeURIComponent(rsid)}?${pops ? "pops=1" : ""}`);
  }

  /** Batch lookup, chunked to Ensembl's 200-id limit; missing ids are simply absent from the result. */
  async variations(rsids: string[], pops = true, onProgress?: (done: number, total: number) => void): Promise<Record<string, EnsemblVariation>> {
    const out: Record<string, EnsemblVariation> = {};
    for (let i = 0; i < rsids.length; i += 200) {
      const chunk = rsids.slice(i, i + 200);
      const r = await this.request<Record<string, EnsemblVariation>>(`/variation/homo_sapiens?${pops ? "pops=1" : ""}`, { ids: chunk });
      Object.assign(out, r);
      onProgress?.(Math.min(i + 200, rsids.length), rsids.length);
    }
    return out;
  }
}

export const THOUSAND_GENOMES_SUPERPOPS = ["AFR", "AMR", "EAS", "EUR", "SAS"] as const;
export type SuperPop = (typeof THOUSAND_GENOMES_SUPERPOPS)[number];

/** Extract 1000 Genomes phase 3 super-population frequencies keyed by population then allele. */
export function thousandGenomesFrequencies(v: EnsemblVariation): Partial<Record<SuperPop, Record<string, number>>> {
  const out: Partial<Record<SuperPop, Record<string, number>>> = {};
  for (const p of v.populations ?? []) {
    const m = p.population.match(/^1000GENOMES:phase_3:(AFR|AMR|EAS|EUR|SAS)$/);
    if (!m) continue;
    const pop = m[1] as SuperPop;
    (out[pop] ??= {})[p.allele] = p.frequency;
  }
  return out;
}
