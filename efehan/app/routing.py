"""Ziyaret paylaşımı: yeni ziyareti sağlık çalışanının mevcut rotasına en ucuz yere ekler.

Martı TAG'daki "zaten o yöne giden sürücü" fikrinin karşılığı: o gün zaten mahallede
ziyareti olan sağlık çalışanı. Problem literatürde "Home Health Care Routing and
Scheduling Problem" (HHCRSP) olarak geçer (S12); v0.1 tek ziyaret için en iyi ekleme
(cheapest insertion) sezgiselini kullanır. Önceden verilmiş saatler değiştirilmez.

Fiyat (kazan-kazan-kazan): ziyaret tek başına yapılsaydı oluşacak yol maliyeti ile
rotaya eklenince oluşan ek yol maliyeti arasındaki fark "tasarruf"tur; tasarruf
hasta, sağlık çalışanı ve platform arasında paylaştırılır. Oranlar tasarım varsayımıdır.
"""
from __future__ import annotations

import base64
import json
import math
from array import array
from dataclasses import dataclass
from pathlib import Path

CITY_SPEED_KMH = 25.0      # şehir içi ortalama hız (varsayım)
PARKING_MIN = 5            # park + kapıya ulaşma (varsayım)
ROAD_FACTOR = 1.3          # kuş uçuşu -> yol mesafesi (varsayım)
LEAD_TIME_MIN = 30         # talepten sonra en erken varış payı (kabul + hazırlık; varsayım). Yola çıkış en erken talep anı.
MIN_SAVED_KM = 1.0         # "ziyaret paylaşımı" sayılması için en az tasarruf (varsayım)

TRAVEL_TL_PER_KM = 12.0    # yakıt + zaman maliyeti (varsayım)
COMMISSION = 0.10          # platform komisyonu, hizmet bedelinden (varsayım)
SPLIT = {"hasta": 0.5, "saglikci": 0.3, "platform": 0.2}  # tasarruf paylaşımı (varsayım)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def road_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    return haversine_km(*a, *b) * ROAD_FACTOR


def travel_min(km: float) -> int:
    """Yedek model (nokta yol paketinde yoksa): ortalama hız + park."""
    if km == 0:
        return 0
    return math.ceil(km / CITY_SPEED_KMH * 60) + PARKING_MIN


# ---- İzmir yol paketi (data/seed/izmir_yol.json, build_izmir.py): Enes'in OSM süre matrisi + TomTom trafik ----
def _yol_yukle(path: Path) -> dict | None:
    if not path.exists():
        return None
    p = json.loads(path.read_text(encoding="utf-8"))
    tt = array("H")
    tt.frombytes(base64.b64decode(p["tt_sn_b64"]))
    if tt.itemsize != 2:
        raise RuntimeError("uint16 beklenir")
    import sys
    if sys.byteorder == "big":
        tt.byteswap()
    toplu = None
    if "toplu" in p:  # Enes'in GTFS toplu taşıma süreleri: 4 saat dilimi × n × n, tam dakika (uint8)
        toplu = {"dk": base64.b64decode(p["toplu"]["dk_b64"]), "bitis": p["toplu"]["dilim_bitis"]}
    return {"n": len(p["noktalar"]), "tt": tt, "tt10": p["trafik"]["tt10_dk"], "ff10": p["trafik"]["ff10_dk"],
            "park": p["trafik"]["park_dk"], "idx": {nokta_anahtari(a, b): i for i, (a, b, _) in enumerate(p["noktalar"])},
            "toplu": toplu}


def nokta_anahtari(lat: float, lon: float) -> str:
    return f"{lat:.6f},{lon:.6f}"


YOL = _yol_yukle(Path(__file__).resolve().parents[1] / "data" / "seed" / "izmir_yol.json")


def trafik_katsayisi(minute_of_day: float) -> float:
    """TomTom 2025 İzmir saatlik eğrisi / serbest akış (enes/sim/geo.py congestion, izmir_tam)."""
    x = (minute_of_day / 60.0 - 0.5) % 24
    i = int(x)
    f = x - i
    t = YOL["tt10"]
    return (t[i] * (1 - f) + t[(i + 1) % 24] * f) / YOL["ff10"]


def toplu_dilim(minute_of_day: float) -> int:
    """Toplu taşıma saat dilimi: sabah (<10), gündüz (<16), akşam (<20), gece (enes/sim/geo._transit_slot)."""
    m = minute_of_day % 1440
    bitis = YOL["toplu"]["bitis"]
    for i, e in enumerate(bitis[:-1]):
        if m < e:
            return i
    return len(bitis) - 1


