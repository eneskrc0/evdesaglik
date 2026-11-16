import sys,time
from playwright.sync_api import sync_playwright
page_path=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1400,"height":900})
    errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    t=time.time();pg.goto("file://"+page_path);pg.wait_for_function("document.getElementById('loadPill').textContent.includes('hazır')",timeout=60000)
    print("yüklendi",round(time.time()-t,1),"sn")
    # konum seç: havuzdan bir noktanın ekran koordinatına tıkla
    xy=pg.evaluate("""()=>{const p=POOL[Math.floor(POOL.length/2)];const [x,y]=proj(p);const m=document.getElementById('map');const pt=m.createSVGPoint();pt.x=x;pt.y=y;const s=pt.matrixTransform(m.getScreenCTM());return [s.x,s.y];}""")
    pg.mouse.click(*xy);print("konum:",pg.inner_text("#locHint"),"|",pg.inner_text("#hospNear")[:80].replace("\n"," "))
    pg.click("#btnRequest");pg.wait_for_timeout(500)
    print("panel çalışanı:",pg.inner_text("#wStatus")[:40])
    cal_before=pg.eval_on_selector("#wCal","e=>e.textContent")
    pg.wait_for_selector("#wSend",timeout=5000);pg.click("#wSend");pg.wait_for_timeout(300)
    pg.wait_for_selector("#offerList button[data-i]",timeout=5000)
    # çalışanın kendi teklifini kabul et
    idx=pg.evaluate("D.offers.findIndex(o=>o.worker===D.controlled)")
    pg.click(f"#offerList button[data-i='{idx}']");pg.wait_for_timeout(300)
    print("hasta:",pg.inner_text("#patientBanner")[:120].replace("\n"," "))
    print("çalışan:",pg.inner_text("#wInbox")[:80].replace("\n"," "))
    print("takvim önce:",cal_before.replace("\n"," | "));print("takvim sonra:",pg.eval_on_selector("#wCal","e=>e.textContent").replace("\n"," | "))
    print("hatalar:",errs);pg.screenshot(path="/tmp/tutarlilik/e2e.png")
    b.close()
