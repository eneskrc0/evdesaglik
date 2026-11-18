"""Birleşik demo: enes/web/index.html (İzmir motoru, YZ bildirim, canlı takip, hastaneler)
+ efehan/web/core.js ve data.json (triyaj, kırmızı bayrak, hizmet kataloğu, ziyaret paylaşımı)
+ ortak/ek.js (YZ fiyat önerisi, profil, arayüz bağlantıları).
İki kaynak klasöre dokunmaz; şablon üzerinde adlı yamalar uygular. Bir yama tutmazsa durur.
Kullanım: python3 ortak/build.py  ->  ortak/dist/izmir.html (ve bornova.html)
"""
import json, re
from pathlib import Path

R = Path(__file__).resolve().parents[1]
E, F, O = R / "enes", R / "efehan", R / "ortak"
html = (E / "web/index.html").read_text()
core = (F / "web/core.js").read_text()
data = json.loads((F / "web/data.json").read_text())
CAT = {k: data[k] for k in ("sources", "professions", "services", "profession_services", "red_flags", "complaint_routes")}
ek = (O / "ek.js").read_text()


def patch(name, old, new, count=1, done=None):
    """done: şablonda zaten bu metin varsa yama gereksiz (enes/ şablonu aynı değişikliği kendisi yapmış)."""
    global html
    n = html.count(old)
    if n == 0 and done is not None and done in html:
        return
    assert n == count, f"yama '{name}': {n} eşleşme (beklenen {count})"
    html = html.replace(old, new)


# 1) Başlık
patch("başlık", "<title>Evde Sağlık Eşleştirme — Demo ve Deney Seti</title>", "<title>Evde Sağlık — Birleşik Demo</title>")
patch("h1", "<h1>Evde Sağlık Anlık Teklif ve Eşleştirme</h1>", "<h1>Evde Sağlık — Birleşik Demo <span class=\"tiny\" style=\"font-weight:500\">triyaj · YZ bildirim · YZ fiyat · canlı takip</span></h1>")

# 2) Efehan çekirdeği ve katalog
patch("core.js", "</head>", "<script>\n" + core + "\n</script>\n</head>")
patch("katalog", "const SERVICES={", "const CAT=" + json.dumps(CAT, ensure_ascii=False, separators=(",", ":")) + ";\nconst SERVICES={")
patch("katalog-hizmetler", "const DAY_START=480,DAY_END=1200;",
      "const PROF_GROUP={hekim:\"doktor\",uzman_hekim:\"doktor\",hemsire:\"hemsire\",ebe:\"hemsire\"};\n"
      "{const profOf={};for(const ps of CAT.profession_services)(profOf[ps.service_code]||=[]).push(ps.profession_code);\n"
      " for(const s of CAT.services){const g=[...new Set((profOf[s.code]||[]).map(p=>PROF_GROUP[p]||p))];\n"
      "  SERVICES[s.code]={role:g[0],dur:s.duration_min,base:s.base_fee_tl,label:s.name_tr,needsPlan:!!s.needs_physician_order,remote:!!s.remote_possible,category:s.category};}}\n"
      "const DAY_START=480,DAY_END=1200;")

# 3) Özellik: "doktor" bayrağı hizmet adından değil meslekten (pansuman/doktor için sonuç aynı)
patch("özellik", '+(req.service==="doktor")', '+(SERVICES[req.service].role==="doktor")', done='+(SERVICES[req.service].role==="doktor")')

# 4) Meslek adları ve renkleri
# (enes/ şablonu artık roleNameV / roleColorV kullanıyor; ek.js'teki roleName / roleColor tanımlıysa onları çağırıyor)
html, n = re.subn(r'(\w+)\.role==="hemsire"\?"Hemşire":"Doktor"', r"roleName(\1.role)", html)
assert n >= 6 or "roleNameV" in html, n
patch("renk", '(w.role==="hemsire"?"var(--aqua)":"var(--blue)")', "roleColor(w.role)", done="roleColorV")

# 5) Ek meslekler + profiller
patch("ek-çalışanlar", "const P=prepareSeed(SC_DEMO,DEMO_SEED);", "const P=prepareSeed(SC_DEMO,DEMO_SEED);addExtraWorkers(P);")

