"""Deney: model eğitimi + üç yöntemin karşılaştırılması.

Kullanım:
    python -m sim.experiment --seeds 10 --scenarios baz homojen yuksek_degiskenlik belirsiz_yol
"""
from __future__ import annotations

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from .engine import ROUND_WAIT, run_day
from .models import get_model
from .world import SCENARIOS, SERVICES, make_requests, make_workers

POLICIES = ["en_yakin", "en_erken", "model"]
EXTRA_POLICIES = [p for p in __import__("os").environ.get("EK_YONTEM", "").split(",") if p]  # ör. kahin
HIST_DAYS, TRAIN_DAYS, TEST_DAYS = 12, 12, 10


def gini(x) -> float:
    x = np.sort(np.asarray(x, dtype=float))
    if x.sum() == 0:
        return 0.0
    n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1).dot(x) / (n * x.sum()))


def build_history(logs: list) -> dict:
    """Çalışan başına geçmiş bildirimlerden yanıt istatistikleri."""
    agg = defaultdict(lambda: {"n": 0, "off": 0, "fast": 0, "pn": 0, "poff": 0, "pm": []})
    for _, _, wid, off, t, peak in logs:
        a = agg[wid]
        a["n"] += 1
        a["pn"] += peak
        if off is not None:
            a["off"] += 1
            a["poff"] += peak
            a["fast"] += int(off.t - t <= ROUND_WAIT)
    hist = {}
    for wid, a in agg.items():
        # az veride 0.5'e doğru büzülme (Laplace)
        hist[wid] = {
            "n": a["n"], "off": a["off"], "fast": a["fast"], "pn": a["pn"], "poff": a["poff"],
            "resp_rate": (a["off"] + 1) / (a["n"] + 2),
            "fast_rate": (a["fast"] + 1) / (a["n"] + 2),
            "peak_resp_rate": (a["poff"] + 1) / (a["pn"] + 2),
        }
    return hist


