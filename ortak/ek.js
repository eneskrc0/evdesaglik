/* ===== Birleşik demo ekleri (ortak/): Efehan'ın triyajı + hizmet kataloğu, YZ fiyat önerisi, profil, ziyaret paylaşımı ===== */
const ROLE_NAMES={hemsire:"Hemşire",doktor:"Doktor",fizyoterapist:"Fizyoterapist",diyetisyen:"Diyetisyen",dil_konusma:"Dil ve konuşma terapisti",
 ergoterapist:"Ergoterapist",klinik_psikolog:"Klinik psikolog",odyolog:"Odyolog",podolog:"Podolog"};
const roleName=r=>ROLE_NAMES[r]||r;
const roleColor=r=>r==="hemsire"?"var(--aqua)":r==="doktor"?"var(--blue)":"#8b5cf6";
const EXTRA_ROLES=WORLD==="izmir"?{fizyoterapist:30,diyetisyen:8,dil_konusma:6,ergoterapist:6,klinik_psikolog:8,odyolog:6,podolog:6}
 :{fizyoterapist:6,diyetisyen:2,dil_konusma:2,ergoterapist:2,klinik_psikolog:2,odyolog:2,podolog:2};

// Hemşire/doktor dışındaki meslekler: davranış profili (yanıt oranı, gecikme, fiyat düzeyi) mevcut bir çalışandan alınır,
// geçmiş istatistiği de onunkiyle aynıdır; konumu yeni çekilir.
function addExtraWorkers(P){const r=rngFor(DEMO_SEED,4242);const nurses=P.workers.filter(w=>w.role==="hemsire");
 for(const[role,n]of Object.entries(EXTRA_ROLES))for(let i=0;i<n;i++){const b=nurses[r.int(0,nurses.length)];
  const w=new Worker({...b,id:P.workers.length,role,home:samplePoint(r)});P.hist[w.id]=P.hist[b.id];P.workers.push(w);}
 for(const w of P.workers){const q=rngFor(DEMO_SEED,9000+w.id);w.prof={years:2+q.int(0,23),rating:Math.round((4.0+q.random()*0.9)*10)/10,act:q.uniform(2,9)};}}
function hashStr(s){let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h;}
function profTxt(w,svc){const p=w.prof;if(!p)return"";const v=Math.round(p.years*p.act*(0.3+0.7*(hashStr(svc+"#"+w.id)%100)/100));
 return`${p.years} yıl · ★${p.rating.toFixed(1).replace(".",",")} · bu hizmette ${v} ziyaret`;}

// ---- YZ fiyat önerisi ----
// Seçilen 3 çalışanın model olasılığı (zamanında yanıt) × o fiyatı kabul etme olasılığı (geçmiş fiyat düzeyinden).
// Öneri: "en az bir uygun teklif" olasılığını, fiyat sınırsız olsaydı ulaşılacak değerin %90'ında tutan en düşük fiyat.
const PRICE_SD=0.12,AI_TARGET=0.9,AI_BAND=0.10;
function Phi(z){const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;}
function aiPrice(top,req){const S=SERVICES[req.service],base=S.base;
 const acc=(c,x)=>{const m=((D.P.hist[c.w.id]||{}).priceMult)??1;return Phi((Math.log(x)-Math.log(base*m))/PRICE_SD);};
 const succ=x=>1-top.reduce((p,c)=>p*(1-(c.p??0.5)*acc(c,x)),1);const sMax=1-top.reduce((p,c)=>p*(1-(c.p??0.5)),1);
 let price=null;for(let x=Math.round(base*0.8/10)*10;x<=base*1.6;x+=10){if(succ(x)>=AI_TARGET*sMax){price=x;break;}}
 if(price==null)price=Math.round(base*1.6/10)*10;let capped=false;
 if(req.budget!=null&&price>req.budget){price=req.budget;capped=true;}
 return{price,succ:succ(price),sMax,base,capped};}
