"""Aciliyet ve hizmet seviyesi yönlendirmesi (triyaj).

Bu modül TEŞHİS KOYMAZ. Yaptığı iki şey:
  1. Kırmızı bayrak varsa randevu önermeyi durdurur, 112 / 114'e yönlendirir.
  2. Acil değilse şikayeti doğru hizmet seviyesine yönlendirir:
       TELE          hekimle video görüşme
       TELE_HEMSIRE  hemşire evde ölçüm yapar + hekim videoda
       HEKIM_EV      hekim ev ziyareti
       PLANLI        hekim planı / reçetesi olan hastaya sağlık meslek mensubu
     Hekim planı yoksa hemşire / fizyoterapist vb. doğrudan atanmaz (S08: serbest
     meslek yönetmeliği hekim tanısı ve planı şartı).

v0.1: kural tabanlı. Kırmızı bayraklar ileride de kural tabanlı kalmalı (güvenlik ağı);
şikayet anlama katmanı bir dil modeliyle güçlendirilebilir (README > Yol haritası).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .db import HEKIM_YALNIZ_GORUNTULU, Patient, Repo
from .text import gecmis_eslesme, match, match_live, normalize

DISCLAIMER = ("Bu bir teşhis değildir; yönlendirmedir. Durum kötüleşirse ya da emin "
              "değilseniz 112'yi arayın.")

LEVEL_DEFAULT_SERVICE = {
    "TELE": "tele_muayene",
    "TELE_HEMSIRE": "tele_hemsire_destekli",
    "HEKIM_EV": "ev_muayene",
}
LEVEL_TEXT = {
    "ACIL_112": "Acil: 112",
    "ZEHIR_114": "Zehir danışma: 114",
    "TELE": "Hekimle video görüşme",
    "TELE_HEMSIRE": "Hemşire evde + hekim videoda",
    "HEKIM_EV": "Hekim ev ziyareti",
    "PLANLI": "Planlı ev hizmeti (hekim planına göre)",
}
# Yatağa bağımlı hastada bile uzaktan kalabilecek işler (ölçüm gerekmez)
REMOTE_OK_ROUTES = {"CR_RECETE", "CR_PSIKO"}
PHYSICIANS = {"hekim", "uzman_hekim"}


# Kendini düzeltme: "hemşire istiyorum… aslında fizyoterapist", "doktor, yok yok hemşire" → düzeltmeden sonraki istek geçerli
_DUZELTME = re.compile(r" (aslinda|pardon|yok yok|hayir|yanlis soyledim|demek istedim|vazgectim|degil|yerine) ")


def _meslek_ara(repo: Repo, text: str):
    for it in repo.intents:
        m = match(it["parsed"], text)
        if m:
            return it, m
    # Ses tanıma kelimeyi bölebilir ("hem şire", "fizyo terapist"): uzun anahtarları boşluksuz da dene
    sik = text.replace(" ", "")
    for it in repo.intents:
        for parts in it["parsed"]:
            if all(len(p.replace(" ", "")) >= 6 and p.replace(" ", "") in sik for p in parts):
                return it, " + ".join(parts)
    return None, None


def requested_profession(repo: Repo, text: str):
    """Kullanıcı belirli bir meslek istiyor mu? (profession_intents, öncelik sırasıyla). text normalize edilmiş.
    Düzeltme varsa son düzeltmeden sonra söylenen meslek esastır."""
    for d in reversed(list(_DUZELTME.finditer(text))):
        it, m = _meslek_ara(repo, text[d.end() - 1:])
        if it:
            return it, m
    return _meslek_ara(repo, text)


# Sağlıkla ilgili içerik var mı? (rapor kapısı: anlamsız/konu dışı konuşmadan rapor çıkmaz). Meslek adı tek başına yetmez.
SAGLIK_KOK = ("agri", "agriy", "aci", "yara", "ates", "oksur", "hasta", "ilac", "tansiyon", "seker", "nefes", "gogus", "gogs",
              "bayil", "nobet", "kan ", "kanam", "dikis", "ameliyat", "igne", "serum", "pansuman", "sonda", "halsiz", "yorgun",
              "uyus", "sis", "kizar", "kasin", "idrar", "ishal", "kabiz", "kus", "dus", "yuruy", "felc", "inme", "kalp", "bobrek",
              "diyabet", "astim", "koah", "kanser", "demans", "alzheimer", "unutkan", "uyku", "uyuy", "istah", "kilo", "tahlil",
              "recete", "rahatsiz", "bas don", "bulanti", "mide", "karin", "bel ", "sirt", "diz", "kalca", "kol", "bacak", "ayak",
              "goz", "kulak", "isit", "konusma", "yutk", "yatalak", "yatag", "bakim", "lohusa", "dogum", "hamile", "bebek",
              "asi", "tedavi", "kontrol", "muayene", "olcum", "vital", "zehir", "alerji", "kasil", "titre", "terle", "morar",
              "sislik", "enfeksiyon", "iltihap", "akinti", "yanik", "kirik", "carp", "agzi", "yuzu", "bilinc", "kendinde", "tepki")


def saglik_icerigi(repo: Repo, raw: str) -> bool:
    n = normalize(raw)
    if any(match(rf["parsed"], n) for rf in repo.red_flags) or any(match(r["parsed"], n) for r in repo.routes):
        return True
    return any(f" {k}" in n for k in SAGLIK_KOK)


# Kırmızı bayrak olmasa da geçmişte yaşandıysa şu anki durumu sorulacak belirti (S01: nefes darlığı)
GECMIS_EK = [{"code": "GB_NEFES_DARLIGI", "parsed": [["nefes darligi"], ["nefes darlik"]]}]


def konusma_degerlendir(repo: Repo, mesajlar: list[str], patient: Patient) -> dict:
    """Sohbetin kullanıcı mesajları → acil mi, istenen meslek, şu an durumu sorulacak geçmiş belirtiler, sağlık içeriği."""
    metin = ". ".join(mesajlar)
    t = triage(repo, metin, patient)
    it, _ = requested_profession(repo, normalize(metin))
    gecmis = [] if t.is_emergency else [rf["code"] for rf in repo.red_flags + GECMIS_EK if gecmis_eslesme(rf["parsed"], metin)]
    return {"acil": t.is_emergency, "level": t.level, "message": t.message, "red_flags": t.red_flags, "reasons": t.reasons,
            "meslek": it["profession_code"] if it else None, "gecmis": gecmis, "saglik": saglik_icerigi(repo, metin)}


def _intent_only(repo: Repo, it: dict, m: str, patient: Patient) -> TriageResult:
    """Şikâyet kalıbı yok ama meslek isteği var: istenen mesleğe yönlendir, plan kuralı (S08) korunur."""
    prof, svc = it["profession_code"], it["default_service"]
    name = repo.professions[prof]["name_tr"]
    reasons = [f"Meslek isteği '{name}' (eşleşen: {m})"]
    plan = patient.has_physician_plan
    if prof in PHYSICIANS:
        level = "TELE" if svc == "tele_muayene" else "HEKIM_EV"
        services = [svc]
    elif plan:
        level, services = "PLANLI", [svc]
        reasons.append("Hekim planı/reçetesi var: istenen meslek atanabilir (S07, S08)")
    elif prof == "hemsire":
        level, services = "TELE_HEMSIRE", ["tele_hemsire_destekli"]
        reasons.append("Hekim planı yok: hemşire evine gelir, hekim aynı anda görüntülü değerlendirir (S08, S14)")
    else:
        level = "HEKIM_EV" if patient.bedridden else "TELE"
        services = [LEVEL_DEFAULT_SERVICE[level]]
        reasons.append(f"Hekim planı yok: {name} ancak hekim planıyla gelebilir; önce hekim (S08)")
    return TriageResult(
        level=level, services=services, message=f"Önerilen: {LEVEL_TEXT[level]}. " + DISCLAIMER,
        route=it["code"], reasons=reasons, profession=prof,
        sources=sorted({it["source_id"], "S07", "S08"} if level == "PLANLI" else {it["source_id"], "S08"}),
    )


def _apply_intent(repo: Repo, res: TriageResult, it: dict, m: str) -> TriageResult:
    """Şikâyet kalıbı bulundu ve kullanıcı ayrıca bir meslek istedi: mümkünse o mesleğe daralt."""
    prof = it["profession_code"]
    name = repo.professions[prof]["name_tr"]
    res.profession = prof
    res.reasons.append(f"Meslek isteği '{name}' (eşleşen: {m})")
    if prof in PHYSICIANS:
        svc = it["default_service"]
        res.level = "TELE" if svc == "tele_muayene" else "HEKIM_EV"
        res.services = [svc]
        res.reasons.append("Kullanıcı doktor istedi: hekim hizmeti")
        res.message = f"Önerilen: {LEVEL_TEXT[res.level]}. " + DISCLAIMER
        return res
    offered = repo.profession_services.get(prof, set())
    if res.level == "PLANLI":
        mine = [s for s in res.services if s in offered]
        if mine:
            res.services = mine
        else:
            res.profession = None
            res.reasons.append(f"{name} bu hizmeti vermiyor; şikâyete uygun meslek önerildi")
    elif prof == "hemsire" and res.level == "TELE":
        res.level, res.services = "TELE_HEMSIRE", ["tele_hemsire_destekli"]
        res.reasons.append("Hekim planı yok: hemşire evine gelir, hekim görüntülü bağlanır")
        res.message = f"Önerilen: {LEVEL_TEXT[res.level]}. " + DISCLAIMER
    else:
        res.reasons.append(f"Hekim planı yok: {name} ancak hekim planıyla gelebilir (S08)")
    return res


@dataclass
class TriageResult:
    level: str
    services: list[str]
    message: str
    red_flags: list[str] = field(default_factory=list)
    route: str | None = None
    reasons: list[str] = field(default_factory=list)
    other_routes: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    profession: str | None = None  # kullanıcının açıkça istediği meslek (ör. "hemşire istiyorum")

    @property
    def is_emergency(self) -> bool:
        return self.level in ("ACIL_112", "ZEHIR_114")


def triage(repo: Repo, complaint: str, patient: Patient) -> TriageResult:
    res = _triage(repo, complaint, patient)
    return hekim_goruntulu(res, patient) if HEKIM_YALNIZ_GORUNTULU else res


def hekim_goruntulu(res: TriageResult, patient: Patient) -> TriageResult:
    """Doktorlar yalnızca görüntülü (ekip kararı 21.11): 'hekim ev ziyareti' kararı görüntülüye çevrilir.
    Yatağa bağımlı hasta: hemşire evde ölçüm yapar, doktor görüntülü bağlanır (S14). Acil kararı değişmez."""
    if res.level != "HEKIM_EV":
        return res
    res.level = "TELE_HEMSIRE" if patient.bedridden else "TELE"
    res.services = [LEVEL_DEFAULT_SERVICE[res.level]]
    res.reasons.append("Doktorlar yalnızca görüntülü hizmet verir: " + (
        "yatağa bağımlı hasta için hemşire evde, doktor görüntülü" if patient.bedridden else "doktor görüntülü değerlendirir"))
    res.message = f"Önerilen: {LEVEL_TEXT[res.level]}. " + DISCLAIMER
    if res.level == "TELE_HEMSIRE":
        res.sources = sorted(set(res.sources) | {"S14"})
    return res


def _triage(repo: Repo, complaint: str, patient: Patient) -> TriageResult:
    text = normalize(complaint)

    # 1) Kırmızı bayraklar — her zaman önce
    hits = []
    for rf in repo.red_flags:
        m = match_live(rf["parsed"], complaint)
        if m:
            hits.append((rf, m))
    if hits:
        urgent = [h for h in hits if h[0]["action"] == "112"]
        rf, m = (urgent or hits)[0]
        level = "ACIL_112" if urgent else "ZEHIR_114"
        msg = rf["message_tr"]
        if urgent and any(h[0]["action"] == "114" for h in hits):
            msg += " Zehirlenme şüphesini 112'ye söyleyin."
        return TriageResult(
            level=level, services=[], message=msg,
            red_flags=[h[0]["code"] for h in hits],
            reasons=[f"Kırmızı bayrak '{h[0]['name_tr']}' (eşleşen: {h[1]})" for h in hits],
            sources=sorted({h[0]["source_id"] for h in hits}),
        )

    # 2) Acil olmayan yönlendirme
    it, im = requested_profession(repo, text)
    matched = [(r, m) for r in repo.routes if (m := match(r["parsed"], text))]
    if not matched and it:
        return _intent_only(repo, it, im, patient)
    if not matched:
        level = "TELE_HEMSIRE" if patient.bedridden else "TELE"
        return TriageResult(
            level=level, services=[LEVEL_DEFAULT_SERVICE[level]],
            message=("Şikayetinizi bir hekimin değerlendirmesi en doğrusu. "
                     + DISCLAIMER),
            reasons=["Bilinen bir şikayet kalıbı bulunamadı; güvenli varsayılan: hekim"],
            sources=["S14"],
        )

    route, m = matched[0]  # en yüksek öncelik (routes priority DESC sıralı)
    plan = patient.has_physician_plan
    level = route["level_with_plan"] if plan else route["level_no_plan"]
    reasons = [f"Şikayet kalıbı '{route['name_tr']}' (eşleşen: {m})"]

    if level == "PLANLI":
        services = route["service_list"]
        reasons.append("Hekim planı/reçetesi var: sağlık meslek mensubu atanabilir (S07, S08)")
    else:
        if not plan and route["level_with_plan"] == "PLANLI":
            reasons.append("Hekim planı yok: önce hekim değerlendirmesi gerekir (S08)")
        if (level == "TELE" and patient.bedridden
                and route["code"] not in REMOTE_OK_ROUTES):
            level = "TELE_HEMSIRE"
            reasons.append("Yatağa bağımlı hasta: hemşire evde ölçüm yapar, hekim videoda")
        # Rota hekimin verebileceği bir hizmet içeriyorsa onu kullan (ör. palyatif)
        doctor_services = repo.profession_services.get("hekim", set())
        route_doc = [s for s in route["service_list"] if s in doctor_services]
        if route_doc and level in ("HEKIM_EV", "TELE") and (
                level != "TELE" or repo.services[route_doc[0]].remote_possible):
            services = route_doc
        else:
            services = [LEVEL_DEFAULT_SERVICE[level]]

    res = TriageResult(
        level=level, services=services,
        message=f"Önerilen: {LEVEL_TEXT[level]}. " + DISCLAIMER,
        route=route["code"], reasons=reasons,
        other_routes=[r["code"] for r, _ in matched[1:]],
        sources=sorted({route["source_id"], "S08"} if level != "PLANLI"
                       else {route["source_id"], "S07", "S08"}),
    )
    return _apply_intent(repo, res, it, im) if it else res
