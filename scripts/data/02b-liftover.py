#!/usr/bin/env python3
"""
Step 2b. GRCh38 positions for the chip SNPs.

The gnomAD HGDP+1KG genotypes are on GRCh38 and consumer files are (mostly)
on GRCh37. Every chip SNP is lifted with UCSC's hg19ToHg38 chain file
(pyliftover). A SNP is kept only when it lifts to one position on the same
chromosome; SNPs that land on the minus strand are marked so their alleles are
complemented when compared. The GRCh38 positions also let the app read
GRCh38 consumer files.

Input: data/.cache/chip-snps.tsv (step 2).
Output: data/.cache/chip-snps.b38.tsv (rsid, chrom, pos37, pos38, strand38,
on GSA, on OmniExpress) and chip-snps.b38.json (provenance and counts).
Requires: pyliftover.
"""
import hashlib, json, os, subprocess, sys
from datetime import date

from pyliftover import LiftOver

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
CHAIN_URL = "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    chain = os.path.join(CACHE, "hg19ToHg38.over.chain.gz")
    if not os.path.exists(chain):
        subprocess.run(["curl", "-sS", "--fail", "--retry", "5", "-o", chain + ".part", CHAIN_URL], check=True)
        os.rename(chain + ".part", chain)
    lo = LiftOver(chain)
    stats = {"input": 0, "lifted": 0, "unmapped": 0, "otherChromosome": 0, "multiple": 0, "minusStrand": 0}
    out = open(os.path.join(CACHE, "chip-snps.b38.tsv"), "w")
    for line in open(os.path.join(CACHE, "chip-snps.tsv")):
        rsid, chrom, pos, gsa, omni = line.split()
        stats["input"] += 1
        hits = lo.convert_coordinate(f"chr{chrom}", int(pos) - 1)
        if not hits:
            stats["unmapped"] += 1
            continue
        if len(hits) > 1:
            stats["multiple"] += 1
            continue
        c38, p38, strand, _ = hits[0]
        if c38 != f"chr{chrom}":
            stats["otherChromosome"] += 1
            continue
        if strand == "-":
            stats["minusStrand"] += 1
        stats["lifted"] += 1
        out.write(f"{rsid}\t{chrom}\t{pos}\t{p38 + 1}\t{strand}\t{gsa}\t{omni}\n")
    out.close()
    json.dump({"chain": {"url": CHAIN_URL, "sha256": sha256(chain), "bytes": os.path.getsize(chain), "retrieved": date.today().isoformat()},
               "method": "pyliftover, hg19ToHg38; one hit on the same chromosome required", "counts": stats},
              open(os.path.join(CACHE, "chip-snps.b38.json"), "w"), indent=1)
    sys.stderr.write(f"liftover: {stats}\n")


if __name__ == "__main__":
    main()
