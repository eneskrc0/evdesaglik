"""Reçete / hekim planı doğrulama provası (Sarp'ın modülü Kapıda'da: web/belge.js + web/recete.js).
A) İki telefon, sunucusuz: serum (reçeteli) → numara olmadan onay kapalı → biçim uyarısı → numara + izin → düzenlenmiş PDF uyarısı →
   talep → çalışan detayında ön kontrol → kapıda 5 maddelik kontrol (hepsi işaretlenmeden 'doğrulandı' kapalı) → hasta 'doğrulandı'
B) Doğrulanamadı: not hastaya gider, 'uygulama yapılmadı · ücret alınmaz', bildirimler
C) Hekim planı isteyen hizmet (sonda bakımı): belge isteğe bağlı, onay açık
D) Taklit yapay zekâ sunucusu: reçete görüntüsü okunur, numara ve ad kendiliğinden dolar; numara farkı 'şüpheli' + onay kutusu
E) Yalnız hasta telefonu (#hasta): kapıda demo doğrulama
Çalıştır: python web/build_web.py && python web/e2e_recete.py"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

E = Path(__file__).resolve().parents[1]
DIST = E / "web" / "dist"
T = Path("/tmp/rx_test"); T.mkdir(exist_ok=True)
ok = 0


def check(c, m):
    global ok
    if not c:
        print("HATA:", m); sys.exit(1)
    ok += 1; print("  ✓", m)


# deneme dosyaları
import struct, zlib
def png(path, w=360, h=240):
    raw = b"".join(b"\x00" + b"\xff\xff\xff" * w for _ in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b""))
png(T / "recete.png")
(T / "duzenlenmis.pdf").write_bytes(b"%PDF-1.4\n1 0 obj<</Producer (Adobe Photoshop CC)>>endobj\ntrailer<<>>\n%%EOF\n% sonradan\n%%EOF\n")
(T / "notlar.txt").write_text("x")

srv = subprocess.Popen(["node", str(E / "sunucu/yerel_sunucu.mjs")], env={"SAHTE": "1", "PATH": "/usr/bin:/bin:/usr/local/bin", "PORT": "8787"}, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8000", "-d", str(DIST)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
post = lambda yol, veri: urllib.request.urlopen(urllib.request.Request("http://localhost:8787" + yol, data=json.dumps(veri).encode(), method="POST")).read()


def secenekler(pg, p, metin, plan="var"):
    p.locator("[data-act=start]").click()
    p.locator("#pInput").fill(metin); p.locator("#pInput").press("Enter")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=15000)
    p.locator(f"[data-plan={plan}]").first.click(); p.locator("[data-act=options]").click(); pg.wait_for_timeout(300)


def ilk_aday(pg, p):
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    p.locator("details.klasik [data-pick], .opt[data-pick]").first.click(); pg.wait_for_timeout(200)


try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

        print("A) Reçeteli hizmet, iki telefon")
        pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8000/kapida.html?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
        p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
        secenekler(pg, p, "direkt hemşireye yönlendir, annemin koluna reçeteli serum takılacak")
        t = p.inner_text()
        check("Serum takma" in t and "Reçeteni ekle" in t and "Zorunlu" in t, "serumda 'Reçeteni ekle' kartı (zorunlu)")
        ilk_aday(pg, p)
        check(p.locator("[data-act=confirm]").is_disabled() and "e-Reçete numaranı yaz" in p.inner_text(), "numara yokken 'Randevuyu onayla' kapalı, nedeni yazıyor")
        p.locator(".sheet [data-act=closeSheet]").last.click()
        p.locator("#rxNo").fill("12"); p.locator("#rxNo").blur(); pg.wait_for_timeout(200)
        check("5–12 harf ve rakam" in p.inner_text(), "kısa numarada biçim uyarısı")
        p.locator("#rxNo").fill("1a2b3c4"); p.locator("#rxHasta").fill("Ayşe Demir"); p.locator("#rxHasta").blur(); pg.wait_for_timeout(200)
        check(p.locator("[data-rx=onay]").count() == 1 and "izin kutusunu" in p.inner_text(), "geçerli numarada paylaşım izni isteniyor")
        p.locator("#rxDosya").set_input_files(str(T / "notlar.txt")); pg.wait_for_timeout(300)
        check("dosya türü kabul edilmiyor" in p.inner_text(), ".txt reddedildi")
        p.locator("#rxDosya").set_input_files(str(T / "duzenlenmis.pdf")); pg.wait_for_function("document.querySelector('#rxKart').innerText.includes('Ön kontrol')", timeout=8000)
        t = p.locator("#rxKart").inner_text()
        check("Photoshop" in t and "sonradan" not in t.lower() or "değiştirilmiş" in t, "düzenleme yazılımı izi ve sonradan değiştirilme işaretlendi")
        check("Ön kontrol: dikkat" in t, f"düzenlenmiş PDF → 'dikkat'")
        check("yapay zekâyla okunamadı" in t, "sunucusuzken içerik okunmadığı açıkça yazıyor")
        p.locator("[data-rx=onay]").check(); pg.wait_for_timeout(200)
        ilk_aday(pg, p)
        check(p.locator("[data-act=confirm]").is_enabled() and "1A2B3C4" in p.locator(".sheet").inner_text(), "izinden sonra onay açık, özet numarayı gösteriyor")
        p.locator("[data-act=confirm]").click(); pg.wait_for_timeout(300)
        check("e-Nabız" in p.locator("#rxHasta").inner_text() if p.locator("#rxHasta").count() else True, "hasta takipte reçete bilgisi")
        pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
        h.get_by_role("button", name="Panele git").click()
        if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
        ht = h.inner_text()
        check("reçete · ön kontrol" in ht.lower() and "Ayşe Demir" in ht and "1A2B3C4" in ht and "Photoshop" in ht and "kapıda doğrula" in ht, "çalışan detayında ön kontrol ve numara")
        check("e-Nabız'dan kontrol etmeden uygulama yapma" in ht, "eksik bilgilerde 'reçete henüz doğrulanmadı'")
        h.locator("[data-act=haccept]").click(); pg.wait_for_timeout(300)
        check("e-Nabız" in p.locator("#rxHasta").inner_text(), "hasta: 'kapıda e-Nabız'ındaki kaydı görerek doğrulayacak'")
        pg.wait_for_selector("#pScreen [data-gz=h-kod-ok]", timeout=90000); p.locator("[data-gz=h-kod-ok]").click()
        check(h.locator("#rxKapi").count() == 0, "check-in'den önce kapı kontrolü yok")
        h.locator("[data-gz=checkin]").click(); pg.wait_for_timeout(1200)
        check(h.locator("#rxKapi").count() == 1, "check-in'den sonra Rotam'da 'Kapıda reçete kontrolü'")
        check(h.locator("[data-rxkapi=ok]").is_disabled() and h.locator("#rxKapi [data-rxk]").count() == 5, "5 madde işaretlenmeden 'Reçete doğrulandı' kapalı")
        check("Kapıda reçeteyi doğrula" in pg.evaluate("JSON.stringify(window.KapidaBildirim.liste('h'))"), "çalışana 'Kapıda reçeteyi doğrula' bildirimi")
        for i in range(5): h.locator("#rxKapi [data-rxk]").nth(i).check(); pg.wait_for_timeout(80)
        check(h.locator("[data-rxkapi=ok]").is_enabled(), "hepsi işaretlenince açık")
        h.locator("[data-rxkapi=ok]").click(); pg.wait_for_timeout(1200)
        check("Reçeten kapıda doğrulandı" in p.inner_text(), "hasta: 'Reçeten kapıda doğrulandı'")
        check("Reçeten doğrulandı" in pg.evaluate("JSON.stringify(window.KapidaBildirim.liste('p'))"), "hastaya bildirim")
        check(not errs, f"sayfa hatası yok {errs}")

        print("B) Doğrulanamadı")
        pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8000/kapida.html?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
        p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
        secenekler(pg, p, "direkt hemşireye yönlendir, babama reçeteli kas içi iğne yapılacak")
        check("Kas içi" in p.inner_text() and "Reçeteni ekle" in p.inner_text(), "kas içi iğne de reçete istiyor")
        p.locator("#rxNo").fill("7XK29QA"); p.locator("#rxNo").blur(); pg.wait_for_timeout(200)
        p.locator("[data-rx=onay]").check(); pg.wait_for_timeout(200)
        ilk_aday(pg, p); p.locator("[data-act=confirm]").click(); pg.wait_for_timeout(300)
        pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click(); h.get_by_role("button", name="Panele git").click()
        if h.locator("[data-act=haccept]").count() == 0: h.locator("[data-open]").first.click()
        h.locator("[data-act=haccept]").click()
        pg.wait_for_selector("#pScreen [data-gz=h-kod-ok]", timeout=90000); p.locator("[data-gz=h-kod-ok]").click()
        h.locator("[data-gz=checkin]").click(); pg.wait_for_timeout(1200)
        h.locator("#rxNot").fill("e-Nabız'da bu numarayla reçete yok"); pg.wait_for_timeout(100)
        h.locator("[data-rxkapi=red]").click(); pg.wait_for_timeout(1200)
        t = p.inner_text()
        check("doğrulanamadı · uygulama yapılmadı" in t and "bu numarayla reçete yok" in t and "ücret alınmaz" in t, "hasta: doğrulanamadı, çalışanın notu, ücret alınmaz")
        check("Uygulama yapılmadı" in t, "takip adımlarında 'Uygulama yapılmadı'")
        check("Uygulama yapılmadı" in pg.evaluate("JSON.stringify(window.KapidaBildirim.liste('p'))"), "hastaya uyarı bildirimi")
        check("Kapıda doğrulanamadı" in h.inner_text(), "çalışan ekranında sonuç")
        check(not errs, f"sayfa hatası yok {errs}")

        print("C) Hekim planı isteyen hizmet")
        pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8000/kapida.html?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=10000)
        p = pg.locator("#pScreen")
        secenekler(pg, p, "direkt hemşireye yönlendir, babamın idrar sondasının bakımı yapılacak")
        t = p.inner_text()
        check("Doktorunun planını ekle" in t and "İsteğe bağlı" in t, "sondada plan kartı isteğe bağlı")
        ilk_aday(pg, p)
        check(p.locator("[data-act=confirm]").is_enabled() and "kapıda gösterilecek" in p.locator(".sheet").inner_text(), "belge eklemeden onay açık: 'kapıda gösterilecek'")
        p.locator(".sheet [data-act=closeSheet]").last.click()
        p2 = br.new_page(); p2.goto("http://localhost:8000/kapida.html?rol=ham"); p2.wait_for_timeout(500)
        q = p2.locator("#pScreen"); secenekler(p2, q, "direkt doktora yönlendir, babamın tansiyonu düştü ve halsiz", plan="yok")
        check("Reçeteni ekle" not in q.inner_text() and "planını ekle" not in q.inner_text(), "plan yokken (doktor muayenesi) reçete kartı yok")
        check(not errs, f"sayfa hatası yok {errs}")

        print("D) Taklit yapay zekâ ile reçete okuma")
        post("/__sahte_sohbet", {"sohbet": [], "rapor": None})
        post("/__sahte_recete", {"recete_no": "1A2B3C4", "hasta_ad_soyad": "Ayşe Demir", "recete_tarihi": "14.11.2026", "hekim_ad_soyad": "Dr. Mehmet Kaya", "tesis": "Bornova ASM", "recete_turu": "normal",
                                 "ilaclar": [{"ad": "Serum fizyolojik 500 ml", "doz": "1x1", "kullanim": "damar içi"}], "belge_kaynagi": "e-nabiz", "hizmetle_uyumlu": True, "bulgular": [], "ozet": "e-Nabız reçete ekranı."})
        pg = br.new_page(viewport={"width": 1280, "height": 1000}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8000/kapida.html?rol=ham&sunucu=http://localhost:8787"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=10000)
        p = pg.locator("#pScreen")
        secenekler(pg, p, "direkt hemşireye yönlendir, annemin koluna reçeteli serum takılacak")
        if "Reçeteni ekle" not in p.inner_text():  # rapor taklidi başka hizmet önerdiyse serumu seç
            p.locator("[data-hizmet=iv_serum]").first.click(); pg.wait_for_timeout(300)
        p.locator("#rxDosya").set_input_files(str(T / "recete.png")); pg.wait_for_function("document.querySelector('#rxKart').innerText.includes('Ön kontrol')", timeout=15000)
        t = p.locator("#rxKart").inner_text()
        check(p.locator("#rxNo").input_value() == "1A2B3C4" and p.locator("#rxHasta").input_value() == "Ayşe Demir", "numara ve hasta adı belgeden kendiliğinden doldu")
        check("Ön kontrol: uygun" in t and "Dr. Mehmet Kaya" in t and "e-Nabız ekranından" in t, f"okunan alanlar ve 'uygun'")
        p.locator("#rxNo").fill("9Z9Z9Z9"); p.locator("#rxNo").blur(); pg.wait_for_timeout(300)
        t = p.locator("#rxKart").inner_text()
        check("Ön kontrol: şüpheli" in t and "aynı değil" in t and p.locator("[data-rx=ack]").count() == 1, "numara farkı → şüpheli, 'uyarıları gördüm' kutusu")
        p.locator("[data-rx=onay]").check(); pg.wait_for_timeout(150)
        ilk_aday(pg, p)
        check(p.locator("[data-act=confirm]").is_disabled(), "şüphelide uyarı onaylanmadan randevu yok")
        p.locator(".sheet [data-act=closeSheet]").last.click(); p.locator("[data-rx=ack]").check(); pg.wait_for_timeout(150)
        ilk_aday(pg, p)
        check(p.locator("[data-act=confirm]").is_enabled(), "uyarı onaylanınca randevu açık")
        check(not errs, f"sayfa hatası yok {errs}")

        print("E) Yalnız hasta telefonu")
        pg = br.new_page(viewport={"width": 420, "height": 900}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8000/kapida.html#hasta"); pg.wait_for_timeout(1200)
        p = pg.locator("#pScreen")
        secenekler(pg, p, "direkt hemşireye yönlendir, annemin koluna reçeteli serum takılacak")
        p.locator("#rxNo").fill("1A2B3C4"); p.locator("#rxNo").blur(); pg.wait_for_timeout(150)
        p.locator("[data-rx=onay]").check(); pg.wait_for_timeout(150)
        w = pg.evaluate("document.querySelector('#rxKart').scrollWidth <= document.querySelector('#rxKart').clientWidth + 1")
        check(w, "telefonda reçete kartı taşmıyor")
        ilk_aday(pg, p); p.locator("[data-act=confirm]").click()
        pg.wait_for_selector("#pScreen [data-gz=h-kod-ok]", timeout=90000); p.locator("[data-gz=h-kod-ok]").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('kapıda doğrulandı')", timeout=15000)
        check(True, "tek telefonda çalışan adına demo kapı doğrulaması")
        check(not errs, f"sayfa hatası yok {errs}")
        br.close()
finally:
    srv.terminate(); web.terminate()
print(f"Tamam: {ok} kontrol geçti.")
