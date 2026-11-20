"""Sesli sohbet kataloğu — KURAL katmanı (Python app/ + JS core.js, aynı vakalar, eşitlik dahil).

Çalıştır:  python data/eval/sesli_kural.py              (geliştirme seti)
           python data/eval/sesli_kural.py --gizli      (yalnızca en sonda)
Çıktı: data/eval/sonuc/kural_<set>.json + özet. Çıkış kodu: başarısız ya da Python/JS farkı varsa 1.
"""
from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from app.db import Patient, Repo  # noqa: E402
from app import triage as T  # noqa: E402
from app.text import normalize  # noqa: E402

GIZLI = "--gizli" in sys.argv
KAT = json.loads((ROOT / "data/eval" / ("sesli_gizli.json" if GIZLI else "sesli_senaryolar.json")).read_text(encoding="utf-8"))
VAKALAR = [k for k in KAT if k["katman"] == "kural"]


def mesajlar(k):
    return k["girdi"] if isinstance(k["girdi"], list) else [k["girdi"]]


def py_degerlendir(repo, msgs):
    pt = Patient("X", "Bornova", 38.46, 27.22, False, False)
    if hasattr(T, "konusma_degerlendir"):
        d = T.konusma_degerlendir(repo, msgs, pt)
        return {"acil": d["acil"], "meslek": d["meslek"], "gecmis_sor": bool(d["gecmis"]), "saglik": d["saglik"]}
    t = T.triage(repo, ". ".join(msgs), pt)
    it, _ = T.requested_profession(repo, normalize(". ".join(msgs)))
    return {"acil": t.is_emergency, "meslek": it["profession_code"] if it else None, "gecmis_sor": None, "saglik": None}


JS = r"""
const fs = require('fs');
const C = require('./core.js');
const repo = new C.Repo(JSON.parse(fs.readFileSync('./data.json', 'utf8')));
const req = JSON.parse(fs.readFileSync(0, 'utf8'));
const pt = {lat: 38.46, lon: 27.22, bedridden: false, has_physician_plan: false};
const out = req.map((msgs) => {
  if (C.konusmaDegerlendir) { const d = C.konusmaDegerlendir(repo, msgs, pt); return {acil: d.acil, meslek: d.meslek, gecmis_sor: d.gecmis.length > 0, saglik: d.saglik}; }
  const t = C.triage(repo, msgs.join('. '), pt); const [it] = C.requestedProfession(repo, C.normalize(msgs.join('. ')));
  return {acil: t.is_emergency, meslek: it ? it.profession_code : null, gecmis_sor: null, saglik: null};
});
process.stdout.write(JSON.stringify(out));
"""


def main():
    repo = Repo()
    js = json.loads(subprocess.run(["node", "-e", JS], input=json.dumps([mesajlar(k) for k in VAKALAR]), capture_output=True,
                                   text=True, cwd=ROOT / "web", check=True).stdout)
    sonuc, fark = [], 0
    for k, j in zip(VAKALAR, js):
        p = py_degerlendir(repo, mesajlar(k))
        if p != j:
            fark += 1
        hatalar = []
        for alan, bek in k["beklenen"].items():
            if alan == "uzman":
                continue
            gercek = p.get(alan)
            if gercek is None and alan in ("gecmis_sor", "saglik"):
                hatalar.append(f"{alan}: işlev yok")
            elif gercek != bek:
                hatalar.append(f"{alan}: beklenen {bek}, gerçek {gercek}")
        sonuc.append({"id": k["id"], "kategori": k["kategori"], "girdi": k["girdi"], "beklenen": k["beklenen"], "gercek": p,
                      "js_ayni": p == j, "gecti": not hatalar, "hatalar": hatalar, "onem": k["onem"], "uzman": k.get("uzman", False)})
    kat = defaultdict(Counter)
    for s in sonuc:
        kat[s["kategori"]]["toplam"] += 1
        kat[s["kategori"]]["gecti"] += s["gecti"]
    gecti = sum(s["gecti"] for s in sonuc)
    print(f"KURAL ({'gizli' if GIZLI else 'geliştirme'}): {gecti}/{len(sonuc)} geçti · Python/JS farkı: {fark}")
    print("  " + " · ".join(f"{c} {v['gecti']}/{v['toplam']}" for c, v in sorted(kat.items())))
    for s in sonuc:
        if not s["gecti"] or not s["js_ayni"]:
            g = " | ".join(s["girdi"]) if isinstance(s["girdi"], list) else s["girdi"]
            print(f"  ✗ {s['id']} [{s['onem']}{', uzman' if s['uzman'] else ''}] {g!r}: {'; '.join(s['hatalar'])}{'' if s['js_ayni'] else ' (JS FARKLI)'}")
    out = ROOT / "data/eval/sonuc" / f"kural_{'gizli' if GIZLI else 'gelistirme'}.json"
    out.write_text(json.dumps(sonuc, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0 if gecti == len(sonuc) and not fark else 1


if __name__ == "__main__":
    raise SystemExit(main())
