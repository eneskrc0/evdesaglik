"""Özet sonuçlardan karşılaştırma grafiği üretir: python -m sim.plot results"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

COLORS = {"en_yakin": "#2a78d6", "en_erken": "#eb6834", "model": "#1baf7a"}
LABELS = {"en_yakin": "En yakın 3", "en_erken": "En erken varış 3", "model": "Model ile seçilen 3"}
METRICS = [
    ("uygun_teklif_5dk", "5 dk içinde uygun teklif alan talep oranı", True),
    ("zamaninda_ziyaret", "Zamanında gerçekleşen ziyaret oranı", True),
    ("bildirim_per_ziyaret", "Ziyaret başına bildirim sayısı (düşük iyi)", False),
    ("bildirim_gini", "Bildirim yükü eşitsizliği, Gini (düşük iyi)", False),
]
SCN = {"baz": "Baz", "homojen": "Homojen", "yuksek_degiskenlik": "Yüksek\ndeğişkenlik", "belirsiz_yol": "Belirsiz\nyol"}


def main(d="results"):
    df = pd.read_csv(Path(d) / "ozet.csv")
    scns = list(dict.fromkeys(df.senaryo))
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    x = np.arange(len(scns)); w = 0.26
    for ax, (m, title, pct) in zip(axes.flat, METRICS):
        for i, p in enumerate(COLORS):
            g = df[df.yontem == p].set_index("senaryo").loc[scns]
            ax.bar(x + (i - 1) * w, g[m], w - 0.02, yerr=g[m + "_ga95"], color=COLORS[p],
                   label=LABELS[p], capsize=2, error_kw={"elinewidth": 0.8, "ecolor": "#555"})
        ax.set_title(title, fontsize=11, loc="left")
        ax.set_xticks(x, [SCN.get(s, s) for s in scns], fontsize=9)
        if pct:
            ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
        ax.grid(axis="y", color="#e5e5e5"); ax.set_axisbelow(True)
        for sp in ["top", "right"]:
            ax.spines[sp].set_visible(False)
    h, l = axes[0, 0].get_legend_handles_labels()
    fig.legend(h, l, frameon=False, fontsize=10, loc="upper right", ncol=3)
    fig.suptitle("Bornova sentetik simülasyonu: 3 bildirim yöntemi (10 tohum, %95 GA)", fontsize=13, x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(Path(d) / "karsilastirma.png", dpi=150)
    print(Path(d) / "karsilastirma.png")


if __name__ == "__main__":
    main(*sys.argv[1:])
