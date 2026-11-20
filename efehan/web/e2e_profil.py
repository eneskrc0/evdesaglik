"""Profil ve ayarlar provası (hasta + sağlık çalışanı).
A) Hasta: profil düğmesi, kişisel bilgiler (doğrulama), yakınlar, ödeme tercihi, bildirimler, görünüm (tema/yazı), acil durum kişisi
   (acil ekranında aranabilir), gizlilik (verileri indir, silme onayı), yenileyince kalıcılık, çıkış
B) Sağlık çalışanı: profil, çevrimdışı (talep kutusu + hastaya önerilmeme), hizmet kapatma, Güvenli Ziyaret PIN'i (doğrulama), kazanç ve
   değerlendirme sayfaları, çalışma saatlerine geçiş
C) Telefon ekranında taşma yok
Çalıştır: python web/build_web.py && python web/e2e_profil.py"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent / "dist" / "kapida.html"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)
bekle = lambda pg: pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    errs = []
    ctx = br.new_context(viewport={"width": 1280, "height": 1100}, accept_downloads=True)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    p = pg.locator("#pScreen")

    print("A) Hasta profili")
    pg.goto(D.as_uri() + "#hasta"); bekle(pg)
    pd = p.locator(".appbar .profil-dugme")
    check(pd.inner_text().strip() == "AD", "üst çubukta baş harfli profil düğmesi (AD)")
    pd.click()
    check("Ayşe Demir" in p.inner_text() and p.locator(".menu-satir").count() >= 9, "profil ekranı: ad ve en az 9 ayar satırı")
    for b in ["Kişisel bilgiler", "Adreslerim", "Yakınlarım", "Ödeme tercihi", "Randevularım", "Bildirimler", "Görünüm ve erişilebilirlik", "Acil durum kişisi", "Gizlilik ve verilerim", "Yardım ve destek", "Hakkında", "Çıkış yap"]:
        assert b in p.inner_text(), b
    check(True, "tüm bölümler listelenmiş (hesap, adres, yakınlar, ödeme, randevular, bildirim, görünüm, acil kişi, gizlilik, yardım, hakkında, çıkış)")
    p.locator("[data-profil=kisisel]").first.click()
    p.locator("#prTel").fill("12345"); p.locator("[data-act=kisiselKaydet]").click()
    check("05 ile başlayan" in p.inner_text(), "geçersiz telefon kaydedilmiyor, uyarı var")
    p.locator("#prAd").fill("Ayşe Yılmaz"); p.locator("#prTel").fill("0532 111 22 33"); p.locator("[data-act=kisiselKaydet]").click()
    check("Ayşe Yılmaz" in p.inner_text() and "0532 111 22 33" in p.inner_text(), "kişisel bilgiler kaydedildi")
    p.locator("[data-profil=yakinlar]").click()
    check("Annem" in p.inner_text() and "Babam" in p.inner_text(), "demo hesabında yakınlar hazır")
    p.locator("[data-secim=yakinlik][data-deger='Eşim']").click(); p.locator("#prYakinAd").fill("Mehmet"); p.locator("[data-act=yakinEkle]").click()
    check("Mehmet" in p.inner_text(), "yakın eklendi")
    p.locator("[data-act=pprofilGeri]").click()
    p.locator("[data-profil=odeme]").click(); p.locator("[data-secim=odeme][data-deger=nakit]").click()
    check(p.locator(".adres-satir.secili", has_text="Ziyarette nakit").count() == 1 and p.locator("[data-deger=uygulama]").is_disabled(), "ödeme tercihi nakit; uygulamadan kartla 'yakında' (kart bilgisi istenmiyor)")
    p.locator("[data-act=pprofilGeri]").click()
    p.locator("[data-profil=bildirim]").click()
    a = p.locator("[data-anahtar='p.kampanyaSms']")
    check(a.get_attribute("aria-checked") == "false", "kampanya SMS'i varsayılan kapalı")
    a.click(); check(p.locator("[data-anahtar='p.kampanyaSms']").get_attribute("aria-checked") == "true", "bildirim anahtarı çalışıyor")
    p.locator("[data-act=pprofilGeri]").click()
    p.locator("[data-profil=gorunum]").click()
    p.locator("[data-secim=tema][data-deger=koyu]").click(); p.locator("[data-secim=yazi][data-deger=buyuk]").click()
    check(pg.evaluate("document.documentElement.dataset.theme") == "dark" and pg.evaluate("document.documentElement.dataset.yazi") == "buyuk", "koyu tema ve büyük yazı uygulandı")
    p.locator("[data-act=pprofilGeri]").click()
    p.locator("[data-profil=acil]").click()
    p.locator("#prAcilAd").fill("Can"); p.locator("[data-act=acilKaydet]").click()
    check("telefonunu da yaz" in p.inner_text(), "telefonsuz acil kişi kaydedilmiyor")
    p.locator("#prAcilYakin").fill("Oğlum"); p.locator("#prAcilTel").fill("05321234567"); p.locator("[data-act=acilKaydet]").click()
    check("Can · Oğlum" in p.inner_text(), "acil durum kişisi kaydedildi")
    p.locator("[data-profil=gizlilik]").click()
    with pg.expect_download() as dl: p.locator("[data-act=pveriIndir]").click()
    veri = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
    check(veri["profil"]["ad"] == "Ayşe Yılmaz" and len(veri["adresler"]) == 2, "verilerimi indir: profil ve adresler JSON")
    p.locator("[data-act=phesapSil]").click()
    check("Geri alınamaz" in p.inner_text() and p.locator("[data-act=phesapSilEvet]").count() == 1, "hesap silmeden önce onay isteniyor")
    p.locator("[data-act=phesapSilHayir]").click()
    p.locator("[data-act=pprofilGeri]").click(); p.locator("[data-profil=yardim]").click()
    check(p.locator("details.sss").count() >= 5, "yardım: sık sorulan sorular")
    p.locator("[data-act=home]").first.click() if p.locator("[data-act=home]").count() else None
    pg.reload(); bekle(pg)
    check("İyi günler Ayşe" in p.inner_text() and pg.evaluate("document.documentElement.dataset.theme") == "dark", "yenileyince ad ve tema duruyor")
    p.locator("[data-act=start]").click(); pg.wait_for_timeout(300)
    p.locator("#pInput").fill("Babam nefes alamıyor"); p.locator("#pInput").press("Enter"); pg.wait_for_timeout(500)
    tel = p.locator("a[href='tel:05321234567']")
    check(pg.evaluate("KapidaTest.durum().ekran") == "emergency", "acil ekranı açıldı")
    check(tel.count() == 1 and "Can" in tel.inner_text(), "acil ekranında acil durum kişisini arama düğmesi (112'nin yanında)")
    p.locator("[data-act=chat]").click(); p.locator("[data-act=home]").first.click()
    p.locator(".appbar .profil-dugme").click(); p.locator("[data-act=cikisYap]").click(); pg.wait_for_timeout(800)
    check(pg.locator("#girisKatman").count() == 1, "çıkış yap: giriş ekranına dönüldü")
    # görünümü geri al (sonraki bölümler açık temada)
    pg.evaluate("localStorage.removeItem('anindasaglik_gorunum')")

    print("B) Sağlık çalışanı profili")
    pg.goto(D.as_uri() + "#ikisi"); bekle(pg)
    h = pg.locator("#hScreen")
    # taban: hemşirenin hizmeti (kan alma) için Onur V. listede mi?
    def liste_metni():
        p.locator("[data-tile]", has_text="Kan alma").click()
        for _ in range(12):
            pg.wait_for_timeout(500)
            if p.locator("[data-act=options]").count(): break
            if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
        p.locator("[data-act=options]").click(); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
        t = p.inner_text(); p.locator("[data-act=summary]").first.click(); p.locator("[data-act=chat]").first.click(); p.locator("[data-act=home]").first.click()
        return t
    once = liste_metni()
    h.locator(".appbar .profil-dugme").click()
    check("Hemşire Onur V." in h.inner_text() and "Hizmetlerim ve fiyatlarım" in h.inner_text() and "Güvenli Ziyaret" in h.inner_text(), "çalışan profili açıldı")
    h.locator("[data-anahtar='h.cevrimici']").click()
    check("Çevrimdışı" in h.inner_text(), "çevrimdışı oldu")
    sonra = liste_metni()
    if "Onur V." in once:
        check("Onur V." not in sonra, "çevrimdışı çalışan hastaya önerilmiyor")
    else:
        print("  · (taban listede Onur V. yoktu; öneri kontrolü atlandı)")
    h.locator("[data-act=hprofilKapat]").click()
    check("Çevrimdışısın" in h.inner_text() and "Çevrimdışı" in h.locator(".cevrimici").inner_text(), "talep kutusunda 'Çevrimdışısın', başlıkta Çevrimdışı")
    h.locator("[data-act=hCevrimiciOl]").click()
    check("Çevrimiçi" in h.locator(".cevrimici").inner_text(), "tek dokunuşla çevrimiçi")
    h.locator(".appbar .profil-dugme").click(); h.locator("[data-hprofil=hizmetler]").click()
    ilk = h.locator("[data-anahtar^='hz.']").first
    check(h.locator("[data-anahtar^='hz.']").count() >= 3 and "TL" in h.inner_text(), "hizmetler fiyatlarıyla listelendi")
    ilk.click(); check(h.locator("[data-anahtar^='hz.']").first.get_attribute("aria-checked") == "false", "hizmet kapatıldı")
    h.locator("[data-anahtar^='hz.']").first.click()
    h.locator("[data-act=hprofilGeri]").click(); h.locator("[data-hprofil=guvenlik]").click()
    h.locator("#hrPin").fill("1234"); h.locator("#hrBaski").fill("5678"); h.locator("[data-act=hGuvenlikKaydet]").click()
    check("Tahmin edilmesi kolay" in h.inner_text(), "kolay PIN reddedildi")
    h.locator("#hrPin").fill("4826"); h.locator("#hrBaski").fill("4826"); h.locator("[data-act=hGuvenlikKaydet]").click()
    check("farklı olmalı" in h.inner_text(), "baskı PIN'i normal PIN'le aynı olamaz")
    h.locator("#hrPin").fill("4826"); h.locator("#hrBaski").fill("7391"); h.locator("#hrAcilAd").fill("Deniz"); h.locator("#hrAcilTel").fill("05551112233")
    h.locator("[data-act=hGuvenlikKaydet]").click()
    kayit = pg.evaluate("JSON.parse(localStorage.getItem('anindasaglik_calisan_HEM-12'))")
    check(kayit["pin"] == "4826" and kayit["baskiPin"] == "7391" and kayit["acil"]["ad"] == "Deniz" and "PIN'in ayarlı" in h.inner_text(), "PIN, baskı PIN'i ve acil kişi kaydedildi")
    with pg.expect_download() as dl: h.locator("[data-hprofil=gizlilik]").click(); h.locator("[data-act=hveriIndir]").click()
    check(json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))["profil"]["pin"] == "(gizli)", "çalışan verisi indirilebiliyor; PIN dosyaya yazılmıyor")
    h.locator("[data-act=hprofilGeri]").click(); h.locator("[data-hprofil=kazanc]").click()
    check("Kazançlarım" in h.inner_text() and "hesap numarası istenmez" in h.inner_text(), "kazanç sayfası (banka numarası istenmiyor)")
    h.locator("[data-act=hprofilGeri]").click(); h.locator("[data-hprofil=degerlendirme]").click()
    check("Değerlendirmelerim" in h.inner_text(), "değerlendirmeler sayfası")
    h.locator("[data-act=hprofilGeri]").click(); h.locator("[data-act=hSaatlerim]").click()
    check(h.locator("[data-tab=saat][aria-selected=true]").count() == 1, "çalışma saatlerine geçildi")

    print("C) Telefon ekranı")
    m = br.new_context(viewport={"width": 390, "height": 844}); mp = m.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    mp.goto(D.as_uri() + "#hasta"); bekle(mp); mp.locator("#pScreen .profil-dugme").click()
    check(not mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "hasta profili telefonda taşmıyor")
    mp.screenshot(path=str(D.parent / "profil_hasta.png"))
    mp.goto(D.as_uri() + "#calisan"); mp.wait_for_timeout(1500); mp.locator("#hScreen .profil-dugme").click()
    check(not mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "çalışan profili telefonda taşmıyor")
    mp.screenshot(path=str(D.parent / "profil_calisan.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"Tamam: {ok} kontrol geçti.")
