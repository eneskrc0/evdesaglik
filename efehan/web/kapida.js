/* Kapıda — hasta ve sağlık çalışanı uygulaması prototipi.
   Mantık: EvdeCore (core.js, Python sürümüyle birebir). Veri: EVDE_DATA (sentetik).
   YZ: claude.use("sample") varsa Claude; yoksa Cloudflare sunucusu (sunucu.js, Groq); o da yoksa senaryolu demo modu.
   Güvenlik: her mesaj önce kural motorunun kırmızı bayraklarından geçer; YZ ayrıca işaretler. */
(function () {
  "use strict";
  const C = window.EvdeCore;
  const repo = new C.Repo(window.EVDE_DATA);
  const DATE = "2026-11-16";
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
    info: { bed: false, plan: "bilinmiyor", district: "Bornova", when: 570, forWhom: "" },
    triage: null, sort: "onerilen", sheet: null, request: null, emergency: null, busy: false,
    voice: false, listening: false, mode: "loading", demoStep: 0, demoAnswers: [], toast: "",
  };
  const H = { pid: "HEM-12", tab: "talepler", open: null, accepted: {}, rejected: {}, toast: "" };
  // Mesleki doğrulama (dogrulama.js): ilk girişte açılır; onay (demo) olmadan görev kabul edilemez.
  const DG = window.KapidaDogrulama.create({ esc, rerender: () => renderH(), toast: (m) => { H.toast = m; renderH(); } });
  const REQ = []; // tüm talepler (yerel + ortak)
  const CAP = { sample: null, server: null, images: false, dictation: null, tts: null, db: null, uid: null };

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
    return P.msgs.map((m) => `${m.who === "me" ? "Hasta/yakını" : "Asistan"}: ${m.text}${m.photo ? " [fotoğraf eklendi]" : ""}`).join("\n");
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
    if (CAP.dictation && P.listening) { try { await CAP.dictation.stop(); } catch (e) { /**/ } }
    P.pendingShow = [];
    const shown = text || "Fotoğraf ekledim.";
    P.msgs.push({ who: "me", text: shown, photo: photos.map((p) => p.url) });
    for (const m of P.msgs) delete m.quick;
    // 1) Kural motoru: her mesajda kırmızı bayrak
    const t = C.triage(repo, P.msgs.filter((m) => m.who === "me").map((m) => m.text).join(". "), { bedridden: false, has_physician_plan: false });
    if (t.is_emergency) { P.emergency = { msg: t.message, why: t.reasons[0], src: "Kural motoru" }; P.screen = "emergency"; renderP(); return; }
    // 1b) "Direkt doktora yönlendir" / "soru sorma": soruları geç, hekime yönlendir
    if (DOKTOR_RE.test(C.normalize(shown))) { await doktoraYonlendir(); return; }
    // 2) YZ ya da demo
    if (P.mode === "ai") {
      P.turns.push({ role: "user", content: shown + (photos.length ? " [fotoğraf eklendi]" : "") });
      P.busy = true; renderP();
      try {
        const r = await aiReply();
        P.busy = false;
        const reply = String((r && r.reply) || "Anladım. Biraz daha anlatır mısın?");
        P.turns.push({ role: "assistant", content: reply });
        if (r && r.photo_notes) P.photoNotes.push(String(r.photo_notes));
        if (r && r.anlasilan) { const me = [...P.msgs].reverse().find((m) => m.who === "me"); if (me) me.understood = String(r.anlasilan).slice(0, 240); }
        if (r && r.red_flag) { P.emergency = { msg: reply, why: String(r.red_flag_reason || "Asistan acil belirti sezdi"), src: "Yapay zekâ" }; P.screen = "emergency"; renderP(); return; }
        P.msgs.push({ who: "ai", text: reply, quick: Array.isArray(r && r.quick_replies) ? r.quick_replies.slice(0, 4).map(String) : [] });
        speak(reply);
        if (r && r.doktora_yonlendir) { P.info.doktor = true; await buildReport(); return; }
        // En fazla 3 soru: ilk anlatım + 3 cevaptan sonra YZ hazır demese de rapora geç
        const userTurns = P.turns.filter((x) => x.role === "user").length;
        if ((r && r.ready) || userTurns >= MAX_SORU + 1) { await buildReport(); return; }
        renderP();
      } catch (e) {
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
      sikayet: a[0] || "belirtilmedi", baslangic: a[2] || "belirtilmedi", seyir: /kötüleş/.test(a[2] || "") ? "kötüleşiyor (beyan)" : "belirtilmedi",
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
  const DOKTOR_RE = /(direk|direkt|dogrudan|hemen|bir an once)\s*(bir\s*)?(doktor|hekim)|(doktor|hekim)(a|e)?\s*(yonlendir|bagla|gonder|gorusmek|bakmasini|baksin)|(doktor|hekim)\s*istiyorum|soru\s*sorma|sorulari\s*(gec|atla)|uzatma/;
  async function doktoraYonlendir() {
    P.info.doktor = true;
    const t = "Tamam, soruları geçiyorum. Anlattıklarını doktora ileteceğim; doktor gerekirse kendisi sorar.";
    P.msgs.push({ who: "ai", text: t }); speak(t);
    await buildReport();
  }
  async function buildReport() {
    P.screen = "building"; renderP();
    let rep = null;
    if (P.mode === "ai") {
      try { rep = await aiReport(); } catch (e) { P.toast = "Rapor yapay zekâyla hazırlanamadı; senin cevaplarınla basit bir özet çıkardık."; }
    }
    if (!rep || typeof rep !== "object") {
      if (P.mode === "ai") { const me = P.msgs.filter((m) => m.who === "me").map((m) => m.text); P.demoAnswers = [me.join(". "), "", "", "", ""]; }
      rep = demoReport();
    }
    if (!repo.services[rep.hizmet_onerisi]) rep.hizmet_onerisi = "ev_muayene";
    if (P.info.doktor) {
      rep.hizmet_onerisi = "ev_muayene";
      rep.oneri_gerekcesi = "Hasta/yakını soruları geçip doğrudan doktor değerlendirmesi istedi.";
      rep.hasta_icin_ozet = "İsteğin üzerine seni doğrudan bir doktora yönlendiriyoruz." + (rep.sikayet && rep.sikayet !== "belirtilmedi" ? " Doktora iletilecek: " + rep.sikayet + "." : "");
      rep.eksik_bilgiler = ["Ayrıntılar doktor tarafından sorulacak (kullanıcı soruları geçti)", ...(rep.eksik_bilgiler || [])];
    }
    ["ihtiyaclar", "malzeme", "eksik_bilgiler", "dikkat_edilecekler"].forEach((k) => { if (!Array.isArray(rep[k])) rep[k] = rep[k] ? [String(rep[k])] : []; });
    P.report = rep;
    P.info.bed = rep.yataga_bagimli === true;
    P.info.plan = ["var", "yok"].includes(rep.hekim_plani) ? rep.hekim_plani : "bilinmiyor";
    P.info.forWhom = rep.kim_icin || "";
    P.screen = "summary"; renderP();
  }
  function speak(text) {
    if (!P.voice || !CAP.tts) return;
    CAP.tts.speak(String(text).slice(0, 1900)).catch(() => { /* sessiz */ });
  }

  // ---------- seviye ve seçenekler ----------
  function patientPoint() {
    const pts = Object.values(repo.patients).filter((p) => p.district === P.info.district);
    const p = pts[0] || Object.values(repo.patients)[0];
    return { lat: p.lat, lon: p.lon, bedridden: P.info.bed, has_physician_plan: P.info.plan === "var", district: P.info.district, id: p.id };
  }
  function decide() {
    const pt = patientPoint();
    const userText = P.msgs.filter((m) => m.who === "me").map((m) => m.text).join(". ") + ". " + (P.report.sikayet || "");
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
    if (P.info.doktor && !t.is_emergency) {
      t = { ...t, level: "HEKIM_EV", services: ["ev_muayene"], route: "KULLANICI:doktor", reasons: ["İsteğin üzerine doğrudan doktora yönlendirildin."] };
    }
    return { t, pt };
  }
  const SORTS = { onerilen: ["Önerilen", { yetkinlik: 1, fiyat: 1, hiz: 1 }], ucuz: ["En uygun fiyat", { yetkinlik: 1, fiyat: 5, hiz: 1 }], erken: ["En erken", { yetkinlik: 1, fiyat: 1, hiz: 5 }], deneyim: ["En deneyimli", { yetkinlik: 5, fiyat: 1, hiz: 1 }] };
  function levelCopy(level, service) {
    const prof = (() => { const ps = [...repo.professionsFor(service)].filter((x) => x !== "hekim" && x !== "uzman_hekim"); return ps.length ? repo.professions[ps[0]].name_tr.toLowerCase() : "sağlık çalışanı"; })();
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
    const el = $("#pScreen");
    const scr = { home: pHome, chat: pChat, building: pBuilding, summary: pSummary, options: pOptions, done: pDone, emergency: pEmergency }[P.screen] || pHome;
    el.innerHTML = scr() + (P.sheet !== null && P.screen === "options" ? pSheet() : "") + (P.toast ? `<div class="toast" role="status">${esc(P.toast)}</div>` : "");
    if (P.toast) { const t = P.toast; setTimeout(() => { if (P.toast === t) { P.toast = ""; const n = $("#pScreen .toast"); if (n) n.remove(); } }, 3800); }
    if (P.screen === "chat") { const m = $("#pMsgs"); if (m) m.scrollTop = m.scrollHeight; }
  }
  function pHome() {
    return `<div class="pad stack" style="gap:16px">
      <div class="row between"><div><div class="small muted">İyi günler</div><h2 style="font-size:20px">Bugün nasıl yardımcı olalım?</h2></div>
        <span class="pill ${P.mode === "ai" ? "good" : "plain"}">${P.mode === "ai" ? "Yapay zekâ açık" : P.mode === "loading" ? "Hazırlanıyor" : "Demo modu"}</span></div>
      <div class="hero"><span class="deco"></span>
        <h1>Ne olduğunu anlat,<br>gerisini biz ayarlayalım.</h1>
        <div class="small" style="opacity:.9">Konuşarak ya da yazarak anlat. Fotoğraf ekleyebilirsin. Fiyatı seçmeden önce görürsün.</div>
        <button class="talk" type="button" data-act="start"><span class="mic">${ICO.mic}</span><span>Anlatmaya başla<br><span class="small muted" style="font-weight:500">yaklaşık 2 dakika</span></span></button>
      </div>
      <div class="how"><div><span class="n">1</span>Anlat</div><div><span class="n">2</span>Fiyatı gör, seç</div><div><span class="n">3</span>Kapında</div></div>
      <div class="stack" style="gap:8px"><div class="row between"><h3 style="font-size:16px">Sık istenenler</h3><span class="tiny muted">başlangıç fiyatları</span></div>
        <div class="tiles">${TILES.map(([code, name, pre]) => `<button class="tile" type="button" data-tile="${esc(pre)}">
          <span class="t-ico">${svcIcon(code)}</span><b>${esc(name)}</b><span class="from"><b class="num">${tl(fromPrice(code))} TL</b>'den</span></button>`).join("")}</div></div>
      <div class="sos">${ICO.alert}<span>Göğüs ağrısı, nefes darlığı, bilinç kaybı gibi acil durumlarda beklemeyin: <b>112</b></span></div>
    </div>`;
  }
  function pChat() {
    const last = P.msgs[P.msgs.length - 1];
    const quick = !P.busy && last && last.who === "ai" && last.quick && last.quick.length ? last.quick : [];
    return `<div class="chatwrap">
      <div class="chathead"><button class="back" type="button" data-act="home" aria-label="Geri">${ICO.back}</button><div class="bot">K</div>
        <div style="flex:1"><b>Kapıda asistanı</b><div class="tiny muted">${P.mode === "ai" ? (CAP.server ? "Yapay zekâ (sunucu) · teşhis koymaz" : "Yapay zekâ · teşhis koymaz") : "Demo soruları · teşhis koymaz"}</div></div>
        ${CAP.tts ? `<button class="iconbtn" type="button" data-act="voice" aria-pressed="${P.voice}" title="Yanıtları sesli oku" style="${P.voice ? "background:var(--brand-soft)" : ""}">${ICO.speaker}</button>` : ""}</div>
      <div class="pad" style="padding:10px 16px 0">${stepsBar(1)}</div>
      <div class="msgs" id="pMsgs">${P.msgs.map((m) => `<div class="msg ${m.who}">${esc(m.text)}${(m.photo || []).map((u) => `<img src="${u}" alt="Eklenen fotoğraf">`).join("")}</div>${m.understood ? `<div class="understood">Anladığım: ${esc(m.understood)}</div>` : ""}`).join("")}
        ${P.busy ? `<div class="msg ai"><span class="typing"><i></i><i></i><i></i></span></div>` : ""}</div>
      ${quick.length ? `<div class="quick">${quick.map((q) => `<button class="chip" type="button" data-quick="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}
      ${!P.busy && P.msgs.some((m) => m.who === "me") ? `<div class="skipdoc"><button class="btn ghost" type="button" data-act="skipdoc">Soruları geç, doktora yönlendir →</button></div>` : ""}
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
      <div class="card soft stack" style="gap:6px"><div class="small muted">Senin anlattığın</div><div>${esc(r.hasta_icin_ozet || r.sikayet)}</div></div>
      ${P.photos.length ? `<div class="stack" style="gap:6px"><div class="small muted">Fotoğraflar</div><div class="photos">${P.photos.map((p) => `<img src="${p.url}" alt="Eklenen fotoğraf">`).join("")}</div></div>` : ""}
      <div class="card stack" style="gap:10px">
        <div class="stack" style="gap:6px"><b class="small">Doktorun planı ya da reçetesi var mı?</b>
          <div class="seg">${opt("var", "Var")}${opt("yok", "Yok")}${opt("bilinmiyor", "Emin değilim")}</div>
          <div class="tiny muted">Hemşire, fizyoterapist gibi meslekler yalnızca doktor planıyla gelebilir.</div></div>
        <label class="row small" style="gap:10px"><input type="checkbox" id="pBed" ${P.info.bed ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--brand)"> Yatağa bağımlı / evden çıkamıyor</label>
        <label class="stack small" style="gap:4px" for="pDist"><b>Hangi ilçe? (açık adres sonra)</b>
          <select class="inp" id="pDist">${districts.map((d) => `<option${d === P.info.district ? " selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
        <div class="stack" style="gap:6px"><b class="small">Ne zaman?</b><div class="seg">${[[570, "Hemen"], [780, "Öğleden sonra"], [960, "Akşamüstü"]].map(([v, l]) => `<button class="chip" type="button" data-when="${v}" aria-pressed="${P.info.when === v}">${l}</button>`).join("")}</div></div>
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
  function pOptions() {
    const { t, pt } = decide();
    P.triage = t;
    if (t.is_emergency) { P.emergency = { msg: t.message, why: t.reasons[0], src: "Kural motoru" }; P.screen = "emergency"; return pEmergency(); }
    const service = t.services[0];
    const res = C.findCandidates(repo, service, pt, DATE, P.info.when, SORTS[P.sort][1], 20, 5);
    P.cands = res.candidates; P.pt = pt;
    const [ico, head, why] = levelCopy(t.level, service);
    return `<div class="pad stack">
      <button class="back" type="button" data-act="summary">${ICO.back} Özete dön</button>
      ${stepsBar(3)}
      <div class="levelcard"><span class="lv-ico">${ico}</span><div class="stack" style="gap:4px"><b>${esc(head)}</b><span class="small">${esc(why)}</span>
        <span class="small muted">Hizmet: ${esc(svc(service).name_tr)} · ${svc(service).duration_min} dk</span></div></div>
      <div class="seg" role="group" aria-label="Sıralama">${Object.entries(SORTS).map(([k, [l]]) => `<button class="chip" type="button" data-sort="${k}" aria-pressed="${P.sort === k}">${l}</button>`).join("")}</div>
      ${P.cands.length ? P.cands.map((c, i) => optCard(c, i)).join("") : `<div class="card soft">Bu saat için uygun kişi bulamadık. "Ne zaman?" seçimini değiştirip tekrar dene.</div>`}
      <div class="tiny muted" style="text-align:center">Fiyatlar örnektir. Ödeme ziyaret tamamlanınca alınır (demo).</div>
    </div>`;
  }
  function optCard(c, i) {
    const pp = person(c.provider_id), pv = repo.providers[c.provider_id];
    const shared = c.insertion && c.insertion.shared;
    const remote = !c.insertion;
    return `<button class="opt ${i === 0 ? "best" : ""}" type="button" data-pick="${i}">
      <div class="row between" style="width:100%"><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(pp.initials)}</span>
        <div><b>${esc(pp.full)}</b><div class="tiny muted">${esc(pp.prof)} · ${pv.years_experience} yıl · ★ ${pv.rating}</div></div></div>
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
    const steps = [["Talep gönderildi", "Raporun sağlık çalışanına iletildi.", true], [st === "red" ? "Sağlık çalışanı uygun değil" : "Sağlık çalışanı onayı", st === "kabul" ? `${pp.first} talebi kabul etti.` : st === "red" ? "Sana yeni seçenekler gösterelim." : "Genelde 10 dakika içinde yanıt gelir.", st !== "bekliyor"],
      ["Yolda", `${C.hhmm(r.arrival_min - 20)} civarı yola çıkar.`, false], ["Kapında", `${C.hhmm(r.arrival_min)}`, false], ["Tamamlandı, ödeme", `${tl(r.price.patient_pays)} TL`, false]];
    return `<div class="pad stack">
      ${stepsBar(4)}
      <div class="row between"><h2 style="font-size:22px">${st === "kabul" ? "Randevun kesinleşti" : st === "red" ? "Başka bir seçenek seçelim" : "Talebin gönderildi"}</h2>
        <span class="pill ${st === "kabul" ? "good" : st === "red" ? "coral" : "sun"}">${st === "kabul" ? "Onaylandı" : st === "red" ? "Uygun değil" : "Onay bekleniyor"}</span></div>
      <div class="card row" style="flex-wrap:nowrap"><span class="avatar">${esc(pp.initials)}</span><div style="flex:1"><b>${esc(pp.full)}</b><div class="tiny muted">${esc(svc(r.service).name_tr)}</div></div>
        <div style="text-align:right"><div class="when">${C.hhmm(r.arrival_min)}</div><div class="small num">${tl(r.price.patient_pays)} TL</div></div></div>
      <div class="timeline-v">${steps.map(([a, b, done], i) => `<div class="tv ${done ? "done" : (i === steps.findIndex((s) => !s[2]) ? "now" : "")}"><span class="dot"></span><div><b class="small">${esc(a)}</b><div class="tiny muted">${esc(b)}</div></div></div>`).join("")}</div>
      ${r.report.malzeme && r.report.malzeme.length ? `<div class="card stack" style="gap:6px"><b class="small">Ziyaretten önce hazırla</b>${r.report.malzeme.map((m) => `<div class="row small">${ICO.check}<span>${esc(m)}</span></div>`).join("")}</div>` : ""}
      ${st === "red" ? `<button class="btn primary block" type="button" data-act="options">Diğer seçeneklere bak</button>` : `<button class="btn block" type="button" data-act="cancel">Talebi iptal et</button>`}
      <button class="btn ghost" type="button" data-act="home">Ana sayfa</button>
      ${!CAP.db ? `<div class="tiny muted" style="text-align:center">Bu görünümde talep yalnızca bu sayfadaki sağlık çalışanı ekranına gider.</div>` : `<div class="tiny muted" style="text-align:center">Talep ortak kayda yazıldı; başka cihazdaki sağlık çalışanı ekranı da görür.</div>`}
    </div>`;
  }
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
    const t = e.target.closest("[data-act],[data-tile],[data-quick],[data-plan],[data-when],[data-sort],[data-pick]");
    if (!t) return;
    if (t.dataset.stop && !e.target.closest("[data-act]")) return;
    const a = t.dataset.act;
    if (t.dataset.tile !== undefined) { startChat(t.dataset.tile); return; }
    if (t.dataset.quick !== undefined) { send(t.dataset.quick); return; }
    if (t.dataset.plan) { P.info.plan = t.dataset.plan; renderP(); return; }
    if (t.dataset.when) { P.info.when = +t.dataset.when; renderP(); return; }
    if (t.dataset.sort) { P.sort = t.dataset.sort; P.sheet = null; renderP(); return; }
    if (t.dataset.pick !== undefined) { P.sheet = +t.dataset.pick; renderP(); return; }
    if (a === "start") startChat();
    else if (a === "home") { P.screen = "home"; P.sheet = null; renderP(); }
    else if (a === "chat") { P.screen = "chat"; P.emergency = null; renderP(); }
    else if (a === "skipdoc") { if (!P.busy) { P.msgs.push({ who: "me", text: "Soruları geç, doktora yönlendir." }); await doktoraYonlendir(); } }
    else if (a === "summary") { P.screen = "summary"; renderP(); }
    else if (a === "options") { P.screen = "options"; P.sheet = null; renderP(); }
    else if (a === "voice") { P.voice = !P.voice; renderP(); }
    else if (a === "closeSheet") { if (e.target === t || t.tagName === "BUTTON") { P.sheet = null; renderP(); } }
    else if (a === "confirm") { await confirmBooking(); }
    else if (a === "cancel") { if (P.request) { P.request = { ...P.request, status: "iptal" }; await putRequest(P.request); } P.screen = "home"; P.toast = "Talebin iptal edildi."; renderP(); renderH(); }
  });
  $("#pScreen").addEventListener("submit", (e) => { if (e.target.id === "pComposer") { e.preventDefault(); const ta = $("#pInput"); const v = ta.value; ta.value = ""; send(v); } });
  $("#pScreen").addEventListener("keydown", (e) => { if (e.target.id === "pInput" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#pComposer").requestSubmit(); } });
  $("#pScreen").addEventListener("change", async (e) => {
    if (e.target.id === "pPhoto" && e.target.files[0]) {
      try {
        const big = await compress(e.target.files[0], 1200), small = await compress(e.target.files[0], 480);
        const ph = { blob: big.blob, url: small.url };
        P.photos.push(ph); P.pendingPhotos.push(ph); (P.pendingShow ||= []).push(ph);
      } catch (err) { P.toast = "Bu fotoğraf açılamadı; başka bir fotoğraf dene."; }
      renderP();
    }
    if (e.target.id === "pBed") { P.info.bed = e.target.checked; }
    if (e.target.id === "pDist") { P.info.district = e.target.value; }
  });
  // Mikrofon: start() tıklamadan hemen çağrılmalı
  $("#pScreen").addEventListener("click", (e) => {
    const b = e.target.closest("#pMic"); if (!b || !CAP.dictation) return;
    if (P.listening) { CAP.dictation.stop().catch(() => {}); return; }
    CAP.dictation.start().catch((err) => { if (err && err.code === "not_granted") { CAP.dictation = null; P.toast = "Mikrofon izni yok; yazarak devam edebilirsin."; renderP(); } });
  });

  async function confirmBooking() {
    const c = P.cands[P.sheet];
    const id = "T" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const r = {
      id, created_at: new Date().toISOString(), status: "bekliyor", provider_id: c.provider_id, service: c.service, level: P.triage.level,
      arrival_min: c.arrival_min, price: c.price, ins: c.insertion, patient: { district: P.info.district, lat: P.pt.lat, lon: P.pt.lon, bedridden: P.info.bed, plan: P.info.plan },
      report: P.report, photos: P.photos.slice(0, 3).map((p) => p.url), red_flags_checked: true, from_app: true, author: CAP.uid || null,
    };
    P.request = r; P.sheet = null; P.screen = "done";
    H.pid = c.provider_id; H.tab = "talepler"; H.open = id;
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
    sonda_bakimi: { tek: "Sonda değişimi, yatağa bağımlı hasta", s: "Sonda 1 aydır takılı, değişim zamanı geldi (beyan)", bed: true, mal: ["Sonda seti", "Eldiven"], eks: ["Sonda numarası"] },
    vital_takip: { tek: "Tansiyon ve şeker takibi", s: "Haftalık tansiyon ve şeker ölçümü istendi (beyan)", bed: true, mal: ["Tansiyon aleti", "Glukometre"], eks: ["Son ölçüm değerleri"] },
    beslenme_tupu_bakimi: { tek: "PEG tüpü çevresi kızarık", s: "Beslenme tüpü çevresinde kızarıklık, 3 gündür (beyan)", bed: true, mal: ["Pansuman seti"], eks: ["Ateş var mı"] },
    tele_hemsire_destekli: { tek: "Ateş ve öksürük, yatağa bağımlı", s: "2 gündür ateş ve öksürük; yatağa bağımlı (beyan)", bed: true, mal: ["Ateş ölçer", "Oksimetre"], eks: ["Ateş kaç derece"] },
    fizyoterapi_seansi: { tek: "Diz protezi sonrası fizik tedavi", s: "3 hafta önce diz protezi; hekim fizik tedavi önerdi (beyan)", bed: false, mal: ["Egzersiz bandı"], eks: ["Ameliyat raporu"] },
    ev_muayene: { tek: "Halsizlik ve iştahsızlık, 80 yaş", s: "Bir haftadır halsizlik ve iştahsızlık; evden çıkamıyor (beyan)", bed: true, mal: [], eks: ["Kullandığı ilaçlar"] },
  };
  function cannedReport(code) {
    const k = CANNED[code] || { tek: svc(code).name_tr, s: svc(code).name_tr + " talebi (beyan)", bed: false, mal: [], eks: ["Kullandığı ilaçlar"] };
    return { kim_icin: "Hasta yakını (örnek)", yas_araligi: "70 üstü", sikayet: k.s, baslangic: "belirtildi", seyir: "belirtilmedi", siddet_beyani: "belirtilmedi", yataga_bagimli: k.bed, hekim_plani: "var", plan_detayi: "Plan/reçete beyan edildi; ziyarette görülmeli.", kronik_ilac_alerji: "belirtilmedi", ihtiyaclar: [svc(code).name_tr], malzeme: k.mal, foto_ozeti: /fotoğraf/.test(k.tek) ? "Örnek talepte fotoğraf yok (sentetik)." : "", eksik_bilgiler: k.eks, saglikci_icin_ozet: k.s + ". Bilgiler hasta yakınının beyanıdır.", tek_satir: k.tek, hasta_icin_ozet: k.s };
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
      const ins = C.bestInsertion(home, hWindow(pid), stops, [pt.lat, pt.lon], svc(code).duration_min, 600);
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
    return [...(repo.scheduled[pid + "|" + DATE] || []), ...(H.accepted[pid] || [])].sort((a, b) => a.start_min - b.start_min);
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
    let km = 0, prev = home; for (const s of stops) { km += C.roadKm(prev, [s.lat, s.lon]); prev = [s.lat, s.lon]; } if (stops.length) km += C.roadKm(prev, home);
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
      ${DG.banner()}<div style="flex:1">${body}</div></div>${H.toast ? `<div class="toast" role="status">${esc(H.toast)}</div>` : ""}`;
    if (H.toast) { const t = H.toast; setTimeout(() => { if (H.toast === t) { H.toast = ""; const n = $("#hScreen .toast"); if (n) n.remove(); } }, 3500); }
  }
  function hInbox(box) {
    if (!box.length) return `<div class="pad muted">Şu an yeni talep yok. Saatlerini genişletirsen daha fazla talep gelir.</div>`;
    return `<div class="pad stack">${box.map((r) => `<button class="req ${r.synthetic ? "" : "new"}" type="button" data-open="${esc(r.id)}">
      <div class="row between" style="width:100%;flex-wrap:nowrap"><span class="row" style="gap:6px;flex-wrap:nowrap;min-width:0">${svcIcon(r.service)}<b>${esc(svc(r.service).name_tr)}</b></span>${r.synthetic ? `<span class="pill plain">örnek</span>` : `<span class="pill sun">Yeni · uygulamadan</span>`}</div>
      <div class="cond">${esc(r.report.tek_satir || r.report.sikayet)}</div>
      <div class="row small muted" style="gap:10px"><span class="row" style="gap:4px">${ICO.clock}${C.hhmm(r.arrival_min)}</span><span class="row" style="gap:4px">${ICO.pin}${esc(r.patient.district)}</span>
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
      <div class="card row between"><div class="stack" style="gap:2px"><span class="when">${C.hhmm(r.arrival_min)} · ${svc(r.service).duration_min} dk</span><span class="small muted">${esc(r.patient.district)}${r.ins ? ` · ek yol ${r.ins.added_km} km` : ""}</span></div>
        <div style="text-align:right"><div class="earn num">+${tl(hEarn(r))} TL</div><div class="tiny muted">senin kazancın</div></div></div>
      <div class="sec card stack" style="gap:8px"><h3>Hastanın durumu</h3>
        <div>${esc(rep.saglikci_icin_ozet || rep.sikayet)}</div>
        <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || "belirtilmedi")}</dd>`).join("")}</dl>
        ${rep.hastanin_kendi_sozleri && rep.hastanin_kendi_sozleri !== "belirtilmedi" ? `<div class="small"><span class="muted">Kendi sözleriyle:</span> “${esc(rep.hastanin_kendi_sozleri)}”</div>` : ""}
        ${rep.oneri_gerekcesi ? `<div class="small"><span class="muted">Neden bu hizmet önerildi:</span> ${esc(rep.oneri_gerekcesi)} <span class="muted">(öneri; kararı sen verirsin)</span></div>` : ""}
        <div class="tiny muted">Hasta / yakını beyanından yapay zekâ ile özetlendi${r.synthetic ? " (örnek)" : ""}. Teşhis değildir; kontrol et. Kırmızı bayrak kontrolü: temiz.</div></div>
      ${(r.photos || []).length || rep.foto_ozeti ? `<div class="sec card stack" style="gap:8px"><h3>Fotoğraflar</h3>${(r.photos || []).length ? `<div class="photos">${r.photos.map((u) => `<img src="${u}" alt="Hastanın eklediği fotoğraf">`).join("")}</div>` : ""}${rep.foto_ozeti ? `<div class="small">${esc(rep.foto_ozeti)}</div>` : ""}</div>` : ""}
      ${(rep.ihtiyaclar || []).length || (rep.malzeme || []).length ? `<div class="sec card stack" style="gap:4px"><h3>İhtiyaçlar ve getirmen gerekenler</h3><div class="checklist">
        ${[...(rep.ihtiyaclar || []).map((x) => "İstenen: " + x), ...(rep.malzeme || [])].map((x, i) => `<label for="ck${i}"><input type="checkbox" id="ck${i}"> <span>${esc(x)}</span></label>`).join("")}</div></div>` : ""}
      ${(rep.dikkat_edilecekler || []).length ? `<div class="sec card stack" style="gap:4px"><h3>Dikkat</h3>${rep.dikkat_edilecekler.map((x) => `<div class="row small">${ICO.alert}<span>${esc(x)}</span></div>`).join("")}</div>` : ""}
      ${(rep.eksik_bilgiler || []).length ? `<div class="sec card stack" style="gap:4px"><h3>Ziyarette netleştir</h3>${rep.eksik_bilgiler.map((x) => `<div class="row small">${ICO.alert}<span>${esc(x)}</span></div>`).join("")}</div>` : ""}
      <div class="sec card stack" style="gap:8px"><h3>Rotan ve kazancın</h3>
        ${mapSVG(home, stops)}
        <div class="small">${r.ins && r.ins.shared ? `Bu ziyaret bugünkü rotana eklenir: ek yol <b>${r.ins.added_km} km</b> (tek başına ${r.ins.standalone_km} km).` : r.ins ? `Ek yol ${r.ins.added_km} km.` : ""}</div>
        <div class="bill small"><span>Hizmet bedeli</span><span class="num">${tl(pr.service_fee)} TL</span><span>Platform payı (%10)</span><span class="num">−${tl(pr.service_fee * C.CFG.COMMISSION)} TL</span>
          ${pr.actual_travel != null ? `<span>Yol masrafı karşılığı</span><span class="num">${tl(pr.actual_travel)} TL</span>` : ""}
          ${pr.saving > 0 ? `<span class="disc">Paylaşım primi</span><span class="disc num">+${tl(pr.saving * C.CFG.SPLIT.saglikci)} TL</span>` : ""}
          <span class="tot">Sana kalan</span><span class="tot num">${tl(pr.provider_gets)} TL</span></div></div>
      <div style="height:70px"></div></div>
      <div class="hbar" style="flex-wrap:wrap"><button class="btn" type="button" data-act="hreject" data-id="${esc(r.id)}">Reddet</button><button class="btn primary" type="button" data-act="haccept" data-id="${esc(r.id)}" style="flex:1"${DG.canAccept() ? "" : ` disabled aria-describedby="lockMsg"`}>Kabul et · ${C.hhmm(r.arrival_min)}</button>
        ${DG.canAccept() ? "" : `<div class="lockmsg" id="lockMsg" style="width:100%">Başvurun onaylanınca görev kabul edebilirsin.</div>`}</div>`;
  }
  function hRoute(p, stops) {
    const home = [p.home_lat, p.home_lon];
    return `<div class="pad stack">${mapSVG(home, stops.map((s) => ({ ...s, isNew: !!s.reqId })))}
      <div class="timeline-v">${stops.length ? stops.map((s) => `<div class="tv ${s.reqId ? "now" : "done"}"><span class="dot"></span><div><b class="small">${C.hhmm(s.start_min)} · ${esc(svc(s.service_code).name_tr)}</b><div class="tiny muted">${s.duration_min} dk${s.reqId ? " · yeni kabul" : " · planlı"}</div></div></div>`).join("") : `<div class="muted">Bugün planlı ziyaret yok.</div>`}</div></div>`;
  }
  function hHours(p) {
    const w = hWindow(p.id);
    let opts = ""; for (let m = 7 * 60; m <= 21 * 60; m += 30) opts += `<option value="${m}">${C.hhmm(m)}</option>`;
    return `<div class="pad stack">
      <div class="small muted">Boş saatlerini seç. Sistem sana yalnızca bu aralıklara ve rotana uyan talepleri gösterir.</div>
      ${["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d, i) => `<div class="row" style="flex-wrap:nowrap"><label class="row small" style="width:72px"><input type="checkbox" ${i < 5 ? "checked" : ""} style="accent-color:var(--brand)"> ${d}</label>
        <select class="inp" aria-label="${d} başlangıç">${opts.replace(`value="${w[0]}"`, `value="${w[0]}" selected`)}</select><select class="inp" aria-label="${d} bitiş">${opts.replace(`value="${w[1]}"`, `value="${w[1]}" selected`)}</select></div>`).join("")}
      <div class="stack" style="gap:6px"><b class="small">Hizmet verdiğim ilçeler</b><div class="seg">${window.EVDE_DATA.districts.map((d) => `<button class="chip" type="button" aria-pressed="${d.name === p.home_district}" data-toggle="1">${esc(d.name)}</button>`).join("")}</div></div>
      <div class="note small">Taslak ekran: değişiklikler kaydedilmez.</div></div>`;
  }
  $("#hScreen").addEventListener("input", (e) => DG.onInput(e));
  $("#hScreen").addEventListener("change", (e) => DG.onChange(e));
  $("#hScreen").addEventListener("keydown", (e) => DG.onKey(e));
  $("#demoCtl").addEventListener("click", (e) => DG.demoClick(e));
  $("#hScreen").addEventListener("click", async (e) => {
    if (DG.onClick(e)) return;
    const t = e.target.closest("[data-tab],[data-open],[data-act],[data-toggle]");
    if (!t) return;
    if (t.dataset.toggle) { t.setAttribute("aria-pressed", t.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }
    if (t.dataset.tab) { H.tab = t.dataset.tab; renderH(); return; }
    if (t.dataset.open) { H.open = t.dataset.open; renderH(); $("#hScreen").scrollTop = 0; return; }
    const a = t.dataset.act;
    if (a === "hback") { H.open = null; renderH(); }
    if (a === "haccept" || a === "hreject") {
      const id = t.dataset.id, pid = H.pid;
      const r = inbox(pid).find((x) => x.id === id);
      if (!r) return;
      // Arayüz simülasyonu: gerçek uygulamada kabul yetkisi sunucuda denetlenir.
      if (a === "haccept" && !DG.canAccept()) { H.toast = "Başvurun onaylanmadan görev kabul edemezsin."; renderH(); return; }
      if (a === "haccept") {
        (H.accepted[pid] ||= []).push({ reqId: id, lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, service_code: r.service, earn: r.price.provider_gets });
        H.toast = `Kabul edildi. ${C.hhmm(r.arrival_min)} rotana eklendi.`;
      } else { H.rejected[id] = true; H.toast = "Talep reddedildi; hastaya başka seçenek gösterilir."; }
      if (!r.synthetic) { const upd = { ...r, status: a === "haccept" ? "kabul" : "red" }; await putRequest(upd); if (P.request && P.request.id === id) P.request = upd; }
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

  renderP(); renderH();
  initCaps();
})();
