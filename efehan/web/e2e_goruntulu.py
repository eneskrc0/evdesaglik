"""Görüntülü doktor görüşmesi provası (DEMO görüşme; gerçek iki kişilik bağlantı yok).
- görüntülü randevuda harita, rota, yolculuk, kapı kodu ve yol ücreti yok; takvimde yer tutar, rotaya girmez
- hekimin ev muayenesi yine rotaya girer; hemşireli karma hizmette yolculuk yalnız hemşirede, hekim görüntülü
- takvim çakışması önlenir; hasta ana sayfadan görüşmeye döner
- kamera/mikrofon yalnızca düğmeyle açılır; izin reddinde ekran kullanılabilir
- bekleme / erken / gecikme / kopma / yeniden bağlanma / ayrılıp yeniden katılma / tamamlama / iptal iki tarafta tutarlı
- doktor görüşmeyi kesmeden özeti açar, özel not hastaya görünmez; mobilde düğmeler ≥48 px
Çalıştır: python web/e2e_goruntulu.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri() + "?rol=ham"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

MEDYA = ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
# İzin reddini taklit eder; window.__izinVer = true olunca sahte akış verir (yeniden dene)
RED = """(() => { const md = navigator.mediaDevices; if (!md) return; const asil = md.getUserMedia.bind(md);
  md.getUserMedia = (c) => window.__izinVer ? asil(c) : Promise.reject(Object.assign(new Error('izin yok'), { name: 'NotAllowedError' })); })();"""

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=MEDYA)
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    T = lambda js, *a: pg.evaluate(js, *a)

    def yukle():
        pg.goto(PAGE); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
        T("() => window.KapidaTest.saat(570)")

    def kur(code, **o):
        return T("([c, o]) => window.KapidaTest.randevuKur(c, o)", [code, o])

    def onayla(rid):
        if pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").count():
            pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
        if h.get_by_role("button", name="Panele git").count(): h.get_by_role("button", name="Panele git").click()
        if h.locator(f"[data-act=haccept][data-id='{rid}']").count() == 0: h.locator(f"[data-open='{rid}']").click()
        h.locator(f"[data-act=haccept][data-id='{rid}']").click()

    oda = lambda rid: T("id => window.KapidaTest.oda(id)", rid)

    # ---------- 1) Görüntülü randevu: harita, rota, yolculuk, yol ücreti yok ----------
    yukle()
    ad = T("() => window.KapidaTest.adaylar('tele_muayene')")
    check(ad and all(not x["ins"] and not x["yol"] and not x["paylasim"] for x in ad), f"görüntülü adayların hiçbirinde yolculuk, yol ücreti, paylaşım indirimi yok ({len(ad)} aday)")
    v = kur("tele_muayene")
    rid, dok = v["id"], v["pid"]
    t = p.inner_text()
    check("Görüntülü doktor görüşmesi" in t and "Bu randevu görüntülüdür. Doktor evinize gelmeyecek." in t, "hasta ekranında 'Görüntülü doktor görüşmesi' ve 'Doktor evinize gelmeyecek'")
    check(p.locator("#takip, .hr-kutu, #gzHasta").count() == 0 and "kapı kodu" not in t.lower() and "yola çıkar" not in t and "Kapında" not in t, "hasta ekranında harita, takip, kapı kodu, yola çıkış yok")
    check("Toplam ücret" in t and "Süre" in t and "Kamera ve mikrofonu kontrol et" in t and p.locator("[data-act=cancel]").count() == 1, "ücret, süre, kamera kontrolü ve iptal seçeneği var")
    onayla(rid)
    tk = [x for x in T("pid => window.KapidaTest.takvim(pid)", dok) if x.get("reqId") == rid]
    check(len(tk) == 1 and tk[0]["uzaktan"], "görüntülü randevu hekimin takviminde (uzaktan) yer tutuyor")
    check(all(x["reqId"] != rid for x in T("pid => window.KapidaTest.rota(pid)", dok)), "görüntülü randevu hekimin yol rotasına girmiyor")
    h.locator("[data-tab=rota]").click()
    ht = h.inner_text()
    check("Görüntülü görüşmelerin" in ht and h.locator(f"[data-vg=h-katil][data-id='{rid}']").count() == 1, "hekimin Rotam'ında 'Görüntülü görüşmelerin' ve 'Görüşmeye katıl'")
    check("SIRADAKİ ZİYARET · YOL TARİFİ" not in ht, "görüntülü görüşme için yol tarifi kartı çıkmıyor")

    # ---------- 2) Takvim çakışması ----------
    bas = v["varis"]
    ad2 = [x for x in T("() => window.KapidaTest.adaylar('tele_muayene')") if x["pid"] == dok]
    check(all(x["varis"] >= bas + 20 or x["varis"] + 20 <= bas for x in ad2), f"aynı hekime çakışan görüntülü saat önerilmiyor (dolu {bas}, yeni öneri {[x['varis'] for x in ad2]})")
    check(T("() => window.KapidaTest.adaylar('ev_muayene')") == [], "doktor eve gitmiyor: 'Hekim ev muayenesi' için hiç aday yok")

    # ---------- 3) Hasta ana sayfadan görüşmeye döner; ön hazırlık; kamera düğmesiz açılmaz ----------
    p.locator("[data-act=home]").first.click()
    t = p.inner_text()
    check("Yaklaşan görüşmen" in t and "Görüntülü" in t, "ana sayfada 'Yaklaşan görüşmen · Görüntülü'")
    p.get_by_role("button", name="Görüşmeye git").click()
    check("Görüntülü doktor görüşmesi" in p.inner_text(), "'Görüşmeye git' randevu ekranına döndürdü")
    katil = p.locator("[data-vg=p-katil]")
    if bas - 10 > 570: check(katil.is_disabled(), "görüşme saatinden önce 'Görüşmeye katıl' kapalı, açılış saati yazıyor")
    p.locator("[data-vg=p-hazirlik]").click()
    check(not oda(rid)["medya"] and p.locator("video").count() == 0, "ön hazırlık ekranında kamera/mikrofon kendiliğinden açılmadı")
    p.get_by_role("button", name="Kamerayı ve mikrofonu aç").click()
    pg.wait_for_function("window.KapidaTest.oda(%r).medya" % rid, timeout=5000)
    pg.wait_for_timeout(300)
    check(p.locator("video[data-vg-akis]").count() == 1, "düğmeye basınca kendi kamera önizlemesi açıldı")
    p.locator("[data-vg=p-mik]").click()
    check(p.locator("[data-vg=p-mik]").get_attribute("aria-pressed") == "true" and "Mikrofonu aç" in p.inner_text(), "mikrofon kapatıldı (düğme 'Mikrofonu aç')")
    p.locator("[data-vg=p-mik]").click()

    # ---------- 4) Erken / bekleniyor / gecikme ----------
    T("v => window.KapidaTest.saat(v)", bas - 5)
    check("Erken geldin" in p.inner_text(), "görüşme saatinden önce 'Erken geldin'")
    p.locator("[data-vg=p-odaya]").click()
    check(oda(rid)["durum"] == "bekleme" and oda(rid)["hasta"] == "bekleme", "odaya girdi: bekleme durumu")
    T("v => window.KapidaTest.saat(v)", bas)
    check("Doktorunuz bekleniyor" in p.inner_text(), "saatinde 'Doktorunuz bekleniyor'")
    T("v => window.KapidaTest.saat(v)", bas + 7)
    check("gecikti" in p.inner_text(), "doktor gecikince ayrı mesaj ('… dk gecikti')")
    check("bekleme odasında" in h.inner_text().lower(), "hekim ekranında 'Hasta bekleme odasında'")

    # ---------- 5) Hekim katılır → görüşme ----------
    h.locator(f"[data-vg=h-katil][data-id='{rid}']").click()
    o = oda(rid)
    check(o["durum"] == "gorusme" and o["basla"], "hekim katıldı: iki tarafta 'Görüşme sürüyor', süre sayıyor")
    t = p.inner_text()
    check("DEMO GÖRÜŞME" in t and "Bağlı" in t and "Görüşmeden ayrıl" in t and "Mikrofonu kapat" in t and "Kamerayı kapat" in t, "hasta görüşme ekranı: demo etiketi, bağlantı durumu, büyük düğmeler")
    check("gerçek kamera akışı yok" in t, "doktorun görüntüsü gerçekmiş gibi gösterilmiyor (demo profil alanı)")
    p.locator("[data-vg=p-kam]").click()
    check("Kameran kapalı" in p.inner_text(), "kamera kapalıyken profil alanı ('Kameran kapalı')")
    p.locator("[data-vg=p-kam]").click()

    # ---------- 6) Bağlantı kopması ve yeniden bağlanma ----------
    p.locator(".vg-demo-panel summary").click()
    p.locator("[data-vg=demo-kop]").click()
    check("Bağlantı kesildi, yeniden bağlanılıyor" in p.inner_text() and oda(rid)["durum"] == "gorusme", "kopmada uyarı çıkıyor, randevu tamamlanmıyor")
    p.locator("[data-vg=p-yeniden]").click(); pg.wait_for_timeout(1600)
    check(not oda(rid)["kopuk"] and "Bağlantı kesildi" not in p.inner_text(), "'Yeniden dene' ile bağlantı geri geldi")

    # ---------- 7) Ayrıl (onaylı) ve yeniden katıl ----------
    p.locator("[data-vg=p-ayril-sor]").click()
    check("Görüşmeden ayrılmak istiyor musun?" in p.inner_text(), "ayrılmadan önce onay soruluyor")
    p.locator("[data-vg=p-kal]").click()
    check(oda(rid)["hasta"] == "gorusmede", "'Görüşmede kal' görüşmeyi sürdürdü")
    p.locator("[data-vg=p-ayril-sor]").click(); p.locator("[data-vg=p-ayril]").click()
    o = oda(rid)
    check(o["durum"] == "gorusme" and o["hasta"] == "yok" and not o["medya"], "ayrılınca randevu bitmedi, kamera/mikrofon kapandı")
    check(p.get_by_role("button", name="Görüşmeye yeniden katıl").count() == 1, "'Görüşmeye yeniden katıl' düğmesi var")
    p.get_by_role("button", name="Görüşmeye yeniden katıl").click(); p.locator("[data-vg=p-odaya]").click()
    check(oda(rid)["hasta"] == "gorusmede", "hasta yeniden katıldı")

    # ---------- 8) Hekim: özet görüşmeyi kesmeden, özel not ----------
    h.locator("[data-vg=h-ozet]").click()
    check(h.locator(".vg-ozet").count() == 1 and oda(rid)["doktor"] == "gorusmede", "hekim özeti açtı, görüşme sürüyor")
    h.locator("#vgNot").fill("Özel not: kontrol önerilecek XQZ")
    check("XQZ" not in p.inner_text() and oda(rid)["not"].endswith("XQZ"), "hekimin özel notu hasta ekranında görünmüyor")

    # ---------- 9) Tamamla: iki tarafta tutarlı, medya bırakılır ----------
    h.locator("[data-vg=h-bitir-sor]").click()
    check("Görüşmeyi tamamlamak istiyor musun?" in h.inner_text(), "tamamlamadan önce onay")
    h.locator("[data-vg=h-bitir]").click()
    o = oda(rid)
    check(o["durum"] == "tamamlandi" and o["istek"]["vgSonuc"] == "tamamlandi" and not o["medya"], "tamamlandı: kayıt güncel, kamera/mikrofon bırakıldı")
    check("Tamamlandı" in p.inner_text() and "Görüşmeye katıl" not in p.inner_text(), "hasta ekranında 'Tamamlandı', katıl düğmesi yok")
    h.locator("[data-tab=rota]").click()
    check(h.locator(f"[data-vg=h-katil][data-id='{rid}']").count() == 0 and "Tamamlandı" in h.inner_text(), "hekim ekranında da 'Tamamlandı'")

    # ---------- 10) İptal iki tarafta ----------
    yukle()
    v2 = kur("tele_muayene"); onayla(v2["id"])
    pg.locator("[data-act=takip], [data-act=home]").first.click() if p.locator("[data-act=cancel]").count() == 0 else None
    p.locator("[data-act=cancel]").click()
    check(all(x.get("reqId") != v2["id"] for x in T("pid => window.KapidaTest.takvim(pid)", v2["pid"])), "iptal: hekimin takviminden silindi")
    h.locator("[data-tab=talepler]").click(); h.locator("[data-tab=rota]").click()
    check(h.locator(f"[data-vg=h-katil][data-id='{v2['id']}']").count() == 0, "iptal: hekim ekranındaki görüşme kartı kalktı")
    check("İptal edildi" in p.inner_text() or "iptal" in p.inner_text().lower(), "iptal: hasta tarafında bildirildi")

    # ---------- 11) Doktor yalnızca görüntülü: "doktora bağla" görüntülüye gider; evde ziyaret yalnız hemşire vb. ----------
    def akis(ilk, yatakta):
        yukle(); p.locator("[data-act=start]").click(); p.locator("#pInput").fill(ilk); p.locator("#pInput").press("Enter")
        for _ in range(14):
            pg.wait_for_timeout(500)
            if p.locator("[data-act=options]").count(): break
            q = p.locator("[data-quick]")
            if q.count():
                h2 = q.filter(has_text="Yatağa" if yatakta else "rahat")
                (h2.first if h2.count() else q.first).click()
        if p.locator("#pBed").count() and p.locator("#pBed").is_checked() != yatakta: p.locator("#pBed").click()  # özet ekranındaki "yatağa bağımlı" kutusu
        p.locator(".saatler .saat").first.click(); p.locator("[data-act=options]").click(); pg.wait_for_timeout(1000)
        pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
        return p.inner_text(), pg.eval_on_selector_all("#pScreen .opt", "els => els.map(e => e.innerText)")
    for ilk in ["Direkt doktora bağla beni", "Annem halsiz, doktor eve gelsin"]:
        t, ops = akis(ilk, False)
        check("Hekimle video görüşme" in t and ops and all("hekim" in o.lower() and "Görüntülü" in o for o in ops), f"'{ilk}' → görüntülü doktor, tüm adaylar görüntülü hekim")
    t, ops = akis("Babam yatağa bağımlı, direkt doktora bağla", True)
    check("Hemşire evine gelir, doktor görüntülü bağlanır" in t and ops and all("hekim" not in o.split("\n")[2].lower() for o in ops), "yatağa bağımlı + doktor isteği → hemşire evde, doktor görüntülü (eve doktor gelmiyor)")
    check("Doktor ev ziyareti" not in (yukle() or p.inner_text()) and "Hemşire evde, doktor görüntülü" in p.inner_text(), "ana sayfada 'Doktor ev ziyareti' yok, 'Hemşire evde, doktor görüntülü' var")
    T("() => window.KapidaTest.saat(570)")
    v3 = kur("kan_alma", plan=True); onayla(v3["id"])
    check(v3["ins"] and any(x["reqId"] == v3["id"] for x in T("pid => window.KapidaTest.rota(pid)", v3["pid"])) and p.locator("#takip").count() == 1, "hemşirenin ev ziyareti yine rotada, hasta canlı takip görüyor")

    # ---------- 12) Karma: hemşire evde (yolculuk), hekim görüntülü ----------
    yukle()
    v4 = kur("tele_hemsire_destekli")
    check(v4["ins"] and v4["hekim"] and v4["hekim"] != v4["pid"], f"karma: hemşire yolculukla ({v4['pid']}), hekim ayrı ({v4['hekim']})")
    hb = [x for x in T("pid => window.KapidaTest.takvim(pid)", v4["hekim"]) if x.get("reqId") == v4["id"]]
    check(len(hb) == 1 and hb[0]["uzaktan"] and v4["varis"] <= hb[0]["start_min"] <= v4["varis"] + 20, "karma: hekimin takviminde ziyaret içinde görüntülü blok")
    check(all(x["reqId"] != v4["id"] for x in T("pid => window.KapidaTest.rota(pid)", v4["hekim"])), "karma: hekimin rotasına yolculuk eklenmedi")
    onayla(v4["id"])
    check(any(x["reqId"] == v4["id"] for x in T("pid => window.KapidaTest.rota(pid)", v4["pid"])), "karma: hemşirenin rotasında ziyaret var")
    t = p.inner_text()
    check(p.locator("#takip").count() == 1 and "Doktor bu ziyarete görüntülü katılacak" in t, "karma: hastada hemşire takibi + hekimin görüntülü kartı")
    T("pid => window.KapidaTest.calisanSec(pid)", v4["hekim"])
    check(h.locator(f"[data-vg=h-katil][data-id='{v4['id']}']").count() == 1 and "Yolculuk yok" in h.inner_text(), "karma: hekim ekranında görüntülü katılım, yolculuk yok")

    # ---------- 13) Hasta katılmadı ----------
    yukle()
    v5 = kur("tele_muayene"); onayla(v5["id"])
    T("v => window.KapidaTest.saat(v)", v5["varis"])
    h.locator("[data-tab=rota]").click(); h.locator(f"[data-vg=h-katil][data-id='{v5['id']}']").click()
    T("v => window.KapidaTest.saat(v)", v5["varis"] + 11)
    h.locator("[data-vg=h-katilmadi]").click()
    check(oda(v5["id"])["durum"] == "katilmadi" and "Katılım olmadı" in p.inner_text(), "hasta gelmezse 'Katılmadı' iki tarafta")
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()

    # ---------- 14) İzin reddi + mobil ----------
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=MEDYA)
    pg = br.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(RED)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    T = lambda js, *a: pg.evaluate(js, *a)
    yukle()
    v6 = kur("tele_muayene")
    T("v => window.KapidaTest.saat(v)", v6["varis"])
    p.locator("[data-vg=p-hazirlik]").click()
    p.get_by_role("button", name="Kamerayı ve mikrofonu aç").click(); pg.wait_for_timeout(300)
    t = p.inner_text()
    check("izni verilmedi" in t and p.get_by_role("button", name="Yeniden dene").count() == 1, "izin reddinde açıklama ve 'Yeniden dene'")
    check(p.locator("[data-vg=p-odaya]").is_enabled(), "izin reddinde ekran kullanılabilir (yine de katılabilir)")
    T("() => { window.__izinVer = true; }")
    p.get_by_role("button", name="Yeniden dene").click()
    pg.wait_for_function("window.KapidaTest.oda(%r).medya" % v6["id"], timeout=5000)
    check("izni verilmedi" not in p.inner_text(), "'Yeniden dene' ile izin alındı, uyarı kalktı")
    p.locator("[data-vg=p-odaya]").click()
    boy = pg.eval_on_selector_all("#pScreen .vg-btn, #pScreen .vg-katil", "els => els.filter(e => e.offsetParent).map(e => [e.textContent.trim(), e.getBoundingClientRect().height, parseFloat(getComputedStyle(e).fontSize)])")
    check(boy and all(b[1] >= 48 and b[2] >= 17 for b in boy), f"mobilde görüşme düğmeleri ≥48 px, yazı ≥17 px ({[(b[0][:18], round(b[1])) for b in boy]})")
    gen = pg.evaluate("() => document.querySelector('#pScreen').scrollWidth <= document.querySelector('#pScreen').clientWidth + 1")
    check(gen, "mobilde yatay taşma yok")
    check(not errs, f"sayfa hatası yok {errs}")

    # ---------- 15) Tek telefon (#hasta): saat düğmesi, doktor demo olarak katılır, süre sayar ----------
    pg.goto(PAGE.replace("?rol=ham", "#hasta")); pg.wait_for_timeout(1500)
    v7 = kur("tele_muayene")
    pg.wait_for_function("window.KapidaTest.oda(%r).istek.status === 'kabul'" % v7["id"], timeout=12000)
    p.get_by_role("button", name="Demo: görüşme saatine geç").first.click()
    check(p.locator("[data-vg=p-katil]").is_enabled(), "tek telefon: 'görüşme saatine geç' ile 'Görüşmeye katıl' açıldı")
    p.locator("[data-vg=p-katil]").click(); p.locator("[data-vg=p-odaya]").click()
    check("doktor birkaç saniye içinde demo olarak katılacak" in p.inner_text(), "tek telefon: doktorun demo katılacağı yazıyor")
    pg.wait_for_function("window.KapidaTest.oda(%r).durum === 'gorusme'" % v7["id"], timeout=9000)
    pg.wait_for_timeout(2200)
    sure = p.locator("[data-vg-sure]").inner_text()
    check(oda(v7["id"])["otoDoktor"] and sure != "00:00" and "doktor otomatik katıldı" in p.inner_text(), f"tek telefon: doktor demo olarak katıldı, süre sayıyor ({sure})")
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"Tamam: {ok} kontrol geçti.")