patch("demo-ölçek", "const SC_DEMO={...BASE_SC};",
      "const SC_DEMO={...BASE_SC};if(WORLD===\"izmir\")Object.assign(SC_DEMO,{nNurses:60,nDoctors:20,reqPerDay:110}); // demo: pilot ölçeği (deney sonuçları 260/100 ile)")

# 6) Hasta formu: önce anlat → triyaj → hizmet, saat, bütçe
old_form = html[html.index('<div id="patientForm">'):html.index('<div id="patientLive"')]
new_form = '''<div id="patientForm">
     <label>Ne oldu? Kendi cümlenizle yazın ya da 🎤 ile anlatın</label>
     <div style="display:flex;gap:6px;align-items:flex-start"><textarea id="fComplaint" rows="2" style="flex:1" placeholder="ör. Annemin sırtında bası yarası var, pansuman lazım"></textarea><button class="btn sec" id="btnMic" title="Sesle anlat">🎤</button></div>
     <div class="chips" id="exChips"></div>
     <div class="small" style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap"><label class="ck"><input type="checkbox" id="fBed"> Yatağa bağımlı</label><label class="ck"><input type="checkbox" id="fPlan" checked> Hekim planı / reçete var</label></div>
     <div style="margin-top:8px"><button class="btn" id="btnTriage">Değerlendir</button></div>
     <div id="triResult"></div>
     <div id="reqBox" class="hide">
      <div class="row">
       <div><label>Hizmet</label><select id="fService"></select></div>
       <div><label>Zaman aralığı (60 dk)</label><select id="fWindow"></select></div>
      </div>
      <div class="row">
       <div><label>Bütçe (TL, isteğe bağlı)</label><input id="fBudget" type="number" inputmode="numeric" placeholder="ör. 800"></div>
       <div><label>Bildirim yöntemi</label><select id="fPolicy"><option value="model5">Yapay zekâ v5 (dengeli)</option><option value="model">Yapay zekâ v1 (sade)</option><option value="en_erken">En erken varış</option><option value="en_yakin">En yakın</option></select></div>
      </div>
      <div id="legalMsg"></div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center"><button class="btn" id="btnRequest" disabled>Talep aç</button><span class="tiny" id="locHint">Konum: haritadan seçin</span></div>
     </div>
     <div id="etaNear"></div><div id="hospNear" class="small" style="margin-top:8px"></div>
    </div>
    '''
patch("hasta-formu", old_form, new_form)
patch("talep-yasal", '$("btnRequest").onclick=()=>{if(!D.loc)return;', '$("btnRequest").onclick=()=>{if(!D.loc)return;if(!legalOk())return;')
patch("talep-fiyat", "highlightCells(true);drawPatient();sendRound();renderPatient();};", "highlightCells(true);drawPatient();sendRound();showAiPrice();renderPatient();};")
patch("yeni-talep", '$("btnNew").onclick=()=>{D.track=null;', '$("btnNew").onclick=()=>{D.ai=null;$("triResult").innerHTML="";$("reqBox").classList.add("hide");D.track=null;')

# 7) Tur: YZ fiyatı, otomatik tekliflerin karma fiyata çekilmesi
patch("tur-fiyat", " const top=ranked.slice(0,3);\n", " const top=ranked.slice(0,3);\n if(D.round===1)D.ai=aiPrice(top,D.req);\n")
patch("tur-teklif", "const off=workerResponse(SC_DEMO,x.w,D.req,D.clock,DEMO_SEED,DEMO_DAY);if(off)D.pending.push(off);",
      "const off=hybridOffer(workerResponse(SC_DEMO,x.w,D.req,D.clock,DEMO_SEED,DEMO_DAY),x.w);if(off)D.pending.push(off);")

# 8) Teklif listesi ve kabul: ödenecek tutar (paylaşım indirimi), profil
patch("teklif-fiyat", "<b>${fmtTL(o.price)}</b> · varış", "<b>${fmtTL(payOf(o))}</b>${discTxt(o)} · varış")
patch("teklif-profil", "${roleNameV(w.role)} #${w.id} · ${(o.t-req.t)", "${roleNameV(w.role)} #${w.id} · ${profTxt(w,req.service)} · ${(o.t-req.t)")
patch("kabul-tutar", "itibarıyla gelecek · ${fmtTL(o.price)}", "itibarıyla gelecek · ${fmtTL(payOf(o))}")
patch("sıralama-profil", "<td>${roleNameV(r.role)} #${r.id}</td>", "<td>${roleNameV(r.role)} #${r.id}<div class=\"tiny\">${profTxt(D.workers[r.id],D.req.service)}</div></td>")

