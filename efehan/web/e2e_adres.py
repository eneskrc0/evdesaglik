"""Kayıtlı adresler provası (yemek uygulamalarındaki gibi: bir kez kaydet, sonra seç).
A) Demo hasta hesabı (#hasta): hazır iki adres, ana sayfada seçili adres, seçim penceresinden değiştirme, özet ekranında yazmadan kullanma,
   talebe adres + kapı tarifi gidiyor
B) Yeni adres ekleme, düzenleme, silme (onaylı); hatalı form uyarısı
C) Sayfa yenilenince adresler ve seçim duruyor
D) Hesapsız görünüm: özet ekranında yazılan adres "Bu adresi kaydet" ile deftere giriyor, sonraki talepte yazmak gerekmiyor
E) Telefon ekranında taşma yok
Çalıştır: python web/build_web.py && python web/e2e_adres.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent / "dist" / "kapida.html"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

def ozete_git(pg, p):
    p.locator("[data-tile]").first.click()
    for _ in range(12):
        pg.wait_for_timeout(600)
        if p.locator("[data-act=options]").count(): return
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    raise AssertionError("özet ekranına gelinmedi")

durum = lambda pg: pg.evaluate("KapidaTest.durum()")

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 1280, "height": 1100})
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    p = pg.locator("#pScreen")

    print("A) Demo hasta: hazır adresler")
    pg.goto(D.as_uri() + "#hasta"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    cubuk = p.locator(".adres-cubuk")
    check(cubuk.count() == 1 and "Ev" in cubuk.inner_text() and "372" in cubuk.inner_text(), f"ana sayfada seçili adres: {cubuk.inner_text()!r}")
    cubuk.click()
    satirlar = p.locator(".adres-satir")
    check(satirlar.count() == 2 and "Annemin evi" in p.locator(".sheet").inner_text(), "seçim penceresinde iki kayıtlı adres")
    p.locator(".adres-satir", has_text="Annemin evi").locator("[data-adres-sec]").click()
    check(p.locator(".sheet").count() == 0 and "Annemin evi" in cubuk.inner_text(), "adres seçilince pencere kapandı, çubuk güncellendi")
    ozete_git(pg, p)
    check(p.locator("#pAdres").count() == 0 and p.locator(".adres-secili").count() == 1 and "Annemin evi" in p.locator(".adres-secili").inner_text(),
          "özet ekranında adres yazmak gerekmiyor; seçili kayıtlı adres gösteriliyor")
    check("1. kat" in p.locator(".adres-secili").inner_text(), "kapı tarifi (kat/daire) kayıtlı adresten geliyor")
    p.locator(".adres-secili [data-act=adresler]").click()
    p.locator(".adres-satir", has_text="Ev").first.locator("[data-adres-sec]").click()
    check("Ev" in p.locator(".adres-secili").inner_text() and "Bornova" in p.locator(".adres-secili").inner_text(), "özet ekranından adres değiştirildi (Ev, Bornova)")
    p.locator("[data-act=options]").click(); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click(); pg.wait_for_timeout(500)
    talep = pg.evaluate("(() => { const r = window.KapidaTest.durum(); return r; })()")
    hasta = pg.evaluate("(() => { const s = [...document.querySelectorAll('#pScreen')][0].innerText; return s; })()")
    req = pg.evaluate("window.KapidaTest.talep ? window.KapidaTest.talep() : null")
    check(req and "372" in req["adres"] and "3. kat" in req["tarif"] and req["district"] == "Bornova", f"talebe kayıtlı adres ve kapı tarifi gitti: {req}")

    print("B) Yeni adres, düzenleme, silme")
    p.locator("[data-act=home]").first.click() if p.locator("[data-act=home]").count() else None
    pg.goto(D.as_uri() + "#hasta"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    cubuk.click(); p.locator("[data-act=adresYeni]").click()
    check(p.locator("#fAdres").count() == 1, "yeni adres formu açıldı")
    p.locator("[data-abaslik='İş']").click()
    p.locator("#fAdres").fill("Kazımdirik"); p.locator("[data-act=adresKaydet]").click()
    check("listeden seç" in p.inner_text(), "listeden seçilmeyen adres kaydedilmiyor, uyarı var")
    p.locator("#fAdres").fill("Kazımdirik"); pg.wait_for_timeout(300); p.locator("#fAdresList .adres-oneri").first.click()
    p.locator("#fKat").fill("2"); p.locator("#fDaire").fill("4"); p.locator("#fTarif").fill("zil: Büro")
    p.locator("#fVarsayilan").check(); p.locator("[data-act=adresKaydet]").click()
    check("İş" in cubuk.inner_text(), f"yeni adres kaydedildi ve seçildi: {cubuk.inner_text()!r}")
    cubuk.click()
    check(p.locator(".adres-satir").count() == 3 and "Varsayılan" in p.locator(".adres-satir", has_text="İş").inner_text(), "listede 3 adres; yeni adres varsayılan")
    p.locator(".adres-satir", has_text="İş").locator("[data-adres-duzen]").click()
    p.locator("#fTarif").fill("zil: Büro 2"); p.locator("[data-act=adresKaydet]").click()
    cubuk.click()
    check("Büro 2" in p.locator(".adres-satir", has_text="İş").inner_text(), "adres düzenlendi")
    p.locator(".adres-satir", has_text="Annemin evi").locator("[data-adres-silsor]").click()
    check(p.locator("[data-adres-sil]").count() == 1 and p.locator(".adres-satir").count() == 3, "silmeden önce onay isteniyor")
    p.locator("[data-adres-sil]").click()
    check(p.locator(".adres-satir").count() == 2 and "Annemin evi" not in p.locator(".sheet").inner_text(), "onaylayınca adres silindi")
    p.locator(".sheet [data-act=adresKapat]").first.click()

    print("C) Yenileyince adresler duruyor")
    pg.reload(); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    check("İş" in cubuk.inner_text(), "seçili adres (İş) duruyor")
    cubuk.click()
    check(p.locator(".adres-satir").count() == 2, "kayıtlı iki adres duruyor")

    print("D) Hesapsız görünüm: yazılan adres kaydediliyor")
    ctx2 = br.new_context(viewport={"width": 1280, "height": 1100}); pg2 = ctx2.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    q = pg2.locator("#pScreen")
    pg2.goto(D.as_uri() + "?rol=ham"); pg2.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    check("Adres ekle" in q.locator(".adres-cubuk").inner_text(), "kayıtlı adres yokken çubukta 'Adres ekle'")
    ozete_git(pg2, q)
    check(q.locator("#pAdres").count() == 1 and q.locator("#pAdresKaydet").is_checked(), "ilk talepte adres yazılıyor; 'Bu adresi kaydet' işaretli")
    q.locator("#pTarif").fill("4. kat, daire 9")
    q.locator("#pAdres").fill("Kazımdirik"); pg2.wait_for_timeout(300); q.locator("#pAdresList .adres-oneri").first.click()
    q.locator("[data-act=options]").click(); pg2.wait_for_timeout(400)
    q.locator("[data-act=home]").first.click() if q.locator("[data-act=home]").count() else pg2.evaluate("void 0")
    pg2.goto(D.as_uri() + "?rol=ham"); pg2.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    check("Ev" in q.locator(".adres-cubuk").inner_text(), f"adres 'Ev' olarak kaydedildi: {q.locator('.adres-cubuk').inner_text()!r}")
    ozete_git(pg2, q)
    check(q.locator("#pAdres").count() == 0 and "4. kat" in q.locator(".adres-secili").inner_text(), "ikinci talepte adres yazmak gerekmiyor, tarif de geldi")
    ctx2.close()

    print("E) Telefon ekranı")
    ctx3 = br.new_context(viewport={"width": 390, "height": 844}); pg3 = ctx3.new_page()
    pg3.goto(D.as_uri() + "#hasta"); pg3.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    pg3.locator("#pScreen .adres-cubuk").click()
    tasma = pg3.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check(not tasma, "telefonda yatay taşma yok (adres penceresi açıkken)")
    pg3.screenshot(path=str(Path(__file__).resolve().parent / "dist" / "adresler_telefon.png"))
    ctx3.close()

    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"Tamam: {ok} kontrol geçti.")
