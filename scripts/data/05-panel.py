#!/usr/bin/env python3
"""
Step 5. The reference panel (version 2): which SNPs, continental components,
regional components, population frequencies, PCA.

Inputs: hgdp1kg.chr<c>.npz (step 3), samples.tsv (step 4b), regions.json,
asj.chr<c>.tsv (step 3b, optional), populations.json.

  python 05-panel.py --stage select              choose the SNPs (without the held-out genomes)
  python 05-panel.py --stage build               fit and write data/reference
  python 05-panel.py --stage build --holdout     the validation build: 20% of each
                                                 population held out of every fit

select
  QC      pooled minor allele frequency >= 1% among the kept samples.
  core    LD-pruned, for everything that treats SNPs as independent
          (components, similarity, PCA). First the SNPs on both chip
          families with MAF >= 5%, pruned greedily along each chromosome
          (r^2 < 0.2 with the last 20 kept within 500 kb, on the pooled
          genotypes); then SNPs on the GSA alone, most informative about
          continental ancestry first, each added only if r^2 < 0.2 with every
          core SNP within 500 kb, up to CORE_MAX.
  dense   the core plus the most informative other SNPs up to DENSE_MAX, for
          chromosome painting.
  Informativeness is the between-continent share of a SNP's variance.

build
  continents  ADMIXTURE's likelihood in its supervised mode, as in version 1:
          reference genomes fixed to their continent's component, admixed
          populations estimated. Then curation: each fixed genome is fitted
          freely against the components, and one that is unlike the rest of
          its own population (its share of its continent below the
          population's median by more than 15 points and four robust standard
          deviations) is released (fitted, no longer a
          reference), and the fit repeated. The Indigenous American component now has unadmixed
          references (HGDP's Karitiana, Surui, Maya, Pima, Colombian), so it
          is no longer learned from admixed genomes alone.
  regions     allele counts of each region's reference genomes: exact counts
          with a known sample size, which the app's likelihood uses.
          The Ashkenazi Jewish group exists only as gnomAD allele frequencies.
  populations allele counts of every population at the core SNPs.
  PCA     as version 1, plus the sample eigenvalues in the units the
          closed-form shrinkage (Lee, Zou & Wright 2010) needs.
  files   panel.bin.gz (dense layer, continental components, PCA) and one
          tier per continent, panel.<continent>.bin.gz (its populations and
          regions at the core SNPs), loaded only for continents a person
          carries. The build fails if a person's files would exceed the
          size budget.

Requires: numpy.
"""
import argparse, bisect, gzip, hashlib, json, os, struct, sys, time
from datetime import date

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
REF = os.path.join(ROOT, "data", "reference")
HERE = os.path.dirname(os.path.abspath(__file__))
BASES = "ACGT"
COMP_CODE = np.array([3, 2, 1, 0], dtype=np.uint8)  # A<->T, C<->G
FREQ_SCALE = 250
N_PC = 6
CORE_MAX = int(os.environ.get("CORE_MAX", 100_000))
DENSE_MAX = int(os.environ.get("DENSE_MAX", 250_000))
CORE_BUDGET = float(os.environ.get("CORE_BUDGET_MB", 4.5)) * 1e6
PATH_BUDGET = float(os.environ.get("PATH_BUDGET_MB", 8.0)) * 1e6
HOLDOUT_SEED = 20261009


def log(msg):
    sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    sys.stderr.flush()


def load_samples():
    out = {}
    for line in open(os.path.join(CACHE, "samples.tsv")):
        s, pop, cont, project = line.rstrip("\n").split("\t")
        out[s] = (pop, cont)
    return out


def chrom_data(c, cols):
    """One chromosome's SNP table and the genotype matrix (SNPs x kept samples) of ALT copies."""
    d = np.load(os.path.join(CACHE, f"hgdp1kg.chr{c}.npz"))
    H = np.unpackbits(d["hap"], axis=1)
    G = H[:, 2 * cols] + H[:, 2 * cols + 1]
    return d, H, G


def write_lngp(path, header, blocks):
    header = {**header, "blocks": [{"name": nm, "type": t, "length": int(a.size)} for nm, t, a in blocks]}
    hb = json.dumps(header, separators=(",", ":")).encode()
    out = bytearray(b"LNGP" + struct.pack("<I", len(hb)) + hb)
    out += b"\0" * ((-len(out)) % 4)
    for _, _, a in blocks:
        b = a.astype(a.dtype.newbyteorder("<")).tobytes()
        out += b + b"\0" * ((-len(b)) % 4)
    gz = gzip.compress(bytes(out), 9, mtime=0)
    with open(path, "wb") as f:
        f.write(gz)
    log(f"{os.path.basename(path)}: {len(out):,} bytes raw, {len(gz):,} gzipped")
    return {"bytes": len(gz), "sha256": hashlib.sha256(gz).hexdigest()}


