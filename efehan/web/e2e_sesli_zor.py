"""Sesli asistan — zorlayıcı durumlar (e2e_sesli.py'nin denemediği kenar durumlar).
1) Açılışta mikrofon izni gecikirken hemen 'Yazıya dön' → mikrofon açık kalmamalı
2) Yarım cümlede acil ("Babam nefes alamıyor ve") → devamını beklemeden acil ekranı
3) Yarım cümleden sonra Whisper uydurması → yarım cümle kaybolmamalı
4) Küreye üst üste dokunma → aynı anda iki kayıt olmamalı, sayfa hatası yok
5) Giriş yapılmış hasta telefonunda (#hasta), mobil ekranda sesli mod: taşma yok, küre ekranda
6) Aynı sayfada art arda iki sesli konuşma → ikinci konuşma temiz başlar
Çalıştır: python web/e2e_sesli_zor.py   (ffmpeg ve Chrome gerekir)"""
import json, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

E = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(E / "web"))
TMP = Path(tempfile.mkdtemp())
WAV = TMP / "konusma.wav"
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

SES_TAKLIT = """
window.__soylenen = []; window.__ttsMs = 250; window.__iptal = 0;
(() => { const SS = window.speechSynthesis; let aktif = null, saat = null;
  SS.speak = (u) => { if (!u.text || !u.text.trim()) { setTimeout(() => u.onend && u.onend(), 0); return; }
    window.__soylenen.push(u.text); aktif = u; saat = setTimeout(() => { aktif = null; u.onend && u.onend(); }, window.__ttsMs); };
  SS.cancel = () => { window.__iptal++; clearTimeout(saat); if (aktif) { const u = aktif; aktif = null; u.onend && u.onend(); } };
  Object.defineProperty(SS, 'speaking', { get: () => !!aktif });
})();
// mikrofon akışlarını ve aynı anda süren kayıtları say
window.__akimlar = []; window.__kayitAcik = 0; window.__kayitEnCok = 0;
(() => { const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => { if (window.__gumGecikme) await new Promise(r => setTimeout(r, window.__gumGecikme)); const s = await g(c); window.__akimlar.push(s); return s; };
  const MR = window.MediaRecorder; const st = MR.prototype.start, sp = MR.prototype.stop;
  MR.prototype.start = function (...a) { window.__kayitAcik++; window.__kayitEnCok = Math.max(window.__kayitEnCok, window.__kayitAcik); this.__acik = true; return st.apply(this, a); };
  MR.prototype.stop = function (...a) { if (this.__acik) { this.__acik = false; window.__kayitAcik--; } return sp.apply(this, a); };
})();
"""
ok = 0; kalan = []
def check(c, m):
    global ok
    if not c: kalan.append(m); print("  ✗", m); return
    ok += 1; print("  ✓", m)
def soylenen(pg): return pg.evaluate("window.__soylenen.join(' ¦ ')")
def bekle_soylenen(pg, parca, sn=20):
    try: pg.wait_for_function(f"window.__soylenen.some(t => t.includes({json.dumps(parca)}))", timeout=sn * 1000)
    except Exception:
        print("    okunanlar:", soylenen(pg)[-500:], "| durum:", pg.evaluate("(document.querySelector('.sesli')||{}).className")); raise
canli = "window.__akimlar.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length"

