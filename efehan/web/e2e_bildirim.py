"""Bildirim provası: zil + liste + uygulama içi afiş + iki yanda kilitli telefon.
Akış (#ikisi): genel bildirimler → teklif → kabul → yola çıktı → yaklaşıyor → kapında → kod → ziyaret → 'Her şey yolunda mı?' → bitti → puan.
Çalıştır: python web/e2e_bildirim.py"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent / "dist" / "kapida.html"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)
basliklar = lambda pg, t: pg.evaluate(f"[...document.querySelectorAll('{'#kilitP' if t == 'p' else '#kilitH'} .bld-kart b')].map(b => b.innerText)")
def tum(pg, t):  # bildirim listesindeki tüm başlıklar (zil yalnız ana sayfada; liste her ekranda aynı)
    return pg.evaluate(f"KapidaBildirim.liste('{t}')")

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1600, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(D.as_uri() + "#ikisi"); pg.wait_for_timeout(2600)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    print("A) Başlangıç")
    check(pg.locator("#kilitPCol").is_visible() and pg.locator("#kilitHCol").is_visible(), "iki yanda kilitli telefon (hasta ve çalışan)")
    check("09:30" in pg.locator("#kilitP").inner_text() and "16 Kasım" in pg.locator("#kilitP").inner_text(), "kilit ekranında saat ve tarih")
    check("anında sağlık'a hoş geldin" in basliklar(pg, "p") and "Günaydın!" in basliklar(pg, "h"), "genel bildirimler iki kilit ekranına da düştü")
    check(pg.locator('[data-zil="p"] .zil-rozet').inner_text() == "2" and pg.locator('#pScreen .appbar [data-zil="p"]').count() == 1, "uygulama başlığındaki zilde okunmamış sayısı")
    z = pg.locator('[data-zil="p"]'); z.click(); pg.wait_for_timeout(150)
    check(pg.locator("#panelP").is_visible() and pg.locator("#panelP .bld-kart").count() == 2 and z.get_attribute("aria-expanded") == "true", "zile basınca bildirim listesi açıldı")
    pg.locator("#panelP [data-bld-okundu]").click()
    check(pg.locator('[data-zil="p"] .zil-rozet').is_hidden(), "'Tümünü okundu say' rozeti kaldırdı")
    pg.keyboard.press("Escape")
    check(pg.locator("#panelP").is_hidden(), "Esc ile liste kapandı")

    print("B) Teklif ve kabul")
    p.locator("[data-tile]").first.click()
    for _ in range(10):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    p.locator("[data-act=options]").click()
    teklif = None
    for _ in range(40):
        pg.wait_for_timeout(500)
        if p.locator(".yz-teklif [data-pick]").count(): teklif = p.locator(".yz-teklif [data-pick]").first; break
    pg.wait_for_timeout(1300)
    check(teklif is not None and "Yeni teklif geldi" in tum(pg, "p"), "teklif gelince hastaya 'Yeni teklif geldi'")
    teklif.click(); p.locator("[data-act=confirm]").click(); pg.wait_for_timeout(1300)
    check("Randevun kesinleşti" in tum(pg, "p") and "Randevu kesinleşti" in tum(pg, "h"), "kabulde iki tarafa 'Randevu kesinleşti'")
    check("Yola çıkma zamanı" in tum(pg, "h"), "çalışana 'Yola çıkma zamanı' (neyle, ne zaman)")
    pg.wait_for_timeout(4500)
    check(any("yola çıktı" in x for x in tum(pg, "p")), "hastaya 'yola çıktı'")
    afis = pg.locator("#afisP")
    pg.wait_for_selector("#pScreen [data-gz=h-kod-ok]", timeout=120000); pg.wait_for_timeout(1300)
    l = tum(pg, "p")
    check(any("yaklaşıyor" in x for x in l) and any("kapında" in x for x in l), "hastaya 'yaklaşıyor' ve 'kapında'")
    check("Vardın" in tum(pg, "h"), "çalışana 'Vardın'")
    check(any(" kapında" in x for x in basliklar(pg, "p")), "son bildirim hastanın kilit ekranının en üstünde")

    print("C) Ziyaret")
    p.locator("[data-gz=h-kod-ok]").click(); pg.wait_for_timeout(1300)
    check("Hasta kodu onayladı" in tum(pg, "h"), "çalışana 'Hasta kodu onayladı'")
    h.locator("[data-gz=checkin]").click(); pg.wait_for_timeout(1300)
    check("Ziyaret başladı" in tum(pg, "p"), "hastaya 'Ziyaret başladı'")
    pg.locator("#gzMasa [data-gz=d-simdi]").click(); pg.wait_for_timeout(1300)
    hk = pg.locator("#kilitH .bld-kart").first
    check("Her şey yolunda mı?" in hk.inner_text() and "acil" in (hk.get_attribute("class") or ""), "kontrol bildirimi çalışanın kilit ekranında, acil renginde")
    pg.locator("#gzPin").fill("2580"); pg.keyboard.press("Enter")
    h.locator("[data-gz=cikis]").first.click(); h.locator("[data-gz=cikis-sec][data-v=yok]").click(); pg.wait_for_timeout(1300)
    check("Ziyaret bitti" in tum(pg, "p") and "Kazanç eklendi" in tum(pg, "h"), "bitince hastaya 'Ziyaret bitti', çalışana 'Kazanç eklendi'")
    # kilit ekranındaki bildirime dokun → uygulamada açılır
    p.locator("[data-act=home]").first.click()
    pg.locator("#kilitP .bld-kart", has_text="Ziyaret bitti").click(); pg.wait_for_timeout(300)
    check(p.locator("[data-gz=h-tamam]").count() == 1, "kilit ekranındaki 'Ziyaret bitti'ye dokununca takip ekranı açıldı")
    p.locator("[data-gz=h-tamam]").click(); p.locator(".puan-btn").nth(4).click(); p.locator("[data-act=puanGonder]").click(); pg.wait_for_timeout(1300)
    check("Ödeme onaylandı" in tum(pg, "p") and "Yeni değerlendirme" in tum(pg, "h"), "onayda hastaya 'Ödeme onaylandı (demo)', puanda çalışana 'Yeni değerlendirme'")
    pg.locator('[data-zil="h"]').click(); pg.locator("#panelH .bld-kart", has_text="Yeni değerlendirme").click(); pg.wait_for_timeout(200)
    check(h.locator("[role=tab][aria-selected=true]").inner_text().startswith("Rotam") and h.locator(".puan-calisan").count() == 1, "çalışan listede bildirime dokununca Rotam'da değerlendirme")
    check(not errs, f"sayfa hatası yok {errs}")
    pg.close()

    print("D) Telefon ekranı ve tek rol")
    pg = br.new_page(viewport={"width": 390, "height": 844}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(D.as_uri() + "#hasta"); pg.wait_for_timeout(2600)
    check(pg.locator("#kilitPCol").is_hidden() and pg.locator('[data-zil="p"]').is_visible(), "telefonda kilitli telefonlar gizli, zil görünür")
    pg.locator('[data-zil="p"]').click()
    check(pg.locator("#panelP").is_visible() and pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1, "telefonda liste açılıyor, taşma yok")
    pg.close()
    pg = br.new_page(viewport={"width": 1366, "height": 900}); pg.goto(D.as_uri() + "#calisan"); pg.wait_for_timeout(2600)
    check(pg.locator("#kilitHCol").is_visible() and pg.locator("#kilitPCol").is_hidden(), "yalnız çalışan görünümünde yalnız çalışanın kilitli telefonu")
    pg.close()
    pg = br.new_page(viewport={"width": 1366, "height": 900}); pg.goto(D.as_uri() + "#ikisi"); pg.wait_for_timeout(2600)
    ys = [pg.locator(s).bounding_box()["y"] for s in ("#kilitPCol", "#colP", "#colH", "#kilitHCol")]
    check(len(set(ys)) == 1 and pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1, "1366 px ekranda dört telefon yan yana, taşma yok")
    pg.screenshot(path=str(D.parent / "bildirimler.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
