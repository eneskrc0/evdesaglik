"""İzmir toplu taşıma süre matrisi (GTFS: ESHOT otobüs, Metro, Tramvay, İZBAN).

Çalışan arabası yoksa havuz noktaları arasında "kapıdan kapıya" toplu taşıma süresini hesaplar:
    yürü (durağa) + bekle (sefer aralığının yarısı) + araçta + aktarma (yürü + bekle) + yürü (adrese)
Her saat dilimi için ayrı matris: sabah zirvesi, gündüz, akşam zirvesi, gece.

Model (sefer aralığı tabanlı, "frekans" yaklaşımı):
- Düğümler: havuz noktaları + duraklar + (hat, yön, durak) "araçtayım" düğümleri.
- Bin: durak → hat-durak, maliyet = min(aralık/2, BEKLE_MAX) + BINIS_CEZA.
  Aralık = o dilimde, o duraktan aynı sonraki durağa giden TÜM hatların sefer sayısından (ortak sıklık; yolcu ilk gelene biner).
- Araçta: ardışık iki durak arası, o dilimdeki seferlerin medyan süresi.
  Otobüs trafiğe takılır: tarifedeki süre zirvede ×OTOBUS_ZIRVE (raylı sistem etkilenmez).
- İn: hat-durak → durak, 0.
- Yürüme: 4,5 km/s, kuş uçuşu ×1,3. Durak-durak aktarma ≤ 400 m; adres-durak ≤ 1000 m.
- Doğrudan yürüme de bir seçenek (yakın adresler).

Takvim: ESHOT eylül–ekim 2026 tarifesi, Metro/Tramvay 2026–27, İZBAN dosyasının tarihi geçmiş
(2022–2025) ama hat ve sefer yapısı kullanılır. Hepsinde hafta içi servisi alınır.

Kullanım:
    OLCEK=orta python -m sim.build_transit --gtfs /yol/gtfs   # 4 klasör: bus-eshot-gtfs, rail-*
Çıktı: data/izmir/transit_orta.npz  (tt_d[dilim, i, j] desidakika uint16; mode[...] 0=yürü 1=toplu)
       web/transit_izmir.json        (demo için sıkıştırılmış hat/durak verisi)
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import math
import os
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
FEEDS = {  # klasör: (kısa ad, mod)
    "bus-eshot-gtfs": ("ESHOT", "otobus"),
    "rail-metro-gtfs": ("Metro", "metro"),
    "rail-tramizmir-gtfs": ("Tramvay", "tramvay"),
    "rail-izban-gtfs": ("İZBAN", "izban"),
    "ship-izdeniz-gtfs": ("İZDENİZ", "vapur"),  # varsa (klasör yoksa atlanır)
}
HAFTAICI = {"3633", "WEEKDAY", "WEEKDAYS", "DAYSOFWEEK"}
DILIMLER = [("sabah", 7 * 60, 10 * 60), ("gunduz", 10 * 60, 16 * 60), ("aksam", 16 * 60, 20 * 60), ("gece", 20 * 60, 23 * 60)]
YURUME_KMH = 4.5
DOLAMBAC = 1.3
ERISIM_M = 1000
AKTARMA_M = 400
BEKLE_MAX = 12.0  # seyrek hatta insan saate bakıp çıkar: bekleme tavanı
BINIS_CEZA = 1.5  # her biniş (aktarma rahatsızlığı dahil)
OTOBUS_ZIRVE = {"sabah": 1.25, "gunduz": 1.10, "aksam": 1.35, "gece": 1.0}  # tarifeye ek trafik payı
BINA_DK = 2.0  # duraktan sonra bina girişi/kapı
ORTAK_SIKLIK = True  # aynı durak→sonraki durak hatlarının sıklığı birleşik (bekleme = ortak aralık/2)


def _rd(p):
    with open(p, encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def _sec(s):
    h, m, x = s.split(":")
    return int(h) * 60 + int(m) + int(x) / 60.0


def walk_min(m):
    return m * DOLAMBAC / 1000.0 / YURUME_KMH * 60.0


def load_feeds(gdir: Path):
    stops = []  # (ad, lat, lon, feed)
    sid_map = {}
    # (feed, route_id, dir) -> bilgi
    lines = {}
    # segment: (hat_key, s_from, s_to) -> {dilim: [süreler]}
    seg = defaultdict(lambda: defaultdict(list))
    # geçiş: (hat_key, stop) -> {dilim: sefer sayısı}
    passes = defaultdict(lambda: defaultdict(int))
    patterns = defaultdict(lambda: defaultdict(int))  # hat_key -> {durak dizisi: sefer sayısı}
    for folder, (fname, mode) in FEEDS.items():
        d = gdir / folder
        if not d.exists():
            print(f"  {fname}: klasör yok, atlandı")
            continue
        servis = set(HAFTAICI)
        tr_srv = {r["service_id"] for r in _rd(d / "trips.txt")}
        if not (tr_srv & servis) and (d / "calendar.txt").exists():
            # bilinen ad yoksa: pazartesi çalışan servisler (hafta içi)
            servis = {r["service_id"] for r in _rd(d / "calendar.txt") if r.get("monday") == "1"} or tr_srv
        for r in _rd(d / "stops.txt"):
            if r.get("location_type") not in (None, "", "0"):
                continue
            sid_map[(fname, r["stop_id"])] = len(stops)
            stops.append((r["stop_name"], float(r["stop_lat"]), float(r["stop_lon"]), fname))
        rinfo = {}
        for r in _rd(d / "routes.txt"):
            rinfo[r["route_id"]] = (r.get("route_short_name") or "", r.get("route_long_name") or "", r.get("route_color") or "")
        trips = {}
        for r in _rd(d / "trips.txt"):
            if r["service_id"] not in servis:
                continue
            key = (fname, r["route_id"], r.get("direction_id") or "0")
            trips[r["trip_id"]] = key
            if key not in lines:
                sn, ln, col = rinfo.get(r["route_id"], ("", "", ""))
                lines[key] = {"feed": fname, "mode": mode, "kisa": sn, "ad": ln, "renk": col, "yon": key[2],
                              "basligi": r.get("trip_headsign") or ""}
        # İZBAN'da DAYSOFWEEK ve WEEKDAYS aynı seferleri ikiler mi? sefer kimliği tekil olduğundan sorun yok.
        cur, buf = None, []

        def flush(tid, rows):
            if tid not in trips or len(rows) < 2:
                return
            key = trips[tid]
            rows.sort(key=lambda x: x[0])
            seq = []
            for k in range(len(rows)):
                _, sidx, arr, dep = rows[k]
                if sidx is None:
                    continue
                seq.append(sidx)
                b = _bucket(dep)
                if b is not None:
                    passes[(key, sidx)][b] += 1
                if k + 1 < len(rows) and rows[k + 1][1] is not None:
                    nxt = rows[k + 1]
                    dt = nxt[2] - dep
                    if b is not None and 0 <= dt < 60:
                        seg[(key, sidx, nxt[1])][b].append(max(dt, 0.3))
            patterns[key][tuple(seq)] += 1

        for r in _rd(d / "stop_times.txt"):
            tid = r["trip_id"]
            if tid != cur:
                if cur is not None:
                    flush(cur, buf)
                cur, buf = tid, []
            if tid not in trips:
                continue
            buf.append((int(r["stop_sequence"]), sid_map.get((fname, r["stop_id"])), _sec(r["arrival_time"]), _sec(r["departure_time"])))
        flush(cur, buf)
        print(f"  {fname}: {sum(1 for k in lines if k[0] == fname)} hat-yön, {sum(1 for t in trips)} hafta içi sefer")
    return stops, lines, seg, passes, patterns


def _bucket(t):
    t = t % (24 * 60)
    for i, (_, a, b) in enumerate(DILIMLER):
        if a <= t < b:
            return i
    return None


LAT0 = 38.42
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110540.0


def to_xy(lat, lon):
    """Metre cinsinden tam sayı düzlem koordinatı (JS ile birebir aynı)."""
    return np.c_[np.round(np.asarray(lon, float) * KX), np.round(np.asarray(lat, float) * KY)].astype(np.int64)


def walk_dmin(dm):
    """Yürüme süresi, desidakika (0,1 dk) tam sayı. JS: Math.floor(x*10+0.5)."""
    return np.floor(np.asarray(dm, float) * DOLAMBAC / 1000.0 / YURUME_KMH * 60.0 * 10 + 0.5).astype(np.int64)


def build_net(gdir: Path):
    """Sıkıştırılmış ağ: duraklar, hat-durak düğümleri, araç kenarları, dilim başına biniş maliyeti.
    Tüm ağırlıklar desidakika tam sayı; Python matrisi ve JS demo bu ağdan aynı Dijkstra'yı yapar."""
    stops, lines, seg, passes, patterns = load_feeds(gdir)
    keys = list(lines)
    kidx = {k: i for i, k in enumerate(keys)}
    rs = {}
    for (key, a, b) in seg:
        for s_ in (a, b):
            rs.setdefault((key, s_), len(rs))
    for (key, s_) in passes:
        if (key, s_) in rs:
            continue
    nb = len(DILIMLER)
    # Ortak hat sıklığı: aynı duraktan aynı sonraki durağa giden tüm hatlar birlikte sayılır (yolcu ilk gelene biner).
    # Her hat-durak için en sık sonraki durak; grup = (durak, sonraki durak); grup sefer sayısı = üyelerin toplamı.
    succ_n = defaultdict(lambda: defaultdict(int))
    for (key, s1, s2), d in seg.items():
        succ_n[(key, s1)][s2] += sum(len(l) for l in d.values())
    grp = {}
    for (key, s_) in rs:
        nx = succ_n.get((key, s_))
        grp[(key, s_)] = (s_, max(nx, key=nx.get)) if nx else None
    gpass = defaultdict(lambda: [0] * nb)
    for k, g in grp.items():
        if g is None:
            continue
        for bi in range(nb):
            gpass[g][bi] += passes.get(k, {}).get(bi, 0)
    rs_stop = np.zeros(len(rs), np.int32)
    rs_line = np.zeros(len(rs), np.int32)
    board = np.zeros((len(rs), nb), np.int32)  # 0 = bu dilimde biniş yok
    for (key, s_), n in rs.items():
        rs_stop[n] = s_
        rs_line[n] = kidx[key]
        for bi, (_, a, b) in enumerate(DILIMLER):
            c = passes.get((key, s_), {}).get(bi, 0)
            if c > 0:
                g = grp.get((key, s_))
                cg = max(c, gpass[g][bi]) if (ORTAK_SIKLIK and g is not None) else c
                h = (b - a) / cg
                board[n, bi] = int(math.floor((min(h / 2, BEKLE_MAX) + BINIS_CEZA) * 10 + 0.5))
    ride = []
    for (key, s1, s2), d in seg.items():
        allv = [x for l in d.values() for x in l]
        row = [rs[(key, s1)], rs[(key, s2)]]
        for bi, (bname, _, _) in enumerate(DILIMLER):
            v = d.get(bi) or allv
            m = float(np.median(v))
            if lines[key]["mode"] == "otobus":
                m *= OTOBUS_ZIRVE[bname]
            row.append(max(1, int(math.floor(m * 10 + 0.5))))
        ride.append(row)
    ride = np.array(ride, np.int32)
    sxy = to_xy([s[1] for s in stops], [s[2] for s in stops])
    L = []
    for key in keys:
        info = lines[key]
        pat = max(patterns[key].items(), key=lambda kv: (kv[1], len(kv[0])))[0] if patterns[key] else ()
        L.append({"f": info["feed"], "m": info["mode"], "k": info["kisa"], "a": info["ad"], "r": info["renk"],
                  "b": info["basligi"], "p": list(pat)})
    return {"stops": stops, "sxy": sxy, "rs_stop": rs_stop, "rs_line": rs_line, "board": board, "ride": ride, "lines": L}