def run_seed(scn: str, seed: int, n_train_days=(HIST_DAYS, TRAIN_DAYS), n_test=TEST_DAYS, model_name: str = "gbm_v1"):
    sc = SCENARIOS[scn]
    rng = np.random.default_rng([seed, 1])
    workers = make_workers(sc, rng)
    day = 0

    def new_day():
        nonlocal day
        day += 1
        r = np.random.default_rng([seed, day, 2])
        for w in workers:
            w.reset_day(r)
        return make_requests(sc, r)

    # 1) Geçmiş toplama (rastgele bildirim; keşif verisi)
    logs, tvis = [], []
    for _ in range(n_train_days[0]):
        _r = run_day(sc, workers, new_day(), "rastgele", seed, day, log=True)
        logs += _r.log; tvis += _r.visits
    hist = build_history(logs)
    for w in workers:
        hist.setdefault(w.id, {"resp_rate": 0.5, "fast_rate": 0.5, "peak_resp_rate": 0.5})
    # ücret geçmişi: çalışanın tekliflerinin taban ücrete oranı
    _price_hist(hist, logs, workers)

    # 2) Eğitim verisi
    train = []
    for _ in range(n_train_days[1]):
        _r = run_day(sc, workers, new_day(), "rastgele", seed, day, hist=hist, log=True)
        train += _r.log; tvis += _r.visits
    X = np.array([f for f, *_ in train])
    y = np.array([l for _, l, *_ in train])
    model = get_model(model_name)(X, y, seed)

    # Test için geçmiş: tüm eğitim günleri
    all_logs = logs + train
    hist = build_history(all_logs)
    for w in workers:
        hist.setdefault(w.id, {"resp_rate": 0.5, "fast_rate": 0.5, "peak_resp_rate": 0.5})
    _price_hist(hist, all_logs, workers)
    _late_hist(hist, tvis, workers)

    # 3) Test günleri: aynı talepler ve takvimlerle üç yöntem
    ALL = POLICIES + EXTRA_POLICIES
    agg = {p: defaultdict(float) for p in ALL}
    dist = {p: defaultdict(lambda: [0, 0, 0]) for p in ALL}
    visits = {p: [] for p in ALL}  # (gün, çalışan, ücret, bütçe, yol, hizmet, zamanında)
    waits = {p: [] for p in ALL}
    notif = {p: defaultdict(int) for p in ALL}
    test_logs = []
    for _ in range(n_test):
        reqs = new_day()
        for p in POLICIES + EXTRA_POLICIES:
            res = run_day(sc, workers, reqs, p, seed, day, hist=hist, model=model, log=(p == "model"))
            a = agg[p]
            a["n"] += res.n_requests
            a["fit5"] += res.fit_within_5
            a["accepted"] += res.accepted
            a["on_time"] += res.on_time
            a["notif"] += res.notifications
            a["over_budget"] += res.over_budget_accepted
            visits[p] += [(day,) + v for v in res.visits]
            waits[p] += res.first_fit_wait
            for d, (n_, f_, o_) in res.by_district.items():
                dd = dist[p][d]; dd[0] += n_; dd[1] += f_; dd[2] += o_
            for k, v in res.notif_per_worker.items():
                notif[p][k] += v
            if p == "model":
                test_logs += res.log
    auc = np.nan
    if test_logs:
        Xt = np.array([f for f, *_ in test_logs]); yt = np.array([l for _, l, *_ in test_logs])
        if 0 < yt.mean() < 1:
            auc = roc_auc_score(yt, model.predict_proba(Xt)[:, 1])

    nurse_ids = [w.id for w in workers if w.role == "hemsire"]
    test_days = sorted({v[0] for p in ALL for v in visits[p]}) or [0]
    rows = []
    for p in ALL:
        a = agg[p]
        ex = _extra_metrics(visits[p], waits[p], nurse_ids, n_test, a["accepted"])
        counts = [notif[p].get(w.id, 0) for w in workers]
        rows.append({
            "senaryo": scn, "tohum": seed, "yontem": p,
            "uygun_teklif_5dk": a["fit5"] / a["n"],
            "zamaninda_ziyaret": a["on_time"] / a["n"],
            "kabul_orani": a["accepted"] / a["n"],
            "bildirim_per_ziyaret": a["notif"] / max(a["accepted"], 1),
            "butce_ustu_kabul": a["over_budget"] / a["n"],
            "bildirim_gini": gini(counts),
            "model_auc": auc if p == "model" else np.nan,
            "egitim_ornek": len(y), "egitim_pozitif_orani": float(y.mean()),
            "ilce_detay": json.dumps({d: v for d, v in dist[p].items()}, ensure_ascii=False),
            "eslesmeyen_oran": 1 - a["accepted"] / a["n"],
            **ex,
        })
    return rows


def _late_hist(hist, visits, workers):
    """Eğitim günlerindeki ziyaretlerden çalışan bazında geç kalma oranı."""
    cnt = defaultdict(lambda: [0, 0])
    for v in visits:
        cnt[v[0]][0] += 1
        cnt[v[0]][1] += (not v[5])
    for w in workers:
        n, late = cnt.get(w.id, (0, 0))
        hist[w.id]["v_n"], hist[w.id]["v_late"] = n, late
        hist[w.id]["late_rate"] = (late + 0.2) / (n + 2)


