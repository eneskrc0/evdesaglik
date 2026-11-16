"""Sentetik çalışanlar, talepler ve senaryo parametreleri."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import geo

SERVICES = {
    # hizmet: (meslek, ziyaret süresi dk, temsili taban ücret TL)
    "pansuman": ("hemsire", 30, 600.0),
    "doktor": ("doktor", 40, 1500.0),
}

DAY_START = 8 * 60  # 08:00
DAY_END = 20 * 60  # 20:00


# Dünya ölçeği: (hemşire, doktor, günlük talep). İzmir merkez 11 ilçe ≈ Bornova x 6,5 (nüfus oranı, varsayım).
SCALE = {"bornova": (40, 15, 70), "izmir": (260, 100, 450)}
_N, _D, _R = SCALE[geo.WORLD]


@dataclass
class Scenario:
    name: str = "baz"
    n_nurses: int = _N
    n_doctors: int = _D
    requests_per_day: int = _R
    budget_share: float = 0.6  # bütçe belirten hasta oranı
    # Yanıt davranışı
    resp_alpha: float = 4.0  # çalışan taban yanıt olasılığı ~ Beta(alpha, beta)
    resp_beta: float = 3.0
    peak_sensitive_share: float = 0.4  # yoğun saatte seyrek yanıt veren oran
    peak_factor: float = 0.45
    long_delay_share: float = 0.4  # yanıtı uzun süren çalışan oranı
    short_delay: tuple = (0.3, 3.0)  # dk
    long_delay: tuple = (3.0, 12.0)
    price_sd: float = 0.12  # çalışanlar arası ücret çarpanı yayılımı
    homogeneous: bool = False  # True: tüm çalışanlar aynı davranır
    # Belirsizlik
    travel_noise_sd: float = 0.15  # yol süresinin göreli sapması
    overrun_sd: float = 6.0  # önceki ziyaretin uzaması, dk
    late_share: float = 0.25  # ziyaretleri sık uzayan çalışan oranı


SCENARIOS = {
    "baz": Scenario("baz"),
    "homojen": Scenario("homojen", homogeneous=True),
    "yuksek_degiskenlik": Scenario(
        "yuksek_degiskenlik", resp_alpha=2.0, resp_beta=2.0, peak_sensitive_share=0.6,
        long_delay_share=0.55, price_sd=0.2,
    ),
    "belirsiz_yol": Scenario("belirsiz_yol", travel_noise_sd=0.35, overrun_sd=12.0),
}


@dataclass
class Worker:
    id: int
    role: str
    home: tuple
    resp_p: float
    peak_sensitive: bool
    long_delay: bool
    price_mult: float
    often_late: bool
    # günlük durum
    blocks: list = field(default_factory=list)  # (başlangıç, bitiş, konum, platform_mu)

    def reset_day(self, rng: np.random.Generator):
        """Gün başında platform dışı mevcut ziyaretleri oluştur."""
        self.blocks = []
        for _ in range(rng.integers(0, 4)):
            s = rng.uniform(DAY_START, DAY_END - 90)
            d = rng.uniform(30, 75)
            if all(s + d <= b[0] or s >= b[1] for b in self.blocks):
                self.blocks.append((s, s + d, geo.sample_point(rng), False))
        self.blocks.sort()

    def position_and_free(self, t: float):
        """t anındaki konum ve en erken boş olma zamanı (mevcut blok bitişi)."""
        loc, free = self.home, t
        for s, e, p, _ in self.blocks:
            if e <= t:
                loc = p
            elif s <= t < e:
                return p, e, True
        return loc, free, False

    def earliest_arrival(self, t: float, dest, duration: float, window_start: float):
        """Takvimi bozmadan dest'e en erken varış (beklenen). Yoksa None."""
        loc, free, _ = self.position_and_free(t)
        cur_t, cur_loc = max(t, free), loc
        future = [b for b in self.blocks if b[0] >= cur_t]
        for b in future + [None]:
            arr = max(cur_t + geo.travel_minutes(cur_loc, dest, cur_t), window_start)
            end = arr + duration
            nxt_ok = b is None or end + geo.travel_minutes(dest, b[2], end) <= b[0]
            if nxt_ok and end <= DAY_END:
                return arr, cur_t, cur_loc
            if b is None:
                return None
            cur_t, cur_loc = b[1], b[2]
        return None

    def is_free(self, start: float, end: float) -> bool:
        return all(end <= s or start >= e for s, e, _, _ in self.blocks)


def make_workers(sc: Scenario, rng: np.random.Generator) -> list[Worker]:
    ws = []
    roles = ["hemsire"] * sc.n_nurses + ["doktor"] * sc.n_doctors
    for i, role in enumerate(roles):
        if sc.homogeneous:
            ws.append(Worker(i, role, geo.sample_point(rng), sc.resp_alpha / (sc.resp_alpha + sc.resp_beta),
                             False, False, 1.0, False))
            continue
        ws.append(Worker(
            id=i, role=role, home=geo.sample_point(rng),
            resp_p=float(rng.beta(sc.resp_alpha, sc.resp_beta)),
            peak_sensitive=bool(rng.random() < sc.peak_sensitive_share),
            long_delay=bool(rng.random() < sc.long_delay_share),
            price_mult=float(np.clip(rng.normal(1.0, sc.price_sd), 0.7, 1.5)),
            often_late=bool(rng.random() < sc.late_share),
        ))
    return ws


@dataclass
class Request:
    id: int
    t: float  # talep anı (dk)
    loc: tuple
    service: str
    win_start: float
    win_end: float
    budget: float | None


def make_requests(sc: Scenario, rng: np.random.Generator) -> list[Request]:
    reqs = []
    for i in range(sc.requests_per_day):
        t = rng.uniform(DAY_START - 30, 17 * 60)
        service = "pansuman" if rng.random() < 0.7 else "doktor"
        ws = t + rng.uniform(30, 180)
        _, _, base = SERVICES[service]
        budget = float(round(base * rng.uniform(0.85, 1.15), -1)) if rng.random() < sc.budget_share else None
        reqs.append(Request(i, t, geo.sample_point(rng), service, ws, ws + 60, budget))
    reqs.sort(key=lambda r: r.t)
    return reqs
