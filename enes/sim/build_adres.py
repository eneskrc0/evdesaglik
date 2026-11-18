"""Çevrimdışı adres arama verisi: OpenStreetMap sokak / cadde / mahalle adları → web/adres_izmir.json.

Girdi: Overpass API'den indirilen JSON (way[highway][name], ilçe/mahalle sınırları ve place düğümleri; 'out tags center').
  python -m sim.build_adres /yol/interpreter
Çıktı (demoya gömülür): {"i": [ilçe adları], "m": [[mahalle, lat, lon, ilçe_i]], "s": [[sokak, lat, lon, mahalle_i, ilçe_i]]}
- Aynı adlı sokak parçaları 700 m içinde tek kayda birleşir (merkezleri ortalaması); uzaktaki aynı adlar (ör. her ilçedeki
  "1. Sokak") ayrı kalır ve mahalle/ilçe ile ayırt edilir.
- İlçe: data/izmir/ilceler.geojson içinde nokta testi. Mahalle: aynı ilçedeki en yakın mahalle merkezi (yaklaşık).
Harita verisi © OpenStreetMap katkıcıları (ODbL).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
KX, KY = 111320.0 * np.cos(np.radians(38.42)), 110540.0
TUR = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service",
       "pedestrian", "footway", "path", "track", "steps", "motorway_link", "trunk_link", "primary_link", "secondary_link",
       "tertiary_link", "road", "cycleway"}
ATLA = {"footway", "path", "track", "steps", "cycleway", "service"}  # adlı olsa da adres değil (site yolları hariç tutulur)


def _pip(lon, lat, ring):
    x, y = np.asarray(ring)[:, 0], np.asarray(ring)[:, 1]
    j = np.roll(np.arange(len(x)), 1)
    c = ((y > lat) != (y[j] > lat)) & (lon < (x[j] - x) * (lat - y) / (y[j] - y + 1e-15) + x)
    return bool(c.sum() % 2)


def load_ilceler():
    g = json.loads((ROOT / "data" / "izmir" / "ilceler.geojson").read_text())
    out = []
    for f in g["features"]:
        p = f["properties"]
        name = p.get("name") or p.get("ad") or p.get("ilce") or next(iter(p.values()))
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        out.append((str(name), [poly[0] for poly in polys]))
    return out


def ilce_of(lat, lon, ilceler):
    for i, (_, rings) in enumerate(ilceler):
        if any(_pip(lon, lat, r) for r in rings):
            return i
    return -1


def main(src):
    d = json.loads(Path(src).read_text(encoding="utf-8"))
    els = d["elements"]
    ilceler = load_ilceler()
    inames = [n for n, _ in ilceler]

    def ll(e):
        if "center" in e:
            return e["center"]["lat"], e["center"]["lon"]
        return e.get("lat"), e.get("lon")

    # mahalleler
    mah = []
    for e in els:
        t = e.get("tags", {})
        nm = t.get("name")
        if not nm:
            continue
        la, lo = ll(e)
        if la is None:
            continue
        if (e["type"] == "relation" and t.get("admin_level") == "8") or (e["type"] == "node" and t.get("place") in ("neighbourhood", "suburb", "quarter", "village")):
            mah.append([nm, la, lo])
    # aynı ad 1,5 km içinde tekrar etmesin (sınır + düğüm)
    seen, M = [], []
    for nm, la, lo in mah:
        nm = nm.strip()
        for suf in (" Mah.", " Mah", " Mh.", " Mh"):
            if nm.endswith(suf):
                nm = nm[: -len(suf)]
        key = nm.replace(" Mahallesi", "").strip()
        if any(k == key and abs(a - la) < 0.014 and abs(b - lo) < 0.018 for k, a, b in seen):
            continue
        seen.append((key, la, lo))
        M.append([nm if "Mahalle" in nm else nm + " Mahallesi", round(la, 5), round(lo, 5), ilce_of(la, lo, ilceler)])
    M = [m for m in M if m[3] >= 0]
    mxy = np.array([[m[2] * KX, m[1] * KY] for m in M]) if M else np.zeros((0, 2))
    mil = np.array([m[3] for m in M])

    # sokaklar
    by = defaultdict(list)
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "way" or "highway" not in t or t["highway"] not in TUR or t["highway"] in ATLA:
            continue
        nm = t.get("name")
        la, lo = ll(e)
        if not nm or la is None:
            continue
        by[nm.strip()].append((la, lo))
    S = []
    for nm, pts in by.items():
        P = np.array([[lo * KX, la * KY] for la, lo in pts])
        # 700 m tek bağlantı kümeleme
        tr = cKDTree(P)
        lab = -np.ones(len(P), int)
        c = 0
        for i in range(len(P)):
            if lab[i] >= 0:
                continue
            st = [i]
            lab[i] = c
            while st:
                k = st.pop()
                for j in tr.query_ball_point(P[k], 700):
                    if lab[j] < 0:
                        lab[j] = c
                        st.append(j)
            c += 1
        for k in range(c):
            q = P[lab == k].mean(0)
            la, lo = q[1] / KY, q[0] / KX
            ii = ilce_of(la, lo, ilceler)
            if ii < 0:
                continue
            mi = -1
            if len(M):
                same = np.where(mil == ii)[0]
                cand = same if len(same) else np.arange(len(M))
                dd = np.hypot(*(mxy[cand] - q).T)
                if dd.min() < 3000:
                    mi = int(cand[dd.argmin()])
            S.append([nm, round(la, 5), round(lo, 5), mi, ii])
    obj = {"i": inames, "m": M, "s": S, "kaynak": "© OpenStreetMap katkıcıları (ODbL)"}
    out = ROOT / "web" / "adres_izmir.json"
    out.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    print(f"yazıldı: {out} {out.stat().st_size / 1e6:.2f} MB · {len(inames)} ilçe, {len(M)} mahalle, {len(S)} sokak/cadde kaydı")


if __name__ == "__main__":
    main(sys.argv[1])
