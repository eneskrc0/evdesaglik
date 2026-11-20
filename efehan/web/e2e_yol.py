"""Çalışanın yol tarifi provası: neyle, nasıl, ne kadar sürede; canlı konum; adres, kapı tarifi, harita uygulamaları; hastaya 'yoldayım'.
A) Arabalı çalışan  B) Toplu taşımalı çalışan (ESHOT/İZBAN/metro adımları)  C) Yalnız çalışan telefonu (#calisan), örnek ziyaret, telefon ekranı
Çalıştır: python web/e2e_yol.py"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent / "dist" / "kapida.html"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

def talep(pg, p, h, toplu):
    p.locator("[data-tile]").first.click()
    for _ in range(10):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    p.locator("#pTarif").fill("3. kat, daire 7, zil: Demir")
    p.locator("#pAdres").fill("Kazımdirik"); pg.wait_for_timeout(400); p.locator(".adres-oneri").first.click()
    p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    idx = pg.evaluate("""(isaret) => { const b = [...document.querySelectorAll('#pScreen details.klasik [data-pick]')];
        for (let i = 0; i < b.length; i++) { let e = b[i]; for (let k = 0; k < 6 && e; k++) { if (e.innerText && /🚌|🚗/.test(e.innerText)) break; e = e.parentElement; }
          if ((e ? e.innerText : '').includes(isaret)) return i; } return -1; }""", "🚌" if toplu else "🚗")
    assert idx >= 0, "uygun ulaşım türünde aday yok"
    p.locator("details.klasik [data-pick]").nth(idx).click(); p.locator("[data-act=confirm]").click()
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
    h.get_by_role("button", name="Panele git").click()
    if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click(); pg.wait_for_timeout(800)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for toplu, ad in [(False, "A) Arabalı çalışan"), (True, "B) Toplu taşımalı çalışan")]:
        print(ad)
        pg = br.new_page(viewport={"width": 1280, "height": 1100}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(D.as_uri() + "?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
        p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
        talep(pg, p, h, toplu)
        y = h.locator("#hYol"); t = y.inner_text()
        check(y.count() == 1 and "YOL TARİFİ" in t, "çalışanın Rotam sekmesinde yol tarifi kartı")
        check(("Toplu taşımayla" if toplu else "Araçla") in t and "yola çıkış" in t and "varış" in t and " dk" in t, "neyle gideceği, yola çıkış, varış ve süre yazıyor")
        check(y.locator("svg.harita").count() == 1 and y.locator(".hr-hareketli").count() == 1 and y.locator(".hr-hasta").count() == 1, "haritada rota, çalışanın konumu ve hasta")
        if toplu:
            check(any(k in t for k in ("ESHOT", "İZBAN", "Metro", "Tramvay", "Vapur")) and "bin:" in t and "in:" in t and "durak" in t and "yürü" in t, "toplu taşıma adım adım: yürü → hat, biniş/iniş durağı, durak sayısı")
            check(y.locator(".hr-durak").count() >= 1, "binilecek duraklar haritada işaretli")
        else:
            check("km sür" in t and "Park et" in t, "araçla: km, trafikli süre, park")
        a = h.locator(".yt-adres"); at = a.inner_text()
        check("Kazımdirik" in at and "3. kat, daire 7" in at, "adres ve hastanın yazdığı kapı tarifi çalışanda")
        g = a.get_by_role("link", name="Google Haritalar'da aç").get_attribute("href")
        check("google.com/maps/dir" in g and ("travelmode=transit" if toplu else "travelmode=driving") in g and "destination=38." in g, "Google Haritalar bağlantısı hedef konum ve doğru ulaşım türüyle")
        check(a.get_by_role("link", name="Apple Haritalar").count() == 1 and a.get_by_role("link", name="Yandex").count() == 1, "Apple ve Yandex Haritalar bağlantıları")
        k1 = y.locator(".when").inner_text(); t1 = y.inner_text(); time.sleep(5); t2 = y.inner_text()
        check(t1 != t2, f"yolculuk canlı ilerliyor ({k1} → {y.locator('.when').inner_text() if y.locator('.when').count() else '-'})")
        check(y.locator(".yt-adimlar li.simdi").count() == 1, "o anki adım 'şimdi' diye işaretli (tek adım)")
        h.get_by_role("button", name="“Yoldayım” mesajı gönder").click(); pg.wait_for_timeout(300)
        check(p.locator(".calisan-mesaj").count() == 1 and "Yoldayım" in p.locator(".calisan-mesaj").inner_text(), "'Yoldayım' mesajı hastanın takibinde")
        pt = p.locator("#takip").inner_text()
        check("Neyle geliyor:" in pt and ("toplu taşımayla" if toplu else "kendi aracıyla") in pt and "tahmini" in pt, "hasta yalnızca neyle geleceğini ve tahmini varışı görüyor")
        check("bin:" not in pt, "ayrıntılı adımlar hastaya gösterilmiyor (çalışanda)")
        pg.wait_for_selector("#pScreen [data-gz=h-kod-ok]", timeout=120000)
        pg.wait_for_function("(document.querySelector('#hYol') || {}).innerText.includes('Vardın')", timeout=5000)
        check("Vardın" in y.inner_text(), "varınca çalışana 'Vardın: kapı kodunu söyle'")
        p.locator("[data-gz=h-kod-ok]").click(); h.locator("[data-gz=checkin]").click(); pg.wait_for_timeout(400)
        check(h.locator("#hYol").count() == 0, "check-in sonrası yol tarifi kapandı, ziyaret kartı kaldı")
        check(not errs, f"sayfa hatası yok {errs}")
        pg.locator("#colH").screenshot(path=str(D.parent / ("yol_toplu.png" if toplu else "yol_araba.png"))) if False else None
        pg.close()

    print("C) Yalnız çalışan telefonu (#calisan), örnek ziyaret, telefon ekranı")
    pg = br.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(D.as_uri() + "#calisan"); pg.wait_for_timeout(1500); h = pg.locator("#hScreen")
    h.locator("[data-open]").first.click(); h.locator("[data-act=haccept]").click(); pg.wait_for_timeout(500)
    if h.locator("[data-tab=rota]").count(): h.locator("[data-tab=rota]").click()
    y = h.locator("#hYol")
    check(y.count() == 1 and "YOL TARİFİ" in y.inner_text(), "kabul edilen örnek ziyaret için de yol tarifi")
    t1 = y.inner_text(); time.sleep(4)
    check(t1 != y.inner_text(), "örnek ziyarette de canlı ilerliyor")
    check(pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1, "telefonda taşma yok")
    y.screenshot(path=str(D.parent / "yol_tarifi.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
