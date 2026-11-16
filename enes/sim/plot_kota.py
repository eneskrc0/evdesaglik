"""Kota taraması grafiği (izmir_orta arama sonuçları): v5 + günlük ziyaret kotası 2..6 ve kotasız.
Çıktı: results/izmir_orta/kota.png"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

R = Path(__file__).resolve().parent.parent / "results" / "izmir_orta"
t = pd.read_csv(R / "arama_ozet.csv").set_index("ayar")
names = [f"v5_zkota{n}" for n in (2, 3, 4, 5, 6)] + ["v5", "v5_a0.9_b0.03_c0.08_zkota5"]
labels = ["2", "3", "4", "5", "6", "kotasız", "5 + ayar"]
s = [t.loc[n, "5dk_uygun"] * 100 for n in names]
m = [t.loc[n, "maks_is"] for n in names]
g = [t.loc[n, "kazanc_gini"] for n in names]
fig, axes = plt.subplots(1, 3, figsize=(14, 4))
for ax, vals, title, fmt, col in [(axes[0], s, "5 dk içinde uygun teklif (%) ↑ · klasik kural 52,4", "{:.1f}", "#1aa874"),
                                  (axes[1], m, "Bir hemşirenin günde aldığı en fazla iş  ↓", "{:.1f}", "#2b6fd6"),
                                  (axes[2], g, "Hemşire kazanç eşitsizliği (Gini)  ↓", "{:.2f}", "#8b5cf6")]:
    bars = ax.bar(labels, vals, color=[col if l != "5 + ayar" else "#e8663d" for l in labels], width=0.6)
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v, fmt.format(v), ha="center", va="bottom", fontsize=9)
    ax.set_title(title, fontsize=10, loc="left"); ax.set_xlabel("Günlük ziyaret kotası (hemşire başına)")
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", color="#eee"); ax.set_axisbelow(True)
axes[0].set_ylim(55, 76)
fig.suptitle("Kota seçimi (v5 + sert günlük ziyaret kotası) · turuncu = seçilen: kota 5 + ayarlı v5 (a=0,9, b=0,03, c=0,08) · İzmir orta ölçek, baz senaryo, 10 tohum", fontsize=11, x=0.01, ha="left")
fig.tight_layout(rect=(0, 0, 1, 0.92)); fig.savefig(R / "kota.png", dpi=140); print(R / "kota.png")
