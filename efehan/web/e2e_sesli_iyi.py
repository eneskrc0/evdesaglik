"""Sesli/yazılı asistanın 22.11 iyileştirmeleri — gerçek tarayıcı + taklit YZ sunucusu.

- "Aktarıyorum" derse gerçekten aktarır (özet ekranı); aktarmayacaksa bunu söylemez
- "Direkt doktora yönlendir" şikâyet duyulmadan gelirse önce bir kez ne olduğunu sorar, sonra soru sormadan aktarır
- Küfür/hakarete karşılık vermez (YZ'ye gitmez, rapora girmez); küfürlü ama sağlık bilgili mesaj küfürsüz iletilir
- Gündelik sorular ("nasılsın", "sen kimsin", "ne yapabilirsin", "teşekkürler") yerel ve kısa cevaplanır
- Soru sınırına gelince son söz soru değil, aktarım cümlesidir

Çalıştır:  python web/build_web.py && python web/e2e_sesli_iyi.py
"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

E = Path(__file__).resolve().parents[1]
ok = 0


def check(c, m):
    global ok
    if not c:
        print("HATA:", m); sys.exit(1)
    ok += 1; print("✓", m)


def post(yol, veri=None):
    r = urllib.request.Request("http://localhost:8787" + yol, data=json.dumps(veri).encode() if veri is not None else None,
                               method="POST" if veri is not None else "GET")
    return json.loads(urllib.request.urlopen(r).read() or b"{}")


RAPOR = {"kim_icin": "Babası", "yas_araligi": "belirtilmedi", "sikayet": "Dizde şişlik", "hastanin_kendi_sozleri": "dizi şişti",
         "baslangic": "iki gündür", "seyir": "belirtilmedi", "siddet_beyani": "belirtilmedi", "yataga_bagimli": None, "hekim_plani": "bilinmiyor",
         "plan_detayi": "", "kronik_ilac_alerji": "belirtilmedi", "ihtiyaclar": [], "malzeme": [], "foto_ozeti": "", "hizmet_onerisi": "ev_muayene",
         "oneri_gerekcesi": "", "saglikci_icin_ozet": "Test.", "hasta_icin_ozet": "Test özeti.", "dikkat_edilecekler": [], "eksik_bilgiler": [],
         "guvenlik_notlari": [], "istenen_meslek": "", "tek_satir": "Test"}
S = lambda reply, **k: {"reply": reply, "quick_replies": [], "anlasilan": "", "ready": False, **k}

srv = subprocess.Popen(["node", str(E / "sunucu/yerel_sunucu.mjs")], env={"SAHTE": "1", "PATH": "/usr/bin:/bin:/usr/local/bin", "PORT": "8787"}, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8000", "-d", str(E / "web/dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
URL = "http://localhost:8000/kapida.html?sunucu=http://localhost:8787&rol=ham"
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = br.new_page(viewport={"width": 1100, "height": 1000}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        p = pg.locator("#pScreen")
        durum = lambda: pg.evaluate("KapidaTest.durum()")

        def sakin():
            t0 = time.time()
            while time.time() - t0 < 20:
                d = durum()
                if not d["mesgul"] and d["ekran"] != "building":
                    time.sleep(0.25); d2 = durum()
                    if not d2["mesgul"] and d2["ekran"] != "building": return d2
                time.sleep(0.1)
            return durum()

        def bastan(sohbet=None):
            post("/__sahte_sohbet", {"sohbet": sohbet or [], "rapor": RAPOR})
            pg.goto(URL); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Yapay zekâ açık')", timeout=10000)
            p.locator("[data-act=start]").click(); pg.wait_for_selector("#pInput")

        def yaz(t):
            p.locator("#pInput").fill(t); p.locator("#pInput").press("Enter"); time.sleep(0.15)
            d = sakin()
            ai = [m["metin"] for m in d["mesajlar"] if m["kim"] == "ai"]
            return d, (ai[-1] if ai else "")

        # 1) Küfür: karşılık yok, YZ'ye gitmez
        bastan()
        for kufur in ["salak", "Aptal mısın sen?", "mal", "geri zekalı"]:
            d, son = yaz(kufur)
            check(son.startswith("Bu tür sözlere yanıt vermiyorum") and d["ekran"] == "chat", f"'{kufur}' → karşılık verilmedi: '{son[:60]}…'")
            check(not any(w in son.lower() for w in ["salak", "aptal", "zekalı", " mal "]), "  kaba kelime tekrarlanmadı")
        check(post("/__sahte_sayac")["sohbet"] == 0, "küfürler yapay zekâya gönderilmedi")

        # 2) Gündelik sorular: yerel kısa cevap
        for soru, beklenen in [("nasılsın", "İyiyim"), ("Merhaba, nasılsın?", "İyiyim"), ("sen kimsin", "yapay zekâ asistanıyım"),
                               ("ne yapabilirsin", "sağlık çalışanı çağırmana"), ("teşekkürler", "Rica ederim"), ("yapay zeka mısın", "yapay zekâ asistanıyım")]:
            d, son = yaz(soru)
            check(beklenen in son and "?" in son, f"'{soru}' → '{son[:70]}…'")
        check(post("/__sahte_sayac")["sohbet"] == 0, "gündelik sorular yapay zekâya gitmedi, soru hakkı harcanmadı")

        # 3) Küfürlü ama sağlık bilgili mesaj: küfür çıkarılıp iletilir
        bastan([S("Geçmiş olsun. Şişlik ne zamandır var?")])
        d, son = yaz("babamın bacağı şişti salak şey")
        giden = post("/__sahte_sayac")["son"]["sohbet"]["turlar"][-1]["content"]
        check(son.startswith("Geçmiş olsun") and "salak" not in giden and "bacağı şişti" in giden, f"küfürsüz iletildi: '{giden}'")

        # 4) Şikâyet duyulmadan "direkt doktora yönlendir": önce bir kez sorar
        bastan()
        d, son = yaz("direkt doktora yönlendir")
        check(d["ekran"] == "chat" and "aktaracağım" in son and "ne olduğunu" in son, f"önce şikâyeti soruyor: '{son}'")
        d, son = yaz("babamın dizi şişti, iki gündür")
        check(d["ekran"] == "summary", "şikâyeti duyunca soru sormadan özet ekranına aktardı")
        check(post("/__sahte_sayac")["sohbet"] == 0, "kısa yolda yapay zekâ soru sormadı")
        check("aktarıyorum" in son.lower(), f"aktarım cümlesi söylendi: '{son}'")

        # 4b) "Annem hasta, doktor istiyorum": "hasta" tek başına şikâyet değil
        bastan()
        d, son = yaz("annem hasta doktor istiyorum")
        check(d["ekran"] == "chat" and "ne olduğunu" in son, "'annem hasta doktor istiyorum' → önce ne olduğu soruldu")
        d, son = yaz("bilmiyorum, ateşi var gibi")
        check(d["ekran"] == "summary", "ikinci mesajda (ne olursa olsun) aktarıldı")

        # 4c) Şikâyetle birlikte gelen istek doğrudan aktarılır
        bastan()
        d, son = yaz("direkt doktora yönlendir, annemin yarası kanıyor biraz")
        check(d["ekran"] == "summary", "şikâyet aynı cümlede söylendiyse beklemeden aktarıldı")

        # 4d) Meslek isteği: odyolog
        bastan()
        d, son = yaz("direkt odyologa yönlendir")
        check(d["ekran"] == "chat" and "odyologa aktaracağım" in son.lower(), f"meslek isteğinde de önce soruldu: '{son}'")

        # 5) YZ "aktarıyorum" derse aktarır (ready=false gelse de)
        bastan([S("Anladım, bilgileri doktora aktarıyorum.")])
        d, son = yaz("babamın dizi şişti, iki gündür yürüyemiyor")
        check(d["ekran"] == "summary", "YZ 'aktarıyorum' dedi → özet ekranına geçildi")

        # 6) YZ "aktarıyorum" dese de şikâyet yoksa aktarmaz ve bunu söylemez
        bastan([S("Tamam, sizi doktora aktarıyorum.")])
        d, son = yaz("annem için")
        check(d["ekran"] == "chat" and "aktarıyorum" not in son.lower() and "?" in son, f"şikâyet yokken aktarım cümlesi yerine soru: '{son}'")

        # 7) Soru sınırı: son söz soru değil, aktarım
        bastan([S("Geçmiş olsun. Ne zamandır var?"), S("Kötüleşiyor mu?"), S("Ateşi var mı?"), S("Peki kaç yaşında?")])
        for t in ["annemin bacağında yara var", "bir haftadır", "evet kötüleşiyor", "ateşi yok"]:
            d, son = yaz(t)
        check(d["ekran"] == "summary", "3 sorudan sonra özete geçildi")
        check("?" not in son and "aktarıyorum" in son.lower(), f"son söz aktarım: '{son}'")

        # 8) YZ ready=true ama soru cümlesiyle: soru söylenmez
        bastan([S("Anladım. Doktorun planı var mı?", ready=True)])
        d, son = yaz("babamın bacağında yara var iki gündür")
        check(d["ekran"] == "summary" and "?" not in son, f"hazır yanıtta soru yerine kapanış: '{son}'")

        # 9) Gündelik soruyu YZ cevaplarsa (konu=gundelik) soru hakkından sayılmaz
        bastan([S("Havayı göremiyorum ama umarım güzeldir. Sana nasıl yardımcı olabilirim?", konu="gundelik"),
                S("Geçmiş olsun. Ne zamandır?"), S("Kötüleşiyor mu?"), S("Ateşi var mı?"), S("Teşekkürler, iletiyorum.", ready=True)])
        yaz("bugün hava nasıl")
        for t in ["annemin bacağında yara var", "bir haftadır", "evet kötüleşiyor"]:
            d, son = yaz(t)
        check(d["ekran"] == "chat", "gündelik soru sayılmadı: 3 sağlık cevabından sonra hâlâ sohbet")
        d, son = yaz("ateşi yok")
        check(d["ekran"] == "summary", "dördüncü sağlık mesajında özet")

        check(not errs, f"sayfa hatası yok {errs}")
        br.close()
finally:
    srv.terminate(); web.terminate()
print(f"Tamam: {ok} kontrol geçti.")
