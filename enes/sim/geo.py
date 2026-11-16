"""Bornova coğrafyası ve yol süresi modeli.

`data/pool.npz` varsa (bkz. sim/build_roads.py): konumlar Bornova sınırı içindeki
gerçek yol düğümlerinden oluşan bir havuzdan seçilir; yol süresi OpenStreetMap yol
ağı üzerindeki en kısa rota (serbest akış) x saate bağlı trafik katsayısıdır.
Dosya yoksa yaklaşık çokgen + kuş uçuşu modeline düşer.
Konumlar (enlem, boylam, havuz_indeksi) üçlüsüdür.
"""
from __future__ import annotations

import math
import os
from functools import lru_cache
from pathlib import Path

import h3
import numpy as np
from shapely.geometry import Point, Polygon

# Yaklaşık Bornova yerleşim alanı (enlem, boylam). Kesin ilçe sınırı değildir.
BORNOVA_POLY_LATLON = [
    (38.488, 27.195),
    (38.492, 27.230),
    (38.480, 27.268),
    (38.450, 27.262),
    (38.440, 27.235),
    (38.447, 27.200),
]
_POLY = Polygon([(lon, lat) for lat, lon in BORNOVA_POLY_LATLON])
_MINX, _MINY, _MAXX, _MAXY = _POLY.bounds

H3_RES = 8  # ~0.74 km² hücreler
DETOUR = 1.35  # yol mesafesi / kuş uçuşu mesafe


# Simülasyon dünyası: DUNYA ortam değişkeni (bornova | izmir). Varsayılan: bornova.
WORLD = os.environ.get("DUNYA", "bornova")
# Ölçek: OLCEK ortam değişkeni (boş = dünyanın varsayılan ölçeği; ör. "orta"). Sonuç klasörü ve ölçek bu etiketle seçilir.
OLCEK = os.environ.get("OLCEK", "")
WORLD_TAG = f"{WORLD}_{OLCEK}" if OLCEK else WORLD
_POOL_FILE = Path(__file__).resolve().parent.parent / "data" / WORLD / "pool.npz"
if _POOL_FILE.exists():
    _z = np.load(_POOL_FILE)
    POOL = [(float(a), float(b), i) for i, (a, b) in enumerate(zip(_z["lat"], _z["lon"]))]
    TT_SEC = _z["tt"]
    DISTRICT = [str(x) for x in _z["ilce"]] if "ilce" in _z.files else [WORLD] * len(POOL)
else:
    if WORLD != "bornova":
        raise FileNotFoundError(f"{_POOL_FILE} yok")
    POOL, TT_SEC, DISTRICT = None, None, None
ROAD_NETWORK = POOL is not None

# İlçe nüfusları (talep ve çalışan konumlarını nüfusa göre dağıtmak için).
# Kaynak: TÜİK ADNKS; Buca, Karabağlar, Bornova, Karşıyaka, Konak 2025 (Sözcü, TÜİK 31.12.2025);
# Bayraklı, Çiğli, Balçova, Narlıdere, Güzelbahçe 2024 (Wikipedia, TÜİK); Gaziemir 2023 (citypopulation.de).
DISTRICT_POP = {
    "Buca": 525402, "Karabağlar": 475251, "Bornova": 445162, "Karşıyaka": 341253, "Konak": 325211,
    "Bayraklı": 299859, "Çiğli": 215697, "Gaziemir": 137768, "Balçova": 76613, "Narlıdere": 61732,
    "Güzelbahçe": 38500,
}
if ROAD_NETWORK and WORLD == "izmir":
    _by_d = {}
    for p_, d_ in zip(POOL, DISTRICT):
        _by_d.setdefault(d_, []).append(p_)
    _DNAMES = sorted(_by_d)
    _DW = np.array([DISTRICT_POP[d] for d in _DNAMES], dtype=float)
    _DW /= _DW.sum()


def sample_point(rng: np.random.Generator) -> tuple:
    """Rastgele konum: yol ağı varsa havuzdan bir düğüm, yoksa çokgen içinde nokta."""
    if ROAD_NETWORK and WORLD == "izmir":
        # önce ilçe (nüfusa orantılı), sonra ilçe içinde rastgele yol noktası
        d = _DNAMES[int(rng.choice(len(_DNAMES), p=_DW))]
        lst = _by_d[d]
        return lst[int(rng.integers(len(lst)))]
    if ROAD_NETWORK:
        return POOL[int(rng.integers(len(POOL)))]
    while True:
        lon = rng.uniform(_MINX, _MAXX)
        lat = rng.uniform(_MINY, _MAXY)
        if _POLY.contains(Point(lon, lat)):
            return lat, lon


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a[:2])
    lat2, lon2 = map(math.radians, b[:2])
    d = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(d))


def speed_kmh(minute_of_day: float) -> float:
    """Saate bağlı ortalama şehir içi hız (yoğun saatlerde düşer)."""
    h = (minute_of_day / 60.0) % 24
    if 7.5 <= h < 9.5 or 17 <= h < 19.5:
        return 16.0
    if 9.5 <= h < 17:
        return 24.0
    return 30.0


def congestion(minute_of_day: float) -> float:
    """Serbest akış süresine uygulanan trafik katsayısı."""
    h = (minute_of_day / 60.0) % 24
    if 7.5 <= h < 9.5 or 17 <= h < 19.5:
        return 1.8
    if 9.5 <= h < 17:
        return 1.35
    return 1.15


def travel_minutes(a, b, minute_of_day: float) -> float:
    """Tahmini (beklenen) yol süresi, dakika. Hazırlık/park için +3 dk."""
    if ROAD_NETWORK and len(a) > 2 and len(b) > 2:
        return 3.0 + float(TT_SEC[a[2], b[2]]) / 60.0 * congestion(minute_of_day)
    km = haversine_km(a, b) * DETOUR
    return 3.0 + 60.0 * km / speed_kmh(minute_of_day)


@lru_cache(maxsize=None)
def _cell(lat: float, lon: float) -> str:
    return h3.latlng_to_cell(lat, lon, H3_RES)


def cell(p) -> str:
    return _cell(p[0], p[1])


@lru_cache(maxsize=None)
def neighbours(c: str, k: int) -> frozenset:
    return frozenset(h3.grid_disk(c, k))