# --------------------------------------------------------------------------- select

def select(chroms, sample_info, fit_mask_of):
    cfg = json.load(open(os.path.join(HERE, "regions.json")))
    conts = [c["id"] for c in cfg["continents"]]
    sizes = {c: int(np.load(os.path.join(CACHE, f"hgdp1kg.chr{c}.npz"))["pos37"].size) for c in chroms}
    total = sum(sizes.values())
    # A partial run (some chromosomes only) scales the targets, so a test build has the full build's density.
    scale = total / float(os.environ.get("GENOME_SNPS", total))
    sel = {}
    stats = {"input": 0, "rare": 0, "kept": 0, "coreBothChips": 0, "coreGsaOnly": 0, "core": 0, "dense": 0}
    for c in chroms:
        d0 = np.load(os.path.join(CACHE, f"hgdp1kg.chr{c}.npz"))
        names = d0["samples"].tolist()
        cols = np.array([i for i, s in enumerate(names) if fit_mask_of(s)])
        cont_of = np.array([conts.index(sample_info[names[i]][1]) for i in cols])
        d, _, G = chrom_data(c, cols)
        n = G.shape[1]
        pos = d["pos37"].astype(np.int64)
        gsa, omni = d["gsa"].astype(bool), d["omni"].astype(bool)
        p = G.mean(axis=1) / 2
        ok = (p >= 0.01) & (p <= 0.99)
        stats["input"] += len(p); stats["rare"] += int((~ok).sum()); stats["kept"] += int(ok.sum())
        # Informativeness: the share of the SNP's variance that lies between continents.
        info = np.zeros(len(p))
        for k in range(len(conts)):
            m = cont_of == k
            if m.any():
                info += m.sum() * (G[:, m].mean(axis=1) / 2 - p) ** 2
        info = np.where(ok, info / (n * np.clip(p * (1 - p), 1e-9, None)), -1)
        core_quota = int(round(CORE_MAX * scale * sizes[c] / total))
        dense_quota = int(round(DENSE_MAX * scale * sizes[c] / total))
        std = lambda i: (G[i].astype(np.float32) - 2 * p[i]) / np.sqrt(2 * p[i] * (1 - p[i]))
        common = ok & (p >= 0.05) & (p <= 0.95)
        # Pass 1: SNPs on both chip families, greedy along the chromosome.
        kept = []  # (pos, index, standardised vector)
        for i in np.where(common & gsa & omni)[0]:
            x = std(i)
            if all(pos[i] - pj > 500_000 or (float(x @ xj) / n) ** 2 < 0.2 for pj, _, xj in kept[-20:]):
                kept.append((int(pos[i]), int(i), x))
        if len(kept) > core_quota:
            best = sorted(sorted(range(len(kept)), key=lambda k: -info[kept[k][1]])[:core_quota])
            kept = [kept[k] for k in best]
        n_both = len(kept)
        # Pass 2: GSA-only SNPs, most informative first, where they are in low LD with every core SNP nearby.
        positions = [k[0] for k in kept]
        for i in sorted(np.where(common & gsa & ~omni)[0], key=lambda i: -info[i]):
            if len(kept) >= core_quota:
                break
            lo, hi = bisect.bisect_left(positions, pos[i] - 500_000), bisect.bisect_right(positions, pos[i] + 500_000)
            x = std(i)
            if all((float(x @ kept[j][2]) / n) ** 2 < 0.2 for j in range(lo, hi)):
                at = bisect.bisect_left(positions, pos[i])
                positions.insert(at, int(pos[i]))
                kept.insert(at, (int(pos[i]), int(i), x))
        core = np.array(sorted(k[1] for k in kept), dtype=np.int64)
        is_core = np.zeros(len(p), dtype=bool)
        is_core[core] = True
        rest = [i for i in np.argsort(-info) if ok[i] and not is_core[i]][: max(0, dense_quota - len(core))]
        dense = np.array(sorted(set(core.tolist()) | set(int(i) for i in rest)), dtype=np.int64)
        sel[c] = (dense, is_core[dense])
        stats["coreBothChips"] += n_both; stats["coreGsaOnly"] += len(core) - n_both; stats["core"] += len(core); stats["dense"] += len(dense)
        log(f"chr{c}: {len(p):,} SNPs, {int(ok.sum()):,} pass QC; core {len(core):,} ({n_both:,} on both chips); dense {len(dense):,}")
        del G, d
    return sel, stats


