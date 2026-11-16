"""izmir_orta için hızlı ayar araması: yalnızca baz senaryo, geliştirme tohumları (0-9).
Her yapılandırma results/<dünya>/arama/<ad>.csv olarak saklanır (varsa yeniden çalıştırılmaz).
Son adım (doğrulama) sim.track ile tüm senaryolar + ayrılmış tohumlarla yapılır.

Kullanım: DUNYA=izmir OLCEK=orta python -m sim.search_orta [özet]
"""
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pandas as pd

from . import geo
from .experiment import run_seed

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "results" / geo.WORLD_TAG / "arama"
SEEDS = list(range(10))
V5 = "a=0.6,b=0.06,c=0.15,alpha=0.95,base=3"

CONFIGS = {
    # sürümler
    "v1": "gbm_v1", "v2": "v2_adil", "v3": "v3_garanti", "v4": "v4_mesafe", "v5": "v5_denge",
    # v1 + kota (sert = kota dolunca hiç bildirim yok, yumuşak = sıranın sonuna)
    **{f"v1_bkota{n}": f"gbm_v1_bkota{n}" for n in (4, 6, 8, 10)},
    **{f"v1_zkota{n}": f"gbm_v1_zkota{n}" for n in (2, 3, 4, 5)},
    **{f"v1_yzkota{n}": f"gbm_v1_yzkota{n}" for n in (2, 3)},
    # v5 + kota
    **{f"v5_zkota{n}": f"pol:{V5},vc={n}" for n in (2, 3, 4, 5, 6)},
    **{f"v5_yzkota{n}": f"pol:{V5},vc={n},soft=1" for n in (2, 3, 4, 5)},
    **{f"v5_bkota{n}": f"pol:{V5},nc={n}" for n in (6, 8, 10)},
    # v5 parametre ızgarası (a: yol cezası, b: bildirim yükü, c: ziyaret yükü)
    **{f"v5_a{a}_b{b}_c{c}": f"pol:a={a},b={b},c={c},alpha=0.95,base=3"
       for a in (0.3, 0.9) for b in (0.03, 0.12) for c in (0.08, 0.3)},
}
COLS = {"uygun_teklif_5dk": "5dk_uygun", "eslesmeyen_oran": "eslesmeyen", "zamaninda_ziyaret": "zamaninda",
        "bildirim_gini": "bildirim_gini", "hemsire_kazanc_gini": "kazanc_gini", "hemsire_issiz_gun_orani": "issiz_gun",
        "hemsire_gunluk_is_maks": "maks_is", "yol_dk_ort": "yol_dk"}


def _job(args):
    model, s = args
    return [r for r in run_seed("baz", s, model_name=model) if r["yontem"] in ("model", "en_erken")]


def run(names):
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [n for n in names if not (OUT / f"{n}.csv").exists()]
    with ProcessPoolExecutor(os.cpu_count()) as ex:
        for n in todo:
            rows = [r for rs in ex.map(_job, [(CONFIGS[n], s) for s in SEEDS]) for r in rs]
            pd.DataFrame(rows).to_csv(OUT / f"{n}.csv", index=False)
            print("bitti:", n, flush=True)


def summary():
    rows = []
    for n in CONFIGS:
        p = OUT / f"{n}.csv"
        if not p.exists():
            continue
        d = pd.read_csv(p)
        for yontem, label in (("model", n), ("en_erken", "kural_en_erken")):
            g = d[d.yontem == yontem]
            if label == "kural_en_erken" and any(r["ayar"] == label for r in rows):
                continue
            r = {"ayar": label}
            for k, v in COLS.items():
                if k in g:
                    r[v] = g[k].mean()
            rows.append(r)
    t = pd.DataFrame(rows)
    t.to_csv(OUT.parent / "arama_ozet.csv", index=False)
    return t


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "özet":
        pd.set_option("display.width", 200)
        print(summary().round(3).to_string(index=False))
    else:
        run(list(CONFIGS))
        print(summary().round(3).to_string(index=False))