def graph_for(net, pxy, bi):
    """Dilim bi için yönlü grafik (scipy). Düğüm: [havuz P][durak S][hat-durak R]."""
    P, S, R = len(pxy), len(net["sxy"]), len(net["rs_stop"])
    sxy = net["sxy"]
    rr, cc, ww = [], [], []
    tree_s = cKDTree(sxy)
    for i, js in enumerate(tree_s.query_ball_point(pxy, ERISIM_M)):
        js = np.array(js, int)
        if len(js) == 0:
            continue
        d = np.hypot(*(sxy[js] - pxy[i]).T)
        ok = d <= ERISIM_M
        js, w = js[ok], walk_dmin(d[ok])
        rr += [i] * len(js) + list(P + js)
        cc += list(P + js) + [i] * len(js)
        ww += list(w) + list(w)
    pr = np.array(sorted(tree_s.query_pairs(AKTARMA_M)), int)
    d = np.hypot(*(sxy[pr[:, 0]] - sxy[pr[:, 1]]).T)
    ok = d <= AKTARMA_M
    pr, w = pr[ok], walk_dmin(d[ok])
    rr += list(P + pr[:, 0]) + list(P + pr[:, 1])
    cc += list(P + pr[:, 1]) + list(P + pr[:, 0])
    ww += list(w) + list(w)
    n = np.arange(R)
    bmask = net["board"][:, bi] > 0
    rr += list(P + net["rs_stop"][bmask]); cc += list(P + S + n[bmask]); ww += list(net["board"][bmask, bi])
    rr += list(P + S + n); cc += list(P + net["rs_stop"]); ww += [1e-6] * R  # iniş: 0 (scipy için ~0)
    rd = net["ride"]
    rr += list(P + S + rd[:, 0]); cc += list(P + S + rd[:, 1]); ww += list(rd[:, 2 + bi])
    N = P + S + R
    G = csr_matrix((np.array(ww, float), (np.array(rr), np.array(cc))), shape=(N, N))
    return G


