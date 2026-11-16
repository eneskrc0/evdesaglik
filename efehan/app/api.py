"""Uygulamanın tek giriş noktası: şikayet -> triyaj -> eşleştirme.

İleride mobil uygulama / web arka ucu bu fonksiyonu çağırır.
"""
from __future__ import annotations

from .db import Patient, Repo
from .matching import Preferences, find_candidates, hhmm
from .triage import LEVEL_TEXT, triage


def handle_request(repo: Repo, complaint: str, patient: Patient, date: str, now_min: int,
                   prefs: Preferences | None = None, top_k: int = 3) -> dict:
    t = triage(repo, complaint, patient)
    out = {
        "seviye": t.level,
        "seviye_metni": LEVEL_TEXT[t.level],
        "mesaj": t.message,
        "gerekceler": t.reasons,
        "kaynaklar": t.sources,
        "oneriler": [],
        "notlar": [],
    }
    if t.is_emergency:
        return out  # acil durumda asla randevu önerilmez

    service = t.services[0]
    cands, notes = find_candidates(repo, service, patient, date, now_min, prefs, top_k=top_k)
    out["hizmet"] = repo.services[service].name_tr
    out["notlar"] = notes
    if t.level == "TELE_HEMSIRE":
        out["notlar"].append("Hekim video görüşmesi o saatte müsait bir hekime ayrıca atanır.")
    for c in cands:
        out["oneriler"].append({
            "saglayici": c.name,
            "meslek": repo.professions[c.profession]["name_tr"],
            "saat": hhmm(c.arrival_min),
            "fiyat_tl": round(c.price.patient_pays),
            "ziyaret_paylasimi": bool(c.insertion and c.insertion.shared),
            "puanlar": c.scores,
            "toplam": c.total,
            "neden": c.explanation,
            "dagilim_tl": c.price.as_dict(),
        })
    return out
