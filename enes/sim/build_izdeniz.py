"""İZDENİZ şehir içi vapur seferleri için küçük bir GTFS klasörü üretir (resmî GTFS dosyasına erişilemedi).

Kaynak ve varsayımlar (hafta içi, 2026):
- Yoğun saat sıklıkları: İzmir BB duyurusu "İZDENİZ 15 dakikada bir sefer düzenine dönüyor" (izmir.bel.tr, 13.01.2025'ten beri):
  Karşıyaka–Konak 07.30–09.00 ve 16.30–19.00; Bostanlı–Konak 07.40–09.10 ve 16.40–19.00;
  Bostanlı/Karşıyaka–Pasaport–Alsancak 07.20–09.20 ve 16.30–18.50 arası 15 dakikada bir. Diğer saatler 30 dakikada bir (varsayım;
  Karşıyaka–Konak için 09.20–16.50 ve 19.20–23.20 arası 30 dk tarifelerle uyumlu).
- Sefer saatleri aralığı: Konak–Karşıyaka 07.30–23.20; Pasaport/Alsancak hatları 07.20–20.50 (tarife özetleri).
- Süreler: Karşıyaka–Konak 15 dk, Bostanlı–Karşıyaka 10 dk, Karşıyaka–Pasaport 18 dk, Bostanlı–Pasaport 25 dk, Pasaport–Alsancak 8 dk.
- İskele konumları: ESHOT / Tramvay GTFS'teki "… İskele" duraklarının deniz tarafı.
Üçkuyular, Göztepe ve arabalı vapur seferleri seyrek olduğu için alınmadı.

    python -m sim.build_izdeniz /home/claude/gtfs/ship-izdeniz-gtfs
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

ISKELE = {
    "KSK": ("Karşıyaka İskelesi", 38.45520, 27.11900),
    "BST": ("Bostanlı İskelesi", 38.45460, 27.09700),
    "KNK": ("Konak İskelesi", 38.41920, 27.12620),
    "PSP": ("Pasaport İskelesi", 38.43000, 27.13650),
    "ALS": ("Alsancak İskelesi", 38.44150, 27.14400),
}
# hat: (kısa ad, uzun ad, durak dizisi, ardışık süreler dk, ilk, son, yoğun pencereler)
HATLAR = [
    ("KSK-KNK", "Karşıyaka – Konak", ["KSK", "KNK"], [15], "07:10", "23:00", [("07:30", "09:00"), ("16:30", "19:00")]),
    ("KNK-KSK", "Konak – Karşıyaka", ["KNK", "KSK"], [15], "07:30", "23:20", [("07:30", "09:00"), ("16:30", "19:00")]),
    ("BST-KNK", "Bostanlı – Karşıyaka – Konak", ["BST", "KSK", "KNK"], [10, 15], "07:20", "22:50", [("07:40", "09:10"), ("16:40", "19:00")]),
    ("KNK-BST", "Konak – Karşıyaka – Bostanlı", ["KNK", "KSK", "BST"], [15, 10], "07:40", "23:20", [("07:40", "09:10"), ("16:40", "19:00")]),
    ("KSK-ALS", "Karşıyaka – Pasaport – Alsancak", ["KSK", "PSP", "ALS"], [18, 8], "07:20", "20:50", [("07:20", "09:20"), ("16:30", "18:50")]),
    ("ALS-KSK", "Alsancak – Pasaport – Karşıyaka", ["ALS", "PSP", "KSK"], [8, 18], "07:40", "20:50", [("07:20", "09:20"), ("16:30", "18:50")]),
    ("BST-ALS", "Bostanlı – Pasaport – Alsancak", ["BST", "PSP", "ALS"], [25, 8], "07:20", "20:50", [("07:20", "09:20"), ("16:30", "18:50")]),
    ("ALS-BST", "Alsancak – Pasaport – Bostanlı", ["ALS", "PSP", "BST"], [8, 25], "07:40", "20:50", [("07:20", "09:20"), ("16:30", "18:50")]),
]


def _m(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def _t(m):
    return f"{int(m) // 60:02d}:{int(m) % 60:02d}:00"


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    w = lambda name, rows, head: csv.writer(open(out / name, "w", newline="", encoding="utf-8")).writerows([head] + rows)
    w("agency.txt", [["IZDENIZ", "İZDENİZ", "https://www.izdeniz.com.tr", "Europe/Istanbul"]], ["agency_id", "agency_name", "agency_url", "agency_timezone"])
    w("stops.txt", [[k, v[0], v[1], v[2]] for k, v in ISKELE.items()], ["stop_id", "stop_name", "stop_lat", "stop_lon"])
    w("calendar.txt", [["HAFTAICI_VAPUR", 1, 1, 1, 1, 1, 0, 0, "20260101", "20271231"]],
      ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"])
    routes, trips, st = [], [], []
    for rid, ad, seq, dur, ilk, son, yogun in HATLAR:
        routes.append([rid, "IZDENIZ", ad.split(" – ")[0] + "–" + ad.split(" – ")[-1], ad, 4, "1E88E5"])
        t, k = _m(ilk), 0
        while t <= _m(son):
            tid = f"{rid}_{k:03d}"
            trips.append([rid, "HAFTAICI_VAPUR", tid, ISKELE[seq[-1]][0], 0])
            c = t
            for i, s in enumerate(seq):
                st.append([tid, _t(c), _t(c), s, i + 1])
                if i < len(dur):
                    c += dur[i]
            peak = any(_m(a) <= t < _m(b) for a, b in yogun)
            t += 15 if peak else 30
            k += 1
    w("routes.txt", routes, ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color"])
    w("trips.txt", trips, ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id"])
    w("stop_times.txt", st, ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"])
    print(f"yazıldı: {out} · {len(routes)} hat-yön, {len(trips)} sefer")


if __name__ == "__main__":
    main(sys.argv[1])