try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", f"--use-file-for-fake-audio-capture={WAV}", "--autoplay-policy=no-user-gesture-required"])
        URL = "http://localhost:8000/kapida.html?sunucu=http://localhost:8787&rol=ham"
        onceki = []
        def yeni_sayfa(url=URL, vp=(1280, 1000), ek=""):
            for c in onceki: c.close()  # önceki sayfa arka planda dinleyip sıradaki metinleri tüketmesin
            onceki.clear()
            ctx = br.new_context(viewport={"width": vp[0], "height": vp[1]}, permissions=["microphone"])
            onceki.append(ctx); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.add_init_script(SES_TAKLIT + ek)
            pg.goto(url); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=8000)
            return pg, errs, pg.locator("#pScreen")

        print("1) İzin gecikirken hemen 'Yazıya dön'")
        pg, errs, p = yeni_sayfa(ek="window.__gumGecikme = 1500;")
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        p.locator("[data-sv=kapat]").click()
        time.sleep(2.5)
        check(pg.evaluate(canli) == 0, f"sesli mod kapandıktan sonra mikrofon açık kalmadı (açık iz: {pg.evaluate(canli)})")
        check(not errs, f"sayfa hatası yok {errs}")

        print("2) Yarım cümlede acil")
        metinler(["Babam nefes alamıyor ve"])
        pg, errs, p = yeni_sayfa()
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        kalan_ = lambda: json.loads(urllib.request.urlopen("http://localhost:8787/__ses_sayisi").read())["kalan"]
        for _ in range(250):
            if kalan_() == 0: break
            time.sleep(0.1)
        t0 = time.time()
        pg.wait_for_function("!document.querySelector('.sesli') && document.querySelector('#pScreen').innerText.includes('112')", timeout=25000, polling=50)
        gecen = time.time() - t0
        check(gecen < 1.5, f"yarım cümledeki acil belirti beklemeden acil ekranını açtı ({gecen:.1f} sn)")

        print("3) Yarım cümle + uydurma çıktı")
        metinler(["Annemin topuğunda yara var ve", "Altyazı M.K.", "akıntı yapıyor"])
        pg, errs, p = yeni_sayfa()
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        bekle_soylenen(pg, "ne zamandır", 45)
        t = pg.evaluate("[...document.querySelectorAll('#pScreen .sv-son')].map(e => e.innerText).join(' ')")
        check("topuğunda yara var ve akıntı yapıyor" in t, f"yarım cümle uydurma çıktıdan sonra kaybolmadı: {t!r}")
        check(not errs, f"sayfa hatası yok {errs}")

        print("4) Küreye üst üste dokunma")
        metinler(["Kendim için", "Dizimde ağrı var", "İki gündür"])
        pg, errs, p = yeni_sayfa()
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        for i in range(14):
            if not pg.locator("#svOrb").count():
                print("    küre kayboldu, ekran:", p.inner_text()[:300].replace("\n", " | ")); break
            pg.click("#svOrb", force=True, timeout=3000); time.sleep(0.23)
        time.sleep(6)
        check(pg.evaluate("window.__kayitEnCok") <= 1, f"aynı anda en çok bir kayıt sürdü ({pg.evaluate('window.__kayitEnCok')})")
        # (sahte Whisper her kısa kayda metin verdiği için hızlı dokunmalar soruları bitirip özete geçirebilir; bu beklenen)
        durum = pg.evaluate("(document.querySelector('.sesli')||{className:'durum-ozet'}).className").split("durum-")[1]
        ozet = "Seni doğru anladık mı?" in p.inner_text()
        check(durum in ("dinliyor", "konusuyor", "isleniyor", "dusunuyor", "beklemede") or ozet, f"dokunma yağmurundan sonra geçerli durum ({durum})")
        check(not errs, f"sayfa hatası yok {errs}")
        if p.locator("[data-sv=kapat]").count(): p.locator("[data-sv=kapat]").click()
        time.sleep(0.8)
        check(pg.evaluate(canli) == 0, "sesli mod bitince mikrofon kapandı")

        print("5) Giriş yapılmış hasta, mobil ekran")
        metinler(["Annemin topuğunda yara var"])
        pg, errs, p = yeni_sayfa("http://localhost:8000/kapida.html?sunucu=http://localhost:8787#hasta", (390, 844))
        btn = p.get_by_role("button", name="Sesli asistanla konuş")
        check(btn.count() == 1, "hasta hesabında 'Sesli asistanla konuş' var")
        btn.click()
        pg.wait_for_selector("#svOrb")
        time.sleep(0.6)
        kutu = pg.locator("#svOrb").bounding_box()
        tasma = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check(tasma <= 1, f"yatay taşma yok ({tasma}px)")
        check(kutu and kutu["y"] >= 0 and kutu["y"] + kutu["height"] <= 844, f"küre ekranın içinde ({kutu})")
        pg.screenshot(path=str(TMP / "mobil_sesli.png"))
        bekle_soylenen(pg, "ne zamandır", 25)
        check(not errs, f"sayfa hatası yok {errs}")

        print("6) Art arda iki konuşma")
        metinler(["Kendim için, dizimde şişlik var", "İki gündür"])
        pg, errs, p = yeni_sayfa()
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        bekle_soylenen(pg, "ne zamandır", 25)
        p.locator("[data-sv=kapat]").click(); p.locator("[data-act=home]").first.click()
        n0 = pg.evaluate("window.__soylenen.length")
        metinler(["Babamın sırtında yara var"])
        p.get_by_role("button", name="Sesli asistanla konuş").click()
        pg.wait_for_function(f"window.__soylenen.length > {n0} && window.__soylenen.slice({n0}).some(t => t.includes('Kapıda asistanı'))", timeout=10000)
        pg.wait_for_function("[...document.querySelectorAll('#pScreen .sv-son')].some(e => e.innerText.includes('sırtında'))", timeout=25000)
        t = pg.evaluate("[...document.querySelectorAll('#pScreen .sv-son')].map(e => e.innerText).join(' ')")
        check("sırtında" in t and "dizimde" not in t, f"ikinci konuşma temiz başladı: {t!r}")
        check(not errs, f"sayfa hatası yok {errs}")
        print("ekran görüntüsü:", TMP / "mobil_sesli.png")
        br.close()
finally:
    srv.terminate(); web.terminate()
if kalan: print(f"HATA: {len(kalan)} kontrol geçmedi, {ok} geçti."); sys.exit(1)
print(f"Tamam: {ok} kontrol geçti.")
