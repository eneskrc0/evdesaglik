"""Türkçe metin normalleştirme ve anahtar kelime eşleme.

Kullanıcılar Türkçe karakterli ya da karaktersiz yazabilir ("göğüs" / "gogus").
Her iki taraf da aynı biçime indirgenir: Türkçe küçük harf + ASCII katlama.
"""
from __future__ import annotations

import re

_UPPER = str.maketrans({"I": "ı", "İ": "i"})
_FOLD = str.maketrans({"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
                       "â": "a", "î": "i", "û": "u"})
_SPACES = re.compile(r"[^a-z0-9;|]+")


# Konuşma dilinde -yor'un r'si düşer: "alamıyo", "durmuyo", "yapıyom" → "alamiyor", "durmuyor", "yapiyorum"
_AGIZ = re.compile(r"(iyo|uyo)(m|n|z|lar)?(?= )")
_AGIZ_EK = {None: "r", "m": "rum", "n": "rsun", "z": "ruz", "lar": "rlar"}


def normalize(text: str) -> str:
    """'Göğsümde BASKI var!' -> 'gogsumde baski var'"""
    t = text.translate(_UPPER).lower().translate(_FOLD)
    t = " " + _SPACES.sub(" ", t).strip() + " "
    return _AGIZ.sub(lambda m: m.group(1) + _AGIZ_EK[m.group(2)], t)


# ---------- olumsuzluk ve zaman: "göğüs ağrım yok", "nöbet geçirmedi", "geçen yıl kalp krizi geçirdi" ----------
# Bir kırmızı bayrak, eşleşen TÜM parçaları yalnızca olumsuz (ya da çok eski) yan cümlelerde geçiyorsa sayılmaz.
# Yokluğun kendisi belirti olduğunda ("bilinci yok", "nefesi yok", "kendinde değil") olumsuzluk sayılmaz.
# Çelişkide ("yok, yani aslında var") olumsuzluk yok sayılır: güvenli taraf acildir.
_YAN = re.compile(r"[.!?;,\n]+|\s(?:ama|fakat|ancak|lakin|şimdi|simdi|şu an|su an|bugün|bugun)\s")
_OLUMSUZ = {"yok", "yoktu", "yoktur", "yokmus", "degil", "degildi", "degildir", "degilim", "olmadi", "olmamis",
            "gecirmedi", "gecirmemis", "olmuyor", "hissetmiyor", "yasanmiyor", "yasamadi", "yasamamis", "bayilmadi", "kusmadi", "kanamadi", "zehirlenmedi"} - {""}
_ESKI = re.compile(r" (gecen (yil|sene|ay)|(yil|yillar|sene|seneler|ay|aylar) once|eskiden|gecmiste|cocukken|gencken) ")
_YOKLUK_BELIRTI = re.compile(r" (bilinc\w*|nefes\w*|nabz\w*|nabiz\w*|solunum\w*|tepki\w*|kendinde|yerinde degil|hareket\w*) (yok|degil|kalmadi)")
_SIMDI = re.compile(r" (simdi|su an|bugun|yine|tekrar|az once|demin|biraz once|hala) ")
_CELISKI = re.compile(r" (aslinda|yani|galiba|sanki|biraz) (\w+ )?var ")


def clauses(text: str) -> list[tuple[str, bool]]:
    """Yan cümleler (normalize) ve olumsuz/eski olup olmadıkları."""
    t = text.translate(_UPPER).lower()
    out = []
    for c in _YAN.split(t):
        n = normalize(c)
        if not n.strip():
            continue
        neg = (bool(set(n.split()) & _OLUMSUZ) and not _YOKLUK_BELIRTI.search(n)) or (bool(_ESKI.search(n)) and not _SIMDI.search(n))
        out.append((n, neg))
    return out


def match_live(parsed, raw_text: str) -> str | None:
    """Kırmızı bayrak eşleşmesi: olumsuz/eski yan cümleleri hesaba katar."""
    full = normalize(raw_text)
    cl = clauses(raw_text)
    celiski = bool(_CELISKI.search(full))
    for parts in parsed:
        if not all(f" {p}" in full for p in parts):
            continue
        if celiski:
            return " + ".join(parts)
        for p in parts:
            yer = [neg for n, neg in cl if f" {p}" in n]
            if not yer or not all(yer):  # bir parça olumlu bir yan cümlede (ya da yan cümleler arasında) geçiyor
                return " + ".join(parts)
    return None


def parse_keywords(spec: str) -> list[list[str]]:
    """'a;b|c' -> [['a','b'], ['c']]  (alternatiflerden biri; içindeki tüm parçalar)"""
    alts = []
    for alt in spec.split("|"):
        parts = [normalize(p).strip() for p in alt.split(";") if p.strip()]
        if parts:
            alts.append(parts)
    return alts


def match(spec_or_parsed, norm_text: str) -> str | None:
    """Eşleşen ilk alternatifi döndürür (açıklama için), yoksa None."""
    alts = parse_keywords(spec_or_parsed) if isinstance(spec_or_parsed, str) else spec_or_parsed
    for parts in alts:
        # Kelime başından eşleşme: "ates" -> "ateşim" eşleşir, "kates" eşleşmez
        if all(f" {p}" in norm_text for p in parts):
            return " + ".join(parts)
    return None
