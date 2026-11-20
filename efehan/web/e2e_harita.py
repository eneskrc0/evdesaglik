"""Harita, sokak rotası ve canlı takip provası (demo modu). Çalıştır: python web/e2e_harita.py"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri() + "?rol=ikisi"  # giriş ekranını atla (iki telefon yan yana)
OUT = Path(__file__).resolve().parent / "dist"
ok = 0
def check(c, m):
    global ok
    assert c, m
    ok += 1; print("  ✓", m)
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 980}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(PAGE)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
    check(pg.evaluate("!!window.KAPIDA_HARITA && !!window.KapidaHarita"), "harita verisi ve modülü yüklü")
    # Sokak rotası Dijkstra: matris süresiyle tutarlı mı?
    r = pg.evaluate("""() => { const Y = window.EVDE_DATA.yol, M = window.KapidaHarita.create(window.KAPIDA_HARITA, Y);
      const a = Y.noktalar[0], b = Y.noktalar[150]; const rt = M.rota([a[0],a[1]],[b[0],b[1]]);
      const n = Y.noktalar.length, bin = atob(Y.tt_sn_b64), dv = new DataView(Uint8Array.from(bin, c => c.charCodeAt(0)).buffer);
      return { sokak: rt.sokak, nokta: rt.pts.length, sn: rt.total, matris: dv.getUint16(2 * (0 * n + 150), true), km: rt.km.at(-1) }; }""")
    check(r["sokak"] and r["nokta"] > 20, f"rota gerçek sokaklardan geçiyor ({r['nokta']} nokta, {r['km']:.1f} km)")
    check(abs(r["sn"] - r["matris"]) <= 2, f"sokak rotası süresi Enes'in matrisiyle aynı ({r['sn']:.0f} sn ~ {r['matris']} sn)")
    # Hasta talebi → onay → kabul → canlı takip
    p.locator("[data-tile]").first.click()
    for _ in range(8):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count(): break
        if p.locator("[data-quick]").count(): p.locator("[data-quick]").first.click()
    p.locator("[data-act=options]").click(); pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)"); p.locator("details.klasik [data-pick]").first.click(); p.locator("[data-act=confirm]").click()
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
    h.get_by_role("button", name="Panele git").click()
    if h.locator("[data-act=haccept]").count() == 0:
        h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click()
    check(h.locator(".harita").count() == 1 and "Gerçek sokaklar" in h.inner_text(), "çalışanın 'Rotam' sekmesinde gerçek sokak haritası")
    check(p.locator("#takip .harita").count() == 1, "hastada canlı takip haritası açıldı")
    t1 = p.locator("#takip").inner_text()
    time.sleep(6)
    t2 = p.locator("#takip").inner_text()
    check("CANLI TAKİP" in t2 and t1 != t2, "takip ilerliyor (aşama/kalan süre değişiyor)")
    check("yolda" in t2.lower() or "yaklaşıyor" in t2.lower(), "çalışan yolda görünüyor")
    pg.locator("#colP").screenshot(path=str(OUT / "canli_takip.png"))
    pg.locator("#colH").screenshot(path=str(OUT / "calisan_rota.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
