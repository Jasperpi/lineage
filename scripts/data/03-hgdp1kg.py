#!/usr/bin/env python3
"""
Step 3. Phased genotypes of the gnomAD HGDP+1KG callset at the chip SNPs.

The callset (Koenig et al. 2024, Genome Research 34:796) re-sequenced and
jointly called the 1000 Genomes and HGDP samples: 4,094 genomes in 78
populations, GRCh38, phased with SHAPEIT5, released under CC0. It replaces
1000 Genomes phase 3 as Lineage's genotype source.

For one chromosome: download the phased BCF, read it at the chip SNPs'
GRCh38 positions (step 2b), keep biallelic SNPs that are not A/T or C/G, and
store every sample's two haplotypes as bits. Alleles are written on the
GRCh37 forward strand (complemented where the liftover changed strand), so
they compare directly with a consumer file. The phase is kept: the validation
harness builds admixed test genomes from these haplotypes.

  python 03-hgdp1kg.py --chrom 22

Output: data/.cache/hgdp1kg.chr<c>.npz with pos37, pos38, ref, alt (0-3 =
A, C, G, T), gsa, omni (0/1), minus (1 = the liftover changed strand), rsid, samples, and hap: one row per SNP,
np.packbits over 2 x samples bits (haplotype 2i and 2i+1 belong to sample i;
1 = ALT). hgdp1kg.chr<c>.json holds the provenance. The BCF is deleted
afterwards unless KEEP_BCF=1.

Requires: pysam (its bundled bcftools does the reading), numpy.
"""
import argparse, hashlib, json, os, subprocess, sys, tempfile, time
from datetime import date

import numpy as np
import pysam
from pysam import bcftools

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
BASE = "https://gnomad-public-us-east-1.s3.amazonaws.com/resources/hgdp_1kg/phased_haplotypes_v2"
BASES = "ACGT"
COMP = {"A": "T", "C": "G", "G": "C", "T": "A"}
WINDOW = 5_000_000  # bcftools is run a window at a time, so its text output stays small


def log(msg):
    sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    sys.stderr.flush()