def write_selection(sel, stats, tag):
    np.savez_compressed(os.path.join(CACHE, f"selection{tag}.npz"), chroms=np.array(list(sel)), **{f"dense_{c}": v[0] for c, v in sel.items()}, **{f"core_{c}": v[1] for c, v in sel.items()})
    json.dump(stats, open(os.path.join(CACHE, f"selection{tag}.json"), "w"))
    # The core SNPs on GRCh38, with the alleles as gnomAD's GRCh38 files give them, for step 3b.
    with open(os.path.join(CACHE, f"core{tag}.b38.tsv"), "w") as f:
        for c, (dense, is_core) in sel.items():
            d = np.load(os.path.join(CACHE, f"hgdp1kg.chr{c}.npz"))
            for i in dense[is_core]:
                ref, alt = int(d["ref"][i]), int(d["alt"][i])
                if d["minus"][i]:
                    ref, alt = int(COMP_CODE[ref]), int(COMP_CODE[alt])
                f.write(f"{c}\t{int(d['pos38'][i])}\t{BASES[ref]}\t{BASES[alt]}\t{int(d['pos37'][i])}\n")


# --------------------------------------------------------------------------- build

def supervised_fit(Gc, pinned, K, F0, label):
    """ADMIXTURE's likelihood with some genomes' proportions fixed. Gc: genomes x SNPs (float32); pinned: component index or -1."""
    n, Me = Gc.shape
    fixed = pinned >= 0
    Q = np.full((n, K), 1.0 / K, dtype=np.float32)
    Q[fixed] = 0
    Q[np.where(fixed)[0], pinned[fixed]] = 1
    F = np.clip(F0.astype(np.float32), 1e-3, 1 - 1e-3)

    def em_step(Q, F):
        Pm = np.clip(Q @ F, 1e-6, 1 - 1e-6)
        A = Gc / Pm
        B = (2 - Gc) / (1 - Pm)
        ll = float((Gc * np.log(Pm) + (2 - Gc) * np.log(1 - Pm)).sum(dtype=np.float64))
        Qn = Q * (A @ F.T + B @ (1 - F).T) / (2 * Me)
        Qn = Qn / Qn.sum(axis=1, keepdims=True)
        Qn[fixed] = Q[fixed]
        num = F * (Q.T @ A)
        Fn = np.clip(num / (num + (1 - F) * (Q.T @ B)), 1e-3, 1 - 1e-3).astype(np.float32)
        return Qn.astype(np.float32), Fn, ll

    # SQUAREM (Varadhan & Roland 2008, scheme S3), falling back to the plain steps when the
    # extrapolated point is less likely, so the likelihood never decreases.
    prev, Q_prev, steps, ll, dq = -np.inf, Q, 0, -np.inf, 1.0
    for it in range(400):
        Q1, F1, _ = em_step(Q, F)
        Q2, F2, ll1 = em_step(Q1, F1)
        rQ, rF = Q1 - Q, F1 - F
        vQ, vF = (Q2 - Q1) - rQ, (F2 - F1) - rF
        rn = float(np.sqrt((rQ.astype(np.float64) ** 2).sum() + (rF.astype(np.float64) ** 2).sum()))
        vn = float(np.sqrt((vQ.astype(np.float64) ** 2).sum() + (vF.astype(np.float64) ** 2).sum()))
        alpha = min(-1.0, -rn / vn) if vn > 0 else -1.0
        Qp = np.clip(Q - 2 * alpha * rQ + alpha * alpha * vQ, 1e-6, None)
        Qp = (Qp / Qp.sum(axis=1, keepdims=True)).astype(np.float32)
        Qp[fixed] = Q[fixed]
        Fp = np.clip(F - 2 * alpha * rF + alpha * alpha * vF, 1e-3, 1 - 1e-3).astype(np.float32)
        Q3, F3, llp = em_step(Qp, Fp)
        steps += 3
        Q, F, ll = (Q3, F3, llp) if llp >= ll1 else (Q2, F2, ll1)
        dq = float(np.abs(Q - Q_prev).max())
        if it % 10 == 0:
            log(f"  {label} cycle {it}: log-likelihood {ll:.1f}, largest change in Q {dq:.1e}")
        if abs(ll - prev) < 1e-7 * abs(ll) or dq < 1e-4:
            break
        prev, Q_prev = ll, Q
    return Q.astype(np.float64), F, {"iterations": steps, "logLikelihood": ll, "lastProportionChange": dq, "snps": int(Me)}


