#!/usr/bin/env python3
"""
Step 5. The reference panel: frequencies, continental components, PCA.

Inputs (from steps 1-4): 1000g-counts.tsv, the per-chromosome dosage matrices,
1000g-samples.tsv, genetic-map.grch37.json, populations.json.

1. QC. Autosomal biallelic SNPs on both chip families, never A/T or C/G (so
   strand is never ambiguous), called in every sample, pooled minor allele
   frequency >= 1%. These form the dense layer.
2. Core. From SNPs with pooled MAF >= 5%, a greedy LD prune: walking each
   chromosome in order, a SNP is kept when its r^2 with each of the last 20
   kept SNPs within 500 kb is below 0.2 across the 2,504 genomes.
3. PCA on the core, genotypes standardised by the pooled frequency
   ((g - 2p) / sqrt(2p(1-p))), from the eigendecomposition of the
   sample-by-sample matrix. Shrinkage of projected (out-of-sample) genomes is
   measured by five-fold hold-out: the ratio of the spread of held-out
   projections to the spread of in-sample scores, per PC.
4. Continental components, by ADMIXTURE's likelihood in its supervised mode:
   the genomes of the 20 African, European, East Asian and South Asian
   populations are fixed as wholly their continent's component, and the
   proportions of the six admixed American, African-American and
   African-Caribbean populations are estimated, together with all five
   components' frequencies. The Indigenous American component has no
   unadmixed reference in 1000 Genomes, so it is learned from those six
   (started from the Peruvian frequencies). Unsupervised, the fit sits on a
   nearly flat ridge at K = 5 and gives every European genome about 6%
   "Indigenous American" and 11% "South Asian", which would be read as
   ancestry. EM with SQUAREM acceleration on 30,000 core SNPs, until a cycle
   improves the log-likelihood by less than one part in 10^7 or no
   proportion moves by more than 0.0001; the component frequencies at every
   dense SNP are then fitted with the proportions held fixed.
5. Validation, for the Evidence page: mean component proportions per
   population, and a leave-one-out check of the similarity ranking (each
   genome ranked against population frequencies recomputed without it).

Outputs: data/reference/panel.1000g.bin.gz (LNGP), panel.1000g.json
(provenance, QC counts, validation) and reference-samples.json (each
reference genome's population, component proportions and PC scores).

Requires: numpy.
"""
import gzip, hashlib, json, os, struct, sys, time
from datetime import date

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LINEAGE_CACHE", os.path.join(ROOT, "data", ".cache"))
REF = os.path.join(ROOT, "data", "reference")
AUTOSOMES = [str(c) for c in range(1, 23)]
BASES = "ACGT"
FREQ_SCALE = 250
N_PC = 6
# Each component's reference populations are fixed as wholly that component (ADMIXTURE's
# supervised mode). The admixed populations are estimated, and NAT is learned from them.
COMPONENTS = [
    {"id": "AFR", "label": "Sub-Saharan African", "start": "YRI", "reference": ["YRI", "LWK", "GWD", "MSL", "ESN"]},
    {"id": "EUR", "label": "European", "start": "CEU", "reference": ["CEU", "TSI", "FIN", "GBR", "IBS"]},
    {"id": "EAS", "label": "East Asian", "start": "CHB", "reference": ["CHB", "JPT", "CHS", "CDX", "KHV"]},
    {"id": "SAS", "label": "South Asian", "start": "GIH", "reference": ["GIH", "PJL", "BEB", "STU", "ITU"]},
    {"id": "NAT", "label": "Indigenous American", "start": "PEL", "reference": []},
]
ESTIMATED = ["MXL", "PUR", "CLM", "PEL", "ASW", "ACB"]


def log(msg):
    sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    sys.stderr.flush()


def load():
    samples = [l.rstrip("\n").split("\t") for l in open(os.path.join(CACHE, "1000g-samples.tsv"))]
    n = len(samples)
    rows = {c: [] for c in AUTOSOMES}
    with open(os.path.join(CACHE, "1000g-counts.tsv")) as f:
        header = next(f).lstrip("#").rstrip("\n").split("\t")
        pops = [h[:-3] for h in header[6::2]]
        for line in f:
            p = line.rstrip("\n").split("\t")
            if p[1] in rows:
                rows[p[1]].append(p)
    return samples, n, pops, rows


