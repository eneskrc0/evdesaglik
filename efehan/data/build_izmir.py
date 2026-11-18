"""Enes'in İzmir yol verisinden Kapıda için küçük bir paket üretir (bir kez çalıştırılır; numpy ister).

Girdi (enes/ — dokunulmaz):
  enes/data/izmir/pool_orta.npz  temiz konum havuzu: 1.200 gerçek yol noktası + aralarındaki serbest akış
                                 en kısa rota süresi (sn, OSM). Bkz. efehan/HARITA_VERISI.md
  enes/web/hospitals.json        50 hastane (OSM), `pi` = havuzdaki en yakın nokta
  enes/sim/geo.py                ilçe nüfusları (TÜİK) ve TomTom 2025 İzmir trafik eğrisi
Çıktı:
  efehan/data/seed/izmir_yol.json  K nokta (ilçe nüfusuna göre katmanlı seçim), K×K süre matrisi (uint16 sn,
                                   base64), trafik eğrisi, her nokta için en yakın 2 acil servis.
Çalıştır:  python efehan/data/build_izmir.py   (sonra python efehan/data/build_db.py)
"""
from __future__ import annotations

import base64
import json
import random
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ENES = ROOT / "enes"
OUT = Path(__file__).resolve().parent / "seed" / "izmir_yol.json"
OUT_HARITA = Path(__file__).resolve().parent / "seed" / "harita_izmir.json"
K = 240
SEED = 42


def geo_sabitleri() -> tuple[dict, list, float, float]:
    """enes/sim/geo.py'deki DISTRICT_POP, _TT10_HEDEF, _FF10 ve PARK_DK (izmir_tam) değerlerini okur."""
    src = (ENES / "sim" / "geo.py").read_text(encoding="utf-8")
    pop = dict(re.findall(r'"([^"]+)":\s*(\d+)', re.search(r"DISTRICT_POP = \{(.*?)\}", src, re.S).group(1)))
    tt10 = json.loads(re.search(r"_TT10_HEDEF = (\[.*?\])", src).group(1))
    ff10 = float(re.search(r"_FF10 = ([\d.]+)", src).group(1))
    park = float(re.search(r"PARK_DK = ([\d.]+) if TRAFIK_TOMTOM", src).group(1))
    return {k: int(v) for k, v in pop.items()}, tt10, ff10, park


def main() -> None:
    z = np.load(ENES / "data" / "izmir" / "pool_orta.npz")
    lat, lon, ilce, tt = z["lat"], z["lon"], [str(x) for x in z["ilce"]], z["tt"]
    hosp = json.loads((ENES / "web" / "hospitals.json").read_text(encoding="utf-8"))
    pop, tt10, ff10, park = geo_sabitleri()

    # İlçe nüfusuna orantılı katmanlı seçim (her ilçeden en az 6 nokta)
    rng = random.Random(SEED)
    by_d: dict[str, list[int]] = {}
    for i, d in enumerate(ilce):
        by_d.setdefault(d, []).append(i)
    toplam = sum(pop[d] for d in by_d)
    secim: list[int] = []
    for d in sorted(by_d):
        n = max(6, round(K * pop[d] / toplam))
        secim += rng.sample(by_d[d], min(n, len(by_d[d])))
    secim = secim[:K] if len(secim) > K else secim
    n = len(secim)
    alt = tt[np.ix_(secim, secim)]
    assert alt.max() < 65535, "süre uint16'ya sığmıyor"

    acil = [i for i, h in enumerate(hosp) if h["acil"]]
    yakin = []
    for p in secim:
        sira = sorted(acil, key=lambda h: float(tt[p, hosp[h]["pi"]]))[:2]
        yakin.append([[h, int(round(float(tt[p, hosp[h]["pi"]])))] for h in sira])
    kullanilan = sorted({h for y in yakin for h, _ in y})
    yeni = {h: j for j, h in enumerate(kullanilan)}

    paket = {
        "aciklama": "Kapıda için İzmir yol paketi — enes/ verisinden üretildi (efehan/data/build_izmir.py). Yol: © OpenStreetMap katkıcıları (ODbL). Trafik: TomTom Trafik Endeksi 2025 İzmir eğrisi (Enes'in modeli). Nüfus: TÜİK.",
        "noktalar": [[round(float(lat[p]), 6), round(float(lon[p]), 6), ilce[p]] for p in secim],
        "havuz_indeksi": [int(p) for p in secim],
        "tt_sn_b64": base64.b64encode(alt.astype("<u2").tobytes()).decode(),
        "trafik": {"tt10_dk": tt10, "ff10_dk": ff10, "park_dk": park},
        "ilceler": {d: {"nufus": pop[d], "lat": round(float(np.mean(lat[by_d[d]])), 4), "lon": round(float(np.mean(lon[by_d[d]])), 4)} for d in sorted(by_d)},
        "hastaneler": [{k: hosp[h][k] for k in ("ad", "turAd", "ilce", "lat", "lon")} for h in kullanilan],
        "en_yakin_acil": [[[yeni[h], s] for h, s in y] for y in yakin],
    }
    OUT.write_text(json.dumps(paket, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT} — {n} nokta, {len(kullanilan)} acil servis, {OUT.stat().st_size // 1024} KB")

    # Harita + sokak rotası (Kapıda arayüzü için): Enes'in roads_izmir.json çizimi ve graph_izmir.json yol grafiği
    roads = json.loads((ENES / "web" / "roads_izmir.json").read_text(encoding="utf-8"))
    graph = json.loads((ENES / "web" / "graph_izmir.json").read_text(encoding="utf-8"))
    gpool = np.frombuffer(base64.b64decode(graph["pool"]), dtype="<u2")
    assert len(gpool) == len(lat), "graph_izmir.json havuzu pool_orta ile aynı olmalı"
    harita = {
        "aciklama": "Harita ve yol grafiği: © OpenStreetMap katkıcıları (ODbL); enes/web/roads_izmir.json ve graph_izmir.json'dan.",
        "view": roads["view"], "W": roads["W"], "H": roads["H"],
        "major": roads["major"], "minor": roads["minor"], "border": roads["border"], "labels": roads["labels"],
        "graph": {k: graph[k] for k in ("n", "lat0", "lon0", "q", "lat", "lon", "off", "tgt", "tt")},
        "dugum": [int(gpool[p]) for p in secim],  # Kapıda noktası i -> yol grafiği düğümü
    }
    OUT_HARITA.write_text(json.dumps(harita, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT_HARITA} — {OUT_HARITA.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