def travel(a: tuple[float, float], b: tuple[float, float], depart_min: float, mode: str = "araba") -> int:
    """a'dan b'ye yol süresi (dk). İki nokta da yol paketindeyse gerçek rota süresi × saatlik trafik + park.
    mode="toplu": kapıdan kapıya toplu taşıma süresi (yürüme + bekleme + araç + aktarma + bina)."""
    if YOL is not None:
        ia, ib = YOL["idx"].get(nokta_anahtari(*a)), YOL["idx"].get(nokta_anahtari(*b))
        if ia is not None and ib is not None:
            if ia == ib:
                return 0
            if mode == "toplu" and YOL["toplu"] is not None:
                n = YOL["n"]
                return YOL["toplu"]["dk"][toplu_dilim(depart_min) * n * n + ia * n + ib]
            return math.ceil(YOL["park"] + YOL["tt"][ia * YOL["n"] + ib] / 60.0 * trafik_katsayisi(depart_min))
    return travel_min(road_km(a, b))


@dataclass
class Insertion:
    arrival_min: int        # hastanın kapısında olunacak dakika
    added_km: float         # rotaya eklenen yol
    standalone_km: float    # tek başına gidiş-dönüş yolu
    position: int           # kaçıncı ziyaretten sonra
    shared: bool            # mevcut bir rotaya mı eklendi

    @property
    def saved_km(self) -> float:
        return max(0.0, self.standalone_km - self.added_km)


def best_insertion(home: tuple[float, float], window: tuple[int, int], stops: list[dict],
                   target: tuple[float, float], duration: int, earliest: int, mode: str = "araba",
                   depart_min: int | None = None) -> Insertion | None:
    """stops: [{'lat','lon','start_min','duration_min'}] saat sırasıyla.

    Rota: ev (window[0]'da çıkış) -> ziyaretler -> ev (window[1]'e kadar dönüş).
    """
    start, end = window
    points = [{"loc": home, "ready": start}]
    for s in stops:
        points.append({"loc": (s["lat"], s["lon"]), "start": s["start_min"],
                       "ready": s["start_min"] + s["duration_min"]})
    standalone = 2 * road_km(home, target)
    best: Insertion | None = None
    for i in range(len(points)):
        prev = points[i]
        nxt = points[i + 1] if i + 1 < len(points) else None
        nxt_loc = nxt["loc"] if nxt else home
        nxt_deadline = nxt["start"] if nxt else end

        d1 = road_km(prev["loc"], target)
        d2 = road_km(target, nxt_loc)
        # Yola çıkış gerçek "şimdi"den önce olamaz (mesai başı geçmişte kalsa da çalışan şimdi evde/önceki adreste).
        # depart_min verilmezse şimdi = earliest - LEAD_TIME_MIN. Varış en erken 'earliest'.
        dep = max(prev["ready"], earliest - LEAD_TIME_MIN if depart_min is None else depart_min)
        arrival = max(dep + travel(prev["loc"], target, dep, mode), earliest)
        finish = arrival + duration
        if finish + travel(target, nxt_loc, finish, mode) > nxt_deadline:
            continue
        added = d1 + d2 - road_km(prev["loc"], nxt_loc)
        cand = Insertion(arrival, round(added, 2), round(standalone, 2), i,
                         shared=bool(stops) and standalone - added >= MIN_SAVED_KM)
        if best is None or (cand.added_km, cand.arrival_min) < (best.added_km, best.arrival_min):
            best = cand
    return best


@dataclass
class Price:
    service_fee: float
    patient_pays: float
    provider_gets: float
    platform_gets: float
    patient_saving: float

    def as_dict(self) -> dict:
        return {k: round(v) for k, v in self.__dict__.items()}


def price_visit(base_fee: int, fee_multiplier: float, ins: Insertion | None) -> Price:
    """ins None ise uzaktan hizmet (yol yok)."""
    fee = base_fee * fee_multiplier
    if ins is None:
        return Price(fee, fee, fee * (1 - COMMISSION), fee * COMMISSION, 0.0)
    standalone_cost = ins.standalone_km * TRAVEL_TL_PER_KM
    actual_cost = ins.added_km * TRAVEL_TL_PER_KM
    saving = max(0.0, standalone_cost - actual_cost)
    patient = fee + standalone_cost - SPLIT["hasta"] * saving
    provider = fee * (1 - COMMISSION) + actual_cost + SPLIT["saglikci"] * saving
    platform = fee * COMMISSION + SPLIT["platform"] * saving
    return Price(fee, patient, provider, platform, SPLIT["hasta"] * saving)
