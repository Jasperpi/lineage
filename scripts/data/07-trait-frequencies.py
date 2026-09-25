#!/usr/bin/env python3
"""
Step 7. Frequencies of the trait knowledge base's markers in all 26 populations.

The knowledge base stores 1000 Genomes super-population frequencies from
Ensembl. For the trait pages' world maps, this step counts each marker's
alleles in the 26 phase 3 populations directly from the released VCFs,
reading only the index blocks that hold those positions (remote tabix), and
checks that the counted alleles are the knowledge base's alleles.

Requires: pysam. Output: data/reference/trait-frequencies.json
"""
import json, os, sys
from datetime import date

import pysam

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
BASE = "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502"
POPS = ["YRI", "LWK", "GWD", "MSL", "ESN", "ASW", "ACB", "MXL", "PUR", "CLM", "PEL", "CHB", "JPT", "CHS", "CDX", "KHV",
        "CEU", "TSI", "FIN", "GBR", "IBS", "GIH", "PJL", "BEB", "STU", "ITU"]


def vcf_url(c):
    if c == "X":
        return f"{BASE}/ALL.chrX.phase3_shapeit2_mvncall_integrated_v1c.20130502.genotypes.vcf.gz"
    return f"{BASE}/ALL.chr{c}.phase3_shapeit2_mvncall_integrated_v5b.20130502.genotypes.vcf.gz"


def main():
    kb = json.load(open(os.path.join(ROOT, "packages", "kb", "src", "ensembl-verified.json")))
    sample_pop = {}
    with open(os.path.join(CACHE, "integrated_call_samples_v3.20130502.ALL.panel")) as f:
        next(f)
        for line in f:
            s, p = line.split("\t")[:2]
            sample_pop[s] = p
    out = {}
    for rsid, v in kb.items():
        chrom, pos = v["chrom"], v["pos37"]
        tab = pysam.TabixFile(vcf_url(chrom))
        header = tab.header[-1].rstrip("\n").split("\t")
        col_pop = [POPS.index(sample_pop[s]) for s in header[9:]]
        rows = [r.split("\t") for r in tab.fetch(chrom, pos - 1, pos)]
        rows = [r for r in rows if int(r[1]) == pos and len(r[3]) == 1 and all(len(a) == 1 for a in r[4].split(","))]
        if not rows:
            sys.stderr.write(f"{rsid}: not found at {chrom}:{pos}\n")
            continue
        r = rows[0]
        alleles = [r[3]] + r[4].split(",")
        if not set(alleles) <= set(v["alleles"]):
            sys.stderr.write(f"{rsid}: VCF alleles {alleles} not in knowledge-base alleles {v['alleles']}\n")
            continue
        counts = [[0] * len(alleles) for _ in POPS]
        for i, gt in enumerate(r[9:]):
            for a in gt.replace("|", "/").split("/"):
                if a.isdigit():
                    counts[col_pop[i]][int(a)] += 1
        out[rsid] = {
            "chrom": chrom, "pos37": pos, "vcfId": r[2], "alleles": alleles,
            "frequencies": {POPS[p]: {al: round(c[k] / max(1, sum(c)), 4) for k, al in enumerate(alleles)} for p, c in enumerate(counts)},
            "chromosomes": {POPS[p]: sum(c) for p, c in enumerate(counts)},
        }
        sys.stderr.write(f"{rsid}: {r[2]} {alleles} counted\n")
        tab.close()
    json.dump({
        "id": "trait-frequencies.1000g",
        "title": "Trait marker allele frequencies in the 26 populations of 1000 Genomes phase 3",
        "provenance": {
            "source": "1000 Genomes Project phase 3 genotype VCFs (release 20130502), read by tabix at each marker's GRCh37 position",
            "url": f"{BASE}/",
            "citation": "The 1000 Genomes Project Consortium (2015). A global reference for human genetic variation. Nature 526:68-74.",
            "retrieved": date.today().isoformat(),
            "script": "scripts/data/07-trait-frequencies.py",
        },
        "populations": POPS,
        "markers": out,
    }, open(os.path.join(ROOT, "data", "reference", "trait-frequencies.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
