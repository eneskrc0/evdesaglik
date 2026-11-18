"""Triyaj değerlendirmesi: data/eval/triage_cases.csv üzerinde ölçüm.

Çalıştır:  python eval_triage.py

İki ölçüt raporlanır:
  - Kırmızı bayrak duyarlılığı: acil olması gereken vakaların kaçı acil bulundu
    (hedef %100; kaçırılan acil, yanlış alarmdan çok daha kötüdür).
  - Seviye doğruluğu: tüm vakalarda beklenen seviye bulundu mu.
Etiketler ekip tasarımıdır (S14); klinisyen doğrulaması bekler.
"""
from __future__ import annotations

import csv
from pathlib import Path

from app.db import Patient, Repo
from app.triage import triage

CASES = Path(__file__).resolve().parent / "data" / "eval" / "triage_cases.csv"


def run(repo: Repo | None = None, verbose: bool = True) -> dict:
    repo = repo or Repo()
    rows = list(csv.DictReader(CASES.open(encoding="utf-8")))
    emerg_total = emerg_hit = level_ok = code_ok = 0
    over_triage = 0
    failures = []
    for r in rows:
        pt = Patient("EVAL", "Bornova", 38.46, 27.22, r["bedridden"] == "1", r["has_plan"] == "1")
        t = triage(repo, r["text"], pt)
        expected_emerg = r["expected_level"] in ("ACIL_112", "ZEHIR_114")
        if expected_emerg:
            emerg_total += 1
            emerg_hit += t.is_emergency
        elif t.is_emergency:
            over_triage += 1
        got_code = t.red_flags[0] if t.red_flags else (t.route or "")
        codes = set(t.red_flags) | ({t.route} if t.route else set())
        ok_level = t.level == r["expected_level"]
        ok_code = (r["expected_code"] in codes) if r["expected_code"] else not t.route
        level_ok += ok_level
        code_ok += ok_code
        if not (ok_level and ok_code):
            failures.append((r["id"], r["text"], r["expected_level"], r["expected_code"],
                             t.level, got_code))
    n = len(rows)
    res = {
        "vaka": n,
        "kirmizi_bayrak_duyarliligi": emerg_hit / emerg_total if emerg_total else 1.0,
        "asiri_triyaj": over_triage,
        "seviye_dogrulugu": level_ok / n,
        "kod_dogrulugu": code_ok / n,
        "hatalar": failures,
    }
    if verbose:
        print(f"Vaka sayısı              : {n}")
        print(f"Kırmızı bayrak duyarlılığı: {emerg_hit}/{emerg_total} "
              f"(%{100 * res['kirmizi_bayrak_duyarliligi']:.0f})")
        print(f"Aşırı triyaj (gereksiz acil): {over_triage}")
        print(f"Seviye doğruluğu         : %{100 * res['seviye_dogrulugu']:.0f}")
        print(f"Kod doğruluğu            : %{100 * res['kod_dogrulugu']:.0f}")
        for f in failures:
            print(f"  HATA {f[0]}: '{f[1]}' beklenen {f[2]}/{f[3]} -> bulunan {f[4]}/{f[5]}")
    return res


if __name__ == "__main__":
    run()
