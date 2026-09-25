#!/usr/bin/env python3
"""
Step 3. Allele counts in the 26 populations of the 1000 Genomes Project, phase 3.

For every SNP from step 2 (on both chip families), read the phase 3 genotype
VCF at that position and count, per population, how many sampled chromosomes
carry the ALT allele (AC) and how many were called (AN). Only biallelic SNPs
are kept. Counting happens here from the released genotypes rather than from a
third-party summary, so the numbers can be reproduced exactly.

Each chromosome's VCF (0.2-1.8 GB) is downloaded into data/.cache, read through
its tabix index at the target positions only, and deleted afterwards unless
KEEP_VCF=1.

Requires: Python 3.9+, pysam (pip install pysam).
Output: data/.cache/1000g-counts.tsv and 1000g-counts.json (provenance), plus
per-chromosome dosage matrices (1000g-dosage.chr<c>.u8: one row of 2,504
bytes per written SNP, ALT copies 0-2, 255 = missing) and 1000g-samples.tsv in
column order, for the genotype-based PCA in a later step.
"""
import hashlib, json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pysam

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
BASE = "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502"
PANEL = "integrated_call_samples_v3.20130502.ALL.panel"
# Fixed column order: by continental group, then population code as IGSR lists them.
POPS = ["YRI", "LWK", "GWD", "MSL", "ESN", "ASW", "ACB",
        "MXL", "PUR", "CLM", "PEL",
        "CHB", "JPT", "CHS", "CDX", "KHV",
        "CEU", "TSI", "FIN", "GBR", "IBS",
        "GIH", "PJL", "BEB", "STU", "ITU"]
CHROMS = [str(c) for c in range(1, 23)] + ["X"]


def vcf_name(c):
    if c == "X":
        return "ALL.chrX.phase3_shapeit2_mvncall_integrated_v1c.20130502.genotypes.vcf.gz"
    return f"ALL.chr{c}.phase3_shapeit2_mvncall_integrated_v5b.20130502.genotypes.vcf.gz"


def fetch(name):
    """Download once into the cache with curl (fast through proxies; retries)."""
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        sys.stderr.write(f"downloading {name}\n")
        subprocess.run(["curl", "-sS", "--fail", "--retry", "5", "-C", "-", "-o", path + ".part", f"{BASE}/{name}"], check=True)
        os.rename(path + ".part", path)
    return path


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main():
    os.makedirs(CACHE, exist_ok=True)
    panel_path = fetch(PANEL)
    sample_pop = {}
    with open(panel_path) as f:
        next(f)
        for line in f:
            sample, pop, superpop, sex = line.rstrip("\n").split("\t")[:4]
            sample_pop[sample] = pop
    targets = {}
    with open(os.path.join(CACHE, "chip-snps.tsv")) as f:
        for line in f:
            rsid, chrom, pos = line.split()
            targets.setdefault(chrom, []).append((int(pos), rsid))

    out_path = os.path.join(CACHE, "1000g-counts.tsv")
    done = set()
    if os.path.exists(out_path):
        with open(out_path) as f:
            for line in f:
                if not line.startswith("#"):
                    done.add(line.split("\t", 2)[1])
    out = open(out_path, "a")
    if not done:
        out.write("#rsid\tchrom\tpos\tref\talt\tvcf_id\t" + "\t".join(f"{p}_ac\t{p}_an" for p in POPS) + "\n")
    sources = []
    stats = {"targets": 0, "written": 0, "absent": 0, "not_biallelic_snp": 0}
    # Download a few chromosomes ahead of the one being counted, to bound disk use.
    pool = ThreadPoolExecutor(max_workers=3)
    pending = [c for c in CHROMS if c not in done]
    futures = {}
    def ahead(i):
        for c in pending[i:i + 4]:
            if c not in futures:
                futures[c] = pool.submit(lambda c=c: (fetch(vcf_name(c)), fetch(vcf_name(c) + ".tbi")))
    for chrom in CHROMS:
        wanted = sorted(targets.get(chrom, []))
        stats["targets"] += len(wanted)
        name = vcf_name(chrom)
        if chrom in done:
            sys.stderr.write(f"chr{chrom}: already counted\n")
            continue
        ahead(pending.index(chrom))
        vcf, tbi = futures[chrom].result()
        t0 = time.time()
        sources.append({"name": f"1000 Genomes phase 3 genotypes, chr{chrom}", "url": f"{BASE}/{name}", "sha256": sha256(vcf), "bytes": os.path.getsize(vcf)})
        tab = pysam.TabixFile(vcf, index=tbi)
        header = tab.header[-1].rstrip("\n").split("\t")
        col_pop = [POPS.index(sample_pop[s]) for s in header[9:]]
        samples_path = os.path.join(CACHE, "1000g-samples.tsv")
        if not os.path.exists(samples_path):
            with open(samples_path, "w") as sf:
                for s_id in header[9:]:
                    sf.write(f"{s_id}\t{sample_pop[s_id]}\n")
        rows_out = []
        dosage = bytearray()
        for pos, rsid in wanted:
            rows = [r for r in tab.fetch(chrom, pos - 1, pos) if int(r.split("\t", 2)[1]) == pos]
            if not rows:
                stats["absent"] += 1
                continue
            fields = None
            for r in rows:
                f = r.split("\t")
                if len(f[3]) == 1 and len(f[4]) == 1 and f[3] in "ACGT" and f[4] in "ACGT":
                    fields = f
                    break
            if fields is None:
                stats["not_biallelic_snp"] += 1
                continue
            ac = [0] * len(POPS)
            an = [0] * len(POPS)
            row = bytearray(len(fields) - 9)
            for i, gt in enumerate(fields[9:]):
                p = col_pop[i]
                d = 0
                for allele in gt.replace("|", "/").split("/"):
                    if allele == "1":
                        ac[p] += 1
                        an[p] += 1
                        d += 1
                    elif allele == "0":
                        an[p] += 1
                    else:
                        d = 255
                        break
                row[i] = d
            dosage += row
            rows_out.append("\t".join([rsid, chrom, str(pos), fields[3], fields[4], fields[2]] + [f"{a}\t{b}" for a, b in zip(ac, an)]) + "\n")
        # Write a chromosome only once it is complete, so an interrupted run resumes cleanly.
        with open(os.path.join(CACHE, f"1000g-dosage.chr{chrom}.u8"), "wb") as df:
            df.write(dosage)
        out.write("".join(rows_out))
        out.flush()
        n = len(rows_out)
        stats["written"] += n
        tab.close()
        if os.environ.get("KEEP_VCF") != "1":
            os.remove(vcf)
        sys.stderr.write(f"chr{chrom}: {n} of {len(wanted)} SNPs counted in {time.time() - t0:.0f} s\n")
    out.close()
    meta = {
        "populations": POPS,
        "stats": stats,
        "panel": {"name": PANEL, "url": f"{BASE}/{PANEL}", "sha256": sha256(panel_path)},
        "sources": sources,
        "retrieved": date.today().isoformat(),
        "citation": "The 1000 Genomes Project Consortium (2015). A global reference for human genetic variation. Nature 526:68-74.",
    }
    meta_path = os.path.join(CACHE, "1000g-counts.json")
    if os.path.exists(meta_path) and done:
        old = json.load(open(meta_path))
        meta["sources"] = old.get("sources", []) + sources
    json.dump(meta, open(meta_path, "w"), indent=1)


if __name__ == "__main__":
    main()
