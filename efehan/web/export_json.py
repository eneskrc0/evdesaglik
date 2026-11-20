"""SQLite veritabanını ve test vakalarını web prototipi için tek JSON'a aktarır.

Çalıştır:  python web/export_json.py   -> web/data.json
"""
from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "evde_saglik.db"
CASES = ROOT / "data" / "eval" / "triage_cases.csv"
OUT = Path(__file__).resolve().parent / "data.json"

TABLES = ["sources", "professions", "services", "profession_services", "red_flags",
          "complaint_routes", "profession_intents", "districts", "providers", "provider_services",
          "availability", "scheduled_visits", "patients"]


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    data = {}
    for t in TABLES:
        order = " ORDER BY priority DESC" if t in ("complaint_routes", "profession_intents") else ""
        if t == "scheduled_visits":
            order = " ORDER BY start_min"
        data[t] = [dict(r) for r in conn.execute(f"SELECT * FROM {t}{order}")]
    data["triage_cases"] = list(csv.DictReader(CASES.open(encoding="utf-8")))
    yol = Path(__file__).resolve().parents[1] / "data" / "seed" / "izmir_yol.json"
    if yol.exists():  # İzmir yol paketi: routing.py ile aynı süre matrisi ve trafik eğrisi (core.js setYol)
        data["yol"] = json.loads(yol.read_text(encoding="utf-8"))
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
