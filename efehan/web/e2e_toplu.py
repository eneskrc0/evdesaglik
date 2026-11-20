"""Toplu taşıma + adres arama provası (Enes'in GTFS ve OSM verisi). Çalıştır: python web/e2e_toplu.py
1) JS toplu taşıma süresi = Python routing.travel(..., "toplu")  2) adres arama → konum  3) toplu taşımalı çalışanın
canlı takibinde yolculuk planı."""
import random
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import routing  # noqa: E402

PAGE = (Path(__file__).resolve().parent / "dist" / "kapida.html").as_uri()
OUT = Path(__file__).resolve().parent / "dist"
ok = 0


def check(c, m):
    global ok
    assert c, m
    ok += 1
    print("  ✓", m)


rng = random.Random(7)
nok = [(a, b) for a, b, _ in __import__("json").loads((ROOT / "data" / "seed" / "izmir_yol.json").read_text(encoding="utf-8"))["noktalar"]]
ciftler = [(rng.choice(nok), rng.choice(nok), rng.choice([480, 700, 1050, 1250])) for _ in range(400)]
py = [routing.travel(a, b, t, "toplu") for a, b, t in ciftler]
pya = [routing.travel(a, b, t) for a, b, t in ciftler]

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 980})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(PAGE)
    p, h = pg.locator("#pScreen"), pg.locator("#hScreen")
    pg.wait_for_function("document.querySelector('#pScreen').innerText.includes('Demo modu')", timeout=8000)
    check(pg.evaluate("!!window.KapidaToplu && !!window.KAPIDA_TOPLU && !!window.KapidaAdres && !!window.KAPIDA_ADRES"), "toplu taşıma ağı ve adres verisi yüklü")
    js = pg.evaluate("""c => { const C = window.EvdeCore; return c.map(([a,b,t]) => C.travel(a,b,t,'toplu')); }""", [[list(a), list(b), t] for a, b, t in ciftler])
    check(js == py, f"toplu taşıma süresi JS = Python ({sum(x == y for x, y in zip(js, py))}/{len(py)})")
    oran = sorted(y / max(x, 1) for x, y in zip(pya, py) if x > 0)
    check(1.2 < oran[len(oran) // 2] < 4, f"toplu taşıma arabadan yavaş (medyan oran {oran[len(oran) // 2]:.2f})")
    # Adres: sohbet → özet ekranında adres kutusu
    p.locator("[data-tile]").first.click()
    for _ in range(8):
        pg.wait_for_timeout(700)
        if p.locator("[data-act=options]").count():
            break
        if p.locator("[data-quick]").count():
            p.locator("[data-quick]").first.click()
    check(p.locator("#pAdres").count() == 1, "özet ekranında adres kutusu var")
    p.locator("#pAdres").fill("Kazımdirik Mah. 372. Sok.")
    pg.wait_for_timeout(300)
    oneriler = p.locator(".adres-oneri").all_inner_texts()
    check(oneriler and "372. Sokak" in oneriler[0] and "Bornova" in oneriler[0], f"adres önerisi: {oneriler[:2]}")
    p.locator(".adres-oneri").first.click()
    pg.wait_for_timeout(300)
    check("📍 372. Sokak" in p.inner_text() and p.locator("#pDist").input_value() == "Bornova", "adres seçildi, ilçe Bornova oldu")
    # Seçenekler: toplu taşımalı bir çalışanı seç → kabul → canlı takip
    p.locator("[data-act=options]").click()
    pg.evaluate("document.querySelectorAll('details.klasik').forEach(d => d.open = true)")
    kartlar = p.locator("details.klasik [data-pick], [data-pick]")
    secildi = False
    for i in range(kartlar.count()):
        if "🚌" in kartlar.nth(i).inner_text():
            kartlar.nth(i).click()
            secildi = True
            break
    check(secildi, "listede toplu taşımalı (🚌) çalışan var ve seçildi")
    p.locator("[data-act=confirm]").click()
    pg.locator("#demoCtl").get_by_role("button", name="Onaylandı — demo").click()
    h.get_by_role("button", name="Panele git").click()
    if h.locator("[data-act=haccept]").count() == 0:
        h.locator("[data-open]").first.click()
    h.locator("[data-act=haccept]").click()
    time.sleep(6)
    t = p.locator("#takip").inner_text()
    check("CANLI TAKİP" in t and ("Yolculuk planı" in t or "🚶" in t), "canlı takipte toplu taşıma yolculuk planı")
    print("   ", [x for x in t.split("\n") if "Yolculuk" in x][:1])
    pg.locator("#colP").screenshot(path=str(OUT / "toplu_takip.png"))
    check(not errs, f"sayfa hatası yok {errs}")
    br.close()
print(f"\nTamam: {ok} kontrol geçti.")
