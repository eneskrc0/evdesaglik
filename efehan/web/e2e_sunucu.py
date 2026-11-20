"""Kapıda + sunucu uçtan uca provası (sahte yapay zekâ, sahte mikrofon). Çalıştır: python web/e2e_sunucu.py"""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

E = Path(__file__).resolve().parents[1]
srv = subprocess.Popen(["node", str(E / "sunucu/yerel_sunucu.mjs")], env={"SAHTE": "1", "PATH": "/usr/bin:/bin:/usr/local/bin"})
web = subprocess.Popen([sys.executable, "-m", "http.server", "8000", "-d", str(E / "web/dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        ctx = br.new_context(viewport={"width": 1280, "height": 1000}, permissions=["microphone"])
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8000/kapida.html?sunucu=http://localhost:8787")
        p = pg.locator("#pScreen")
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        check(True, "sunucu bulundu, yapay zekâ açık")
        p.locator("[data-tile]").first.click()
        pg.wait_for_selector("#pMic", timeout=5000)
        check("Yapay zekâ (sunucu)" in p.inner_text(), "sohbet başlığında sunucu modu")
        check(p.locator("[data-act=voice]").count() == 1, "sesli okuma düğmesi var (telefon sesi)")
        # İlk mesaj (karo metni) gönderildi → YZ cevabı ve 'Anladığım' satırı
        pg.wait_for_selector("#pScreen .understood", timeout=8000)
        t = p.inner_text()
        check("Anladığım:" in t and "topuğunda akıntılı" in t, "YZ'nin ne anladığı kullanıcı mesajının altında")
        check("ne zamandır" in t.lower(), "YZ kendi sorusunu soruyor")
        # Sahte mikrofonla konuş → Whisper (sahte) → metin kutusuna
        pg.click("#pMic"); time.sleep(1.6); pg.click("#pMic")
        pg.wait_for_function("document.querySelector('#pInput') && document.querySelector('#pInput').value.length > 5", timeout=8000)
        check("gari" in pg.input_value("#pInput"), "ses kaydı yazıya çevrildi (ağızlı ifade korunuyor)")
        pg.fill("#pInput", "bir haftadır, kötüleşiyo")
        p.locator("button[type=submit]").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('planı ya da reçetesi')", timeout=8000)
        check(True, "ikinci soru geldi")
        p.locator("[data-quick]").first.click()
        pg.wait_for_function("/Kontrol et|Özet|özet/.test(document.querySelector('#pScreen').innerText) && !document.querySelector('#pScreen .typing')", timeout=10000)
        t = p.inner_text()
        check("topuğundaki yara" in t or "Topukta" in t, "rapor sunucudan geldi ve hastaya özet gösterildi")
        # Talebi gönder → sağlık çalışanı raporu yeni alanlarla görür
        p.locator("[data-act=options]").click(); pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)"); p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click()
        pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
        h = pg.locator("#hScreen"); h.get_by_role("button", name="Panele git").click()
        if h.locator("[data-act=haccept]").count() == 0:
            h.locator("[data-open]").first.click()
        t = h.inner_text()
        check("Kendi sözleriyle" in t and "akıntı yapıyo" in t, "çalışan raporu: hastanın kendi sözleri")
        check("Neden bu hizmet önerildi" in t and "kararı sen verirsin" in t, "çalışan raporu: öneri gerekçesi, karar çalışanda")
        check("Şeker hastalığı beyan edildi" in t, "çalışan raporu: dikkat edilecekler")
        # Acil kural motoru hâlâ önde: sunucuya gitmeden 112
        pg.goto("http://localhost:8000/kapida.html?sunucu=http://localhost:8787")
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.locator("[data-tile]").first.click(); pg.wait_for_selector("#pScreen .understood", timeout=8000)
        pg.fill("#pInput", "babamın göğsünde baskı var terliyor"); p.locator("button[type=submit]").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('112')", timeout=5000)
        check("Kural motoru" in p.inner_text(), "acil belirti: kural motoru 112'ye yönlendirdi")
        # Kullanıcı "direkt doktora yönlendir" derse: soru yok, hekim ev muayenesi
        pg.goto("http://localhost:8000/kapida.html?sunucu=http://localhost:8787")
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.locator("[data-tile]").first.click(); pg.wait_for_selector("#pScreen .understood", timeout=8000)
        check(p.get_by_role("button", name="Soruları geç, doktora yönlendir →").count() == 1, "sohbette 'soruları geç, doktora yönlendir' düğmesi var")
        pg.fill("#pInput", "direkt doktora yönlendir"); p.locator("button[type=submit]").click()
        pg.wait_for_selector("#pScreen [data-act=options]", timeout=10000)
        check("doğrudan bir doktora yönlendiriyoruz" in p.inner_text(), "yazınca sorular atlandı, özet doktora yönlendirmeyi söylüyor")
        p.locator("[data-act=options]").click()
        t = p.inner_text()
        check("Önce bir doktor evine gelip baksın" in t and "Dr." in t, "seçeneklerde doktorun ev ziyareti ve hekimler")
        pg.goto("http://localhost:8000/kapida.html?sunucu=http://localhost:8787")
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.locator("[data-tile]").first.click(); pg.wait_for_selector("#pScreen .understood", timeout=8000)
        p.get_by_role("button", name="Soruları geç, doktora yönlendir →").click()
        pg.wait_for_selector("#pScreen [data-act=options]", timeout=10000)
        check("doğrudan bir doktora yönlendiriyoruz" in p.inner_text(), "düğmeyle de doktora yönlendiriliyor")
        # Acil ekranı: en yakın acil servisler
        pg.goto("http://localhost:8000/kapida.html?sunucu=http://localhost:8787")
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.locator("[data-tile]").first.click(); pg.wait_for_selector("#pScreen .understood", timeout=8000)
        pg.fill("#pInput", "babam bayıldı nefes almıyor"); p.locator("button[type=submit]").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('En yakın acil servisler')", timeout=5000)
        check(" dk" in p.inner_text(), "acil ekranında en yakın acil servisler ve süre")
        # Sunucu kapalıysa demo moduna düşüyor
        pg2 = ctx.new_page(); pg2.goto("http://localhost:8000/kapida.html?sunucu=http://localhost:8799")
        pg2.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
        check(True, "sunucuya ulaşılamazsa demo modu (uygulama çalışmaya devam ediyor)")
        pg3 = ctx.new_page(); pg3.goto("http://localhost:8000/kapida.html")
        pg3.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
        check(True, "sunucu adresi yoksa demo modu")
        check(not errs, f"sayfa hatası yok {errs}")
        br.close()
finally:
    srv.terminate(); web.terminate()
print(f"\nTamam: {ok} kontrol geçti.")
