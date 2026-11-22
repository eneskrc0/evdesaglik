"""Kabul testleri (22.11, dış inceleme bulguları): her biri düzeltilen bir hatayı yakalar.
A) Sıradaki ziyaret: bekleyen / reddedilen / iptal edilen talep çalışanın 'sıradaki ziyareti' olmaz, 'Randevu kesinleşti' gitmez; kabul edilen olur.
B) Teklif kabulünde son müsaitlik kontrolü: teklif ekranda beklerken aynı saat başkasına verilirse eski teklif kesinleşmez.
C) Çalışan reddedince / iptal edince hastaya tek dokunuşla alternatif (en erken saat + toplam ücret, onaylayınca yeni randevu).
D) Klasik yöntem ile v5 karşılaştırması (aynı talep, iki yöntemin seçtiği kişiler, ilk teklif süresi, bildirim sayısı).
E) Bildirim yükü: teklif isteği alan çalışanların sayacı artar ve modele gerçek sayı gider; yarınki talepte çalışan durumu yarına göre.
Çalıştır: python web/build_web.py && python web/e2e_kabul.py"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri() + "?rol=ham"
ok = 0


def check(c, m):
    global ok
    if not c:
        print("HATA:", m); sys.exit(1)
    ok += 1; print("  ✓", m)


def ac(pg):
    pg.goto(PAGE); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
    return pg.locator("#pScreen"), pg.locator("#hScreen")


def onayla_calisan(pg, h):
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
    h.get_by_role("button", name="Panele git").click()


def secenekler(pg, p):
    p.locator("[data-tile]").first.click()
    for _ in range(10):
        pg.wait_for_timeout(600)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    p.locator("[data-act=options]").click(); pg.wait_for_timeout(300)


with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    print("A) Sıradaki ziyaret yalnızca kabul edilmiş ve bitmemiş randevu")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg)
    onayla_calisan(pg, h)
    bild = lambda: pg.evaluate("JSON.stringify(KapidaBildirim.liste('h'))")
    pg.wait_for_timeout(1300); n0 = bild().count("Randevu kesinleşti")
    k = pg.evaluate("KapidaTest.randevuKur('tele_hemsire_destekli')")
    pg.wait_for_timeout(1300)
    check(pg.evaluate(f"KapidaTest.talepDurum('{k['id']}')") == "bekliyor", "talep onay bekliyor")
    check(pg.evaluate(f"KapidaTest.siradaki('{k['pid']}')") != k["id"], "BEKLİYOR: sıradaki ziyaret değil")
    check(bild().count("Randevu kesinleşti") == n0, "bekleyen talep için çalışana 'Randevu kesinleşti' gitmedi")
    p.locator("[data-act=cancel]").click(); pg.wait_for_timeout(1300)
    check(pg.evaluate(f"KapidaTest.talepDurum('{k['id']}')") == "iptal" and pg.evaluate(f"KapidaTest.siradaki('{k['pid']}')") != k["id"], "İPTAL: sıradaki ziyaret değil")
    check(k["id"] not in str(pg.evaluate(f"KapidaTest.rota('{k['pid']}')")), "iptal edilen ziyaret çalışanın rotasında yok")
    k2 = pg.evaluate("KapidaTest.randevuKur('tele_hemsire_destekli')")
    if h.locator("[data-act=hreject]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=hreject]").click(); pg.wait_for_timeout(1300)
    check(pg.evaluate(f"KapidaTest.talepDurum('{k2['id']}')") == "red" and pg.evaluate(f"KapidaTest.siradaki('{k2['pid']}')") != k2["id"], "RED: sıradaki ziyaret değil")
    k3 = pg.evaluate("KapidaTest.randevuKur('tele_hemsire_destekli')")
    if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click(); pg.wait_for_timeout(1300)
    check(pg.evaluate(f"KapidaTest.siradaki('{k3['pid']}')") == k3["id"], "KABUL: sıradaki ziyaret bu randevu")
    check(bild().count("Randevu kesinleşti") == n0 + 1, "kabulden sonra çalışana 'Randevu kesinleşti' (bir kez)")
    check(not errs, f"sayfa hatası yok {errs}")

    print("B) Teklif kabulünde son müsaitlik kontrolü")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg)
    secenekler(pg, p)
    teklif = None
    for _ in range(3):
        for _ in range(30):
            pg.wait_for_timeout(500)
            if p.locator(".yz-teklif [data-pick]").count(): teklif = p.locator(".yz-teklif [data-pick]").first; break
            if "Şu an teklif gelmedi" in p.inner_text(): break
        if teklif: break
        p.locator("[data-act=summary]").first.click(); p.locator(".saatler .saat").nth(1).click(); p.locator("[data-act=options]").click()
    check(teklif is not None, "teklif geldi")
    i = int(teklif.get_attribute("data-pick"))
    a = pg.evaluate(f"KapidaTest.aday({i})")
    pg.evaluate(f"KapidaTest.saatiDoldur('{a['pid']}', {a['varis']}, 90, {1 if a['gun'] else 0})")  # bu arada başka biri o saati aldı
    teklif.click(); p.locator("[data-act=confirm]").click(); pg.wait_for_timeout(300)
    t = p.inner_text()
    check("Randevun kesinleşti" not in t and "artık müsait değil" in t, "dolan saatteki teklif kesinleşmedi, hasta bilgilendirildi")
    check(pg.evaluate("KapidaTest.durum().ekran") == "options", "hasta seçenekler ekranında kaldı")
    check(not errs, f"sayfa hatası yok {errs}")

    print("C) Reddedince / iptal edince tek dokunuşla alternatif")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg); onayla_calisan(pg, h)
    k = pg.evaluate("KapidaTest.randevuKur('tele_hemsire_destekli')")
    if h.locator("[data-act=hreject]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=hreject]").click(); pg.wait_for_timeout(1300)
    t = p.inner_text()
    check(p.locator("#altKart").count() == 1 and "en erken alternatif" in t and "TL" in p.locator("#altKart").inner_text(), "reddedilince hastaya en erken alternatif (saat + toplam ücret)")
    check("Tek dokunuşla" in pg.evaluate("JSON.stringify(KapidaBildirim.metinler('p'))"), "hastaya alternatifli bildirim (saat ve ücretle)")
    alt_kisi = p.locator("#altKart b").nth(1).inner_text()
    check(alt_kisi and k["pid"] not in alt_kisi, "alternatif reddeden çalışan değil")
    p.locator("[data-act=alternatifOnay]").click(); pg.wait_for_timeout(500)
    d = pg.evaluate("KapidaTest.durum().ekran"); yeni = pg.evaluate("KapidaTest.talep()")
    check(d == "done" and "Talebin gönderildi" in p.inner_text() and alt_kisi in p.inner_text(), "tek dokunuşla yeni talep gönderildi (bilgiler yeniden girilmedi)")
    check(yeni and yeni.get("district"), "adres ve ilçe aynen taşındı")
    # çalışan kabul ettiği ziyareti iptal ederse
    h.locator("[data-act=haccept]").click() if h.locator("[data-act=haccept]").count() else (h.locator("[data-open]").first.click(), h.locator("[data-act=haccept]").click())
    pg.wait_for_timeout(800)
    iptal_id = pg.evaluate("KapidaTest.sonTalep()")
    check(pg.evaluate("KapidaTest.siradaki()") == iptal_id, "kabul edilen alternatif çalışanın sıradaki ziyareti")
    h.locator("[data-act=hIptalSor]").click(); h.locator("[data-act=hIptalEvet]").click(); pg.wait_for_timeout(1300)
    t = p.inner_text()
    check("gelemiyor" in t and "İptal edildi" in t and p.locator("#altKart").count() == 1, "çalışan iptal edince hasta 'gelemiyor' ve alternatifi görüyor")
    check(pg.evaluate("KapidaTest.siradaki()") != iptal_id and pg.evaluate(f"KapidaTest.talepDurum('{iptal_id}')") == "red", "çalışanın iptal ettiği ziyaret artık sıradaki değil")
    check(not errs, f"sayfa hatası yok {errs}")

    print("D) Klasik yöntem ile v5 karşılaştırması")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg); secenekler(pg, p)
    kk = p.locator("#karsilastir")
    check(kk.count() == 1 and "Yapay zekâ neyi iyileştiriyor?" in kk.inner_text(), "seçenekler ekranında karşılaştırma bölümü")
    pg.evaluate("document.querySelector('#karsilastir').open = true"); pg.wait_for_timeout(200)
    t = kk.inner_text(); km = pg.evaluate("KapidaTest.karsilastirma()")
    check("Klasik yöntem" in t and "Yapay zekâ (v5)" in t and "İlk uygun teklif" in t and "Bildirim giden" in t, "iki sütun: kişiler, ilk teklif süresi, bildirim sayısı")
    check("%52,2" in t and "%68,7" in t and "16,5 yüzde puanı" in t, "toplu sonuç: klasik %52,2, v5 %68,7, fark 16,5 puan")
    check(len(km["klasik"]["kisiler"]) == 3 and len(km["v5"]["kisiler"]) == 3, "her yöntem 3 kişi seçti")
    check(km["klasik"]["bildirim"] in (3, 6) and km["v5"]["bildirim"] in (3, 6), "bildirim sayısı 3 ya da 6 (ikinci tur)")
    pg.wait_for_timeout(1200)
    check(p.locator("#karsilastir[open]").count() == 1, "arka plan yenilemesinde bölüm açık kalıyor")
    pg.locator("#colP").screenshot(path=str(Path(__file__).resolve().parent / "dist" / "karsilastirma.png"))
    check(not errs, f"sayfa hatası yok {errs}")

    print("E) Bildirim yükü ve yarınki talepte çalışan durumu")
    yuk = pg.evaluate("KapidaTest.bildirimYuku()")
    plan = pg.evaluate("KapidaTest.teklifPlani()")
    check(sum(yuk.values()) >= 3 and all(yuk.get(a["pid"], 0) >= 1 for a in plan["secilen"]), "teklif isteği giden çalışanların bildirim sayacı arttı")
    p.locator("[data-act=summary]").first.click(); p.locator(".saatler .saat").nth(2).click(); p.locator("[data-act=options]").click(); pg.wait_for_timeout(300)
    plan2 = pg.evaluate("KapidaTest.teklifPlani()")
    tekrar = [a for a in plan2["secilen"] if yuk.get(a["pid"], 0) >= 1]
    check(all(a["bildirim"] >= 1 for a in tekrar), "aynı gün yeniden önerilen çalışanın modele giden bildirim sayısı 0 değil")
    # yarın: bugün ziyarette olan çalışan yarın için 'ziyarette' sayılmaz
    farkli = pg.evaluate("""(() => { const C = window.EVDE_DATA; let n = 0, m = 0; for (const p of C.providers.slice(0, 80)) { const b = KapidaTest.calisanDurumu(p.id, 0), y = KapidaTest.calisanDurumu(p.id, 1); if (b.ziyaretBugun !== y.ziyaretBugun || b.ziyarette !== y.ziyarette) n++; m++; } return [n, m]; })()""")
    check(farkli[0] > 0, f"yarınki durum bugünden ayrı hesaplanıyor ({farkli[0]}/{farkli[1]} çalışanda farklı)")
    p.locator("[data-act=summary]").first.click(); pg.evaluate("document.querySelectorAll('.saatler')[1].querySelector('.saat').click()"); p.locator("[data-act=options]").click(); pg.wait_for_timeout(300)
    check(pg.evaluate("KapidaTest.teklifPlani().tarih") == "2026-11-17", "yarınki talepte teklif planı yarının tarihiyle")
    check(not errs, f"sayfa hatası yok {errs}")

    print("F) İki cihaz: takvim senkronu ve iletim durumu")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg)
    aday = pg.evaluate("KapidaTest.adaylar('tele_hemsire_destekli', 600)[0]")
    uzak = {"id": "UZAK-1", "status": "kabul", "provider_id": aday["pid"], "service": "tele_hemsire_destekli", "arrival_min": aday["varis"], "date": "2026-11-16", "gun": 0,
            "patient": {"lat": 38.46, "lon": 27.22, "district": "Bornova", "plan": "yok"}, "price": {"provider_gets": 1000, "patient_pays": 4000}, "report": {}}
    pg.evaluate("r => KapidaTest.uzaktanGelen(r)", uzak)
    check(pg.evaluate(f"KapidaTest.takvimde('{aday['pid']}', 'UZAK-1')"), "başka cihazda kabul edilen randevu bu cihazın takvimine işlendi")
    sonra = pg.evaluate("KapidaTest.adaylar('tele_hemsire_destekli', 600)")
    ayni = [x for x in sonra if x["pid"] == aday["pid"] and x["varis"] == aday["varis"]]
    check(not ayni, "aynı saat artık bu cihazda boş görünmüyor")
    pg.evaluate("r => KapidaTest.uzaktanGelen(r)", {**uzak, "status": "iptal"})
    check(not pg.evaluate(f"KapidaTest.takvimde('{aday['pid']}', 'UZAK-1')"), "başka cihazda iptal edilince takvimden silindi")
    pg.evaluate("KapidaTest.sahteKayit(true)")
    pg.evaluate("KapidaTest.randevuKur('tele_hemsire_destekli')"); pg.wait_for_timeout(300)
    check("Talep henüz iletilmedi" in p.inner_text() and p.locator("[data-act=tekrarGonder]").count() == 1, "gönderim başarısızsa 'Talep henüz iletilmedi' ve 'Tekrar gönder'")
    pg.evaluate("KapidaTest.kayitHata(false)"); p.locator("[data-act=tekrarGonder]").click(); pg.wait_for_timeout(300)
    check("Talep henüz iletilmedi" not in p.inner_text() and "Talebin iletildi" in p.inner_text(), "bağlantı gelince tekrar gönderildi")
    check(not errs, f"sayfa hatası yok {errs}")

    print("G) Karşılaştırma ekranı hastanın gördüğü tekliflerle aynı (ikinci tur dahil)")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg); secenekler(pg, p)
    u = pg.evaluate("KapidaTest.uyumTara(300)")
    check(u["uyumsuz"] == 0, f"300 farklı planda v5 sütunu teklif akışıyla aynı kişi ve süre ({u['uyumsuz']} uyumsuz)")
    check(u["ikinci"] > 0, f"ikinci tura kalan planlar da denendi ({u['ikinci']} plan)")
    for _ in range(24):
        pg.wait_for_timeout(500)
        if "Şu an teklif gelmedi" in p.inner_text() or p.locator(".yz-teklif [data-pick]").count(): break
    km = pg.evaluate("KapidaTest.karsilastirma()")
    gelen = [pg.evaluate(f"KapidaTest.aday({int(b.get_attribute('data-pick'))}).pid") for b in p.locator(".yz-teklif [data-pick]").all()]
    if gelen: check(km["v5"]["sure"] is not None, "hastaya teklif geldiyse karşılaştırma 'teklif yok' demiyor")
    else: check(km["v5"]["sure"] is None, "hastaya teklif gelmediyse karşılaştırma da 'teklif yok'")
    check(not errs, f"sayfa hatası yok {errs}")

    print("H) Gerçek randevu rota ekranında örnek ziyarete dönüşmüyor")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg); onayla_calisan(pg, h)
    k = pg.evaluate("KapidaTest.randevuKur('ev_muayene')")
    if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click(); pg.wait_for_timeout(500)
    p.locator("[data-act=home]").click(); pg.wait_for_timeout(200)
    pg.evaluate("KapidaTest.randevuKur('tele_muayene')")  # hastanın son talebi başka bir talep oldu
    pg.evaluate(f"KapidaTest.calisanSec('{k['pid']}')"); pg.wait_for_timeout(500)
    v = pg.evaluate(f"KapidaTest.siradakiTam('{k['pid']}')")
    check(v and v["id"] == k["id"] and not v["synthetic"] and v["status"] == "kabul", "hastada başka talep seçiliyken de çalışanın sıradaki ziyareti gerçek kayıt (synthetic değil)")
    check(h.locator("[data-act=hYoldayim]").count() == 1 and h.locator("[data-act=hIptalSor]").count() == 1, "'Yoldayım' ve 'Gelemiyorum' düğmeleri görünüyor")
    h.locator("[data-act=hYoldayim]").click(); pg.wait_for_timeout(300)
    check("Mesaj hastaya gitti" in h.inner_text(), "'Yoldayım' gerçek talebe gitti")
    check(not errs, f"sayfa hatası yok {errs}")

    print("I) Eşzamanlı rezervasyon: iki onaydan yalnızca biri kesinleşir")
    pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = ac(pg); pg.evaluate("KapidaTest.sahteKayit(false)")
    k = pg.evaluate("KapidaTest.randevuKur('ev_muayene')"); pg.wait_for_timeout(200)
    rakip = {"id": "UZAK-ONCE", "created_at": "2000-01-01T00:00:00.000Z", "status": "bekliyor", "provider_id": k["pid"], "service": "ev_muayene", "arrival_min": k["varis"], "date": "2026-11-16", "gun": 0,
             "patient": {"lat": 38.46, "lon": 27.22, "district": "Bornova", "plan": "yok"}, "price": {"provider_gets": 1000, "patient_pays": 4000}, "report": {}}
    pg.evaluate("r => KapidaTest.uzaktanGelen(r)", rakip); pg.evaluate("KapidaTest.cakismaCoz()"); pg.wait_for_timeout(300)
    check(pg.evaluate(f"KapidaTest.talepDurum('{k['id']}')") == "red" and "başka bir hastaya verildi" in p.inner_text(), "önce onaylanan başka cihazdaki talep kazandı; bu hastaya 'saat başka hastaya verildi'")
    check(p.locator("#altKart").count() == 1, "kaybeden hastaya alternatif gösterildi")
    check(pg.evaluate(f"KapidaTest.takvimde('{k['pid']}', 'UZAK-ONCE')") and not pg.evaluate(f"KapidaTest.takvimde('{k['pid']}', '{k['id']}')"), "takvimde yalnızca kazanan var")
    p.locator("[data-act=home]").click()
    k2 = pg.evaluate("KapidaTest.randevuKur('ev_muayene')"); pg.wait_for_timeout(200)
    sonra = {**rakip, "id": "UZAK-SONRA", "created_at": "2099-01-01T00:00:00.000Z", "provider_id": k2["pid"], "arrival_min": k2["varis"]}
    pg.evaluate("r => KapidaTest.uzaktanGelen(r)", sonra); pg.evaluate("KapidaTest.cakismaCoz()"); pg.wait_for_timeout(300)
    check(pg.evaluate(f"KapidaTest.talepDurum('{k2['id']}')") == "bekliyor" and not pg.evaluate(f"KapidaTest.takvimde('{k2['pid']}', 'UZAK-SONRA')"), "sonra gelen talep kaybetti: bu hastanınki duruyor, rakip takvimde yok")
    check(not errs, f"sayfa hatası yok {errs}")

    br.close()
print(f"Tamam: {ok} kontrol geçti.")