def build(gdir: Path, pool_path: Path, out: Path, web_out: Path | None):
    t0 = time.time()
    z = np.load(pool_path)
    P = len(z["lat"])
    pxy = to_xy(z["lat"], z["lon"])
    net = build_net(gdir)
    print(f"  ağ: {len(net['sxy'])} durak, {len(net['rs_stop'])} hat-durak, {len(net['ride'])} araç kenarı ({time.time()-t0:.0f} sn)")
    dd = np.hypot(pxy[:, None, 0] - pxy[None, :, 0], pxy[:, None, 1] - pxy[None, :, 1])
    walk_direct = walk_dmin(dd)
    nb = len(DILIMLER)
    tt = np.zeros((nb, P, P), dtype=np.uint16)  # desidakika
    mode = np.zeros((nb, P, P), dtype=np.uint8)
    bina = int(BINA_DK * 10)
    for bi, (bname, _, _) in enumerate(DILIMLER):
        G = graph_for(net, pxy, bi)
        for c0 in range(0, P, 150):
            idx = np.arange(c0, min(P, c0 + 150))
            dist = dijkstra(G, directed=True, indices=idx)[:, :P]
            tr = np.floor(dist + 0.5)
            wd = walk_direct[idx]
            best = np.minimum(tr, wd) + bina
            tt[bi, idx] = np.minimum(best, 2400).astype(np.uint16)
            mode[bi, idx] = (tr < wd).astype(np.uint8)
        np.fill_diagonal(tt[bi], 0)
        v = tt[bi][tt[bi] > 0] / 10
        print(f"  {bname}: medyan {np.median(v):.0f} dk, %90 {np.percentile(v, 90):.0f} dk  ({time.time()-t0:.0f} sn)")
    np.savez_compressed(out, tt_d=tt, mode=mode, dilim=np.array([[a, b] for _, a, b in DILIMLER]))
    print("yazıldı:", out)
    if web_out:
        write_web(web_out, net)


