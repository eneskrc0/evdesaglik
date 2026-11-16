"""Tek güvenilir sonuç tablosu: İzmir, ayrılmış 10 tohum, baz senaryo.
En erken varış kuralı vs v1 vs v5 vs demodaki model. Eşleştirilmiş fark + %95 GA."""
import pandas as pd, numpy as np, os
R = "results/izmir/runs"
runs = {"v1 (ilk model)": "008_v1_holdout", "v5 (en iyi)": "013_v5_holdout", "Demodaki model": "014_v5_demo_lr_holdout"}
M = [("uygun_teklif_5dk", "5 dk içinde uygun teklif alan hasta", 100, "%"),
     ("eslesmeyen_oran", "Hiç eşleşemeyen hasta", 100, "%"),
     ("zamaninda_ziyaret", "Zamanında gerçekleşen ziyaret", 100, "%"),
     ("bildirim_gini", "Bildirim dağılımı eşitsizliği (Gini, düşük=adil)", 1, ""),
     ("yol_dk_ort", "Ziyaret başına yol süresi", 1, " dk")]
scn = "baz"
base = pd.read_csv(f"{R}/013_v5_holdout/tohum_sonuclari.csv")
ref = base[(base.senaryo == scn) & (base.yontem == "en_erken")].set_index("tohum")
rows, cols = [], {"En erken varış kuralı": ref}
for k, d in runs.items():
    x = pd.read_csv(f"{R}/{d}/tohum_sonuclari.csv")
    cols[k] = x[(x.senaryo == scn) & (x.yontem == "model")].set_index("tohum")
for m, ad, s, u in M:
    r = {"Ölçüt": ad}
    for k, df in cols.items():
        r[k] = f"{df[m].mean()*s:.1f}{u}" if s == 100 or u else f"{df[m].mean():.3f}"
    diff = (cols["v5 (en iyi)"][m] - ref[m]).dropna() * s
    ci = 1.96 * diff.std(ddof=1) / np.sqrt(len(diff))
    r["v5 − kural (%95 GA)"] = f"{diff.mean():+.1f} ± {ci:.1f}" if (s == 100 or u) else f"{diff.mean():+.3f} ± {ci:.3f}"
    rows.append(r)
t = pd.DataFrame(rows)
os.makedirs("results/izmir", exist_ok=True)
t.to_csv("results/izmir/sonuc_tablosu.csv", index=False)
print(t.to_string(index=False)); print("tohum sayısı:", len(ref))
