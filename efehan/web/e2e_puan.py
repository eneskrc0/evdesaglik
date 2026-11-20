"""Ziyaret sonrası puanlama provası: hasta ziyareti onaylar → yıldız + etiket + yorum → çalışan ekranında değerlendirme, ortalama güncellenir.
A) İki telefon (ham görünüm): kapı kodu → check-in → çıkış → 'Evet, tamamlandı' → 5 yıldız
B) Düşük puan: kalite ekibi notu, çalışanda 'inceleniyor'
C) Yalnız hasta telefonu (#hasta): çalışan ekranı yokken ziyaret demo olarak ilerler, puanlama açılır; telefonda taşma yok
Çalıştır: python web/e2e_puan.py"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent / "dist" / "kapida.html"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

def talep_ve_kabul(pg, p, h, iki=True):
    p.locator("[data-tile]").first.click()
    for _ in range(10):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click()
    if not iki: return
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
    h.get_by_role("button", name="Panele git").click()
    if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click()

def kapiya_kadar(pg, p):
    pg.wait_for_selector("#pScreen [data-gz=h-kod-ok]", timeout=90000)
    p.locator("[data-gz=h-kod-ok]").click()

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    print("A) İki telefon: ziyaret → tamamlandı → 5 yıldız")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(D.as_uri() + "?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    talep_ve_kabul(pg, p, h)
    pid = pg.evaluate("(() => { const t = document.querySelector('#pScreen .card.row b'); return t ? t.innerText : ''; })()")
    kapiya_kadar(pg, p)
    check(p.locator(".puan").count() == 0, "ziyaret bitmeden puanlama görünmüyor")
    h.locator("[data-gz=checkin]").click(); pg.wait_for_timeout(500)
    h.locator("[data-gz=cikis]").click(); h.locator("[data-gz=cikis-sec][data-v=yok]").click(); pg.wait_for_timeout(400)
    check(p.locator(".puan").count() == 0, "çıkıştan sonra da hasta onaylamadan puanlama yok")
    p.locator("[data-gz=h-tamam]").click(); pg.wait_for_timeout(300)
    check(p.locator(".puan").count() == 1 and "ziyaretini puanla" in p.locator(".puan").inner_text(), "'Evet, tamamlandı' deyince puanlama kartı açıldı")
    check(p.locator("[data-act=puanGonder]").is_disabled(), "yıldız seçmeden gönderilemiyor")
    yildiz = p.locator(".puan-btn")
    check(yildiz.count() == 5 and all((yildiz.nth(i).get_attribute("aria-label") or "").endswith(ad) for i, ad in enumerate(["Çok kötü", "Kötü", "Orta", "İyi", "Çok iyi"])), "5 yıldız düğmesi, ekran okuyucu için adlı (aria-label)")
    kutu = yildiz.first.bounding_box()
    check(kutu["width"] >= 48 and kutu["height"] >= 48, f"yıldız düğmeleri dokunmaya uygun büyüklükte ({kutu['width']:.0f}px)")
    onceki = pg.evaluate("(() => { const pv = Object.values(window.EVDE_DATA ? {} : {}); return null; })()")
    yildiz.nth(4).click()
    check("Çok iyi" in p.locator(".puan").inner_text() and p.locator("[data-puan-etiket]").count() == 5, "5 yıldızda olumlu etiketler çıktı")
    p.locator("[data-puan-etiket='Nazik ve saygılı']").click(); p.locator("[data-puan-etiket='Zamanında geldi']").click()
    check(p.locator("[data-puan-etiket='Nazik ve saygılı']").get_attribute("aria-pressed") == "true", "etiket seçildi")
    p.locator("#puanYorum").fill("Çok ilgiliydi, teşekkürler")
    pg.wait_for_timeout(1500)  # arka plandaki yeniden çizimler yorumu silmemeli
    check(p.locator("#puanYorum").input_value() == "Çok ilgiliydi, teşekkürler", "yazılan yorum yeniden çizimde kaybolmadı")
    p.locator(".puan").scroll_into_view_if_needed(); p.locator(".puan").screenshot(path=str(D.parent / "puan_hasta.png"))
    p.locator("[data-act=puanGonder]").click(); pg.wait_for_timeout(300)
    t = p.locator(".puan").inner_text()
    check("Teşekkürler" in t and "★★★★★" in t and "Nazik ve saygılı" in t, "gönderince teşekkür ve verilen puan görünüyor")
    check("yeni ortalaması" in t, "yeni ortalama gösterildi")
    h.locator("[data-tab=rota]").click() if h.locator("[data-tab=rota]").count() else None
    ht = h.inner_text()
    check("Hasta değerlendirmeleri" in ht and "★★★★★" in ht and "Çok ilgiliydi" in ht, "çalışanın Rotam sekmesinde değerlendirme ve yorum görünüyor")
    check("Ayşe" not in h.locator(".puan-calisan").inner_text(), "çalışana hastanın adı gösterilmiyor")
    check("★" in h.locator(".h-head").inner_text(), "çalışan başlığında puanı yazıyor")
    h.locator(".puan-calisan").screenshot(path=str(D.parent / "puan_calisan.png"))
    p.locator("[data-act=home]").first.click(); pg.wait_for_timeout(200)
    check(not errs, f"sayfa hatası yok {errs}")
    pg.close()

    print("B) Düşük puan")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(D.as_uri() + "?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    talep_ve_kabul(pg, p, h); kapiya_kadar(pg, p)
    h.locator("[data-gz=checkin]").click(); pg.wait_for_timeout(300)
    p.locator("[data-act=home]").first.click()  # hasta ziyaret biterken ana sayfada
    h.locator("[data-gz=cikis]").click(); h.locator("[data-gz=cikis-sec][data-v=yok]").click(); pg.wait_for_timeout(300)
    check("ziyareti bitirdi" in p.inner_text() and p.get_by_role("button", name="Onayla ve puanla").count() == 1, "hasta ana sayfadayken ziyaret bitince en üstte 'Onayla ve puanla' kartı")
    p.get_by_role("button", name="Onayla ve puanla").click()
    p.locator("[data-gz=h-tamam]").click()
    p.locator(".puan-btn").nth(4).click(); p.locator("[data-puan-etiket='Güven verdi']").click()
    p.locator(".puan-btn").nth(1).click()
    check(p.locator("[data-puan-etiket='Geç kaldı']").count() == 1 and p.locator("[data-puan-etiket][aria-pressed=true]").count() == 0, "2 yıldıza inince olumsuz etiketler çıktı, önceki seçim temizlendi")
    p.locator("[data-puan-etiket='Geç kaldı']").click(); p.locator("[data-act=puanGonder]").click()
    check("kalite ekibi" in p.locator(".puan").inner_text(), "düşük puanda kalite ekibi incelemesi söylendi")
    check("inceliyor" in h.inner_text(), "çalışan ekranında 'kalite ekibi inceliyor' notu")
    p.locator("[data-act=home]").first.click()
    check("ziyaretini puanla" not in p.inner_text() and "★★" in p.locator(".randevularim").inner_text(), "puan verilince ana sayfadaki davet kalktı, Randevularım'da verilen puan yazıyor")
    check(not errs, f"sayfa hatası yok {errs}")
    pg.close()

    print("C) Yalnız hasta telefonu (#hasta), telefon ekranı")
    pg = br.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(D.as_uri() + "#hasta"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    talep_ve_kabul(pg, p, h, iki=False)
    kapiya_kadar(pg, p)
    pg.wait_for_selector("#pScreen [data-gz=h-tamam]", timeout=30000)
    check(True, "çalışan ekranı yokken ziyaret demo olarak başladı ve bitti")
    p.locator("[data-gz=h-tamam]").click()
    p.locator(".puan-btn").nth(3).click(); p.locator("[data-act=puanGonder]").click()
    check("★★★★☆" in p.locator(".puan").inner_text(), "tek telefonda da puan verildi")
    tas = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check(tas <= 1, f"telefonda taşma yok ({tas}px)")
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