def _b64(a, dt):
    return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode()


def write_web(path, net):
    """Demo için ağ (base64 tipli diziler). JS aynı grafiği kurup aynı Dijkstra'yı yapar."""
    sxy = net["sxy"]
    obj = {
        "dilim": [[n, a, b] for n, a, b in DILIMLER],
        "param": {"lat0": LAT0, "yurume_kmh": YURUME_KMH, "dolambac": DOLAMBAC, "erisim_m": ERISIM_M,
                  "aktarma_m": AKTARMA_M, "bina_dk": BINA_DK, "binis_ceza": BINIS_CEZA, "bekle_max": BEKLE_MAX},
        "sx": _b64(sxy[:, 0], "<i4"), "sy": _b64(sxy[:, 1], "<i4"),
        "sn": "|".join(s[0].replace("|", "/") for s in net["stops"]),
        "rs_stop": _b64(net["rs_stop"], "<i4"), "rs_line": _b64(net["rs_line"], "<i2"),
        "board": _b64(net["board"], "<u2"), "ride": _b64(net["ride"], "<i4"), "nride": int(len(net["ride"])),
        "lines": [{k: v for k, v in l.items() if k != "p"} for l in net["lines"]],
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    print("yazıldı:", path, f"{os.path.getsize(path)/1e6:.2f} MB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gtfs", required=True)
    a = ap.parse_args()
    tag = os.environ.get("OLCEK", "orta")
    pool = ROOT / "data" / "izmir" / f"pool_{tag}.npz"
    build(Path(a.gtfs), pool, ROOT / "data" / "izmir" / f"transit_{tag}.npz", ROOT / "web" / "transit_izmir.json")