def free_fit(Gc, F, K, iters=80):
    """Proportions of every genome with the component frequencies fixed (ADMIXTURE's projection)."""
    n, Me = Gc.shape
    Q = np.full((n, K), 1.0 / K, dtype=np.float32)
    for _ in range(iters):
        Pm = np.clip(Q @ F, 1e-6, 1 - 1e-6)
        Q = Q * ((Gc / Pm) @ F.T + ((2 - Gc) / (1 - Pm)) @ (1 - F).T) / (2 * Me)
        Q = Q / Q.sum(axis=1, keepdims=True)
    return Q


def build(chroms, sample_info, fit_mask_of, held_mask_of, out_dir, tag, holdout):
    t0 = time.time()
    cfg = json.load(open(os.path.join(HERE, "regions.json")))
    conts = cfg["continents"]
    cont_ids = [c["id"] for c in conts]
    K = len(conts)
    z = np.load(os.path.join(CACHE, f"selection{tag}.npz"))
    sel_stats = json.load(open(os.path.join(CACHE, f"selection{tag}.json")))
    sources, counts = [], {}
    Gs, Hh, table = [], [], {k: [] for k in ("pos37", "pos38", "ref", "alt", "gsa", "omni", "core", "minus")}
    chrom_counts = []
    names = fit_names = held_names = None
    for c in chroms:
        d0 = np.load(os.path.join(CACHE, f"hgdp1kg.chr{c}.npz"))
        if names is None:
            names = d0["samples"].tolist()
            cols = np.array([i for i, s in enumerate(names) if fit_mask_of(s)])
            hcols = np.array([i for i, s in enumerate(names) if held_mask_of(s)], dtype=np.int64)
            fit_names, held_names = [names[i] for i in cols], [names[i] for i in hcols]
        d, H, G = chrom_data(c, cols)
        dense = z[f"dense_{c}"]
        Gs.append(G[dense])
        if len(hcols):
            hh = np.empty((len(dense), 2 * len(hcols)), dtype=np.uint8)
            hh[:, 0::2], hh[:, 1::2] = H[dense][:, 2 * hcols], H[dense][:, 2 * hcols + 1]
            Hh.append(np.packbits(hh, axis=1))
        for k in ("pos37", "pos38", "ref", "alt", "gsa", "omni", "minus"):
            table[k].append(d[k][dense])
        table["core"].append(z[f"core_{c}"])
        chrom_counts.append(len(dense))
        meta = json.load(open(os.path.join(CACHE, f"hgdp1kg.chr{c}.json")))
        sources.append(meta["source"]); counts[c] = meta["counts"]
        del G, H, d
    G = np.concatenate(Gs); del Gs
    T = {k: np.concatenate(v) for k, v in table.items()}
    N, n = G.shape
    core = np.where(T["core"])[0]
    M = len(core)
    log(f"dense {N:,} SNPs, core {M:,}, {n} genomes fitted, {len(held_names)} held out")
    pops = sorted({sample_info[s][0] for s in fit_names}, key=lambda p: (cont_ids.index(next(sample_info[s][1] for s in fit_names if sample_info[s][0] == p)), p))
    pop_of = np.array([pops.index(sample_info[s][0]) for s in fit_names])
    cont_of_pop = [next(sample_info[s][1] for s in fit_names if sample_info[s][0] == p) for p in pops]
    P = len(pops)
    pooled = G.mean(axis=1) / 2

    # ---------------------------------------------------------------- continental components
    estimated = {p for c in conts for p in c["estimated"]}
    pinned = np.array([-1 if pops[pop_of[i]] in estimated else cont_ids.index(cont_of_pop[pop_of[i]]) for i in range(n)])
    em_idx = core[np.linspace(0, M - 1, min(M, 30000)).astype(int)]
    Gc = G[em_idx].T.astype(np.float32)

    def start_freqs(pin):
        F0 = np.empty((K, len(em_idx)), dtype=np.float32)
        for k in range(K):
            m = pin == k
            F0[k] = Gc[m].mean(axis=0) / 2 if m.any() else Gc.mean(axis=0) / 2
        return F0

    Q, F, fit1 = supervised_fit(Gc, pinned, K, start_freqs(pinned), "continents")
    # Curation: a reference genome is released when, fitted freely, it is unlike the rest of its own
    # population: its share of its continent is below the population's median by more than 15 points
    # and by more than four robust standard deviations. Populations that sit between continents as a
    # whole are kept: that is what they are, and the components are defined by them.
    Qfree = free_fit(Gc, F, K)
    own = Qfree[np.arange(n), np.clip(pinned, 0, None)]
    released = np.zeros(n, dtype=bool)
    for p in range(P):
        m = (pop_of == p) & (pinned >= 0)
        if m.sum() >= 5:
            med = np.median(own[m])
            mad = 1.4826 * np.median(np.abs(own[m] - med))
            released |= m & (own < med - max(0.15, 4 * mad))
    curated = {}
    for i in np.where(released)[0]:
        curated[pops[pop_of[i]]] = curated.get(pops[pop_of[i]], 0) + 1
    log(f"curation: {int(released.sum())} reference genomes released: {curated}")
    if released.any():
        pinned = np.where(released, -1, pinned)
        Q, F, fit1 = supervised_fit(Gc, pinned, K, start_freqs(pinned), "continents (curated)")
    # Component frequencies at every dense SNP, proportions held fixed.
    Fd = np.zeros((N, K))
    Qf = Q.astype(np.float32)
    for s in range(0, N, 20000):
        Gd = G[s:s + 20000].T.astype(np.float32)
        f = np.full((K, Gd.shape[1]), 0.5, dtype=np.float32)
        for _ in range(200):
            Pm = np.clip(Qf @ f, 1e-6, 1 - 1e-6)
            num = f * (Qf.T @ (Gd / Pm))
            fn = np.clip(num / (num + (1 - f) * (Qf.T @ ((2 - Gd) / (1 - Pm)))), 1e-3, 1 - 1e-3)
            done = float(np.abs(fn - f).max()) < 1e-5
            f = fn
            if done:
                break
        Fd[s:s + Gd.shape[1]] = f.T
    log("dense component frequencies fitted")
    comp_alleles = (2 * Q.sum(axis=0)).round(1).tolist()
    mean_q = {pops[p]: np.round(Q[pop_of == p].mean(axis=0), 4).tolist() for p in range(P)}
    del Gc

    # ---------------------------------------------------------------- regions and populations (allele counts at the core)
    Gcore = G[core]  # M x n

    def counts_of(mask):
        return Gcore[:, mask].sum(axis=1).astype(np.int64), 2 * int(mask.sum())

    def stored(ac, an):
        """Counts as stored: the count itself when it fits a byte, else the frequency in 250ths."""
        if an <= 255:
            return ac.astype(np.uint8), an
        return np.round(ac / an * FREQ_SCALE).astype(np.uint8), FREQ_SCALE

    asj = load_asj(chroms, T, core, chrom_counts)
    tiers = {}
    for ci, c in enumerate(conts):
        tp, tr = [], []
        for p in range(P):
            if cont_of_pop[p] == c["id"]:
                ac, an = counts_of(pop_of == p)
                v, sc = stored(ac, an)
                tp.append((pops[p], v, an, sc))
        for reg in c["regions"]:
            if reg.get("frequencyOnly"):
                if asj is None:
                    log(f"WARNING: no frequencies for {reg['id']}; the region is left out")
                    continue
                ac, an_asj, filled = asj
                # A core SNP gnomAD does not report for the group takes the continent's reference frequency (counted in the metadata).
                cont_ref = (pinned >= 0) & np.isin(pop_of, [p for p in range(P) if cont_of_pop[p] == c["id"]])
                ac = np.where(np.isnan(ac), Gcore[:, cont_ref].mean(axis=1) / 2, ac)
                v = np.round(ac * FREQ_SCALE).astype(np.uint8)
                tr.append({"id": reg["id"], "label": reg["label"], "populations": [], "parent": c["id"], "level": "region", "alleles": an_asj, "scale": FREQ_SCALE, "frequencyOnly": True, "filled": filled, "values": v})
                tp.append((reg["id"], v, an_asj, FREQ_SCALE))
                continue
            m = ~released & np.isin(pop_of, [pops.index(p) for p in reg["populations"] if p in pops])
            if not m.any():
                continue
            ac, an = counts_of(m)
            v, sc = stored(ac, an)
            tr.append({"id": reg["id"], "label": reg["label"], "populations": [p for p in reg["populations"] if p in pops], "parent": c["id"], "level": "region", "alleles": an, "scale": sc, "values": v})
        tiers[c["id"]] = (tp, tr)

    # ---------------------------------------------------------------- PCA
    pc = pooled[core]
    X = ((Gcore.T.astype(np.float32)) - 2 * pc.astype(np.float32)) / np.sqrt(2 * pc * (1 - pc)).astype(np.float32)
    log(f"regions and populations counted; PCA on {n} x {M}")
    Gm = (X @ X.T).astype(np.float64)
    evals, evecs = np.linalg.eigh(Gm)
    order = np.argsort(evals)[::-1]
    evals, evecs = evals[order], evecs[:, order]
    S = np.sqrt(evals[:N_PC])
    U = evecs[:, :N_PC]
    V = (X.T @ U) / S
    scores = U * S
    anchor = pops.index(conts[0]["start"]) if conts[0]["start"] in pops else 0
    for k in range(N_PC):
        if scores[pop_of == anchor, k].mean() < 0:
            V[:, k] *= -1; scores[:, k] *= -1
    trace = float(evals.sum())
    var_explained = (evals[:N_PC] / trace).tolist()
    spikes = (evals[:N_PC] / trace * M).tolist()  # sample eigenvalues in units of the mean per-SNP variance
    rng = np.random.default_rng(20260925)
    folds = rng.permutation(n) % 5
    ratios = []
    for f in range(5):
        tr_, ho = folds != f, folds == f
        Xt = X[tr_]
        ev, ec = np.linalg.eigh((Xt @ Xt.T).astype(np.float64))
        o = np.argsort(ev)[::-1][:N_PC]
        St, Ut = np.sqrt(ev[o]), ec[:, o]
        ratios.append((X[ho] @ ((Xt.T @ Ut) / St)).std(axis=0) / (Ut * St).std(axis=0))
    shrinkage = np.mean(ratios, axis=0)
    del X

    # ---------------------------------------------------------------- write
    os.makedirs(out_dir, exist_ok=True)
    autos = [str(c) for c in chroms]
    pos = T["pos37"].astype(np.int64)
    pos_delta = np.zeros(N, dtype=np.uint32)
    at = 0
    for cnt in chrom_counts:
        pos_delta[at] = pos[at]
        pos_delta[at + 1:at + cnt] = np.diff(pos[at:at + cnt])
        at += cnt
    alleles = ((T["ref"].astype(np.uint8) << 4) | T["alt"].astype(np.uint8)).astype(np.uint8)
    scale = np.abs(V).max(axis=0) / 32767
    comp_header = [{"id": c["id"], "label": c["label"], "level": "continent", "alleles": comp_alleles[k], "scale": FREQ_SCALE,
                    "populations": [pops[p] for p in range(P) if Q[pop_of == p, k].mean() > 0.8]} for k, c in enumerate(conts)]
    tier_meta = []
    for c in conts:
        tp, tr = tiers[c["id"]]
        fname = f"panel.{c['id']}.bin.gz"
        info = write_lngp(os.path.join(out_dir, fname), {
            "version": 2, "kind": "tier", "continent": c["id"], "coreSnp": int(M),
            "populations": [t[0] for t in tp], "popAlleles": [t[2] for t in tp], "popScale": [t[3] for t in tp],
            "components": [{k: v for k, v in r.items() if k not in ("values", "filled")} for r in tr],
        }, [("popFreq", "u8", np.stack([t[1] for t in tp], axis=1).reshape(-1) if tp else np.zeros(0, dtype=np.uint8)),
            ("compFreq", "u8", np.stack([r["values"] for r in tr], axis=1).reshape(-1) if tr else np.zeros(0, dtype=np.uint8))])
        tier_meta.append({"continent": c["id"], "file": fname, **info, "populations": [t[0] for t in tp], "regions": [{"id": r["id"], "label": r["label"], "populations": r["populations"], "alleles": r["alleles"], **({"frequencyOnly": True, "filledFromContinent": r["filled"]} if r.get("frequencyOnly") else {})} for r in tr]})
    core_info = write_lngp(os.path.join(out_dir, "panel.bin.gz"), {
        "version": 2, "kind": "core", "build": 37, "chromosomes": autos, "chromCounts": chrom_counts, "nSnp": int(N), "freqScale": FREQ_SCALE,
        "populations": [], "popAlleles": [], "popScale": [], "components": comp_header, "core": {"nSnp": int(M)}, "chips": ["GSA", "OmniExpress"],
        "pca": {"nPc": N_PC, "loadingScale": scale.tolist(), "shrinkage": shrinkage.tolist(), "eigenvalues": evals[:N_PC].tolist(), "spikes": spikes, "gamma": M / n},
        "tiers": [{"continent": t["continent"], "file": t["file"], "bytes": t["bytes"], "sha256": t["sha256"]} for t in tier_meta],
    }, [("posDelta", "u32", pos_delta), ("alleles", "u8", alleles), ("compFreq", "u8", np.round(Fd * FREQ_SCALE).astype(np.uint8).reshape(-1)),
        ("chipMask", "u8", (T["gsa"].astype(np.uint8) | (T["omni"].astype(np.uint8) << 1))), ("pos38", "u32", T["pos38"].astype(np.uint32)),
        ("coreIndexDelta", "u32", np.diff(np.concatenate([[0], core])).astype(np.uint32)), ("popFreq", "u8", np.zeros(0, dtype=np.uint8)),
        ("pooledFreq", "u16", np.round(pc * 65535).astype(np.uint16)), ("loadings", "i16", np.round(V / scale).astype(np.int16).reshape(-1))])

    # Size budget: the first view, and the heaviest pair of tiers a person could need with it.
    tier_sizes = sorted((t["bytes"] for t in tier_meta), reverse=True)
    path_bytes = core_info["bytes"] + sum(tier_sizes[:2])
    full = len(chroms) == 22
    log(f"sizes: core {core_info['bytes']:,}; core + two largest tiers {path_bytes:,}")
    if full and (core_info["bytes"] > CORE_BUDGET or path_bytes > PATH_BUDGET):
        raise SystemExit(f"size budget exceeded: core {core_info['bytes']:,} (limit {CORE_BUDGET:,.0f}), heaviest path {path_bytes:,} (limit {PATH_BUDGET:,.0f}). Lower CORE_MAX or DENSE_MAX.")

    chips_meta = json.load(open(os.path.join(CACHE, "chip-snps.json")))
    lift_meta = json.load(open(os.path.join(CACHE, "chip-snps.b38.json")))
    n_regions = sum(len(t["regions"]) for t in tier_meta)
    json.dump({
        "id": "panel.hgdp1kg", "title": "Reference panel: gnomAD HGDP+1KG on consumer-chip SNPs", "version": 2,
        "file": "panel.bin.gz", **core_info, "tiers": tier_meta, "calibration": "calibration.json",
        "holdout": {"genomes": len(held_names), "share": 0.2, "seed": HOLDOUT_SEED} if holdout else None,
        "provenance": {
            "genotypes": {"citation": "Koenig Z, et al. (2024). A harmonized public resource of deeply sequenced diverse human genomes. Genome Research 34:796-809.",
                          "terms": "gnomAD data are released under CC0; attribution requested; no attempt to re-identify participants.",
                          "retrieved": sources[0]["retrieved"] if sources else None, "sources": sources, "countsByChromosome": counts},
            "ashkenazi": asj_meta(chroms),
            "chips": chips_meta, "liftover": lift_meta,
            "script": "scripts/data/05-panel.py", "generated": date.today().isoformat(), "runtimeSeconds": round(time.time() - t0),
        },
        "qc": {**sel_stats, "dense": int(N), "core": int(M), "genomes": int(n), "ldPrune": {"r2": 0.2, "windowKb": 500, "lastKept": 20, "minMaf": 0.05},
               "chipCoverage": {"GSA": {"dense": int(T["gsa"].sum()), "core": int(T["gsa"][core].sum())}, "OmniExpress": {"dense": int(T["omni"].sum()), "core": int(T["omni"][core].sum())}}},
        "components": [{"id": c["id"], "label": c["label"], "reference": [p for p in pops if cont_of_pop[pops.index(p)] == c["id"] and p not in estimated],
                        "estimated": [p for p in c["estimated"] if p in pops], "initialisedFrom": c["start"], "alleles": comp_alleles[k], "populations": comp_header[k]["populations"]} for k, c in enumerate(conts)],
        "curation": {"rule": "a reference genome is released from the reference set when, fitted freely, its share of its own continent is 15 points below its population's median or under half", "released": curated},
        "admixture": {"mode": "supervised", "estimated": sorted(estimated & set(pops)), **fit1, "meanProportions": mean_q},
        "pca": {"varianceExplained": var_explained, "shrinkage": shrinkage.tolist(), "spikes": spikes, "gamma": M / n, "folds": 5},
        "similarityValidation": {},
        "notes": {
            "referenceName": "gnomAD HGDP+1KG",
            "genomes": int(n),
            "components": f"Each thin column is one reference genome, coloured by its share of each of the {K} continental components. Genomes of the reference populations define their continent's component, so they are single-coloured by construction; the admixed populations ({', '.join(sorted(estimated & set(pops)))}) were estimated. The Indigenous American component is defined by HGDP's unadmixed genomes (Karitiana, Surui, Maya, Pima, Colombian). Within the continents, {n_regions} regional reference groups are fitted separately; a region is shown only where validation supports it.",
            "limitations": [
                "The Ashkenazi Jewish reference exists only as allele frequencies (gnomAD); other Jewish populations, Arabia outside the Bedouin, the Caucasus beyond the Adygei, Central Asia beyond Pakistan and Xinjiang, Polynesia and Micronesia, and Indigenous North America beyond Mexico have no reference. Ancestry from those places is described in terms of the populations that are present.",
                "Some reference groups are small (San 6, Surui 4, Colombian 7): their frequencies carry that uncertainty into every interval.",
                "Several 1000 Genomes populations were sampled away from their ancestral region (Utah, Houston, Los Angeles, the south-western US, Barbados, the UK). The map marks them with hollow points.",
            ],
        },
    }, open(os.path.join(out_dir, "panel.json"), "w"), indent=1)
    json.dump({
        "id": "reference-samples.hgdp1kg", "populations": pops, "components": cont_ids,
        "note": "One row per reference genome: population index, continental component proportions (x1000) and PC scores (x1000). Sample identifiers are omitted.",
        "pop": pop_of.tolist(), "q": np.round(Q * 1000).astype(int).tolist(), "pcs": np.round(scores * 1000).astype(int).tolist(),
    }, open(os.path.join(out_dir, "reference-samples.json"), "w"), separators=(",", ":"))
    if holdout:
        region_of = {p: r["id"] for c in conts for r in c["regions"] for p in r["populations"]}
        # The held-out genomes for the validation harness (Node): haplotype bits, one row per dense SNP.
        hap = np.concatenate(Hh) if Hh else np.zeros((N, 0), dtype=np.uint8)
        hap.tofile(os.path.join(out_dir, "heldout.bin"))
        json.dump({"snps": int(N), "genomes": len(held_names), "rowBytes": int(hap.shape[1]),
                   "population": [sample_info[s][0] for s in held_names], "continent": [sample_info[s][1] for s in held_names],
                   "region": [region_of.get(sample_info[s][0], "") for s in held_names],
                   "admixed": [sample_info[s][0] in estimated for s in held_names]},
                  open(os.path.join(out_dir, "heldout.json"), "w"))
    log(f"done in {round(time.time() - t0)} s")


