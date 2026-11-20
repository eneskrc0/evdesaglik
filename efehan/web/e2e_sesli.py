"""Sesli asistan uçtan uca provası.
A) Sunucu (Whisper) yolu: sahte mikrofon (konuşmaya benzeyen ses dosyası) + sahte yapay zekâ sunucusu.
   Gerçek VAD, gerçek MediaRecorder ve gerçek /ses isteği çalışır; yalnızca Whisper ve dil modeli sahtedir.
B) Sunucusuz (demo) yol: tarayıcının konuşma tanıması (taklit) ile demo soruları baştan sona sesle.
Telefonun sesi (speechSynthesis) taklit edilir: okunan her cümle kaydedilir.
Çalıştır: python web/e2e_sesli.py   (ffmpeg ve Chrome gerekir)"""
import json, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

E = Path(__file__).resolve().parents[1]
TMP = Path(tempfile.mkdtemp())
WAV = TMP / "konusma.wav"
# 1,2 sn sessizlik + 1,8 sn konuşmaya benzeyen ses (dalgalı ton) + 2,6 sn sessizlik; Chrome dosyayı döngüde çalar
ff = lambda *a: subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "1.2", str(TMP / "s1.wav"))
ff("-f", "lavfi", "-i", "sine=f=230:r=48000:d=1.8", "-af", "tremolo=f=4:d=0.7,volume=0.5", "-ac", "1", str(TMP / "t.wav"))
ff("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "2.6", str(TMP / "s2.wav"))
ff("-i", str(TMP / "s1.wav"), "-i", str(TMP / "t.wav"), "-i", str(TMP / "s2.wav"), "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(WAV))

srv = subprocess.Popen(["node", str(E / "sunucu/yerel_sunucu.mjs")], env={"SAHTE": "1", "PATH": "/usr/bin:/bin:/usr/local/bin"}, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8000", "-d", str(E / "web/dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

def metinler(liste):
    urllib.request.urlopen(urllib.request.Request("http://localhost:8787/__sahte_metinler", data=json.dumps(liste).encode(), method="POST")).read()

# Telefon sesini taklit et: her cümleyi kaydet, ~250 ms'de bitir (window.__ttsMs ile yavaşlatılabilir)
SES_TAKLIT = """
window.__soylenen = []; window.__ttsMs = 250; window.__iptal = 0;
(() => { const SS = window.speechSynthesis; let aktif = null, saat = null;
  SS.speak = (u) => { if (!u.text || !u.text.trim()) { setTimeout(() => u.onend && u.onend(), 0); return; }
    window.__soylenen.push(u.text); aktif = u; saat = setTimeout(() => { aktif = null; u.onend && u.onend(); }, window.__ttsMs); };
  SS.cancel = () => { window.__iptal++; clearTimeout(saat); if (aktif) { const u = aktif; aktif = null; u.onend && u.onend(); } };
  Object.defineProperty(SS, 'speaking', { get: () => !!aktif });
})();
"""
# Tarayıcının konuşma tanıması taklidi (sunucusuz yol): window.__srMetinler sırayla "duyulur"
SR_TAKLIT = """
window.__srMetinler = []; window.__srBaslat = 0;
window.webkitSpeechRecognition = function () {
  const r = this; let durdu = false;
  r.start = () => { window.__srBaslat++; const m = window.__srMetinler.shift();
    setTimeout(() => { if (durdu) return; if (m === undefined) return; r.onspeechstart && r.onspeechstart();
      const parca = (fin) => ({ results: Object.assign([Object.assign([{ transcript: fin ? m : m.split(' ')[0] }], { isFinal: fin })], {}) });
      r.onresult && r.onresult(parca(false));
      setTimeout(() => { if (durdu) return; r.onresult && r.onresult(parca(true)); r.onend && r.onend(); }, 250); }, 300); };
  r.stop = () => {}; r.abort = () => { durdu = true; };
};
window.SpeechRecognition = window.webkitSpeechRecognition; // yeni Chrome önekli olmayanı da sunar
"""
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)

def soylenen(pg): return pg.evaluate("window.__soylenen.join(' ¦ ')")
def bekle_soylenen(pg, parca, sn=20):
    try: pg.wait_for_function(f"window.__soylenen.some(t => t.includes({json.dumps(parca)}))", timeout=sn * 1000)
    except Exception:
        print("    okunanlar:", soylenen(pg)[-400:], "| durum:", pg.evaluate("(document.querySelector('.sesli')||{}).className")); raise

try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", f"--use-file-for-fake-audio-capture={WAV}", "--autoplay-policy=no-user-gesture-required"])
        URL = "http://localhost:8000/kapida.html?sunucu=http://localhost:8787&rol=ham"

        def yeni_sayfa(ek="", izin=True):
            ctx = br.new_context(viewport={"width": 1280, "height": 1000}, permissions=["microphone"] if izin else [])
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.add_init_script(SES_TAKLIT + ek)
            return pg, errs

        print("A) Sunucu + Whisper + VAD")
        metinler(["Annemin topuğunda yara var gari, akıntı yapıyo", "Bir haftadır, kötüleşiyo"])
        pg, errs = yeni_sayfa(); p = pg.locator("#pScreen")
        pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        check(p.get_by_role("button", name="Sesli asistanla konuş").count() == 1, "ana ekranda 'Sesli asistanla konuş' düğmesi")
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        check(p.locator(".sesli #svOrb").count() == 1 and "Yazıya dön" in p.inner_text(), "sesli mod açıldı: küre, durum, yazıya dön")
        bekle_soylenen(pg, "Seni dinliyorum")
        check(True, "karşılama sesli okundu")
        pg.wait_for_function("document.querySelector('#svDurum') && document.querySelector('#svDurum').innerText.includes('Dinliyorum')", timeout=5000)
        check(True, "karşılamadan sonra kendiliğinden dinlemeye geçti")
        seviye = pg.evaluate("""() => new Promise(res => { let m = 0; const t0 = Date.now(); const i = setInterval(() => {
            const v = +getComputedStyle(document.querySelector('#svOrb')).getPropertyValue('--sv') || 0; m = Math.max(m, v);
            if (Date.now() - t0 > 4000) { clearInterval(i); res(m); } }, 50); })""")
        check(seviye > 0.05, f"küre mikrofon sesine göre büyüyüp küçülüyor (en yüksek {seviye:.2f})")
        bekle_soylenen(pg, "ne zamandır", 25)
        check("Annemin topuğunda yara var gari" in p.inner_text() or "topuğunda" in pg.evaluate("JSON.stringify(document.querySelector('#pScreen').innerText)"), "konuşma bitince kendiliğinden yazıya çevrilip gönderildi (VAD + Whisper)")
        check("Anladığım:" in p.inner_text(), "'Anladığım' satırı sesli modda da görünüyor")
        bekle_soylenen(pg, "planı ya da reçetesi", 25)
        check(True, "ikinci tur da el değmeden: dinledi → çevirdi → yanıtı okudu")
        # Hızlı yanıt çipine dokun → dinleme kesilir, metin gider → rapor
        pg.wait_for_selector(".sesli [data-quick]", timeout=8000)
        p.locator(".sesli [data-quick]").first.click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=15000)
        bekle_soylenen(pg, "Anlattıklarını özetledim", 10)
        check(p.locator(".sesli").count() == 0, "3. yanıttan sonra özet ekranı açıldı, kapanış cümlesi okundu, sesli mod kapandı")
        t = p.inner_text()
        check("Topuk" in t or "topuğ" in t, "rapor sesli konuşmadan oluştu")
        p.locator("[data-act=chat]").first.click()
        t = p.inner_text()
        check("Annemin topuğunda yara var gari" in t and "Bir haftadır" in t and p.locator("#pInput").count() == 1, "konuşmanın yazısı sohbette duruyor; yazarak devam edilebilir")
        n = pg.evaluate("window.__soylenen.length")
        check(n >= 4 and not any(len(x) > 180 for x in pg.evaluate("window.__soylenen")), f"tüm cümleler 180 karakterden kısa parçalarla okundu ({n} parça)")
        check(not errs, f"sayfa hatası yok {errs}")

        print("B) Acil durum sesle")
        metinler(["Babamın göğsünde baskı var, terliyor"])
        pg, errs = yeni_sayfa(); p = pg.locator("#pScreen")
        pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('112')", timeout=25000)
        bekle_soylenen(pg, "bir bir iki", 5)
        check("bir bir iki" in soylenen(pg) and p.locator(".sesli").count() == 0, "kural motoru acili yakaladı, uyarı sesli okundu ('bir bir iki'), dinleme durdu")
        time.sleep(1.5)
        check(pg.evaluate("fetch('http://localhost:8787/__ses_sayisi').then(r => r.json()).then(v => v.kalan)") == 0, "acil sonrası yeni kayıt gönderilmedi")

        print("C) Sözünü kesme, duraklatma, yazıya dönüş, uydurma çıktı")
        metinler(["Altyazı M.K.", "Kendim için"])
        pg, errs = yeni_sayfa(); p = pg.locator("#pScreen")
        pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        pg.evaluate("window.__ttsMs = 4000")
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        pg.wait_for_function("document.querySelector('.sesli.durum-konusuyor')", timeout=5000)
        iptal0 = pg.evaluate("window.__iptal")
        pg.click("#svOrb", force=True)  # küre sürekli canlandığı için kararlılık beklenmez
        pg.wait_for_function("document.querySelector('.sesli.durum-dinliyor')", timeout=3000)
        check(pg.evaluate("window.__iptal") > iptal0, "konuşurken küreye dokununca sözü kesildi, dinlemeye geçti")
        pg.evaluate("window.__ttsMs = 250")
        bekle_soylenen(pg, "tam duyamadım", 25)
        check("Altyazı" not in p.inner_text(), "Whisper'ın sessizlik uydurması ('Altyazı M.K.') gönderilmedi, tekrar istendi")
        p.get_by_role("button", name="Mikrofonu kapat").click()
        check(p.locator(".sesli.durum-beklemede").count() == 1 and "Mikrofonu aç" in p.inner_text(), "mikrofonu kapat: beklemede")
        p.get_by_role("button", name="Mikrofonu aç").click()
        pg.wait_for_function("document.querySelector('.sesli.durum-dinliyor, .sesli.durum-isleniyor, .sesli.durum-dusunuyor')", timeout=3000)
        check(True, "mikrofonu aç: yeniden dinliyor")
        pg.wait_for_function("[...document.querySelectorAll('#pScreen .sv-son')].some(e => e.innerText.includes('Kendim için'))", timeout=25000)
        bekle_soylenen(pg, "Geçmiş olsun", 15)
        check(True, "duraklatma sonrası konuşma alındı")
        p.locator("[data-sv=kapat]").click()
        check(p.locator(".sesli").count() == 0 and p.locator("#pInput").count() == 1 and p.locator("[data-act=sesliac]").count() == 1, "yazıya dön: normal sohbet, başlıkta sesli asistan düğmesi")
        p.locator("[data-act=sesliac]").click()
        bekle_soylenen(pg, "Sesli moddayız", 5)
        check(p.locator(".sesli").count() == 1, "sohbetin ortasından sesli moda tekrar geçildi")
        p.locator("[data-sv=kapat]").click(); p.locator("[data-act=home]").first.click()
        check(not errs, f"sayfa hatası yok {errs}")

        print("D) Mikrofon izni yok")
        pg, errs = yeni_sayfa("navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), {name: 'NotAllowedError'}));"); p = pg.locator("#pScreen")
        pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Mikrofon izni yok')", timeout=5000)
        check(p.locator(".sesli.durum-beklemede").count() == 1, "izin yoksa açıklama gösterildi, sesli mod beklemede; yazıya dönülebilir")

        print("E) Sunucusuz demo: tarayıcının konuşma tanıması")
        pg, errs = yeni_sayfa(SR_TAKLIT); p = pg.locator("#pScreen")
        pg.goto("http://localhost:8000/kapida.html?rol=ham"); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
        pg.evaluate("window.__srMetinler = ['Annemin sırtında yara var pansuman lazım', 'Annem için, 70 yaşında', 'Birkaç gündür', 'Evet reçete var', 'Yatağa bağımlı']")
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=40000)
        bekle_soylenen(pg, "Anlattıklarını özetledim", 10); t = soylenen(pg)
        check(pg.evaluate("window.__srBaslat") >= 5 and "Anlattıklarını özetledim" in t, "demo modunda tüm sorular sesle soruldu ve sesle yanıtlandı, rapora geçildi")
        p.locator("[data-act=chat]").first.click()
        check("Annemin sırtında yara var" in p.inner_text() and "Yatağa bağımlı" in p.inner_text(), "tarayıcının tanıdığı cümleler sohbette")
        check(not errs, f"sayfa hatası yok {errs}")

        print("F) Ekran görüntüsü")
        metinler(["Babam için, dizinde şişlik var"])
        pg, errs = yeni_sayfa(); p = pg.locator("#pScreen")
        pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        bekle_soylenen(pg, "ne zamandır", 25); pg.evaluate("window.__ttsMs = 60000")
        pg.wait_for_function("document.querySelector('.sesli.durum-konusuyor')", timeout=5000)
        pg.locator("#colP").screenshot(path=str(E / "web/dist/sesli_asistan.png"))
        br.close()
finally:
    srv.terminate(); web.terminate()
print(f"Tamam: {ok} kontrol geçti.")
