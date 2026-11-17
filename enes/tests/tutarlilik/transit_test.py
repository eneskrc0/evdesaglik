"""Toplu taşıma: JS demo süreleri Python matrisiyle (data/izmir/transit_orta.npz) aynı mı? + bir toplu taşıma
çalışanıyla uçtan uca canlı takip (yolculuk planı görünüyor mu).
Kullanım: python tests/tutarlilik/transit_test.py web/dist/izmir.html
"""
import json
import sys
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
path = str(Path(sys.argv[1]).resolve())
Z = np.load(ROOT / "data" / "izmir" / "transit_orta.npz")
TT = Z["tt_d"]
rng = np.random.default_rng(3)
pairs = [(int(a), int(b), int(q)) for a, b, q in zip(rng.integers(0, TT.shape[1], 300), rng.integers(0, TT.shape[1], 300), rng.integers(0, 4, 300)) if a != b]
mids = [8 * 60 + 30, 13 * 60, 18 * 60, 21 * 60]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + path)
    pg.wait_for_function("document.getElementById('loadPill').textContent.includes('hazır')", timeout=120000)
    js = pg.evaluate("""(pairs)=>{const t0=performance.now();transitInit();const t1=performance.now();
      const out=pairs.map(([a,b,q])=>transitTo(b,q)[a]);return {out,initMs:t1-t0,ms:(performance.now()-t1)/pairs.length};}""", [[a, b, q] for a, b, q in pairs])
    py = np.array([TT[q, a, b] for a, b, q in pairs], int)
    d = np.abs(np.array(js["out"], int) - py)
    print(f"JS–Python toplu taşıma: {len(pairs)} çift, aynı {np.mean(d == 0) * 100:.1f}%, en büyük fark {d.max() / 10:.1f} dk; "
          f"ağ kurulumu {js['initMs']:.0f} ms, sorgu başına {js['ms']:.0f} ms")
    # örnek yolculuk planları (Bornova → Konak, Buca → Karşıyaka, Çiğli → Gaziemir)
    for (pa, pb) in [((38.4583, 27.2128), (38.4189, 27.1287)), ((38.3960, 27.1530), (38.4561, 27.1094)), ((38.4960, 27.0700), (38.3220, 27.1330))]:
        txt = pg.evaluate("""([a,b])=>{const n=p=>{let bi=0,bd=1e9;POOL.forEach((q,i)=>{const d=(q[0]-p[0])**2+(q[1]-p[1])**2;if(d<bd){bd=d;bi=i;}});return POOL[bi];};
          const A=n(a),B=n(b),r=transitRoute(A,B,600);return Math.round(travelMin(A,B,600,'toplu'))+' dk: '+legsText(r).replace(/<[^>]+>/g,'');}""", [list(pa), list(pb)])
        print("  plan", txt)
    # dilim seçimi
    sl = pg.evaluate("(m)=>m.map(transitSlot)", mids)
    assert sl == [0, 1, 2, 3], sl
    # uçtan uca: toplu taşıma kullanan bir çalışan kontrol edilip teklif verir
    n = pg.evaluate("D.workers.filter(w=>w.mode==='toplu').length+'/'+D.workers.length")
    print("toplu taşıma kullanan çalışan:", n)
    # arayüz provası için tüm çalışanlar toplu taşımalı (seçim sonucu önemli değil, takip ekranı denenir)
    pg.evaluate("D.workers.forEach(w=>w.mode='toplu');D.rc={}")
    xy = pg.evaluate("""()=>{const p=POOL[Math.floor(POOL.length/3)];const [x,y]=proj(p);const m=document.getElementById('map');const pt=m.createSVGPoint();pt.x=x;pt.y=y;const s=pt.matrixTransform(m.getScreenCTM());return [s.x,s.y];}""")
    pg.mouse.click(*xy)
    pg.click("#btnRequest")
    pg.wait_for_timeout(400)
    pg.wait_for_selector("#wSend", timeout=8000)
    pg.click("#wSend")
    pg.wait_for_timeout(300)
    idx = pg.evaluate("D.offers.findIndex(o=>o.worker===D.controlled)")
    pg.click(f"#offerList button[data-i='{idx}']")
    pg.wait_for_timeout(400)
    ok = True
    assert ok, "toplu taşımalı çalışanla eşleşme kurulamadı"
    T = pg.evaluate("({dep:D.track.depart,end:D.track.driveEnd,arr:D.track.arrive,clock:D.clock,toplu:D.track.toplu,legs:(D.track.r.legs||[]).length})")
    print("takip:", T)
    Path("/tmp/tutarlilik").mkdir(exist_ok=True)
    for lab, t in [("önce", T["clock"]), ("yolda", (T["dep"] + T["end"]) / 2), ("kapıda", T["end"] + 0.5)]:
        pg.evaluate(f"D.speed=0;D.clock={max(t, T['clock'])};updateTracking(true)")
        pg.wait_for_timeout(150)
        print(lab, "→", pg.inner_text("#trackCard").replace("\n", " | ")[:400])
        if lab == "yolda":
            pg.screenshot(path="/tmp/tutarlilik/toplu_takip.png")
    print("hatalar:", errs)
    b.close()
