"""Veritabanını şemadan ve tohum CSV'lerden kurar, sentetik demo verisini üretir.

Kullanım:  python data/build_db.py            -> data/evde_saglik.db
           python data/build_db.py --out x.db

Sentetik sağlayıcı ve hastalar GERÇEK KİŞİ DEĞİLDİR; sabit tohumla (seed=42) üretilir.
"""
from __future__ import annotations

import argparse
import csv
import math
import json
import random
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEED_DIR = HERE / "seed"
SCHEMA = HERE / "schema.sql"
DEMO_DATE = "2026-11-16"  # Pazartesi

# Seed tabloları, yüklenme sırasıyla (yabancı anahtarlar yüzünden sıra önemli)
SEED_TABLES = [
    "sources",
    "professions",
    "services",
    "profession_services",
    "red_flags",
    "complaint_routes",
    "districts",
]

INT_COLUMNS = {
    "can_diagnose", "requires_physician_order", "duration_min", "needs_physician_order",
    "needs_prescription", "remote_possible", "base_fee_tl", "priority",
}
REAL_COLUMNS = {"lat", "lon"}

# Sentetik sağlayıcı sayıları (meslek -> kişi)
PROVIDER_COUNTS = {
    "hemsire": 14, "hekim": 6, "uzman_hekim": 2, "ebe": 2, "fizyoterapist": 5,
    "odyolog": 2, "diyetisyen": 2, "dil_konusma": 2, "ergoterapist": 2,
    "klinik_psikolog": 2, "podolog": 2,
}
PREFIX = {
    "hemsire": "Hemşire", "hekim": "Dr.", "uzman_hekim": "Uzm. Dr.", "ebe": "Ebe",
    "fizyoterapist": "Fzt.", "odyolog": "Ody.", "diyetisyen": "Dyt.", "dil_konusma": "DKT",
    "ergoterapist": "Ergoterapist", "klinik_psikolog": "Psk.", "podolog": "Podolog",
}


def _convert(col: str, val: str):
    if val == "":
        return None
    if col in INT_COLUMNS:
        return int(val)
    if col in REAL_COLUMNS:
        return float(val)
    return val


def load_seed(conn: sqlite3.Connection) -> None:
    for table in SEED_TABLES:
        path = SEED_DIR / f"{table}.csv"
        with path.open(encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        if not rows:
            raise ValueError(f"{path.name} boş")
        cols = list(rows[0].keys())
        placeholders = ",".join("?" for _ in cols)
        conn.executemany(
            f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})",
            [[_convert(c, r[c]) for c in cols] for r in rows],
        )


def jitter(rng: random.Random, lat: float, lon: float, km: float) -> tuple[float, float]:
    """Merkezden en fazla `km` uzaklıkta rastgele nokta."""
    r = km * math.sqrt(rng.random())
    theta = rng.random() * 2 * math.pi
    dlat = (r * math.cos(theta)) / 111.0
    dlon = (r * math.sin(theta)) / (111.0 * math.cos(math.radians(lat)))
    return round(lat + dlat, 5), round(lon + dlon, 5)


YOL_FILE = Path(__file__).resolve().parent / "seed" / "izmir_yol.json"


def izmir_noktalari() -> tuple[list[str], list[int], dict[str, list[tuple[float, float]]]]:
    """İzmir yol paketi (build_izmir.py): ilçe adları, nüfus ağırlıkları, ilçe -> gerçek yol noktaları."""
    paket = json.loads(YOL_FILE.read_text(encoding="utf-8"))
    by_d: dict[str, list[tuple[float, float]]] = {}
    for lat, lon, d in paket["noktalar"]:
        by_d.setdefault(d, []).append((lat, lon))
    names = sorted(by_d)
    return names, [paket["ilceler"][d]["nufus"] for d in names], by_d


