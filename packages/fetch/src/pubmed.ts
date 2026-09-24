/**
 * NCBI E-utilities lookups, used to verify that every citation in the
 * knowledge base resolves to a real PubMed record with the expected title.
 */
export interface PubMedSummary { pmid: string; title: string; journal: string; year: number; authors: string[] }

export async function pubmedSummaries(pmids: string[], fetchImpl: typeof fetch = fetch): Promise<PubMedSummary[]> {
  if (pmids.length === 0) return [];
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(",")}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`PubMed esummary ${res.status}`);
  const json = (await res.json()) as { result: Record<string, any> & { uids: string[] } };
  return json.result.uids.map((u) => {
    const r = json.result[u];
    return { pmid: u, title: r.title, journal: r.source, year: Number(String(r.pubdate).slice(0, 4)), authors: (r.authors ?? []).map((a: any) => a.name) };
  });
}
