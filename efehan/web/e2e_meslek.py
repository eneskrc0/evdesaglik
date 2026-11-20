"""Meslek isteği provası: "hemşire çağırmak istiyorum" + "soruları geç" artık doktora değil hemşireye gider;
plan varsa yalnızca istenen meslek listelenir, plan yoksa yönetmeliğe uygun seçenek ve açıklama gelir.
Çalıştır: python web/e2e_meslek.py"""
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
    pg = br.new_page(viewport={"width": 1100, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    p = pg.locator("#pScreen")

    def bastan(metin):
        pg.goto(PAGE); pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
        p.locator("[data-act=start]").click()
        p.locator("#pInput").fill(metin); p.locator("#pInput").press("Enter")
        pg.wait_for_timeout(300)

    def meslekler():
        return [x.split(" · ")[0].strip() for x in pg.eval_on_selector_all("#pScreen .opt .avatar + div .tiny.muted", "els => els.map(e => e.textContent)")]

    def secenekler(plan):
        p.locator(f"[data-plan={plan}]").first.click()
        p.locator("[data-act=options]").click()
        return p.inner_text()

    # 1) Demo hatası: hemşire isteyip "soruları geç" → doktor çıkıyordu
    bastan("Hemşire çağırmak istiyorum")
    btn = p.locator("[data-act=skipdoc]")
    check("hemşireye yönlendir" in btn.inner_text(), "atla düğmesi istenen mesleği söylüyor: 'Soruları geç, hemşireye yönlendir'")
    btn.click()
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=8000)
    check("İstediğin sağlık çalışanı: Hemşire" in p.inner_text(), "özet ekranı hemşire isteğini gösteriyor")
    t = secenekler("var")
    m = meslekler()
    check(m and all(x == "Hemşire" for x in m), f"plan varken yalnızca hemşireler listeleniyor ({len(m)} kişi)")
    check("Doktor" not in " ".join(m) and "Hekim" not in " ".join(m), "doktor adayı çıkmıyor")
    check(p.locator("[data-hizmet]").count() >= 5 and "Hemşireden ne istiyorsun?" in t, "hemşire hizmet seçici var (iğne, pansuman, serum…)")
    p.locator("[data-hizmet=iv_serum]").click()
    check("Serum takma" in p.locator(".levelcard").inner_text() and all(x == "Hemşire" for x in meslekler()), "serum seçilince hizmet değişti, liste yine hemşire")

    # plan yoksa: hemşire evde + doktor videoda
    p.locator("[data-act=summary]").first.click()
    t = secenekler("yok")
    check("Hemşire evine gelir, doktor görüntülü bağlanır" in t and "doktor da aynı anda görüntülü" in t, "plan yokken hemşire evde + doktor videoda (yasal yol) ve açıklama")
    check(all(x == "Hemşire" for x in meslekler()), "plan yokken de gelen kişi hemşire")
    p.locator("[data-plan=var][data-yenile]").click()
    check(p.locator("[data-hizmet]").count() >= 5, "'Doktorumun planı var' ile doğrudan hemşire seçeneklerine geçiliyor")

    # 2) Ağızla yazılmış istek: "fizik tedavici" → fizyoterapist
    bastan("babam için fizik tedavici lazım")
    check("fizyoterapiste yönlendir" in p.locator("[data-act=skipdoc]").inner_text(), "'fizik tedavici' fizyoterapist olarak anlaşıldı")
    p.locator("[data-act=skipdoc]").click()
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=8000)
    secenekler("var")
    m = meslekler()
    check(m and all(x == "Fizyoterapist" for x in m), f"plan varken yalnızca fizyoterapistler ({len(m)} kişi)")
    p.locator("[data-act=summary]").first.click()
    t = secenekler("yok")
    check("yalnızca doktorun planıyla gelebilir" in t and "Önce doktorla görüntülü görüş" in t, "plan yokken önce doktor (yönetmelik) ve nedeni açıklanıyor")

    # 3) Yazarak doğrudan yönlendirme: "direkt odyologa yönlendir"
    bastan("direkt odyologa yönlendir")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=8000)
    secenekler("var")
    m = meslekler()
    check(m and all(x == "Odyolog" for x in m), f"'direkt odyologa yönlendir' → yalnızca odyologlar ({len(m)} kişi)")

    # 4) Doktor isteği eskisi gibi çalışıyor
    bastan("direkt doktora yönlendir")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=8000)
    secenekler("bilinmiyor")
    m = meslekler()
    check(m and all(x in ("Hekim", "Uzman hekim") or x.startswith("Hekim") for x in m), f"doktor isteğinde yalnızca hekimler ({set(m)})")

    # 5) Ebe: lohusa
    bastan("ebe hanım gelsin lohusayım")
    p.locator("[data-act=skipdoc]").click()
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Seni doğru anladık mı?')", timeout=8000)
    t = secenekler("var")
    m = meslekler()
    check(m and all(x == "Ebe" for x in m) and "Doğum sonrası" in t, f"ebe isteği → doğum sonrası izlem, yalnızca ebeler ({len(m)} kişi)")

    pg.locator("#colP").screenshot(path=str(Path(__file__).resolve().parent / "dist" / "meslek_ebe.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"Tamam: {ok} kontrol geçti.")