def build_synthetic(conn: sqlite3.Connection, seed: int = 42) -> None:
    """Sentetik İzmir verisi: konumlar Enes'in temiz havuzundan gerçek yol noktaları (OSM),
    ilçe seçimi TÜİK nüfusuna orantılı. Yol süresi app/routing.py'de bu noktalar arası matristen gelir."""
    rng = random.Random(seed)
    d_names, d_weights, d_points = izmir_noktalari()
    pick_district = lambda: rng.choices(d_names, weights=d_weights)[0]
    pick_point = lambda d: rng.choice(d_points[d])
    prof_services: dict[str, list[str]] = {}
    for p, s in conn.execute("SELECT profession_code, service_code FROM profession_services"):
        prof_services.setdefault(p, []).append(s)

    visit_no = 0
    for prof, count in PROVIDER_COUNTS.items():
        for i in range(1, count + 1):
            pid = f"{prof[:3].upper()}-{i:02d}"
            d_name = pick_district()
            lat, lon = pick_point(d_name)
            years = rng.randint(1, 25)
            rating = round(min(5.0, max(3.5, rng.gauss(4.5, 0.3))), 1)
            # Kıdem arttıkça ücret çarpanı artar (ekonomik / kıdemli seçenekler)
            fee_mult = round(0.8 + 0.6 * (years / 25) + rng.uniform(-0.05, 0.05), 2)
            verified = 1 if rng.random() < 0.95 else 0
            conn.execute(
                "INSERT INTO providers VALUES (?,?,?,?,?,?,?,?,?,?)",
                (pid, f"{PREFIX[prof]} {pid}", prof, years, rating, fee_mult,
                 d_name, lat, lon, verified),
            )
            services = prof_services[prof]
            if prof == "hemsire":
                # Her hemşire her işi yapmıyor: deneyim sinyali farklılaşsın
                chosen = [s for s in services if rng.random() < 0.7] or services[:3]
            else:
                chosen = services
            for s in chosen:
                visits = int(rng.paretovariate(1.5) * years * 2)
                conn.execute("INSERT INTO provider_services VALUES (?,?,?)", (pid, s, visits))

            # Müsaitlik: sabah, öğleden sonra ya da tam gün
            start, end = rng.choice([(540, 780), (780, 1200), (540, 1020), (600, 1140)])
            conn.execute("INSERT INTO availability VALUES (?,?,?,?)", (pid, DEMO_DATE, start, end))

            # Bazı sağlayıcıların o gün zaten ziyareti var (ziyaret paylaşımının dayanağı)
            if rng.random() < 0.6:
                t = start + rng.randint(0, 60)
                for _ in range(rng.randint(1, 3)):
                    svc = rng.choice(chosen)
                    dur = conn.execute(
                        "SELECT duration_min FROM services WHERE code=?", (svc,)
                    ).fetchone()[0]
                    if t + dur > end - 30:
                        break
                    vlat, vlon = pick_point(d_name)
                    visit_no += 1
                    conn.execute(
                        "INSERT INTO scheduled_visits VALUES (?,?,?,?,?,?,?,?)",
                        (f"V{visit_no:03d}", pid, DEMO_DATE, t, dur, vlat, vlon, svc),
                    )
                    t += dur + rng.randint(40, 120)

    for i in range(1, 61):
        d_name = pick_district()
        lat, lon = pick_point(d_name)
        conn.execute(
            "INSERT INTO patients VALUES (?,?,?,?,?,?)",
            (f"P{i:02d}", d_name, lat, lon, int(rng.random() < 0.35), int(rng.random() < 0.5)),
        )


def validate(conn: sqlite3.Connection) -> list[str]:
    """Tutarlılık kontrolleri. Boş liste = sorun yok."""
    problems: list[str] = []
    fk = conn.execute("PRAGMA foreign_key_check").fetchall()
    if fk:
        problems.append(f"Yabancı anahtar ihlali: {fk[:5]}")
    services = {r[0] for r in conn.execute("SELECT code FROM services")}
    for code, svcs in conn.execute("SELECT code, services FROM complaint_routes"):
        for s in svcs.split("|"):
            if s not in services:
                problems.append(f"{code}: bilinmeyen hizmet '{s}'")
    levels = {"TELE", "TELE_HEMSIRE", "HEKIM_EV", "PLANLI"}
    for code, a, b in conn.execute(
        "SELECT code, level_no_plan, level_with_plan FROM complaint_routes"
    ):
        for lv in (a, b):
            if lv not in levels:
                problems.append(f"{code}: bilinmeyen seviye '{lv}'")
        if a == "PLANLI":
            problems.append(f"{code}: hekim planı yokken PLANLI seviye olamaz (S08)")
    # Plan gerektiren her hizmeti verebilen en az bir meslek olmalı
    orphan = conn.execute(
        "SELECT code FROM services WHERE code NOT IN (SELECT service_code FROM profession_services)"
    ).fetchall()
    if orphan:
        problems.append(f"Hiçbir mesleğin veremediği hizmet: {orphan}")
    for table in ("red_flags", "complaint_routes"):
        for code, kw in conn.execute(f"SELECT code, keywords FROM {table}"):
            if any(not alt.strip() for alt in kw.split("|")):
                problems.append(f"{table}.{code}: boş anahtar kelime")
    return problems


def build(out: Path, seed: int = 42) -> Path:
    if out.exists():
        out.unlink()
    conn = sqlite3.connect(out)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    load_seed(conn)
    build_synthetic(conn, seed)
    problems = validate(conn)
    if problems:
        conn.close()
        raise SystemExit("Doğrulama hatası:\n" + "\n".join(problems))
    conn.commit()
    conn.close()
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=HERE / "evde_saglik.db")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    path = build(args.out, args.seed)
    conn = sqlite3.connect(path)
    for t in ["sources", "professions", "services", "profession_services", "red_flags",
              "complaint_routes", "districts", "providers", "provider_services",
              "availability", "scheduled_visits", "patients"]:
        n = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"{t:20s} {n:4d}")
    print(f"Hazır: {path}")
