"""Randevu tutarlılığı provası (GPT testinde bulunan hatalar):
- olumsuz cümle acil ekranı açmamalı; acil ifadeler yakalanmalı
- randevudan sonra ana ekranda 'Yaklaşan randevun — Takip et' ve 'Randevularım'
- alınan saat aynı çalışan için bir daha önerilmemeli
- iptal, çalışanın rotası ve kazancından da silinmeli
- 'Saatlerim' değişikliği sekme değişince kaybolmamalı ve eşleştirmeye yansımalı
Çalıştır: python web/e2e_randevu.py"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri() + "?rol=ham"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")

    def yukle():
        pg.goto(PAGE); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)

    def sohbet(ilk):
        p.locator("[data-act=start]").click()
        p.locator("#pInput").fill(ilk); p.locator("#pInput").press("Enter")
        for _ in range(10):
            pg.wait_for_timeout(500)
            if p.locator("[data-act=options]").count() or "acil" in p.inner_text().lower(): break
            if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()

    def ana():
        for _ in range(5):
            if p.locator("[data-act=start]").count(): return
            b = p.locator("[data-act=home], [data-act=chat], [data-act=summary]").first
            b.click(); pg.wait_for_timeout(200)

    def secenekler():
        return pg.eval_on_selector_all("#pScreen .opt", "els => els.map(e => [e.querySelector('b').textContent, (e.querySelector('.when')||{}).textContent || ''])")

    # 1) Olumsuz cümle acil değil; acil ifade yakalanıyor (arayüzde, demo modunda)
    yukle(); p.locator("[data-act=start]").click()
    p.locator("#pInput").fill("Göğüs ağrım yok, annemin topuğunda yara var"); p.locator("#pInput").press("Enter"); pg.wait_for_timeout(700)
    check("112'yi ara" not in p.inner_text() and p.locator("#pInput").count() == 1, "'Göğüs ağrım yok…' acil ekranı açmadı, sohbet sürüyor")
    p.locator("#pInput").fill("Hava yetmiyor, soluk alamıyor"); p.locator("#pInput").press("Enter"); pg.wait_for_timeout(500)
    check("112" in p.inner_text() and p.locator("#pInput").count() == 0, "'Hava yetmiyor, soluk alamıyor' acil ekranına yönlendi")

    # 2) Randevu → ana ekranda takip kartı → geri dönüş
    yukle(); sohbet("Annemin sırtında yara var pansuman lazım")
    p.locator(".saatler").nth(0).locator(".saat").first.click()
    p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    ilk = secenekler()[0]
    p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click()
    check(p.locator("#takip, .steps, [data-act=cancel]").count() >= 1, f"randevu oluştu ({ilk[0]}, {ilk[1]})")
    ana()
    t = p.inner_text()
    check("Yaklaşan randevun" in t and p.get_by_role("button", name=re.compile("^Takip et")).count() == 1, "ana ekranda 'Yaklaşan randevun' kartı ve 'Takip et'")
    p.get_by_role("button", name=re.compile("^Takip et")).click()
    check(p.locator("[data-act=cancel]").count() == 1 or "Talep gönderildi" in p.inner_text(), "'Takip et' randevu ekranına geri getirdi")

    # 3) Aynı saat aynı çalışana bir daha önerilmiyor
    ana(); sohbet("Annemin sırtında yara var pansuman lazım")
    p.locator(".saatler").nth(0).locator(".saat").first.click()
    p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    ikinci = secenekler()
    ayni = [x for x in ikinci if x[0] == ilk[0] and x[1] == ilk[1]]
    check(not ayni, f"{ilk[0]} {ilk[1]} bir daha önerilmedi (çalışanın yeni önerisi: {[x[1] for x in ikinci if x[0] == ilk[0]] or 'listede yok'})")
    ana()
    check("Randevularım" in p.inner_text(), "'Randevularım' listesi var")

    # 4) İptal: çalışanın rotası ve kazancı da güncellenir (onaylı randevu)
    yukle(); sohbet("Annemin sırtında yara var pansuman lazım")
    p.locator(".saatler").nth(0).locator(".saat").first.click()
    p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    sec = secenekler()[0]; p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click()
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click(); h.get_by_role("button", name="Panele git").click()
    if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click()
    h.locator("[data-tab=rota]").click()
    once = h.inner_text()
    kazanc = lambda t: int(re.sub(r"\D", "", re.search(r"([\d.]+) TL\s*bugünkü kazanç", t).group(1)))
    k1 = kazanc(once)
    check(sec[1].split(" ")[0] in once, f"kabul edilen ziyaret ({sec[1]}) çalışanın rotasında, kazanç {k1} TL")
    p.locator("[data-act=cancel]").click()
    h.locator("[data-tab=talepler]").click(); h.locator("[data-tab=rota]").click()
    sonra = h.inner_text(); k2 = kazanc(sonra)
    check(k2 < k1, f"iptal sonrası çalışanın kazancı düştü ({k1} → {k2} TL)")
    ana()
    check("İptal edildi" in p.inner_text(), "hastanın Randevularım listesinde 'İptal edildi'")

    # 5) Saatlerim: sekme değişince kalıcı ve eşleştirmeye yansıyor
    h.locator("[data-tab=saat]").click()
    pzt = h.locator("select[data-saat-gun='0'][data-uc='bas']")
    pzt.select_option(str(12 * 60))
    h.locator("[data-tab=rota]").click(); h.locator("[data-tab=saat]").click()
    check(h.locator("select[data-saat-gun='0'][data-uc='bas']").input_value() == str(12 * 60), "Pazartesi başlangıcı 12.00 sekme değişince korunuyor")
    h.locator("select[data-saat-gun='0'][data-uc='bit']").select_option(str(11 * 60))
    check("Bitiş saati başlangıçtan sonra olmalı" in h.inner_text(), "bitiş < başlangıç reddediliyor")
    # Saatlerim eşleştirmeye yansıyor: aynı çalışan bugün 12.00'den önce önerilmez
    ana(); sohbet("Annemin sırtında yara var pansuman lazım")
    p.locator(".saatler").nth(0).locator(".saat").first.click(); p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    saatler = [x[1] for x in secenekler() if x[0] == sec[0]]
    erken = [x for x in saatler if int(x[:2]) < 12]
    check(not erken, f"{sec[0]} artık 12.00'den önce önerilmiyor ({saatler or 'bu saatte listede yok'})")
    # 6) Çalışan detayı: sıra, kırmızı bayrak ifadesi, ek bilgi isteği hastaya ulaşıyor
    yukle(); sohbet("Annemin sırtında yara var pansuman lazım")
    p.locator(".saatler").nth(0).locator(".saat").first.click(); p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click()
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click(); h.get_by_role("button", name="Panele git").click()
    if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
    basliklar = h.locator("h3").all_inner_texts()
    sira = [next((i for i, b in enumerate(basliklar) if b.startswith(k)), -1) for k in ["1 ·", "2 ·", "3 ·", "4 ·"]]
    check(all(x >= 0 for x in sira) and sira == sorted(sira), f"çalışan detayı sırası: beyan → eksik bilgi → YZ özeti → ziyaret ({basliklar[:6]})")
    t = h.inner_text()
    check("temiz" not in t and "otomatik taramada işaretlenmedi" in t and "değerlendirme gerekli" in t, "'Kırmızı bayrak: temiz' yerine sınırını anlatan ifade")
    check("Dayandığı ifade" in t or "Kendi sözleriyle" in t, "YZ özeti hasta ifadesiyle birlikte")
    h.get_by_role("button", name="Ek bilgi iste").click(); h.get_by_role("button", name="Yaranın fotoğrafı").click()
    check("senden ek bilgi istiyor" in p.inner_text() and "Yaranın fotoğrafı" in p.inner_text(), "çalışanın 'Ek bilgi iste' isteği hastanın randevu ekranında")
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"Tamam: {ok} kontrol geçti.")
