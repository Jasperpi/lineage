#!/usr/bin/env python3
"""
Step 3b. Ashkenazi Jewish allele frequencies from gnomAD.

gnomAD v4.1 reports allele counts for 1,736 genomes it labels Ashkenazi
Jewish (`asj`). It is the only large open Ashkenazi reference, and it exists
only as these counts: no individual genomes are released. The data are CC0.

For one chromosome, read the genome sites VCF at the core SNPs' GRCh38
positions (chosen in step 5, `--stage select`) through its tabix index, a few
kilobytes at a time, and keep AC_asj and AN_asj where the record's alleles
are the panel's. The whole file (8.7 GB for chromosome 22) is never downloaded.

  python 03b-gnomad-asj.py --chrom 22 [--jobs 8]

Output: data/.cache/asj.chr<c>.tsv (pos37, AC, AN) and asj.chr<c>.json.
Requires: pysam.
"""
import argparse, hashlib, json, os, sys, time, urllib.request
from concurrent.futures import ProcessPoolExecutor
from datetime import date

import pysam

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
BASE = "https://gnomad-public-us-east-1.s3.amazonaws.com/release/4.1/vcf/genomes"


def work(job):
    url, index, chrom, sites = job
    v = pysam.VariantFile(url, index_filename=index)
    out = []
    for pos38, ref, alt, pos37 in sites:
        hit = None
        for attempt in range(4):
            try:
                for rec in v.fetch(f"chr{chrom}", pos38 - 1, pos38):
                    if rec.pos == pos38 and rec.ref == ref and rec.alts and alt in rec.alts:
                        k = rec.alts.index(alt)
                        ac, an = rec.info.get("AC_asj"), rec.info.get("AN_asj")
                        if ac is not None and an:
                            hit = (pos37, int(ac[k] if isinstance(ac, tuple) else ac), int(an), "PASS" in rec.filter.keys() or len(rec.filter.keys()) == 0)
                break
            except OSError:
                time.sleep(2 * (attempt + 1))
                v = pysam.VariantFile(url, index_filename=index)
        out.append((pos37, hit))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrom", required=True)
    ap.add_argument("--jobs", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0, help="only the first N sites (for a quick test)")
    args = ap.parse_args()
    c = args.chrom
    name = f"gnomad.genomes.v4.1.sites.chr{c}.vcf.bgz"
    url = f"{BASE}/{name}"
    index = os.path.join(CACHE, name + ".tbi")
    if not os.path.exists(index):
        urllib.request.urlretrieve(url + ".tbi", index)
    sites = []
    for line in open(os.path.join(CACHE, "core.b38.tsv")):
        chrom, p38, ref, alt, p37 = line.split()
        if chrom == c:
            sites.append((int(p38), ref, alt, int(p37)))
    if args.limit:
        sites = sites[: args.limit]
    t0 = time.time()
    chunks = [(url, index, c, sites[i::args.jobs]) for i in range(args.jobs)]
    with ProcessPoolExecutor(args.jobs) as ex:
        results = [r for part in ex.map(work, chunks) for r in part]
    stats = {"sites": len(sites), "found": 0, "absent": 0, "filtered": 0}
    rows = []
    for pos37, hit in sorted(results):
        if hit is None:
            stats["absent"] += 1
            continue
        if not hit[3]:
            stats["filtered"] += 1  # gnomAD's own variant filters failed: left out, and the panel fills the gap
            continue
        stats["found"] += 1
        rows.append(f"{hit[0]}\t{hit[1]}\t{hit[2]}\n")
    with open(os.path.join(CACHE, f"asj.chr{c}.tsv"), "w") as f:
        f.writelines(rows)
    json.dump({"chrom": c, "counts": stats, "seconds": round(time.time() - t0),
               "source": {"name": f"gnomAD v4.1 genomes, sites, chr{c} (AC_asj, AN_asj at {len(sites)} positions, read by range request)", "url": url,
                          "indexSha256": hashlib.sha256(open(index, "rb").read()).hexdigest(),
                          "rowsSha256": hashlib.sha256("".join(rows).encode()).hexdigest(), "retrieved": date.today().isoformat()},
               "citation": "Chen S, Francioli LC, Goodrich JK, et al. (2024). A genomic mutational constraint map using variation in 76,156 human genomes. Nature 625:92-100 (gnomAD v4).",
               "terms": "gnomAD data are released under CC0; attribution requested; no attempt to re-identify participants."},
              open(os.path.join(CACHE, f"asj.chr{c}.json"), "w"), indent=1)
    sys.stderr.write(f"chr{c}: {stats} in {round(time.time() - t0)} s\n")


if __name__ == "__main__":
    main()
