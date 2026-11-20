"""Sesli sohbet kataloğu — AKIŞ katmanı (kapida.js, gerçek tarayıcı, taklit YZ sunucusu).

Her senaryoda YZ'nin sohbet/rapor cevapları senaryoda yazılıdır (taklit); istemcinin kural motoru, ara laf, kısa yol,
soru sınırı, rapor kapısı, hata ve gecikme davranışı gerçek kodla çalışır. Sesli mod aynı send() yolunu kullanır
(sesli.js → sesliGonder → send); ses katmanı ayrıca node web/test_sesli.mjs ve web/e2e_sesli.py ile denenir.

Çalıştır:  python web/build_web.py && python web/e2e_senaryo.py [ID ...]
           python web/e2e_senaryo.py --ses    → aynı senaryolar SESLİ modda: sahte mikrofon (sentetik dalgalı ton, insan sesi
             DEĞİL) + gerçek VAD + MediaRecorder + /ses; Whisper çevirisi senaryo cümleleriyle taklit edilir. Yalnızca düz metin
             adımlı senaryolar çalışır.
Çıktı: data/eval/sonuc/akis_gelistirme.json (--ses: akis_ses.json)
"""
import json, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

E = Path(__file__).resolve().parents[1]
KAT = [k for k in json.loads((E / "data/eval/sesli_senaryolar.json").read_text(encoding="utf-8")) if k["katman"] == "akis"]
SEC = [a for a in sys.argv[1:] if not a.startswith("-")]
SES = "--ses" in sys.argv
if SES:
    KAT = [k for k in KAT if all(isinstance(a, str) for a in k["girdi"])]
    TMP = Path(tempfile.mkdtemp()); WAV = TMP / "konusma.wav"
    ff = lambda *a: subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)
    ff("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "1.2", str(TMP / "s1.wav"))
    ff("-f", "lavfi", "-i", "sine=f=230:r=48000:d=1.6", "-af", "tremolo=f=4:d=0.7,volume=0.5", "-ac", "1", str(TMP / "t.wav"))
    ff("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "2.4", str(TMP / "s2.wav"))
    ff("-i", str(TMP / "s1.wav"), "-i", str(TMP / "t.wav"), "-i", str(TMP / "s2.wav"), "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(WAV))
SES_TAKLIT = """
window.__soylenen = [];
(() => { const SS = window.speechSynthesis; let aktif = null, saat = null;
  SS.speak = (u) => { if (!u.text || !u.text.trim()) { setTimeout(() => u.onend && u.onend(), 0); return; }
    window.__soylenen.push(u.text); aktif = u; saat = setTimeout(() => { aktif = null; u.onend && u.onend(); }, 200); };
  SS.cancel = () => { clearTimeout(saat); if (aktif) { const u = aktif; aktif = null; u.onend && u.onend(); } };
  Object.defineProperty(SS, 'speaking', { get: () => !!aktif });
})();"""
if SEC:
    KAT = [k for k in KAT if k["id"] in SEC or k["id"].split("-", 1)[1] in SEC]


def post(yol, veri=None):
    r = urllib.request.Request("http://localhost:8787" + yol, data=json.dumps(veri).encode() if veri is not None else None,
                               method="POST" if veri is not None else "GET")
    return json.loads(urllib.request.urlopen(r).read() or b"{}")


def varsayilan_rapor(k):
    m = [a for a in k["girdi"] if isinstance(a, str)] + [a.get("cift") or a.get("hemen") for a in k["girdi"] if isinstance(a, dict) and ("cift" in a or "hemen" in a)]
    return {"kim_icin": "belirtilmedi", "yas_araligi": "belirtilmedi", "sikayet": (m[0] if m else "belirtilmedi")[:80],
            "hastanin_kendi_sozleri": ". ".join(m)[:200], "baslangic": "belirtilmedi", "seyir": "belirtilmedi",
            "siddet_beyani": "belirtilmedi", "yataga_bagimli": None, "hekim_plani": "bilinmiyor", "plan_detayi": "",
            "kronik_ilac_alerji": "belirtilmedi", "ihtiyaclar": [], "malzeme": [], "foto_ozeti": "", "hizmet_onerisi": "ev_muayene",
            "oneri_gerekcesi": "", "saglikci_icin_ozet": "Sentetik test özeti.", "hasta_icin_ozet": "Sentetik test özeti.",
            "dikkat_edilecekler": [], "eksik_bilgiler": [], "guvenlik_notlari": [], "istenen_meslek": "", "tek_satir": "Sentetik"}


srv = subprocess.Popen(["node", str(E / "sunucu/yerel_sunucu.mjs")], env={"SAHTE": "1", "PATH": "/usr/bin:/bin:/usr/local/bin"}, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8000", "-d", str(E / "web/dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
URL = "http://localhost:8000/kapida.html?sunucu=http://localhost:8787&rol=ham"
sonuc = []
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"] + (["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", f"--use-file-for-fake-audio-capture={WAV}", "--autoplay-policy=no-user-gesture-required"] if SES else []))
        for k in KAT:
            ctx = br.new_context(viewport={"width": 1100, "height": 1000}, permissions=["microphone"] if SES else [])
            pg = ctx.new_page(); errs = []
            if SES: pg.add_init_script(SES_TAKLIT)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            p = pg.locator("#pScreen")
            durum = lambda: pg.evaluate("KapidaTest.durum()")

            def sakin(sn=75):
                t0 = time.time()
                while time.time() - t0 < sn:
                    d = durum()
                    if not d["mesgul"] and d["ekran"] != "building":
                        time.sleep(0.25)
                        d2 = durum()
                        if not d2["mesgul"] and d2["ekran"] != "building":
                            return d2
                    time.sleep(0.1)
                return durum()

            def yaz(metin, bekleme=True):
                if durum()["ekran"] != "chat":
                    return False
                p.locator("#pInput").fill(metin); p.locator("#pInput").press("Enter")
                if bekleme:
                    time.sleep(0.15); sakin()
                return True

            post("/__sahte_sohbet", {"sohbet": k.get("llm") or [], "rapor": k.get("rapor") or varsayilan_rapor(k)})
            t0 = time.time(); notlar = []
            pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=10000)
            if SES:
                metinler = [a for a in k["girdi"]]
                post("/__sahte_metinler", metinler)
                p.get_by_role("button", name="Sesli asistanla konuş").click()
                t1 = time.time()
                while time.time() - t1 < 15 + 9 * len(metinler):  # her cümle ≈ 5-6 sn (sessizlik + ton + VAD sonu)
                    kalan = post("/__ses_sayisi")["kalan"]
                    d = durum()
                    sv = pg.evaluate("(document.querySelector('.sesli')||{}).className || ''")
                    if d["ekran"] not in ("chat", "building") or (kalan == 0 and not d["mesgul"] and ("durum-dinliyor" in sv or "durum-beklemede" in sv or not sv)):
                        break
                    time.sleep(0.3)
                time.sleep(1.0)
                if post("/__ses_sayisi")["kalan"]:
                    notlar.append(f"{post('/__ses_sayisi')['kalan']} cümle sesle gönderilemedi")
            else:
                p.locator("[data-act=start]").click()
            for a in ([] if SES else k["girdi"]):
              try:
                if isinstance(a, str):
                    if not yaz(a):
                        notlar.append(f"'{a}' gönderilemedi (ekran {durum()['ekran']})")
                elif "cift" in a:
                    p.locator("#pInput").fill(a["cift"]); p.locator("#pInput").press("Enter")
                    p.locator("#pInput").fill(a["cift"]); p.locator("#pInput").press("Enter")
                    time.sleep(0.15); sakin()
                elif "hemen" in a:  # cevabı beklemeden sonraki adıma geç (geç gelen cevap)
                    yaz(a["hemen"], bekleme=False); time.sleep(0.2)
                elif "yeni_sohbet" in a:
                    if p.locator("[data-act=chat]").count(): p.locator("[data-act=chat]").first.click()
                    p.locator("[data-act=home]").first.click(); p.locator("[data-act=start]").click()
                elif "plan" in a:
                    p.locator(f"[data-plan={a['plan']}]").first.click(timeout=4000)
                elif "bekle" in a:
                    time.sleep(a["bekle"] / 1000)
              except Exception as e:
                notlar.append(f"adım {a!r} yapılamadı: {str(e).splitlines()[0][:80]}")
            d = sakin(); sure = time.time() - t0
            say = post("/__sahte_sayac")
            ai = [m["metin"] for m in d["mesajlar"] if m["kim"] == "ai"]
            son_ai = ai[-1] if ai else ""
            me = [m for m in d["mesajlar"] if m["kim"] == "me"]
            rapor = json.dumps(d["rapor"], ensure_ascii=False) if d["rapor"] else ""
            ekran_metni = p.inner_text()
            b = k["beklenen"]; h = []
            if "ekran" in b and d["ekran"] != b["ekran"]: h.append(f"ekran {d['ekran']} (beklenen {b['ekran']})")
            if "yz_cagri" in b and say["sohbet"] != b["yz_cagri"]: h.append(f"YZ çağrısı {say['sohbet']} (beklenen {b['yz_cagri']})")
            if "son_ai_icerir" in b and b["son_ai_icerir"].lower() not in son_ai.lower(): h.append(f"son asistan mesajında '{b['son_ai_icerir']}' yok: {son_ai[:90]!r}")
            if "son_ai_icermez" in b and b["son_ai_icermez"].lower() in son_ai.lower(): h.append(f"son asistan mesajında '{b['son_ai_icermez']}' var")
            if "ozet_icerir" in b and b["ozet_icerir"] not in ekran_metni: h.append(f"özette '{b['ozet_icerir']}' yok")
            if "ozet_icermez" in b and b["ozet_icermez"] in ekran_metni: h.append(f"özette '{b['ozet_icermez']}' var")
            if "plan" in b and d["plan"] != b["plan"]: h.append(f"plan {d['plan']} (beklenen {b['plan']})")
            if "mesaj_sayisi" in b and len(me) != b["mesaj_sayisi"]: h.append(f"kullanıcı mesajı {len(me)} (beklenen {b['mesaj_sayisi']})")
            if "mesaj_yok" in b and any(b["mesaj_yok"] in m["metin"] for m in d["mesajlar"]): h.append(f"'{b['mesaj_yok']}' sohbete karıştı")
            if "rapor_metni_icermez" in b and b["rapor_metni_icermez"].lower() in rapor.lower(): h.append(f"raporda '{b['rapor_metni_icermez']}' var")
            for alan, v in (b.get("rapor_alan") or {}).items():
                if not d["rapor"] or d["rapor"].get(alan) != v: h.append(f"rapor.{alan} = {(d['rapor'] or {}).get(alan)!r} (beklenen {v!r})")
            if "sure_sn" in b and sure > b["sure_sn"]: h.append(f"süre {sure:.0f} sn (sınır {b['sure_sn']})")
            if errs: h.append("sayfa hatası: " + errs[0][:120])
            h += notlar
            uzman = bool(b.get("uzman"))
            s = {"id": k["id"], "kategori": k["kategori"], "onem": k["onem"], "uzman": uzman, "gecti": not h, "hatalar": h, "sure": round(sure, 1),
                 "yz_cagri": say["sohbet"], "ekran": d["ekran"], "konusma": [(m["kim"], m["metin"]) for m in d["mesajlar"]]}
            sonuc.append(s)
            print(("  ✓ " if not h else ("  ~ " if uzman else "  ✗ ")) + f"{k['id']} [{k['kategori']}/{k['onem']}] {k['beklenen_metin']}" + ("" if not h else "  →  " + "; ".join(h)), flush=True)
            ctx.close()
        br.close()
finally:
    srv.terminate(); web.terminate()

say = sum(s["gecti"] for s in sonuc); uz = sum(1 for s in sonuc if s["uzman"] and not s["gecti"])
print(f"AKIŞ{' (SESLİ)' if SES else ''}: {say}/{len(sonuc)} geçti" + (f" ({uz} uzman değerlendirmesi gereken vaka ölçüldü, sayılmadı)" if uz else ""))
if not SEC:
    (E / "data/eval/sonuc" / ("akis_ses.json" if SES else "akis_gelistirme.json")).write_text(json.dumps(sonuc, ensure_ascii=False, indent=1), encoding="utf-8")
sys.exit(0 if all(s["gecti"] or s["uzman"] for s in sonuc) else 1)
