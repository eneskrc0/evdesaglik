import sys
from playwright.sync_api import sync_playwright
path=sys.argv[1] if len(sys.argv)>1 else __import__("os").path.abspath("ortak/dist/izmir.html")
def click_pool(pg,i):
    xy=pg.evaluate(f"""()=>{{const p=POOL[{i}];const [x,y]=proj(p);const m=document.getElementById('map');const pt=m.createSVGPoint();pt.x=x;pt.y=y;const s=pt.matrixTransform(m.getScreenCTM());return [s.x,s.y];}}""")
    pg.mouse.click(*xy)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1400,"height":1100});errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto("file://"+path);pg.wait_for_function("document.getElementById('loadPill').textContent.includes('hazır')",timeout=60000)
    print("çalışan sayısı:",pg.evaluate("D.workers.length"),pg.evaluate("Object.entries(D.workers.reduce((a,w)=>(a[w.role]=(a[w.role]||0)+1,a),{}))"))
    # 1 acil
    pg.fill("#fComplaint","Babamın göğsünde baskı var terliyor");pg.click("#btnTriage")
    print("ACİL:",pg.inner_text("#triResult").replace("\n"," | ")[:160],"| talep kutusu gizli:",pg.evaluate("$('reqBox').classList.contains('hide')"))
    # 4 yasal
    pg.uncheck("#fPlan");pg.fill("#fComplaint","Doktorun yazdığı serumu evde taktırmak istiyorum");pg.click("#btnTriage")
    print("PLANSIZ SERUM:",pg.inner_text("#triResult").replace("\n"," | ")[:170])
    pg.click("#btnEvMuayene");print("  ev ziyareti hizmeti:",pg.input_value("#fService"));pg.select_option("#fService","iv_serum");print("  elle serum seçilince:",pg.inner_text("#legalMsg")[:90])
    pg.check("#fPlan")
    # 2 planlı bası yarası, tam akış
    pg.fill("#fComplaint","Annemin sırtında bası yarası var, pansuman lazım");pg.click("#btnTriage")
    print("BASI YARASI:",pg.inner_text("#triResult").replace("\n"," | ")[:170])
    click_pool(pg,500);pg.click("#btnRequest");pg.wait_for_timeout(300)
    print("  özet:",pg.inner_text("#reqSummary").replace("\n"," | ")[:260])
    print("  sıralama:",pg.inner_text("#rankBody").split("\n")[0:3])
    print("  çalışan paneli:",pg.inner_text("#wInbox").replace("\n"," | ")[:260])
    pg.fill("#wPrice","99999");pg.click("#wSend");pg.wait_for_timeout(300)
    o=pg.evaluate("D.offers.find(o=>o.worker===D.controlled)");print("  gönderilen teklif (99999 yazıldı):",o["price"],"ödenecek:",pg.evaluate("payOf(D.offers.find(o=>o.worker===D.controlled))"))
    pg.evaluate("D.speed=4");pg.wait_for_timeout(2500)
    print("  teklifler:",pg.inner_text("#offerList").replace("\n"," | ")[:400])
    idx=pg.evaluate("D.offers.findIndex(o=>o.worker===D.controlled)");pg.click(f"#offerList button[data-i='{idx}']");pg.wait_for_timeout(400)
    print("  kabul:",pg.inner_text("#patientBanner")[:140].replace("\n"," "));print("  takip:",pg.inner_text("#trackCard").replace("\n"," | ")[:150])
    pg.screenshot(path="/tmp/ortak/akis.png",full_page=True)
    # 3 fizik tedavi
    pg.click("#btnNew");pg.fill("#fComplaint","Diz ameliyatı oldum, fizik tedavi lazım");pg.click("#btnTriage")
    print("FİZİK TEDAVİ:",pg.inner_text("#triResult").replace("\n"," | ")[:150])
    click_pool(pg,700);pg.click("#btnRequest");pg.wait_for_timeout(300)
    print("  sıralama:",pg.inner_text("#rankTitle"),pg.inner_text("#rankBody").split("\n")[0:2]);print("  fiyat:",pg.inner_text("#reqSummary").replace("\n"," | ")[:200])
    print("hatalar:",errs);b.close()
