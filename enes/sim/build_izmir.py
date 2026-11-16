"""Merkez İzmir (11 ilçe) simülasyon verisi.

Girdi:  data/izmir/ag.npz          (Colab'da osmnx ile üretilen sıkıştırılmış yol ağı)
        data/izmir/ilceler.geojson (11 ilçe sınırı)
        data/izmir/anayollar.geojson (harita çizimi için ana yollar)
Çıktı:  data/izmir/pool.npz        (N konum, ilçe adı, aralarındaki en kısa rota süreleri, sn)
        web/roads_izmir.json       (demo sayfası: ana yollar, ilçe sınırları, süre matrisi)

Kullanım: python -m sim.build_izmir --n 1200
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from shapely.geometry import box, shape
from shapely.prepared import prep
from shapely import points as shp_points

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data" / "izmir"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1200)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()

    z = np.load(D / "ag.npz", allow_pickle=False)
    x, y, u, v, tt = z["x"], z["y"], z["u"], z["v"], z["tt"].astype(np.float64)
    n = len(x)
    # paralel kenarlarda en kısa süre
    key = u.astype(np.int64) * n + v
    order = np.lexsort((tt, key))
    key, u2, v2, tt2 = key[order], u[order], v[order], tt[order]
    first = np.r_[True, key[1:] != key[:-1]]
    M = csr_matrix((tt2[first], (u2[first], v2[first])), shape=(n, n))
    ncomp, lab = connected_components(M, directed=True, connection="strong")
    big = np.bincount(lab).argmax()
    in_scc = lab == big
    print(f"Ağ: {n} düğüm, {len(u)} kenar; en büyük güçlü bağlı bileşen {in_scc.sum()} düğüm")

    feats = json.load(open(D / "ilceler.geojson"))["features"]
    names = [f["properties"]["ilce"] for f in feats]
    polys = [shape(f["geometry"]) for f in feats]
    pts = shp_points(x, y)
    district = np.full(n, "", dtype=object)
    for nm, pg in zip(names, polys):
        pp = prep(pg)
        mask = np.array([pp.contains(p) for p in pts])
        district[mask & (district == "")] = nm
    cand = np.flatnonzero(in_scc & (district != ""))
    print("İlçelere göre aday düğüm:", {nm: int((district[cand] == nm).sum()) for nm in names})

    rng = np.random.default_rng(a.seed)
    pool = np.sort(rng.choice(cand, size=min(a.n, len(cand)), replace=False))
    Dm = dijkstra(M, directed=True, indices=pool)[:, pool].astype(np.float32)
    assert np.isfinite(Dm).all()
    ilce = np.array([district[i] for i in pool])
    np.savez_compressed(D / "pool.npz", lat=y[pool], lon=x[pool], node=z["node"][pool], tt=Dm, ilce=ilce)
    print(f"Havuz: {len(pool)} konum; ort. süre {Dm[Dm > 0].mean() / 60:.1f} dk, en uzun {Dm.max() / 60:.1f} dk")
    print("Havuzda ilçe dağılımı:", {nm: int((ilce == nm).sum()) for nm in names})

    # ---- demo sayfası ----
    pad = 0.006
    view = dict(minLat=float(y[pool].min() - pad), maxLat=float(y[pool].max() + pad),
                minLon=float(x[pool].min() - pad), maxLon=float(x[pool].max() + pad))
    W = 600.0
    sx = W / (view["maxLon"] - view["minLon"])
    sy = sx / np.cos(np.radians((view["minLat"] + view["maxLat"]) / 2))
    H = (view["maxLat"] - view["minLat"]) * sy

    def pt(lon, lat):
        return f"{(lon - view['minLon']) * sx:.1f} {(view['maxLat'] - lat) * sy:.1f}"

    vb = box(view["minLon"], view["minLat"], view["maxLon"], view["maxLat"])
    roads = json.load(open(D / "anayollar.geojson"))["features"]
    big_r, small_r = [], []
    for f in roads:
        g = shape(f["geometry"])
        if not g.intersects(vb):
            continue
        h = f["properties"].get("h", "")
        g = g.simplify(0.0002)
        lines = [g] if g.geom_type == "LineString" else list(getattr(g, "geoms", []))
        for ln in lines:
            c = list(ln.coords)
            if len(c) < 2:
                continue
            s = "M" + pt(*c[0]) + "".join("L" + pt(*q) for q in c[1:])
            (big_r if h in ("motorway", "trunk", "primary") else small_r).append(s)
    borders, labels = [], []
    for nm, pg in zip(names, polys):
        geoms = [pg] if pg.geom_type == "Polygon" else list(pg.geoms)
        for gg in geoms:
            gg = gg.simplify(0.0005)
            r = gg.exterior.coords
            borders.append("M" + pt(*r[0]) + "".join("L" + pt(*q) for q in r[1:]) + "Z")
        c = pg.representative_point()
        labels.append({"ad": nm, "lat": round(c.y, 5), "lon": round(c.x, 5)})
    tt_sec = np.clip(np.round(Dm), 0, 65535).astype("<u2")
    out = dict(world="izmir", view=view, W=W, H=float(H), major="".join(big_r), minor="".join(small_r),
               border="".join(borders), labels=labels,
               pool=[[round(float(p), 6), round(float(q), 6)] for p, q in zip(y[pool], x[pool])],
               ilce=[str(s) for s in ilce], tt=base64.b64encode(tt_sec.tobytes()).decode())
    json.dump(out, open(ROOT / "web/roads_izmir.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"web/roads_izmir.json: {(ROOT / 'web/roads_izmir.json').stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
