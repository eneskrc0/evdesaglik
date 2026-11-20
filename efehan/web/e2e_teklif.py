"""YZ teklif akışı provası: Enes'in modeli 3 kişi seçer, fiyat önerir, teklif gelir, hasta kabul eder → canlı takip.
Çalıştır: python web/e2e_teklif.py"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri()
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(PAGE); p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
    m = pg.evaluate("""() => { const M = window.KAPIDA_MODEL, T = window.KapidaTeklif.create(M);
      return { ad: M.ad, n: M.w.length, ort: T.olasilik(M.mu), sig: 1 / (1 + Math.exp(-M.b)) }; }""")
    check(m["ad"] == "v5_demo_lr" and m["n"] == 12, "Enes'in kayıtlı modeli yüklü (v5_demo_lr, 12 özellik)")
    check(abs(m["ort"] - m["sig"]) < 1e-12, "olasılık formülü modeldeki tanımla aynı (ortalama girdide p = sigmoid(b))")
    p.locator("[data-tile]").first.click()
    for _ in range(8):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    teklif = None
    for k in range(3):
        if p.locator("[data-act=summary]").count(): p.locator("[data-act=summary]").first.click()
        saat = p.locator(".saat").nth(k); when = saat.locator("b").inner_text()
        if k == 0: check(p.locator(".saat").count() >= 3 and "en erken" in saat.inner_text(), f"'Ne zaman' bugünün uygun saatlerini gösteriyor ({p.locator('.saatler').inner_text().count(':')} saat)")
        saat.click()
        p.locator("[data-act=options]").click()
        t = p.locator(".yz-teklif").inner_text()
        check("kişiye gönderdi" in t and "Önerilen fiyat" in t and "teklif olasılığı" in t, f"[{when}] YZ 3 kişi seçti, fiyat önerdi, olasılıkları gösterdi")
        for _ in range(30):
            pg.wait_for_timeout(500)
            if p.locator(".yz-teklif [data-pick]").count(): teklif = p.locator(".yz-teklif [data-pick]").first; break
            if "Şu an teklif gelmedi" in p.inner_text(): break
        if teklif: break
        check(p.locator("details.klasik[open]").count() == 1, f"[{when}] teklif gelmeyince klasik liste açılıyor")
    check(teklif is not None, "en az bir saatte teklif geldi")
    fiyat = teklif.inner_text().split("toplam ")[1]
    teklif.click(); p.locator("[data-act=confirm]").click()
    t = p.inner_text()
    check("Randevun kesinleşti" in t and p.locator("#takip").count() == 1, "teklifi kabul edince randevu kesinleşti, canlı takip başladı")
    check(fiyat.split(" TL")[0] in t, "kabul edilen teklif fiyatı randevuda")
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click(); h.get_by_role("button", name="Panele git").click()
    check(h.get_by_role("tab", name="Rotam").get_attribute("aria-selected") == "true" and "yeni kabul" in h.inner_text(), "ziyaret çalışanın rotasına girdi")
    pg.locator("#colP").screenshot(path=str(Path(__file__).resolve().parent / "dist" / "teklif_kabul.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
