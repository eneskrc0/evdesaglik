"""Gerçek Bornova yol ağından simülasyon verisi üretir.

Girdi:  data/bornova/drive.graphml  (osmnx, network_type="drive")
        data/bornova/sinir.geojson  (Bornova idari sınırı)
Çıktı:  data/bornova/pool.npz — Bornova içindeki N konum (yol düğümü) ve aralarındaki
                             serbest akış yol süreleri (sn), tek yönlü yollar dahil
        web/roads_bornova.json — demo sayfası için yol çizgileri ve süre matrisi

Kullanım: python -m sim.build_roads --n 600
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import networkx as nx
import numpy as np
import osmnx as ox
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from shapely.geometry import LineString, Point, box, shape

ROOT = Path(__file__).resolve().parent.parent
MAJOR = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
         "secondary", "secondary_link", "tertiary", "tertiary_link"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=600, help="konum havuzu büyüklüğü")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    G = ox.load_graphml(ROOT / "data/bornova/drive.graphml")
    G = G.subgraph(max(nx.strongly_connected_components(G), key=len)).copy()
    poly = shape(json.load(open(ROOT / "data/bornova/sinir.geojson"))["features"][0]["geometry"])

    nodes = list(G.nodes)
    idx = {n: i for i, n in enumerate(nodes)}
    lat = np.array([G.nodes[n]["y"] for n in nodes])
    lon = np.array([G.nodes[n]["x"] for n in nodes])
    inside = np.array([poly.contains(Point(x, y)) for x, y in zip(lon, lat)])
    print(f"Ağ: {len(nodes)} düğüm, Bornova içinde {inside.sum()}")

    # Yol süresi grafiği (paralel kenarlarda en kısa süre)
    w = {}
    for u, v, d in G.edges(data=True):
        k = (idx[u], idx[v])
        t = float(d["travel_time"])
        if k not in w or t < w[k]:
            w[k] = t
    r, c = zip(*w.keys())
    M = csr_matrix((list(w.values()), (r, c)), shape=(len(nodes), len(nodes)))

    # Konum havuzu: Bornova içindeki düğümlerden rastgele (yol yoğunluğu ~ nüfus yoğunluğu vekili)
    rng = np.random.default_rng(args.seed)
    cand = np.flatnonzero(inside)
    pool = np.sort(rng.choice(cand, size=min(args.n, len(cand)), replace=False))
    D = dijkstra(M, directed=True, indices=pool)[:, pool].astype(np.float32)
    assert np.isfinite(D).all(), "havuzda erişilemeyen düğüm var"
    np.savez_compressed(ROOT / "data/bornova/pool.npz", lat=lat[pool], lon=lon[pool],
                        node=np.array([nodes[i] for i in pool]), tt=D)
    print(f"Havuz: {len(pool)} konum; ort. yol süresi {D[D > 0].mean() / 60:.1f} dk, "
          f"en uzun {D.max() / 60:.1f} dk (serbest akış)")

    # ---- Demo sayfası için yol çizgileri ----
    pad = 0.004
    view = dict(minLat=float(lat[pool].min() - pad), maxLat=float(lat[pool].max() + pad),
                minLon=float(lon[pool].min() - pad), maxLon=float(lon[pool].max() + pad))
    W = 600.0
    sx = W / (view["maxLon"] - view["minLon"])
    sy = sx / np.cos(np.radians((view["minLat"] + view["maxLat"]) / 2))
    H = (view["maxLat"] - view["minLat"]) * sy

    def pt(x, y):
        return f"{(x - view['minLon']) * sx:.1f} {(view['maxLat'] - y) * sy:.1f}"

    vbox = box(view["minLon"], view["minLat"], view["maxLon"], view["maxLat"])
    major, minor = [], []
    seen = set()
    for u, v, d in G.edges(data=True):
        key = tuple(sorted((u, v)))
        if key in seen:
            continue
        seen.add(key)
        h = d.get("highway")
        h = h[0] if isinstance(h, list) else h
        geom = d.get("geometry") or LineString([(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])])
        if not geom.intersects(vbox):
            continue
        is_major = h in MAJOR
        g = geom.simplify(0.00008 if is_major else 0.00015)
        coords = list(g.coords)
        s = "M" + pt(*coords[0]) + "".join("L" + pt(*p) for p in coords[1:])
        (major if is_major else minor).append(s)

    clipped = poly.intersection(vbox)
    rings = [clipped.exterior] if clipped.geom_type == "Polygon" else [p.exterior for p in clipped.geoms]
    border = "".join("M" + pt(*r.coords[0]) + "".join("L" + pt(*p) for p in r.coords[1:]) + "Z" for r in rings)
    # Sınır çokgeni (görünüm içinde) — enlem/boylam olarak, tıklama kontrolü için
    border_ll = [[round(y, 5), round(x, 5)] for x, y in rings[0].coords]

    tt_sec = np.clip(np.round(D), 0, 65535).astype("<u2")
    out = dict(view=view, W=W, H=float(H), major="".join(major), minor="".join(minor), border=border,
               borderLL=border_ll, pool=[[round(float(a), 6), round(float(b), 6)] for a, b in zip(lat[pool], lon[pool])],
               tt=base64.b64encode(tt_sec.tobytes()).decode())
    (ROOT / "web").mkdir(exist_ok=True)
    json.dump(out, open(ROOT / "web/roads_bornova.json", "w"), separators=(",", ":"))
    size = (ROOT / "web/roads_bornova.json").stat().st_size / 1e6
    print(f"web/roads.json: {size:.2f} MB ({len(major)} ana yol, {len(minor)} ara sokak parçası)")


if __name__ == "__main__":
    main()
