"""Veritabanını belleğe yükleyen basit depo sınıfı."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from .text import parse_keywords

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "evde_saglik.db"


@dataclass(frozen=True)
class Service:
    code: str
    name_tr: str
    category: str
    duration_min: int
    needs_physician_order: bool
    needs_prescription: bool
    remote_possible: bool
    base_fee_tl: int


@dataclass(frozen=True)
class Provider:
    id: str
    display_name: str
    profession_code: str
    years_experience: int
    rating: float
    fee_multiplier: float
    home_district: str
    home_lat: float
    home_lon: float
    licence_verified: bool
    transport: str = "araba"   # "toplu": arabası yok, toplu taşımayla gider


@dataclass(frozen=True)
class Patient:
    id: str
    district: str
    lat: float
    lon: float
    bedridden: bool
    has_physician_plan: bool


# Ekip kararı (21.11): doktorlar yalnızca görüntülü hizmet verir (hemşire evde + doktor görüntülü karma hizmet sürer)
HEKIM_YALNIZ_GORUNTULU = True
HEKIMLER = {"hekim", "uzman_hekim"}


class Repo:
    def __init__(self, path: Path | str = DEFAULT_DB):
        self.path = Path(path)
        if not self.path.exists():
            raise FileNotFoundError(
                f"{self.path} yok. Önce `python data/build_db.py` çalıştırın.")
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        q = lambda sql, *a: conn.execute(sql, a).fetchall()  # noqa: E731

        self.services = {
            r["code"]: Service(r["code"], r["name_tr"], r["category"], r["duration_min"],
                               bool(r["needs_physician_order"]), bool(r["needs_prescription"]),
                               bool(r["remote_possible"]), r["base_fee_tl"])
            for r in q("SELECT * FROM services")
        }
        self.professions = {r["code"]: dict(r) for r in q("SELECT * FROM professions")}
        self.profession_services: dict[str, set[str]] = {}
        for r in q("SELECT * FROM profession_services"):
            self.profession_services.setdefault(r["profession_code"], set()).add(r["service_code"])

        self.red_flags = [
            {**dict(r), "parsed": parse_keywords(r["keywords"])}
            for r in q("SELECT * FROM red_flags")
        ]
        self.routes = [
            {**dict(r), "parsed": parse_keywords(r["keywords"]),
             "service_list": r["services"].split("|")}
            for r in q("SELECT * FROM complaint_routes ORDER BY priority DESC")
        ]
        self.intents = [
            {**dict(r), "parsed": parse_keywords(r["keywords"])}
            for r in q("SELECT * FROM profession_intents ORDER BY priority DESC")
        ]
        self.sources = {r["id"]: dict(r) for r in q("SELECT * FROM sources")}

        self.providers = {
            r["id"]: Provider(r["id"], r["display_name"], r["profession_code"],
                              r["years_experience"], r["rating"], r["fee_multiplier"],
                              r["home_district"], r["home_lat"], r["home_lon"],
                              bool(r["licence_verified"]),
                              r["transport"] if "transport" in r.keys() else "araba")
            for r in q("SELECT * FROM providers")
        }
        self.provider_services: dict[str, dict[str, int]] = {}
        for r in q("SELECT * FROM provider_services"):
            self.provider_services.setdefault(r["provider_id"], {})[r["service_code"]] = r["visits_done"]
        self.availability = {
            (r["provider_id"], r["date"]): (r["start_min"], r["end_min"])
            for r in q("SELECT * FROM availability")
        }
        self.scheduled: dict[tuple[str, str], list[dict]] = {}
        for r in q("SELECT * FROM scheduled_visits ORDER BY start_min"):
            self.scheduled.setdefault((r["provider_id"], r["date"]), []).append(dict(r))
        self.hekim_yalniz_goruntulu()
        self.patients = {
            r["id"]: Patient(r["id"], r["district"], r["lat"], r["lon"],
                             bool(r["bedridden"]), bool(r["has_physician_plan"]))
            for r in q("SELECT * FROM patients")
        }
        conn.close()

    def hekim_yalniz_goruntulu(self) -> None:
        """Ekip kararı (21.11): doktorlar yalnızca görüntülü hizmet verir, eve doktor gitmez.
        Hekimin evde verdiği hizmetler (ev muayenesi, palyatif değerlendirme) hekimlerden kaldırılır;
        hekimlerin takvimdeki eski (sentetik) ev ziyaretleri yolculuksuz görüntülü blok sayılır."""
        if not HEKIM_YALNIZ_GORUNTULU:
            return
        self.hekim_evde = {s for p in HEKIMLER for s in self.profession_services.get(p, set())
                           if not self.services[s].remote_possible}
        for p in HEKIMLER:
            if p in self.profession_services:
                self.profession_services[p] -= self.hekim_evde
        for pid, prov in self.providers.items():
            if prov.profession_code in HEKIMLER:
                for s in self.hekim_evde:
                    self.provider_services.get(pid, {}).pop(s, None)
        for (pid, _), visits in self.scheduled.items():
            if pid in self.providers and self.providers[pid].profession_code in HEKIMLER:
                for v in visits:
                    v["uzaktan"] = True

    def professions_for(self, service_code: str) -> set[str]:
        return {p for p, s in self.profession_services.items() if service_code in s}
