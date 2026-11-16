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

import math
from dataclasses import dataclass

CITY_SPEED_KMH = 25.0      # şehir içi ortalama hız (varsayım)
PARKING_MIN = 5            # park + kapıya ulaşma (varsayım)
ROAD_FACTOR = 1.3          # kuş uçuşu -> yol mesafesi (varsayım)
LEAD_TIME_MIN = 30         # talepten sonra en erken yola çıkış (varsayım)
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
    if km == 0:
        return 0
    return math.ceil(km / CITY_SPEED_KMH * 60) + PARKING_MIN


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
                   target: tuple[float, float], duration: int, earliest: int) -> Insertion | None:
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
        arrival = max(prev["ready"] + travel_min(d1), earliest)
        finish = arrival + duration
        if finish + travel_min(d2) > nxt_deadline:
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
