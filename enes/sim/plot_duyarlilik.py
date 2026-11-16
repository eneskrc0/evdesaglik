"""Duyarlılık testi grafiği: çalışan sayısı × talep yoğunluğu ızgarası.
Girdi: results/izmir_orta/duyarlilik.csv (python -m sim.duyarlilik)  ->  results/izmir_orta/duyarlilik.png"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

R = Path(__file__).resolve().parent.parent / "results" / "izmir_orta"
t = pd.read_csv(R / "duyarlilik.csv")
STAFF, LOAD = ["küçük", "orta", "büyük"], ["sakin", "normal", "yoğun"]
SEL = "ayarli_ukota" if (t.yontem == "ayarli_ukota").any() else "ayarli_kota5"


def grid(yontem, col):
    return np.array([[t[(t.calisan == s) & (t.talep == l) & (t.yontem == yontem)][col].mean() for l in LOAD] for s in STAFF])


panels = [
    ("Klasik kural · 5 dk uygun teklif (%)", grid("kural", "basari") * 100, "{:.0f}", "Greys"),
    ("Seçilen yapay zekâ · 5 dk uygun teklif (%)", grid(SEL, "basari") * 100, "{:.0f}", "Greens"),
    ("Kazanç: yapay zekâ − kural (puan)", (grid(SEL, "basari") - grid("kural", "basari")) * 100, "+{:.0f}", "Greens"),
    ("Bir hemşirenin günde en fazla işi · v1", grid("v1", "maks_is"), "{:.1f}", "Oranges"),
    ("Bir hemşirenin günde en fazla işi · seçilen", grid(SEL, "maks_is"), "{:.1f}", "Oranges"),
    ("Seçilen − v1 · 5 dk uygun teklif (puan)", (grid(SEL, "basari") - grid("v1", "basari")) * 100, "{:+.1f}", "RdYlGn"),
]
fig, axes = plt.subplots(2, 3, figsize=(15, 8.4))
lab_s = [f"{s}\n({int(t[t.calisan == s].hemsire.iloc[0])} hem., {int(t[t.calisan == s].doktor.iloc[0])} dr, {int(t[t.calisan == s].fizyo.iloc[0])} fzt)" for s in STAFF]
lab_l = ["sakin\n0,8 talep/çalışan", "normal\n1,25", "yoğun\n2,0"]
for ax, (title, M, fmt, cmap) in zip(axes.flat, panels):
    vmax = np.nanmax(np.abs(M)) if cmap == "RdYlGn" else None
    lo, hi = ((-vmax, vmax) if vmax else (3, 13) if cmap == "Oranges" else (None, None))
    ax.imshow(M, cmap=cmap, vmin=lo, vmax=hi, aspect="auto", alpha=0.85)
    for i in range(3):
        for j in range(3):
            ax.text(j, i, fmt.format(M[i, j]), ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xticks(range(3), lab_l, fontsize=8); ax.set_yticks(range(3), lab_s, fontsize=8)
    ax.set_title(title, fontsize=10, loc="left")
name = "uyarlanır kota (2,5 + 2 × talep/çalışan)" if SEL == "ayarli_ukota" else "kota 5"
fig.suptitle(f"Dayanıklılık testi: çalışan sayısı × talep yoğunluğu · seçilen = ayarlı v5 + {name} · İzmir, baz senaryo, 10 tohum",
             fontsize=11, x=0.01, ha="left")
fig.tight_layout(rect=(0, 0, 1, 0.95)); fig.savefig(R / "duyarlilik.png", dpi=130); print(R / "duyarlilik.png")
