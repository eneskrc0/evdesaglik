"""Senaryolarla demo. Çalıştır:  python demo.py

Sağlayıcılar ve hastalar sentetiktir; fiyatlar tasarım varsayımıdır.
"""
from __future__ import annotations

from dataclasses import replace

from app.api import handle_request
from app.db import Repo
from app.matching import Preferences

DATE = "2026-11-16"
NOW = 9 * 60 + 30  # 09:30


def show(title: str, res: dict) -> None:
    print("=" * 78)
    print(title)
    print("-" * 78)
    print(f"Seviye : {res['seviye_metni']}")
    print(f"Mesaj  : {res['mesaj']}")
    for g in res["gerekceler"]:
        print(f"  • {g}")
    if res.get("hizmet"):
        print(f"Hizmet : {res['hizmet']}")
    for n in res["notlar"]:
        print(f"  ! {n}")
    for i, o in enumerate(res["oneriler"], 1):
        tag = "  [ziyaret paylaşımı]" if o["ziyaret_paylasimi"] else ""
        print(f"  {i}. {o['saglayici']} ({o['meslek']}) — {o['saat']}, {o['fiyat_tl']} TL{tag}")
        print(f"     neden: {o['neden']}")
        print(f"     puan: {o['puanlar']} -> {o['toplam']}")
        if o["ziyaret_paylasimi"]:
            d = o["dagilim_tl"]
            print(f"     kazan-kazan-kazan: hasta öder {d['patient_pays']}, sağlıkçı alır "
                  f"{d['provider_gets']}, platform {d['platform_gets']}")
    print()


def main() -> None:
    repo = Repo()
    p = repo.patients
    yatalak_planli = replace(p["P16"], bedridden=True, has_physician_plan=True)  # Sincan
    yatalak_plansiz = replace(p["P01"], bedridden=True, has_physician_plan=False)
    ayakta_plansiz = replace(p["P02"], bedridden=False, has_physician_plan=False)
    ayakta_planli = replace(p["P02"], bedridden=False, has_physician_plan=True)

    show("1) Göğüs ağrısı + terleme (acil)",
         handle_request(repo, "Babamın göğsünde baskı var, terliyor", ayakta_plansiz, DATE, NOW))

    show("2) Yatağa bağımlı anne, bası yarası, hekim planı var — yetkinlik öncelikli",
         handle_request(repo, "Annemin sırtında bası yarası var, pansuman lazım",
                        yatalak_planli, DATE, NOW, Preferences(yetkinlik=5, fiyat=1, hiz=1)))

    show("3) Aynı talep — fiyat öncelikli",
         handle_request(repo, "Annemin sırtında bası yarası var, pansuman lazım",
                        yatalak_planli, DATE, NOW, Preferences(yetkinlik=1, fiyat=5, hiz=1)))

    show("4) Yatağa bağımlı hasta, ateş ve öksürük, planı yok",
         handle_request(repo, "Annemin ateşi var, öksürüyor", yatalak_plansiz, DATE, NOW))

    show("5) Diz protezi sonrası fizik tedavi — hekim planı YOK",
         handle_request(repo, "Diz protezi ameliyatı sonrası fizik tedavi istiyorum",
                        ayakta_plansiz, DATE, NOW))

    show("6) Aynı talep — hekim planı VAR, hız öncelikli",
         handle_request(repo, "Diz protezi ameliyatı sonrası fizik tedavi istiyorum",
                        ayakta_planli, DATE, NOW, Preferences(yetkinlik=1, fiyat=1, hiz=5)))

    show("7) Çocuk yanlışlıkla çamaşır suyu içti",
         handle_request(repo, "Çocuğum yanlışlıkla çamaşır suyu içti", ayakta_plansiz, DATE, NOW))


if __name__ == "__main__":
    main()