# 9) Çalışan paneli: YZ önerisi, ±%10 bant
patch("çalışan-öneri", "const defP=req.budget??Math.round(S.base*w.priceMult/10)*10;",
      "const defP=D.ai?D.ai.price:(req.budget??Math.round(S.base*w.priceMult/10)*10);")
patch("çalışan-girdi", '<label>Ücret (TL)</label><input id="wPrice" type="number" value="${defP}">',
      '<label>Ücret (TL) · 🤖 YZ önerisi ${D.ai?fmtTL(D.ai.price):"—"}</label><input id="wPrice" type="number" step="10" value="${defP}" ${D.ai?`min="${aiLo()}" max="${aiHi()}"`:""}><div class="tiny">${D.ai?`İzin verilen aralık ${fmtTL(aiLo())}–${fmtTL(aiHi())}`:""}</div>')
patch("çalışan-gönder", "D.offers.push({worker:w.id,t:D.clock,arrival:arr,price,fits});",
      "const pr=D.ai?clip(Math.round(price/10)*10,aiLo(),aiHi()):price;const o={worker:w.id,t:D.clock,arrival:arr,price:pr};o.share=shareInfo(w.id,arr);"
      "o.fits=arr<=req.we&&(req.budget==null||payOf(o)<=req.budget);D.offers.push(o);")

patch("açıklama", '<span><i class="dot" style="background:var(--blue)"></i>Doktor</span>',
      '<span><i class="dot" style="background:var(--blue)"></i>Doktor</span>\n     <span><i class="dot" style="background:#8b5cf6"></i>Diğer meslekler (fizyoterapist, diyetisyen…)</span>')

# 10) Stil + ek kod + başlatma
css = """.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.chip{font:inherit;font-size:12px;padding:4px 9px;border-radius:14px;border:1px solid var(--line);background:transparent;color:var(--ink2);cursor:pointer}
.chip:hover{border-color:var(--aqua);color:var(--ink)}.ck{display:flex;gap:5px;align-items:center}
textarea{font:inherit;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);resize:vertical}
.tri{margin-top:10px;padding:10px;border-radius:10px;border:1px solid var(--line);border-left:4px solid var(--aqua)}.triT{font-weight:700;margin-bottom:3px}
.emerg{margin-top:10px;padding:12px;border-radius:10px;background:color-mix(in srgb,#e5484d 14%,transparent);border:1px solid color-mix(in srgb,#e5484d 55%,transparent)}
.emergT{font-weight:700;font-size:16px;margin-bottom:4px}.emergBtn{display:inline-block;margin-top:8px;background:#e5484d;color:#fff;text-decoration:none}
.aiPrice{margin-top:8px;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--blue) 10%,transparent);border:1px solid color-mix(in srgb,var(--blue) 40%,transparent)}
"""
patch("stil", ".banner{padding", css + ".banner{padding")
patch("ek-kod", "function renderWorker(){", ek + "\nfunction renderWorker(){")
patch("başlat", "setTimeout(()=>{try{initDemo();}", "setTimeout(()=>{try{setupTriage();initDemo();}")

(O / "dist").mkdir(exist_ok=True)
(O / "template.html").write_text(html)
w = E / "web"
hosp = (w / "hospitals.json").read_text()
tf = w / "transit_izmir.json"  # toplu taşıma ağı (enes/sim/build_transit.py)
transit = tf.read_text() if tf.exists() else "null"
for world, res in [("izmir", E / "results/izmir"), ("bornova", E / "results")]:
    prog = (res / "ilerleme.json").read_text().replace("NaN", "null")
    out = O / "dist" / f"{world}.html"
    out.write_text(html.replace("/*ROADS_JSON*/null", (w / f"roads_{world}.json").read_text())
                   .replace("/*PROGRESS_JSON*/null", prog).replace("/*HOSP_JSON*/null", hosp)
                   .replace("/*GRAPH_JSON*/null", (w / f"graph_{world}.json").read_text())
                   .replace("/*TRANSIT_JSON*/null", transit if world == "izmir" else "null"))
    print(out.relative_to(R), round(out.stat().st_size / 1e6, 2), "MB")
