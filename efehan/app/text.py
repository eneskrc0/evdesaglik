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


def normalize(text: str) -> str:
    """'Göğsümde BASKI var!' -> 'gogsumde baski var'"""
    t = text.translate(_UPPER).lower().translate(_FOLD)
    return " " + _SPACES.sub(" ", t).strip() + " "


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
