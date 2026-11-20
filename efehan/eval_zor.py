"""Zorlayıcı (bağımsız) acil testi: data/eval/triage_zor.csv — olumsuz cümle, günlük dil, ağız, yazım hatası, çelişki.
Ölçüt yalnızca acil / acil değil ayrımı. Kural motorunun anahtar kelimelerini ayarlarken bu dosyadaki vakalar
değiştirilmez; yeni bir açık bulunursa vaka EKLENİR. Çalıştır: python eval_zor.py"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

from app.db import Patient, Repo
from app.triage import triage

CASES = Path(__file__).resolve().parent / "data" / "eval" / (sys.argv[1] if len(sys.argv) > 1 else "triage_zor.csv")


def run(verbose: bool = True) -> dict:
    repo = Repo()
    rows = list(csv.DictReader(CASES.open(encoding="utf-8")))
    hata, grup = [], defaultdict(lambda: [0, 0])
    kacan = asiri = 0
    for r in rows:
        t = triage(repo, r["text"], Patient("Z", "Bornova", 38.46, 27.22, False, False))
        beklenen = r["expected"] == "ACIL"
        ok = t.is_emergency == beklenen
        grup[r["group"]][0] += ok; grup[r["group"]][1] += 1
        if not ok:
            if beklenen: kacan += 1
            else: asiri += 1
            hata.append((r["id"], r["text"], r["expected"], t.level, (t.red_flags or [t.route])[0]))
    acil = sum(1 for r in rows if r["expected"] == "ACIL")
    if verbose:
        print(f"Vaka: {len(rows)} · doğru: {len(rows) - len(hata)} · kaçan acil: {kacan}/{acil} · gereksiz acil: {asiri}")
        for g, (a, b) in sorted(grup.items()): print(f"  {g:16} {a}/{b}")
        for h in hata: print("  ✗", h)
    return {"vaka": len(rows), "hata": hata, "kacan": kacan, "asiri": asiri}


if __name__ == "__main__":
    sys.exit(1 if run()["hata"] else 0)
