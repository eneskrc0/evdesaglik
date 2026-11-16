"""Açıklanabilir çok kriterli eşleştirme.

Hasta üç şeye ağırlık verir: yetkinlik, fiyat, hız. Her aday 0–1 arası üç puan alır,
ağırlıklı toplamla sıralanır ve her öneri neden önerildiğini Türkçe cümleyle söyler.

Kesin filtreler (puanlanmaz, eler):
  - Ruhsatı doğrulanmamış sağlayıcı önerilmez.
  - Hizmet hekim istemi gerektiriyor ve hastanın hekim planı yoksa önerilmez (S08).
  - Sağlayıcı o hizmeti vermiyorsa, o gün müsait değilse ya da rotasına sığmıyorsa elenir.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from .db import Patient, Repo
from .routing import Insertion, Price, best_insertion, price_visit, LEAD_TIME_MIN, road_km

PRICE_SENSITIVITY = 3.0    # tasarım varsayımı
SPEED_HORIZON_MIN = 480    # tasarım varsayımı


@dataclass
class Preferences:
    yetkinlik: float = 1.0
    fiyat: float = 1.0
    hiz: float = 1.0

    def normalized(self) -> tuple[float, float, float]:
        s = self.yetkinlik + self.fiyat + self.hiz
        if s <= 0:
            return (1 / 3, 1 / 3, 1 / 3)
        return (self.yetkinlik / s, self.fiyat / s, self.hiz / s)


@dataclass
class Candidate:
    provider_id: str
    name: str
    profession: str
    service: str
    arrival_min: int
    distance_km: float
    insertion: Insertion | None
    price: Price
    competence: float
    scores: dict = field(default_factory=dict)
    total: float = 0.0
    explanation: str = ""


def hhmm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def competence_score(visits: int, years: int, rating: float) -> float:
    v = min(1.0, math.log1p(visits) / math.log1p(200))
    y = min(1.0, years / 20)
    r = max(0.0, min(1.0, (rating - 3.5) / 1.5))
    return 0.5 * v + 0.3 * y + 0.2 * r


def find_candidates(repo: Repo, service_code: str, patient: Patient, date: str,
                    now_min: int, prefs: Preferences | None = None,
                    max_km: float = 20.0, top_k: int = 5) -> tuple[list[Candidate], list[str]]:
    """(adaylar, eleme notları) döndürür."""
    prefs = prefs or Preferences()
    svc = repo.services[service_code]
    notes: list[str] = []

    if svc.needs_physician_order and not patient.has_physician_plan:
        notes.append(f"'{svc.name_tr}' hekim planı/reçetesi ister; hastanın planı yok (S08).")
        return [], notes

    professions = repo.professions_for(service_code)
    earliest = now_min + LEAD_TIME_MIN
    target = (patient.lat, patient.lon)
    cands: list[Candidate] = []
    elim = {"ruhsat": 0, "müsaitlik": 0, "mesafe": 0, "rota": 0}

    for p in repo.providers.values():
        if p.profession_code not in professions:
            continue
        visits = repo.provider_services.get(p.id, {}).get(service_code)
        if visits is None:
            continue
        if not p.licence_verified:
            elim["ruhsat"] += 1
            continue
        window = repo.availability.get((p.id, date))
        if not window or window[1] <= earliest:
            elim["müsaitlik"] += 1
            continue
        home = (p.home_lat, p.home_lon)
        dist = road_km(home, target)

        if svc.remote_possible and svc.category == "tele":
            ins = None
            # Uzaktan: mevcut ziyaretler arasındaki ilk boşluk yeterli (v0.1 basit)
            arrival = max(window[0], earliest)
        else:
            if dist > max_km:
                elim["mesafe"] += 1
                continue
            stops = repo.scheduled.get((p.id, date), [])
            ins = best_insertion(home, window, stops, target, svc.duration_min, earliest)
            if ins is None:
                elim["rota"] += 1
                continue
            arrival = ins.arrival_min

        price = price_visit(svc.base_fee_tl, p.fee_multiplier, ins)
        comp = competence_score(visits, p.years_experience, p.rating)
        cands.append(Candidate(p.id, p.display_name, p.profession_code, service_code,
                               arrival, round(dist, 1), ins, price, comp))

    for k, v in elim.items():
        if v:
            notes.append(f"{v} aday elendi: {k}")
    if not cands:
        return [], notes

    # Mutlak ölçekler (min-max yerine): küçük farklar büyük puan farkına dönüşmesin.
    #   fiyat: en ucuzdan %10 pahalı -> 0.7, %33 pahalı -> 0
    #   hız  : en erken mümkün saatten 8 saat sonra -> 0
    pmin = min(c.price.patient_pays for c in cands)
    wc, wp, ws = prefs.normalized()
    for c in cands:
        price_s = max(0.0, 1 - PRICE_SENSITIVITY * (c.price.patient_pays - pmin) / pmin)
        speed_s = max(0.0, 1 - (c.arrival_min - earliest) / SPEED_HORIZON_MIN)
        c.scores = {"yetkinlik": round(c.competence, 3), "fiyat": round(price_s, 3),
                    "hiz": round(speed_s, 3)}
        c.total = round(wc * c.competence + wp * price_s + ws * speed_s, 4)
        c.explanation = explain(repo, c)

    cands.sort(key=lambda c: (-c.total, c.arrival_min))
    return cands[:top_k], notes


def explain(repo: Repo, c: Candidate) -> str:
    p = repo.providers[c.provider_id]
    visits = repo.provider_services[c.provider_id][c.service]
    parts = [f"bu hizmette {visits} ziyaret, {p.years_experience} yıl deneyim, puan {p.rating}"]
    if c.insertion is None:
        parts.append(f"en erken görüşme {hhmm(c.arrival_min)}")
    else:
        parts.append(f"tahmini varış {hhmm(c.arrival_min)}")
        if c.insertion.shared:
            parts.append(
                f"ziyaretiniz o günkü rotasına eklenir: ek yol {c.insertion.added_km} km "
                f"(tek başına {c.insertion.standalone_km} km), size "
                f"{round(c.price.patient_saving)} TL indirim")
    parts.append(f"ödeyeceğiniz {round(c.price.patient_pays)} TL")
    return "; ".join(parts)
