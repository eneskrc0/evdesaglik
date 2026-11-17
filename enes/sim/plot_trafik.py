"""Trafik kalibrasyonu grafiği: saat saat 10 km kaç dakika — eski model, yeni model (TomTom eğrisi), TomTom 2025 İzmir noktaları.
Çıktı: results/izmir_tam/trafik.png"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

R = Path(__file__).resolve().parent.parent / "results" / "izmir_tam"
R.mkdir(parents=True, exist_ok=True)
FF10 = 9.3
TT10 = [16, 16, 16, 16, 16, 16, 17, 20, 25.6, 24, 21.5, 21.5, 22.5, 23, 23, 24.5, 27, 31.5, 34.7, 29, 23, 19.5, 18, 17]


def yeni(m):
    x = (m / 60 - 0.5) % 24; i = int(x); f = x - i
    return TT10[i] * (1 - f) + TT10[(i + 1) % 24] * f


def eski(m):
    h = (m / 60) % 24
    c = 1.8 if (7.5 <= h < 9.5 or 17 <= h < 19.5) else 1.35 if 9.5 <= h < 17 else 1.15
    return FF10 * c


m = np.arange(6 * 60, 22 * 60 + 1, 5)
fig, ax = plt.subplots(figsize=(11, 4.6))
ax.axvspan(8, 19, color="#f2f6fb", zorder=0); ax.text(13.5, 1.2, "simülasyon günü 08:00–19:00", fontsize=8, color="#667", ha="center")
ax.plot(m / 60, [eski(x) for x in m], color="#9aa0a6", lw=2, ls="--", label="Eski model (hız sınırı × 3 kaba katsayı)")
ax.plot(m / 60, [yeni(x) for x in m], color="#2b6fd6", lw=2.5, label="Yeni model (TomTom'a göre saatlik eğri)")
for h, v, lab in [(8.5, 25 + 38 / 60, "sabah zirvesi 25:38"), (18.5, 34 + 41 / 60, "akşam zirvesi 34:41"), (3, 16, "gece ~16")]:
    if 6 <= h <= 22:
        ax.plot(h, v, "o", color="#e8663d", ms=8, zorder=5); ax.annotate(lab, (h, v), textcoords="offset points", xytext=(6, 6), fontsize=8.5, color="#c4512c")
ax.axhline(22 + 59 / 60, color="#e8663d", lw=1, ls=":"); ax.text(20.3, 23.4, "TomTom yıllık ort. 22:59", fontsize=8, color="#c4512c")
ax.set_xlim(6, 22); ax.set_ylim(0, 38); ax.set_xticks(range(6, 23, 2), [f"{h:02d}:00" for h in range(6, 23, 2)])
ax.set_ylabel("10 km kaç dakika (park hariç)"); ax.legend(frameon=False, loc="upper left", fontsize=9)
for sp in ["top", "right"]:
    ax.spines[sp].set_visible(False)
ax.grid(axis="y", color="#eee"); ax.set_axisbelow(True)
ax.set_title("İzmir'de yol süresi: eski model ~2 kat hızlıydı; yeni model TomTom Trafik Endeksi 2025'e göre ayarlandı (park + bina girişi ayrıca 6 dk)", fontsize=10, loc="left")
fig.tight_layout(); fig.savefig(R / "trafik.png", dpi=140); print(R / "trafik.png")
