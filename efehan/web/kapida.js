/* Kapıda — hasta ve sağlık çalışanı uygulaması prototipi.
   Mantık: EvdeCore (core.js, Python sürümüyle birebir). Veri: EVDE_DATA (sentetik).
   YZ: claude.use("sample") varsa Claude; yoksa Cloudflare sunucusu (sunucu.js, Groq); o da yoksa senaryolu demo modu.
   Güvenlik: her mesaj önce kural motorunun kırmızı bayraklarından geçer; YZ ayrıca işaretler. */
(function () {
  "use strict";
  const C = window.EvdeCore;
  const repo = new C.Repo(window.EVDE_DATA);
  const DATE = "2026-11-16", DATE2 = "2026-11-17"; // demo "bugün" (Pzt) ve "yarın" (Salı)
  const GUNLER = [{ ad: "Bugün", tarih: DATE, uzun: "16 Kasım Pazartesi" }, { ad: "Yarın", tarih: DATE2, uzun: "17 Kasım Salı" }];
  const gunTarih = (g) => GUNLER[g || 0].tarih;
  const gunEki = (r) => (r && r.gun ? "Yarın " : "");
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tl = (x) => Math.round(x).toLocaleString("tr-TR");
  const svc = (code) => repo.services[code];

  // ---------- simgeler ----------
  const I = (d, extra = "") => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICO = {
    mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    cam: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    send: I('<path d="M4 12l16-8-6 16-2-7z"/>'),
    back: I('<path d="M15 5l-7 7 7 7"/>'),
    dalga: I('<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>'),
    speaker: I('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>'),
    bandage: I('<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M10 10l.01 0M14 14l.01 0M12 12l.01 0"/>'),
    drop: I('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
    syringe: I('<path d="M18 2l4 4M15 5l4 4M7 13l4 4M3 21l3-3M14 6l4 4-9 9-4-4z"/>'),
    tube: I('<path d="M9 3h6M10 3v13a2 2 0 0 0 4 0V3M10 10h4"/>'),
    walk: I('<circle cx="13" cy="4" r="2"/><path d="M11 21l2-7 3 3v5M8 12l3-4 3 2 3 1M9 21l2-6"/>'),
    steth: I('<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>'),
    bed: I('<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>'),
    video: I('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>'),
    home: I('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>'),
    clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: I('<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    check: I('<path d="M5 12l5 5 9-10"/>'),
    alert: I('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.01"/>'),
    route: I('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>'),
  };
  const svcIcon = (code) => {
    const s = svc(code) || {};
    if (/bas|yara|pansuman/.test(code)) return ICO.bandage;
    if (code === "iv_serum") return ICO.drop;
    if (/enjeksiyon/.test(code)) return ICO.syringe;
    if (/kan_alma|vital/.test(code)) return ICO.tube;
    if (s.category === "rehabilitasyon") return ICO.walk;
    if (s.category === "tele") return ICO.video;
    return ICO.steth;
  };

  // ---------- örnek kişi adları (sentetik) ----------
  const NAMES = ["Elif", "Zeynep", "Ayşe", "Merve", "Selin", "Burak", "Emre", "Deniz", "Can", "Ece", "Gizem", "Mert", "Seda", "Onur", "İrem", "Kerem", "Duygu", "Tolga", "Nazlı", "Barış"];
  const SUR = "AKYDTSBÇEGHMÖPUVZ";
  const TITLE = { hemsire: "Hemşire", hekim: "Dr.", uzman_hekim: "Uzm. Dr.", ebe: "Ebe", fizyoterapist: "Fzt.", odyolog: "Ody.", diyetisyen: "Dyt.", dil_konusma: "DKT", ergoterapist: "Ergoterapist", klinik_psikolog: "Psk.", podolog: "Podolog" };
  function person(pid) {
    const p = repo.providers[pid];
    const h = [...pid].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const first = NAMES[h % NAMES.length], last = SUR[(h >>> 5) % SUR.length];
    return { full: `${TITLE[p.profession_code]} ${first} ${last}.`, first, initials: first[0] + last, prof: repo.professions[p.profession_code].name_tr };
  }

  // ---------- durum ----------
  const P = {
    screen: "home", msgs: [], turns: [], photos: [], photoNotes: [], pendingPhotos: [], report: null,
    info: { bed: false, plan: "bilinmiyor", district: "Bornova", when: 570, gun: 0, forWhom: "" },
    triage: null, sort: "onerilen", sheet: null, request: null, emergency: null, busy: false,
    voice: false, listening: false, mode: "loading", demoStep: 0, demoAnswers: [], toast: "",
  };
  const H = { pid: "HEM-12", tab: "talepler", open: null, accepted: {}, rejected: {}, toast: "" };
  // Gerçek İzmir haritası ve sokak rotası (harita.js; Enes'in yol grafiği, © OpenStreetMap katkıcıları)
  const MAP = window.KapidaHarita && window.KAPIDA_HARITA && window.EVDE_DATA.yol ? window.KapidaHarita.create(window.KAPIDA_HARITA, window.EVDE_DATA.yol) : null;
  // Toplu taşıma yolculuk planı (toplu.js; Enes'in GTFS ağı) ve çevrimdışı adres arama (adres.js; OSM sokak adları)
  const TOPLU = window.KapidaToplu && window.KAPIDA_TOPLU && window.EVDE_DATA.yol ? window.KapidaToplu.create(window.KAPIDA_TOPLU, window.EVDE_DATA.yol.noktalar) : null;
  const ADR = window.KapidaAdres && window.KAPIDA_ADRES ? window.KapidaAdres.create(window.KAPIDA_ADRES) : null;
  const ulasim = (pid) => (repo.providers[pid] && repo.providers[pid].transport) || "araba";
  const ulasimEtiket = (pid) => (ulasim(pid) === "toplu" ? "🚌 toplu taşıma" : "🚗 araba");
  // YZ teklif katmanı (teklif.js): Enes'in eğitilmiş bildirim modeli + YZ fiyat önerisi + ±%10 teklif bandı
  const TK = window.KapidaTeklif && window.KAPIDA_MODEL ? window.KapidaTeklif.create(window.KAPIDA_MODEL, C) : null;
  const SIMDI = 570; // demo saati 09:30 (üst çubuktaki saat)
  // Mesleki doğrulama (dogrulama.js): ilk girişte açılır; onay (demo) olmadan görev kabul edilemez.
  const DG = window.KapidaDogrulama.create({ esc, rerender: () => renderH(), toast: (m) => { H.toast = m; renderH(); } });
  // Güvenli Ziyaret (guvenlik.js): risk notu, kapı kodu, konum kontrolü, kontrol zamanlayıcısı ve yükseltme zinciri, gizli SOS, Beyaz Kod.
  const G = window.KapidaGuvenlik.create({ esc, hhmm: C.hhmm, kisi: person, hizmet: svc, tarih: "16.11.2026", konum: calisanKonumu,
    metin: (r) => (P.request && r.id === P.request.id ? transcriptText() : ""), bildir: (taraf, m) => { if (taraf === "p") P.toast = m; else H.toast = m; } });
  const gzR = () => (P.request && P.request.provider_id === H.pid ? P.request : null); // çalışan ekranındaki aktif ziyaret
  const REQ = []; // tüm talepler (yerel + ortak)
  const CAP = { sample: null, server: null, images: false, dictation: null, tts: null, db: null, uid: null };

  // ---------- sesli asistan (sesli.js) ----------
  // Sesli mod mevcut sohbet akışını kullanır: konuşma → yazı → send() (acil kuralı, 3 soru, meslek, rapor aynen) → yanıt seslendirilir.
  const SV = window.KapidaSesli.create({ dinleyici: null, tts: null, gonder: sesliGonder,
    acilMi: (t) => C.konusmaDegerlendir(repo, [...P.msgs.filter((m) => m.who === "me" && !m.araLaf).map((m) => m.text), t], { bedridden: false, has_physician_plan: false }).acil,
    ciz: () => { if (P.screen === "chat") renderP(); } });
  function sesliKur() {
    const S = window.KapidaSesli;
    let d = null;
    if (CAP.server && CAP.server.yaziyaCevir) d = S.whisperDinleyici((b, u) => CAP.server.yaziyaCevir(b, u));
    if (!d) d = S.tarayiciDinleyici();
    if (!d && CAP.dictation && !CAP.server) d = S.claudeDinleyici(CAP.dictation);
    SV.dinleyiciDegistir(d); SV.ttsDegistir(S.konusucu(CAP.tts));
  }
  async function sesliGonder(text) {
    await send(text);
    await new Promise((res) => { const t0 = Date.now(); const i = setInterval(() => { if ((!P.busy && P.screen !== "building") || Date.now() - t0 > 90000) { clearInterval(i); res(); } }, 80); });
    if (P.screen === "emergency") return { tur: "acil", metin: ((P.emergency && P.emergency.msg) || "Bu durum acil olabilir.") + " Ekrandaki düğmeyle hemen 112'yi arayabilirsin." };
    if (P.screen !== "chat") return { tur: "bitti", metin: "Anlattıklarını özetledim. Ekranda kontrol edip onaylayabilirsin." };
    const last = P.msgs[P.msgs.length - 1];
    return { tur: "devam", metin: last && last.who === "ai" ? last.text : "" };
  }
  const SESLI_SELAM = "Merhaba, ben Kapıda asistanı. Seni dinliyorum. Ne olduğunu kendi cümlelerinle anlat; konuşman bitince kısa bir an beklemen yeterli.";
  function sesliBaslat(yeni) {
    if (!SV.var()) return;
    if (yeni) {
      startChat();
      P.msgs[0].text = P.mode === "ai" ? SESLI_SELAM : SESLI_SELAM + "\n\n" + DEMO_Q[0][0];
      SV.ac(P.mode === "ai" ? SESLI_SELAM : SESLI_SELAM + " " + DEMO_Q[0][0]);
    } else {
      const last = P.msgs[P.msgs.length - 1];
      SV.ac(last && last.who === "ai" && !P.msgs.some((m) => m.who === "me") ? last.text : "Sesli moddayız. Seni dinliyorum.");
    }
    renderP();
  }
  const SV_DURUM = { hazir: "Hazırlanıyor…", konusuyor: "Konuşuyorum · sözümü kesmek için küreye dokun", isleniyor: "Sesini yazıya çeviriyorum…", dusunuyor: "Düşünüyorum…",
    beklemede: "Mikrofon kapalı · konuşmak için küreye dokun", kapali: "" };
  function pSesli() {
    const st = SV.st;
    const lastAi = [...P.msgs].reverse().find((m) => m.who === "ai");
    const lastMe = [...P.msgs].reverse().find((m) => m.who === "me");
    const quick = st.durum !== "dusunuyor" && st.durum !== "isleniyor" && lastAi && lastAi.quick && lastAi.quick.length && P.msgs[P.msgs.length - 1] === lastAi ? lastAi.quick : [];
    const durum = st.durum === "dinliyor" ? (SV.tur() === "claude" ? "Dinliyorum · bitince küreye dokun" : "Dinliyorum · konuşman bitince kendim anlarım") : SV_DURUM[st.durum] || "";
    const aria = { konusuyor: "Sözünü kes ve konuş", dinliyor: "Konuşmamı bitirdim", beklemede: "Dinlemeye başla" }[st.durum] || "Sesli asistan";
    const m = istenenMeslek();
    return `<div class="sesli durum-${st.durum}" role="region" aria-label="Sesli asistan">
      <div class="sv-ust"><button class="back" type="button" data-sv="kapat">${ICO.back} Yazıya dön</button><span class="pill good">${ICO.dalga} Sesli asistan</span></div>
      <div class="sv-asistan" aria-live="polite">${esc(st.asistan || (lastAi && lastAi.text) || "")}</div>
      <button class="sv-orb" id="svOrb" type="button" data-sv="dokun" aria-label="${aria}"><span class="sv-halka"></span><span class="sv-cekirdek"></span></button>
      <div class="sv-durum" id="svDurum" role="status">${esc(durum)}</div>
      <div class="sv-sen" id="svSen" ${st.ara ? "" : "hidden"}>${st.ara ? "Sen: " + esc(st.ara) : ""}</div>
      ${!st.ara && lastMe ? `<div class="sv-son">Sen: ${esc(lastMe.text)}</div>${lastMe.understood ? `<div class="understood">Anladığım: ${esc(lastMe.understood)}</div>` : ""}` : ""}
      ${st.hata ? `<div class="lockmsg" role="alert">${esc(st.hata)}</div>` : ""}
      ${quick.length ? `<div class="quick" style="justify-content:center">${quick.map((q) => `<button class="chip" type="button" data-quick="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}
      <div class="sv-alt">
        <button class="btn" type="button" data-sv="duraklat" aria-pressed="${st.durum === "beklemede"}">${st.durum === "beklemede" ? "Mikrofonu aç" : "Mikrofonu kapat"}</button>
        <label class="btn" style="cursor:pointer">${ICO.cam} Fotoğraf<input type="file" accept="image/*" id="pPhoto" hidden></label>
        ${P.msgs.some((x) => x.who === "me") ? `<button class="btn ghost" type="button" data-act="skipdoc">Soruları geç, ${m && !HEKIMLER.has(m) ? yonelme(meslekAdi(m)) : "doktora"} yönlendir</button>` : ""}
      </div>
      <div class="tiny muted" style="text-align:center">Teşhis koymaz. Acil bir durumda 112'yi ara. Konuşmaların yazısı sohbette kalır.</div></div>`;
  }

  // ---------- yetenekler ----------
  async function initCaps() {
    const use = window.claude && typeof window.claude.use === "function" ? window.claude.use.bind(window.claude) : null;
    if (!use) { await initServer(); return; }
    const [sample, dict, tts, db, user] = await Promise.all(["sample", "dictation", "tts", "db", "user"].map((n) => use(n).catch(() => null)));
    CAP.sample = sample; CAP.dictation = dict; CAP.tts = tts; CAP.db = db;
    if (sample) { try { const l = await sample.limits(); CAP.images = !!(l && l.images); } catch (e) { CAP.images = false; } }
    P.mode = sample ? "ai" : "demo";
    if (dict) bindDictation(dict);
    if (user) { try { CAP.uid = await user.id(); } catch (e) { /* yok */ } }
    if (db) subscribeDb();
    sesliKur();
    renderP(); renderH();
  }
  // Claude dışında (GitHub Pages, telefon): Cloudflare sunucusu varsa gerçek YZ, yoksa demo soruları.
  async function initServer() {
    const S = window.KapidaSunucu;
    CAP.tts = S ? S.telefonSesi() : null;
    const url = S ? S.adres() : "";
    if (url) {
      const srv = S.create(url);
      if (await srv.saglik()) {
        CAP.server = srv; CAP.images = true; CAP.dictation = srv.dictation; P.mode = "ai";
        if (CAP.dictation) bindDictation(CAP.dictation);
      } else { P.mode = "demo"; P.toast = "Yapay zekâ sunucusuna ulaşılamadı; demo sorularıyla devam ediyoruz."; }
    } else P.mode = "demo";
    sesliKur();
    renderP(); renderH();
  }
  function bindDictation(dict) {
    dict.onPartial(({ text }) => { const ta = $("#pInput"); if (ta && text) ta.placeholder = text; });
    dict.onFinal(({ text }) => { const ta = $("#pInput"); if (ta) { ta.value = ta.value ? ta.value + " " + text.trim() : text.trimStart(); ta.focus(); } });
    dict.onState(({ state }) => { P.listening = state !== "idle"; const b = $("#pMic"); if (b) b.classList.toggle("listening", P.listening); if (!P.listening) { const ta = $("#pInput"); if (ta && !/çevril|tekrar|yoğun/.test(ta.placeholder)) ta.placeholder = "Yaz ya da konuş…"; } });
  }
  function subscribeDb() {
    try {
      CAP.db.collection("talepler").orderBy("created_at", "desc").limit(50).onSnapshot((snap) => {
        for (const d of snap.docs) {
          const v = { id: d.id, ...d.data(), remote: true };
          const i = REQ.findIndex((r) => r.id === v.id);
          if (i >= 0) REQ[i] = { ...REQ[i], ...v }; else REQ.push(v);
        }
        if (P.request) { const mine = REQ.find((r) => r.id === P.request.id); if (mine) P.request = mine; }
        renderP(); renderH();
      }, () => { CAP.db = null; });
    } catch (e) { CAP.db = null; }
  }
  // ---------- takvim: randevu eşleştirmenin kullandığı takvime işlenir (aynı saat bir daha önerilmez), iptal/ret her yerden siler ----------
  function takvimeIsle(r) {
    const k = r.provider_id + "|" + (r.date || DATE);
    const l = (repo.scheduled[k] ||= []);
    if (l.some((v) => v.reqId === r.id)) return;
    l.push({ id: "R-" + r.id, reqId: r.id, provider_id: r.provider_id, date: r.date || DATE, start_min: r.arrival_min,
      duration_min: svc(r.service).duration_min, lat: r.patient.lat, lon: r.patient.lon, service_code: r.service });
    l.sort((a, b) => a.start_min - b.start_min);
    P.saatler = null;
  }
  function takvimdenSil(reqId) {
    for (const k of Object.keys(repo.scheduled)) repo.scheduled[k] = repo.scheduled[k].filter((v) => v.reqId !== reqId);
    for (const pid of Object.keys(H.accepted)) H.accepted[pid] = H.accepted[pid].filter((v) => v.reqId !== reqId);
    P.saatler = null;
  }
  async function putRequest(r) {
    const i = REQ.findIndex((x) => x.id === r.id);
    if (i >= 0) REQ[i] = r; else REQ.push(r);
    if (CAP.db) {
      const { remote, ...body } = r;
      try { await CAP.db.collection("talepler").doc(r.id).set(body); } catch (e) { /* yalnızca yerel kalır */ }
    }
  }

  // ---------- görsel yardımcılar ----------
  function compress(file, max) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob((b) => res({ blob: b, url: cv.toDataURL("image/jpeg", 0.72) }), "image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  function mapSVG(home, stops, target) {
    const W = 340, Hh = 190, PAD = 22;
    const pts = [home, ...stops.map((s) => [s.lat, s.lon]), ...(target ? [target] : [])];
    const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const kx = 111 * Math.cos((lat0 * Math.PI) / 180);
    const xy = (p) => [p[1] * kx, -p[0] * 111];
    const q = pts.map(xy);
    const minX = Math.min(...q.map((a) => a[0])), maxX = Math.max(...q.map((a) => a[0]));
    const minY = Math.min(...q.map((a) => a[1])), maxY = Math.max(...q.map((a) => a[1]));
    const sc = Math.min((W - 2 * PAD) / Math.max(maxX - minX, 2), (Hh - 2 * PAD) / Math.max(maxY - minY, 2));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const pr = (p) => { const a = xy(p); return [W / 2 + (a[0] - cx) * sc, Hh / 2 + (a[1] - cy) * sc]; };
    const cs = getComputedStyle(document.documentElement), col = (n) => cs.getPropertyValue(n).trim();
    const route = [home, ...stops.map((s) => [s.lat, s.lon]), home].map(pr);
    let g = `<polyline points="${route.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${col("--muted")}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    const [hx, hy] = pr(home);
    g += `<rect x="${hx - 6}" y="${hy - 6}" width="12" height="12" rx="3" fill="${col("--ink")}"/><text x="${hx + 9}" y="${hy + 4}">ev</text>`;
    stops.forEach((s, i) => { const [x, y] = pr([s.lat, s.lon]); g += `<circle cx="${x}" cy="${y}" r="${s.isNew ? 8 : 6}" fill="${s.isNew ? col("--saffron") : col("--brand")}"/><text x="${x + 10}" y="${y + 4}">${C.hhmm(s.start_min)}</text>`; });
    g += `<line x1="${PAD}" y1="${Hh - 10}" x2="${PAD + 2 * sc}" y2="${Hh - 10}" stroke="${col("--ink")}" stroke-width="2"/><text x="${PAD}" y="${Hh - 15}">2 km</text>`;
    return `<svg class="map" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Rota haritası">${g}</svg>`;
  }

  // ---------- fiyat başlangıçları ----------
  function fromPrice(code) {
    let m = Infinity;
    for (const [pid, ss] of Object.entries(repo.provider_services)) if (ss[code] !== undefined) m = Math.min(m, svc(code).base_fee_tl * repo.providers[pid].fee_multiplier);
    return m === Infinity ? svc(code).base_fee_tl : m;
  }
  const TILES = [
    ["basi_yarasi_bakimi", "Yara / bası yarası bakımı", "Annemin sırtında yara var, pansuman gerekiyor"],
    ["iv_serum", "Serum takma", "Doktorun yazdığı serumu evde taktırmak istiyorum"],
    ["kan_alma", "Evde kan alma", "Doktorun istediği tahlil için evden kan aldırmak istiyorum"],
    ["fizyoterapi_seansi", "Evde fizik tedavi", "Ameliyat sonrası evde fizik tedavi istiyorum"],
    ["ev_muayene", "Doktor ev ziyareti", "Babam hasta, doktorun eve gelip bakmasını istiyorum"],
    ["tele_muayene", "Görüntülü doktor", "Doktorla görüntülü görüşmek istiyorum"],
  ];

  // ---------- YZ ----------
  const SERVICE_LIST = Object.values(repo.services).map((s) => `${s.code}: ${s.name_tr}`).join("\n");
  // İstemler tek kaynaktan (istemler.js): Claude sürümü ve sunucu aynı talimatları kullanır.
  const CHAT_RULES = window.KAPIDA_ISTEMLER.SOHBET_KURALLARI;
  const reportPrompt = (transcript) => window.KAPIDA_ISTEMLER.raporIstemi(transcript, P.photoNotes, SERVICE_LIST);
  const DEMO_Q = [
    ["Ne oldu? Kendi cümlelerinle anlat. Yara, kızarıklık gibi dışarıdan görünen bir durumsa fotoğraf da ekleyebilirsin.", []],
    ["Bu yardım kimin için? Yaklaşık kaç yaşında?", ["Annem, 70 üstü", "Babam, 70 üstü", "Kendim için", "Eşim için"]],
    ["Ne zamandır böyle? Kötüleşiyor mu?", ["Bugün başladı", "Birkaç gündür", "Bir haftadan fazla", "Gittikçe kötüleşiyor"]],
    ["Bu konuda bir doktorun planı ya da reçetesi var mı?", ["Evet, reçete / plan var", "Hayır, yok", "Emin değilim"]],
    ["Yatağa bağımlı mı, evden çıkabiliyor mu?", ["Yatağa bağımlı", "Evden zor çıkıyor", "Rahat çıkabiliyor"]],
  ];
  const MATERIALS = {
    basi_yarasi_bakimi: ["Pansuman seti (sağlık çalışanı getirir)", "Temiz havlu ve çarşaf hazır olsun"],
    yara_pansuman: ["Pansuman seti (sağlık çalışanı getirir)"],
    iv_serum: ["Reçete ve serum ilacı evde hazır olsun", "Serum askısı (sağlık çalışanı getirir)"],
    im_enjeksiyon: ["Reçeteli ilaç evde hazır olsun"],
    kan_alma: ["Hekimin tahlil istemi", "Aç karnına mı olunacağını hekime sorun"],
    sonda_bakimi: ["Sonda seti (sağlık çalışanı getirir)", "Reçete / hekim istemi"],
    beslenme_tupu_bakimi: ["Mama ve enjektör evde hazır olsun"],
    fizyoterapi_seansi: ["Rahat kıyafet, hareket edecek alan", "Ameliyat raporu varsa"],
  };

  function transcriptText() {
    return P.msgs.filter((m) => !m.araLaf).map((m) => `${m.who === "me" ? "Hasta/yakını" : "Asistan"}: ${m.text}${m.photo ? " [fotoğraf eklendi]" : ""}`).join("\n");
  }
  async function aiReply() {
    if (CAP.server) {
      const imgs = P.pendingPhotos.map((p) => p.url); P.pendingPhotos = [];
      return CAP.server.sohbet(P.turns, P.photoNotes, imgs);
    }
    const turns = [{ role: "user", content: CHAT_RULES + (P.photoNotes.length ? `\nŞimdiye kadarki fotoğraf notları: ${P.photoNotes.join(" | ")}` : "") }, ...P.turns];
    const opts = { cache: false, modelTier: "quick" };
    if (P.pendingPhotos.length && CAP.images) opts.images = P.pendingPhotos.map((p) => p.blob);
    P.pendingPhotos = [];
    return CAP.sample.json(turns, opts);
  }
  async function aiReport() {
    if (CAP.server) return CAP.server.rapor(transcriptText(), P.photoNotes, P.photos.map((p) => p.url).filter(Boolean).slice(0, 3));
    const opts = {};
    const blobs = P.photos.map((p) => p.blob).filter(Boolean);
    if (blobs.length && CAP.images) opts.images = blobs.slice(0, 3);
    return CAP.sample.json(reportPrompt(transcriptText()), opts);
  }

  // ---------- sohbet akışı ----------
  function startChat(prefill) {
    // Her yeni sohbet yeni bir talep: önceki talebin plan/yatak/kişi/hizmet/saat bilgisi taşınmaz (adres ve ilçe kalır);
    // sohbet numarası artar, eski sohbetin geç gelen YZ cevabı ya da raporu bu sohbete yazılmaz.
    P.sohbetNo = (P.sohbetNo || 0) + 1; P.busy = false; P.saatler = null;
    if (CAP.dictation && P.listening) { try { CAP.dictation.stop(); } catch (e) { /**/ } P.listening = false; }
    Object.assign(P.info, { doktor: false, atlaMeslek: null, yzMeslek: null, hizmet: null, plan: "bilinmiyor", bed: false, forWhom: "", gun: 0, when: 570 });
    Object.assign(P, { gecmisSoru: null, gecmisSoruldu: false, atlaBekliyor: false });
    P.screen = "chat"; P.msgs = []; P.turns = []; P.photos = []; P.photoNotes = []; P.pendingPhotos = []; P.report = null; P.emergency = null; P.demoStep = 0; P.demoAnswers = [];
    const hello = "Merhaba, ben Kapıda asistanı. Ne olduğunu kendi cümlelerinle anlat ya da mikrofona basıp konuş. Birkaç kısa soru sorup seni doğru sağlık çalışanına yönlendireceğim.";
    if (P.mode === "ai") {
      P.msgs.push({ who: "ai", text: hello, quick: ["Annem için", "Babam için", "Kendim için"] });
    } else {
      P.msgs.push({ who: "ai", text: hello + "\n\n" + DEMO_Q[0][0], quick: DEMO_Q[0][1] });
    }
    renderP();
    if (prefill) { setTimeout(() => send(prefill), 50); }
  }
  async function send(text) {
    text = (text || "").trim();
    const photos = P.pendingShow || [];
    if (!text && !photos.length) return;
    if (P.busy) return;
    // Aynı mesaj çok kısa sürede ikinci kez (çift dokunma, ses tanımanın iki kez bitirmesi): yok say
    const sonMe = [...P.msgs].reverse().find((m) => m.who === "me");
    if (!photos.length && sonMe && sonMe.text === text && Date.now() - (sonMe.t || 0) < 1500) return;
    const no = P.sohbetNo;
    if (CAP.dictation && P.listening) { try { await CAP.dictation.stop(); } catch (e) { /**/ } }
    if (no !== P.sohbetNo) return;
    P.pendingShow = [];
    const shown = text || "Fotoğraf ekledim.";
    P.msgs.push({ who: "me", text: shown, photo: photos.map((p) => p.url), t: Date.now() });
    for (const m of P.msgs) delete m.quick;
    // 1) Kural motoru: her mesajda kırmızı bayrak (+ meslek, geçmiş belirti, sağlık içeriği)
    const d = degerlendir();
    if (d.acil) { acilAc(d.message, d.reasons[0], "Kural motoru"); return; }
    // 1a) Ara laf ("beni duyuyor musun", "tekrar eder misin", "bir saniye", "merhaba"): yerel kısa cevap,
    //     soru sayısına girmez, YZ'ye gitmez, demo sorusunu ilerletmez
    const laf = !photos.length && window.KapidaSesli ? window.KapidaSesli.araLaf(shown) : null;
    if (laf) {
      const me = P.msgs[P.msgs.length - 1]; me.araLaf = true;
      const onceki = [...P.msgs].reverse().find((m) => m.who === "ai" && !m.araLaf);
      const icerikVar = P.msgs.some((m) => m.who === "me" && !m.araLaf);
      const soru = !icerikVar ? "Ne olduğunu kendi cümlelerinle anlatır mısın?" : onceki ? (onceki.text.match(/[^.!?\n]*\?/g) || [onceki.text]).slice(-1)[0].trim() : "Devam edebilirsin.";
      const bas = { duyma: "Evet, seni duyuyorum.", tekrar: "Tabii, tekrar ediyorum.", bekle: "Tabii, acele etme. Hazır olduğunda devam et.", selam: "Merhaba!" }[laf];
      const cevap = laf === "bekle" ? bas : bas + " " + soru;
      P.msgs.push({ who: "ai", text: cevap, quick: onceki && onceki.quick ? onceki.quick : [], araLaf: true });
      speak(cevap); renderP(); return;
    }
    // 1b) Geçmişte yaşanmış acil belirti için sorduğumuz "şu an da var mı?" sorusunun cevabı
    if (P.gecmisSoru) {
      const s = P.gecmisSoru; P.gecmisSoru = null;
      const n = C.normalize(shown);
      if (/ (evet|var|hala|devam\w*|oluyor|suan|su an|simdi de|yine) /.test(n) && !/ (yok|hayir|degil|gecti|olmuyor|kalmadi) /.test(n)) {
        const rf = repo.red_flags.find((x) => s.kodlar.includes(x.code));
        if (rf) { acilAc(rf.message_tr, `Geçmişte yaşanan '${rf.name_tr}' şu an da sürüyor (beyan)`, "Kural motoru"); return; }
      }
    }
    // 1c) Yalnızca fiyat sorusu: başlangıç fiyatlarını yerel söyle (YZ'ye gitmez, soru hakkı harcanmaz)
    if (!photos.length && !d.saglik && /( fiyat| ucret| ne kadar| kac para| kac lira| kac tl)/.test(C.normalize(shown))) {
      P.msgs[P.msgs.length - 1].araLaf = true;
      const f = (c) => `${svc(c).name_tr.toLocaleLowerCase("tr")} ${svc(c).base_fee_tl} TL`;
      const cevap = `Başlangıç fiyatları: ${["ev_muayene", "tele_muayene", "yara_pansuman", "kan_alma", "fizyoterapi_seansi"].filter((c) => repo.services[c]).map(f).join(", ")}. Kesin fiyatı sağlık çalışanının teklifi belirler. Kimin için ve ne için istediğini söylersen sana uygun kişileri ve saatleri gösteririm.`;
      P.msgs.push({ who: "ai", text: cevap, araLaf: true }); speak(cevap); renderP(); return;
    }
    // 1d) "Direkt doktora yönlendir" / "soru sorma": soruları geç (acil kontrolü yukarıda yapıldı)
    if (DOKTOR_RE.test(C.normalize(shown)) || YONLENDIR_RE.test(C.normalize(shown)) || (P.atlaBekliyor && d.saglik)) { await doktoraYonlendir(); return; }
    // 1e) Geçmişte yaşanmış acil belirti ("geçen yıl bayılmıştı") ve şu anki durum söylenmedi: bir kez sor
    if (d.gecmis.length && !P.gecmisSoruldu) {
      P.gecmisSoruldu = true; P.gecmisSoru = { kodlar: d.gecmis };
      const soru = "Bunun daha önce yaşandığını anladım. Bu belirti şu anda da var mı?";
      P.turns.push({ role: "user", content: shown }, { role: "assistant", content: soru });
      P.msgs.push({ who: "ai", text: soru, quick: ["Evet, şu an da var", "Hayır, şu an yok"] }); speak(soru); renderP(); return;
    }
    // 2) YZ ya da demo
    if (P.mode === "ai") {
      P.turns.push({ role: "user", content: shown + (photos.length ? " [fotoğraf eklendi]" : "") });
      P.busy = true; renderP();
      try {
        const r = await aiReply();
        if (no !== P.sohbetNo) return; // kullanıcı bu arada yeni sohbete geçti: eski cevap yeni sohbete yazılmaz
        P.busy = false;
        const reply = String((r && r.reply) || "Anladım. Biraz daha anlatır mısın?");
        P.turns.push({ role: "assistant", content: reply });
        if (r && r.photo_notes) P.photoNotes.push(String(r.photo_notes));
        if (r && r.istenen_meslek && repo.professions[r.istenen_meslek]) P.info.yzMeslek = r.istenen_meslek;
        if (r && r.anlasilan) { const me = [...P.msgs].reverse().find((m) => m.who === "me"); if (me) me.understood = String(r.anlasilan).slice(0, 240); }
        if (r && r.red_flag) { acilAc(reply, String(r.red_flag_reason || "Asistan acil belirti sezdi"), "Yapay zekâ"); return; }
        P.msgs.push({ who: "ai", text: reply, quick: Array.isArray(r && r.quick_replies) ? r.quick_replies.slice(0, 4).map(String) : [] });
        speak(reply);
        // "Doktora yönlendir" kararını protokol verir: YZ işaretlese de kullanıcı bunu açıkça istemediyse ("bilmiyorum" gibi) soruları atlama
        if (r && r.doktora_yonlendir && acikYonlendirme(kullaniciMetni())) { P.info.doktor = true; P.info.atlaMeslek = null; await buildReport(); return; }
        if (r && r.doktora_yonlendir) {
          const son = P.msgs[P.msgs.length - 1];
          if (son && son.who === "ai" && /yönlendir/i.test(son.text)) {
            son.text = P.turns.filter((x) => x.role === "user").length <= 1 ? "Anlıyorum, birlikte bakalım. Kimin için yardım istiyorsun ve ne oldu, kısaca anlatır mısın?" : "Anladım. Biraz daha anlatır mısın, ne zamandır böyle?";
            son.quick = []; P.turns[P.turns.length - 1].content = son.text;
          }
        }
        // En fazla 3 soru: ilk anlatım + 3 cevaptan sonra YZ hazır demese de rapora geç
        const userTurns = P.turns.filter((x) => x.role === "user").length;
        // Şikâyet anlaşılmadan rapora geçme: YZ "hazır" dese de kullanıcı henüz derdini anlatmadıysa devam
        // Sağlıkla ilgili bir şey anlatılmadan (anlamsız/konu dışı konuşma) rapor çıkmaz
        const anlatti = d.saglik && P.turns.filter((x) => x.role === "user").map((x) => x.content).join(" ").trim().split(/\s+/).length >= 4;
        if (((r && r.ready) && anlatti) || (userTurns >= MAX_SORU + 1 && anlatti)) { await buildReport(); return; }
        renderP();
      } catch (e) {
        if (no !== P.sohbetNo) return;
        P.busy = false;
        if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e && e.code)) {
          P.mode = "demo"; P.toast = "Yapay zekâ bu görünümde kullanılamıyor; demo sorularıyla devam ediyoruz.";
          P.demoStep = 0; P.demoAnswers = [shown];
          P.msgs.push({ who: "ai", text: DEMO_Q[1][0], quick: DEMO_Q[1][1] }); P.demoStep = 1;
        } else if (e && e.code === "rate_limited") {
          P.msgs.push({ who: "ai", text: "Şu an çok yoğunum. Birkaç saniye sonra mesajını tekrar gönderir misin?" });
          P.turns.pop();
        } else {
          P.msgs.push({ who: "ai", text: "Bağlantıda bir sorun oldu. Mesajını tekrar gönderebilirsin." });
          P.turns.pop();
        }
        renderP();
      }
    } else {
      P.demoAnswers[P.demoStep] = shown;
      P.demoStep++;
      if (P.demoStep < DEMO_Q.length) {
        P.busy = true; renderP();
        setTimeout(() => { P.busy = false; P.msgs.push({ who: "ai", text: DEMO_Q[P.demoStep][0], quick: DEMO_Q[P.demoStep][1] }); speak(DEMO_Q[P.demoStep][0]); renderP(); }, 450);
      } else {
        await buildReport();
      }
    }
  }
  function demoReport() {
    const a = P.demoAnswers;
    const all = a.join(". ");
    const planA = (a[3] || "").toLowerCase(), bedA = (a[4] || "").toLowerCase();
    const plan = /evet|var|reçete/.test(planA) && !/yok|hayır/.test(planA) ? "var" : /hayır|yok/.test(planA) ? "yok" : "bilinmiyor";
    const bed = /yatağa/.test(bedA) ? true : /rahat/.test(bedA) ? false : null;
    const t = C.triage(repo, all, { bedridden: !!bed, has_physician_plan: plan === "var" });
    const route = repo.routes.find((r) => r.code === t.route);
    const code = route ? route.service_list[0] : "ev_muayene";
    return {
      kim_icin: a[1] || "belirtilmedi", yas_araligi: /70/.test(a[1] || "") ? "70 üstü" : "belirtilmedi",
      sikayet: a[0] || "belirtilmedi", hastanin_kendi_sozleri: a[0] || "belirtilmedi", baslangic: a[2] || "belirtilmedi", seyir: /kötüleş/.test(a[2] || "") ? "kötüleşiyor (beyan)" : "belirtilmedi",
      siddet_beyani: "belirtilmedi", yataga_bagimli: bed, hekim_plani: plan, plan_detayi: plan === "var" ? "Hasta yakını reçete/plan olduğunu belirtti; belge ziyarette görülmeli." : "",
      kronik_ilac_alerji: "belirtilmedi", ihtiyaclar: [svc(code).name_tr], malzeme: MATERIALS[code] || [],
      foto_ozeti: P.photos.length ? `${P.photos.length} fotoğraf eklendi (demo modunda yapay zekâ tarifi yok).` : "",
      eksik_bilgiler: ["Kronik hastalıklar ve kullanılan ilaçlar", "Alerji", "Hekim planının içeriği"],
      hizmet_onerisi: code, hasta_icin_ozet: `${a[0] || "Durum belirtilmedi"}${a[1] ? " (" + a[1] + ")" : ""}.${a[2] ? " Süre: " + a[2] + "." : ""}`,
      saglikci_icin_ozet: `Hasta yakını beyanı: ${a[0] || "-"}. Kim için: ${a[1] || "-"}. Başlangıç: ${a[2] || "-"}. Hekim planı: ${plan}. Bilgiler doğrulanmadı.`,
      tek_satir: (a[0] || svc(code).name_tr).split(/\s+/).slice(0, 10).join(" "),
    };
  }
  const MAX_SORU = 3;
  // Kural motoru tüm kullanıcı mesajları üzerinden (ara laflar hariç): acil, istenen meslek, geçmiş belirti, sağlık içeriği
  const degerlendir = () => C.konusmaDegerlendir(repo, P.msgs.filter((m) => m.who === "me" && !m.araLaf).map((m) => m.text), { bedridden: false, has_physician_plan: false });
  function acilAc(msg, why, src) {
    P.emergency = { msg, why, src }; P.screen = "emergency"; P.busy = false;
    if (CAP.dictation && P.listening) { try { CAP.dictation.stop(); } catch (e) { /**/ } P.listening = false; }
    renderP();
  }
  // Meslek isteği: kural motoru (profession_intents) + YZ'nin anladığı istenen_meslek. Seviye kararını yine triyaj verir.
  const HEKIMLER = new Set(["hekim", "uzman_hekim"]);
  const kullaniciMetni = () => P.msgs.filter((m) => m.who === "me").map((m) => m.text).join(". ");
  function istenenMeslek() {
    const [it] = C.requestedProfession(repo, C.normalize(kullaniciMetni()));
    if (it) return it.profession_code;
    const yz = (P.report && P.report.istenen_meslek) || P.info.yzMeslek;
    return yz && repo.professions[yz] ? yz : null;
  }
  const meslekAdi = (m) => (m ? repo.professions[m].name_tr.replace(/ \(.*\)$/, "") : "");
  const tamlama = (a) => /terapisti$/.test(a); // "dil ve konuşma terapisti" → terapistine / terapistinden / terapistleri
  const yonelme = (ad) => { if (tamlama(ad.toLocaleLowerCase("tr"))) return ad.toLocaleLowerCase("tr") + "ne"; const a = ad.toLocaleLowerCase("tr"), son = (a.match(/[aeıioöuü](?=[^aeıioöuü]*$)/) || ["e"])[0];
    return a + (/[aeıioöuü]$/.test(a) ? "y" : "") + (/[aıou]/.test(son) ? "a" : "e"); }; // hemşire → hemşireye, fizyoterapist → fizyoterapiste
  const kalin = (a) => /[aıou]/.test((a.match(/[aeıioöuü](?=[^aeıioöuü]*$)/) || ["e"])[0]);
  const ayrilma = (ad) => { const a = ad.toLocaleLowerCase("tr"); if (tamlama(a)) return a + "nden"; return a + (/[çfhkpsşt]$/.test(a) ? "t" : "d") + (kalin(a) ? "an" : "en"); }; // hemşireden, fizyoterapistten
  const cogul = (ad) => { const a = ad.toLocaleLowerCase("tr"); if (tamlama(a)) return a.slice(0, -1) + "leri"; return a + (kalin(a) ? "lar" : "ler"); };
  const MESLEK_KELIME = "doktor|hekim|hemsire|ebe|fizyoterapist|fizik tedavici|odyolog|diyetisyen|psikolog|podolog|ergoterapist|konusma terapist";
  const YONLENDIR_RE = new RegExp(`(direk|direkt|dogrudan|hemen|bir an once)\\s*(bir\\s*)?(${MESLEK_KELIME})|(${MESLEK_KELIME})(a|e|ya|ye)?\\s*(yonlendir|bagla|gonder)`);
  // Kullanıcı soruların atlanmasını açıkça istedi mi? (YZ'nin doktora_yonlendir işareti yalnızca buna dayanır)
  const ACIK_YONLENDIR_RE = /doktor(a)? (baksin|gelsin|gorsun|bakmali|baksa)|hekim (baksin|gelsin|gorsun)|soru(lari)? (sorma|gec|atla|yeter)|uzatma|direk|dogrudan|yonlendir/;
  const acikYonlendirme = (t) => { const n = C.normalize(t); return DOKTOR_RE.test(n) || YONLENDIR_RE.test(n) || ACIK_YONLENDIR_RE.test(n); };
  const DOKTOR_RE = /(direk|direkt|dogrudan|hemen|bir an once)\s*(bir\s*)?(doktor|hekim)|(doktor|hekim)(a|e)?\s*(yonlendir|bagla|gonder|gorusmek|bakmasini|baksin)|(doktor|hekim)\s*istiyorum|soru\s*sorma|sorulari\s*(gec|atla)|uzatma/;
  async function doktoraYonlendir() {
    const m = istenenMeslek();
    if (!m && !degerlendir().saglik) {
      // Kısa yol istendi ama henüz ne olduğu söylenmedi: boş rapor yerine tek bir şey sor; sonraki içerikli mesajda doğrudan geçilir
      P.atlaBekliyor = true;
      const t = "Tamam, soru sormayacağım. Kimin için ve ne olduğunu tek cümleyle söyle, doğrudan ileteyim.";
      P.msgs.push({ who: "ai", text: t }); speak(t); renderP(); return;
    }
    P.info.doktor = true; P.info.atlaMeslek = m && !HEKIMLER.has(m) ? m : null;
    const t = P.info.atlaMeslek
      ? `Tamam, soruları geçiyorum. Seni ${yonelme(meslekAdi(m))} yönlendireceğim. ${meslekAdi(m)} doktor planıyla gelebildiği için bir sonraki ekranda doktorunun planı ya da reçetesi olup olmadığını seçmen yeterli.`
      : "Tamam, soruları geçiyorum. Anlattıklarını doktora ileteceğim; doktor gerekirse kendisi sorar.";
    P.msgs.push({ who: "ai", text: t }); speak(t);
    await buildReport();
  }
  async function buildReport() {
    const no = P.sohbetNo;
    P.screen = "building"; renderP();
    let rep = null;
    if (P.mode === "ai") {
      try { rep = await aiReport(); } catch (e) { P.toast = "Rapor yapay zekâyla hazırlanamadı; senin cevaplarınla basit bir özet çıkardık."; }
      if (no !== P.sohbetNo) return;
    }
    if (!rep || typeof rep !== "object") {
      if (P.mode === "ai") { const me = P.msgs.filter((m) => m.who === "me").map((m) => m.text); P.demoAnswers = [me.join(". "), "", "", "", ""]; }
      rep = demoReport();
    }
    if (!repo.services[rep.hizmet_onerisi]) rep.hizmet_onerisi = "ev_muayene";
    if (!repo.professions[rep.istenen_meslek]) rep.istenen_meslek = istenenMeslek() || "";
    if (P.info.doktor && P.info.atlaMeslek) {
      const ad = meslekAdi(P.info.atlaMeslek);
      rep.istenen_meslek = P.info.atlaMeslek;
      rep.oneri_gerekcesi = `Hasta/yakını soruları geçip doğrudan ${ad.toLocaleLowerCase("tr")} istedi.`;
      rep.hasta_icin_ozet = `İsteğin üzerine seni ${yonelme(ad)} yönlendiriyoruz.` + (rep.sikayet && rep.sikayet !== "belirtilmedi" ? " İletilecek: " + rep.sikayet + "." : "");
      rep.eksik_bilgiler = [`Ayrıntılar ${yonelme(ad)} ziyarette sorulacak (kullanıcı soruları geçti)`, ...(rep.eksik_bilgiler || [])];
    } else if (P.info.doktor) {
      rep.hizmet_onerisi = "ev_muayene";
      rep.oneri_gerekcesi = "Hasta/yakını soruları geçip doğrudan doktor değerlendirmesi istedi.";
      rep.hasta_icin_ozet = "İsteğin üzerine seni doğrudan bir doktora yönlendiriyoruz." + (rep.sikayet && rep.sikayet !== "belirtilmedi" ? " Doktora iletilecek: " + rep.sikayet + "." : "");
      rep.eksik_bilgiler = ["Ayrıntılar doktor tarafından sorulacak (kullanıcı soruları geçti)", ...(rep.eksik_bilgiler || [])];
    }
    ["ihtiyaclar", "malzeme", "eksik_bilgiler", "dikkat_edilecekler"].forEach((k) => { if (!Array.isArray(rep[k])) rep[k] = rep[k] ? [String(rep[k])] : []; });
    // Rapor denetimi: söylenmeyen yaş/ilaç/alerji/onay çıkar, "bilmiyorum" → bilinmiyor, düzeltmede son söylenen (denetim.js)
    if (window.KapidaDenetim) rep = window.KapidaDenetim.raporDenetle(rep, { mesajlar: P.msgs.map((m) => ({ kim: m.who, metin: m.text, araLaf: !!m.araLaf })) });
    P.report = rep;
    P.info.bed = rep.yataga_bagimli === true;
    P.info.plan = ["var", "yok"].includes(rep.hekim_plani) ? rep.hekim_plani : "bilinmiyor";
    P.info.forWhom = rep.kim_icin || "";
    P.screen = "summary"; renderP();
  }
  function speak(text) {
    if (!P.voice || !CAP.tts || SV.acik) return; // sesli modda seslendirmeyi sesli asistan yapar
    CAP.tts.speak(String(text).slice(0, 1900)).catch(() => { /* sessiz */ });
  }

  // ---------- seviye ve seçenekler ----------
  function patientPoint() {
    if (P.info.nokta) { const n = P.info.nokta; return { lat: n.lat, lon: n.lon, bedridden: P.info.bed, has_physician_plan: P.info.plan === "var", district: P.info.district, id: "ADRES", adres: n.adres }; }
    const pts = Object.values(repo.patients).filter((p) => p.district === P.info.district);
    const p = pts[0] || Object.values(repo.patients)[0];
    return { lat: p.lat, lon: p.lon, bedridden: P.info.bed, has_physician_plan: P.info.plan === "var", district: P.info.district, id: p.id };
  }
  // "Ne zaman?": sabit dilimler yerine bugün gerçekten uygun varış saatleri (sağlık çalışanlarının takvimi,
  // ziyaret paylaşımı ve İzmir yol süreleriyle). Her saat = o saatten itibaren gelebilecek en erken kişi.
  function uygunSaatler() {
    const { t, pt } = decide(), service = t.services[0];
    const key = [service, pt.lat, pt.lon, P.info.bed, t.profession, t.level].join("|");
    if (P.saatler && P.saatler.key === key) return P.saatler.list;
    const LEAD = C.CFG.LEAD_TIME_MIN, list = [];
    // Bugün: şimdi (09:30) ve sonrası; yarın: 08:00'den itibaren
    const hedefler = [[0, SIMDI, [SIMDI + LEAD, 660, 780, 900, 1020, 1110]], [1, 450, [480, 600, 720, 840, 960, 1080]]];
    for (const [gun, simdi, saatler] of hedefler) {
      const gunList = [];
      for (const hedef of saatler) {
        const bas = Math.max(simdi, hedef - LEAD);
        const res = C.findCandidates(repo, service, pt, gunTarih(gun), bas, SORTS.onerilen[1], 20, 60); // tüm uygunlar: en erken varış puan sırasına bağlı olmasın
        res.candidates = meslekSuz(t, res.candidates);
        if (!res.candidates.length) continue;
        const ilk = Math.min(...res.candidates.map((c) => c.arrival_min));
        if (gunList.some((x) => Math.abs(x.ilk - ilk) < 45)) continue; // birbirine çok yakın saatleri gösterme
        gunList.push({ gun, when: bas, ilk, kisi: res.candidates.length, fazla: false, enErken: !gunList.length });
      }
      list.push(...gunList);
    }
    P.saatler = { key, list };
    return list;
  }
  function saatSecimi() {
    if (P.triage && P.triage.is_emergency) return "";
    const list = uygunSaatler();
    if (!list.length) return `<div class="stack" style="gap:6px"><b class="small">Ne zaman?</b><div class="note small">Bugün ve yarın için uygun saat bulunamadı. Yine de seçeneklere bakabilirsin.</div></div>`;
    if (!list.some((x) => x.gun === P.info.gun && x.when === P.info.when)) { P.info.gun = list[0].gun; P.info.when = list[0].when; }
    const grup = (g) => {
      const l = list.filter((x) => x.gun === g);
      return `<div class="gun-baslik"><b>${GUNLER[g].ad}</b> <span>${GUNLER[g].uzun}</span></div>
        ${l.length ? `<div class="saatler">${l.map((x) => `<button class="saat" type="button" data-when="${x.gun}:${x.when}" aria-pressed="${P.info.gun === x.gun && P.info.when === x.when}"><b>${C.hhmm(x.ilk)}</b><span>${x.enErken ? "en erken · " : ""}${x.kisi}${x.fazla ? "+" : ""} kişi</span></button>`).join("")}</div>`
        : `<div class="tiny muted">Bu gün için uygun saat kalmadı.</div>`}`;
    };
    return `<div class="stack" style="gap:8px"><b class="small">Ne zaman gelsin?</b>${grup(0)}${grup(1)}
      <div class="tiny muted">Saatler sağlık çalışanlarının bugünkü ve yarınki takvimine ve yol süresine göre hesaplandı; seçtiğin saatten itibaren gelebilecek kişiler listelenir.</div></div>`;
  }
  function decide() {
    const pt = patientPoint();
    let userText = kullaniciMetni() + ". " + (P.report.sikayet || "");
    // YZ meslek isteğini anladıysa ama kural sözlüğü yakalamadıysa (ör. yöresel ifade), sözlükteki ifadesini ekle: kararı yine kural verir
    const mes = istenenMeslek();
    if (mes && !C.requestedProfession(repo, C.normalize(userText))[0]) {
      const it = repo.intents.find((x) => x.profession_code === mes && x.code !== "MI_HEKIM_TELE");
      if (it) userText += ". " + it.keywords.split("|")[0].split(";").join(" ");
    }
    let t = C.triage(repo, userText, pt);
    const sug = P.report.hizmet_onerisi;
    if (!t.is_emergency && !t.route && sug) {
      // Kural motoru kalıp bulamadı: YZ'nin hizmet önerisini mevzuat kuralıyla süz
      const s = svc(sug);
      let level, services;
      if (s.needs_physician_order && !pt.has_physician_plan) { level = pt.bedridden ? "HEKIM_EV" : "TELE"; services = [level === "HEKIM_EV" ? "ev_muayene" : "tele_muayene"]; }
      else if ((repo.profession_services.hekim || new Set()).has(sug)) { level = s.remote_possible ? "TELE" : "HEKIM_EV"; services = [sug]; }
      else { level = "PLANLI"; services = [sug]; }
      if (level === "TELE" && pt.bedridden && sug !== "recete_rapor_yenileme") { level = "TELE_HEMSIRE"; services = ["tele_hemsire_destekli"]; }
      t = { ...t, level, services, route: "YZ:" + sug, reasons: ["Asistanın hizmet önerisi: " + s.name_tr] };
    }
    if (P.info.doktor && !P.info.atlaMeslek && !t.is_emergency) {
      t = { ...t, level: "HEKIM_EV", services: ["ev_muayene"], route: "KULLANICI:doktor", profession: "hekim", reasons: ["İsteğin üzerine doğrudan doktora yönlendirildin."] };
    }
    // Plan varsa istenen mesleğin hizmetlerinden biri seçilebilir (ör. hemşire: iğne, pansuman, serum…)
    if (!t.is_emergency && t.level === "PLANLI" && t.profession && !HEKIMLER.has(t.profession)) {
      const h = meslekHizmetleri(t.profession);
      if (P.info.hizmet && h.includes(P.info.hizmet)) t = { ...t, services: [P.info.hizmet] };
    }
    return { t, pt };
  }
  const meslekHizmetleri = (m) => [...(repo.profession_services[m] || [])].filter((s) => svc(s).category !== "tele").sort((a, b) => svc(a).name_tr.localeCompare(svc(b).name_tr, "tr"));
  // İstenen meslek varsa listede yalnızca o meslek (doktor isteğinde uzman hekim de); plan yoksa doktor adayları kalır
  function meslekSuz(t, cands) {
    const m = t && t.profession;
    if (!m) return cands;
    const ok = HEKIMLER.has(m) ? (p) => HEKIMLER.has(p) : t.level === "PLANLI" ? (p) => p === m : null;
    if (!ok) return cands;
    const f = cands.filter((c) => ok(repo.providers[c.provider_id].profession_code));
    return f.length ? f : cands;
  }
  const SORTS = { onerilen: ["Önerilen", { yetkinlik: 1, fiyat: 1, hiz: 1 }], ucuz: ["En uygun fiyat", { yetkinlik: 1, fiyat: 5, hiz: 1 }], erken: ["En erken", { yetkinlik: 1, fiyat: 1, hiz: 5 }], deneyim: ["En deneyimli", { yetkinlik: 5, fiyat: 1, hiz: 1 }] };
  function levelCopy(level, service, istenen) {
    const prof = istenen && !HEKIMLER.has(istenen) && level === "PLANLI" ? meslekAdi(istenen).toLocaleLowerCase("tr") : (() => { const ps = [...repo.professionsFor(service)].filter((x) => x !== "hekim" && x !== "uzman_hekim"); return ps.length ? repo.professions[ps[0]].name_tr.toLowerCase() : "sağlık çalışanı"; })();
    return {
      PLANLI: [ICO.home, `Bir ${prof} evine gelir`, "Doktorunun planı olduğu için doğrudan uygun sağlık çalışanını gönderebiliyoruz."],
      HEKIM_EV: [ICO.steth, "Önce bir doktor evine gelip baksın", "Hemşire ya da fizyoterapist ancak doktor planıyla gelebilir (yönetmelik). Doktor gerekirse planı yazar."],
      TELE: [ICO.video, "Önce doktorla görüntülü görüş", "Kısa bir görüntülü görüşmeyle doktor durumu değerlendirir; gerekirse eve hemşire ya da doktor gönderir."],
      TELE_HEMSIRE: [ICO.bed, "Hemşire evine gelir, doktor görüntülü bağlanır", "Evden çıkamayan hasta için: hemşire ölçümleri yapar, doktor aynı anda görüntülü değerlendirir."],
    }[level];
  }

  // ---------- HASTA EKRANLARI ----------
  function stepsBar(n) {
    const labels = ["Anlat", "Kontrol et", "Seç", "Onayla"];
    return `<div class="stack" style="gap:6px"><div class="steps">${labels.map((_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>
      <div class="steplabel">Adım ${n}/4 · ${labels[n - 1]}</div></div>`;
  }
  function renderP() {
    if (SV.acik && !["chat", "building", "summary", "emergency"].includes(P.screen)) SV.kapat();
    const el = $("#pScreen");
    const scr = { home: pHome, chat: pChat, building: pBuilding, summary: pSummary, options: pOptions, done: pDone, emergency: pEmergency }[P.screen] || pHome;
    el.innerHTML = scr() + (P.sheet !== null && P.screen === "options" ? pSheet() : "") + (P.toast ? `<div class="toast" role="status">${esc(P.toast)}</div>` : "");
    if (P.toast) { const t = P.toast; setTimeout(() => { if (P.toast === t) { P.toast = ""; const n = $("#pScreen .toast"); if (n) n.remove(); } }, 3800); }
    if (P.screen === "chat") { const m = $("#pMsgs"); if (m) m.scrollTop = m.scrollHeight; }
  }
  // Ana ekranda yaklaşan randevu ve "Randevularım": randevuya her zaman geri dönülebilsin
  const DURUM_AD = { bekliyor: "Onay bekliyor", kabul: "Onaylandı", red: "Uygun değil", iptal: "İptal edildi" };
  function randevuDurumu(r) {
    const gs = G.durum(r) || {};
    if (r.status === "kabul" && gs.hastaOnay === "tamam") return ["Tamamlandı", "plain"];
    if (r.status === "kabul" && gs.checkin && !gs.checkout) return ["Ziyaret sürüyor", "good"];
    return [DURUM_AD[r.status] || r.status, r.status === "kabul" ? "good" : r.status === "bekliyor" ? "sun" : "plain"];
  }
  function randevuKartlari() {
    const liste = (P.randevular || []).map((id) => (P.request && P.request.id === id ? P.request : REQ.find((x) => x.id === id))).filter(Boolean);
    if (!liste.length) return "";
    const aktif = liste.find((r) => ["bekliyor", "kabul"].includes(r.status) && randevuDurumu(r)[0] !== "Tamamlandı");
    const satir = (r) => { const [d, renk] = randevuDurumu(r); return `<button class="randevu-satir" type="button" data-act="takip" data-id="${r.id}">
        <span><b>${esc(svc(r.service).name_tr)}</b><span class="small muted">${gunEki(r)}${C.hhmm(r.arrival_min)} · ${esc(person(r.provider_id).full)}</span></span><span class="pill ${renk}">${esc(d)}</span></button>`; };
    return `${aktif ? `<div class="card yaklasan stack" style="gap:8px"><div class="row between"><b>Yaklaşan randevun</b><span class="pill ${randevuDurumu(aktif)[1]}">${esc(randevuDurumu(aktif)[0])}</span></div>
        <div>${esc(svc(aktif.service).name_tr)} · ${gunEki(aktif)}<b>${C.hhmm(aktif.arrival_min)}</b></div><div class="small muted">${esc(person(aktif.provider_id).full)} · toplam ${tl(aktif.price.patient_pays)} TL</div>
        <button class="btn primary block" type="button" data-act="takip" data-id="${aktif.id}">Takip et${aktif.status === "kabul" && !aktif.gun ? " · kapı kodu burada" : ""}</button></div>` : ""}
      ${liste.length ? `<details class="randevularim"${aktif ? "" : " open"}><summary><b>Randevularım</b> <span class="small muted">(${liste.length})</span></summary><div class="stack" style="gap:6px;margin-top:8px">${liste.map(satir).join("")}</div></details>` : ""}`;
  }
  function pHome() {
    return `<div class="pad stack" style="gap:16px">${randevuKartlari()}
      <div class="row between"><div><div class="small muted">İyi günler${window.KAPIDA_OTURUM && /hasta|ikisi/.test(window.KAPIDA_OTURUM.rol) ? " " + HESAPLAR.hasta.ad.split(" ")[0] : ""}</div><h2 style="font-size:20px">Bugün nasıl yardımcı olalım?</h2></div>
        <span class="pill ${P.mode === "ai" ? "good" : "plain"}">${P.mode === "ai" ? "Yapay zekâ açık" : P.mode === "loading" ? "Hazırlanıyor" : "Demo modu"}</span></div>
      <div class="hero"><span class="deco"></span>
        <h1>Ne olduğunu anlat,<br>gerisini biz ayarlayalım.</h1>
        <div class="small" style="opacity:.9">Konuşarak ya da yazarak anlat. Fotoğraf ekleyebilirsin. Fiyatı seçmeden önce görürsün.</div>
        <button class="talk" type="button" data-act="start"><span class="mic">${ICO.mic}</span><span>Anlatmaya başla<br><span class="small muted" style="font-weight:500">yaklaşık 2 dakika</span></span></button>
        ${SV.var() ? `<button class="talk sesli-gir" type="button" data-act="sesli"><span class="mic">${ICO.dalga}</span><span>Sesli asistanla konuş<br><span class="small muted" style="font-weight:500">el değmeden, telefonda konuşur gibi</span></span></button>` : ""}
      </div>
      <div class="how"><div><span class="n">1</span>Anlat</div><div><span class="n">2</span>Fiyatı gör, seç</div><div><span class="n">3</span>Kapında</div></div>
      <div class="stack" style="gap:8px"><div class="row between"><h3 style="font-size:16px">Sık istenenler</h3><span class="tiny muted">başlangıç fiyatları</span></div>
        <div class="tiles">${TILES.map(([code, name, pre]) => `<button class="tile" type="button" data-tile="${esc(pre)}">
          <span class="t-ico">${svcIcon(code)}</span><b>${esc(name)}</b><span class="from"><b class="num">${tl(fromPrice(code))} TL</b>'den</span></button>`).join("")}</div></div>
      <div class="sos">${ICO.alert}<span>Göğüs ağrısı, nefes darlığı, bilinç kaybı gibi acil durumlarda beklemeyin: <b>112</b></span></div>
    </div>`;
  }
  function pChat() {
    if (SV.acik) return pSesli();
    const last = P.msgs[P.msgs.length - 1];
    const quick = !P.busy && last && last.who === "ai" && last.quick && last.quick.length ? last.quick : [];
    return `<div class="chatwrap">
      <div class="chathead"><button class="back" type="button" data-act="home" aria-label="Geri">${ICO.back}</button><div class="bot">K</div>
        <div style="flex:1"><b>Kapıda asistanı</b><div class="tiny muted">${P.mode === "ai" ? (CAP.server ? "Yapay zekâ (sunucu) · teşhis koymaz" : "Yapay zekâ · teşhis koymaz") : "Demo soruları · teşhis koymaz"}</div></div>
        ${SV.var() ? `<button class="iconbtn" type="button" data-act="sesliac" title="Sesli asistan (el değmeden konuş)" aria-label="Sesli asistanı aç">${ICO.dalga}</button>` : ""}
        ${CAP.tts ? `<button class="iconbtn" type="button" data-act="voice" aria-pressed="${P.voice}" title="Yanıtları sesli oku" style="${P.voice ? "background:var(--brand-soft)" : ""}">${ICO.speaker}</button>` : ""}</div>
      <div class="pad" style="padding:10px 16px 0">${stepsBar(1)}</div>
      <div class="msgs" id="pMsgs">${P.msgs.map((m) => `<div class="msg ${m.who}">${esc(m.text)}${(m.photo || []).map((u) => `<img src="${u}" alt="Eklenen fotoğraf">`).join("")}</div>${m.understood ? `<div class="understood">Anladığım: ${esc(m.understood)}</div>` : ""}`).join("")}
        ${P.busy ? `<div class="msg ai"><span class="typing"><i></i><i></i><i></i></span></div>` : ""}</div>
      ${quick.length ? `<div class="quick">${quick.map((q) => `<button class="chip" type="button" data-quick="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}
      ${!P.busy && P.msgs.some((m) => m.who === "me") ? `<div class="skipdoc"><button class="btn ghost" type="button" data-act="skipdoc">Soruları geç, ${(() => { const m = istenenMeslek(); return m && !HEKIMLER.has(m) ? yonelme(meslekAdi(m)) : "doktora"; })()} yönlendir →</button></div>` : ""}
      ${(P.pendingShow || []).length ? `<div class="thumbs">${P.pendingShow.map((p) => `<img src="${p.url}" alt="Gönderilecek fotoğraf">`).join("")}<span class="tiny muted">gönderince eklenir</span></div>` : ""}
      <form class="composer" id="pComposer">
        <label class="iconbtn" title="Fotoğraf ekle" style="cursor:pointer">${ICO.cam}<input type="file" accept="image/*" id="pPhoto" hidden></label>
        <textarea id="pInput" rows="1" placeholder="Yaz ya da konuş…" aria-label="Mesajın"></textarea>
        ${CAP.dictation ? `<button class="iconbtn mic${P.listening ? " listening" : ""}" type="button" id="pMic" title="Konuşarak anlat">${ICO.mic}</button>` : ""}
        <button class="iconbtn send" type="submit" title="Gönder" ${P.busy ? "disabled" : ""}>${ICO.send}</button>
      </form></div>`;
  }
  function pBuilding() {
    return `<div class="pad stack" style="height:100%;justify-content:center;align-items:center;text-align:center;gap:16px">
      <div class="bot" style="width:64px;height:64px;font-size:26px;border-radius:20px">K</div>
      <h2>Anlattıklarını özetliyoruz</h2><div class="muted">Sağlık çalışanına gidecek raporu hazırlıyoruz. Göndermeden önce sen kontrol edeceksin.</div>
      <span class="typing"><i></i><i></i><i></i></span></div>`;
  }
  function pSummary() {
    const r = P.report;
    const opt = (v, lbl) => `<button class="chip" type="button" data-plan="${v}" aria-pressed="${P.info.plan === v}">${lbl}</button>`;
    const districts = window.EVDE_DATA.districts.map((d) => d.name);
    return `<div class="pad stack">
      <button class="back" type="button" data-act="chat">${ICO.back} Sohbete dön</button>
      ${stepsBar(2)}
      <h2 style="font-size:22px">Seni doğru anladık mı?</h2>
      <div class="card soft stack" style="gap:6px"><div class="small muted">Senin anlattığın</div><div>${esc(r.hasta_icin_ozet || r.sikayet)}</div>
        ${(() => { const m = istenenMeslek(); return m && !HEKIMLER.has(m) ? `<div class="small"><b>İstediğin sağlık çalışanı: ${esc(meslekAdi(m))}</b></div>` : ""; })()}</div>
      ${P.photos.length ? `<div class="stack" style="gap:6px"><div class="small muted">Fotoğraflar</div><div class="photos">${P.photos.map((p) => `<img src="${p.url}" alt="Eklenen fotoğraf">`).join("")}</div></div>` : ""}
      <div class="card stack" style="gap:10px">
        <div class="stack" style="gap:6px"><b class="small">Doktorun planı ya da reçetesi var mı?</b>
          <div class="seg">${opt("var", "Var")}${opt("yok", "Yok")}${opt("bilinmiyor", "Emin değilim")}</div>
          <div class="tiny muted">Hemşire, fizyoterapist gibi meslekler yalnızca doktor planıyla gelebilir.</div></div>
        <label class="row small" style="gap:10px"><input type="checkbox" id="pBed" ${P.info.bed ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--brand)"> Yatağa bağımlı / evden çıkamıyor</label>
        ${ADR ? `<div class="stack small" style="gap:4px"><label for="pAdres"><b>Adres</b> <span class="muted">(sokak, cadde ya da mahalle)</span></label>
          <input class="inp" id="pAdres" type="search" autocomplete="off" placeholder="ör. Kazımdirik Mah. 372. Sok." value="${esc(P.info.adresYazi || "")}">
          <div id="pAdresList" class="stack" style="gap:4px"></div>
          ${P.info.nokta ? `<div class="tiny muted">📍 ${esc(P.info.nokta.adres)} · haritada en yakın yol noktasına yerleştirildi (~${String(P.info.nokta.km.toFixed(1)).replace(".", ",")} km)</div>` : `<div class="tiny muted">Adresler © OpenStreetMap katkıcıları. Yazmazsan ilçe merkezi kullanılır.</div>`}</div>` : ""}
        <label class="stack small" style="gap:4px" for="pDist"><b>Hangi ilçe?${ADR ? "" : " (açık adres sonra)"}</b>
          <select class="inp" id="pDist">${districts.map((d) => `<option${d === P.info.district ? " selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
        ${saatSecimi()}
      </div>
      ${r.malzeme && r.malzeme.length ? `<div class="card stack" style="gap:6px"><b class="small">Hazırlık</b>${r.malzeme.map((m) => `<div class="row small">${ICO.check}<span>${esc(m)}</span></div>`).join("")}</div>` : ""}
      <details class="card"><summary class="small" style="font-weight:700;cursor:pointer">Sağlık çalışanı ne görecek?</summary>
        <div class="stack small" style="gap:6px;margin-top:8px"><div>${esc(r.saglikci_icin_ozet)}</div>
        ${r.foto_ozeti ? `<div class="muted">Fotoğraf: ${esc(r.foto_ozeti)}</div>` : ""}
        <div class="muted">Teşhis içermez; senin beyanındır.</div></div></details>
      <button class="btn primary block" type="button" data-act="options">Seçenekleri ve fiyatları gör</button>
      <div class="tiny muted" style="text-align:center">Bu bir teşhis değildir. Durum kötüleşirse 112'yi ara.</div>
    </div>`;
  }
  // Kullanıcı belirli bir meslek istediyse: ne olacağını açıkla, plan varsa hizmeti seçtir, plan yoksa nedenini söyle
  function meslekKarti(t) {
    const m = t.profession;
    if (!m || HEKIMLER.has(m)) return "";
    const ad = meslekAdi(m);
    if (t.level === "PLANLI") {
      const h = meslekHizmetleri(m);
      return `<div class="card stack meslek-kart" style="gap:8px"><div class="small"><b>İstediğin: ${esc(ad)}</b> · doktorunun planı olduğu için doğrudan ${esc(yonelme(ad))} yönlendiriyoruz. Aşağıda yalnızca ${esc(cogul(ad))} var.</div>
        ${h.length > 1 ? `<div class="tiny muted">${esc(ayrilma(ad).replace(/^./, (c) => c.toLocaleUpperCase("tr")))} ne istiyorsun?</div><div class="seg">${h.map((x) => `<button class="chip" type="button" data-hizmet="${x}" aria-pressed="${t.services[0] === x}">${esc(svc(x).name_tr)}</button>`).join("")}</div>` : ""}</div>`;
    }
    const hemsire = m === "hemsire" && t.level === "TELE_HEMSIRE";
    return `<div class="card stack meslek-kart" style="gap:8px"><div class="small"><b>İstediğin: ${esc(ad)}</b></div>
      <div class="small">${hemsire ? "Doktor planı olmadığı için hemşire evine gelir, doktor da aynı anda görüntülü bağlanır. Böylece hemşire yasal olarak hizmet verebilir." : `${esc(ad)} yalnızca doktorun planıyla gelebilir (yönetmelik). Önce bir doktor bakar; plan yazarsa aynı uygulamadan ${esc(ad.toLocaleLowerCase("tr"))} çağırabilirsin.`}</div>
      <button class="btn" type="button" data-plan="var" data-yenile="1">Doktorumun planı / reçetesi var</button>
      <div class="tiny muted">Planı ziyarette ${esc(yonelme(ad))} göstermen gerekir.</div></div>`;
  }
  function pOptions() {
    const { t, pt } = decide();
    P.triage = t;
    if (t.is_emergency) { P.emergency = { msg: t.message, why: t.reasons[0], src: "Kural motoru" }; P.screen = "emergency"; return pEmergency(); }
    const service = t.services[0];
    const res = C.findCandidates(repo, service, pt, gunTarih(P.info.gun), P.info.when, SORTS[P.sort][1], 20, 60);
    P.cands = meslekSuz(t, res.candidates).slice(0, 10); P.pt = pt; // YZ teklif katmanı bu 10 kişi arasından seçer
    const [ico, head, why] = levelCopy(t.level, service, t.profession);
    const yz = TK && P.cands.length ? teklifPlani(service, pt) : null;
    return `<div class="pad stack">
      <button class="back" type="button" data-act="summary">${ICO.back} Özete dön</button>
      ${stepsBar(3)}
      <div class="levelcard"><span class="lv-ico">${ico}</span><div class="stack" style="gap:4px"><b>${esc(head)}</b><span class="small">${esc(why)}</span>
        <span class="small muted">Hizmet: ${esc(svc(service).name_tr)} · ${svc(service).duration_min} dk</span></div></div>
      ${meslekKarti(t)}
      <div class="seg" role="group" aria-label="Sıralama">${Object.entries(SORTS).map(([k, [l]]) => `<button class="chip" type="button" data-sort="${k}" aria-pressed="${P.sort === k}">${l}</button>`).join("")}</div>
      ${yz ? teklifKarti(yz) : ""}
      ${yz ? `<details class="klasik" id="klasikListe"${P.klasikAcik || (teklifDurumu(yz).bitti && !teklifDurumu(yz).satirlar.some((r) => r.verir)) ? " open" : ""}><summary class="small">Tüm uygun kişiler (klasik liste, ${P.cands.length})</summary><div class="stack" style="gap:10px;margin-top:10px">` : ""}
      ${P.cands.length ? P.cands.map((c, i) => optCard(c, i)).join("") : `<div class="card soft">Bu saat için uygun kişi bulamadık. "Ne zaman?" seçimini değiştirip tekrar dene.</div>`}
      ${yz ? `</div></details>` : ""}
      <div class="tiny muted" style="text-align:center">Fiyatlar örnektir. Ödeme ziyaret tamamlanınca alınır (demo).</div>
    </div>`;
  }
  // ---- YZ teklif akışı ----
  // Konum ve iş durumu (demo saati SIMDI): ziyaretteyse o ziyaretin yeri, bitmişse son ziyaret, yoksa ev
  function calisanDurumu(pid) {
    const p = repo.providers[pid], gun = (repo.scheduled[pid + "|" + DATE] || []).slice().sort((a, b) => a.start_min - b.start_min);
    const icinde = gun.find((v) => v.start_min <= SIMDI && SIMDI < v.start_min + v.duration_min);
    const biten = gun.filter((v) => v.start_min + v.duration_min <= SIMDI).pop();
    const yer = icinde ? [icinde.lat, icinde.lon] : biten ? [biten.lat, biten.lon] : [p.home_lat, p.home_lon];
    return { yer, ziyarette: !!icinde, bosalmayaKalan: icinde ? icinde.start_min + icinde.duration_min - SIMDI : 0, ziyaretBugun: gun.length };
  }
  function teklifPlani(service, pt) {
    const key = [service, pt.lat, pt.lon, P.info.gun, P.info.when, P.cands.map((c) => c.provider_id).join(",")].join("|");
    if (P.yz && P.yz.key === key) return P.yz;
    const taban = svc(service).base_fee_tl;
    const adaylar = P.cands.map((c, i) => {
      const pv = repo.providers[c.provider_id], d = calisanDurumu(c.provider_id), uzak = !c.insertion;
      return { pid: c.provider_id, idx: i, meslek: pv.profession_code, carpan: pv.fee_multiplier, doktor: /hekim/.test(pv.profession_code),
        yolDk: uzak ? 0 : Math.max(1, C.travel(d.yer, [pt.lat, pt.lon], SIMDI, ulasim(c.provider_id))), toplu: ulasim(c.provider_id) === "toplu", bosalmayaKalan: d.bosalmayaKalan, ziyarette: d.ziyarette,
        enErkenVaris: c.arrival_min, ziyaretBugun: d.ziyaretBugun, bildirim: 0, yeni: !c.visits };
    });
    const plan = TK.planla({ adaylar, taban, simdi: SIMDI, pencereSonu: P.info.when + 120, tohum: key });
    P.yz = { key, plan, t0: Date.now(), teklifler: {} };
    return P.yz;
  }
  // 1 sn ≈ 1 dk canlandırma; ilk turda teklif yoksa ikinci tur (sıradaki 3 kişi)
  function teklifDurumu(yz) {
    const gecen = (Date.now() - yz.t0) / 1000, pl = yz.plan;
    const t1 = pl.tur1.map((c) => ({ ...c, tur: 1, a: pl.secilen.find((a) => a.pid === c.pid), geldi: gecen >= c.gecikmeDk }));
    const tur1Bitti = gecen >= 5, tur1Teklif = t1.some((c) => c.verir);
    const ikinci = tur1Bitti && !tur1Teklif;
    const t2 = ikinci ? pl.tur2.cevaplar.map((c) => ({ ...c, tur: 2, a: pl.tur2.secilen.find((a) => a.pid === c.pid), geldi: gecen - 5 >= c.gecikmeDk })) : [];
    return { satirlar: [...t1, ...t2], ikinci, bitti: ikinci ? gecen >= 10 : tur1Bitti };
  }
  function teklifFiyati(c, fiyat) {
    const pr = c.price, fark = fiyat - pr.service_fee, kom = C.CFG.COMMISSION;
    return { ...pr, service_fee: fiyat, patient_pays: pr.patient_pays + fark, provider_gets: pr.provider_gets + fark * (1 - kom), platform_gets: (pr.platform_gets || 0) + fark * kom };
  }
  // Teklif kartı: hastanın karşılaştıracağı bilgiler (meslek, deneyim, geliş saati, TOPLAM ücret) öne;
  // modelin sayıları (AUC, olasılıklar, v5) jüri için "Model nasıl çalışıyor?" panelinde.
  function teklifKarti(yz) {
    const pl = yz.plan, o = pl.oneri, d = teklifDurumu(yz), yuzde = (x) => Math.round(100 * x) + "%";
    const satir = (r) => {
      const c = P.cands[r.a.idx], pp = person(r.pid), pv = repo.providers[r.pid];
      let sag;
      if (!r.geldi) sag = `<span class="pill sun">Yanıt bekleniyor…</span>`;
      else if (!r.verir) sag = `<span class="small muted">${r.nedenYok === "yanıt vermedi" ? "Yanıt vermedi" : "Uygun teklif vermedi"}</span>`;
      else {
        const tc = yz.teklifler[r.pid] || (yz.teklifler[r.pid] = { ...c, price: teklifFiyati(c, r.fiyat), teklif: { fiyat: r.fiyat, oneri: o.fiyat } });
        const i = P.cands.indexOf(c); P.cands[i] = tc;
        const yol = tc.price.patient_pays - r.fiyat;
        sag = `<button class="btn primary teklif-btn" type="button" data-pick="${i}"><span class="teklif-toplam">Toplam ${tl(tc.price.patient_pays)} TL</span>
          <span class="small">${gunEki({ gun: P.info.gun })}${C.hhmm(c.arrival_min)} · Seç</span>${yol > 0 ? `<span class="tiny">hizmet ${tl(r.fiyat)} + yol ${tl(yol)} TL</span>` : `<span class="tiny">yol dahil</span>`}</button>`;
      }
      return `<div class="yz-satir"><span class="avatar">${esc(pp.initials)}</span><div style="flex:1;min-width:0"><b>${esc(pp.full)}</b>
        <div class="small muted">${esc(pp.prof)} · ${pv.years_experience} yıl deneyim · bu hizmette ${c.visits} ziyaret</div>
        <div class="small muted">${r.a.ozellik.ham.yol_suresi ? `~${Math.round(r.a.ozellik.ham.yol_suresi)} dk yolda (${r.a.toplu ? "toplu taşıma" : "araçla"})` : "Görüntülü"}</div></div>${sag}</div>`;
    };
    const model = (r) => `<li>${esc(person(r.pid).full)}: teklif olasılığı ${yuzde(r.a.p)}${r.a.garanti ? " (garanti için eklendi)" : ""}${r.a.ozellik.gecmis.yeni ? " · yeni çalışan" : ""} · hızlı yanıt ${yuzde(r.a.ozellik.ham.gecmis_hizli_yanit_orani)}${r.a.ozellik.ham.ziyarette ? " · şu an ziyarette" : ""}</li>`;
    return `<div class="card stack yz-teklif" style="gap:10px">
      <div><b>${pl.secilen.length} sağlık çalışanına sorduk</b><div class="small muted">Teklifler birkaç dakika içinde gelir. Beklenen ücret ${tl(o.alt)}–${tl(o.ust)} TL.</div></div>
      ${d.satirlar.filter((r) => r.tur === 1).map(satir).join("")}
      ${d.ikinci ? `<div class="small muted">İlk 5 dakikada teklif gelmedi; ${pl.tur2.secilen.length} kişiye daha soruldu.</div>${d.satirlar.filter((r) => r.tur === 2).map(satir).join("")}` : ""}
      ${d.bitti && !d.satirlar.some((r) => r.verir) ? `<div class="note small">Şu an teklif gelmedi. Aşağıdaki listeden doğrudan birini seçebilir ya da saati değiştirebilirsin.</div>` : ""}
      <details class="model-panel"><summary class="small">Model nasıl çalışıyor? <span class="muted">(jüri için)</span></summary>
        <div class="small stack" style="gap:6px;margin-top:6px">
          <div>Kime soracağımızı Enes'in modeli seçti: her aday için "5 dk içinde uygun teklif verir mi" olasılığı, yol ve iş yükü cezası (v5). Model isabeti AUC ${pl.model.auc.toFixed(2).replace(".", ",")}.</div>
          <div>YZ fiyat önerisi ${tl(o.fiyat)} TL (liste ${tl(o.taban)} TL), teklif bandı ±%10, en az bir teklif olasılığı ${yuzde(o.basari)}.</div>
          <ul style="margin:0;padding-left:18px">${d.satirlar.map(model).join("")}</ul>
          <div class="muted">Simülasyonda bu yöntem hastaların %${String(pl.model.v5).replace(".", ",")}'üne 5 dk içinde uygun teklif buldu; en yakına gönderme kuralı %${String(pl.model.klasik).replace(".", ",")}. Prototip: yanıtlar modelin olasılığıyla canlandırılır (1 sn ≈ 1 dk).</div></div></details>
    </div>`;
  }
  setInterval(() => {
    if (P.screen !== "options" || !P.yz || P.sheet !== null) return;
    const d = teklifDurumu(P.yz), imza = d.satirlar.map((r) => r.pid + (r.geldi ? 1 : 0)).join(",") + (d.bitti ? "|bitti" : "");
    if (imza !== P.yz.imza) { P.yz.imza = imza; const sc = $("#pScreen"), y = sc.scrollTop; renderP(); sc.scrollTop = y; }
  }, 500);
  function optCard(c, i) {
    const pp = person(c.provider_id), pv = repo.providers[c.provider_id];
    const shared = c.insertion && c.insertion.shared;
    const remote = !c.insertion;
    return `<button class="opt ${i === 0 ? "best" : ""}" type="button" data-pick="${i}">
      <div class="row between" style="width:100%"><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(pp.initials)}</span>
        <div><b>${esc(pp.full)}</b><div class="tiny muted">${esc(pp.prof)} · ${pv.years_experience} yıl · ★ ${pv.rating}${remote ? "" : ` · ${ulasim(c.provider_id) === "toplu" ? "🚌" : "🚗"}`}</div></div></div>
        ${i === 0 ? `<span class="pill">${esc(SORTS[P.sort][0])}</span>` : ""}</div>
      <div class="row between" style="width:100%">
        <div class="stack" style="gap:2px"><span class="when">${remote ? "Görüntülü · " : ""}${C.hhmm(c.arrival_min)}${remote ? "" : " kapında"}</span>
          <span class="tiny muted">${c.visits} kez bu hizmeti verdi${remote ? "" : ` · ${c.distance_km} km`}</span></div>
        <div style="text-align:right"><div class="price num">${tl(c.price.patient_pays)} TL</div>
          ${shared ? `<span class="pill sun">Rotada · ${tl(c.price.patient_saving)} TL indirim</span>` : `<span class="tiny muted">toplam, yol dahil</span>`}</div></div>
    </button>`;
  }
  function pSheet() {
    const c = P.cands[P.sheet];
    if (!c) return "";
    const pp = person(c.provider_id), pv = repo.providers[c.provider_id], s = svc(c.service), pr = c.price;
    const shared = c.insertion && c.insertion.shared;
    return `<div class="sheet-bg" data-act="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="Randevu özeti" data-stop="1">
      <div class="row between"><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(pp.initials)}</span><div><b>${esc(pp.full)}</b><div class="tiny muted">${esc(pp.prof)} · ★ ${pv.rating} · ${pv.years_experience} yıl</div></div></div>
        <button class="btn ghost" type="button" data-act="closeSheet">Kapat</button></div>
      <div class="row" style="gap:14px"><span class="row small">${ICO.clock}<b>${c.insertion ? C.hhmm(c.arrival_min) + " kapında" : C.hhmm(c.arrival_min) + " görüntülü"}</b></span><span class="row small">${ICO.pin}${esc(P.info.district)}</span></div>
      <div class="card soft small">${esc(s.name_tr)} · yaklaşık ${s.duration_min} dk. ${c.visits} kez bu hizmeti verdi.</div>
      <div class="bill">
        <span>Hizmet bedeli</span><span class="num">${tl(pr.service_fee)} TL</span>
        ${c.insertion ? `<span>Yol payı (${c.insertion.standalone_km} km)</span><span class="num">${tl(pr.standalone_travel)} TL</span>` : ""}
        ${shared ? `<span class="disc">Ziyaret paylaşımı indirimi</span><span class="disc num">−${tl(pr.patient_saving)} TL</span>` : ""}
        <span class="tot">Toplam</span><span class="tot num">${tl(pr.patient_pays)} TL</span></div>
      ${shared ? `<div class="note small"><b>Neden indirimli?</b> ${esc(pp.first)} bugün zaten bölgende bir ziyarette olacak. Sana uğrarken yolu paylaşıyorsunuz; kazanılan yol masrafının yarısı sana indirim olarak döner.</div>` : ""}
      <div class="tiny muted">Ödeme ziyaret tamamlanınca alınır. Saatten 2 saat öncesine kadar ücretsiz iptal (demo koşulu).</div>
      <button class="btn primary block" type="button" data-act="confirm">Randevuyu onayla · ${tl(pr.patient_pays)} TL</button>
    </div></div>`;
  }
  function pDone() {
    const r = P.request;
    const pp = person(r.provider_id);
    const st = r.status;
    const gs = G.durum(r) || {};
    const steps = [["Talep gönderildi", "Raporun sağlık çalışanına iletildi.", true], [st === "red" ? "Sağlık çalışanı uygun değil" : "Sağlık çalışanı onayı", st === "kabul" ? `${pp.first} talebi kabul etti.` : st === "red" ? "Sana yeni seçenekler gösterelim." : "Genelde 10 dakika içinde yanıt gelir.", st !== "bekliyor"],
      ["Yolda", `${C.hhmm(r.arrival_min - 20)} civarı yola çıkar.`, !!gs.checkin], ["Kapında", `${C.hhmm(r.arrival_min)} · kapı kodu ve fotoğrafla doğrula`, !!gs.checkin], ["Tamamlandı, ödeme", `${tl(r.price.patient_pays)} TL`, gs.hastaOnay === "tamam"]];
    return `<div class="pad stack">
      ${stepsBar(4)}
      <div class="row between"><h2 style="font-size:22px">${st === "kabul" ? "Randevun kesinleşti" : st === "red" ? "Başka bir seçenek seçelim" : "Talebin gönderildi"}</h2>
        <span class="pill ${st === "kabul" ? "good" : st === "red" ? "coral" : "sun"}">${st === "kabul" ? "Onaylandı" : st === "red" ? "Uygun değil" : "Onay bekleniyor"}</span></div>
      <div class="card row" style="flex-wrap:nowrap"><span class="avatar">${esc(pp.initials)}</span><div style="flex:1"><b>${esc(pp.full)}</b><div class="tiny muted">${esc(svc(r.service).name_tr)}</div></div>
        <div style="text-align:right"><div class="when">${gunEki(r)}${C.hhmm(r.arrival_min)}</div><div class="small num">${tl(r.price.patient_pays)} TL</div></div></div>
      ${st === "kabul" && MAP && !r.gun ? `<div id="takip">${takipHtml(r)}</div>` : ""}
      ${(r.ek_bilgi || []).length ? `<div class="card stack ek-bilgi" style="gap:6px"><b>${esc(pp.first)} senden ek bilgi istiyor</b>${r.ek_bilgi.map((x) => `<div class="small">• ${esc(x)}</div>`).join("")}<div class="small muted">Fotoğrafı ziyaretten önce sohbetten ya da ziyarette gösterebilirsin.</div></div>` : ""}
      ${G.aktif(r) ? `<div id="gzHasta">${G.hastaHtml(r)}</div>` : ""}
      ${st === "kabul" && r.gun ? `<div class="card soft small">Randevun <b>yarın (${GUNLER[1].uzun}) ${C.hhmm(r.arrival_min)}</b>. Canlı takip yarın, sağlık çalışanı yola çıkınca başlar.</div>` : ""}
      <div class="timeline-v">${steps.map(([a, b, done], i) => `<div class="tv ${done ? "done" : (i === steps.findIndex((s) => !s[2]) ? "now" : "")}"><span class="dot"></span><div><b class="small">${esc(a)}</b><div class="tiny muted">${esc(b)}</div></div></div>`).join("")}</div>
      ${r.report.malzeme && r.report.malzeme.length ? `<div class="card stack" style="gap:6px"><b class="small">Ziyaretten önce hazırla</b>${r.report.malzeme.map((m) => `<div class="row small">${ICO.check}<span>${esc(m)}</span></div>`).join("")}</div>` : ""}
      ${st === "red" ? `<button class="btn primary block" type="button" data-act="options">Diğer seçeneklere bak</button>` : G.durum(r) && G.durum(r).checkin ? "" : `<button class="btn block" type="button" data-act="cancel">Talebi iptal et</button>`}
      <button class="btn ghost" type="button" data-act="home">Ana sayfa</button>
      ${!CAP.db ? `<div class="tiny muted" style="text-align:center">${document.body.classList.contains("rol-hasta") ? "Demo: sağlık çalışanı birkaç saniye içinde onaylıyor (bu telefon tek başına; gerçek uygulamada onayı çalışan kendi telefonundan verir)." : "Bu görünümde talep yalnızca bu sayfadaki sağlık çalışanı ekranına gider."}</div>` : `<div class="tiny muted" style="text-align:center">Talep ortak kayda yazıldı; başka cihazdaki sağlık çalışanı ekranı da görür.</div>`}
    </div>`;
  }
  // ---- Canlı takip (Enes'in startTracking/trackState mantığı) ----
  // Canlandırma: kabulden sonra 1 sn ≈ 1 dk. Gerçek uygulamada konum çalışanın telefonundan gelir.
  function takipVerisi(r) {
    if (r._takip) return r._takip;
    const p = repo.providers[r.provider_id], target = [r.patient.lat, r.patient.lon];
    const plan = (repo.scheduled[r.provider_id + "|" + DATE] || []).filter((v) => v.start_min + v.duration_min <= r.arrival_min - 10);
    const once = plan.sort((a, b) => a.start_min - b.start_min).pop();
    const from = once ? [once.lat, once.lon] : [p.home_lat, p.home_lon];
    const mod = ulasim(r.provider_id), toplu = mod === "toplu" && !!(window.EVDE_DATA.yol && window.EVDE_DATA.yol.toplu);
    // araba: park + bina 6 dk; toplu taşıma: duraktan sonra bina 2 dk (Enes'in build_transit BINA_DK)
    const park = toplu ? 2 : (window.EVDE_DATA.yol && window.EVDE_DATA.yol.trafik.park_dk) || 6;
    const yolDk = Math.max(2, C.travel(from, target, r.arrival_min - 30, mod) - park);
    const rt = (toplu && TOPLU && TOPLU.rota(from, target, r.arrival_min - yolDk - park)) || MAP.rota(from, target);
    r._takip = { from, target, rt, yolDk, park, toplu: toplu && !!rt.legs, t0: r.accepted_at || Date.now(), onceki: !!once };
    return r._takip;
  }
  function takipDurumu(T, r) {
    const e = (Date.now() - T.t0) / 1000, hazir = 3, yolSn = Math.min(40, Math.max(12, T.yolDk)), kapi = 5;
    if (e < hazir) return { adim: 0, f: 0 };
    if (e < hazir + yolSn) return { adim: 1, f: (e - hazir) / yolSn };
    const s = r ? G.durum(r) : null; // Güvenli Ziyaret: ziyaret ancak check-in ile başlar
    if (e < hazir + yolSn + kapi || (s && !s.checkin)) return { adim: 3, f: 1 };
    return { adim: 4, f: 1, bitti: !!(s && s.checkout) };
  }
  // Çalışanın konumu (prototip: planlı rotadan canlandırılır; gerçekte telefonun konumu, yalnızca ziyaret penceresinde)
  function calisanKonumu(r) {
    if (!r || r.gun) return null;
    const hedef = [r.patient.lat, r.patient.lon];
    if (!MAP) { const ulasti = Date.now() - (r.accepted_at || Date.now()) > 10000; return { pos: ulasti ? [hedef[0] + 0.0002, hedef[1]] : [hedef[0] + 0.02, hedef[1]], hedef, ulasti }; }
    const T = takipVerisi(r), e = (Date.now() - T.t0) / 1000, yolSn = Math.min(40, Math.max(12, T.yolDk));
    const ulasti = e >= 3 + yolSn, np = MAP.rotaNoktasi(T.rt, ulasti ? 1 : Math.max(0, (e - 3) / yolSn));
    return { pos: ulasti ? [hedef[0] + 0.0003, hedef[1] + 0.0002] : np.pos, hedef, ulasti }; // kapıda ~40 m (park yeri)
  }
  function takipHtml(r) {
    const T = takipVerisi(r), d = takipDurumu(T, r), np = MAP.rotaNoktasi(T.rt, d.f);
    const adim = d.adim === 1 && np.kmLeft < 1 ? 2 : d.adim;
    const kalanDk = adim <= 2 ? Math.max(1, Math.ceil((1 - d.f) * T.yolDk + T.park)) : 0;
    const bant = Math.max(1, Math.round(1.645 * 0.15 * (1 - d.f) * T.yolDk));
    const pp = person(r.provider_id).first;
    const bas = [`${pp} hazırlanıyor, birazdan yola çıkacak`, T.toplu ? `${pp} yolda (toplu taşıma)` : `${pp} yolda`, `${pp} yaklaşıyor (1 km'den az)`, `${pp} kapında, kimliğini doğrula`, d.bitti ? "Ziyaret tamamlandı" : `Ziyaret sürüyor`][adim];
    const gecilen = T.rt.pts.slice(0, np.i).concat([np.pos]), kalan = [np.pos].concat(T.rt.pts.slice(np.i));
    const svgH = MAP.svg({ rotalar: [{ pts: adim < 3 ? kalan : T.rt.pts, gecilen: adim < 3 ? gecilen : null, renk: "var(--brand)" }],
      isaretler: [{ lat: T.target[0], lon: T.target[1], tur: "hasta", etiket: "Sen" }, { lat: np.pos[0], lon: np.pos[1], tur: "hareketli" }], aciklama: "Canlı takip haritası" });
    const adlar = ["Kabul", "Yolda", "Yaklaşıyor", "Kapında", "Ziyaret"];
    return `<div class="card stack takip" style="gap:8px">
      <div class="row between"><div><div class="tiny muted">CANLI TAKİP</div><b>${esc(bas)}</b></div>${adim <= 2 ? `<div style="text-align:right"><div class="when">${kalanDk} dk</div><div class="tiny muted">tahmini ${C.hhmm(r.arrival_min)}</div></div>` : ""}</div>
      <div class="hr-kutu">${svgH}</div>
      <div class="adimlar">${adlar.map((a, i) => `<span class="${i < adim ? "ok" : i === adim ? "now" : ""}">${a}</span>`).join("")}</div>
      <div class="tiny muted">${adim <= 2 ? `Kalan yol ~${np.kmLeft.toFixed(1).replace(".", ",")} km · muhtemel varış ${C.hhmm(r.arrival_min - bant)}–${C.hhmm(r.arrival_min + bant)} (${T.toplu ? "aktarma ve bekleme" : "trafik"} belirsizliği)` : `${T.toplu ? "Toplu taşıma" : `Rota ${T.rt.km.slice(-1)[0].toFixed(1).replace(".", ",")} km ·`} yolculuk ~${T.yolDk} dk + ${T.toplu ? "bina" : "park"} ${T.park} dk`} · ${T.onceki ? "önceki ziyaretinden geliyor" : "evinden geliyor"}</div>
      ${T.toplu ? `<div class="tiny toplu-plan"><b>Yolculuk planı:</b> ${TOPLU.metin(T.rt, adim >= 1 && adim <= 2 ? d.f * T.rt.total : null)}</div>` : ""}
      <div class="tiny muted">Prototip: hareket planlanan rotaya göre canlandırılıyor (1 sn ≈ 1 dk); gerçek uygulamada çalışanın telefon konumuyla beslenir.</div></div>`;
  }
  setInterval(() => {
    const el = document.getElementById("takip");
    if (el && P.screen === "done" && P.request && P.request.status === "kabul" && !P.request.gun) el.innerHTML = takipHtml(P.request);
  }, 700);
  // En yakın acil servisler: Enes'in yol süresi matrisi + şu anki saatin trafiği (C.yakinAcil)
  function acilKarti() {
    const pt = patientPoint(), d = new Date();
    const list = C.yakinAcil(pt.lat, pt.lon, d.getHours() * 60 + d.getMinutes());
    if (!list.length) return "";
    return `<div class="card small stack" style="gap:6px"><b>En yakın acil servisler (${esc(P.info.district)})</b>
      <div class="tiny muted">Önce 112'yi ara. Göğüs ağrısı, bilinç kaybı gibi durumlarda kendin araç kullanma; 112 yönlendirirse:</div>
      ${list.map((h) => `<div class="row between"><span>${esc(h.ad)}<span class="tiny muted"> · ${esc(h.turAd)}, ${esc(h.ilce)}</span></span><b>~${h.dk} dk</b></div>`).join("")}
      <div class="tiny muted">Araçla tahmini süre, şu anki trafik. Hastane listesi OpenStreetMap'ten; eksik olabilir.</div></div>`;
  }
  function pEmergency() {
    const e = P.emergency || {};
    return `<div class="pad stack">
      <div class="emerg"><div class="row">${ICO.alert}<b>Bu durum acil olabilir</b></div>
        <div class="big112">112</div>
        <div>${esc(e.msg || "Hemen 112'yi arayın.")}</div>
        <a class="btn block" href="tel:112" style="background:#fff;color:var(--coral);text-align:center;text-decoration:none">112'yi ara</a>
        <div class="tiny" style="opacity:.9">Bağlantı açılmazsa telefonundan 112'yi tuşla. Bu uygulama acil durumda randevu vermez.</div></div>
      <div class="card small"><b>Neden?</b> ${esc(e.why || "")}<div class="tiny muted">Algılayan: ${esc(e.src || "")}</div></div>
      ${acilKarti()}
      <button class="btn block" type="button" data-act="chat">Yanlış anlaşıldı, sohbete dön</button>
    </div>`;
  }

  // ---------- hasta olayları ----------
  $("#pScreen").addEventListener("click", async (e) => {
    if (G.onClick(e, P.request)) { renderP(); renderH(); gzYenile(true); return; }
    const sv = e.target.closest("[data-sv]");
    if (sv) {
      const k = sv.dataset.sv;
      if (k === "kapat") { SV.kapat(); renderP(); } else if (k === "dokun") SV.dokun(); else if (k === "duraklat") SV.duraklat();
      return;
    }
    const t = e.target.closest("[data-act],[data-tile],[data-quick],[data-plan],[data-when],[data-sort],[data-pick],[data-hizmet]");
    if (!t) return;
    if (t.dataset.stop && !e.target.closest("[data-act]")) return;
    const a = t.dataset.act;
    if (t.dataset.tile !== undefined) { startChat(t.dataset.tile); return; }
    if (t.dataset.quick !== undefined) { if (SV.acik) SV.hizli(t.dataset.quick); else send(t.dataset.quick); return; }
    if (t.dataset.plan) { P.info.plan = t.dataset.plan; P.info.hizmet = null; renderP(); return; }
    if (t.dataset.hizmet) { P.info.hizmet = t.dataset.hizmet; P.saatler = null; renderP(); return; }
    if (t.dataset.when) { const [g, w] = t.dataset.when.split(":").map(Number); P.info.gun = g; P.info.when = w; renderP(); return; }
    if (t.dataset.sort) { P.sort = t.dataset.sort; P.sheet = null; renderP(); return; }
    if (t.dataset.pick !== undefined) { P.sheet = +t.dataset.pick; renderP(); return; }
    if (a === "start") startChat();
    else if (a === "sesli") sesliBaslat(true);
    else if (a === "sesliac") sesliBaslat(false);
    else if (a === "home") { if (CAP.dictation && P.listening) { try { CAP.dictation.stop(); } catch (er) { /**/ } P.listening = false; } P.screen = "home"; P.sheet = null; renderP(); }
    else if (a === "chat") { P.screen = "chat"; P.emergency = null; renderP(); }
    else if (a === "skipdoc" && SV.acik) { const m = istenenMeslek(); SV.hizli(`Soruları geç, ${m && !HEKIMLER.has(m) ? yonelme(meslekAdi(m)) : "doktora"} yönlendir.`); }
    else if (a === "skipdoc") { if (!P.busy) { const m = istenenMeslek(); P.msgs.push({ who: "me", text: `Soruları geç, ${m && !HEKIMLER.has(m) ? yonelme(meslekAdi(m)) : "doktora"} yönlendir.` }); await doktoraYonlendir(); } }
    else if (a === "summary") { P.screen = "summary"; renderP(); }
    else if (a === "options") { P.screen = "options"; P.sheet = null; renderP(); }
    else if (a === "voice") { P.voice = !P.voice; renderP(); }
    else if (a === "closeSheet") { if (e.target === t || t.tagName === "BUTTON") { P.sheet = null; renderP(); } }
    else if (a === "confirm") { await confirmBooking(); }
    else if (a === "cancel") { if (P.request) { P.request = { ...P.request, status: "iptal" }; takvimdenSil(P.request.id); await putRequest(P.request); } P.screen = "home"; P.toast = "Talebin iptal edildi; sağlık çalışanının takviminden de çıkarıldı."; renderP(); renderH(); }
    else if (a === "takip") { const r = REQ.find((x) => x.id === t.dataset.id) || P.request; if (r) { P.request = r; P.screen = "done"; renderP(); } }
  });
  $("#pScreen").addEventListener("submit", (e) => { if (e.target.id === "pComposer") { e.preventDefault(); const ta = $("#pInput"); const v = ta.value; ta.value = ""; send(v); } });
  $("#pScreen").addEventListener("keydown", (e) => { if (e.target.id === "pInput" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#pComposer").requestSubmit(); } });
  // Kullanıcının açtığı klasik liste, teklifler gelip ekran yenilenince kapanmasın
  // Adres arama: yazdıkça öneri; seçilen adres en yakın yol noktasına (yol paketindeki 240 nokta) yerleşir
  $("#pScreen").addEventListener("input", (e) => {
    if (e.target.id !== "pAdres" || !ADR) return;
    P.info.adresYazi = e.target.value;
    const r = ADR.ara(e.target.value), L = $("#pAdresList");
    L.innerHTML = r.map((x, i) => `<button class="chip adres-oneri" type="button" data-adres="${i}" style="text-align:left">${x.mahalle ? "🏘️" : "📍"} <b>${esc(x.ad)}</b> <span class="muted">${esc(x.alt)}</span></button>`).join("")
      || (e.target.value.trim().length >= 3 ? `<div class="tiny muted">Bulunamadı; farklı yaz ya da ilçeyi seç.</div>` : "");
    L._sonuc = r;
  });
  $("#pScreen").addEventListener("click", (e) => {
    const b = e.target.closest("[data-adres]"); if (!b) return;
    const x = $("#pAdresList")._sonuc[+b.dataset.adres], nok = window.EVDE_DATA.yol.noktalar;
    let en = 0, ed = 1e9;
    nok.forEach((n, i) => { const d = ADR.km(x.ll, [n[0], n[1]]); if (d < ed) { ed = d; en = i; } });
    const n = nok[en];
    if (window.EVDE_DATA.districts.some((d) => d.name === n[2])) P.info.district = n[2];
    P.info.nokta = { lat: n[0], lon: n[1], adres: x.ad + (x.alt ? ", " + x.alt : ""), km: ed };
    P.info.adresYazi = P.info.nokta.adres;
    P.saatler = null; renderP();
  });
  $("#pScreen").addEventListener("toggle", (e) => { if (e.target.id === "klasikListe") P.klasikAcik = e.target.open; }, true);
  $("#pScreen").addEventListener("change", async (e) => {
    if (e.target.id === "pPhoto" && e.target.files[0]) {
      try {
        const big = await compress(e.target.files[0], 1200), small = await compress(e.target.files[0], 480);
        const ph = { blob: big.blob, url: small.url };
        P.photos.push(ph); P.pendingPhotos.push(ph); (P.pendingShow ||= []).push(ph);
        if (SV.acik) { SV.hizli("Fotoğraf ekledim."); return; }
      } catch (err) { P.toast = "Bu fotoğraf açılamadı; başka bir fotoğraf dene."; }
      renderP();
    }
    if (e.target.id === "pBed") { P.info.bed = e.target.checked; }
    if (e.target.id === "pDist") { P.info.district = e.target.value; P.info.nokta = null; P.info.adresYazi = ""; }
  });
  // Mikrofon: start() tıklamadan hemen çağrılmalı
  $("#pScreen").addEventListener("click", (e) => {
    const b = e.target.closest("#pMic"); if (!b || !CAP.dictation) return;
    if (P.listening) { CAP.dictation.stop().catch(() => {}); return; }
    CAP.dictation.start().catch((err) => { if (err && err.code === "not_granted") { CAP.dictation = null; P.toast = "Mikrofon izni yok; yazarak devam edebilirsin."; renderP(); } });
  });

  async function confirmBooking() {
    const c = P.cands[P.sheet];
    // Onay anında çakışmayı yeniden denetle: bu arada başka bir randevu o saati doldurduysa listeyi yenile
    if (!c.teklif) {
      const kontrol = C.findCandidates(repo, c.service, P.pt, gunTarih(P.info.gun), P.info.when, SORTS[P.sort][1], 20, 500);
      const hala = kontrol.candidates.find((x) => x.provider_id === c.provider_id);
      if (!hala || hala.arrival_min !== c.arrival_min) {
        P.sheet = null; P.saatler = null;
        P.toast = hala ? `${person(c.provider_id).first} için bu saat az önce doldu; en erken ${C.hhmm(hala.arrival_min)}. Liste yenilendi.` : `${person(c.provider_id).first} bu saat için artık uygun değil. Liste yenilendi.`;
        renderP(); return;
      }
    }
    const id = "T" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const r = {
      id, created_at: new Date().toISOString(), status: c.teklif ? "kabul" : "bekliyor", accepted_at: c.teklif ? Date.now() : undefined, teklif: c.teklif || null, provider_id: c.provider_id, service: c.service, level: P.triage.level,
      arrival_min: c.arrival_min, gun: P.info.gun, date: gunTarih(P.info.gun), price: c.price, ins: c.insertion, patient: { district: P.info.district, lat: P.pt.lat, lon: P.pt.lon, bedridden: P.info.bed, plan: P.info.plan },
      report: P.report, photos: P.photos.slice(0, 3).map((p) => p.url), red_flags_checked: true, from_app: true, author: CAP.uid || null,
    };
    P.request = r; P.sheet = null; P.screen = "done";
    takvimeIsle(r); (P.randevular ||= []).unshift(r.id);
    H.pid = c.provider_id; H.tab = "talepler"; H.open = id;
    if (c.teklif) { // çalışan teklif verdi, hasta kabul etti → randevu kesin, çalışanın rotasına girer
      (H.accepted[c.provider_id] ||= []).push({ reqId: id, date: gunTarih(P.info.gun), lat: P.pt.lat, lon: P.pt.lon, start_min: c.arrival_min, duration_min: svc(c.service).duration_min, service_code: c.service, earn: c.price.provider_gets });
      H.tab = "rota"; H.open = null;
    }
    await putRequest(r);
    renderP(); renderH();
    if (window.matchMedia("(max-width: 860px)").matches) P.toast = "Sağlık çalışanı ekranını görmek için üstten geçiş yap.";
  }

  // ---------- SAĞLIK ÇALIŞANI ----------
  const CANNED = {
    basi_yarasi_bakimi: { tek: "Sakrumda bası yarası, 10 gündür; fotoğraf var", s: "Sırtın alt kısmında yara, 10 gündür; son 2 günde akıntı artmış (beyan)", bed: true, mal: ["Pansuman seti", "Eldiven"], eks: ["Diyabet var mı", "Son pansuman ne zaman yapıldı"] },
    yara_pansuman: { tek: "Ameliyat sonrası dikiş yeri pansumanı", s: "Bir hafta önce ameliyat; dikiş yeri pansumanı istendi (beyan)", bed: false, mal: ["Pansuman seti"], eks: ["Dikiş alınma tarihi"] },
    iv_serum: { tek: "Reçeteli serum, 3 gün, evde", s: "Hekim reçetesiyle 3 günlük serum tedavisi; ilk gün (beyan)", bed: false, mal: ["Serum askısı", "Damar yolu seti"], eks: ["Reçete fotoğrafı", "İlaç evde mi"] },
    kan_alma: { tek: "Hekim istemli tahlil için kan alma", s: "Aile hekiminin istediği tahliller için evden kan alma (beyan)", bed: false, mal: ["Tüpler", "Soğuk zincir çantası"], eks: ["Aç mı olunacak"] },
    im_enjeksiyon: { tek: "Reçeteli kas içi iğne", s: "Reçeteli iğne, 5 günlük kürün 2. günü (beyan)", bed: false, mal: ["Enjektör"], eks: ["Reçete"] },
    sonda_bakimi: { tek: "Sonda değişimi, yatağa bağımlı hasta", s: "Sonda 1 aydır takılı, değişim zamanı geldi (beyan)", bed: true, mal: ["Sonda seti", "Eldiven"], eks: ["Sonda numarası"], guv: ["Evde serbest dolaşan büyük bir köpek var (beyan)"] },
    vital_takip: { tek: "Tansiyon ve şeker takibi", s: "Haftalık tansiyon ve şeker ölçümü istendi (beyan)", bed: true, mal: ["Tansiyon aleti", "Glukometre"], eks: ["Son ölçüm değerleri"] },
    beslenme_tupu_bakimi: { tek: "PEG tüpü çevresi kızarık", s: "Beslenme tüpü çevresinde kızarıklık, 3 gündür (beyan)", bed: true, mal: ["Pansuman seti"], eks: ["Ateş var mı"] },
    tele_hemsire_destekli: { tek: "Ateş ve öksürük, yatağa bağımlı", s: "2 gündür ateş ve öksürük; yatağa bağımlı (beyan)", bed: true, mal: ["Ateş ölçer", "Oksimetre"], eks: ["Ateş kaç derece"] },
    fizyoterapi_seansi: { tek: "Diz protezi sonrası fizik tedavi", s: "3 hafta önce diz protezi; hekim fizik tedavi önerdi (beyan)", bed: false, mal: ["Egzersiz bandı"], eks: ["Ameliyat raporu"] },
    ev_muayene: { tek: "Halsizlik ve iştahsızlık, 80 yaş", s: "Bir haftadır halsizlik ve iştahsızlık; evden çıkamıyor (beyan)", bed: true, mal: [], eks: ["Kullandığı ilaçlar"], guv: ["Hastanın oğlu zaman zaman çok sinirlenip bağırıyormuş (beyan)", "Bina asansörsüz, 4. kat (beyan)"] },
  };
  function cannedReport(code) {
    const k = CANNED[code] || { tek: svc(code).name_tr, s: svc(code).name_tr + " talebi (beyan)", bed: false, mal: [], eks: ["Kullandığı ilaçlar"] };
    return { kim_icin: "Hasta yakını (örnek)", yas_araligi: "70 üstü", sikayet: k.s, baslangic: "belirtildi", seyir: "belirtilmedi", siddet_beyani: "belirtilmedi", yataga_bagimli: k.bed, hekim_plani: "var", plan_detayi: "Plan/reçete beyan edildi; ziyarette görülmeli.", kronik_ilac_alerji: "belirtilmedi", ihtiyaclar: [svc(code).name_tr], malzeme: k.mal, foto_ozeti: /fotoğraf/.test(k.tek) ? "Örnek talepte fotoğraf yok (sentetik)." : "", eksik_bilgiler: k.eks, saglikci_icin_ozet: k.s + ". Bilgiler hasta yakınının beyanıdır.", tek_satir: k.tek, hasta_icin_ozet: k.s, guvenlik_notlari: k.guv || [] };
  }
  function cannedRequests(pid) {
    const p = repo.providers[pid];
    const offered = Object.keys(repo.provider_services[pid] || {}).filter((s) => !(svc(s).remote_possible && svc(s).category === "tele"));
    if (!offered.length) return [];
    const home = [p.home_lat, p.home_lon];
    const stops = hStops(pid);
    const seed = [...pid].reduce((a, c) => a + c.charCodeAt(0), 0);
    const out = [];
    Object.values(repo.patients).forEach((pt, idx) => {
      if (out.length >= 3 || !pt.has_physician_plan) return;
      const code = offered[(idx + seed) % offered.length];
      if (C.roadKm(home, [pt.lat, pt.lon]) > 10) return;
      const ins = C.bestInsertion(home, hWindow(pid), stops, [pt.lat, pt.lon], svc(code).duration_min, 600, ulasim(pid));
      if (!ins) return;
      const id = `S-${pid}-${pt.id}`;
      if (H.rejected[id] || (H.accepted[pid] || []).some((v) => v.reqId === id)) return;
      out.push({ id, synthetic: true, status: "bekliyor", provider_id: pid, service: code, arrival_min: ins.arrival_min, ins, price: C.priceVisit(svc(code).base_fee_tl, p.fee_multiplier, ins),
        patient: { district: pt.district, lat: pt.lat, lon: pt.lon, bedridden: CANNED[code] ? CANNED[code].bed : pt.bedridden, plan: "var" }, report: cannedReport(code), photos: [] });
    });
    return out;
  }
  const hWindow = (pid) => repo.availability[pid + "|" + DATE] || [540, 1020];
  function hStops(pid) {
    return [...(repo.scheduled[pid + "|" + DATE] || []).filter((x) => !x.reqId), ...(H.accepted[pid] || []).filter((x) => (x.date || DATE) === DATE)].sort((a, b) => a.start_min - b.start_min);
  }
  function inbox(pid) {
    const real = REQ.filter((r) => r.provider_id === pid && r.status === "bekliyor");
    return [...real, ...cannedRequests(pid)];
  }
  function renderH() {
    const el = $("#hScreen");
    const ctl = $("#demoCtl"); if (ctl) ctl.innerHTML = DG.demoPanel();
    if (DG.state.open) {
      el.innerHTML = DG.render() + (H.toast ? `<div class="toast" role="status">${esc(H.toast)}</div>` : "");
      DG.afterRender(el);
      if (H.toast) { const t = H.toast; setTimeout(() => { if (H.toast === t) { H.toast = ""; const n = $("#hScreen .toast"); if (n) n.remove(); } }, 3500); }
      return;
    }
    const pid = H.pid, p = repo.providers[pid], pp = person(pid);
    const stops = hStops(pid), home = [p.home_lat, p.home_lon];
    // Toplam yol: harita varsa gerçek sokak mesafesi, yoksa kuş uçuşu × 1,3
    const yk = (a, b) => (MAP ? MAP.rota(a, b).km.slice(-1)[0] : C.roadKm(a, b));
    let km = 0, prev = home; for (const s of stops) { km += yk(prev, [s.lat, s.lon]); prev = [s.lat, s.lon]; } if (stops.length) km += yk(prev, home);
    const earn = stops.reduce((a, s) => a + (s.earn != null ? s.earn : svc(s.service_code).base_fee_tl * p.fee_multiplier * (1 - C.CFG.COMMISSION)), 0);
    const box = inbox(pid);
    let body;
    if (H.open) {
      const r = box.find((x) => x.id === H.open) || REQ.find((x) => x.id === H.open);
      body = r ? hDetail(r, p) : "";
      if (!r) H.open = null;
    }
    if (!H.open) {
      body = H.tab === "talepler" ? hInbox(box) : H.tab === "rota" ? hRoute(p, stops) : hHours(p);
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;min-height:100%">
      <div class="h-head"><div class="row between"><div class="who"><span class="avatar">${esc(pp.initials)}</span><div><b>${esc(pp.full)}</b><div class="tiny" style="opacity:.85">${esc(pp.prof)} · ${esc(p.home_district)} · başvuru: ${esc(DG.headerLabel())}</div></div></div>
        <span class="pill" style="background:rgba(255,255,255,.18);color:inherit">Çevrimiçi</span></div>
        <div class="stats"><div><b class="num">${stops.length}</b><span>bugünkü ziyaret</span></div><div><b class="num">${km.toFixed(1)} km</b><span>toplam yol</span></div><div><b class="num">${tl(earn)} TL</b><span>bugünkü kazanç</span></div></div></div>
      ${H.open ? "" : `<div class="tabs" role="tablist">${[["talepler", "Talepler"], ["rota", "Rotam"], ["saat", "Saatlerim"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${H.tab === k}">${l}${k === "talepler" && box.length ? `<span class="badge">${box.length}</span>` : ""}</button>`).join("")}</div>`}
      ${DG.banner()}<div id="gzUyari" class="gz-ust">${G.uyariHtml(gzR())}</div><div style="flex:1">${body}</div></div>${H.toast ? `<div class="toast" role="status">${esc(H.toast)}</div>` : ""}`;
    if (H.toast) { const t = H.toast; setTimeout(() => { if (H.toast === t) { H.toast = ""; const n = $("#hScreen .toast"); if (n) n.remove(); } }, 3500); }
  }
  function hInbox(box) {
    if (!box.length) return `<div class="pad muted">Şu an yeni talep yok. Saatlerini genişletirsen daha fazla talep gelir.</div>`;
    return `<div class="pad stack">${box.map((r) => `<button class="req ${r.synthetic ? "" : "new"}" type="button" data-open="${esc(r.id)}">
      <div class="row between" style="width:100%;flex-wrap:nowrap"><span class="row" style="gap:6px;flex-wrap:nowrap;min-width:0">${svcIcon(r.service)}<b>${esc(svc(r.service).name_tr)}</b></span>${r.synthetic ? `<span class="pill plain">örnek</span>` : `<span class="pill sun">Yeni · uygulamadan</span>`}</div>
      <div class="cond">${esc(r.report.tek_satir || r.report.sikayet)}</div>
      <div class="row small muted" style="gap:10px"><span class="row" style="gap:4px">${ICO.clock}${gunEki(r)}${C.hhmm(r.arrival_min)}</span><span class="row" style="gap:4px">${ICO.pin}${esc(r.patient.district)}</span>
        ${r.patient.bedridden ? `<span class="pill plain">yatağa bağımlı</span>` : ""}${(r.photos || []).length ? `<span class="pill">${r.photos.length} fotoğraf</span>` : ""}</div>
      <div class="row between" style="width:100%"><span class="small">${r.ins ? (r.ins.shared && r.ins.added_km <= 5 ? `<span class="pill good">Rotana uygun</span> ek yol ${r.ins.added_km} km` : `Ek yol ${r.ins.added_km} km`) : "Görüntülü"}</span><span class="earn num">+${tl(hEarn(r))} TL</span></div>
    </button>`).join("")}</div>`;
  }
  const hEarn = (r) => r.price.provider_gets;
  function hDetail(r, p) {
    const rep = r.report, home = [p.home_lat, p.home_lon];
    const nv = { lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, isNew: true };
    const stops = [...hStops(p.id), nv].sort((a, b) => a.start_min - b.start_min);
    const pr = r.price;
    const planTxt = { var: "Var (beyan) · belgeyi ziyarette gör", yok: "Yok", bilinmiyor: "Bilinmiyor" }[r.patient.plan] || r.patient.plan;
    const kv = [["Kim için", [rep.kim_icin, rep.yas_araligi].filter((x) => x && x !== "belirtilmedi").join(" · ") || "belirtilmedi"], ["Şikayet", rep.sikayet], ["Ne zamandır", rep.baslangic], ["Seyir", rep.seyir], ["Şiddet", rep.siddet_beyani], ["Yatağa bağımlı", r.patient.bedridden ? "Evet" : "Hayır / belirtilmedi"], ["Hekim planı", planTxt], ["Hastalık, ilaç, alerji", rep.kronik_ilac_alerji]];
    return `<div class="pad stack">
      <button class="back" type="button" data-act="hback">${ICO.back} Talepler</button>
      <div class="row between"><div class="row" style="gap:6px">${svcIcon(r.service)}<h2 style="font-size:19px">${esc(svc(r.service).name_tr)}</h2></div>${r.synthetic ? `<span class="pill plain">örnek</span>` : `<span class="pill sun">Uygulamadan</span>`}</div>
      <div class="card row between"><div class="stack" style="gap:2px"><span class="when">${gunEki(r)}${C.hhmm(r.arrival_min)} · ${svc(r.service).duration_min} dk</span><span class="small muted">${esc(r.patient.district)}${r.ins ? ` · ek yol ${r.ins.added_km} km` : ""}</span></div>
        <div style="text-align:right"><div class="earn num">+${tl(hEarn(r))} TL</div><div class="tiny muted">senin kazancın</div></div></div>
      <div class="sec card stack" style="gap:8px"><h3>1 · Hasta beyanı</h3>
        <dl class="kv">${kv.map(([k, v]) => { const alan = { "Kim için": "kim_icin", "Ne zamandır": "baslangic", "Seyir": "seyir", "Hekim planı": "hekim_plani", "Hastalık, ilaç, alerji": "kronik_ilac_alerji" }[k];
          const yz = alan && rep._kaynak && rep._kaynak[alan] === "yz" && v && v !== "belirtilmedi";
          return `<dt>${esc(k)}</dt><dd>${esc(v || "belirtilmedi")}${yz ? ` <span class="pill plain" title="Kullanıcı bunu açıkça söylemedi; yapay zekâ konuşmadan çıkardı">YZ çıkarımı</span>` : ""}</dd>`; }).join("")}</dl>
        ${rep.hastanin_kendi_sozleri && rep.hastanin_kendi_sozleri !== "belirtilmedi" ? `<div class="small"><span class="muted">Kendi sözleriyle:</span> “${esc(rep.hastanin_kendi_sozleri)}”</div>` : ""}</div>
      ${(() => { const bos = kv.filter(([, v]) => !v || v === "belirtilmedi").map(([k]) => k + ": sorulmadı / belirtilmedi");
        const dogrulanmadi = r.patient.plan === "var" ? ["Hekim planı yalnızca beyan; belgeyi ziyarette gör"] : [];
        const l = [...(rep.eksik_bilgiler || []), ...dogrulanmadi, ...bos];
        return l.length ? `<div class="sec card stack" style="gap:4px"><h3>2 · Eksik ya da doğrulanmamış bilgiler</h3>${l.map((x) => `<div class="row small">${ICO.alert}<span>${esc(x)}</span></div>`).join("")}</div>` : ""; })()}
      <div class="sec card stack" style="gap:8px"><h3>3 · Yapay zekâ özeti</h3>
        <div>${esc(rep.saglikci_icin_ozet || rep.sikayet)}</div>
        ${rep.hastanin_kendi_sozleri && rep.hastanin_kendi_sozleri !== "belirtilmedi" ? `<div class="small"><span class="muted">Dayandığı ifade:</span> “${esc(rep.hastanin_kendi_sozleri)}”</div>` : ""}
        ${rep.oneri_gerekcesi ? `<div class="small"><span class="muted">Neden bu hizmet önerildi:</span> ${esc(rep.oneri_gerekcesi)} <span class="muted">(öneri; kararı sen verirsin)</span></div>` : ""}
        ${(rep.dikkat_edilecekler || []).length ? rep.dikkat_edilecekler.map((x) => `<div class="row small">${ICO.alert}<span>${esc(x)}</span></div>`).join("") : ""}
        ${(rep._denetim || []).length ? `<details class="small"><summary class="muted">Rapor denetimi: ${rep._denetim.length} düzeltme (söylenmeyen bilgi çıkarıldı, son beyan esas alındı)</summary>${rep._denetim.map((x) => `<div class="tiny">• ${esc(x.ne)}</div>`).join("")}</details>` : ""}
        <div class="tiny muted">Hasta / yakını beyanından yapay zekâ ile özetlendi${r.synthetic ? " (örnek)" : ""}. Teşhis değildir. Acil belirtiler otomatik taramada işaretlenmedi; bu bir güvence değildir, değerlendirme gerekli.</div></div>
      ${(r.photos || []).length || rep.foto_ozeti ? `<div class="sec card stack" style="gap:8px"><h3>Fotoğraflar</h3>${(r.photos || []).length ? `<div class="photos">${r.photos.map((u) => `<img src="${u}" alt="Hastanın eklediği fotoğraf">`).join("")}</div>` : ""}${rep.foto_ozeti ? `<div class="small">${esc(rep.foto_ozeti)}</div>` : ""}</div>` : ""}
      <div class="sec card stack" style="gap:8px"><h3>4 · Ziyaret</h3>
        <div class="small">${esc(r.patient.district)} · ${gunEki(r)}${C.hhmm(r.arrival_min)} · ${svc(r.service).duration_min} dk${r.patient.bedridden ? " · hasta yatağa bağımlı" : ""}</div>
        ${(rep.ihtiyaclar || []).length || (rep.malzeme || []).length ? `<div class="checklist">
        ${[...(rep.ihtiyaclar || []).map((x) => "İstenen: " + x), ...(rep.malzeme || [])].map((x, i) => `<label for="ck${i}"><input type="checkbox" id="ck${i}"> <span>${esc(x)}</span></label>`).join("")}</div>` : ""}
        ${G.riskHtml(G.riskAnaliz(rep, P.request && r.id === P.request.id ? transcriptText() : "", r.arrival_min), { bosGoster: true })}</div>
      <div class="sec card stack" style="gap:8px"><h3>Rotan ve net kazancın</h3>
        ${mapSVG(home, stops)}
        <div class="small">${r.ins && r.ins.shared ? `Bu ziyaret bugünkü rotana eklenir: ek yol <b>${r.ins.added_km} km</b> (tek başına ${r.ins.standalone_km} km).` : r.ins ? `Ek yol ${r.ins.added_km} km.` : ""}</div>
        <div class="bill small"><span>Hizmet bedeli</span><span class="num">${tl(pr.service_fee)} TL</span><span>Platform payı (%10)</span><span class="num">−${tl(pr.service_fee * C.CFG.COMMISSION)} TL</span>
          ${pr.actual_travel != null ? `<span>Yol masrafı karşılığı</span><span class="num">${tl(pr.actual_travel)} TL</span>` : ""}
          ${pr.saving > 0 ? `<span class="disc">Paylaşım primi</span><span class="disc num">+${tl(pr.saving * C.CFG.SPLIT.saglikci)} TL</span>` : ""}
          <span class="tot">Sana kalan</span><span class="tot num">${tl(pr.provider_gets)} TL</span></div></div>
      <div style="height:70px"></div></div>
      <div class="hbar" style="flex-wrap:wrap">${H.bilgiAcik === r.id ? `<div class="stack" style="gap:6px;width:100%"><b class="small">5 · Hastadan ne istiyorsun?</b><div class="seg">${["Yaranın fotoğrafı", "Reçete / hekim planı fotoğrafı", "Kullandığı ilaçların listesi", "Adres tarifi"].map((x) => `<button class="chip" type="button" data-act="hbilgisor" data-id="${esc(r.id)}" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>` : ""}
        <button class="btn" type="button" data-act="hreject" data-id="${esc(r.id)}">Reddet</button><button class="btn" type="button" data-act="hbilgi" data-id="${esc(r.id)}">Ek bilgi iste</button><button class="btn primary" type="button" data-act="haccept" data-id="${esc(r.id)}" style="flex:1"${DG.canAccept() ? "" : ` disabled aria-describedby="lockMsg"`}>Kabul et · ${C.hhmm(r.arrival_min)}</button>
        ${DG.canAccept() ? "" : `<div class="lockmsg" id="lockMsg" style="width:100%">Başvurun onaylanınca görev kabul edebilirsin.</div>`}</div>`;
  }
  function hRoute(p, stops) {
    const home = [p.home_lat, p.home_lon];
    return `<div class="pad stack">${G.aktif(gzR()) ? `<div id="gzCalisan">${G.calisanHtml(gzR())}</div>` : ""}${MAP ? gunHaritasi(home, stops) : mapSVG(home, stops.map((s) => ({ ...s, isNew: !!s.reqId })))}
      <div class="timeline-v">${stops.length ? stops.map((s) => `<div class="tv ${s.reqId ? "now" : "done"}"><span class="dot"></span><div><b class="small">${C.hhmm(s.start_min)} · ${esc(svc(s.service_code).name_tr)}</b><div class="tiny muted">${s.duration_min} dk${s.reqId ? " · yeni kabul" : " · planlı"}</div></div></div>`).join("") : `<div class="muted">Bugün planlı ziyaret yok.</div>`}</div></div>`;
  }
  // Çalışanın günü gerçek sokaklarda: ev → ziyaretler → ev (Enes'in yol grafiği)
  function gunHaritasi(home, stops) {
    const sira = [home, ...stops.map((x) => [x.lat, x.lon]), home];
    const rotalar = [];
    for (let i = 0; i + 1 < sira.length; i++) rotalar.push({ pts: MAP.rota(sira[i], sira[i + 1]).pts, renk: stops[i] && stops[i].reqId ? "var(--saffron)" : i === sira.length - 2 ? "var(--muted)" : "var(--brand)", kesik: i === sira.length - 2 });
    const isaret = [{ lat: home[0], lon: home[1], tur: "ev", etiket: "Ev" }, ...stops.map((x, i) => ({ lat: x.lat, lon: x.lon, tur: x.reqId ? "hasta" : "durak", etiket: C.hhmm(x.start_min) }))];
    const topKm = rotalar.reduce((a, r, i) => a + MAP.rota(sira[i], sira[i + 1]).km.slice(-1)[0], 0);
    return `<div class="hr-kutu">${MAP.svg({ rotalar, isaretler: isaret, aciklama: "Günlük rota haritası" })}</div>
      <div class="tiny muted">Gerçek sokaklar üzerinde günlük rota · toplam ~${topKm.toFixed(1).replace(".", ",")} km${stops.some((x) => x.reqId) ? " · turuncu: yeni kabul ettiğin ziyaret" : ""}</div>`;
  }
  // Saatlerim: oturum boyunca saklanır; Pazartesi (bugün, 16.11) ve Salı (yarın, 17.11) eşleştirmeye anında yansır
  const GUN_ADI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"], GUN_TARIH = { 0: DATE, 1: DATE2 };
  function saatlerim(pid) {
    if (H.saatlerim && H.saatlerim[pid]) return H.saatlerim[pid];
    const v = GUN_ADI.map((_, i) => { const w = GUN_TARIH[i] ? repo.availability[pid + "|" + GUN_TARIH[i]] : null;
      return { acik: GUN_TARIH[i] ? !!w : i < 5, bas: w ? w[0] : 540, bit: w ? w[1] : 1020 }; });
    const p = repo.providers[pid];
    (H.saatlerim ||= {})[pid] = { gunler: v, ilceler: new Set([p.home_district]) };
    return H.saatlerim[pid];
  }
  function saatUygula(pid) {
    const S = saatlerim(pid);
    for (const [i, t] of Object.entries(GUN_TARIH)) {
      const g = S.gunler[i], k = pid + "|" + t;
      if (g.acik) repo.availability[k] = [g.bas, g.bit]; else delete repo.availability[k];
    }
    P.saatler = null; // hasta tarafındaki uygun saatler yeniden hesaplansın
  }
  function hHours(p) {
    const S = saatlerim(p.id);
    let opts = ""; for (let m = 7 * 60; m <= 22 * 60; m += 30) opts += `<option value="${m}">${C.hhmm(m)}</option>`;
    const sec = (v) => opts.replace(`value="${v}"`, `value="${v}" selected`);
    return `<div class="pad stack">
      <div class="small muted">Boş saatlerini seç. Sistem sana yalnızca bu aralıklara ve rotana uyan talepleri gösterir.</div>
      ${GUN_ADI.map((d, i) => { const g = S.gunler[i]; return `<div class="row" style="flex-wrap:nowrap"><label class="row small" style="width:84px"><input type="checkbox" data-saat-gun="${i}" ${g.acik ? "checked" : ""} style="accent-color:var(--brand)"> ${d}${GUN_TARIH[i] ? `<span class="tiny muted">${i ? " yarın" : " bugün"}</span>` : ""}</label>
        <select class="inp" data-saat-gun="${i}" data-uc="bas" aria-label="${d} başlangıç" ${g.acik ? "" : "disabled"}>${sec(g.bas)}</select><select class="inp" data-saat-gun="${i}" data-uc="bit" aria-label="${d} bitiş" ${g.acik ? "" : "disabled"}>${sec(g.bit)}</select></div>`; }).join("")}
      <div class="stack" style="gap:6px"><b class="small">Hizmet verdiğim ilçeler</b><div class="seg">${window.EVDE_DATA.districts.map((d) => `<button class="chip" type="button" aria-pressed="${S.ilceler.has(d.name)}" data-toggle="1" data-ilce="${esc(d.name)}">${esc(d.name)}</button>`).join("")}</div></div>
      <div class="note small">Değişiklikler bu oturum boyunca saklanır. Bugün (Pzt 16.11) ve yarın (Sal 17.11) için hastaya gösterilen uygun saatlere hemen yansır; diğer günler demo takviminde yok.</div></div>`;
  }
  $("#hScreen").addEventListener("change", (e) => {
    const el = e.target.closest("[data-saat-gun]"); if (!el || !H.pid) return;
    const S = saatlerim(H.pid), g = S.gunler[+el.dataset.saatGun];
    if (el.type === "checkbox") g.acik = el.checked;
    else {
      const v = +el.value, yeni = { ...g, [el.dataset.uc]: v };
      if (yeni.bas >= yeni.bit) { H.toast = "Bitiş saati başlangıçtan sonra olmalı."; renderH(); return; }
      g[el.dataset.uc] = v;
    }
    saatUygula(H.pid); H.toast = "Saatlerin kaydedildi."; renderH(); renderP();
  });
  $("#hScreen").addEventListener("input", (e) => { if (!G.onInput(e, gzR())) DG.onInput(e); });
  $("#hScreen").addEventListener("pointerdown", (e) => G.onPointerDown(e, gzR()));
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => $("#hScreen").addEventListener(ev, () => G.onPointerUp()));
  $("#hScreen").addEventListener("contextmenu", (e) => { if (e.target.closest("[data-gz-sure]")) e.preventDefault(); });
  $("#gzMasa").addEventListener("click", (e) => { if (G.onClick(e, P.request)) { renderP(); renderH(); gzYenile(true); } });
  // Güvenli Ziyaret: zamanlayıcı ilerler; yalnızca değişen kutular yeniden çizilir (PIN girişi bozulmasın)
  let gzImza = "";
  function gzKoy(sel, html) {
    const el = $(sel); if (!el || el._html === html) return;
    const odak = document.activeElement && document.activeElement.id === "gzPin" && el.contains(document.activeElement);
    el.innerHTML = html; el._html = html;
    if (odak) { const i = $("#gzPin"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function gzYenile(zorla) {
    const imza = G.tick(P.request);
    if (!zorla && imza === gzImza) return;
    gzImza = imza;
    if (P.screen === "done" && P.request) gzKoy("#gzHasta", G.hastaHtml(P.request));
    gzKoy("#gzCalisan", G.calisanHtml(gzR())); gzKoy("#gzUyari", G.uyariHtml(gzR())); gzKoy("#gzMasa", G.masaHtml(P.request));
    if ($("#hScreen .tabs") && !$("#gzCalisan") && G.aktif(gzR()) && H.tab === "rota" && !H.open) renderH(); // ilk görünüş
  }
  setInterval(() => gzYenile(false), 400);
  $("#hScreen").addEventListener("change", (e) => DG.onChange(e));
  $("#hScreen").addEventListener("keydown", (e) => DG.onKey(e));
  $("#demoCtl").addEventListener("click", (e) => DG.demoClick(e));
  $("#hScreen").addEventListener("click", async (e) => {
    if (DG.onClick(e)) return;
    if (G.onClick(e, gzR())) { renderH(); renderP(); gzYenile(true); return; }
    const t = e.target.closest("[data-tab],[data-open],[data-act],[data-toggle]");
    if (!t) return;
    if (t.dataset.toggle) {
      const acik = t.getAttribute("aria-pressed") !== "true"; t.setAttribute("aria-pressed", String(acik));
      if (t.dataset.ilce && H.pid) { const S = saatlerim(H.pid); if (acik) S.ilceler.add(t.dataset.ilce); else S.ilceler.delete(t.dataset.ilce); }
      return;
    }
    if (t.dataset.tab) { H.tab = t.dataset.tab; renderH(); return; }
    if (t.dataset.open) { H.open = t.dataset.open; renderH(); $("#hScreen").scrollTop = 0; return; }
    const a = t.dataset.act;
    if (a === "hback") { H.open = null; renderH(); }
    if (a === "hbilgi") { H.bilgiAcik = H.bilgiAcik === t.dataset.id ? null : t.dataset.id; renderH(); return; }
    if (a === "hbilgisor") {
      const r = REQ.find((x) => x.id === t.dataset.id) || inbox(H.pid).find((x) => x.id === t.dataset.id);
      if (r && !r.synthetic) { const upd = { ...r, ek_bilgi: [...new Set([...(r.ek_bilgi || []), t.dataset.v])] }; await putRequest(upd); if (P.request && P.request.id === r.id) P.request = upd; }
      H.bilgiAcik = null; H.toast = `Hastadan istendi: ${t.dataset.v}${r && r.synthetic ? " (örnek talep)" : ""}`; renderH(); renderP(); return;
    }
    if (a === "haccept" || a === "hreject") {
      const id = t.dataset.id, pid = H.pid;
      const r = inbox(pid).find((x) => x.id === id);
      if (!r) return;
      // Arayüz simülasyonu: gerçek uygulamada kabul yetkisi sunucuda denetlenir.
      if (a === "haccept" && !DG.canAccept()) { H.toast = "Başvurun onaylanmadan görev kabul edemezsin."; renderH(); return; }
      if (a === "haccept") {
        (H.accepted[pid] ||= []).push({ reqId: id, date: r.date || DATE, lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, service_code: r.service, earn: r.price.provider_gets });
        takvimeIsle(r);
        H.toast = `Kabul edildi. ${gunEki(r)}${C.hhmm(r.arrival_min)} rotana eklendi.`;
      } else { H.rejected[id] = true; takvimdenSil(id); H.toast = "Talep reddedildi; hastaya başka seçenek gösterilir."; }
      if (!r.synthetic) { const upd = { ...r, status: a === "haccept" ? "kabul" : "red", accepted_at: Date.now() }; await putRequest(upd); if (P.request && P.request.id === id) P.request = upd; }
      else if (a === "hreject") { /* örnek talep yalnızca listeden kalkar */ }
      H.open = null; H.tab = a === "haccept" ? "rota" : "talepler";
      renderH(); renderP();
    }
  });

  // ---------- dar ekran geçişi ----------
  document.querySelectorAll(".switch button").forEach((b) => b.addEventListener("click", () => {
    const h = b.dataset.show === "h";
    $("#colP").classList.toggle("hide-m", h); $("#colH").classList.toggle("hide-m", !h);
    document.querySelectorAll(".switch button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));

  // ---------- tek rol görünümü: #hasta ya da #calisan (ya da ?rol=hasta|calisan) — iki ayrı telefonda ayrı uygulama gibi ----------
  function rolUygula() {
    const q = new URLSearchParams(location.search).get("rol"), h = (location.hash || "").replace("#", "");
    const r0 = ["hasta", "calisan", "doktor"].includes(h) ? h : ["hasta", "calisan", "doktor"].includes(q) ? q : "";
    const rol = r0 === "doktor" ? "calisan" : r0; // doktor da sağlık çalışanı telefonunu kullanır
    document.body.classList.toggle("tek-rol", !!rol);
    document.body.classList.toggle("rol-hasta", rol === "hasta");
    document.body.classList.toggle("rol-calisan", rol === "calisan");
    if (rol) { $("#colP").classList.toggle("hide-m", rol !== "hasta"); $("#colH").classList.toggle("hide-m", rol !== "calisan"); }
  }
  window.addEventListener("hashchange", () => { const h = (location.hash || "").replace("#", ""); if (["hasta", "calisan", "doktor", "ikisi"].includes(h)) oturumAc(h); else rolUygula(); });
  rolUygula();
  // Yalnız hasta telefonu açıkken (ortak veri yok): çalışan ekranı görünmediği için onayı demo olarak 6 sn sonra çalışan adına ver.
  const otoOnay = {};
  setInterval(() => {
    if (!document.body.classList.contains("rol-hasta") || CAP.db) return;
    const r = P.request;
    if (!r || r.synthetic || r.status !== "bekliyor" || r.gun) return;
    otoOnay[r.id] ||= Date.now();
    if (Date.now() - otoOnay[r.id] < 6000) return;
    const pid = r.provider_id;
    (H.accepted[pid] ||= []).push({ reqId: r.id, date: r.date || DATE, lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, service_code: r.service, earn: r.price.provider_gets });
    const upd = { ...r, status: "kabul", accepted_at: Date.now() };
    putRequest(upd); P.request = upd; P.toast = `${person(pid).full} talebini onayladı (demo).`;
    renderP(); renderH();
  }, 1000);

  // ---------- demo hesapları: hasta ve sağlık çalışanı (prototip; gerçek kimlik doğrulama yok, şifre sunucuya gitmez) ----------
  const HESAPLAR = {
    hasta: { kullanici: "hasta", sifre: "1234", ad: "Ayşe Demir", aciklama: "Hasta yakını · Bornova", ilce: "Bornova" },
    calisan: { kullanici: "hemsire", sifre: "1234", ad: person("HEM-12").full, aciklama: "Hemşire · HEM-12 · mesleki başvurusu onaylı (demo)", pid: "HEM-12", prof: "hemsire" },
    doktor: { kullanici: "doktor", sifre: "1234", ad: person("HEK-02").full, aciklama: "Pratisyen hekim · HEK-02 · Bayraklı · mesleki başvurusu onaylı (demo)", pid: "HEK-02", prof: "hekim", hekimType: "pratisyen" },
  };
  function hastaGir() { P.info.district = HESAPLAR.hasta.ilce; }
  function calisanGir(h) {
    H.pid = h.pid;
    DG.state.status = "onaylandi"; DG.state.open = false; DG.state.view = "status";
    DG.state.f.name = h.ad; DG.state.f.prof = h.prof; if (h.hekimType) DG.state.f.hekimType = h.hekimType;
  }
  function oturumAc(rol) {
    if (rol === "ikisi") { // iki telefon yan yana: hasta ve hemşire hesapları açık
      hastaGir(); calisanGir(HESAPLAR.calisan);
      window.KAPIDA_OTURUM = { rol, ad: HESAPLAR.hasta.ad + " + " + HESAPLAR.calisan.ad };
    } else {
      const h = HESAPLAR[rol];
      window.KAPIDA_OTURUM = { rol, ad: h.ad };
      if (rol === "hasta") hastaGir(); else calisanGir(h);
    }
    if (location.hash !== "#" + rol) history.replaceState(null, "", "#" + rol);
    rolUygula();
    const g = $("#girisKatman"); if (g) g.remove();
    renderP(); renderH();
  }
  function girisEkrani() {
    const kart = (rol, ikon, baslik) => { const h = HESAPLAR[rol];
      return `<div class="giris-kart"><div class="giris-ust">${ikon} <b>${baslik}</b></div><div class="giris-ad">${esc(h.ad)}</div><div class="tiny muted">${esc(h.aciklama)}</div>
        <label class="tiny muted">Kullanıcı adı<input class="inp" data-gk="${rol}" value="${h.kullanici}" autocomplete="off"></label>
        <label class="tiny muted">Şifre<input class="inp" type="password" data-gs="${rol}" value="${h.sifre}" autocomplete="off"></label>
        <button class="btn primary block" type="button" data-giris="${rol}">Giriş yap</button></div>`; };
    const d = document.createElement("div");
    d.id = "girisKatman";
    d.innerHTML = `<div class="giris-kutu"><div class="logo">kapı<i>da</i></div><div class="small muted">Demo hesabıyla gir. Aynı telefonda ikisini yan yana görmek için "İkisi yan yana".</div>
      <div class="giris-sira">${kart("hasta", "🧑", "Hasta hesabı")}${kart("calisan", "🩺", "Hemşire hesabı")}${kart("doktor", "👨‍⚕️", "Doktor hesabı")}</div>
      <button class="btn block" type="button" data-giris="ikisi">İkisi yan yana: hasta + hemşire hesabıyla giriş (tek ekran demo)</button>
      <div class="tiny muted">Prototip: hesaplar sentetiktir, şifre hiçbir yere gönderilmez. Gerçek uygulamada giriş e-posta/telefon doğrulamasıyla, sağlık çalışanı için mesleki doğrulamayla yapılır.</div>
      <div class="tiny" id="girisHata" style="color:#b42318"></div></div>`;
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-giris]"); if (!b) return;
      const rol = b.dataset.giris;
      if (rol === "ikisi") { oturumAc("ikisi"); return; }
      const h = HESAPLAR[rol], k = d.querySelector(`[data-gk="${rol}"]`).value.trim(), s = d.querySelector(`[data-gs="${rol}"]`).value;
      if (k !== h.kullanici || s !== h.sifre) { d.querySelector("#girisHata").textContent = "Kullanıcı adı ya da şifre hatalı (demo: " + h.kullanici + " / " + h.sifre + ")."; return; }
      oturumAc(rol);
    });
    document.body.appendChild(d);
  }
  $("#cikisBtn").addEventListener("click", () => { history.replaceState(null, "", location.pathname + location.search.replace(/[?&]rol=[^&]*/, "")); location.reload(); });
  // Bağlantı #hasta / #calisan ile açıldıysa o hesapla doğrudan; değilse giriş ekranı
  { const h = (location.hash || "").replace("#", "") || new URLSearchParams(location.search).get("rol") || "";
    // "ham": giriş yapılmamış ham görünüm (otomatik testler; doğrulama akışı baştan)
    if (["hasta", "calisan", "doktor", "ikisi"].includes(h)) oturumAc(h); else if (h !== "ham") girisEkrani(); }

  // Otomatik testler için salt okunur durum görüntüsü (uygulamayı değiştirmez)
  window.KapidaTest = { durum: () => JSON.parse(JSON.stringify({ ekran: P.screen, mesgul: P.busy, mod: P.mode, plan: P.info.plan, kim: P.info.forWhom,
    mesajlar: P.msgs.map((m) => ({ kim: m.who, metin: m.text, araLaf: !!m.araLaf })), rapor: P.report, acil: P.emergency })) };
  renderP(); renderH();
  initCaps();
})();
