"""Deney takibi: referansı dondur, her model denemesini referansa göre ölç.

Protokol (değiştirilmez):
- Geliştirme tohumları 0–9: model denemeleri bunlarla karşılaştırılır.
- Ayrılmış tohumlar 1000–1009: yalnızca dönüm noktalarında (ör. yarışma sunumu öncesi)
  çalıştırılır; geliştirme sırasında bakılmaz. Böylece test kümesine aşırı uyum önlenir.
- 4 senaryo, her tohumda 12 gün geçmiş + 12 gün eğitim + 10 test günü.
- Ortam kontrolü: sezgisel yöntemlerin (en yakın / en erken) tohum bazlı sonuçları
  referansla birebir aynı olmalı. Değilse simülasyon dünyası değişmiştir ve karşılaştırma
  geçersiz sayılır.

Kullanım:
  python -m sim.track run --name gbm_v1 --model gbm_v1 --note "Referans model"
  python -m sim.track baseline 001_gbm_v1            # referansı dondur (bir kez)
  python -m sim.track run --name gbm_v1 --model gbm_v1 --set holdout
  python -m sim.track report
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from .experiment import HIST_DAYS, POLICIES, TEST_DAYS, TRAIN_DAYS, run_seed
from .world import SCENARIOS

ROOT = Path(__file__).resolve().parent.parent
from . import geo
RES = ROOT / "results" if geo.WORLD_TAG == "bornova" else ROOT / "results" / geo.WORLD_TAG
RUNS = RES / "runs"
BASE = RES / "baseline.json"
SEEDS = {"dev": list(range(10)), "holdout": list(range(1000, 1010))}
METRICS = ["uygun_teklif_5dk", "zamaninda_ziyaret", "bildirim_per_ziyaret", "bildirim_gini"]
PRIMARY = "uygun_teklif_5dk"
HEUR = ["en_yakin", "en_erken"]
EXTRA = ["eslesmeyen_oran", "ilk_uygun_teklif_dk_ort", "ilk_uygun_teklif_dk_medyan", "ucret_ort", "butce_fark_ort",
         "butce_ustu_odeme_orani", "yol_dk_ort", "hemsire_gunluk_is_ort", "hemsire_gunluk_is_maks", "hemsire_issiz_gun_orani",
         "hemsire_gunluk_kazanc_ort", "hemsire_gunluk_kazanc_p10", "hemsire_gunluk_kazanc_p90", "hemsire_kazanc_gini",
         "hemsire_gunluk_yol_dk"]


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def heuristic_hash(df: pd.DataFrame) -> str:
    h = df[df.yontem.isin(HEUR)].sort_values(["senaryo", "tohum", "yontem"])[["senaryo", "tohum", "yontem"] + METRICS]
    return hashlib.sha256(h.round(10).to_csv(index=False).encode()).hexdigest()[:12]


def _job(args):
    scn, s, model = args
    return run_seed(scn, s, model_name=model)


def cmd_run(a):
    RUNS.mkdir(parents=True, exist_ok=True)
    n = len([p for p in RUNS.iterdir() if p.is_dir()]) + 1
    rid = f"{n:03d}_{a.name}" + ("" if a.set == "dev" else f"_{a.set}")
    jobs = [(scn, s, a.model) for scn in SCENARIOS for s in SEEDS[a.set]]
    with ProcessPoolExecutor(os.cpu_count()) as ex:
        rows = [r for rs in ex.map(_job, jobs) for r in rs]
    df = pd.DataFrame(rows)
    out = RUNS / rid
    out.mkdir()
    df.to_csv(out / "tohum_sonuclari.csv", index=False)
    meta = {
        "id": rid, "world": geo.WORLD_TAG, "versiyon": a.version, "name": a.name, "model": a.model, "note": a.note, "set": a.set,
        "date": dt.datetime.now().isoformat(timespec="minutes"),
        "protocol": {"hist_days": HIST_DAYS, "train_days": TRAIN_DAYS, "test_days": TEST_DAYS,
                     "seeds": SEEDS[a.set], "scenarios": list(SCENARIOS)},
        "heuristic_hash": heuristic_hash(df),
        "files": {f: _sha(ROOT / f) for f in [f"data/{geo.WORLD}/pool.npz", "sim/engine.py", "sim/world.py", "sim/geo.py", "sim/models.py"]},
    }
    json.dump(meta, open(out / "meta.json", "w"), indent=2, ensure_ascii=False)
    print(f"Kaydedildi: {out}")
    cmd_report(a)


def cmd_baseline(a):
    meta = json.load(open(RUNS / a.run / "meta.json"))
    base = json.load(open(BASE)) if BASE.exists() else {}
    if meta["set"] in base and not a.force:
        raise SystemExit(f"'{meta['set']}' için referans zaten var ({base[meta['set']]}). Değiştirmek için --force.")
    base[meta["set"]] = a.run
    json.dump(base, open(BASE, "w"), indent=2)
    print(f"Referans ({meta['set']}): {a.run}")


def _paired(df_a, df_b, pol_a="model", pol_b="model"):
    """Aynı senaryo ve tohumda a − b farkı (ortalama, %95 GA)."""
    a = df_a[df_a.yontem == pol_a].set_index(["senaryo", "tohum"])
    b = df_b[df_b.yontem == pol_b].set_index(["senaryo", "tohum"])
    out = {}
    for scn in a.index.get_level_values(0).unique():
        for m in METRICS:
            d = (a.loc[scn][m] - b.loc[scn][m]).dropna()
            out[(scn, m)] = (float(d.mean()), float(1.96 * d.std(ddof=1) / np.sqrt(len(d))) if len(d) > 1 else float("nan"))
    return out


def cmd_report(a=None):
    if not BASE.exists():
        print("Henüz referans yok: python -m sim.track baseline <run_id>")
        return
    base = json.load(open(BASE))
    runs = sorted(p for p in RUNS.iterdir() if p.is_dir())
    rows = []
    for p in runs:
        meta = json.load(open(p / "meta.json"))
        if meta["set"] not in base:
            continue
        bid = base[meta["set"]]
        bmeta = json.load(open(RUNS / bid / "meta.json"))
        df = pd.read_csv(p / "tohum_sonuclari.csv")
        bdf = pd.read_csv(RUNS / bid / "tohum_sonuclari.csv")
        valid = meta["heuristic_hash"] == bmeta["heuristic_hash"]
        vs_base = _paired(df, bdf)
        vs_heur = _paired(df, df, "model", "en_erken")
        for scn in SCENARIOS:
            g = df[(df.senaryo == scn) & (df.yontem == "model")]
            row = {"run": meta["id"], "versiyon": meta.get("versiyon"), "set": meta["set"], "model": meta["model"], "not": meta["note"],
                   "tarih": meta["date"], "senaryo": scn, "gecerli": valid, "referans": p.name == bid}
            for m in METRICS:
                row[m] = g[m].mean()
                row[m + "_vs_ref"], row[m + "_vs_ref_ga"] = vs_base[(scn, m)]
                row[m + "_vs_en_erken"], row[m + "_vs_en_erken_ga"] = vs_heur[(scn, m)]
            row["auc"] = g["model_auc"].mean()
            for m in EXTRA:
                if m in g:
                    row[m] = g[m].mean()
            rows.append(row)
        # sezgisel yöntem satırları (yalnızca referans için)
        if p.name == bid:
            for pol in HEUR:
                for scn in SCENARIOS:
                    g = df[(df.senaryo == scn) & (df.yontem == pol)]
                    rows.append({"run": f"{pol} (sezgisel)", "set": meta["set"], "model": pol, "not": "Sezgisel karşılaştırma",
                                 "tarih": meta["date"], "senaryo": scn, "gecerli": True, "referans": False,
                                 **{m: g[m].mean() for m in METRICS + EXTRA if m in g}})
    rep = pd.DataFrame(rows)
    rep.to_csv(RES / "ilerleme.csv", index=False)
    rep.to_json(RES / "ilerleme.json", orient="records", force_ascii=False)
    _write_md(rep, base)
    _plot(rep)
    print(f"Rapor: results/ilerleme.md, results/ilerleme.png ({rep['run'].nunique()} kayıt)")


def _fmt(v, ga, pct=True):
    if v != v:  # NaN
        return "—"
    if pct:
        return f"{v * 100:+.1f} ± {ga * 100:.1f}"
    return f"{v:+.2f} ± {ga:.2f}"


def _write_md(rep, base):
    L = ["# Model gelişim raporu", "",
         f"Referans (geliştirme): **{base.get('dev', '—')}** · Referans (ayrılmış): **{base.get('holdout', '—')}**", "",
         "Farklar aynı senaryo ve tohumlarda eşleştirilmiştir; ± değerler %95 güven aralığıdır. "
         "Oranlar yüzde puan olarak verilmiştir.", ""]
    for st in ["dev", "holdout"]:
        r = rep[(rep.set == st) & rep["uygun_teklif_5dk_vs_ref"].notna()] if "uygun_teklif_5dk_vs_ref" in rep else rep.iloc[0:0]
        if r.empty:
            continue
        L += [f"## {'Geliştirme tohumları (0–9)' if st == 'dev' else 'Ayrılmış tohumlar (1000–1009)'}", ""]
        for scn in SCENARIOS:
            s = r[r.senaryo == scn]
            L += [f"### Senaryo: {scn}", "",
                  "| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |",
                  "|---|---|---|---|---|---|---|---|---|"]
            for _, x in s.iterrows():
                L.append(f"| {x.run}{' ⭐' if x.referans else ''} | {x.model} | {x.uygun_teklif_5dk * 100:.1f}% | "
                         f"{_fmt(x.uygun_teklif_5dk_vs_ref, x.uygun_teklif_5dk_vs_ref_ga)} | "
                         f"{_fmt(x.uygun_teklif_5dk_vs_en_erken, x.uygun_teklif_5dk_vs_en_erken_ga)} | "
                         f"{_fmt(x.zamaninda_ziyaret_vs_ref, x.zamaninda_ziyaret_vs_ref_ga)} | "
                         f"{_fmt(x.bildirim_per_ziyaret_vs_ref, x.bildirim_per_ziyaret_vs_ref_ga, False)} | "
                         f"{_fmt(x.bildirim_gini_vs_ref, x.bildirim_gini_vs_ref_ga, False)} | {'✔' if x.gecerli else '✘ ortam değişti'} |")
            L.append("")
    (RES / "ilerleme.md").write_text("\n".join(L), encoding="utf-8")


def _plot(rep):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    r = rep[(rep.set == "dev") & (rep.senaryo == "baz")]
    if r.empty:
        return
    heur = r[r.model.isin(HEUR)]
    mod = r[~r.model.isin(HEUR)]
    fig, ax = plt.subplots(figsize=(9, 4.2))
    x = np.arange(len(mod))
    ax.bar(x, mod[PRIMARY], color="#1baf7a", width=0.55)
    for i, (_, m) in enumerate(mod.iterrows()):
        ax.text(i, m[PRIMARY] + 0.012, f"{m[PRIMARY] * 100:.1f}%", ha="center", fontsize=9)
    for _, h in heur.iterrows():
        col = "#2a78d6" if h.model == "en_yakin" else "#eb6834"
        ax.axhline(h[PRIMARY], color=col, lw=1.5, ls="--")
        ax.text(len(mod) - 0.5, h[PRIMARY] + 0.01, f"{h.model} (sezgisel) {h[PRIMARY] * 100:.1f}%", color=col, ha="right", fontsize=9)
    ref = mod[mod.referans]
    if not ref.empty:
        ax.axhline(ref[PRIMARY].iloc[0], color="#555", lw=1, ls=":")
    ax.set_xticks(x, [f"{a}\n{b}" for a, b in zip(mod.run, mod.model)], fontsize=8)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.set_ylim(0, 1)
    ax.set_title("Baz senaryo — 5 dk içinde uygun teklif alan talep oranı (geliştirme tohumları)", loc="left", fontsize=11)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", color="#e5e5e5")
    ax.set_axisbelow(True)
    fig.tight_layout()
    fig.savefig(RES / "ilerleme.png", dpi=150)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run"); r.add_argument("--name", required=True); r.add_argument("--model", required=True)
    r.add_argument("--note", default=""); r.add_argument("--version", default=None); r.add_argument("--set", choices=list(SEEDS), default="dev")
    b = sub.add_parser("baseline"); b.add_argument("run"); b.add_argument("--force", action="store_true")
    sub.add_parser("report")
    a = ap.parse_args()
    {"run": cmd_run, "baseline": cmd_baseline, "report": cmd_report}[a.cmd](a)


if __name__ == "__main__":
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    main()