def fetch(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        log(f"downloading {name}")
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
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrom", required=True)
    args = ap.parse_args()
    c = args.chrom
    os.makedirs(CACHE, exist_ok=True)
    targets = {}
    for line in open(os.path.join(CACHE, "chip-snps.b38.tsv")):
        rsid, chrom, p37, p38, strand, gsa, omni = line.split()
        if chrom == c:
            # Two chip SNPs lifting to one GRCh38 position cannot be told apart: drop both.
            targets[int(p38)] = None if int(p38) in targets else (rsid, int(p37), strand, int(gsa), int(omni))
    targets = {p: t for p, t in targets.items() if t}
    log(f"chr{c}: {len(targets):,} target SNPs")

    name = f"hgdp1kgp_chr{c}.filtered.SNV_INDEL.phased.shapeit5.bcf"
    bcf, _ = fetch(name), fetch(name + ".csi")
    src = {"name": f"gnomAD HGDP+1KG phased haplotypes v2, chr{c}", "url": f"{BASE}/{name}", "sha256": sha256(bcf), "bytes": os.path.getsize(bcf), "retrieved": date.today().isoformat()}
    samples = list(pysam.VariantFile(bcf).header.samples)
    n = len(samples)
    log(f"{n} samples")

    stats = {"targets": len(targets), "absent": 0, "notBiallelicSnp": 0, "palindromic": 0, "missingOrUnphased": 0, "written": 0}
    rows, haps = [], []
    seen = {}
    positions = sorted(targets)
    with tempfile.TemporaryDirectory() as tmp:
        for start in range(0, positions[-1] + 1, WINDOW):
            chunk = [p for p in positions if start < p <= start + WINDOW]
            if not chunk:
                continue
            tfile = os.path.join(tmp, "t.tsv")
            with open(tfile, "w") as f:
                f.writelines(f"chr{c}\t{p}\n" for p in chunk)
            text = bcftools.query("-f", "%POS\t%REF\t%ALT\t[%GT]\n", "-T", tfile, "-r", f"chr{c}:{start + 1}-{start + WINDOW}", bcf)
            for line in text.split("\n"):
                if not line:
                    continue
                pos, ref, alt, gts = line.split("\t")
                pos = int(pos)
                if pos not in targets:
                    continue
                seen[pos] = seen.get(pos, 0) + 1
                if len(ref) != 1 or len(alt) != 1 or ref not in BASES or alt not in BASES:
                    stats["notBiallelicSnp"] += 1
                    continue
                # Phased, complete, biallelic genotypes are exactly three characters each: a|b.
                g = np.frombuffer(gts.encode(), dtype=np.uint8)
                if g.size != 3 * n or not (g[1::3] == ord("|")).all():
                    stats["missingOrUnphased"] += 1
                    continue
                a, b = g[0::3] - ord("0"), g[2::3] - ord("0")
                if a.max() > 1 or b.max() > 1:
                    stats["notBiallelicSnp"] += 1
                    continue
                rsid, p37, strand, gsa, omni = targets[pos]
                if strand == "-":
                    ref, alt = COMP[ref], COMP[alt]
                if {ref, alt} in ({"A", "T"}, {"C", "G"}):
                    stats["palindromic"] += 1
                    continue
                h = np.empty(2 * n, dtype=np.uint8)
                h[0::2], h[1::2] = a, b
                rows.append((p37, pos, BASES.index(ref), BASES.index(alt), gsa, omni, rsid, 1 if strand == "-" else 0))
                haps.append(np.packbits(h))
            log(f"  through {start + WINDOW:,}: {len(rows):,} kept")
    # A position the BCF lists more than once is a split multi-allelic site: drop it.
    multi = {p for p, k in seen.items() if k > 1}
    keep = [i for i, r in enumerate(rows) if r[1] not in multi]
    stats["notBiallelicSnp"] += len(rows) - len(keep)
    rows, haps = [rows[i] for i in keep], [haps[i] for i in keep]
    stats["absent"] = len(targets) - len(seen)
    # Panel order is GRCh37 position.
    order = sorted(range(len(rows)), key=lambda i: rows[i][0])
    rows, haps = [rows[i] for i in order], [haps[i] for i in order]
    stats["written"] = len(rows)
    np.savez_compressed(os.path.join(CACHE, f"hgdp1kg.chr{c}.npz"),
                        pos37=np.array([r[0] for r in rows], dtype=np.uint32), pos38=np.array([r[1] for r in rows], dtype=np.uint32),
                        ref=np.array([r[2] for r in rows], dtype=np.uint8), alt=np.array([r[3] for r in rows], dtype=np.uint8),
                        gsa=np.array([r[4] for r in rows], dtype=np.uint8), omni=np.array([r[5] for r in rows], dtype=np.uint8),
                        minus=np.array([r[7] for r in rows], dtype=np.uint8), rsid=np.array([r[6] for r in rows]), samples=np.array(samples), hap=np.stack(haps) if haps else np.zeros((0, (2 * n + 7) // 8), dtype=np.uint8))
    json.dump({"chrom": c, "source": src, "samples": n, "counts": stats,
               "citation": "Koenig Z, Yohannes MT, Nkambule LL, et al. (2024). A harmonized public resource of deeply sequenced diverse human genomes. Genome Research 34:796-809.",
               "terms": "gnomAD data are released under CC0; attribution requested; no attempt to re-identify participants."},
              open(os.path.join(CACHE, f"hgdp1kg.chr{c}.json"), "w"), indent=1)
    log(f"chr{c}: {stats}")
    if os.environ.get("KEEP_BCF") != "1":
        os.remove(bcf)
        os.remove(bcf + ".csi")


if __name__ == "__main__":
    main()