def _extra_metrics(visits, waits, nurse_ids, n_days, n_acc):
    """Hasta, ücret, hemşire iş/kazanç ve yol süresi çıkış verileri (test günleri, yalnızca platform ziyaretleri)."""
    out = {
        "ilk_uygun_teklif_dk_ort": float(np.mean(waits)) if waits else np.nan,
        "ilk_uygun_teklif_dk_medyan": float(np.median(waits)) if waits else np.nan,
        "ucret_ort": float(np.mean([v[2] for v in visits])) if visits else np.nan,
        "yol_dk_ort": float(np.mean([v[4] for v in visits])) if visits else np.nan,
    }
    wb = [(v[3], v[2]) for v in visits if v[3] is not None]
    out["butce_fark_ort"] = float(np.mean([b - p for b, p in wb])) if wb else np.nan  # + = bütçenin altında ödedi
    out["butce_ustu_odeme_orani"] = float(np.mean([p > b for b, p in wb])) if wb else np.nan
    nv = [v for v in visits if v[5] == "pansuman"]
    days = sorted({v[0] for v in visits})
    jobs = {(d, w): 0 for d in days for w in nurse_ids}
    earn = {(d, w): 0.0 for d in days for w in nurse_ids}
    trav = {(d, w): 0.0 for d in days for w in nurse_ids}
    for d, w, pr, _, tr, *_ in nv:
        jobs[(d, w)] += 1; earn[(d, w)] += pr; trav[(d, w)] += tr
    j, e, t = np.array(list(jobs.values())), np.array(list(earn.values())), np.array(list(trav.values()))
    tot = np.array([sum(earn[(d, w)] for d in days) for w in nurse_ids])
    out.update({
        "hemsire_gunluk_is_ort": float(j.mean()) if len(j) else np.nan,
        "hemsire_gunluk_is_maks": float(j.max()) if len(j) else np.nan,
        "hemsire_issiz_gun_orani": float((j == 0).mean()) if len(j) else np.nan,
        "hemsire_gunluk_kazanc_ort": float(e.mean()) if len(e) else np.nan,
        "hemsire_gunluk_kazanc_p10": float(np.percentile(e, 10)) if len(e) else np.nan,
        "hemsire_gunluk_kazanc_p90": float(np.percentile(e, 90)) if len(e) else np.nan,
        "hemsire_kazanc_gini": gini(tot) if len(tot) else np.nan,
        "hemsire_gunluk_yol_dk": float(t.mean()) if len(t) else np.nan,
    })
    return out


def _price_hist(hist, logs, workers):
    ratios = defaultdict(list)
    for f, _, wid, off, _, _ in logs:
        if off is not None:
            base = SERVICES["doktor" if f[-1] else "pansuman"][2]
            ratios[wid].append(off.price / base)
    for w in workers:
        r = ratios.get(w.id)
        hist[w.id]["price_mult"] = float(np.mean(r)) if r else 1.0


def summarize(df: pd.DataFrame) -> pd.DataFrame:
    metrics = ["uygun_teklif_5dk", "zamaninda_ziyaret", "bildirim_per_ziyaret", "bildirim_gini", "kabul_orani"]
    out = []
    for (scn, pol), g in df.groupby(["senaryo", "yontem"], sort=False):
        row = {"senaryo": scn, "yontem": pol, "n_tohum": len(g)}
        for m in metrics:
            mu, sd = g[m].mean(), g[m].std(ddof=1)
            row[m] = mu
            row[m + "_ga95"] = 1.96 * sd / np.sqrt(len(g))
        out.append(row)
    return pd.DataFrame(out)


def paired_diff(df: pd.DataFrame, a="model", b="en_erken") -> pd.DataFrame:
    """Aynı tohumlarda yöntem farkı (eşleştirilmiş) ve %95 güven aralığı."""
    out = []
    for scn, g in df.groupby("senaryo", sort=False):
        pa = g[g.yontem == a].set_index("tohum"); pb = g[g.yontem == b].set_index("tohum")
        for m in ["uygun_teklif_5dk", "zamaninda_ziyaret", "bildirim_per_ziyaret", "bildirim_gini"]:
            d = (pa[m] - pb[m]).dropna()
            out.append({"senaryo": scn, "metrik": m, "fark": d.mean(),
                        "ga95": 1.96 * d.std(ddof=1) / np.sqrt(len(d)), "n": len(d)})
    return pd.DataFrame(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=10)
    ap.add_argument("--scenarios", nargs="+", default=list(SCENARIOS))
    ap.add_argument("--out", default="results")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(exist_ok=True)
    rows = []
    for scn in args.scenarios:
        for s in range(args.seeds):
            t0 = time.time()
            rows += run_seed(scn, s)
            print(f"{scn} tohum {s} bitti ({time.time() - t0:.1f} sn)", flush=True)
    df = pd.DataFrame(rows)
    df.to_csv(out / "tohum_sonuclari.csv", index=False)
    summ = summarize(df); summ.to_csv(out / "ozet.csv", index=False)
    diff = paired_diff(df); diff.to_csv(out / "model_vs_en_erken.csv", index=False)
    pd.set_option("display.width", 200)
    print(summ.round(3).to_string(index=False))
    print(diff.round(4).to_string(index=False))


if __name__ == "__main__":
    main()
