#!/usr/bin/env python3
"""
Step 4b. The reference samples and their populations.

Reads gnomAD's sample table for the HGDP+1KG callset and decides which
genomes Lineage uses:
  - not hard-filtered by gnomAD (contamination, coverage, sex, fingerprint);
  - not a duplicate, a parent or child, or a sibling of another kept sample.
gnomAD's `high_quality` flag is NOT used: it also fails samples whose counts
of variants are unusual for their inferred ancestry, which removes every
Oceanian genome and the San, Mbuti and Biaka, the very populations 1000
Genomes lacks. Koenig et al. (2024) keep them in the released callset too.
More distant relatedness is left in: in small isolated populations it is
mostly shared ancestry, and dropping it would empty them.

Output: data/.cache/samples.tsv (sample, population, continent, project) and
data/reference/populations.json (every population with its name, where it
was sampled, coordinates, sample count and continent; 1000 Genomes entries
come from step 4, HGDP names and places from regions.json, coordinates from
gnomAD's table).
"""
import csv, hashlib, json, os, subprocess, sys
from collections import Counter, defaultdict
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
REF = os.path.join(ROOT, "data", "reference")
META_URL = "https://gnomad-public-us-east-1.s3.amazonaws.com/release/3.1/secondary_analyses/hgdp_1kg_v2/metadata_and_qc/gnomad_meta_updated.tsv"


def main():
    path = os.path.join(CACHE, "gnomad_meta_updated.tsv")
    if not os.path.exists(path):
        subprocess.run(["curl", "-sS", "--fail", "--retry", "5", "-o", path + ".part", META_URL], check=True)
        os.rename(path + ".part", path)
    cfg = json.load(open(os.path.join(os.path.dirname(__file__), "regions.json")))
    rows = list(csv.DictReader(open(path), delimiter="\t"))
    dropped = Counter()
    kept = []
    for r in rows:
        if r["sample_filters.hard_filtered"] == "true":
            dropped["hardFiltered"] += 1
        elif r["sample_filters.all_samples_duplicate"] == "true":
            dropped["duplicate"] += 1
        elif r["sample_filters.all_samples_parent_child"] == "true":
            dropped["parentOrChild"] += 1
        elif r["sample_filters.all_samples_sibling"] == "true":
            dropped["sibling"] += 1
        else:
            kept.append(r)
    by_pop = defaultdict(list)
    for r in kept:
        by_pop[r["hgdp_tgp_meta.Population"]].append(r)
    with open(os.path.join(CACHE, "samples.tsv"), "w") as f:
        for r in kept:
            f.write("\t".join([r["s"], r["hgdp_tgp_meta.Population"], cfg["gnomadRegion"][r["hgdp_tgp_meta.Genetic.region"]], r["hgdp_tgp_meta.Project"]]) + "\n")

    kg_path = os.path.join(CACHE, "populations.1000g.json")
    kg = {p["code"]: p for p in json.load(open(kg_path))["populations"]} if os.path.exists(kg_path) else {}
    kg_prov = json.load(open(kg_path))["provenance"]["sources"] if os.path.exists(kg_path) else []
    region_of = {}
    for c in cfg["continents"]:
        for reg in c["regions"]:
            for p in reg["populations"]:
                region_of[p] = reg["id"]
    pops = []
    for code, rs in sorted(by_pop.items(), key=lambda kv: (kv[1][0]["hgdp_tgp_meta.Genetic.region"], kv[0])):
        cont = cfg["gnomadRegion"][rs[0]["hgdp_tgp_meta.Genetic.region"]]
        lat, lon = float(rs[0]["hgdp_tgp_meta.Latitude"]), float(rs[0]["hgdp_tgp_meta.Longitude"])
        sexes = Counter(r["sex_imputation.sex_karyotype"] for r in rs)
        base = {"code": code, "superpopulation": cont, "lat": round(lat, 3), "lon": round(lon, 3), "samples": len(rs),
                "female": sexes.get("XX", 0), "male": sexes.get("XY", 0), "project": rs[0]["hgdp_tgp_meta.Project"]}
        if code in region_of:
            base["region"] = region_of[code]
        if code in kg:
            k = kg[code]
            entry = {**k, **base, "lat": k["lat"], "lon": k["lon"]}
        else:
            name, place = cfg["hgdp"].get(code, [code, ""])
            entry = {**base, "name": name, "description": f"{name}, sampled in {place} (HGDP)" if place else name}
        pops.append(entry)
    # Reference groups that exist only as allele frequencies have no sampling place of their own.
    pops.append({"code": "ASJ", "name": "Ashkenazi Jewish", "description": "Ashkenazi Jewish genomes in gnomAD v4.1 (allele frequencies only; no individual genomes are released)",
                 "superpopulation": "EUR", "region": "ASJ", "lat": None, "lon": None, "samples": None, "frequencyOnly": True, "project": "gnomAD"})
    out = {
        "id": "populations.hgdp1kg",
        "title": "Reference populations: gnomAD HGDP+1KG, and gnomAD's Ashkenazi Jewish group",
        "provenance": {
            "sources": [{"name": "gnomAD HGDP+1KG sample table (population labels, coordinates, quality filters)", "url": META_URL,
                         "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest(), "bytes": os.path.getsize(path), "retrieved": date.today().isoformat()}] + kg_prov,
            "citation": "Koenig Z, et al. (2024). A harmonized public resource of deeply sequenced diverse human genomes. Genome Research 34:796-809; Bergström A, et al. (2020). Science 367:eaay5012; The 1000 Genomes Project Consortium (2015). Nature 526:68-74.",
            "terms": "gnomAD data: CC0, attribution requested, no re-identification. HGDP and 1000 Genomes data are public.",
            "method": "Samples kept: not hard-filtered, not a duplicate, parent, child or sibling of another kept sample. gnomAD's high_quality flag is not applied (it removes Oceanian and African forager genomes for being unlike the rest).",
            "script": "scripts/data/04b-populations.py", "generated": date.today().isoformat(),
            "samples": {"listed": len(rows), "kept": len(kept), "dropped": dict(dropped)},
        },
        "superpopulations": [{"code": c["id"], "name": c["label"]} for c in cfg["continents"]],
        "regions": [{"code": reg["id"], "name": reg["label"], "continent": c["id"], **({"frequencyOnly": True} if reg.get("frequencyOnly") else {})} for c in cfg["continents"] for reg in c["regions"]],
        "populations": pops,
    }
    os.makedirs(REF, exist_ok=True)
    target = os.path.join(os.environ.get("LINEAGE_OUT", REF), "populations.json")
    json.dump(out, open(target, "w"), separators=(",", ":"))
    sys.stderr.write(f"kept {len(kept)} of {len(rows)} samples in {len(by_pop)} populations; dropped {dict(dropped)}; wrote {target}\n")


if __name__ == "__main__":
    main()