def load_asj(chroms, T, core, chrom_counts):
    """gnomAD's Ashkenazi ALT frequency at each core SNP (step 3b), or None. A SNP gnomAD does not report is NaN and counted."""
    rows, an = {}, []
    for c in chroms:
        path = os.path.join(CACHE, f"asj.chr{c}.tsv")
        if not os.path.exists(path):
            return None
        for line in open(path):
            p37, ac, n = line.split()
            if int(n) > 0:
                rows[(str(c), int(p37))] = int(ac) / int(n)
                an.append(int(n))
    if not rows:
        return None
    chrom_idx = np.repeat(np.arange(len(chroms)), chrom_counts)
    out = np.full(len(core), np.nan)
    for k, i in enumerate(core):
        out[k] = rows.get((str(chroms[chrom_idx[i]]), int(T["pos37"][i])), np.nan)
    return out, int(np.median(an)), int(np.isnan(out).sum())


def asj_meta(chroms):
    path = os.path.join(CACHE, f"asj.chr{chroms[0]}.json")
    if not os.path.exists(path):
        return None
    metas = [json.load(open(os.path.join(CACHE, f"asj.chr{c}.json"))) for c in chroms if os.path.exists(os.path.join(CACHE, f"asj.chr{c}.json"))]
    return {"citation": metas[0]["citation"], "terms": metas[0]["terms"], "sources": [m["source"] for m in metas], "counts": {m["chrom"]: m["counts"] for m in metas}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True, choices=["select", "build"])
    ap.add_argument("--holdout", action="store_true")
    ap.add_argument("--chroms", default=",".join(str(c) for c in range(1, 23)))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    chroms = args.chroms.split(",")
    sample_info = load_samples()
    # The held-out fifth of each population (none from populations under ten genomes). The SNPs are
    # always chosen without them, and both builds use that one selection, so validation tests the
    # SNP set that ships and no held-out genome had a say in it.
    rng = np.random.default_rng(HOLDOUT_SEED)
    by_pop = {}
    for s, (pop, _) in sorted(sample_info.items()):
        by_pop.setdefault(pop, []).append(s)
    held = set()
    for pop, ss in sorted(by_pop.items()):
        if len(ss) >= 10:
            held |= set(rng.choice(ss, size=int(round(0.2 * len(ss))), replace=False).tolist())
    if args.stage == "select":
        sel, stats = select(chroms, sample_info, lambda s: s in sample_info and s not in held)
        write_selection(sel, stats, "")
        log(f"selection: {stats}")
    else:
        fit = (lambda s: s in sample_info and s not in held) if args.holdout else (lambda s: s in sample_info)
        heldf = (lambda s: s in held) if args.holdout else (lambda s: False)
        out = args.out or (os.path.join(CACHE, "validation") if args.holdout else REF)
        build(chroms, sample_info, fit, heldf, out, "", args.holdout)


if __name__ == "__main__":
    main()
