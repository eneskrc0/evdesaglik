"""Çalıştır:  python -m pytest -q"""
from __future__ import annotations

import sqlite3
import sys
from dataclasses import replace
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.api import handle_request  # noqa: E402
from app.db import Patient, Repo  # noqa: E402
from app.matching import find_candidates  # noqa: E402
from app.routing import best_insertion, price_visit, road_km  # noqa: E402
from app.text import match, normalize  # noqa: E402
from data.build_db import build, validate  # noqa: E402
import eval_triage  # noqa: E402

DATE = "2026-11-16"


@pytest.fixture(scope="session")
def repo(tmp_path_factory) -> Repo:
    db = tmp_path_factory.mktemp("db") / "test.db"
    build(db)
    return Repo(db)


def test_db_valid(repo):
    conn = sqlite3.connect(repo.path)
    assert validate(conn) == []
    # Her tıbbi satırın kaynağı var
    for table in ("red_flags", "complaint_routes", "professions", "services"):
        missing = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE source_id IS NULL").fetchone()[0]
        assert missing == 0, table


def test_normalize_turkish():
    assert normalize("GÖĞSÜMDE Baskı!").strip() == "gogsumde baski"
    assert normalize("İnme").strip() == "inme"
    assert normalize("IŞIK").strip() == "isik"


def test_match_word_start():
    assert match("ateş", normalize("ateşim var"))
    assert not match("ateş", normalize("kateşli"))
    assert match("göğs;bask", normalize("göğsümde baskı var"))


def test_eval_set(repo):
    res = eval_triage.run(repo, verbose=False)
    assert res["kirmizi_bayrak_duyarliligi"] == 1.0, res["hatalar"]
    assert res["seviye_dogrulugu"] >= 0.95, res["hatalar"]


def test_emergency_never_recommends(repo):
    p = next(iter(repo.patients.values()))
    out = handle_request(repo, "göğsüm sıkışıyor", p, DATE, 600)
    assert out["seviye"] == "ACIL_112"
    assert out["oneriler"] == []


def test_no_plan_blocks_nurse_services(repo):
    p = replace(next(iter(repo.patients.values())), has_physician_plan=False)
    cands, notes = find_candidates(repo, "iv_serum", p, DATE, 600)
    assert cands == [] and notes


def test_insertion_respects_fixed_visits():
    home = (39.90, 32.85)
    stops = [{"lat": 39.91, "lon": 32.86, "start_min": 600, "duration_min": 30},
             {"lat": 39.92, "lon": 32.87, "start_min": 700, "duration_min": 30}]
    ins = best_insertion(home, (540, 1020), stops, (39.915, 32.865), 30, earliest=540)
    assert ins is not None
    assert ins.shared and ins.added_km < ins.standalone_km
    # Eklenen ziyaret mevcut saatleri bozmamalı
    if ins.position == 1:
        assert ins.arrival_min >= 630 and ins.arrival_min + 30 <= 700


def test_insertion_infeasible_when_full():
    home = (39.90, 32.85)
    ins = best_insertion(home, (540, 600), [], (39.99, 32.99), 60, earliest=540)
    assert ins is None


def test_price_conservation():
    home, target = (39.90, 32.85), (39.95, 32.90)
    ins = best_insertion(home, (540, 1200),
                         [{"lat": 39.95, "lon": 32.89, "start_min": 600, "duration_min": 30}],
                         target, 30, 540)
    pr = price_visit(1000, 1.1, ins)
    # Hastanın ödediği = sağlıkçı + platform (para yoktan var olmaz)
    assert abs(pr.patient_pays - (pr.provider_gets + pr.platform_gets)) < 1e-6
    standalone = price_visit(1000, 1.1, replace(ins, added_km=ins.standalone_km))
    assert pr.patient_pays <= standalone.patient_pays


def test_preferences_change_ranking(repo):
    from app.matching import Preferences
    p = replace(repo.patients["P01"], has_physician_plan=True, bedridden=True)
    cheap, _ = find_candidates(repo, "basi_yarasi_bakimi", p, DATE, 570,
                               Preferences(yetkinlik=0, fiyat=1, hiz=0), top_k=10)
    skill, _ = find_candidates(repo, "basi_yarasi_bakimi", p, DATE, 570,
                               Preferences(yetkinlik=1, fiyat=0, hiz=0), top_k=10)
    assert cheap and skill
    assert cheap[0].price.patient_pays == min(c.price.patient_pays for c in cheap)
    assert skill[0].competence == max(c.competence for c in skill)


def test_road_km_symmetric():
    a, b = (39.9, 32.8), (39.95, 32.9)
    assert road_km(a, b) == pytest.approx(road_km(b, a))
