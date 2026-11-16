"""İlçe bazında 5 dk uygun teklif oranı (İzmir, baz senaryo): DUNYA=izmir python -m sim.plot_districts [run_id]"""
import json, sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
run = sys.argv[1] if len(sys.argv) > 1 else "001_referans"
df = pd.read_csv(ROOT / f"results/izmir/runs/{run}/tohum_sonuclari.csv")
b = df[df.senaryo == "baz"]
rows = [dict(yontem=r.yontem, ilce=d, n=v[0], f=v[1]) for _, r in b.iterrows() for d, v in json.loads(r.ilce_detay).items()]
x = pd.DataFrame(rows).groupby(["ilce", "yontem"]).sum()
x["oran"] = x.f / x.n
t = x["oran"].unstack().sort_values("model")
fig, ax = plt.subplots(figsize=(9, 5.2))
y = np.arange(len(t))
ax.barh(y - 0.2, t["en_erken"], 0.38, color="#eb6834", label="En erken varış 3")
ax.barh(y + 0.2, t["model"], 0.38, color="#1baf7a", label="Model ile seçilen 3")
for i, (_, r) in enumerate(t.iterrows()):
    ax.text(r["model"] + 0.01, i + 0.2, f"%{r['model'] * 100:.0f}", va="center", fontsize=8)
    ax.text(r["en_erken"] + 0.01, i - 0.2, f"%{r['en_erken'] * 100:.0f}", va="center", fontsize=8, color="#666")
ax.set_yticks(y, t.index)
ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
ax.set_xlim(0, 1.05)
ax.set_title("Merkez İzmir — ilçelere göre 5 dk içinde uygun teklif alan hasta oranı (baz senaryo, 10 tohum)", loc="left", fontsize=10)
ax.legend(frameon=False, loc="lower right", fontsize=9)
for sp in ["top", "right"]:
    ax.spines[sp].set_visible(False)
ax.grid(axis="x", color="#e5e5e5"); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig(ROOT / "results/izmir/ilceler.png", dpi=150)
print("results/izmir/ilceler.png")
