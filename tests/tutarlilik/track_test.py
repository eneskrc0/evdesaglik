import sys,time
from playwright.sync_api import sync_playwright
path=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1400,"height":1000});errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto("file://"+path);pg.wait_for_function("document.getElementById('loadPill').textContent.includes('hazır')",timeout=60000)
    # rota süreleri havuz matrisiyle aynı mı?
    chk=pg.evaluate("""()=>{const G=graphDecode();let mx=0,ms=0;const t0=performance.now();for(let k=0;k<40;k++){const a=(k*37)%POOL.length,b=(k*91+5)%POOL.length;if(a===b)continue;const r=routeNodes(G.pool[a],G.pool[b]);const d=Math.abs(r.total-TT[a*POOL.length+b]);mx=Math.max(mx,d);}return {maxFarkSn:mx,ortMs:(performance.now()-t0)/40};}""")
    print("rota kontrolü:",chk)
    xy=pg.evaluate("""()=>{const p=POOL[Math.floor(POOL.length/3)];const [x,y]=proj(p);const m=document.getElementById('map');const pt=m.createSVGPoint();pt.x=x;pt.y=y;const s=pt.matrixTransform(m.getScreenCTM());return [s.x,s.y];}""")
    pg.mouse.click(*xy);pg.click("#btnRequest");pg.wait_for_timeout(300)
    pg.wait_for_selector("#wSend");pg.click("#wSend");pg.wait_for_timeout(300)
    idx=pg.evaluate("D.offers.findIndex(o=>o.worker===D.controlled)");pg.click(f"#offerList button[data-i='{idx}']");pg.wait_for_timeout(400)
    T=pg.evaluate("({dep:D.track.depart,end:D.track.driveEnd,arr:D.track.arrive,clock:D.clock,n:D.track.r.pts.length})");print("takip:",T)
    for lab,t in [("önce",T["clock"]),("yolda",(T["dep"]+T["end"])/2),("yaklaşırken",T["end"]-1.2),("kapıda",T["end"]+1),("ziyaret",T["arr"]+5)]:
        pg.evaluate(f"D.speed=0;D.clock={max(t,T['clock'])};updateTracking(true)");pg.wait_for_timeout(150)
        print(lab,"→",pg.inner_text("#trackCard").replace("\n"," | ")[:230])
        if lab=="yolda":pg.screenshot(path="/tmp/tutarlilik/takip.png")
    print("hatalar:",errs);b.close()
