"""Güvenli Ziyaret provası: risk notu → kapı kodu + fotoğraf → konum kontrolü → check-in → kontrol zamanlayıcısı
→ PIN → yükseltme zinciri (arama, 112) → gizli SOS → acil yardım → çıkış + Beyaz Kod → hasta onayı.
Çalıştır: python web/e2e_guvenlik.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri() + "?rol=ikisi"  # giriş ekranını atla (iki telefon yan yana)
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(PAGE); p, h, masa = pg.locator("#pScreen"), pg.locator("#hScreen"), pg.locator("#gzMasa")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)

    # --- birim: risk notu (kural + YZ) ve baskı PIN'i ---
    u = pg.evaluate("""() => { const K = window.KapidaGuvenlik;
      const a = K.riskAnaliz({ guvenlik_notlari: [] }, "Annemin yarası var. Evde köpeğimiz var, bağlı değil.", 600);
      const b = K.riskAnaliz({ guvenlik_notlari: ["Oğlu evde bıçakla tehdit etmiş (beyan)"] }, "", 600);
      const c = K.riskAnaliz({ sikayet: "Bası yarası" }, "boğazım ağrıyor", 600);
      const d = K.riskAnaliz({}, "", 21 * 60);
      // baskı PIN'i: iptal ediyormuş gibi görünür, sessiz alarm verir
      const r = { id: "T-birim", status: "kabul", service: "ev_muayene", arrival_min: 600, provider_id: "X", patient: { district: "Konak", lat: 38.42, lon: 27.13 }, report: {} };
      const G = K.create({ esc: (s) => String(s), hhmm: (m) => String(m), kisi: () => ({ full: "Dr. A", first: "A", initials: "A" }), hizmet: () => ({ duration_min: 30, name_tr: "Muayene" }),
        konum: () => ({ pos: [38.4202, 27.13], hedef: [38.42, 27.13], ulasti: true }) });
      const tik = (gz, extra) => G.onClick({ target: { closest: () => ({ dataset: Object.assign({ gz }, extra || {}) }) } }, r);
      G.tick(r); tik("checkin"); const red = G.durum(r).hata; tik("h-kod-ok"); tik("checkin");
      tik("d-simdi"); G.tick(r); const kontrol = !!G.durum(r).kontrol;
      G.onInput({ target: { id: "gzPin", value: "0852" } }, r); tik("pin", { baglam: "kontrol" });
      const s = G.durum(r);
      return { a: [a.seviye, a.notlar.map((n) => n.metin).join("|")], b: [b.seviye, b.notlar.length, b.oneriler.join("|")], c: c.seviye, d: d.seviye,
        red, checkin: !!s.checkin, kontrol, cozuldu: !s.kontrol, sessiz: !!s.sessiz, uyari: G.uyariHtml(r) };
    }""")
    check(u["a"][0] == 2 and "köpek" in u["a"][1], "kural motoru 'köpek' beyanını orta risk notu yaptı")
    check(u["b"][0] == 3 and u["b"][1] == 1 and "görüntülü" in u["b"][2] and "iki kişilik" in u["b"][2], "YZ notu (bıçak/tehdit) yüksek risk: tek not, görüntülü ön görüşme ve iki kişilik ziyaret önerisi")
    check(u["c"] == 0 and u["d"] == 2, "risksiz raporda not yok; gece ziyareti orta risk")
    check("kapı kodunu" in u["red"] and u["checkin"], "kod onaylanmadan check-in yok; onaydan sonra var")
    check(u["kontrol"] and u["cozuldu"] and u["sessiz"] and u["uyari"] == "", "baskı PIN'i kontrolü kapatıyor gibi görünür ama sessiz alarm verir")

    # --- uçtan uca: teklifle bugüne randevu ---
    p.locator("[data-tile]").first.click()
    for _ in range(8):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    teklif = None
    for k in range(4):
        if p.locator("[data-act=summary]").count(): p.locator("[data-act=summary]").first.click()
        p.locator(".saatler").nth(0).locator(".saat").nth(k).click(); p.locator("[data-act=options]").click()
        for _ in range(30):
            pg.wait_for_timeout(500)
            if p.locator(".yz-teklif [data-pick]").count(): teklif = p.locator(".yz-teklif [data-pick]").first; break
            if "Şu an teklif gelmedi" in p.inner_text(): break
        if teklif: break
    assert teklif is not None, "teklif gelmedi"
    teklif.click(); p.locator("[data-act=confirm]").click()
    check("kapı kodu" in p.locator("#gzHasta").inner_text(), "randevu kesinleşince hasta kapı kodunun kapıda çıkacağını görüyor")
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click(); h.get_by_role("button", name="Panele git").click()
    kart = h.locator("#gzCalisan")
    check(kart.count() == 1 and "KAPI KODUN" in kart.inner_text() and "Ziyaret öncesi risk notu" not in kart.inner_text(), "çalışanın Rotam'ında güvenli ziyaret kartı ve kapı kodu var")
    kod = kart.locator(".gz-kod").inner_text()
    pg.wait_for_timeout(600); check("Güvenlik masası" in masa.inner_text() and "Yolda" in masa.inner_text(), "güvenlik masası ziyareti izliyor (yolda)")

    # konum hatası: adrese uzak → check-in reddi
    masa.get_by_role("button", name="Konum hatası dene").click()
    kart.get_by_role("button", name="Ziyareti başlat (check-in)").click()
    check("uzaktasın" in kart.inner_text(), "adrese uzakken check-in reddedildi (konum kontrolü)")
    masa.get_by_role("button", name="Konum hatası dene").click()

    # kapıya varış → hasta kod + fotoğrafı görür
    pg.wait_for_function("document.querySelector('#gzHasta') && document.querySelector('#gzHasta').innerText.includes('KAPI KODU')", timeout=60000)
    check(p.locator("#gzHasta .gz-kod").inner_text() == kod and p.locator("#gzHasta .gz-foto").count() == 1, "kapıda hasta ve çalışan aynı kodu görüyor; hastada çalışanın fotoğrafı")
    pg.wait_for_function("document.querySelector('#takip').innerText.includes('kimliğini doğrula')", timeout=3000)
    check(True, "takip 'Kapında' adımında check-in'i bekliyor")
    kart.get_by_role("button", name="Ziyareti başlat (check-in)").click()
    check("henüz onaylamadı" in kart.inner_text(), "hasta onaylamadan check-in yok")
    p.get_by_role("button", name="Kod ve fotoğraf eşleşiyor").click()
    check("Hasta kodu onayladı" in kart.inner_text(), "hasta onayı çalışana yansıdı")
    kart.get_by_role("button", name="Ziyareti başlat (check-in)").click()
    check("Ziyareti bitir" in kart.inner_text() and "Güvenli ziyaret açık" in p.locator("#gzHasta").inner_text(), "check-in: süre işliyor, hastada 'güvenli ziyaret açık'")
    pg.wait_for_timeout(5500)
    check("ziyarette" in pg.evaluate("document.querySelector('#gzMasa').innerText") or "kayıt" in masa.inner_text(), "ziyaret sırasında konum kaydı tutuluyor")

    # kontrol → yanlış PIN → doğru PIN
    masa.get_by_role("button", name="Kontrolü şimdi gönder").click()
    uy = h.locator("#gzUyari")
    pg.wait_for_function("document.querySelector('#gzUyari').innerText.includes('Her şey yolunda mı?')", timeout=3000)
    check(True, "çalışana 'Her şey yolunda mı?' bildirimi geldi")
    uy.locator("#gzPin").fill("1111"); uy.get_by_role("button", name="Yolundayım").click()
    check("PIN yanlış" in uy.inner_text(), "yanlış PIN kontrolü kapatmıyor")
    uy.locator("#gzPin").fill("2580"); uy.get_by_role("button", name="Yolundayım").click()
    check(uy.inner_text().strip() == "" and "Yolundayım" in masa.inner_text(), "doğru PIN ile kontrol kapandı, masaya yazıldı")

    # yanıt yok → zincir: ikinci uyarı → arama → ... → 112
    masa.get_by_role("button", name="Kontrolü şimdi gönder").click(); pg.wait_for_timeout(500)
    masa.get_by_role("button", name="Zinciri hızlandır").click(); pg.wait_for_timeout(500)
    check("İkinci uyarı" in uy.inner_text(), "yanıt yok → ikinci uyarı")
    masa.get_by_role("button", name="Zinciri hızlandır").click(); pg.wait_for_timeout(500)
    check("Gelen arama" in uy.inner_text(), "yanıt yok → güvenlik masası çalışanı arıyor")
    for _ in range(3): masa.get_by_role("button", name="Zinciri hızlandır").click(); pg.wait_for_timeout(450)
    check("112'ye son konumla bildirim" in masa.inner_text() and "son konum 38." in masa.inner_text() and "ALARM" in masa.inner_text(), "zincirin sonunda 112'ye son konumla bildirim (simüle)")
    uy.locator("#gzPin").fill("2580"); uy.get_by_role("button", name="Yolundayım").click()
    check("geç yanıt" in masa.inner_text(), "geç gelen doğru PIN zinciri durduruyor")

    # gizli SOS: süreye 2 sn basılı tut
    sure = kart.locator("[data-gz-sure]"); sure.hover(); pg.mouse.down(); pg.wait_for_timeout(2300); pg.mouse.up()
    pg.wait_for_timeout(500)
    check("SESSİZ ALARM" in masa.inner_text() and uy.inner_text().strip() == "" and "Alarm" not in kart.inner_text(), "gizli SOS: masada sessiz alarm, çalışanın ekranı değişmedi")

    # görünür acil yardım + PIN ile iptal
    kart.get_by_role("button", name="Acil yardım").click()
    check("Alarm gönderildi" in uy.inner_text() and "ACİL YARDIM" in masa.inner_text(), "acil yardım: alarm ve konum masaya gitti")
    uy.locator("#gzPin").fill("2580"); uy.get_by_role("button", name="İptal et").click()
    check("SOS iptal edildi" in masa.inner_text(), "yanlış alarm PIN ile iptal edildi")

    # hasta: sorun bildir (çalışana gösterilmez)
    p.locator("#gzHasta").get_by_role("button", name="Sorun bildir").click()
    p.locator("#gzHasta").get_by_role("button", name="Kendimi güvende hissetmiyorum").click()
    check("güvende hissetmiyor" in masa.inner_text() and "güvende" not in h.inner_text(), "hastanın sorun bildirimi masaya gitti, çalışana gösterilmedi")

    # çıkış: fiziksel şiddet → Beyaz Kod
    kart.get_by_role("button", name="Ziyareti bitir (çıkış)").click()
    kart.get_by_role("button", name="Fiziksel şiddet").click()
    t = kart.inner_text()
    check("Beyaz Kod" in t and kart.locator("a[href='tel:113']").count() == 1 and kart.locator("a[href='https://beyazkod.saglik.gov.tr']").count() == 1, "şiddet bildirilince Beyaz Kod (113 ve beyazkod.saglik.gov.tr)")
    check("Konum paylaşımı durdu" in t and "paylaşım durdu" in masa.inner_text(), "çıkışla konum paylaşımı durdu")
    p.get_by_role("button", name="Evet, tamamlandı").click()
    check("Ziyaret tamamlandı" in p.locator("#gzHasta").inner_text() and "Ziyaret tamamlandı" in p.locator("#takip").inner_text(), "hasta tamamlandığını onayladı")
    pg.locator("#colH").screenshot(path=str(Path(__file__).resolve().parent / "dist" / "guvenli_ziyaret.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"Tamam: {ok} kontrol geçti.")
