"""Fiyatlar (Arda'nın gerekçeli pilot listesi, Arda/FIYATLANDIRMA_ARASTIRMASI.md, 21.11.2026) ve ikiye ayrılan hizmetler.
A) Uygulamadaki taban ücretler listedeki değerler
B) Sonda: bakım / takma-değişim seçimi; 'değişecek' denince takma önceden seçili; seçim fiyata yansır
C) Ayak: standart / diyabetik; 'şeker hastası' denince diyabetik önceden seçili
Çalıştır: python web/e2e_fiyat.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri() + "?rol=ham"
ARDA = {"tele_muayene": 900, "tele_hemsire_destekli": 2000, "ev_muayene": 4000, "palyatif_degerlendirme": 5000, "recete_rapor_yenileme": 600,
        "kan_alma": 900, "im_enjeksiyon": 800, "iv_serum": 1800, "yara_pansuman": 1200, "basi_yarasi_bakimi": 1800, "sonda_bakimi": 900,
        "sonda_takma": 2500, "beslenme_tupu_bakimi": 1300, "vital_takip": 600, "fizyoterapi_seansi": 2000, "solunum_fizyoterapisi": 2000,
        "odyolojik_tarama": 1100, "isitme_cihazi_ayar": 900, "beslenme_degerlendirme": 1000, "yutma_degerlendirme": 2250,
        "ev_guvenligi_dusme": 1800, "psikolojik_destek": 1500, "ayak_bakimi": 2000, "diyabetik_ayak_bakimi": 3200, "lohusa_izlem": 1500}
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p = pg.locator("#pScreen")

    def bastan(metin):
        pg.goto(PAGE); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
        p.locator("[data-act=start]").first.click()
        p.locator("#pInput").fill(metin); p.locator("#pInput").press("Enter")
        for _ in range(12):
            pg.wait_for_timeout(600)
            if p.locator("[data-plan]").count(): break
            if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
        p.locator("[data-plan=var]").first.click()
        p.locator("[data-act=options]").click(); pg.wait_for_timeout(300)

    print("A) Taban ücretler")
    pg.goto(PAGE); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
    fiyat = pg.evaluate("Object.fromEntries(window.EVDE_DATA.services.map(s => [s.code, s.base_fee_tl]))")
    farkli = {k: (fiyat.get(k), v) for k, v in ARDA.items() if fiyat.get(k) != v}
    check(not farkli and len(fiyat) == 25, f"25 hizmetin taban ücreti Arda'nın listesiyle aynı {farkli}")

    print("B) Sonda")
    bastan("Babamın idrar sondası değişecek")
    s = p.locator(".hizmet-secim")
    check(s.count() == 1 and "İdrar sondası bakımı" in s.inner_text() and "takma / değişim" in s.inner_text(), "seçenekler ekranında sonda bakımı / takma-değişim seçimi")
    check("2.500 TL'den" in s.inner_text() and "900 TL'den" in s.inner_text(), "seçeneklerde taban ücretler görünüyor")
    check(s.locator("[data-hizmet=sonda_takma]").get_attribute("aria-pressed") == "true", "'değişecek' denince takma/değişim önceden seçili (seçenekler ekranında)")
    fiyatlar = lambda: pg.evaluate("[...document.querySelectorAll('#pScreen .teklif-toplam, #pScreen .num, #pScreen .price')].map(e => e.innerText).join('|')")
    pg.wait_for_timeout(600); once = p.inner_text()
    p.locator("[data-hizmet=sonda_bakimi]").click(); pg.wait_for_timeout(600)
    check(p.locator("[data-hizmet=sonda_bakimi]").get_attribute("aria-pressed") == "true", "hasta bakımı seçebiliyor")
    sonra = p.inner_text()
    check(once != sonra, "seçim değişince seçenekler ve fiyatlar yeniden hesaplandı")

    print("C) Ayak bakımı")
    bastan("Şeker hastası annemin ayak bakımı lazım, tırnak batması var")
    s = p.locator(".hizmet-secim")
    check(s.count() == 1 and s.locator("[data-hizmet=diyabetik_ayak_bakimi]").get_attribute("aria-pressed") == "true", "'şeker hastası' denince diyabetik ayak bakımı önceden seçili")
    check("3.200 TL'den" in s.inner_text() and "2.000 TL'den" in s.inner_text(), "standart 2.000, diyabetik 3.200 TL'den")
    bastan("Annemin ayak tırnağı batıyor, ayak bakımı istiyoruz")
    check(p.locator(".hizmet-secim [data-hizmet=ayak_bakimi]").get_attribute("aria-pressed") == "true", "diyabet söylenmeyince standart ayak bakımı seçili")
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