def main():
    t_start = time.time()
    samples, n, pops, rows = load()
    pop_of = np.array([pops.index(s[1]) for s in samples])
    P = len(pops)
    genetic_map = json.load(open(os.path.join(REF, "genetic-map.grch37.json")))

    # ---------------------------------------------------------------- QC
    dense = []   # (chrom, pos, rsid, ref, alt, ac[P], an[P], dosage row)
    qc = {"input": 0, "palindromic": 0, "incomplete": 0, "rare": 0, "kept": 0}
    for c in AUTOSOMES:
        rows_c = rows[c]
        dos = np.fromfile(os.path.join(CACHE, f"1000g-dosage.chr{c}.u8"), dtype=np.uint8).reshape(len(rows_c), n)
        for r, d in zip(rows_c, dos):
            qc["input"] += 1
            ref, alt = r[3], r[4]
            if {ref, alt} in ({"A", "T"}, {"C", "G"}):
                qc["palindromic"] += 1
                continue
            ac = np.array(r[6::2], dtype=np.int64)
            an = np.array(r[7::2], dtype=np.int64)
            if (d == 255).any() or (an == 0).any():
                qc["incomplete"] += 1
                continue
            p = ac.sum() / an.sum()
            if p < 0.01 or p > 0.99:
                qc["rare"] += 1
                continue
            dense.append((c, int(r[2]), r[0], ref, alt, ac, an, d))
        log(f"chr{c}: {len(dense)} dense SNPs so far")
    qc["kept"] = len(dense)
    N = len(dense)

    # ---------------------------------------------------------------- core: LD prune
    pooled = np.array([e[5].sum() / e[6].sum() for e in dense])
    core = []
    by_chrom = {}
    for i, e in enumerate(dense):
        by_chrom.setdefault(e[0], []).append(i)
    for c in AUTOSOMES:
        kept = []  # (index, pos, standardised vector)
        for i in by_chrom.get(c, []):
            p = pooled[i]
            if p < 0.05 or p > 0.95:
                continue
            x = (dense[i][7].astype(np.float32) - 2 * p) / np.sqrt(2 * p * (1 - p))
            ok = True
            for j, pos_j, xj in kept[-20:]:
                if dense[i][1] - pos_j > 500_000:
                    continue
                r = float(np.dot(x, xj)) / n
                if r * r >= 0.2:
                    ok = False
                    break
            if ok:
                kept.append((i, dense[i][1], x))
        core.extend(k[0] for k in kept)
        log(f"chr{c}: core {len(core)}")
    core = np.array(core)
    M = len(core)

    # ---------------------------------------------------------------- PCA
    pc = pooled[core]
    X = np.empty((n, M), dtype=np.float32)
    for k, i in enumerate(core):
        X[:, k] = (dense[i][7] - 2 * pc[k]) / np.sqrt(2 * pc[k] * (1 - pc[k]))
    log(f"PCA on {n} x {M}")
    G = (X @ X.T).astype(np.float64)
    evals, evecs = np.linalg.eigh(G)
    order = np.argsort(evals)[::-1]
    evals, evecs = evals[order], evecs[:, order]
    S = np.sqrt(evals[:N_PC])
    U = evecs[:, :N_PC]
    V = (X.T @ U) / S            # M x N_PC loadings (orthonormal columns)
    scores = U * S               # n x N_PC in-sample scores
    # Orient each PC so that the component starting populations read left-to-right consistently.
    for k in range(N_PC):
        if scores[pop_of == pops.index("YRI"), k].mean() < 0:
            V[:, k] *= -1
            scores[:, k] *= -1
    var_explained = (evals[:N_PC] / evals.sum()).tolist()

    # Shrinkage by five-fold hold-out.
    rng = np.random.default_rng(20260925)
    folds = rng.permutation(n) % 5
    ratios = []
    for f in range(5):
        tr, ho = folds != f, folds == f
        Xt = X[tr]
        ev, ec = np.linalg.eigh((Xt @ Xt.T).astype(np.float64))
        o = np.argsort(ev)[::-1][:N_PC]
        St, Ut = np.sqrt(ev[o]), ec[:, o]
        Vt = (Xt.T @ Ut) / St
        proj = X[ho] @ Vt
        insample = Ut * St
        ratios.append(proj.std(axis=0) / insample.std(axis=0))
        log(f"fold {f}: shrinkage {np.round(ratios[-1], 3)}")
    shrinkage = np.mean(ratios, axis=0)

    # ---------------------------------------------------------------- components (supervised EM)
    # The EM runs on up to 30,000 evenly spaced core SNPs (plenty for five continental
    # components) in float32 to keep memory near 1 GB; sums are taken in float64.
    K = len(COMPONENTS)
    em_idx = core[np.linspace(0, M - 1, min(M, 30000)).astype(int)]
    Me = len(em_idx)
    Gc = np.stack([dense[i][7] for i in em_idx], axis=1).astype(np.float32)  # n x Me
    # Reference genomes are pinned to their component; the admixed populations start uniform.
    fixed_pop = {pops.index(code): k for k, comp in enumerate(COMPONENTS) for code in comp["reference"]}
    assert sorted(pops[p] for p in range(P) if p not in fixed_pop) == sorted(ESTIMATED), "every population is either a reference or estimated"
    fixed = np.array([pop_of[i] in fixed_pop for i in range(n)])
    Q = np.full((n, K), 1.0 / K, dtype=np.float32)
    for i in np.where(fixed)[0]:
        Q[i] = 0
        Q[i, fixed_pop[pop_of[i]]] = 1
    # Start each component from its reference populations' pooled frequencies (NAT: from PEL).
    def pooled(codes, i):
        ac = sum(dense[i][5][pops.index(c)] for c in codes)
        return ac / sum(dense[i][6][pops.index(c)] for c in codes)
    F = np.array([[pooled(comp["reference"] or [comp["start"]], i) for i in em_idx] for comp in COMPONENTS], dtype=np.float32)
    F = np.clip(F, 1e-3, 1 - 1e-3)

    def em_step(Q, F):
        """One EM update of ADMIXTURE's likelihood; returns the new Q, F and the log-likelihood at the input."""
        Pm = np.clip(Q @ F, 1e-6, 1 - 1e-6)
        A = Gc / Pm
        B = (2 - Gc) / (1 - Pm)
        ll = float((Gc * np.log(Pm) + (2 - Gc) * np.log(1 - Pm)).sum(dtype=np.float64))
        Qn = Q * (A @ F.T + B @ (1 - F).T) / (2 * Me)
        Qn = Qn / Qn.sum(axis=1, keepdims=True)
        Qn[fixed] = Q[fixed]  # supervised: the reference genomes keep their component
        num = F * (Q.T @ A)
        Fn = np.clip(num / (num + (1 - F) * (Q.T @ B)), 1e-3, 1 - 1e-3).astype(np.float32)
        return Qn.astype(np.float32), Fn, ll

    # SQUAREM (Varadhan & Roland 2008, scheme S3): extrapolate along two EM steps, project back
    # into the parameter space, then take one stabilising EM step. If the extrapolated point
    # has a lower likelihood than one plain step reached, keep the plain steps instead, so the
    # likelihood never decreases.
    log(f"EM (supervised, SQUAREM-accelerated) for continental components on {Me} SNPs; {int((~fixed).sum())} genomes estimated")
    prev = -np.inf
    Q_prev = Q
    em_steps = 0
    for it in range(400):
        Q1, F1, ll0 = em_step(Q, F)
        Q2, F2, ll1 = em_step(Q1, F1)
        rQ, rF = Q1 - Q, F1 - F
        vQ, vF = (Q2 - Q1) - rQ, (F2 - F1) - rF
        rn = float(np.sqrt((rQ.astype(np.float64) ** 2).sum() + (rF.astype(np.float64) ** 2).sum()))
        vn = float(np.sqrt((vQ.astype(np.float64) ** 2).sum() + (vF.astype(np.float64) ** 2).sum()))
        alpha = min(-1.0, -rn / vn) if vn > 0 else -1.0
        Qp = np.clip(Q - 2 * alpha * rQ + alpha * alpha * vQ, 1e-6, None)
        Qp = (Qp / Qp.sum(axis=1, keepdims=True)).astype(np.float32)
        Fp = np.clip(F - 2 * alpha * rF + alpha * alpha * vF, 1e-3, 1 - 1e-3).astype(np.float32)
        Q3, F3, llp = em_step(Qp, Fp)
        em_steps += 3
        if llp >= ll1:
            Q, F, ll = Q3, F3, llp
        else:
            Q, F, ll = Q2, F2, ll1
        dq = float(np.abs(Q - Q_prev).max())
        log(f"  cycle {it}: log-likelihood {ll:.1f} (step length {-alpha:.1f}, largest change in Q {dq:.1e})")
        # Stop when a cycle gains less than one part in 10^7 of the log-likelihood, or when no
        # genome's proportions move by more than 0.0001 (Q is published to three decimals).
        if abs(ll - prev) < 1e-7 * abs(ll) or dq < 1e-4:
            break
        prev = ll
        Q_prev = Q
    em_iterations = em_steps
    em_ll = ll
    em_last_dq = dq
    Q = Q.astype(np.float64)
    # Component frequencies at every dense SNP with Q fixed.
    Fd = np.zeros((N, K))
    for s in range(0, N, 20000):
        idx = range(s, min(N, s + 20000))
        Gd = np.stack([dense[i][7] for i in idx], axis=1).astype(np.float32)
        f = np.full((K, Gd.shape[1]), 0.5, dtype=np.float32)
        Qf = Q.astype(np.float32)
        for _ in range(60):
            Pm = np.clip(Qf @ f, 1e-6, 1 - 1e-6)
            A = Gd / Pm
            B = (2 - Gd) / (1 - Pm)
            num = f * (Qf.T @ A)
            f = np.clip(num / (num + (1 - f) * (Qf.T @ B)), 1e-3, 1 - 1e-3)
        Fd[s:s + Gd.shape[1]] = f.T
        log(f"  dense component frequencies {min(N, s + 20000)}/{N}")

    mean_q = {pops[p]: np.round(Q[pop_of == p].mean(axis=0), 4).tolist() for p in range(P)}
    for k, comp in enumerate(COMPONENTS):
        comp["populations"] = [pops[p] for p in range(P) if Q[pop_of == p, k].mean() > 0.8]

    # ---------------------------------------------------------------- similarity validation (leave-one-out)
    ac_core = np.stack([dense[i][5] for i in core], axis=1).astype(np.float64)  # P x M
    an_core = np.stack([dense[i][6] for i in core], axis=1).astype(np.float64)
    lo = 1 / (2 * FREQ_SCALE)
    freq_q = np.round(ac_core / an_core * FREQ_SCALE) / FREQ_SCALE
    fq = np.clip(freq_q, lo, 1 - lo)
    Gc = np.stack([dense[i][7] for i in core], axis=1).astype(np.float32)  # n x M, all core SNPs
    LL = (Gc @ np.log(fq).T.astype(np.float32) + (2 - Gc) @ np.log(1 - fq).T.astype(np.float32)).astype(np.float64)   # n x P
    for i in range(n):
        p = pop_of[i]
        # Leave this genome out of its own population's frequencies, at the stored precision.
        f_own = np.clip(np.round((ac_core[p] - Gc[i]) / (an_core[p] - 2) * FREQ_SCALE) / FREQ_SCALE, lo, 1 - lo)
        LL[i, p] = float(Gc[i].astype(np.float64) @ np.log(f_own) + (2 - Gc[i].astype(np.float64)) @ np.log(1 - f_own))
    top = LL.argmax(axis=1)
    superpop = {p["code"]: p["superpopulation"] for p in json.load(open(os.path.join(REF, "populations.json")))["populations"]}
    similarity_validation = {
        pops[p]: {
            "samples": int((pop_of == p).sum()),
            "ownFirst": round(float((top[pop_of == p] == p).mean()), 4),
            "sameContinentFirst": round(float(np.mean([superpop[pops[t]] == superpop[pops[p]] for t in top[pop_of == p]])), 4),
            "mostCommonOther": pops[int(np.bincount(top[(pop_of == p) & (top != p)], minlength=P).argmax())] if ((pop_of == p) & (top != p)).any() else None,
        } for p in range(P)
    }

    # ---------------------------------------------------------------- write LNGP
    chrom_counts = [len(by_chrom.get(c, [])) for c in AUTOSOMES]
    pos_delta = np.zeros(N, dtype=np.uint32)
    prev_chrom = None
    for i, e in enumerate(dense):
        pos_delta[i] = e[1] if e[0] != prev_chrom else e[1] - dense[i - 1][1]
        prev_chrom = e[0]
    alleles = np.array([(BASES.index(e[3]) << 4) | BASES.index(e[4]) for e in dense], dtype=np.uint8)
    comp_freq = np.round(Fd * FREQ_SCALE).astype(np.uint8).reshape(-1)
    core_delta = np.diff(np.concatenate([[0], core])).astype(np.uint32)
    pop_freq = np.round(ac_core / an_core * FREQ_SCALE).T.astype(np.uint8).reshape(-1)  # core x P
    pooled_u16 = np.round(pc * 65535).astype(np.uint16)
    scale = np.abs(V).max(axis=0) / 32767
    load_i16 = np.round(V / scale).astype(np.int16).reshape(-1)  # core x N_PC
    blocks = [("posDelta", "u32", pos_delta), ("alleles", "u8", alleles), ("compFreq", "u8", comp_freq),
              ("coreIndexDelta", "u32", core_delta), ("popFreq", "u8", pop_freq), ("pooledFreq", "u16", pooled_u16), ("loadings", "i16", load_i16)]
    header = {
        "version": 1, "build": 37, "chromosomes": AUTOSOMES, "chromCounts": chrom_counts, "nSnp": N,
        "freqScale": FREQ_SCALE, "populations": pops,
        "components": [{"id": c["id"], "label": c["label"], "populations": c["populations"]} for c in COMPONENTS],
        "core": {"nSnp": M},
        "pca": {"nPc": N_PC, "loadingScale": scale.tolist(), "shrinkage": shrinkage.tolist(), "eigenvalues": evals[:N_PC].tolist()},
        "blocks": [{"name": nm, "type": t, "length": int(a.size)} for nm, t, a in blocks],
    }
    hb = json.dumps(header, separators=(",", ":")).encode()
    out = bytearray(b"LNGP" + struct.pack("<I", len(hb)) + hb)
    out += b"\0" * ((-len(out)) % 4)
    for _, _, a in blocks:
        b = a.astype(a.dtype.newbyteorder("<")).tobytes()
        out += b + b"\0" * ((-len(b)) % 4)
    raw = bytes(out)
    gz = gzip.compress(raw, 9, mtime=0)
    with open(os.path.join(REF, "panel.1000g.bin.gz"), "wb") as f:
        f.write(gz)
    log(f"panel: {len(raw):,} bytes raw, {len(gz):,} gzipped")

    meta_path = os.path.join(CACHE, "1000g-counts.json")
    if os.path.exists(meta_path):
        counts_meta = json.load(open(meta_path))
    else:
        # Step 3 writes its source list when it finishes (after chromosome X, which this step does not use).
        log("WARNING: 1000g-counts.json not written yet; provenance of the genotype files is incomplete. Rerun this step after step 3 finishes.")
        counts_meta = {"citation": "The 1000 Genomes Project Consortium (2015). A global reference for human genetic variation. Nature 526:68-74.", "panel": {}, "sources": [], "retrieved": date.today().isoformat()}
    chips_meta = json.load(open(os.path.join(CACHE, "chip-snps.json")))
    json.dump({
        "id": "panel.1000g",
        "title": "Reference panel: 1000 Genomes phase 3 on consumer-chip SNPs",
        "file": "panel.1000g.bin.gz",
        "sha256": hashlib.sha256(gz).hexdigest(),
        "bytes": len(gz),
        "provenance": {
            "genotypes": {"citation": counts_meta["citation"], "panel": counts_meta["panel"], "sources": counts_meta["sources"], "retrieved": counts_meta["retrieved"]},
            "chips": chips_meta,
            "script": "scripts/data/05-panel.py",
            "generated": date.today().isoformat(),
            "runtimeSeconds": round(time.time() - t_start),
        },
        "qc": {**qc, "dense": N, "core": M, "ldPrune": {"r2": 0.2, "windowKb": 500, "lastKept": 20, "minMaf": 0.05}},
        "components": [{"id": c["id"], "label": c["label"], "reference": c["reference"], "initialisedFrom": c["start"], "populations": c["populations"]} for c in COMPONENTS],
        "admixture": {"mode": "supervised", "estimated": ESTIMATED, "iterations": em_iterations, "snps": int(Me), "logLikelihood": em_ll, "stop": {"relativeLogLikelihood": 1e-7, "maxProportionChange": 1e-4}, "lastProportionChange": em_last_dq, "meanProportions": mean_q},
        "pca": {"varianceExplained": var_explained, "shrinkage": shrinkage.tolist(), "folds": 5},
        "similarityValidation": similarity_validation,
    }, open(os.path.join(REF, "panel.1000g.json"), "w"), indent=1)
    json.dump({
        "id": "reference-samples.1000g",
        "populations": pops,
        "components": [c["id"] for c in COMPONENTS],
        "note": "One row per phase 3 genome: population index, continental component proportions (x1000) and PC scores (x1000). Sample identifiers are omitted.",
        "pop": pop_of.tolist(),
        "q": np.round(Q * 1000).astype(int).tolist(),
        "pcs": np.round(scores * 1000).astype(int).tolist(),
    }, open(os.path.join(REF, "reference-samples.json"), "w"), separators=(",", ":"))
    log("done")


if __name__ == "__main__":
    main()