const aiLo=()=>Math.round(D.ai.price*(1-AI_BAND)/10)*10,aiHi=()=>Math.round(D.ai.price*(1+AI_BAND)/10)*10;
// Otomatik çalışanlar: kendi fiyatı önerinin +%10'unu aşıyorsa teklif vermez; yoksa ±%10 bandına çekilir.
function hybridOffer(off,w){if(!off||!D.ai)return off;if(off.price>aiHi())return null;
 off.price=clip(Math.round(off.price/10)*10,aiLo(),aiHi());off.share=shareInfo(off.worker,off.arrival);
 off.fits=off.arrival<=D.req.we&&(D.req.budget==null||payOf(off)<=D.req.budget);return off;}

// ---- Ziyaret paylaşımı (Efehan: routing.py mantığı) ----
// Çalışan o gün zaten sahadaysa, önceki ziyaretinden gelmek evden gelip dönmekten kısaysa tasarrufun yarısı hastaya indirim.
function shareInfo(wid,arr){const w=D.workers[wid],req=D.req,S=SERVICES[req.service];
 const prev=w.blocks.filter(b=>b.e<=arr).pop();if(!prev)return{disc:0};const next=w.blocks.find(b=>b.s>=arr+S.dur);
 const km=(a,b)=>haversine(a,b)*EvdeCore.CFG.ROAD_FACTOR,nl=next?next.p:w.home;
 const standalone=2*km(w.home,req.loc),added=km(prev.p,req.loc)+km(req.loc,nl)-km(prev.p,nl),saved=standalone-added;
 if(saved<EvdeCore.CFG.MIN_SAVED_KM)return{disc:0};
 return{disc:Math.round(saved*EvdeCore.CFG.TRAVEL_TL_PER_KM*EvdeCore.CFG.SPLIT.hasta/10)*10,saved};}
function payOf(o){if(o.share===undefined)o.share=shareInfo(o.worker,o.arrival);return Math.max(0,o.price-(o.share.disc||0));}
function discTxt(o){payOf(o);return o.share&&o.share.disc?` <span class="pill ok">ziyaret paylaşımı −${fmtTL(o.share.disc)}</span>`:"";}
function showAiPrice(){if(!D.ai)return;const a=D.ai;
 $("reqSummary").innerHTML+=`<div class="aiPrice">🤖 <b>YZ fiyat önerisi: ${fmtTL(a.price)}</b><div class="tiny">Liste fiyatı ${fmtTL(a.base)} · bu fiyatla bildirim giden 3 kişiden en az birinin uygun teklif verme olasılığı ~%${Math.round(a.succ*100)}${a.capped?" · bütçenizle sınırlandı":""}. Çalışanlar önerinin ±%10'u içinde teklif verir.</div></div>`;}

// ---- Triyaj ve hizmet seçimi (Efehan: core.js) ----
let REPO=null,TRI=null;
function legalOk(){const s=SERVICES[$("fService").value];const bad=s&&s.needsPlan&&!$("fPlan").checked;
 $("legalMsg").innerHTML=bad?`<div class="banner warn">Bu hizmet yalnızca hekimin tanı koyup plan / reçete yazdığı hastaya verilebilir (Serbest Meslek İcrası Yönetmeliği, RG 29.03.2025). Önce hekim ev ziyareti ya da video görüşme gerekir.</div>`:"";return!bad;}
