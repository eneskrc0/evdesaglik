"""Meslek bazında 5 dk uygun teklif (izmir_tam, ayrılmış tohumlar): kural / v1 / seçilen.
Çıktı: results/izmir_tam/meslek.png"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

R = Path(__file__).resolve().parent.parent / "results" / "izmir_tam"
ROLES = [("hemsire", "Hemşire", 80), ("doktor", "Doktor", 25), ("fizyoterapist", "Fizyoterapist", 20), ("klinik_psikolog", "Klinik psikolog", 8),
         ("dil_konusma", "Dil-konuşma t.", 6), ("diyetisyen", "Diyetisyen", 6), ("ergoterapist", "Ergoterapist", 4), ("odyolog", "Odyolog", 3), ("podolog", "Podolog", 3)]


def g(run, y):
    d = pd.read_csv(R / "runs" / run / "tohum_sonuclari.csv")
    return d[(d.yontem == y) & (d.senaryo == "baz")]


src = [("Klasik kural", g("007_v1_holdout", "en_erken"), "#9aa0a6"), ("v1", g("007_v1_holdout", "model"), "#2b6fd6"),
       ("Seçilen (v5 + kota, trafiğe göre ayarlı)", g("010_v5_ukota_trafik_holdout", "model"), "#1aa874")]
x = np.arange(len(ROLES)); w = 0.27
fig, ax = plt.subplots(figsize=(14, 5))
for i, (lab, d, col) in enumerate(src):
    v = [d[f"uygun5_{r}"].mean() * 100 for r, *_ in ROLES]
    bars = ax.bar(x + (i - 1) * w, v, w, label=lab, color=col)
    for b, val in zip(bars, v):
        ax.text(b.get_x() + b.get_width() / 2, val + 0.8, f"{val:.0f}", ha="center", fontsize=7.5)
ax.set_xticks(x, [f"{n}\n({k} kişi)" for _, n, k in ROLES], fontsize=9)
ax.set_ylabel("5 dk içinde uygun teklif alan hasta (%)"); ax.set_ylim(0, 100); ax.legend(frameon=False, loc="upper right")
for sp in ["top", "right"]:
    ax.spines[sp].set_visible(False)
ax.grid(axis="y", color="#eee"); ax.set_axisbelow(True)
ax.set_title("Meslek bazında sonuç · 3'ten az çalışanı olan mesleklerde herkese bildirim gidiyor, seçim yok: fark yapay zekâdan değil, kadrodan", fontsize=10, loc="left")
fig.tight_layout(); fig.savefig(R / "meslek.png", dpi=140); print(R / "meslek.png")
