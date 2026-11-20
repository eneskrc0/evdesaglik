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


# Ses tanıma bir kelimeyi ekinden bölebilir: "ala miyorum", "kana ma", "kay dı", "de gil" → birleştir.
# Yalnızca tek başına Türkçe kelime olmayan ek parçaları birleşir (soru eki "mi/mı" ayrı yazıldığı için birleşmez).
_EK_BOLUNME = re.compile(r"(?<=[a-z]) (m[iu]yor\w*|ma|me|d[iu]|t[iu]|yor|yorum|yoruz)(?= )")
_DEGIL = re.compile(r" de gil")
# Çift olumsuz olumlu demektir: "yok değil", "yok diyemem", "yok sayılmaz" → "var"
_CIFT_OLUMSUZ = re.compile(r" (yok|degil) (degil|diyemem|diyemeyiz|denemez|sayilmaz)(?= )")


def normalize(text: str) -> str:
    """'Göğsümde BASKI var!' -> 'gogsumde baski var'"""
    t = text.translate(_UPPER).lower().translate(_FOLD)
    t = " " + _SPACES.sub(" ", t).strip() + " "
    t = _EK_BOLUNME.sub(r"\1", _DEGIL.sub(" degil", t))
    t = _CIFT_OLUMSUZ.sub(" var", t)
    return _AGIZ.sub(lambda m: m.group(1) + _AGIZ_EK[m.group(2)], t)


# Çok kelimeli anahtar: her kelime sonraki kelimenin başı olabilir (iyelik/ek: "kanama durmuyor" ⊂ "kanamasi durmuyor")
# ve araya en fazla bir kelime girebilir ("kolu yine tutmuyor").
_IFADE: dict[str, re.Pattern] = {}


def has(part: str, text: str) -> bool:
    """part (normalize, boşluksuz kenar) metinde kelime başından geçiyor mu?"""
    if " " not in part:
        return f" {part}" in text
    rx = _IFADE.get(part)
    if rx is None:
        rx = _IFADE[part] = re.compile(" " + r"\w* (?:\w+ )?".join(re.escape(w) for w in part.split()))
    return bool(rx.search(text))


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
_CELISKI = re.compile(r" (aslinda|yani|galiba|sanki|biraz) (\w+ )?var | (yok|degil) var | var yok ")
# Şu anki durum açıkça söylendi mi ("şimdi iyi", "şu an gayet iyi", "artık yok")
_SIMDI_DURUM = re.compile(r" (simdi|su an|su anda|artik|bugun) (\w+ ){0,2}(iyi|yok|gecti|normal|duzeldi|olmuyor|kalmadi)")


def clauses(text: str) -> list[tuple[str, bool]]:
    """Yan cümleler (normalize) ve olumsuz/eski olup olmadıkları."""
    t = text.translate(_UPPER).lower()
    out = []
    for c in _YAN.split(t):
        n = normalize(c)
        if not n.strip():
            continue
        neg = (bool(set(n.split()) & _OLUMSUZ) and not _YOKLUK_BELIRTI.search(n)) or eski(n)
        out.append((n, neg))
    return out


def eski(n: str) -> bool:
    """Yan cümle yalnızca geçmişi mi anlatıyor? ("geçen yıl bayılmıştı"; "geçen yıl … şimdi yine" değil)"""
    return bool(_ESKI.search(n)) and not _SIMDI.search(n)


def match_live(parsed, raw_text: str) -> str | None:
    """Kırmızı bayrak eşleşmesi: olumsuz/eski yan cümleleri hesaba katar."""
    full = normalize(raw_text)
    cl = clauses(raw_text)
    celiski = bool(_CELISKI.search(full))
    for parts in parsed:
        if not all(has(p, full) for p in parts):
            continue
        if celiski:
            return " + ".join(parts)
        # Her parça en az bir olumlu yan cümlede (ya da yan cümleler arasında) geçmeli:
        # "göğüs ağrısı yok ama dizi ağrıyor" → "göğüs" yalnız olumsuz cümlede → sayılmaz.
        # Söz düşmesi: "göğsümde ağrı yok, baskı var" → olumsuz cümledeki organ, kendi organını anmayan olumlu
        # cümleye taşınır (baskı göğüste); "…ama dizi ağrıyor" başka organ andığı için taşınmaz.
        olu = [p for p in parts if not _canli(p, cl)]
        if not olu:
            return " + ".join(parts)
        if all(_ORGAN.search(f" {p} ") for p in olu) and any(
                not neg and not _ORGAN.search(n) and any(has(p, n) for p in parts if p not in olu) for n, neg in cl):
            return " + ".join(parts)
    return None


# Organ/vücut bölgesi adları (söz düşmesinde konu taşınması için)
_ORGAN = re.compile(r" (gogu?s\w*|gogs\w*|diz\w*|sirt\w*|bel(i|im|in|inde|imde)?|bas(i|im|in|inda|imda|ina|ima)|kafa\w*|"
                    r"kol(u|um|lari|larim|unda|umda)?|bacak\w*|bacag\w*|ayak\w*|ayag\w*|karin\w*|karn\w*|mide\w*|boyun\w*|"
                    r"boyn\w*|omuz\w*|omz\w*|kalca\w*|dis(i|im|leri|lerim)|kulak\w*|kulag\w*|goz\w*|bogaz\w*|"
                    r"el(i|im|leri|lerim)|parmak\w*|parmag\w*|yuz(u|um|unde|umde)|agz\w*|kasik\w*|kasig\w*) ")


def _canli(p: str, cl) -> bool:
    yer = [neg for n, neg in cl if has(p, n)]
    return not yer or not all(yer)


def gecmis_eslesme(parsed, raw_text: str) -> str | None:
    """Yalnızca geçmiş zaman yüzünden sayılmayan eşleşme ("geçen yıl bayılmıştı"), şu anki durum söylenmediyse.
    İstemci bunu bir kez "şu an da var mı?" diye sorar; olumsuzlukla ("bayılmadı") bastırılanlar sorulmaz."""
    full = normalize(raw_text)
    if _SIMDI_DURUM.search(full) or match_live(parsed, raw_text):
        return None
    cl = clauses(raw_text)
    for parts in parsed:
        if not all(has(p, full) for p in parts):
            continue
        if any(neg and eski(n) and not (set(n.split()) & _OLUMSUZ) for n, neg in cl if any(has(p, n) for p in parts)):
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
        if all(has(p, norm_text) for p in parts):
            return " + ".join(parts)
    return None
