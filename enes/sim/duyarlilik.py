"""Duyarlılık testi (izmir_orta havuzu): çalışan sayısı × talep yoğunluğu ızgarasında yöntem karşılaştırması.

Çalışan seviyesi: orta ölçeğin (80 hemşire, 25 doktor, 20 fizyoterapist) 0,5 / 1 / 2 katı.
Talep yoğunluğu: çalışan başına günlük talep 0,8 (sakin) / 1,25 (normal) / 2,0 (yoğun).
Yöntemler: klasik kural (en erken varış), v1, ayarlı v5 (a=0.9, b=0.03, c=0.08) kotasız ve günlük ziyaret kotası 3/4/5/6/8.
Baz senaryo, geliştirme tohumları 0-9. Sonuç: results/izmir_orta/duyarlilik.csv

Kullanım: DUNYA=izmir OLCEK=orta python -m sim.duyarlilik [özet]
"""
import dataclasses
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pandas as pd

from . import geo, world
from .experiment import run_seed

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "results" / geo.WORLD_TAG / "duyarlilik"
SEEDS = list(range(10))
STAFF = {"küçük": 0.5, "orta": 1.0, "büyük": 2.0}
LOAD = {"sakin": 0.8, "normal": 1.25, "yoğun": 2.0}
AY = "a=0.9,b=0.03,c=0.08,alpha=0.95,base=3"
CONFIGS = {"v1": "gbm_v1", "ayarli": f"pol:{AY}", **{f"ayarli_kota{n}": f"pol:{AY},vc={n}" for n in (3, 4, 5, 6, 8)},
           "ayarli_ukota": f"pol:{AY},vc=-1"}


def cell_scenario(staff, load):
    b = world.SCENARIOS["baz"]
    n, d, f = round(80 * STAFF[staff]), round(25 * STAFF[staff]), round(20 * STAFF[staff])
    return dataclasses.replace(b, n_nurses=n, n_doctors=d, n_physio=f, requests_per_day=round(LOAD[load] * (n + d + f)))


def _job(args):
    staff, load, model, s = args
    world.SCENARIOS["baz"] = cell_scenario(staff, load)
    import sim.experiment as ex
    ex.SCENARIOS["baz"] = world.SCENARIOS["baz"]
    rows = [r for r in run_seed("baz", s, model_name=model) if r["yontem"] in ("model", "en_erken")]
    for r in rows:
        r.update(calisan=staff, talep=load)
    return rows


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(os.cpu_count()) as ex:
        for staff in STAFF:
            for load in LOAD:
                for name, model in CONFIGS.items():
                    p = OUT / f"{staff}_{load}_{name}.csv"
                    if p.exists():
                        continue
                    rows = [r for rs in ex.map(_job, [(staff, load, model, s) for s in SEEDS]) for r in rs]
                    pd.DataFrame(rows).to_csv(p, index=False)
                    print("bitti:", staff, load, name, flush=True)


def summary():
    rows = []
    for staff in STAFF:
        for load in LOAD:
            sc = cell_scenario(staff, load)
            for name in CONFIGS:
                p = OUT / f"{staff}_{load}_{name}.csv"
                if not p.exists():
                    continue
                d = pd.read_csv(p)
                for yontem, label in (("model", name), ("en_erken", "kural")):
                    if label == "kural" and any(r["calisan"] == staff and r["talep"] == load and r["yontem"] == "kural" for r in rows):
                        continue
                    g = d[d.yontem == yontem]
                    S, G = g.uygun_teklif_5dk.mean(), g.hemsire_kazanc_gini.mean()
                    rows.append({"calisan": staff, "talep": load, "hemsire": sc.n_nurses, "doktor": sc.n_doctors,
                                 "fizyo": sc.n_physio, "talep_gun": sc.requests_per_day, "yontem": label,
                                 "basari": S, "eslesmeyen": g.eslesmeyen_oran.mean(), "zamaninda": g.zamaninda_ziyaret.mean(),
                                 "kazanc_gini": G, "bildirim_gini": g.bildirim_gini.mean(),
                                 "maks_is": g.hemsire_gunluk_is_maks.mean(), "issiz_gun": g.hemsire_issiz_gun_orani.mean(),
                                 "yol_dk": g.yol_dk_ort.mean(), "adil_basari": S * (1 - G / 2)})
    t = pd.DataFrame(rows)
    t.to_csv(OUT.parent / "duyarlilik.csv", index=False)
    return t


if __name__ == "__main__":
    if not (len(sys.argv) > 1 and sys.argv[1] == "özet"):
        run()
    pd.set_option("display.width", 220)
    print(summary().round(3).to_string(index=False))