function setService(code){$("fService").value=code;const s=SERVICES[code];$("fBudget").placeholder="ör. "+s.base;$("reqBox").classList.remove("hide");fillWindows();legalOk();}
function renderTriage(t){const box=$("triResult");TRI=t;
 if(t.is_emergency){const num=t.level==="ACIL_112"?"112":"114";$("reqBox").classList.add("hide");
  box.innerHTML=`<div class="emerg"><div class="emergT">${num==="112"?"🚨 Acil durum: randevu açılmaz":"☎️ Zehir danışma hattı"}</div><div>${t.message}</div>
   <a class="btn emergBtn" href="tel:${num}">📞 ${num}'yi arayın</a><div class="tiny" style="margin-top:6px">${t.reasons.join(" · ")}</div></div>`;return;}
 const lv=EvdeCore.LEVEL_TEXT[t.level]||t.level;
 if(t.level==="TELE"){$("reqBox").classList.add("hide");
  box.innerHTML=`<div class="tri"><div class="triT">Önerilen: ${lv}</div><div class="tiny">${t.reasons.join(" · ")}</div>
   <div class="small" style="margin-top:6px">Önce bir hekimin video görüşmeyle değerlendirmesi yeterli olabilir (${fmtTL(SERVICES.tele_muayene.base)}'den). Video görüşme bu prototipte canlandırılmıyor.</div>
   <button class="btn sec sm" id="btnEvMuayene" style="margin-top:8px">Hekim ev ziyareti iste</button></div>`;
  $("btnEvMuayene").onclick=()=>{setService("ev_muayene");};return;}
 const code=t.services[0],s=SERVICES[code];
 box.innerHTML=`<div class="tri"><div class="triT">${lv}</div><div><b>${s.label}</b> · ${roleName(s.role)} · ~${s.dur} dk · ${fmtTL(s.base)}'den</div>
  <div class="tiny" style="margin-top:4px">${t.reasons.join(" · ")} · kaynak: ${t.sources.join(", ")}</div>
  <div class="tiny">Bu bir teşhis değildir; durum kötüleşirse 112'yi arayın.</div></div>`;
 setService(code);}
function setupTriage(){REPO=new EvdeCore.Repo(Object.assign({providers:[],provider_services:[],availability:[],scheduled_visits:[],patients:[]},CAT));
 const sel=$("fService");sel.innerHTML="";
 Object.entries(SERVICES).filter(([k,s])=>s.category&&(s.category!=="tele"||k==="tele_hemsire_destekli")).forEach(([k,s])=>{
  const o=document.createElement("option");o.value=k;o.textContent=`${s.label} · ${roleName(s.role)} · ${fmtTL(s.base)}'den`;sel.appendChild(o);});
 sel.onchange=()=>setService(sel.value);$("fPlan").onchange=()=>{legalOk();};
 const EX=["Annemin sırtında bası yarası var, pansuman lazım","Babamın göğsünde baskı var, terliyor","Doktorun yazdığı serumu evde taktırmak istiyorum",
  "Diz ameliyatı oldum, fizik tedavi lazım","Babam yutkunurken çok öksürüyor","3 gündür ateşim ve öksürüğüm var","Çocuk çamaşır suyu içti"];
 $("exChips").innerHTML=EX.map((e,i)=>`<button class="chip" data-i="${i}">${e}</button>`).join("");
 $("exChips").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{$("fComplaint").value=EX[+b.dataset.i];$("btnTriage").click();});
 $("btnTriage").onclick=()=>{const txt=$("fComplaint").value.trim();if(!txt){$("triResult").innerHTML='<div class="tiny">Önce ne olduğunu yazın ya da anlatın.</div>';return;}
  renderTriage(EvdeCore.triage(REPO,txt,{bedridden:$("fBed").checked,has_physician_plan:$("fPlan").checked}));};
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;const mic=$("btnMic");
 if(!SR)mic.style.display="none";else mic.onclick=()=>{try{const rec=new SR();rec.lang="tr-TR";rec.interimResults=false;mic.textContent="⏺";
  rec.onresult=e=>{$("fComplaint").value=($("fComplaint").value+" "+e.results[0][0].transcript).trim();};rec.onend=()=>{mic.textContent="🎤";};rec.onerror=()=>{mic.textContent="🎤";};rec.start();}catch(e){mic.textContent="🎤";}};}
