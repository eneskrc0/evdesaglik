"""Demo sayfası için sıkıştırılmış yol ağı (canlı takip rotaları tarayıcıda hesaplansın diye).

Girdi : Bornova -> data/bornova/drive.graphml ; İzmir -> data/izmir/ag.npz
        data/<dünya>/pool.npz (konum havuzu, 'node' = OSM düğüm kimliği)
Çıktı : web/graph_<dünya>.json
        Koordinatlar 1e-5 derece adımla uint16, kenarlar CSR (off uint32, tgt uint16),
        kenar süresi desisaniye uint16; hepsi base64. pool[i] = havuz noktası i'nin ağdaki sırası.
Kullanım: python3 sim/build_route_graph.py bornova|izmir
"""
import base64, json, os, sys
from pathlib import Path
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parents[1]
Q = 1e-5


def load(world):
    if world == "izmir":
        z = np.load(ROOT / "data/izmir/ag.npz")
        return z["node"], z["y"], z["x"], z["u"].astype(np.int64), z["v"].astype(np.int64), z["tt"].astype(np.float64)
    import osmnx as ox
    G = ox.load_graphml(ROOT / "data/bornova/drive.graphml")
    nodes = np.array(list(G.nodes))
    idx = {n: i for i, n in enumerate(nodes)}
    lat = np.array([G.nodes[n]["y"] for n in nodes]); lon = np.array([G.nodes[n]["x"] for n in nodes])
    u, v, tt = [], [], []
    for a, b, d in G.edges(data=True):
        u.append(idx[a]); v.append(idx[b]); tt.append(float(d["travel_time"]))
    return nodes, lat, lon, np.array(u), np.array(v), np.array(tt)


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def main(world):
    node, lat, lon, u, v, tt = load(world)
    _pf = ROOT / f"data/{world}/pool_{os.environ.get('OLCEK', '')}.npz"
    pool = np.load(_pf if os.environ.get("OLCEK") and _pf.exists() else ROOT / f"data/{world}/pool.npz")
    n = len(node)
    # paralel kenarlarda en kısa süre
    key = u * n + v
    o = np.lexsort((tt, key)); key, u, v, tt = key[o], u[o], v[o], tt[o]
    f = np.r_[True, key[1:] != key[:-1]]; u, v, tt = u[f], v[f], tt[f]
    # havuzu kapsayan kutu (+3 km) ve en büyük güçlü bağlı bileşen
    m = 0.03
    box = (lat > pool["lat"].min() - m) & (lat < pool["lat"].max() + m) & (lon > pool["lon"].min() - m) & (lon < pool["lon"].max() + m)
    e = box[u] & box[v]; u, v, tt = u[e], v[e], tt[e]
    M = csr_matrix((tt, (u, v)), shape=(n, n))
    _, lab = connected_components(M, directed=True, connection="strong")
    big = np.bincount(lab[box]).argmax() if box.any() else 0
    keep = (lab == big) & box
    pos = {int(nd): i for i, nd in enumerate(node)}
    pidx = np.array([pos[int(p)] for p in pool["node"]])
    assert keep[pidx].all(), "havuz noktası ağ dışında kaldı"
    new = -np.ones(n, dtype=np.int64); new[keep] = np.arange(keep.sum())
    e = keep[u] & keep[v]; u, v, tt = new[u[e]], new[v[e]], tt[e]
    k = int(keep.sum()); assert k < 65536
    o = np.argsort(u, kind="stable"); u, v, tt = u[o], v[o], tt[o]
    off = np.zeros(k + 1, dtype=np.uint32); np.add.at(off, u + 1, 1); off = np.cumsum(off).astype(np.uint32)
    la, lo = lat[keep], lon[keep]
    lat0, lon0 = float(la.min()), float(lo.min())
    out = dict(n=k, lat0=lat0, lon0=lon0, q=Q,
               lat=b64(np.round((la - lat0) / Q).astype(np.uint16)), lon=b64(np.round((lo - lon0) / Q).astype(np.uint16)),
               off=b64(off), tgt=b64(v.astype(np.uint16)), tt=b64(np.clip(np.round(tt * 10), 1, 65535).astype(np.uint16)),
               pool=b64(new[pidx].astype(np.uint16)))
    p = ROOT / f"web/graph_{world}.json"
    p.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{world}: {k} düğüm, {len(v)} kenar -> {p.name} {p.stat().st_size/1e6:.2f} MB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "bornova")
