"""Sürüm panosu: v1 → v5 tüm çıkış verileri, sezgisel yöntem çizgileriyle.

Kullanım: [DUNYA=izmir] python -m sim.plot_versions
Çıktı:    results/[izmir/]surumler.png
"""
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
WORLD = os.environ.get("DUNYA", "bornova")
OLCEK = os.environ.get("OLCEK", "")
TAG = f"{WORLD}_{OLCEK}" if OLCEK else WORLD
RES = ROOT / "results" if TAG == "bornova" else ROOT / "results" / TAG
VERSIONS = ["v1", "v2", "v3", "v4", "v5"] + (["v5+kota", "v5+kota+ayar"] if OLCEK == "orta" else [])
GREEN, BLUE, ORANGE = "#1baf7a", "#2a78d6", "#eb6834"

# (sütun, başlık, birim, yüzde mi, yüksek mi iyi)
PANELS = [
    ("uygun_teklif_5dk", "5 dk içinde uygun teklif alan hasta", "%", True, True),
    ("ilk_uygun_teklif_dk_ort", "İlk uygun teklife kadar ortalama süre", "dk", False, False),
    ("eslesmeyen_oran", "Eşleşemeyen hasta oranı", "%", True, False),
    ("zamaninda_ziyaret", "Zamanında gerçekleşen ziyaret", "%", True, True),
    ("butce_fark_ort", "Hastanın bütçesinden kalan (ort.)", "TL", False, True),
    ("bildirim_per_ziyaret", "Ziyaret başına bildirim", "adet", False, False),
    ("hemsire_gunluk_kazanc_ort", "Hemşire başına günlük platform kazancı", "TL", False, True),
    ("hemsire_issiz_gun_orani", "Hiç iş alamayan hemşire-gün oranı", "%", True, False),
    ("hemsire_kazanc_gini", "Hemşire kazanç eşitsizliği (Gini)", "", False, False),
    ("yol_dk_ort", "Ziyaret başına yol süresi", "dk", False, False),
]


if OLCEK == "orta":  # kotanın etkisi görünsün: "ziyaret başına bildirim" yerine günlük en yüksek iş sayısı
    PANELS[5] = ("hemsire_gunluk_is_maks", "Bir hemşirenin günde aldığı en fazla iş", "adet", False, False)


def main():
    r = pd.read_json(RES / "ilerleme.json")
    r = r[(r.set == "dev") & (r.senaryo == "baz")]
    heur = r[r.model.isin(["en_yakin", "en_erken"])]
    mods = r[r["versiyon"].isin(VERSIONS)] if "versiyon" in r else r.iloc[0:0]
    mods = mods.drop_duplicates("versiyon", keep="last").set_index("versiyon")
    fig, axes = plt.subplots(2, 5, figsize=(18 + 1.6 * max(0, len(VERSIONS) - 5), 7.6))
    x = np.arange(len(VERSIONS))
    for ax, (col, title, unit, pct, higher) in zip(axes.flat, PANELS):
        vals = [mods.loc[v, col] if v in mods.index and col in mods.columns else np.nan for v in VERSIONS]
        k = 100 if pct else 1
        bars = ax.bar(x, [v * k if v == v else 0 for v in vals], color=[GREEN if v == v else "#eeeeee" for v in vals],
                      width=0.6, edgecolor=["none" if v == v else "#cccccc" for v in vals])
        for i, v in enumerate(vals):
            if v == v:
                lab = f"{v * k:.0f}" if (pct or abs(v) >= 100) else f"{v:.2f}" if col.endswith("gini") else f"{v:.1f}"
                ax.text(i, v * k, lab + ("%" if pct else ""), ha="center", va="bottom", fontsize=8)
            else:
                ax.text(i, 0, "sırada", ha="center", va="bottom", fontsize=7, color="#999")
        for _, h in heur.iterrows():
            if col in h and h[col] == h[col]:
                c = BLUE if h.model == "en_yakin" else ORANGE
                ax.axhline(h[col] * k, color=c, ls="--", lw=1.2)
        ax.set_title(title + (f" ({unit})" if unit and unit != "%" else "") + ("  ↑ yüksek iyi" if higher else "  ↓ düşük iyi"), fontsize=9, loc="left")
        ax.set_xticks(x, VERSIONS, fontsize=9)
        for sp in ["top", "right"]:
            ax.spines[sp].set_visible(False)
        ax.grid(axis="y", color="#eeeeee"); ax.set_axisbelow(True)
    yer = "Bornova" if WORLD == "bornova" else ("Merkez İzmir, orta ölçek (80 hemşire, 25 doktor, 20 fizyoterapist, 155 talep/gün)" if OLCEK == "orta" else "Merkez İzmir (11 ilçe)")
    fig.suptitle(f"{yer} — model sürümleri (yeşil) ve klasik yöntemler (mavi: en yakın, turuncu: en erken varış) · baz senaryo, 10 tohum",
                 fontsize=11, x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(RES / "surumler.png", dpi=140)
    print(RES / "surumler.png")


if __name__ == "__main__":
    main()
