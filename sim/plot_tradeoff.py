"""Başarı–adalet dengesi grafiği (baz senaryo, geliştirme tohumları): python -m sim.plot_tradeoff"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

import os
ROOT = Path(__file__).resolve().parent.parent
WORLD = os.environ.get("DUNYA", "bornova")
RES = ROOT / "results" if WORLD == "bornova" else ROOT / "results" / WORLD
r = pd.read_json(RES / "ilerleme.json")
r["run"] = r["run"].str.replace(r"^\d{3}_", "", regex=True)
r = r[(r.set == "dev") & (r.senaryo == "baz")]
LBL = {"referans": "Model (kotasız, referans)", "yumusak_kota8": "Model + kota 8",
       "yumusak_kota6": "Model + kota 6", "yumusak_kota4": "Model + kota 4",
       "ziyaret_kota3": "Model + ziyaret kotası 3",
       "en_yakin (sezgisel)": "En yakın 3", "en_erken (sezgisel)": "En erken varış 3"}
fig, ax = plt.subplots(figsize=(8.5, 5))
for _, x in r.iterrows():
    if x.run not in LBL:
        continue
    heur = "sezgisel" in x.run
    col = "#2a78d6" if "yakin" in x.run else "#eb6834" if heur else "#1baf7a"
    ax.scatter(x.bildirim_gini, x.uygun_teklif_5dk, s=90, color=col, zorder=3, edgecolor="white", linewidth=1.5)
    off = {"en_yakin (sezgisel)": (-10, -26, "right"), "en_erken (sezgisel)": (10, -4, "left"),
           "ziyaret_kota3": (10, -22, "left"), "yumusak_kota8": (-10, 4, "right"),
           "yumusak_kota6": (-10, 4, "right"), "yumusak_kota4": (10, -14, "left"),
           "referans": (-10, 6, "right")}[x.run]
    ax.annotate(f"{LBL[x.run]} · %{x.uygun_teklif_5dk * 100:.0f}", (x.bildirim_gini, x.uygun_teklif_5dk),
                xytext=off[:2], textcoords="offset points", fontsize=9, ha=off[2])
m = r[r.run.isin(["yumusak_kota4", "yumusak_kota6", "yumusak_kota8", "referans"])].sort_values("bildirim_gini")
ax.plot(m.bildirim_gini, m.uygun_teklif_5dk, color="#1baf7a", lw=1.2, ls="--", zorder=2)
ax.set_xlabel("Bildirim yükü eşitsizliği (Gini) → sağa gidildikçe iş birkaç kişide toplanıyor")
ax.set_ylabel("5 dk içinde uygun teklif alan hasta oranı")
ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
ax.set_xlim(0, 0.7); ax.set_ylim(0.5, 0.95)
ax.set_title(f"Başarı ile adil dağıtım arasındaki denge — {'Bornova' if WORLD == 'bornova' else 'Merkez İzmir (11 ilçe)'} (baz senaryo, 10 tohum)", loc="left", fontsize=11)
ax.grid(color="#e5e5e5"); ax.set_axisbelow(True)
for sp in ["top", "right"]:
    ax.spines[sp].set_visible(False)
fig.tight_layout(); fig.savefig(RES / "denge.png", dpi=150)
print(RES / "denge.png")
