"""Python çekirdeği ile web/core.js'in aynı sonucu verdiğini doğrular.

Çalıştır:  python web/parity_test.py   (node gerekir)
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db import Patient, Repo  # noqa: E402
from app.matching import Preferences, find_candidates  # noqa: E402
from app.triage import triage  # noqa: E402

DATE = "2026-11-16"
PREFS = [(1, 1, 1), (5, 1, 1), (1, 5, 1), (1, 1, 5)]
SERVICES = ["basi_yarasi_bakimi", "kan_alma", "iv_serum", "fizyoterapi_seansi",
            "tele_muayene", "ev_muayene", "tele_hemsire_destekli", "odyolojik_tarama"]
EXTRA_TEXTS = ["Göğsümde YANMA var reflü sanırım", "IŞIK gözümü acıtıyor", "en sonda kaldık",
               "kateter", "nöbetçi eczane nerede", "İğne yaptırmam lazım", "ateşli havale geçirdi",
               "hemşire çağırmak istiyorum", "fizik tedavici gelsin dizim ameliyatlı", "odyolog istiyorum",
               "yaram var doktor gelsin", "doktorla görüntülü görüşmek istiyorum", "lohusayım ebe lazım",
               "pansuman için hemşire", "diyetisyen istiyorum şekerim var", "psikolog gelsin"]


def python_side() -> dict:
    repo = Repo()
    out = {"triage": [], "match": []}
    cases = list(csv.DictReader((ROOT / "data/eval/triage_cases.csv").open(encoding="utf-8")))
    texts = [(c["text"], c["bedridden"] == "1", c["has_plan"] == "1") for c in cases]
    texts += [(t, b, p) for t in EXTRA_TEXTS for b in (False, True) for p in (False, True)]
    for text, bed, plan in texts:
        t = triage(repo, text, Patient("X", "Bornova", 38.46, 27.22, bed, plan))
        out["triage"].append([text, bed, plan, t.level, t.route, t.red_flags, t.services, t.sources, t.profession])
    for pid, p in repo.patients.items():
        pp = replace(p, has_physician_plan=True)
        for svc in SERVICES:
            for pr in PREFS:
                cands, notes = find_candidates(repo, svc, pp, DATE, 570, Preferences(*pr), top_k=5)
                out["match"].append([pid, svc, list(pr),
                                     [[c.provider_id, c.arrival_min, round(c.price.patient_pays, 2),
                                       round(c.total, 6)] for c in cands]])
    return out


JS = r"""
const fs = require('fs');
const C = require('./core.js');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const repo = new C.Repo(data);
const req = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = {triage: [], match: []};
for (const [text, bed, plan] of req.triage) {
  const t = C.triage(repo, text, {lat: 39.9, lon: 32.86, bedridden: bed, has_physician_plan: plan});
  out.triage.push([text, bed, plan, t.level, t.route, t.red_flags, t.services, t.sources, t.profession]);
}
for (const [pid, svc, pr] of req.match) {
  const p = {...repo.patients[pid], has_physician_plan: true};
  const r = C.findCandidates(repo, svc, p, '2026-11-16', 570, {yetkinlik: pr[0], fiyat: pr[1], hiz: pr[2]}, 20, 5);
  out.match.push([pid, svc, pr, r.candidates.map(c => [c.provider_id, c.arrival_min,
     Math.round(c.price.patient_pays * 100) / 100, Math.round(c.total * 1e6) / 1e6])]);
}
process.stdout.write(JSON.stringify(out));
"""


def main() -> int:
    py = python_side()
    req = {"triage": [x[:3] for x in py["triage"]], "match": [x[:3] for x in py["match"]]}
    web = Path(__file__).resolve().parent
    res = subprocess.run(["node", "-e", JS], input=json.dumps(req), capture_output=True,
                         text=True, cwd=web)
    if res.returncode:
        print(res.stderr)
        return 1
    js = json.loads(res.stdout)
    bad = 0
    for a, b in zip(py["triage"], js["triage"]):
        if a[3:] != b[3:]:
            bad += 1
            print("TRIYAJ FARKI", a, b)
    for a, b in zip(py["match"], js["match"]):
        pa = [[c[0], c[1]] for c in a[3]]
        pb = [[c[0], c[1]] for c in b[3]]
        price_ok = all(abs(x[2] - y[2]) < 0.02 and abs(x[3] - y[3]) < 1e-4 for x, y in zip(a[3], b[3]))
        if pa != pb or not price_ok:
            bad += 1
            print("ESLESME FARKI", a[:3], a[3], b[3])
    print(f"triyaj: {len(py['triage'])} durum, eşleştirme: {len(py['match'])} durum, fark: {bad}")
    for row in py["triage"][-len(EXTRA_TEXTS) * 4::4]:
        print("  ek:", row[0], "->", row[3], row[4] or row[5])
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
