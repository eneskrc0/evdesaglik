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
    kisi: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    ayar: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    kilit: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    kalkan: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    soru: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
    bilgi: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
    kart: I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
    gorunum: I('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>'),
    grup: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.6 0 4.5 1.3 5.5 4"/>'),
    telefon: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    cikis: I('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>'),
    yildiz: I('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>'),
    zil: I('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    ileri: I('<path d="M9 5l7 7-7 7"/>'),
    takvim: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M10 15.5l2-1.5v4"/>'),
    para: I('<ellipse cx="9" cy="7" rx="5.5" ry="2.2"/><path d="M3.5 7v3.5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V7"/><path d="M3.5 10.5V14c0 1.2 2.5 2.2 5.5 2.2"/><ellipse cx="15.5" cy="14" rx="5" ry="2"/><path d="M10.5 14v3.6c0 1.1 2.2 2 5 2s5-.9 5-2V14"/>'),
    // Yara bandı (iki yuvarlak uçlu, ortası delikli) ve damlalı tüp — hizmet listesi
    yarabandi: I('<rect x="2.5" y="8.2" width="19" height="7.6" rx="3.8" transform="rotate(-45 12 12)"/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1" transform="rotate(-45 12 12)"/><path d="M11 11h.01M13 13h.01M11 13h.01M13 11h.01"/>'),
    tupdamla: I('<path d="M5 3h7M6.2 3v13.3a2.3 2.3 0 0 0 4.6 0V3M6.2 10h4.6"/><path d="M17.5 12s3 3.3 3 5.3a3 3 0 0 1-6 0c0-2 3-5.3 3-5.3z"/>'),
  };
  // Genel sağlık çalışanı avatarı (fotoğraf yerine; gerçek kişi değil)
  const AVATAR = `<svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 17.5c0-6 5-9.5 11-9.5s11 3.5 11 9.5"/><path d="M16.5 17.5h23l-1 4h-21z"/><path d="M28 10.5v5M25.5 13h5" stroke="var(--brand)" stroke-width="2.2"/><path d="M18 22c0 7 4.5 12 10 12s10-5 10-12"/><path d="M8 52c1.5-8.5 9-13 20-13s18.5 4.5 20 13"/></svg>`;
  const MARKA = `<span class="logo"><svg class="marka" viewBox="0 0 40 40" aria-hidden="true"><use href="#marka"/></svg>anında sağlık</span>`;
  const BLD = { p: [], h: [] }, BLD_ANAHTAR = { p: new Set(), h: new Set() }, BLD_PANEL = { p: false, h: false }; // bildirimler (aşağıda)
  // Uygulama başlığı: logo + bildirim zili (okunmamış sayısı; dokununca bildirim listesi) + profil düğmesi (baş harfler)
  const appbar = (taraf = "p") => { const n = BLD[taraf].filter((x) => !x.okundu).length;
    const bas = taraf === "h" ? person(H.pid).initials : ((PR.h.ad || "").trim().split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toLocaleUpperCase("tr") || "");
    return `<div class="appbar">${MARKA}<span class="row" style="gap:2px;flex-wrap:nowrap"><button class="zil" type="button" data-zil="${taraf}" aria-label="${n ? `Bildirimler, ${n} okunmamış` : "Bildirimler"}" aria-expanded="${BLD_PANEL[taraf]}">${ICO.zil}<span class="zil-rozet"${n ? "" : " hidden"}>${n > 9 ? "9+" : n}</span></button>
      <button class="profil-dugme" type="button" data-act="${taraf === "h" ? "hprofil" : "profil"}" aria-label="Profil ve ayarlar">${bas ? esc(bas) : ICO.kisi}</button></span></div>`; };
  const svcIcon = (code) => {
    const s = svc(code) || {};
    if (/bas|yara|pansuman/.test(code)) return ICO.yarabandi;
    if (code === "iv_serum") return ICO.drop;
    if (/enjeksiyon/.test(code)) return ICO.syringe;
    if (/kan_alma|vital/.test(code)) return ICO.tupdamla;
    if (s.category === "rehabilitasyon") return ICO.walk;
    if (s.category === "tele") return ICO.video;
    return ICO.steth;
  };

  // ---------- örnek kişi adları (sentetik) ----------
  const NAMES = ["Elif", "Zeynep", "Ayşe", "Merve", "Selin", "Burak", "Emre", "Deniz", "Can", "Ece", "Gizem", "Mert", "Seda", "Onur", "İrem", "Kerem", "Duygu", "Tolga", "Nazlı", "Barış"];
  const SUR = "AKYDTSBÇEGHMÖPUVZ";
  const TITLE = { hemsire: "Hemşire", hekim: "Dr.", uzman_hekim: "Uzm. Dr.", ebe: "Ebe", fizyoterapist: "Fzt.", odyolog: "Ody.", diyetisyen: "Dyt.", dil_konusma: "DKT", ergoterapist: "Ergoterapist", klinik_psikolog: "Psk.", podolog: "Podolog" };
  // Başlıkta kısa ad: "Hemşire Onur V." (unvan + ad + soyadın baş harfi)
  const kisaAd = (pid) => person(pid).full;
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

  // ---------- Kayıtlı adresler (yemek uygulamalarındaki gibi: bir kez yaz, sonra seç) ----------
  // Adresler bu tarayıcıda, hesaba göre saklanır (localStorage; prototip, sunucuya gitmez). Demo hasta hesabında iki sentetik adres hazır.
  const AB = { hesap: "misafir", liste: [], secili: null };
  const ABASLIK = ["Ev", "İş", "Annemin evi", "Babamın evi"];
  const adresAnahtar = () => "anindasaglik_adresler_" + AB.hesap;
  // Bir OSM adres sonucunu (ll) yol paketindeki en yakın noktaya yerleştir: süre matrisi bu noktalarla çalışır
  function noktaBul(ll) {
    const nok = window.EVDE_DATA.yol.noktalar; let en = 0, ed = 1e9;
    nok.forEach((n, i) => { const d = ADR ? ADR.km(ll, [n[0], n[1]]) : 1e9; if (d < ed) { ed = d; en = i; } });
    const n = nok[en];
    return { lat: n[0], lon: n[1], km: ed, ilce: window.EVDE_DATA.districts.some((d) => d.name === n[2]) ? n[2] : null };
  }
  const tarifMetni = (a) => [a.bina && `Bina no ${a.bina}`, a.kat && `${a.kat}. kat`, a.daire && `daire ${a.daire}`, a.tarif].filter(Boolean).join(", ");
  function adresDefteriYaz() { try { localStorage.setItem(adresAnahtar(), JSON.stringify({ liste: AB.liste, secili: AB.secili })); } catch (e) { /* gizli sekme ya da yer yok: bellekte kalır */ } }
  function adresDefteriYukle(hesap, ornekle) {
    AB.hesap = hesap; AB.liste = []; AB.secili = null; let kayit = null;
    try { kayit = JSON.parse(localStorage.getItem(adresAnahtar()) || "null"); } catch (e) { kayit = null; }
    if (kayit && Array.isArray(kayit.liste)) { AB.liste = kayit.liste; AB.secili = kayit.secili; }
    else if (ornekle && ADR) { // demo hasta: sentetik iki adres
      const ornek = (baslik, ara, ilce, ek) => { const x = ADR.ara(ara)[0]; if (!x) return null; const n = noktaBul(x.ll);
        return { id: "A" + Math.random().toString(36).slice(2, 8), baslik, adres: x.ad + (x.alt ? ", " + x.alt : ""), ilce: n.ilce || ilce, nokta: { lat: n.lat, lon: n.lon, km: n.km }, ...ek }; };
      AB.liste = [ornek("Ev", "Kazımdirik Mah. 372. Sok.", "Bornova", { bina: "12", kat: "3", daire: "7", tarif: "zil: Demir", varsayilan: true }),
        ornek("Annemin evi", "Bostanlı", "Karşıyaka", { bina: "5", kat: "1", daire: "2", tarif: "yeşil bina, bahçe kapısından" })].filter(Boolean);
      adresDefteriYaz();
    }
    if (!AB.liste.some((a) => a.id === AB.secili)) AB.secili = ((AB.liste.find((a) => a.varsayilan) || AB.liste[0]) || {}).id || null;
    const a = AB.liste.find((x) => x.id === AB.secili); if (a) adresUygula(a);
  }
  function adresUygula(a) {
    AB.secili = a.id;
    if (a.ilce) P.info.district = a.ilce;
    P.info.nokta = a.nokta ? { ...a.nokta, adres: a.adres } : null;
    P.info.adresYazi = a.adres || ""; P.info.tarif = tarifMetni(a); P.saatler = null;
  }
  const seciliAdres = () => AB.liste.find((a) => a.id === AB.secili) || null;

  // ---------- Profil ve ayarlar (hasta + sağlık çalışanı) ----------
  // Bu tarayıcıda, hesaba göre localStorage'da (prototip; sunucuya gitmez). Sağlık bilgisi, T.C. no, kart/banka numarası tutulmaz.
  const yerel = { oku: (k, v) => { try { const x = JSON.parse(localStorage.getItem(k) || "null"); return x == null ? v : x; } catch (e) { return v; } },
    yaz: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* gizli sekme: bellekte kalır */ } } };
  const GORUNUM = Object.assign({ tema: "sistem", yazi: "normal" }, yerel.oku("anindasaglik_gorunum", {}));
  function gorunumUygula() {
    const r = document.documentElement;
    if (GORUNUM.tema === "sistem") delete r.dataset.theme; else r.dataset.theme = GORUNUM.tema === "koyu" ? "dark" : "light";
    if (GORUNUM.yazi === "normal") delete r.dataset.yazi; else r.dataset.yazi = GORUNUM.yazi;
  }
  gorunumUygula();
  const hastaVarsayilan = () => ({ ad: "", telefon: "", eposta: "", yakinlar: [], odeme: "kart_kapida",
    bildirim: { hatirlatma: true, yolda: true, puan: true, kampanyaSms: false, kampanyaEposta: false }, acil: { ad: "", telefon: "", yakinlik: "" }, destek: [] });
  const PR = { hesap: null, h: hastaVarsayilan() };
  function hastaProfiliYukle(hesap, ornek) {
    PR.hesap = hesap;
    const k = yerel.oku("anindasaglik_profil_" + hesap, null);
    PR.h = Object.assign(hastaVarsayilan(), k || (ornek ? { ad: ornek.ad, telefon: "0532 000 00 00", yakinlar: [{ ad: "Fatma", yakinlik: "Annem" }, { ad: "Ahmet", yakinlik: "Babam" }] } : {}));
    PR.h.bildirim = Object.assign(hastaVarsayilan().bildirim, PR.h.bildirim || {}); PR.h.acil = Object.assign(hastaVarsayilan().acil, PR.h.acil || {});
  }
  const hastaProfiliYaz = () => yerel.yaz("anindasaglik_profil_" + PR.hesap, PR.h);
  const calisanVarsayilan = () => ({ cevrimici: true, kapaliHizmet: [], pin: "", baskiPin: "", acil: { ad: "", telefon: "", yakinlik: "" },
    bildirim: { yeniTalep: true, ses: true, rota: true, puan: true }, destek: [] });
  const CP = {};
  function calisanProfili(pid) {
    if (!pid) return calisanVarsayilan();
    if (!CP[pid]) { const k = yerel.oku("anindasaglik_calisan_" + pid, {}); CP[pid] = Object.assign(calisanVarsayilan(), k); CP[pid].bildirim = Object.assign(calisanVarsayilan().bildirim, CP[pid].bildirim || {}); }
    return CP[pid];
  }
  const calisanProfiliYaz = (pid) => yerel.yaz("anindasaglik_calisan_" + pid, calisanProfili(pid));
  // Eşleştirme: çevrimdışı çalışan ya da kapattığı hizmet hastaya önerilmez
  const calisiyor = (c) => { const cp = CP[c.provider_id]; return !cp || (cp.cevrimici && !cp.kapaliHizmet.includes(c.service)); };
  const telGecerli = (t) => /^0?5\d{9}$/.test(String(t).replace(/\D/g, "").replace(/^90/, ""));
  const ulasim = (pid) => (repo.providers[pid] && repo.providers[pid].transport) || "araba";
  const ulasimEtiket = (pid) => (ulasim(pid) === "toplu" ? "🚌 toplu taşıma" : "🚗 araba");
  // YZ teklif katmanı (teklif.js): Enes'in eğitilmiş bildirim modeli + YZ fiyat önerisi + ±%10 teklif bandı
  const TK = window.KapidaTeklif && window.KAPIDA_MODEL ? window.KapidaTeklif.create(window.KAPIDA_MODEL, C) : null;
  const SIMDI = 570; // demo saati 09:30 (üst çubuktaki saat)
  // çalışan en erken ne zaman yola çıkabilir: bugün şimdi (09:30), yarın mesai başı (07:30'dan önce kimse başlamıyor)
  const gercekSimdi = () => (P.info.gun ? 450 : SIMDI);
  // Mesleki doğrulama (dogrulama.js): ilk girişte açılır; onay (demo) olmadan görev kabul edilemez.
  const DG = window.KapidaDogrulama.create({ esc, rerender: () => renderH(), toast: (m) => { H.toast = m; renderH(); } });
  // Güvenli Ziyaret (guvenlik.js): risk notu, kapı kodu, konum kontrolü, kontrol zamanlayıcısı ve yükseltme zinciri, gizli SOS, Beyaz Kod.
  const G = window.KapidaGuvenlik.create({ esc, hhmm: C.hhmm, kisi: person, pinler: () => { const c = calisanProfili(H.pid); return c.pin ? { pin: c.pin, baski: c.baskiPin } : null; }, hizmet: svc, tarih: "16.11.2026", konum: calisanKonumu,
    metin: (r) => (P.request && r.id === P.request.id ? transcriptText() : ""), bildir: (taraf, m) => { if (taraf === "p") P.toast = m; else H.toast = m; } });
  // Görüntülü hizmet: sunuluş biçimine göre (meslek değil). Görüntülüde harita, rota, yolculuk, varış, kapı kodu, yol ücreti yok.
  const uzaktanHizmet = (code) => { const s = svc(code); return !!(s && s.remote_possible && s.category === "tele"); };
  const uzaktanMi = (r) => !!r && uzaktanHizmet(r.service);
  const karmaMi = (r) => !!r && r.service === "tele_hemsire_destekli"; // hemşire evde + hekim görüntülü
  const gzR = () => (P.request && P.request.provider_id === H.pid && !uzaktanMi(P.request) ? P.request : null); // çalışan ekranındaki aktif ziyaret
  // Görüntülü görüşme (goruntulu.js): DEMO görüşme — gerçek iki kişilik görüntü bağlantısı yok
  const VG = window.KapidaGoruntulu.create({ esc, hhmm: C.hhmm, kisi: person, hizmet: svc, simdi: SIMDI, avatar: () => AVATAR, yenile: () => { renderP(); renderH(); } });
  const vgIstek = (k) => (P.request && P.request.id === k ? P.request : REQ.find((x) => x.id === k)) || null;
  const vgDoktor = (r) => (karmaMi(r) ? r.goruntuluHekim : r.provider_id);
  const vgVar = (r) => !!r && (uzaktanMi(r) || (karmaMi(r) && !!r.goruntuluHekim));
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
  const SESLI_SELAM = "Merhaba, ben anında sağlık asistanı. Seni dinliyorum. Ne olduğunu kendi cümlelerinle anlat; konuşman bitince kısa bir an beklemen yeterli.";
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
      duration_min: svc(r.service).duration_min, lat: r.patient.lat, lon: r.patient.lon, service_code: r.service, uzaktan: uzaktanHizmet(r.service) });
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
  // [hizmet, ad, sohbeti başlatan örnek cümle, kısa açıklama]
  const TILES = [
    ["basi_yarasi_bakimi", "Yara bakımı ve pansuman", "Annemin sırtında yara var, pansuman gerekiyor", "Ameliyat sonrası dikiş yeri, yara bakımı ve pansuman"],
    ["kan_alma", "Kan alma", "Doktorun istediği tahlil için evden kan aldırmak istiyorum", "Evde veya iş yerinde kan alma hizmeti"],
    ["iv_serum", "Serum takma", "Doktorun yazdığı serumu evde taktırmak istiyorum", "Doktorun yazdığı serum evde, hemşire eşliğinde"],
    ["fizyoterapi_seansi", "Evde fizik tedavi", "Ameliyat sonrası evde fizik tedavi istiyorum", "Ameliyat sonrası ve hareket kısıtlılığında"],
    ["tele_muayene", "Görüntülü doktor", "Doktorla görüntülü görüşmek istiyorum", "Evden çıkmadan doktorla görüntülü görüşme"],
    ["tele_hemsire_destekli", "Hemşire evde, doktor görüntülü", "Babam yatağa bağımlı, hemşire gelsin doktor görüntülü baksın", "Evden çıkamayan hasta için: hemşire gelir, doktor görüntülü bağlanır"],
  ];

  // ---------- YZ ----------
  const SERVICE_LIST = Object.values(repo.services).filter((s) => !repo.hekim_evde.has(s.code)).map((s) => `${s.code}: ${s.name_tr}`).join("\n");
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
    const hello = "Merhaba, ben anında sağlık asistanı. Ne olduğunu kendi cümlelerinle anlat ya da mikrofona basıp konuş. Birkaç kısa soru sorup seni doğru sağlık çalışanına yönlendireceğim.";
    if (P.mode === "ai") {
      P.msgs.push({ who: "ai", text: hello, quick: PR.h.yakinlar.length ? [...PR.h.yakinlar.slice(0, 3).map((y) => `${y.yakinlik} için`), "Kendim için"] : ["Annem için", "Babam için", "Kendim için"] });
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
      const cevap = `Başlangıç fiyatları: ${["tele_muayene", "tele_hemsire_destekli", "yara_pansuman", "kan_alma", "fizyoterapi_seansi"].filter((c) => repo.services[c]).map(f).join(", ")}. Kesin fiyatı sağlık çalışanının teklifi belirler. Kimin için ve ne için istediğini söylersen sana uygun kişileri ve saatleri gösteririm.`;
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
    const code = route ? route.service_list[0] : "tele_muayene";
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
    if (!repo.services[rep.hizmet_onerisi] || repo.hekim_evde.has(rep.hizmet_onerisi)) rep.hizmet_onerisi = "tele_muayene"; // doktor eve gitmez
    if (!repo.professions[rep.istenen_meslek]) rep.istenen_meslek = istenenMeslek() || "";
    if (P.info.doktor && P.info.atlaMeslek) {
      const ad = meslekAdi(P.info.atlaMeslek);
      rep.istenen_meslek = P.info.atlaMeslek;
      rep.oneri_gerekcesi = `Hasta/yakını soruları geçip doğrudan ${ad.toLocaleLowerCase("tr")} istedi.`;
      rep.hasta_icin_ozet = `İsteğin üzerine seni ${yonelme(ad)} yönlendiriyoruz.` + (rep.sikayet && rep.sikayet !== "belirtilmedi" ? " İletilecek: " + rep.sikayet + "." : "");
      rep.eksik_bilgiler = [`Ayrıntılar ${yonelme(ad)} ziyarette sorulacak (kullanıcı soruları geçti)`, ...(rep.eksik_bilgiler || [])];
    } else if (P.info.doktor) {
      rep.hizmet_onerisi = P.info.bed ? "tele_hemsire_destekli" : "tele_muayene";
      rep.oneri_gerekcesi = "Hasta/yakını soruları geçip doğrudan doktor değerlendirmesi istedi (doktor görüntülü bağlanır).";
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
        const res = C.findCandidates(repo, service, pt, gunTarih(gun), bas, SORTS.onerilen[1], 20, 60, simdi); // tüm uygunlar: en erken varış puan sırasına bağlı olmasın
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
      if (s.needs_physician_order && !pt.has_physician_plan) { level = pt.bedridden ? "TELE_HEMSIRE" : "TELE"; services = [level === "TELE" ? "tele_muayene" : "tele_hemsire_destekli"]; }
      else if (repo.hekim_evde.has(sug)) { level = pt.bedridden ? "TELE_HEMSIRE" : "TELE"; services = [level === "TELE" ? "tele_muayene" : "tele_hemsire_destekli"]; } // doktor eve gitmez
      else if ((repo.profession_services.hekim || new Set()).has(sug)) { level = s.remote_possible ? "TELE" : "HEKIM_EV"; services = [sug]; }
      else { level = "PLANLI"; services = [sug]; }
      if (level === "TELE" && pt.bedridden && sug !== "recete_rapor_yenileme") { level = "TELE_HEMSIRE"; services = ["tele_hemsire_destekli"]; }
      t = { ...t, level, services, route: "YZ:" + sug, reasons: ["Asistanın hizmet önerisi: " + s.name_tr] };
    }
    if (P.info.doktor && !P.info.atlaMeslek && !t.is_emergency) {
      // Doktorlar yalnızca görüntülü: doğrudan doktor isteği görüntülü görüşmedir; evden çıkamayan hastaya hemşire gelir, doktor görüntülü bağlanır
      const lv = pt.bedridden ? "TELE_HEMSIRE" : "TELE";
      t = { ...t, level: lv, services: [lv === "TELE" ? "tele_muayene" : "tele_hemsire_destekli"], route: "KULLANICI:doktor", profession: "hekim", reasons: ["İsteğin üzerine doğrudan doktora yönlendirildin (doktor görüntülü bağlanır)."] };
    }
    // Şikâyet birden fazla hizmete gidiyorsa (ör. sonda: bakım / takma-değişim; ayak: standart / diyabetik) hasta seçer.
    // Karar (seviye, meslek) değişmez; yalnızca hizmet kalemi ve taban ücret. Açıkça söylediyse uygun olan önceden seçili.
    if (!t.is_emergency && t.level === "PLANLI" && t.services.length > 1 && !(t.profession && !HEKIMLER.has(t.profession))) {
      const sec = t.services, metin = C.normalize(userText);
      const tahmin = sec.includes("sonda_takma") && /\b(takil|takma|taktir|degis|yenile|cikti|cikmis|dustu|yeni sonda)/.test(metin) ? "sonda_takma"
        : sec.includes("diyabetik_ayak_bakimi") && /(diyabet|seker hasta)/.test(metin) ? "diyabetik_ayak_bakimi" : sec[0];
      t = { ...t, secenekler: sec, services: [P.info.hizmet && sec.includes(P.info.hizmet) ? P.info.hizmet : tahmin] };
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
    cands = cands.filter(calisiyor);
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
      HEKIM_EV: [ICO.steth, "Önce doktor değerlendirsin" /* doktorlar yalnızca görüntülü: bu seviye artık TELE/TELE_HEMSIRE’ye çevrilir */, "Hemşire ya da fizyoterapist ancak doktor planıyla gelebilir (yönetmelik). Doktor gerekirse planı yazar."],
      TELE: [ICO.video, "Önce doktorla görüntülü görüş", "Doktor evine gelmez; kısa bir görüntülü görüşmeyle durumu değerlendirir. Gerekirse plan yazar, eve hemşire ya da başka bir sağlık çalışanı gelir."],
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
    { const odak = document.activeElement; if (["profil", "adresForm"].includes(P.screen) && odak && $("#pScreen").contains(odak) && /INPUT|TEXTAREA/.test(odak.tagName) && !P.zorla) return; }
    if (SV.acik && !["chat", "building", "summary", "emergency"].includes(P.screen)) SV.kapat();
    const el = $("#pScreen");
    const scr = { home: pHome, chat: pChat, building: pBuilding, summary: pSummary, options: pOptions, done: pDone, emergency: pEmergency, adresForm: pAdresForm, profil: pProfil }[P.screen] || pHome;
    el.innerHTML = scr() + (P.sheet !== null && P.screen === "options" ? pSheet() : "") + (P.adresSec ? pAdresSec() : "") + (P.toast ? `<div class="toast" role="status">${esc(P.toast)}</div>` : "");
    if (P.toast) { const t = P.toast; setTimeout(() => { if (P.toast === t) { P.toast = ""; const n = $("#pScreen .toast"); if (n) n.remove(); } }, 3800); }
    if (P.screen === "chat") { const m = $("#pMsgs"); if (m) m.scrollTop = m.scrollHeight; }
    VG.videolariBagla(el);
  }
  // Ana ekranda yaklaşan randevu ve "Randevularım": randevuya her zaman geri dönülebilsin
  const DURUM_AD = { bekliyor: "Onay bekliyor", kabul: "Onaylandı", red: "Uygun değil", iptal: "İptal edildi" };
  function randevuDurumu(r) {
    if (uzaktanMi(r) && r.status === "kabul") { const d = VG.durum(r).durum; return [VG.durumAd(r), d === "gorusme" ? "good" : VG.bitti(VG.durum(r)) ? "plain" : "good"]; }
    const gs = G.durum(r) || {};
    if (r.status === "kabul" && gs.hastaOnay === "tamam") return ["Tamamlandı", "plain"];
    if (r.status === "kabul" && gs.checkin && !gs.checkout) return ["Ziyaret sürüyor", "good"];
    return [DURUM_AD[r.status] || r.status, r.status === "kabul" ? "good" : r.status === "bekliyor" ? "sun" : "plain"];
  }
  function randevuKartlari() {
    const liste = (P.randevular || []).map((id) => (P.request && P.request.id === id ? P.request : REQ.find((x) => x.id === id))).filter(Boolean);
    if (!liste.length) return "";
    const bitti = (r) => r.status === "kabul" && (uzaktanMi(r) ? VG.bitti(VG.durum(r)) : !!(G.durum(r) || {}).checkout);
    const aktif = liste.find((r) => ["bekliyor", "kabul"].includes(r.status) && randevuDurumu(r)[0] !== "Tamamlandı" && !bitti(r));
    // Ziyaret bitti ama hasta henüz onaylamadı / puanlamadı: ana ekranda en üstte göster (hasta takip ekranında olmayabilir)
    const puanla = liste.find((r) => bitti(r) && !r.puan && !uzaktanMi(r));
    const satir = (r) => { const [d0, renk0] = randevuDurumu(r); const [d, renk] = bitti(r) && !r.puan && !uzaktanMi(r) ? ["Puanla", "sun"] : r.puan ? [`${d0} · ${"★".repeat(r.puan.yildiz)}`, renk0] : [d0, renk0]; return `<button class="randevu-satir" type="button" data-act="takip" data-id="${r.id}">
        <span><b>${esc(svc(r.service).name_tr)}</b>${uzaktanMi(r) ? ` <span class="pill kirmizi">Görüntülü</span>` : ""}<span class="small muted">${gunEki(r)}${C.hhmm(r.arrival_min)} · ${esc(person(r.provider_id).full)}</span></span><span class="pill ${renk}">${esc(d)}</span></button>`; };
    const puanKutusu = puanla ? (() => { const onay = (G.durum(puanla) || {}).hastaOnay, ad = person(puanla.provider_id).first;
      return `<div class="card yaklasan stack puan-davet" style="gap:8px"><div class="row between"><b>${onay ? `${esc(ad)} ziyaretini puanla` : `${esc(ad)} ziyareti bitirdi`}</b><span class="pill sun">${onay ? "Puan bekliyor" : "Onay bekliyor"}</span></div>
        <div class="small">${onay ? "Deneyimini birkaç saniyede puanla; diğer hastalara yol gösterir." : "Hizmet tamamlandı mı? Onaylayıp puan verebilirsin."}</div>
        <button class="btn primary block" type="button" data-act="takip" data-id="${puanla.id}">${onay ? "Puanla" : "Onayla ve puanla"}</button></div>`; })() : "";
    if (aktif && uzaktanMi(aktif)) { const s = VG.durum(aktif), pp = person(aktif.provider_id);
      return `${puanKutusu}<div class="card yaklasan stack vg-yaklasan" style="gap:8px"><div class="row between"><b>Yaklaşan görüşmen</b><span class="pill kirmizi">Görüntülü</span></div>
        <div>${esc(pp.full)} · ${gunEki(aktif)}<b>${C.hhmm(aktif.arrival_min)}</b></div><div class="small muted">${esc(pp.prof)} · Doktor evine gelmez · ${esc(aktif.status === "kabul" ? VG.durumAd(aktif) : "Onay bekleniyor")}</div>
        <button class="btn primary block" type="button" data-act="takip" data-id="${aktif.id}">${s.durum === "gorusme" ? "Görüşmeye dön" : "Görüşmeye git"}</button></div>
        <details class="randevularim"><summary><b>Randevularım</b> <span class="small muted">(${liste.length})</span></summary><div class="stack" style="gap:6px;margin-top:8px">${liste.map(satir).join("")}</div></details>`; }
    return `${puanKutusu}${aktif ? `<div class="card yaklasan stack" style="gap:8px"><div class="row between"><b>Yaklaşan randevun</b><span class="pill ${randevuDurumu(aktif)[1]}">${esc(randevuDurumu(aktif)[0])}</span></div>
        <div>${esc(svc(aktif.service).name_tr)} · ${gunEki(aktif)}<b>${C.hhmm(aktif.arrival_min)}</b></div><div class="small muted">${esc(person(aktif.provider_id).full)} · toplam ${tl(aktif.price.patient_pays)} TL</div>
        <button class="btn primary block" type="button" data-act="takip" data-id="${aktif.id}">Takip et${aktif.status === "kabul" && !aktif.gun ? " · kapı kodu burada" : ""}</button></div>` : ""}
      ${liste.length ? `<details class="randevularim"${aktif ? "" : " open"}><summary><b>Randevularım</b> <span class="small muted">(${liste.length})</span></summary><div class="stack" style="gap:6px;margin-top:8px">${liste.map(satir).join("")}</div></details>` : ""}`;
  }
  // Ana sayfa üstünde seçili adres (dokununca kayıtlı adresler)
  function adresCubugu() {
    const a = seciliAdres();
    return `<button class="adres-cubuk" type="button" data-act="adresler" aria-label="Adres: ${esc(a ? a.baslik : "seçilmedi")} — değiştir">${ICO.pin}
      <span class="ac-metin">${a ? `<b>${esc(a.baslik)} <span class="ac-ok">▾</span></b><span>${esc([a.adres, a.ilce && !String(a.adres).includes(a.ilce) ? a.ilce : ""].filter(Boolean).join(", "))}</span>` : `<b>Adres ekle <span class="ac-ok">▾</span></b><span>Bir kez kaydet, her seferinde yazma</span>`}</span></button>`;
  }
  function pHome() {
    const ad = PR.h.ad ? " " + PR.h.ad.trim().split(/\s+/)[0] : "";
    return `${appbar("p")}${ADR ? `<div style="padding:0 18px">${adresCubugu()}</div>` : ""}<div class="pad stack" style="gap:16px;padding-top:10px">
      <div class="stack" style="gap:4px"><div class="selam">İyi günler${esc(ad)}</div><h1 class="baslik-xl">Bugün nasıl yardımcı olalım?</h1></div>
      ${randevuKartlari()}
      <div class="hero"><span class="deco"></span>
        <h1>Ne olduğunu anlat,<br>gerisini biz ayarlayalım.</h1>
        <div class="small" style="color:var(--muted)">Konuşarak ya da yazarak anlat. Fotoğraf ekleyebilirsin. Fiyatı seçmeden önce görürsün.</div>
        <button class="ana-btn" type="button" data-act="start">${ICO.mic}<span class="ayrac"></span>Anlatmaya başla</button>
        <span class="pill durum-pil ${P.mode === "ai" ? "good" : "plain"}">${P.mode === "ai" ? "Yapay zekâ açık" : P.mode === "loading" ? "Hazırlanıyor" : "Demo modu"}</span>
      </div>
      ${SV.var() ? `<button class="satir-kart" type="button" data-act="sesli"><span class="sk-ico">${ICO.dalga}</span><span class="ayrac"></span><span class="sk-metin"><b>Sesli asistanla konuş</b><span>El değmeden, telefonda konuşur gibi</span></span><span class="sk-ok">${ICO.ileri}</span></button>` : ""}
      <div class="bolum"><h3>Hizmetler</h3></div>
      <div class="stack" style="gap:10px">${TILES.map(([code, name, pre, aciklama]) => `<button class="satir-kart" type="button" data-tile="${esc(pre)}">
          <span class="sk-ico">${svcIcon(code)}</span><span class="ayrac"></span><span class="sk-metin"><b>${esc(name)}</b><span>${esc(aciklama)} · <span class="num">${tl(fromPrice(code))} TL</span>'den</span></span><span class="sk-ok">${ICO.ileri}</span></button>`).join("")}</div>
      <div class="sos">${ICO.alert}<span>Göğüs ağrısı, nefes darlığı, bilinç kaybı gibi acil durumlarda beklemeyin: <b>112</b></span></div>
    </div>`;
  }
  // ---------- Profil ekranları (ortak parçalar) ----------
  const anahtar = (id, acik, etiket, alt = "") => `<div class="ayar-satir"><span class="as-metin"><b>${esc(etiket)}</b>${alt ? `<span>${esc(alt)}</span>` : ""}</span>
    <button class="anahtar" type="button" role="switch" aria-checked="${!!acik}" aria-label="${esc(etiket)}" data-anahtar="${id}"><i></i></button></div>`;
  const menuSatir = (ico, baslik, alt, veri) => `<button class="menu-satir" type="button" ${veri}><span class="ms-ico">${ico}</span><span class="as-metin"><b>${esc(baslik)}</b>${alt ? `<span>${esc(alt)}</span>` : ""}</span><span class="sk-ok">${ICO.ileri}</span></button>`;
  const grup = (baslik, ic) => `<section class="ayar-grup"><h3>${esc(baslik)}</h3><div class="ag-kutu">${ic}</div></section>`;
  const secenek = (ad, deger, secenekler) => `<div class="seg">${secenekler.map(([v, l]) => `<button class="chip" type="button" data-secim="${ad}" data-deger="${v}" aria-pressed="${deger === v}">${esc(l)}</button>`).join("")}</div>`;
  function gorunumHtml() {
    return `<div class="stack" style="gap:14px"><div class="stack small" style="gap:6px"><b>Yazı boyutu</b>${secenek("yazi", GORUNUM.yazi, [["normal", "Normal"], ["buyuk", "Büyük"], ["cokbuyuk", "Çok büyük"]])}<span class="tiny muted">Okumakta zorlanan yakınların için büyütebilirsin.</span></div>
      <div class="stack small" style="gap:6px"><b>Tema</b>${secenek("tema", GORUNUM.tema, [["sistem", "Telefonla aynı"], ["acik", "Açık"], ["koyu", "Koyu"]])}</div></div>`;
  }
  const SSS = [["Teşhis koyuyor musunuz?", "Hayır. Asistan yalnızca anlattıklarını toplar ve sağlık çalışanına rapor olarak iletir; kararı sağlık çalışanı verir."],
    ["Acil bir durumda ne yapmalıyım?", "Göğüs ağrısı, nefes darlığı, bilinç kaybı gibi durumlarda beklemeden 112'yi ara. Uygulama acil durumda randevu vermez."],
    ["Fiyat nasıl belirleniyor?", "Yapay zekâ bir fiyat önerir, sağlık çalışanı ±%10 içinde teklif verir. Seçmeden önce toplam tutarı görürsün; rotası uygun ziyaretlerde paylaşım indirimi sana yansır."],
    ["Hemşire neden doktor planı istiyor?", "Hemşire, fizyoterapist gibi meslekler yönetmelik gereği hekimin planı ya da reçetesiyle hizmet verir."],
    ["Kapıdaki kişinin doğru kişi olduğunu nasıl anlarım?", "Takip ekranındaki 4 haneli kapı kodunu ve fotoğrafı kapıdaki kişiyle karşılaştır. Eşleşmiyorsa kapıyı açma ve 'Sorun bildir'e bas."],
    ["Verilerim nerede?", "Bu prototipte profil ve adreslerin yalnızca bu cihazda saklanır, sunucuya gönderilmez. 'Gizlilik ve verilerim' bölümünden indirebilir ya da silebilirsin."]];
  function yardimHtml(taraf) {
    const liste = taraf === "h" ? calisanProfili(H.pid).destek : PR.h.destek;
    return `<div class="stack" style="gap:8px">${SSS.map(([q, a]) => `<details class="sss"><summary>${esc(q)}</summary><div class="small">${esc(a)}</div></details>`).join("")}</div>
      <div class="stack small" style="gap:6px;margin-top:8px"><b>Destek ekibine yaz</b><textarea class="inp" id="${taraf}DestekMetin" rows="3" maxlength="600" placeholder="Sorununu ya da önerini yaz (sağlık bilgisi yazma)"></textarea>
        <button class="btn primary" type="button" data-act="${taraf}destek">Gönder</button><span class="tiny muted">Prototip: mesaj bu cihazda saklanır, gerçek bir destek ekibine gitmez.</span>
        ${liste.length ? `<div class="tiny muted">Gönderdiklerin: ${liste.length} mesaj · son: ${esc(liste[liste.length - 1].tarih)}</div>` : ""}</div>`;
  }
  const hakkindaHtml = () => `<div class="stack small" style="gap:8px"><div class="row" style="gap:10px">${MARKA}</div>
    <div>Evde sağlık hizmetine hızlı ve güvenli ulaşım prototipi · GAZİ AI TECH 2026 · sürüm 0.21.11</div>
    <div class="muted">Yapay zekâ teşhis koymaz, tedavi önermez; acil kararı kaynaklı kurallardan gelir. Veriler sentetiktir (İzmir).</div>
    <div class="muted">Harita ve adresler © OpenStreetMap katkıcıları · trafik: TomTom 2025 · toplu taşıma: ESHOT/İZBAN açık verisi (GTFS) · bildirim modeli: ekip simülasyonu.</div></div>`;
  const gizlilikHtml = (taraf) => `<div class="stack small" style="gap:10px">
    <div class="note">Bu prototipte profilin, adreslerin ve ayarların yalnızca <b>bu cihazda</b> saklanır; sunucuya gönderilmez. Sohbet metni yalnızca yapay zekâ yanıtı için sunucudan geçer ve orada saklanmaz. ${taraf === "h" ? "Konumun yalnızca ziyaret penceresinde (yoldayken ve ziyarette) kaydedilir." : "T.C. kimlik no, kart ya da banka numarası istemeyiz."}</div>
    <div class="muted">KVKK kapsamında verilerine erişme, düzeltme ve silme hakkın var. Gerçek uygulamada bu talepler hesap üzerinden işlenir.</div>
    <button class="btn" type="button" data-act="${taraf}veriIndir">Verilerimi indir (JSON)</button>
    ${taraf === "p" ? `<button class="btn" type="button" data-act="sohbetSil">Bu oturumdaki sohbeti sil</button>` : ""}
    ${(taraf === "h" ? H.silOnay : P.silOnay) ? `<div class="card stack" style="gap:8px;border-color:var(--coral)"><b style="color:var(--coral)">Bu cihazdaki tüm verilerin silinsin mi?</b><span class="muted">Profil, ${taraf === "p" ? "adresler, " : ""}ayarlar silinir ve çıkış yapılır. Geri alınamaz.</span>
      <div class="row"><button class="btn coral" type="button" data-act="${taraf}hesapSilEvet">Evet, sil</button><button class="btn" type="button" data-act="${taraf}hesapSilHayir">Vazgeç</button></div></div>`
      : `<button class="btn" type="button" data-act="${taraf}hesapSil" style="color:var(--coral)">Hesabımı ve bu cihazdaki verilerimi sil</button>`}</div>`;
  const altBaslik = (taraf, baslik) => `${appbar(taraf)}<div class="pad stack" style="gap:14px"><button class="back" type="button" data-act="${taraf}profilGeri">${ICO.back} Profil</button><h2 style="font-size:24px">${esc(baslik)}</h2>`;
  const cikisDugmesi = (taraf) => window.KAPIDA_OTURUM ? `<button class="btn block cikis-btn" type="button" data-act="cikisYap">${ICO.cikis} Çıkış yap</button>` : `<div class="tiny muted" style="text-align:center">Demo hesabıyla girmedin (hesapsız görünüm).</div>`;

  // ---------- Hasta profili ----------
  function pProfil() {
    const b = P.profilBolum, h = PR.h;
    if (b === "kisisel") return `${altBaslik("p", "Kişisel bilgiler")}
      <label class="stack small" style="gap:4px"><b>Ad soyad</b><input class="inp" id="prAd" maxlength="60" autocomplete="name" value="${esc(h.ad)}"></label>
      <label class="stack small" style="gap:4px"><b>Cep telefonu</b><input class="inp" id="prTel" type="tel" inputmode="tel" maxlength="16" autocomplete="tel" placeholder="05xx xxx xx xx" value="${esc(h.telefon)}"><span class="tiny muted">Sağlık çalışanı seni bu numaradan arar; numaran ona gizli gösterilir.</span></label>
      <label class="stack small" style="gap:4px"><b>E-posta</b> <span class="muted">(isteğe bağlı)</span><input class="inp" id="prEposta" type="email" maxlength="80" autocomplete="email" value="${esc(h.eposta)}"></label>
      <div class="hata-metin" id="prHata" role="alert"></div>
      <button class="ana-btn" type="button" data-act="kisiselKaydet">Kaydet</button></div>`;
    if (b === "yakinlar") return `${altBaslik("p", "Yakınlarım")}
      <div class="small muted">Sık yardım istediğin kişiler. Sohbette "kimin için" sorusunda tek dokunuşla seçersin. Sağlık bilgisi kaydetmeyiz; her talepte o anki durumu anlatırsın.</div>
      <div class="stack" style="gap:8px">${h.yakinlar.map((y, i) => `<div class="adres-satir"><span class="as-metin" style="flex:1;padding:6px 0"><b>${esc(y.yakinlik)}</b><span>${esc(y.ad || "")}</span></span><button class="btn ghost" type="button" data-yakin-sil="${i}" style="color:var(--muted)">Kaldır</button></div>`).join("") || `<div class="muted small">Henüz eklemedin.</div>`}</div>
      <div class="card stack" style="gap:8px"><b class="small">Yakın ekle</b>${secenek("yakinlik", P.yakinTaslak || "Annem", [["Annem", "Annem"], ["Babam", "Babam"], ["Eşim", "Eşim"], ["Çocuğum", "Çocuğum"], ["Anneannem", "Anneannem"], ["Babaannem", "Babaannem"], ["Dedem", "Dedem"]])}
        <input class="inp" id="prYakinAd" maxlength="40" placeholder="Adı (isteğe bağlı)"><button class="btn primary" type="button" data-act="yakinEkle">Ekle</button></div></div>`;
    if (b === "odeme") return `${altBaslik("p", "Ödeme tercihi")}
      <div class="stack" style="gap:8px">${[["kart_kapida", "Ziyarette kartla", "Sağlık çalışanının POS cihazıyla"], ["nakit", "Ziyarette nakit", "Tam tutarı hazırla"], ["uygulama", "Uygulamadan kartla", "Yakında · gerçek uygulamada güvenli ödeme altyapısıyla"]].map(([v, l, a]) =>
        `<button class="adres-satir${h.odeme === v ? " secili" : ""}" type="button" data-secim="odeme" data-deger="${v}" ${v === "uygulama" ? "disabled" : ""} style="text-align:left;width:100%;background:none;${v === "uygulama" ? "opacity:.5" : ""}"><span class="as-radyo"></span><span class="as-metin" style="padding:6px 0"><b>${l}</b><span>${a}</span></span></button>`).join("")}</div>
      <div class="tiny muted">Kart bilgisi bu prototipte istenmez ve saklanmaz.</div></div>`;
    if (b === "bildirim") return `${altBaslik("p", "Bildirimler")}<div class="ag-kutu">
      ${anahtar("p.hatirlatma", h.bildirim.hatirlatma, "Randevu hatırlatması", "Ziyaretten 1 saat ve 15 dk önce")}${anahtar("p.yolda", h.bildirim.yolda, "Sağlık çalışanı yola çıkınca", "Canlı takip bağlantısıyla")}
      ${anahtar("p.puan", h.bildirim.puan, "Ziyaret sonrası puanlama")}${anahtar("p.kampanyaSms", h.bildirim.kampanyaSms, "Kampanya ve duyurular (SMS)", "İzin vermezsen gönderilmez")}${anahtar("p.kampanyaEposta", h.bildirim.kampanyaEposta, "Kampanya ve duyurular (e-posta)")}</div></div>`;
    if (b === "gorunum") return `${altBaslik("p", "Görünüm ve erişilebilirlik")}${gorunumHtml()}<div class="ag-kutu">${anahtar("p.sesliOku", P.voice, "Asistanın yanıtlarını sesli oku", "Yazılı sohbette de")}</div></div>`;
    if (b === "acil") return `${altBaslik("p", "Acil durum kişisi")}
      <div class="small muted">Acil ekranında 112'nin yanında bu kişiyi tek dokunuşla arayabilirsin. Kimseye otomatik haber verilmez.</div>
      <label class="stack small" style="gap:4px"><b>Adı</b><input class="inp" id="prAcilAd" maxlength="40" value="${esc(h.acil.ad)}"></label>
      <label class="stack small" style="gap:4px"><b>Yakınlığı</b><input class="inp" id="prAcilYakin" maxlength="30" placeholder="ör. Oğlum" value="${esc(h.acil.yakinlik)}"></label>
      <label class="stack small" style="gap:4px"><b>Telefonu</b><input class="inp" id="prAcilTel" type="tel" inputmode="tel" maxlength="16" placeholder="05xx xxx xx xx" value="${esc(h.acil.telefon)}"></label>
      <div class="hata-metin" id="prHata" role="alert"></div>
      <button class="ana-btn" type="button" data-act="acilKaydet">Kaydet</button></div>`;
    if (b === "randevular") { const liste = (P.randevular || []).map((id) => (P.request && P.request.id === id ? P.request : REQ.find((x) => x.id === id))).filter(Boolean);
      return `${altBaslik("p", "Randevularım")}<div class="stack" style="gap:6px">${liste.length ? liste.map((r) => `<button class="randevu-satir" type="button" data-act="takip" data-id="${r.id}"><span><b>${esc(svc(r.service).name_tr)}</b>${uzaktanMi(r) ? ` <span class="pill kirmizi">Görüntülü</span>` : ""}<span class="small muted">${gunEki(r)}${C.hhmm(r.arrival_min)} · ${esc(person(r.provider_id).full)} · ${tl(r.price.patient_pays)} TL</span></span><span class="pill ${randevuDurumu(r)[1]}">${esc(r.puan ? randevuDurumu(r)[0] + " · " + "★".repeat(r.puan.yildiz) : randevuDurumu(r)[0])}</span></button>`).join("") : `<div class="muted small">Henüz randevun yok.</div>`}</div></div>`; }
    if (b === "gizlilik") return `${altBaslik("p", "Gizlilik ve verilerim")}${gizlilikHtml("p")}</div>`;
    if (b === "yardim") return `${altBaslik("p", "Yardım ve destek")}${yardimHtml("p")}</div>`;
    if (b === "hakkinda") return `${altBaslik("p", "Hakkında")}${hakkindaHtml()}</div>`;
    const bas = (h.ad || "").trim().split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toLocaleUpperCase("tr");
    const rs = (P.randevular || []).length;
    return `${appbar()}<div class="pad stack" style="gap:16px">
      <button class="back" type="button" data-act="home">${ICO.back} Ana sayfa</button>
      <div class="profil"><div class="who"><span class="profil-foto bas-harf">${bas ? esc(bas) : ICO.kisi}</span><div style="min-width:0"><div class="profil-ad">${esc(h.ad || "Misafir")}</div>
        <div class="small muted">${esc(h.telefon || "Telefon eklenmedi")}</div><button class="btn ghost" type="button" data-profil="kisisel" style="padding:4px 0">Bilgilerimi düzenle</button></div></div></div>
      ${grup("Hesap", menuSatir(ICO.kisi, "Kişisel bilgiler", h.ad ? "Ad, telefon, e-posta" : "Adını ve telefonunu ekle", 'data-profil="kisisel"') + menuSatir(ICO.pin, "Adreslerim", AB.liste.length ? `${AB.liste.length} kayıtlı adres · ${seciliAdres() ? seciliAdres().baslik : ""}` : "Adres ekle", 'data-act="adresler"')
        + menuSatir(ICO.grup, "Yakınlarım", h.yakinlar.length ? h.yakinlar.map((y) => y.yakinlik).join(", ") : "Sık yardım istediğin kişiler", 'data-profil="yakinlar"') + menuSatir(ICO.kart, "Ödeme tercihi", { kart_kapida: "Ziyarette kartla", nakit: "Ziyarette nakit", uygulama: "Uygulamadan kartla" }[h.odeme], 'data-profil="odeme"')
        + menuSatir(ICO.takvim, "Randevularım", rs ? `${rs} randevu` : "Henüz randevu yok", 'data-profil="randevular"'))}
      ${grup("Tercihler", menuSatir(ICO.zil, "Bildirimler", Object.values(h.bildirim).filter(Boolean).length + " bildirim açık", 'data-profil="bildirim"') + menuSatir(ICO.gorunum, "Görünüm ve erişilebilirlik", `Yazı: ${{ normal: "normal", buyuk: "büyük", cokbuyuk: "çok büyük" }[GORUNUM.yazi]} · tema: ${{ sistem: "telefonla aynı", acik: "açık", koyu: "koyu" }[GORUNUM.tema]}`, 'data-profil="gorunum"'))}
      ${grup("Güvenlik", menuSatir(ICO.telefon, "Acil durum kişisi", h.acil.ad ? `${h.acil.ad}${h.acil.yakinlik ? " · " + h.acil.yakinlik : ""}` : "Eklenmedi", 'data-profil="acil"') + menuSatir(ICO.kalkan, "Gizlilik ve verilerim", "KVKK, verilerini indir ya da sil", 'data-profil="gizlilik"'))}
      ${grup("Destek", menuSatir(ICO.soru, "Yardım ve destek", "Sık sorulanlar, bize yaz", 'data-profil="yardim"') + menuSatir(ICO.bilgi, "Hakkında", "Sürüm, veri kaynakları", 'data-profil="hakkinda"'))}
      ${cikisDugmesi("p")}</div>`;
  }

  // ---------- Sağlık çalışanı profili ----------
  function hProfil(p) {
    const b = H.profilBolum, cp = calisanProfili(p.id), pp = person(p.id), po = puanOrtalama(p.id);
    if (b === "hizmetler") { const ss = Object.keys(repo.provider_services[p.id] || {});
      return `${altBaslik("h", "Hizmetlerim ve fiyatlarım")}<div class="small muted">Kapattığın hizmet hastalara önerilmez. Fiyat, hizmetin taban ücreti × senin katsayın (${String(p.fee_multiplier.toFixed(2)).replace(".", ",")}); teklifte ±%10 oynayabilirsin.</div>
        <div class="ag-kutu">${ss.map((c) => anahtar("hz." + c, !cp.kapaliHizmet.includes(c), svc(c).name_tr, `${tl(svc(c).base_fee_tl * p.fee_multiplier)} TL · ${svc(c).duration_min} dk`)).join("")}</div></div>`; }
    if (b === "mesleki") return `${altBaslik("h", "Mesleki bilgiler")}<div class="card stack small" style="gap:6px">
      <div><span class="muted">Meslek:</span> <b>${esc(pp.prof)}</b></div><div><span class="muted">Deneyim:</span> <b>${p.years_experience} yıl</b></div>
      <div><span class="muted">Bölge:</span> <b>${esc(p.home_district)}</b> · <span class="muted">ulaşım:</span> <b>${p.transport === "toplu" ? "toplu taşıma" : "araç"}</b></div>
      <div><span class="muted">Başvuru durumu:</span> <b>${esc(DG.headerLabel())}</b></div></div>
      <div class="tiny muted">Prototip: belgeler resmî sistemlerden doğrulanmaz.</div>
      <button class="btn" type="button" data-act="hBasvuru">Mesleki başvuruyu aç</button></div>`;
    if (b === "kazanc") { const g = REQ.filter((r) => r.provider_id === p.id && r.status === "kabul");
      return `${altBaslik("h", "Kazançlarım")}<div class="stats" style="background:var(--soft)"><div>${ICO.takvim}<b class="num">${g.length}</b><span>kabul edilen</span></div><div>${ICO.para}<b class="num">${tl(g.reduce((a, r) => a + r.price.provider_gets, 0))} <small>TL</small></b><span>uygulamadan</span></div><div>${ICO.yildiz}<b class="num">${po.ort.toFixed(1).replace(".", ",")}</b><span>${po.sayi} değerlendirme</span></div></div>
        <div class="note small">Ödemeler haftalık yapılır (prototip). Banka hesabı gerçek uygulamada kimlik doğrulamasıyla eklenir; bu prototipte hesap numarası istenmez ve saklanmaz.</div>
        <div class="tiny muted">Platform payı %${Math.round(C.CFG.COMMISSION * 100)}; paylaşımlı ziyaret tasarrufunun %30'u sana.</div></div>`; }
    if (b === "degerlendirme") return `${altBaslik("h", "Değerlendirmelerim")}${degerlendirmelerHtml(p.id)}</div>`;
    if (b === "guvenlik") return `${altBaslik("h", "Güvenli Ziyaret ayarları")}
      <div class="small muted">"Her şey yolunda mı?" kontrolüne PIN ile yanıt verirsin. Baskı PIN'i iptal ediyormuş gibi görünür ama güvenlik masasına sessiz alarm verir.</div>
      <div class="row" style="gap:8px;flex-wrap:nowrap"><label class="stack small" style="gap:4px;flex:1"><b>Yeni PIN</b><input class="inp" id="hrPin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="${cp.pin ? "••••" : "2580"}"></label>
        <label class="stack small" style="gap:4px;flex:1"><b>Baskı PIN'i</b><input class="inp" id="hrBaski" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="${cp.baskiPin ? "••••" : "0852"}"></label></div>
      <label class="stack small" style="gap:4px"><b>Acil durum kişin</b><input class="inp" id="hrAcilAd" maxlength="40" placeholder="Adı" value="${esc(cp.acil.ad)}"></label>
      <label class="stack small" style="gap:4px"><b>Telefonu</b><input class="inp" id="hrAcilTel" type="tel" inputmode="tel" maxlength="16" placeholder="05xx xxx xx xx" value="${esc(cp.acil.telefon)}"><span class="tiny muted">Kontrole yanıt vermezsen zincirin 4. adımında aranır (demoda simüle).</span></label>
      <div class="hata-metin" id="hrHata" role="alert"></div>
      <button class="ana-btn" type="button" data-act="hGuvenlikKaydet">Kaydet</button>${cp.pin ? `<button class="btn ghost" type="button" data-act="hPinSifirla">Demo PIN'lerine dön</button>` : ""}</div>`;
    if (b === "bildirim") return `${altBaslik("h", "Bildirimler")}<div class="ag-kutu">${anahtar("h.yeniTalep", cp.bildirim.yeniTalep, "Yeni talep", "Rotana uyan talepler önce")}${anahtar("h.ses", cp.bildirim.ses, "Talep sesi")}${anahtar("h.rota", cp.bildirim.rota, "Yola çıkma hatırlatması", "Trafiğe göre zamanında")}${anahtar("h.puan", cp.bildirim.puan, "Değerlendirme özeti güncellenince", "Tek tek puan bildirilmez")}</div></div>`;
    if (b === "gorunum") return `${altBaslik("h", "Görünüm ve erişilebilirlik")}${gorunumHtml()}</div>`;
    if (b === "gizlilik") return `${altBaslik("h", "Gizlilik ve verilerim")}${gizlilikHtml("h")}</div>`;
    if (b === "yardim") return `${altBaslik("h", "Yardım ve destek")}${yardimHtml("h")}</div>`;
    if (b === "hakkinda") return `${altBaslik("h", "Hakkında")}${hakkindaHtml()}</div>`;
    const acik = Object.keys(repo.provider_services[p.id] || {}).filter((c) => !cp.kapaliHizmet.includes(c)).length;
    return `${appbar("h")}<div class="pad stack" style="gap:16px">
      <button class="back" type="button" data-act="hprofilKapat">${ICO.back} Panel</button>
      <div class="profil"><div class="who"><span class="profil-foto">${AVATAR}</span><div style="min-width:0"><div class="profil-ad">${esc(pp.full)}</div>
        <div class="small muted">${esc(pp.prof)} · ${p.years_experience} yıl · ★ ${po.ort.toFixed(1).replace(".", ",")} (${po.sayi})</div></div></div>
        ${anahtar("h.cevrimici", cp.cevrimici, cp.cevrimici ? "Çevrimiçi — talep alıyorsun" : "Çevrimdışı — talep almıyorsun", "Kapatınca hastalara önerilmezsin")}</div>
      ${grup("Çalışma", menuSatir(ICO.bandage, "Hizmetlerim ve fiyatlarım", `${acik} hizmet açık`, 'data-hprofil="hizmetler"') + menuSatir(ICO.clock, "Çalışma saatlerim ve bölgem", "Saatlerim sekmesi", 'data-act="hSaatlerim"') + menuSatir(ICO.para, "Kazançlarım", "Ödemeler, platform payı", 'data-hprofil="kazanc"') + menuSatir(ICO.yildiz, "Değerlendirmelerim", `★ ${po.ort.toFixed(1).replace(".", ",")} · ${po.sayi} değerlendirme`, 'data-hprofil="degerlendirme"'))}
      ${grup("Mesleki", menuSatir(ICO.steth, "Mesleki bilgiler ve başvuru", DG.headerLabel(), 'data-hprofil="mesleki"'))}
      ${grup("Güvenlik ve tercihler", menuSatir(ICO.kalkan, "Güvenli Ziyaret", cp.pin ? "PIN'in ayarlı" : "Demo PIN'i kullanılıyor · acil kişi " + (cp.acil.ad ? "ekli" : "yok"), 'data-hprofil="guvenlik"') + menuSatir(ICO.zil, "Bildirimler", Object.values(cp.bildirim).filter(Boolean).length + " bildirim açık", 'data-hprofil="bildirim"') + menuSatir(ICO.gorunum, "Görünüm ve erişilebilirlik", "Yazı boyutu, tema", 'data-hprofil="gorunum"') + menuSatir(ICO.kilit, "Gizlilik ve verilerim", "Konum, KVKK, verilerini indir ya da sil", 'data-hprofil="gizlilik"'))}
      ${grup("Destek", menuSatir(ICO.soru, "Yardım ve destek", "Sık sorulanlar, bize yaz", 'data-hprofil="yardim"') + menuSatir(ICO.bilgi, "Hakkında", "Sürüm, veri kaynakları", 'data-hprofil="hakkinda"'))}
      ${cikisDugmesi("h")}</div>`;
  }
  function pAdresSec() {
    return `<div class="sheet-bg" data-act="adresKapat"><div class="sheet" role="dialog" aria-label="Kayıtlı adreslerim">
      <div class="row between"><h2 style="font-size:20px">Adreslerim</h2><button class="btn ghost" type="button" data-act="adresKapat">Kapat</button></div>
      ${AB.liste.length ? "" : `<div class="muted small">Henüz kayıtlı adresin yok. Bir kez ekle; sonraki taleplerde sadece seçersin.</div>`}
      <div class="stack" style="gap:8px">${AB.liste.map((a) => `<div class="adres-satir${a.id === AB.secili ? " secili" : ""}">
        <button type="button" class="as-sec" data-adres-sec="${a.id}" aria-pressed="${a.id === AB.secili}"><span class="as-radyo"></span><span class="stack" style="gap:1px;min-width:0"><b>${esc(a.baslik)}${a.varsayilan ? ` <span class="pill plain">Varsayılan</span>` : ""}</b><span class="small muted">${esc(a.adres || a.ilce)}${a.ilce && a.adres && !a.adres.includes(a.ilce) ? ", " + esc(a.ilce) : ""}</span>${tarifMetni(a) ? `<span class="tiny muted">🚪 ${esc(tarifMetni(a))}</span>` : ""}</span></button>
        <span class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn ghost" type="button" data-adres-duzen="${a.id}">Düzenle</button>${P.adresSilOnay === a.id ? `<button class="btn ghost" type="button" data-adres-sil="${a.id}" style="color:var(--coral)">Evet, sil</button>` : `<button class="btn ghost" type="button" data-adres-silsor="${a.id}" style="color:var(--muted)">Sil</button>`}</span></div>`).join("")}</div>
      <button class="btn primary block" type="button" data-act="adresYeni">+ Yeni adres ekle</button>
      <div class="tiny muted">Adreslerin bu cihazda saklanır (prototip). Adresler © OpenStreetMap katkıcıları.</div></div></div>`;
  }
  function pAdresForm() {
    const t = P.adresTaslak, districts = window.EVDE_DATA.districts.map((d) => d.name);
    const ozel = !ABASLIK.includes(t.baslik);
    return `${appbar()}<div class="pad stack" style="gap:14px">
      <button class="back" type="button" data-act="adresIptal">${ICO.back} Geri</button>
      <h2 style="font-size:24px">${t.id ? "Adresi düzenle" : "Yeni adres"}</h2>
      <div class="stack small" style="gap:6px"><b>Adres başlığı</b><div class="seg">${[...ABASLIK, "Diğer"].map((b) => `<button class="chip" type="button" data-abaslik="${esc(b)}" aria-pressed="${b === "Diğer" ? ozel : t.baslik === b}">${esc(b)}</button>`).join("")}</div>
        ${ozel ? `<input class="inp" id="fBaslik" maxlength="30" placeholder="ör. Dedemin evi" value="${esc(t.baslik)}">` : ""}</div>
      <div class="stack small" style="gap:4px"><label for="fAdres"><b>Mahalle, cadde ya da sokak</b></label>
        <input class="inp" id="fAdres" type="search" autocomplete="off" placeholder="ör. Kazımdirik Mah. 372. Sok." value="${esc(t.adres || "")}">
        <div id="fAdresList" class="stack adres-liste" style="gap:4px"></div>
        ${t.nokta ? `<div class="tiny muted">📍 Haritada yerleştirildi (~${String(t.nokta.km.toFixed(1)).replace(".", ",")} km)</div>` : `<div class="tiny muted">Listeden seç; adres haritadaki en yakın yola yerleşir.</div>`}</div>
      <label class="stack small" style="gap:4px" for="fIlce"><b>İlçe</b><select class="inp" id="fIlce">${districts.map((d) => `<option${d === t.ilce ? " selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
      <div class="row" style="gap:8px;flex-wrap:nowrap">${[["fBina", "Bina no", "bina"], ["fKat", "Kat", "kat"], ["fDaire", "Daire", "daire"]].map(([id, l, k]) => `<label class="stack small" style="gap:4px;flex:1" for="${id}"><b>${l}</b><input class="inp" id="${id}" inputmode="numeric" maxlength="6" value="${esc(t[k] || "")}"></label>`).join("")}</div>
      <label class="stack small" style="gap:4px" for="fTarif"><b>Kapı tarifi</b> <span class="muted">(isteğe bağlı: zil adı, bina rengi)</span><input class="inp" id="fTarif" maxlength="120" placeholder="ör. zil: Demir, yeşil bina" value="${esc(t.tarif || "")}"></label>
      <label class="row small" style="gap:10px"><input type="checkbox" id="fVarsayilan" ${t.varsayilan ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--brand)"> Varsayılan adresim olsun</label>
      ${P.adresHata ? `<div class="small" style="color:var(--coral);font-weight:600" role="alert">${esc(P.adresHata)}</div>` : ""}
      <button class="ana-btn" type="button" data-act="adresKaydet">Adresi kaydet</button>
    </div>`;
  }
  function pChat() {
    if (SV.acik) return pSesli();
    const last = P.msgs[P.msgs.length - 1];
    const quick = !P.busy && last && last.who === "ai" && last.quick && last.quick.length ? last.quick : [];
    return `<div class="chatwrap">
      <div class="chathead"><button class="back" type="button" data-act="home" aria-label="Geri">${ICO.back}</button><div class="bot"><svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true"><use href="#marka"/></svg></div>
        <div style="flex:1"><b>Sağlık asistanı</b><div class="tiny muted">${P.mode === "ai" ? (CAP.server ? "Yapay zekâ (sunucu) · teşhis koymaz" : "Yapay zekâ · teşhis koymaz") : "Demo soruları · teşhis koymaz"}</div></div>
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
      <div class="bot" style="width:64px;height:64px;border-radius:20px"><svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><use href="#marka"/></svg></div>
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
        ${ADR && seciliAdres() ? (() => { const a = seciliAdres(); return `<div class="stack small" style="gap:6px"><b>Adres</b>
          <div class="adres-secili"><span class="as-ico">${ICO.pin}</span><span style="flex:1;min-width:0"><b>${esc(a.baslik)}</b><span class="muted">${esc(a.adres || a.ilce)}${a.ilce && a.adres && !a.adres.includes(a.ilce) ? ", " + esc(a.ilce) : ""}</span>${tarifMetni(a) ? `<span class="muted">🚪 ${esc(tarifMetni(a))}</span>` : ""}</span>
            <button class="btn ghost" type="button" data-act="adresler">Değiştir</button></div></div>`; })() : ADR ? `<div class="stack small" style="gap:4px"><label for="pAdres"><b>Adres</b> <span class="muted">(sokak, cadde ya da mahalle)</span></label>
          <input class="inp" id="pAdres" type="search" autocomplete="off" placeholder="ör. Kazımdirik Mah. 372. Sok." value="${esc(P.info.adresYazi || "")}">
          <div id="pAdresList" class="stack adres-liste" style="gap:4px"></div>
          ${P.info.nokta ? `<div class="tiny muted">📍 ${esc(P.info.nokta.adres)} · haritada en yakın yol noktasına yerleştirildi (~${String(P.info.nokta.km.toFixed(1)).replace(".", ",")} km)</div>` : `<div class="tiny muted">Adresler © OpenStreetMap katkıcıları. Yazmazsan ilçe merkezi kullanılır.</div>`}</div>` : ""}
        ${ADR && seciliAdres() ? "" : `<label class="stack small" style="gap:4px" for="pTarif"><b>Kapı tarifi</b> <span class="muted">(isteğe bağlı: kat, daire, zil adı, bina rengi)</span>
          <input class="inp" id="pTarif" type="text" autocomplete="off" maxlength="160" placeholder="ör. 3. kat, daire 7, zil: Demir" value="${esc(P.info.tarif || "")}"></label>
        <label class="stack small" style="gap:4px" for="pDist"><b>Hangi ilçe?${ADR ? "" : " (açık adres sonra)"}</b>
          <select class="inp" id="pDist">${districts.map((d) => `<option${d === P.info.district ? " selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
        ${ADR ? `<label class="row small" style="gap:10px"><input type="checkbox" id="pAdresKaydet" ${P.adresKaydetme ? "" : "checked"} style="width:20px;height:20px;accent-color:var(--brand)"> Bu adresi kaydet, bir dahaki sefere yazma</label>` : ""}`}
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
  function hizmetSecimi(t) {
    if (!t.secenekler || t.secenekler.length < 2) return "";
    return `<div class="card stack hizmet-secim" style="gap:8px"><b class="small">Hangisi gerekiyor?</b>
      <div class="seg">${t.secenekler.map((x) => `<button class="chip" type="button" data-hizmet="${x}" aria-pressed="${t.services[0] === x}">${esc(svc(x).name_tr)} · ${tl(svc(x).base_fee_tl)} TL'den</button>`).join("")}</div>
      <div class="tiny muted">${esc(svc(t.services[0]).note || "")}</div></div>`;
  }
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
    const res = C.findCandidates(repo, service, pt, gunTarih(P.info.gun), P.info.when, SORTS[P.sort][1], 20, 60, gercekSimdi());
    P.cands = meslekSuz(t, res.candidates).slice(0, 10); P.pt = pt; // YZ teklif katmanı bu 10 kişi arasından seçer
    const [ico, head, why] = levelCopy(t.level, service, t.profession);
    const yz = TK && P.cands.length ? teklifPlani(service, pt) : null;
    return `<div class="pad stack">
      <button class="back" type="button" data-act="summary">${ICO.back} Özete dön</button>
      ${stepsBar(3)}
      <div class="levelcard"><span class="lv-ico">${ico}</span><div class="stack" style="gap:4px"><b>${esc(head)}</b><span class="small">${esc(why)}</span>
        <span class="small muted">Hizmet: ${esc(svc(service).name_tr)} · ${svc(service).duration_min} dk</span></div></div>
      ${meslekKarti(t)}${hizmetSecimi(t)}
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
  // ---------- ziyaret sonrası puanlama (hasta → sağlık çalışanı) ----------
  // Ziyaret bitip hasta "tamamlandı" deyince açılır; bir ziyarete bir puan. Puan çalışanın ortalamasına eklenir
  // (önceki ortalama PUAN_ONCEKI değerlendirmeden sayılır, sentetik) ve eşleştirmedeki yetkinlik puanına yansır.
  // 1–2 yıldız kalite ekibine düşer; yorum çalışana hastanın adı olmadan gösterilir. Güvenlik sorunu ayrı: "Sorun var".
  const PUAN_ONCEKI = 20;
  // Gizlilik: sağlık çalışanı tek bir hastanın kaç yıldız verdiğini göremez. Puanlar PUAN_TOPLU kadar birikince topluca
  // ortalamaya ve özete katılır; çalışana yıldız, saat, hizmet ya da hasta bilgisi olmadan yalnızca ortalama, etiket sayıları
  // ve karışık sıralı yorumlar gösterilir. Herkese görünen puan (kartlar, eşleştirme) da aynı toplu ortalamadır, böylece
  // ortalamanın tek bir ziyaretten sonra değişmesinden puan çıkarılamaz.
  const PUAN_TOPLU = 5;
  const PUAN = {}; // pid → [{yildiz, etiketler, yorum, reqId, hizmet, saat}]
  const PUAN_ETIKET = {
    iyi: ["Zamanında geldi", "Nazik ve saygılı", "Açıklayarak anlattı", "Özenli ve temiz çalıştı", "Güven verdi"],
    kotu: ["Geç kaldı", "Acele etti", "Yeterince açıklamadı", "Özensiz çalıştı", "Kaba davrandı"],
  };
  const YILDIZ_AD = ["", "Çok kötü", "Kötü", "Orta", "İyi", "Çok iyi"];
  // Yayımlanan puanlar: en eskiden başlayarak PUAN_TOPLU'nun katı kadar (PUAN en yeni başta tutulur)
  const yayindaPuanlar = (pid) => { const l = PUAN[pid] || []; const n = l.length - (l.length % PUAN_TOPLU); return l.slice(l.length - n); };
  function puanOrtalama(pid) {
    const pv = repo.providers[pid], l = PUAN[pid] || [], y = yayindaPuanlar(pid);
    if (pv._ilkPuan === undefined) pv._ilkPuan = pv.rating;
    const ort = (pv._ilkPuan * PUAN_ONCEKI + y.reduce((a, x) => a + x.yildiz, 0)) / (PUAN_ONCEKI + y.length);
    return { ort: Math.round(ort * 100) / 100, sayi: PUAN_ONCEKI + y.length, yeni: y.length, bekleyen: l.length - y.length };
  }
  const yildizlar = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  function puanKarti(r) {
    const pp = person(r.provider_id);
    if (r.puan) {
      return `<div class="card stack puan" style="gap:6px"><b>Teşekkürler!</b>
        <div class="small"><span class="puan-yildiz" aria-label="${r.puan.yildiz} yıldız">${yildizlar(r.puan.yildiz)}</span> verdin${r.puan.etiketler.length ? ` · ${esc(r.puan.etiketler.join(", "))}` : ""}.</div>
        ${r.puan.yildiz <= 2 ? `<div class="small">Platform kalite ekibi bu ziyareti inceleyecek ve sana yazılı dönecek. Güvenliğini tehdit eden bir durum olduysa "Sorun var" ile bildir ya da 112'yi ara.</div>` : ""}
        <div class="tiny muted">Puanın ${esc(pp.first)}'e tek başına gösterilmez: birkaç değerlendirme birikince adın, yıldızın ve ziyaret saati olmadan ortalamaya katılır. Ortalama, sıralamada yetkinlik puanına yansır.</div></div>`;
    }
    const t = P.puanTaslak && P.puanTaslak.id === r.id ? P.puanTaslak : (P.puanTaslak = { id: r.id, yildiz: 0, etiketler: [], yorum: "" });
    const etiketler = t.yildiz ? PUAN_ETIKET[t.yildiz >= 4 ? "iyi" : "kotu"] : [];
    return `<div class="card stack puan" style="gap:10px" role="group" aria-label="${esc(pp.first)} ziyaretini puanla">
      <b>${esc(pp.first)} ziyaretini puanla</b>
      <div class="small muted">Hizmet deneyimini puanla (zamanında gelme, ilgi, açıklama). Tedavinin tıbbi doğruluğunu değil.</div>
      <div class="puan-satir">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="puan-btn ${n <= t.yildiz ? "on" : ""}" data-puan="${n}" aria-pressed="${n === t.yildiz}" aria-label="${n} yıldız, ${YILDIZ_AD[n]}">★</button>`).join("")}</div>
      ${t.yildiz ? `<div class="small" aria-live="polite"><b>${YILDIZ_AD[t.yildiz]}</b>${t.yildiz <= 3 ? " · ne eksikti?" : " · en çok ne hoşuna gitti?"}</div>
      <div class="quick">${etiketler.map((x) => `<button class="chip" type="button" data-puan-etiket="${esc(x)}" aria-pressed="${t.etiketler.includes(x)}">${esc(x)}</button>`).join("")}</div>
      <textarea id="puanYorum" rows="2" maxlength="300" placeholder="İstersen birkaç kelime yaz (isteğe bağlı)" aria-label="Yorum (isteğe bağlı)">${esc(t.yorum)}</textarea>` : ""}
      <button class="btn primary block" type="button" data-act="puanGonder" ${t.yildiz ? "" : "disabled"}>Puanı gönder</button>
      <div class="tiny muted">${esc(pp.first)} kaç yıldız verdiğini göremez. Yorumun, başka değerlendirmelerle birlikte adın ve ziyaret bilgisi olmadan gösterilir.</div></div>`;
  }
  function puanGonder() {
    const r = P.request, t = P.puanTaslak;
    if (!r || r.puan || !t || t.id !== r.id || !t.yildiz) return;
    const kayit = { yildiz: t.yildiz, etiketler: t.etiketler.slice(), yorum: (t.yorum || "").trim().slice(0, 300), reqId: r.id, hizmet: r.service, saat: r.arrival_min };
    (PUAN[r.provider_id] ||= []).unshift(kayit);
    const o = puanOrtalama(r.provider_id);
    repo.providers[r.provider_id].rating = Math.round(o.ort * 10) / 10; // eşleştirme ve kartlar bu puanı kullanır
    const upd = { ...r, puan: kayit }; putRequest(upd); P.request = upd; P.puanTaslak = null;
    P.toast = "Puanın kaydedildi. Teşekkürler!";
    renderP(); renderH();
  }
  // Çalışan ekranı: aldığı değerlendirmeler (hastanın adı yok)
  // Çalışan ekranı: yalnızca toplu özet — ortalama, etiket sayıları, yorumlar (yıldız, saat, hizmet, hasta yok; sıra karışık)
  function degerlendirmelerHtml(pid) {
    const l = PUAN[pid] || [];
    if (!l.length) return "";
    const o = puanOrtalama(pid), y = yayindaPuanlar(pid);
    const sayac = {}; y.forEach((x) => x.etiketler.forEach((e) => { sayac[e] = (sayac[e] || 0) + 1; }));
    const etiket = Object.entries(sayac).sort((a, b) => b[1] - a[1]);
    const yorumlar = y.map((x) => x.yorum).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr")); // sıra ziyaret sırasını ele vermesin
    return `<div class="card stack puan-calisan" style="gap:8px"><div class="row between"><b>Hasta değerlendirmeleri</b><span class="pill good">★ ${o.ort.toFixed(2).replace(".", ",")}</span></div>
      ${etiket.length ? `<div class="row" style="gap:6px">${etiket.map(([e, n]) => `<span class="pill plain">${esc(e)} · ${n}</span>`).join("")}</div>` : ""}
      ${yorumlar.map((t) => `<div class="tiny muted">“${esc(t)}”</div>`).join("")}
      ${o.bekleyen ? `<div class="tiny">${o.bekleyen} yeni değerlendirme var; ${PUAN_TOPLU - o.bekleyen} tane daha birikince ortalamana ve bu özete eklenecek.</div>` : ""}
      <div class="tiny muted">Hangi hastanın kaç yıldız verdiğini göremezsin: puanlar ${PUAN_TOPLU}'erli gruplar hâlinde, yıldız, saat ve hasta bilgisi olmadan eklenir. Düşük puanları kalite ekibi ayrıca inceler.</div></div>`;
  }
  function vgHastaCtx(r) {
    const d = vgDoktor(r);
    return { doktorId: d, karma: karmaMi(r), gunAd: r.gun ? `Yarın · ${GUNLER[1].uzun}` : `Bugün · ${GUNLER[0].uzun}`, ucret: tl(r.price.patient_pays),
      tekTelefon: document.body.classList.contains("rol-hasta") || H.pid !== d || !!CAP.db };
  }
  function pGoruntulu(r) {
    return `<div class="pad stack">
      <button class="back" type="button" data-act="home">${ICO.back} Ana sayfa</button>
      <h2 style="font-size:22px">${r.status === "kabul" ? "Görüntülü görüşmen" : r.status === "red" ? "Başka bir seçenek seçelim" : "Talebin gönderildi"}</h2>
      ${VG.hastaRandevuHtml(r, vgHastaCtx(r))}
      ${(r.ek_bilgi || []).length ? `<div class="card stack ek-bilgi" style="gap:6px"><b>Doktorun senden ek bilgi istiyor</b>${r.ek_bilgi.map((x) => `<div class="small">• ${esc(x)}</div>`).join("")}</div>` : ""}
      <div class="card stack small" style="gap:6px"><b>Görüşmeden önce</b><div>• Sessiz, aydınlık bir yer seç; telefonu sabitle.</div><div>• Kullandığın ilaçları ve varsa tahlil sonuçlarını yanına al.</div><div>• Acil bir durum olursa görüşmeyi beklemeden 112'yi ara.</div></div>
      ${r.status === "red" ? `<button class="btn primary block" type="button" data-act="options">Diğer seçeneklere bak</button>` : ""}
    </div>`;
  }
  function pDone() {
    const r = P.request;
    if (P.vgOda && r && P.vgOda === r.id && vgVar(r)) return VG.hastaOdaHtml(r, vgHastaCtx(r));
    if (uzaktanMi(r)) return pGoruntulu(r);
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
      ${karmaMi(r) && st === "kabul" ? (r.goruntuluHekim ? VG.hastaRandevuHtml(r, vgHastaCtx(r)) : `<div class="card small">Görüntülü katılacak hekim atanıyor; atanınca burada görünecek.</div>`) : ""}
      ${G.aktif(r) ? `<div id="gzHasta">${G.hastaHtml(r)}</div>` : ""}
      ${gs.hastaOnay ? puanKarti(r) : ""}
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
      <div class="small neyle"><b>Neyle geliyor:</b> ${neyleGeliyor(T)}</div>
      ${(r.mesajlar || []).length ? `<div class="small calisan-mesaj">💬 <b>${esc(pp)}:</b> ${esc(r.mesajlar[r.mesajlar.length - 1].metin)} <span class="tiny muted">${esc(r.mesajlar[r.mesajlar.length - 1].saat)}</span></div>` : ""}
      <div class="tiny muted">Prototip: hareket planlanan rotaya göre canlandırılıyor (1 sn ≈ 1 dk); gerçek uygulamada çalışanın telefon konumuyla beslenir.</div></div>`;
  }
  // ---- Çalışanın yol tarifi: neyle, nasıl, ne kadar sürede; canlı konum (hastanın takibiyle aynı canlandırma) ----
  function neyleGeliyor(T) {
    if (T.toplu) return `toplu taşımayla · ${TOPLU.ozet(T.rt)}`;
    return T.rt && T.rt.legs ? "yürüyerek" : "🚗 kendi aracıyla";
  }
  // Çalışanın sıradaki ziyareti: hastanın canlı talebi ya da kabul ettiği (örnek) ziyaret
  const YOL_ORNEK = {};
  function siradakiZiyaret(pid) {
    const r = gzR();
    if (r && !r.gun) return r;
    const stops = (H.accepted[pid] || []).filter((v) => (v.date || DATE) === DATE && !v.uzaktan && !String(v.reqId).startsWith("T-")).sort((a, b) => a.start_min - b.start_min);
    const v = stops.find((x) => x.start_min + (x.duration_min || 30) > SIMDI);
    if (!v) return null;
    return (YOL_ORNEK[v.reqId] ||= { id: v.reqId, provider_id: pid, service: v.service_code, arrival_min: v.start_min, accepted_at: Date.now(), synthetic: true,
      patient: { lat: v.lat, lon: v.lon, district: (Object.values(repo.patients).find((q) => Math.abs(q.lat - v.lat) < 1e-6 && Math.abs(q.lon - v.lon) < 1e-6) || {}).district || "", adres: "", tarif: "" } });
  }
  function yolTarifiCanli(r) {
    const T = takipVerisi(r), d = takipDurumu(T, r), np = MAP.rotaNoktasi(T.rt, d.f);
    const adim = d.adim === 1 && np.kmLeft < 1 ? 2 : d.adim;
    const kalanDk = adim <= 2 ? Math.max(1, Math.ceil((1 - d.f) * T.yolDk + T.park)) : 0;
    const cikis = r.arrival_min - T.yolDk - T.park, sn = adim >= 1 && adim <= 2 ? d.f * T.rt.total : adim === 0 ? 0 : null;
    const bas = ["Yola çıkmaya hazırlan", T.toplu ? "Yoldasın (toplu taşıma)" : "Yoldasın", "Yaklaşıyorsun (1 km'den az)", "Vardın: hastaya kapı kodunu söyle", "Ziyarettesin"][adim];
    const gecilen = T.rt.pts.slice(0, np.i).concat([np.pos]), kalan = [np.pos].concat(T.rt.pts.slice(np.i));
    const adimlar = T.toplu ? TOPLU.adimlar(T.rt, sn) : null;
    const duraklar = adimlar ? T.rt.legs.map((L, i) => (L.t === "bin" ? { L, i } : null)).filter(Boolean).map(({ L }) => {
      const k = T.rt.cum.findIndex((c) => c >= L.c0); const q = T.rt.pts[Math.max(0, k)]; return q ? { lat: q[0], lon: q[1], tur: "durak", etiket: TOPLU.hatAdi(L.hat).replace(/ \(.*\)$/, "") } : null; }).filter(Boolean) : [];
    const svgH = MAP.svg({ rotalar: [{ pts: adim < 3 ? kalan : T.rt.pts, gecilen: adim < 3 ? gecilen : null, renk: "var(--brand)", kesik: !!T.toplu }],
      isaretler: [...duraklar, { lat: T.target[0], lon: T.target[1], tur: "hasta", etiket: "Hasta" }, { lat: np.pos[0], lon: np.pos[1], tur: "hareketli", etiket: adim < 3 ? "Sen" : "" }], aciklama: "Yol tarifi haritası" });
    const kmTop = T.rt.km.slice(-1)[0];
    const satirlar = adimlar ? adimlar.map((a) => `<li class="${a.simdi ? "simdi" : ""}"><span class="yt-ikon" aria-hidden="true">${a.ikon}</span><span><b>${esc(a.metin)}</b>${a.alt ? `<span class="tiny muted"> ${esc(a.alt)}</span>` : ""}</span></li>`).join("")
      : [["🏠", `${T.onceki ? "Önceki ziyaretinden" : "Evinden"} çık`, cikis <= SIMDI + 1 ? "hemen" : C.hhmm(cikis)], ["🚗", `${kmTop.toFixed(1).replace(".", ",")} km sür`, `trafikle ~${T.yolDk} dk`], ["🅿️", "Park et, binaya yürü", `~${T.park} dk`]]
        .map(([i, m, a], k) => `<li class="${(k === 0 && adim === 0) || (k === 1 && (adim === 1 || adim === 2)) || (k === 2 && adim === 3) ? "simdi" : ""}"><span class="yt-ikon" aria-hidden="true">${i}</span><span><b>${m}</b><span class="tiny muted"> ${a}</span></span></li>`).join("");
    return `<div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div><div class="tiny muted">SIRADAKİ ZİYARET · YOL TARİFİ</div><b>${esc(bas)}</b></div>
        ${adim <= 2 ? `<div style="text-align:right"><div class="when">${kalanDk} dk</div><div class="tiny muted">varış ${C.hhmm(r.arrival_min)}</div></div>` : ""}</div>
      <div class="yt-mod">${T.toplu ? "🚌 Toplu taşımayla" : T.rt.legs ? "🚶 Yürüyerek" : "🚗 Araçla"} · toplam ~${T.yolDk + T.park} dk · yola çıkış <b>${cikis <= SIMDI + 1 ? "hemen" : C.hhmm(cikis)}</b>${cikis > SIMDI + 5 ? `<span class="tiny muted"> (demo: yolculuk şimdi canlandırılıyor)</span>` : ""}</div>
      <div class="hr-kutu">${svgH}</div>
      <ol class="yt-adimlar">${satirlar}</ol>
      <div class="tiny muted">Prototip: hareket planlanan rotaya göre canlandırılıyor (1 sn ≈ 1 dk). Gerçekte konum telefonundan gelir; hasta da aynı konumu görür.</div>`;
  }
  function yolTarifiAlt(r) {
    const t = takipVerisi(r), [la, lo] = t.target, q = `${la.toFixed(6)},${lo.toFixed(6)}`, toplu = t.toplu;
    const adres = r.patient.adres ? `${esc(r.patient.adres)}${r.patient.district && !r.patient.adres.includes(r.patient.district) ? `, ${esc(r.patient.district)}` : ""}` : `${esc(r.patient.district || "")} · haritadaki nokta (${la.toFixed(5)}, ${lo.toFixed(5)})`;
    return `<div class="card stack yt-adres" style="gap:8px">
      <div><div class="tiny muted">ADRES</div><b>${adres}</b>${r.patient.tarif ? `<div class="small">🚪 ${esc(r.patient.tarif)}</div>` : `<div class="tiny muted">Kapı tarifi verilmedi; kapıda hastayı ara.</div>`}${r.patient.bedridden ? `<div class="tiny">Hasta yatağa bağımlı: kapıyı yakını açabilir.</div>` : ""}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <a class="btn primary" style="flex:1;min-width:150px;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${toplu ? "transit" : "driving"}">Google Haritalar'da aç</a>
        <a class="btn" style="flex:1;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://maps.apple.com/?daddr=${q}&dirflg=${toplu ? "r" : "d"}">Apple Haritalar</a>
        <a class="btn" style="flex:1;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://yandex.com.tr/harita/?rtext=~${q}&rtt=${toplu ? "mt" : "auto"}">Yandex</a></div>
      ${r.synthetic ? "" : `<div class="row" style="gap:6px"><button class="btn" type="button" data-act="hYoldayim" style="flex:1">“Yoldayım” mesajı gönder</button><button class="btn" type="button" data-act="hAra" style="flex:1">Hastayı ara</button></div>`}
      <div class="tiny muted">Hastanın numarası sana gösterilmez; arama platform üzerinden yapılır (demo).</div></div>`;
  }
  setInterval(() => {
    const el = document.getElementById("takip");
    if (el && P.screen === "done" && P.request && P.request.status === "kabul" && !P.request.gun && !uzaktanMi(P.request)) el.innerHTML = takipHtml(P.request);
    const hy = document.getElementById("hYol"), hr = H.pid ? siradakiZiyaret(H.pid) : null;
    if (hy && hr && MAP) hy.innerHTML = yolTarifiCanli(hr);
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
      ${PR.h.acil.ad && telGecerli(PR.h.acil.telefon) ? `<a class="btn block" href="tel:${esc(String(PR.h.acil.telefon).replace(/\s/g, ""))}" style="text-align:center;text-decoration:none">${esc(PR.h.acil.ad)}${PR.h.acil.yakinlik ? ` (${esc(PR.h.acil.yakinlik)})` : ""} kişisini ara</a>` : ""}
      ${acilKarti()}
      <button class="btn block" type="button" data-act="chat">Yanlış anlaşıldı, sohbete dön</button>
    </div>`;
  }

  // ---------- hasta olayları ----------
  const vgCtx = {
    aktifOda: (t) => (t === "h" ? H.vgOda : P.vgOda), istek: vgIstek, yenile: () => { renderP(); renderH(); },
    odaAc: (t, k) => { if (t === "h") { H.vgOda = k; } else { const r = vgIstek(k); if (r) P.request = r; P.vgOda = k; P.screen = "done"; } },
    odaKapat: (t) => { if (t === "h") H.vgOda = null; else P.vgOda = null; },
    tamamlandi: (r) => { const upd = { ...r, vgSonuc: "tamamlandi" }; putRequest(upd); if (P.request && P.request.id === r.id) P.request = upd; },
    katilmadi: (r) => { const upd = { ...r, vgSonuc: "katilmadi" }; putRequest(upd); if (P.request && P.request.id === r.id) P.request = upd; },
  };
  $("#pScreen").addEventListener("click", async (e) => {
    if (e.target.closest("[data-vg]")) { await VG.onClick(e, vgCtx); return; }
    if (G.onClick(e, P.request)) { renderP(); renderH(); gzYenile(true); return; }
    const sv = e.target.closest("[data-sv]");
    if (sv) {
      const k = sv.dataset.sv;
      if (k === "kapat") { SV.kapat(); renderP(); } else if (k === "dokun") SV.dokun(); else if (k === "duraklat") SV.duraklat();
      return;
    }
    const pz = e.target.closest("[data-puan],[data-puan-etiket]");
    if (pz && P.puanTaslak) {
      const T = P.puanTaslak;
      if (pz.dataset.puan) { const n = +pz.dataset.puan; if ((n >= 4) !== (T.yildiz >= 4)) T.etiketler = []; T.yildiz = n; }
      else { const x = pz.dataset.puanEtiket; T.etiketler = T.etiketler.includes(x) ? T.etiketler.filter((y) => y !== x) : [...T.etiketler, x]; }
      renderP(); const b = document.querySelector(pz.dataset.puan ? `[data-puan="${pz.dataset.puan}"]` : `[data-puan-etiket="${CSS.escape(pz.dataset.puanEtiket)}"]`); if (b) b.focus();
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
    else if (a === "puanGonder") puanGonder();
    else if (a === "home") { if (CAP.dictation && P.listening) { try { CAP.dictation.stop(); } catch (er) { /**/ } P.listening = false; } P.screen = "home"; P.sheet = null; renderP(); }
    else if (a === "chat") { P.screen = "chat"; P.emergency = null; renderP(); }
    else if (a === "skipdoc" && SV.acik) { const m = istenenMeslek(); SV.hizli(`Soruları geç, ${m && !HEKIMLER.has(m) ? yonelme(meslekAdi(m)) : "doktora"} yönlendir.`); }
    else if (a === "skipdoc") { if (!P.busy) { const m = istenenMeslek(); P.msgs.push({ who: "me", text: `Soruları geç, ${m && !HEKIMLER.has(m) ? yonelme(meslekAdi(m)) : "doktora"} yönlendir.` }); await doktoraYonlendir(); } }
    else if (a === "summary") { P.screen = "summary"; renderP(); }
    else if (a === "options") { satirIciAdresiKaydet(); P.screen = "options"; P.sheet = null; renderP(); }
    else if (a === "adresler") { P.adresSec = true; P.adresSilOnay = null; renderP(); }
    else if (a === "adresKapat") { if (e.target === t || t.tagName === "BUTTON") { P.adresSec = false; renderP(); } }
    else if (a === "adresYeni") { adresFormAc(null); }
    else if (a === "adresIptal") { P.screen = P.adresDonus || "home"; P.adresHata = ""; renderP(); }
    else if (a === "adresKaydet") { adresFormKaydet(); }
    else if (a === "voice") { P.voice = !P.voice; renderP(); }
    else if (a === "closeSheet") { if (e.target === t || t.tagName === "BUTTON") { P.sheet = null; renderP(); } }
    else if (a === "confirm") { await confirmBooking(); }
    else if (a === "cancel") { if (P.request && vgVar(P.request)) { VG.iptal(P.request); P.vgOda = null; } if (P.request) { P.request = { ...P.request, status: "iptal" }; takvimdenSil(P.request.id); await putRequest(P.request); } P.screen = "home"; P.toast = "Talebin iptal edildi; sağlık çalışanının takviminden de çıkarıldı."; renderP(); renderH(); }
    else if (a === "takip") { const r = REQ.find((x) => x.id === t.dataset.id) || P.request; if (r) { P.request = r; P.screen = "done"; P.vgOda = null; renderP();
      const hedef = $("#pScreen .puan") || (G.durum(r) && G.durum(r).checkout ? $("#gzHasta") : null); if (hedef) hedef.scrollIntoView({ block: "center" }); } }
  });
  $("#pScreen").addEventListener("submit", (e) => { if (e.target.id === "pComposer") { e.preventDefault(); const ta = $("#pInput"); const v = ta.value; ta.value = ""; send(v); } });
  $("#pScreen").addEventListener("keydown", (e) => { if (e.target.id === "pInput" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#pComposer").requestSubmit(); } });
  // Kayıtlı adres eylemleri
  function adresFormAc(id) {
    const a = AB.liste.find((x) => x.id === id);
    P.adresTaslak = a ? JSON.parse(JSON.stringify(a)) : { baslik: ABASLIK.find((b) => !AB.liste.some((x) => x.baslik === b)) || "Diğer adres", adres: "", ilce: P.info.district, nokta: null, bina: "", kat: "", daire: "", tarif: "", varsayilan: !AB.liste.length };
    if (P.screen !== "adresForm") P.adresDonus = P.screen;
    P.adresSec = false; P.adresHata = ""; P.screen = "adresForm"; renderP();
  }
  function adresFormKaydet() {
    const t = P.adresTaslak;
    t.baslik = (t.baslik || "").trim().slice(0, 30);
    if (!t.baslik) { P.adresHata = "Adrese bir başlık ver (ör. Ev)."; renderP(); return; }
    if (!t.adres.trim() && !t.ilce) { P.adresHata = "Mahalle ya da sokak yaz, listeden seç."; renderP(); return; }
    if (t.adres.trim() && !t.nokta) { P.adresHata = "Yazdığın adresi listeden seç ki haritada doğru yere yerleşsin."; renderP(); return; }
    if (!t.id) { t.id = "A" + Math.random().toString(36).slice(2, 8); AB.liste.push(t); } else AB.liste = AB.liste.map((x) => (x.id === t.id ? t : x));
    if (t.varsayilan) AB.liste.forEach((x) => { x.varsayilan = x.id === t.id; });
    adresUygula(t); adresDefteriYaz();
    P.toast = `"${t.baslik}" adresi kaydedildi.`; P.adresHata = ""; P.screen = P.adresDonus || "home"; renderP();
  }
  // Özet ekranında elle yazılan adres: "Bu adresi kaydet" işaretliyse seçenekler açılırken deftere eklenir
  function satirIciAdresiKaydet() {
    if (!ADR || seciliAdres() || P.adresKaydetme || !P.info.nokta) return;
    const tarif = (P.info.tarif || "").trim();
    const a = { id: "A" + Math.random().toString(36).slice(2, 8), baslik: AB.liste.length ? "Diğer adres" : "Ev", adres: P.info.nokta.adres, ilce: P.info.district,
      nokta: { lat: P.info.nokta.lat, lon: P.info.nokta.lon, km: P.info.nokta.km }, bina: "", kat: "", daire: "", tarif, varsayilan: !AB.liste.length };
    AB.liste.push(a); AB.secili = a.id; adresDefteriYaz();
    P.toast = `Adresin "${a.baslik}" olarak kaydedildi; bir dahaki sefere yalnızca seçeceksin.`;
  }
  $("#pScreen").addEventListener("click", (e) => {
    const t = e.target.closest("[data-adres-sec],[data-adres-duzen],[data-adres-sil],[data-adres-silsor],[data-abaslik]"); if (!t) return;
    if (t.dataset.adresSec) { const a = AB.liste.find((x) => x.id === t.dataset.adresSec); if (a) { adresUygula(a); adresDefteriYaz(); P.adresSec = false; P.toast = `Adres: ${a.baslik}`; renderP(); } }
    else if (t.dataset.adresDuzen) adresFormAc(t.dataset.adresDuzen);
    else if (t.dataset.adresSilsor) { P.adresSilOnay = t.dataset.adresSilsor; renderP(); }
    else if (t.dataset.adresSil) {
      AB.liste = AB.liste.filter((x) => x.id !== t.dataset.adresSil); P.adresSilOnay = null;
      if (AB.secili === t.dataset.adresSil) { AB.secili = null; const y = AB.liste.find((x) => x.varsayilan) || AB.liste[0]; if (y) adresUygula(y); else { P.info.nokta = null; P.info.adresYazi = ""; P.info.tarif = ""; } }
      adresDefteriYaz(); renderP();
    } else if (t.dataset.abaslik) { P.adresTaslak.baslik = t.dataset.abaslik === "Diğer" ? "" : t.dataset.abaslik; renderP(); if (t.dataset.abaslik === "Diğer") { const f = $("#fBaslik"); if (f) f.focus(); } }
  });
  // Kullanıcının açtığı klasik liste, teklifler gelip ekran yenilenince kapanmasın
  // Adres arama: yazdıkça öneri; seçilen adres en yakın yol noktasına (yol paketindeki 240 nokta) yerleşir
  $("#pScreen").addEventListener("input", (e) => {
    if (e.target.id === "puanYorum" && P.puanTaslak) { P.puanTaslak.yorum = e.target.value; return; }
    if (e.target.id === "pTarif") { P.info.tarif = e.target.value; return; }
    if (P.adresTaslak && ({ fBaslik: "baslik", fBina: "bina", fKat: "kat", fDaire: "daire", fTarif: "tarif" })[e.target.id]) { P.adresTaslak[{ fBaslik: "baslik", fBina: "bina", fKat: "kat", fDaire: "daire", fTarif: "tarif" }[e.target.id]] = e.target.value; return; }
    if (!["pAdres", "fAdres"].includes(e.target.id) || !ADR) return;
    if (e.target.id === "pAdres") P.info.adresYazi = e.target.value; else { P.adresTaslak.adres = e.target.value; P.adresTaslak.nokta = null; }
    const r = ADR.ara(e.target.value), L = $(e.target.id === "pAdres" ? "#pAdresList" : "#fAdresList");
    L.innerHTML = r.map((x, i) => `<button class="chip adres-oneri" type="button" data-adres="${i}" style="text-align:left">${x.mahalle ? "🏘️" : "📍"} <b>${esc(x.ad)}</b> <span class="muted">${esc(x.alt)}</span></button>`).join("")
      || (e.target.value.trim().length >= 3 ? `<div class="tiny muted">Bulunamadı; farklı yaz ya da ilçeyi seç.</div>` : "");
    L._sonuc = r;
  });
  $("#pScreen").addEventListener("click", (e) => {
    const b = e.target.closest("[data-adres]"); if (!b) return;
    const L = b.closest(".adres-liste"), x = L._sonuc[+b.dataset.adres], n = noktaBul(x.ll), ad = x.ad + (x.alt ? ", " + x.alt : "");
    if (L.id === "fAdresList") { Object.assign(P.adresTaslak, { adres: ad, nokta: { lat: n.lat, lon: n.lon, km: n.km } }); if (n.ilce) P.adresTaslak.ilce = n.ilce; P.adresHata = ""; renderP(); return; }
    if (n.ilce) P.info.district = n.ilce;
    P.info.nokta = { lat: n.lat, lon: n.lon, adres: ad, km: n.km };
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
    if (e.target.id === "pAdresKaydet") P.adresKaydetme = !e.target.checked;
    if (e.target.id === "fIlce" && P.adresTaslak) P.adresTaslak.ilce = e.target.value;
    if (e.target.id === "fVarsayilan" && P.adresTaslak) P.adresTaslak.varsayilan = e.target.checked;
  });
  // Mikrofon: start() tıklamadan hemen çağrılmalı
  $("#pScreen").addEventListener("click", (e) => {
    const b = e.target.closest("#pMic"); if (!b || !CAP.dictation) return;
    if (P.listening) { CAP.dictation.stop().catch(() => {}); return; }
    CAP.dictation.start().catch((err) => { if (err && err.code === "not_granted") { CAP.dictation = null; P.toast = "Mikrofon izni yok; yazarak devam edebilirsin."; renderP(); } });
  });

  // Hemşire evde + hekim görüntülü: hemşirenin ziyareti sırasında boş olan bir hekim seçilir; hekimin takviminde görüntülü blok tutulur (yolculuk yok)
  function karmaHekimAta(r) {
    const date = r.date || DATE, sure = svc("tele_muayene").duration_min, son = r.arrival_min + svc(r.service).duration_min - sure;
    let en = null;
    for (const pid of Object.keys(repo.provider_services)) {
      if (!repo.provider_services[pid].tele_muayene || pid === r.provider_id) continue;
      const w = repo.availability[pid + "|" + date]; if (!w) continue;
      const t = C.teleBaslangic(w, repo.scheduled[pid + "|" + date] || [], r.arrival_min + 5, sure);
      if (t == null || t > son) continue;
      const puan = (repo.providers[pid] || {}).rating || 0;
      if (!en || t < en.t || (t === en.t && puan > en.puan)) en = { pid, t, puan };
    }
    if (!en) { r.goruntuluHekim = null; return; }
    Object.assign(r, { goruntuluHekim: en.pid, vgBaslangic: en.t, vgSure: sure });
    const l = (repo.scheduled[en.pid + "|" + date] ||= []);
    l.push({ id: "V-" + r.id, reqId: r.id, provider_id: en.pid, date, start_min: en.t, duration_min: sure, lat: r.patient.lat, lon: r.patient.lon, service_code: "tele_muayene", uzaktan: true });
    l.sort((a, b) => a.start_min - b.start_min);
  }
  async function confirmBooking() {
    const c = P.cands[P.sheet];
    // Onay anında çakışmayı yeniden denetle: bu arada başka bir randevu o saati doldurduysa listeyi yenile
    if (!c.teklif) {
      const kontrol = C.findCandidates(repo, c.service, P.pt, gunTarih(P.info.gun), P.info.when, SORTS[P.sort][1], 20, 500, gercekSimdi());
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
      arrival_min: c.arrival_min, gun: P.info.gun, date: gunTarih(P.info.gun), price: c.price, ins: c.insertion, patient: { district: P.info.district, lat: P.pt.lat, lon: P.pt.lon, bedridden: P.info.bed, plan: P.info.plan, adres: P.info.nokta ? P.info.nokta.adres : "", tarif: (P.info.tarif || "").trim().slice(0, 160) },
      report: P.report, photos: P.photos.slice(0, 3).map((p) => p.url), red_flags_checked: true, from_app: true, author: CAP.uid || null,
    };
    if (karmaMi(r)) karmaHekimAta(r);
    P.request = r; P.sheet = null; P.screen = "done";
    takvimeIsle(r); (P.randevular ||= []).unshift(r.id);
    H.pid = c.provider_id; H.tab = "talepler"; H.open = id;
    if (c.teklif) { // çalışan teklif verdi, hasta kabul etti → randevu kesin, çalışanın rotasına girer
      (H.accepted[c.provider_id] ||= []).push({ reqId: id, date: gunTarih(P.info.gun), lat: P.pt.lat, lon: P.pt.lon, start_min: c.arrival_min, duration_min: svc(c.service).duration_min, service_code: c.service, uzaktan: uzaktanHizmet(c.service), earn: c.price.provider_gets });
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
    const stops = hStops(pid, true);
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
  function hStops(pid, tumu) {
    const sab = (repo.scheduled[pid + "|" + DATE] || []).filter((x) => !x.reqId || (tumu && x.uzaktan && !(H.accepted[pid] || []).some((v) => v.reqId === x.reqId)));
    const l = [...sab, ...(H.accepted[pid] || []).filter((x) => (x.date || DATE) === DATE)];
    return (tumu ? l : l.filter((x) => !x.uzaktan)).sort((a, b) => a.start_min - b.start_min);
  }
  // Çalışanın görüntülü görüşmeleri (kendi görüntülü randevuları + hemşireli ziyarete görüntülü katıldıkları)
  const hTele = (pid) => REQ.filter((r) => r.status === "kabul" && ((uzaktanMi(r) && r.provider_id === pid) || (karmaMi(r) && r.goruntuluHekim === pid))).sort((a, b) => (a.vgBaslangic ?? a.arrival_min) - (b.vgBaslangic ?? b.arrival_min));
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
    if (H.vgOda) { const odak = document.activeElement; if (odak && odak.id === "vgNot") return; } // not yazılırken ekran yeniden çizilmez
    const pid = H.pid, p = repo.providers[pid], pp = person(pid);
    const stops = hStops(pid), home = [p.home_lat, p.home_lon];
    // Toplam yol: harita varsa gerçek sokak mesafesi, yoksa kuş uçuşu × 1,3
    const yk = (a, b) => (MAP ? MAP.rota(a, b).km.slice(-1)[0] : C.roadKm(a, b));
    let km = 0, prev = home; for (const s of stops) { km += yk(prev, [s.lat, s.lon]); prev = [s.lat, s.lon]; } if (stops.length) km += yk(prev, home);
    const earn = hStops(pid, true).reduce((a, s) => a + (s.earn != null ? s.earn : svc(s.service_code).base_fee_tl * p.fee_multiplier * (1 - C.CFG.COMMISSION)), 0);
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
    const vgOda = H.vgOda && vgIstek(H.vgOda);
    if (H.vgOda && !vgOda) H.vgOda = null;
    if (vgOda) body = VG.doktorOdaHtml(vgOda, vgDoktorCtx(vgOda));
    if (H.profil) {
      // Arka plandaki yenilemeler (teklif, takip) yazılan formu silmesin
      const odak = document.activeElement; if (odak && el.contains(odak) && /INPUT|TEXTAREA/.test(odak.tagName) && !H.profilZorla) return;
      el.innerHTML = `<div style="min-height:100%">${hProfil(p)}</div>${H.toast ? `<div class="toast" role="status">${esc(H.toast)}</div>` : ""}`;
      if (H.toast) { const t = H.toast; setTimeout(() => { if (H.toast === t) { H.toast = ""; const n = $("#hScreen .toast"); if (n) n.remove(); } }, 3500); }
      return; }
    el.innerHTML = `<div style="display:flex;flex-direction:column;min-height:100%">
      ${appbar("h")}<div class="h-head"><div class="profil"><div class="who"><span class="profil-foto">${AVATAR}</span><div style="min-width:0"><div class="profil-ad">${esc(kisaAd(pid))}</div><span class="cevrimici${calisanProfili(pid).cevrimici ? "" : " kapali"}">${calisanProfili(pid).cevrimici ? "Çevrimiçi" : "Çevrimdışı"}</span>
          <div class="tiny muted" style="margin-top:4px">${esc(p.home_district)} · ★ ${puanOrtalama(p.id).ort.toFixed(1).replace(".", ",")} · başvuru: ${esc(DG.headerLabel())}</div></div></div>
        <div class="stats"><div>${ICO.takvim}<b class="num">${stops.length}</b><span>ziyaret</span></div><div>${ICO.pin}<b class="num">${km.toFixed(1).replace(".", ",")} <small>km</small></b><span>toplam yol</span></div><div>${ICO.para}<b class="num">${tl(earn)} <small>TL</small></b><span>kazanç</span></div></div></div></div>
      ${H.open || H.vgOda ? "" : `<div class="tabs" role="tablist">${[["talepler", "Talepler"], ["rota", "Rotam"], ["saat", "Saatlerim"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${H.tab === k}">${l}${k === "talepler" && box.length ? `<span class="badge">${box.length}</span>` : ""}</button>`).join("")}</div>`}
      ${DG.banner()}<div id="gzUyari" class="gz-ust">${G.uyariHtml(gzR())}</div><div style="flex:1">${body}</div></div>${H.toast ? `<div class="toast" role="status">${esc(H.toast)}</div>` : ""}`;
    if (H.toast) { const t = H.toast; setTimeout(() => { if (H.toast === t) { H.toast = ""; const n = $("#hScreen .toast"); if (n) n.remove(); } }, 3500); }
    VG.videolariBagla(el);
  }
  function vgDoktorCtx(r) {
    const rep = r.report || {};
    const eks = rep.eksik_bilgiler || [];
    return { karma: karmaMi(r), baslik: `${svc(r.service).name_tr}${karmaMi(r) ? "" : " · " + (r.patient.district || "")}`,
      hastaEtiket: [rep.kim_icin, rep.yas_araligi].filter((x) => x && x !== "belirtilmedi").join(", ") || "Hasta",
      ozetHtml: `<b>Yapay zekâ özeti</b><div>${esc(rep.saglikci_icin_ozet || rep.sikayet || "")}</div><div class="small"><span class="muted">Şikâyet:</span> ${esc(rep.sikayet || "belirtilmedi")} · <span class="muted">Ne zamandır:</span> ${esc(rep.baslangic || "belirtilmedi")}</div>
        <div class="small"><span class="muted">Hastalık, ilaç, alerji:</span> ${esc(rep.kronik_ilac_alerji || "belirtilmedi")}</div>${eks.length ? `<div class="small"><span class="muted">Eksik bilgi:</span> ${esc(eks.join(" · "))}</div>` : ""}<div class="tiny muted">Beyandan özet; teşhis değildir.</div>` };
  }
  function hInbox(box) {
    if (!calisanProfili(H.pid).cevrimici) return `<div class="pad stack"><div class="card stack" style="gap:8px"><b>Çevrimdışısın</b><span class="small muted">Yeni talepler sana önerilmiyor. Kabul ettiğin ziyaretler Rotam'da duruyor.</span><button class="btn primary" type="button" data-act="hCevrimiciOl">Çevrimiçi ol</button></div></div>`;
    if (!box.length) return `<div class="pad muted">Şu an yeni talep yok. Saatlerini genişletirsen daha fazla talep gelir.</div>`;
    const km = (x) => String(x).replace(".", ",");
    return `<div class="pad stack">${box.map((r) => `<button class="req ${r.synthetic ? "" : "new"}" type="button" data-open="${esc(r.id)}">
      <div class="rq-ust"><span class="rq-ico">${svcIcon(r.service)}</span><span class="rq-baslik"><b>${esc(svc(r.service).name_tr)}</b>${uzaktanMi(r) ? ` <span class="pill kirmizi">Görüntülü</span>` : ""}<span class="cond">${esc(r.report.tek_satir || r.report.sikayet)}</span></span>${r.synthetic ? `<span class="pill plain">Örnek</span>` : `<span class="pill kirmizi">Yeni · uygulamadan</span>`}</div>
      <div class="rq-bilgi"><span>${ICO.clock}${gunEki(r)}${C.hhmm(r.arrival_min)}</span><span class="sep"></span><span>${ICO.pin}${esc(r.patient.district)}</span>
        ${r.patient.bedridden ? `<span class="sep"></span><span class="pill plain">Yatağa bağımlı</span>` : ""}${(r.photos || []).length ? `<span class="pill plain">${r.photos.length} fotoğraf</span>` : ""}</div>
      <div class="rq-alt"><span class="row" style="gap:8px">${r.ins ? (r.ins.shared && r.ins.added_km <= 5 ? `<span class="pill kirmizi">Rotana uygun</span><span class="sep" style="width:1px;height:16px;background:var(--line)"></span>Ek yol ${km(r.ins.added_km)} km` : `Ek yol ${km(r.ins.added_km)} km`) : "Görüntülü"}</span><span class="earn num">${tl(hEarn(r))} TL</span></div>
    </button>`).join("")}</div>`;
  }
  const hEarn = (r) => r.price.provider_gets;
  function hDetail(r, p) {
    const rep = r.report, home = [p.home_lat, p.home_lon];
    const nv = { lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, isNew: true };
    const uz = uzaktanMi(r);
    const stops = [...hStops(p.id), ...(uz ? [] : [nv])].sort((a, b) => a.start_min - b.start_min);
    const pr = r.price;
    const planTxt = { var: "Var (beyan) · belgeyi ziyarette gör", yok: "Yok", bilinmiyor: "Bilinmiyor" }[r.patient.plan] || r.patient.plan;
    const kv = [["Kim için", [rep.kim_icin, rep.yas_araligi].filter((x) => x && x !== "belirtilmedi").join(" · ") || "belirtilmedi"], ["Şikayet", rep.sikayet], ["Ne zamandır", rep.baslangic], ["Seyir", rep.seyir], ["Şiddet", rep.siddet_beyani], ["Yatağa bağımlı", r.patient.bedridden ? "Evet" : "Hayır / belirtilmedi"], ["Hekim planı", planTxt], ["Hastalık, ilaç, alerji", rep.kronik_ilac_alerji]];
    return `<div class="pad stack">
      <button class="back" type="button" data-act="hback">${ICO.back} Talepler</button>
      <div class="row between"><div class="row" style="gap:6px">${svcIcon(r.service)}<h2 style="font-size:19px">${esc(svc(r.service).name_tr)}</h2>${uz ? `<span class="pill kirmizi">Görüntülü</span>` : ""}</div>${r.synthetic ? `<span class="pill plain">örnek</span>` : `<span class="pill sun">Uygulamadan</span>`}</div>
      <div class="card row between"><div class="stack" style="gap:2px"><span class="when">${gunEki(r)}${C.hhmm(r.arrival_min)} · ${svc(r.service).duration_min} dk</span><span class="small muted">${uz ? "Görüntülü doktor görüşmesi · yolculuk yok" : esc(r.patient.district)}${r.ins && !uz ? ` · ek yol ${r.ins.added_km} km` : ""}</span></div>
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
      ${uz ? `<div class="sec card stack" style="gap:8px"><h3>4 · Görüntülü görüşme</h3>
        <dl class="kv"><dt>Saat</dt><dd>${gunEki(r)}${C.hhmm(r.arrival_min)} – ${C.hhmm(r.arrival_min + svc(r.service).duration_min)}</dd><dt>Süre</dt><dd>${svc(r.service).duration_min} dk</dd><dt>Kazancın</dt><dd>${tl(pr.provider_gets)} TL</dd><dt>Yolculuk</dt><dd>Yok (harita, rota ve yol ücreti yok)</dd></dl>
        ${r.status === "kabul" ? VG.doktorKartHtml(r, vgDoktorCtx(r)) : `<div class="small muted">Kabul edersen takvimine görüntülü görüşme olarak eklenir; rotana girmez.</div>`}</div>` : `<div class="sec card stack" style="gap:8px"><h3>4 · Ziyaret</h3>
        <div class="small">${esc(r.patient.district)} · ${gunEki(r)}${C.hhmm(r.arrival_min)} · ${svc(r.service).duration_min} dk${r.patient.bedridden ? " · hasta yatağa bağımlı" : ""}</div>
        ${(rep.ihtiyaclar || []).length || (rep.malzeme || []).length ? `<div class="checklist">
        ${[...(rep.ihtiyaclar || []).map((x) => "İstenen: " + x), ...(rep.malzeme || [])].map((x, i) => `<label for="ck${i}"><input type="checkbox" id="ck${i}"> <span>${esc(x)}</span></label>`).join("")}</div>` : ""}
        ${G.riskHtml(G.riskAnaliz(rep, P.request && r.id === P.request.id ? transcriptText() : "", r.arrival_min), { bosGoster: true })}</div>`}
      <div class="sec card stack" style="gap:8px"><h3>${uz ? "Net kazancın" : "Rotan ve net kazancın"}</h3>
        ${uz ? "" : mapSVG(home, stops)}
        <div class="small">${r.ins && r.ins.shared ? `Bu ziyaret bugünkü rotana eklenir: ek yol <b>${r.ins.added_km} km</b> (tek başına ${r.ins.standalone_km} km).` : r.ins ? `Ek yol ${r.ins.added_km} km.` : ""}</div>
        <div class="bill small"><span>Hizmet bedeli</span><span class="num">${tl(pr.service_fee)} TL</span><span>Platform payı (%10)</span><span class="num">−${tl(pr.service_fee * C.CFG.COMMISSION)} TL</span>
          ${pr.actual_travel != null ? `<span>Yol masrafı karşılığı</span><span class="num">${tl(pr.actual_travel)} TL</span>` : ""}
          ${pr.saving > 0 ? `<span class="disc">Paylaşım primi</span><span class="disc num">+${tl(pr.saving * C.CFG.SPLIT.saglikci)} TL</span>` : ""}
          <span class="tot">Sana kalan</span><span class="tot num">${tl(pr.provider_gets)} TL</span></div></div>
      <div style="height:70px"></div></div>
      ${r.status === "kabul" ? "" : `<div class="hbar" style="flex-wrap:wrap">${H.bilgiAcik === r.id ? `<div class="stack" style="gap:6px;width:100%"><b class="small">5 · Hastadan ne istiyorsun?</b><div class="seg">${["Yaranın fotoğrafı", "Reçete / hekim planı fotoğrafı", "Kullandığı ilaçların listesi", "Adres tarifi"].map((x) => `<button class="chip" type="button" data-act="hbilgisor" data-id="${esc(r.id)}" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>` : ""}
        <button class="btn" type="button" data-act="hreject" data-id="${esc(r.id)}">Reddet</button><button class="btn" type="button" data-act="hbilgi" data-id="${esc(r.id)}">Ek bilgi iste</button><button class="btn primary" type="button" data-act="haccept" data-id="${esc(r.id)}" style="flex:1"${DG.canAccept() ? "" : ` disabled aria-describedby="lockMsg"`}>Kabul et · ${C.hhmm(r.arrival_min)}</button>
        ${DG.canAccept() ? "" : `<div class="lockmsg" id="lockMsg" style="width:100%">Başvurun onaylanınca görev kabul edebilirsin.</div>`}</div>`}`;
  }
  function hRoute(p, stops) {
    const home = [p.home_lat, p.home_lon];
    const yr = MAP ? siradakiZiyaret(p.id) : null, ygs = yr && G.durum(yr);
    const yolKart = yr && !(ygs && ygs.checkin) ? `<div class="card stack yol-tarifi" id="hYol" style="gap:8px" aria-live="off">${yolTarifiCanli(yr)}</div>${yolTarifiAlt(yr)}` : "";
    const tele = hTele(p.id);
    const teleKart = tele.length ? `<div class="stack vg-liste" style="gap:8px"><b>Görüntülü görüşmelerin</b><div class="tiny muted">Rotana girmez; takvimde yer tutar.</div>${tele.map((r) => VG.doktorKartHtml(r, vgDoktorCtx(r))).join("")}</div>` : "";
    return `<div class="pad stack">${teleKart}${yolKart}${G.aktif(gzR()) ? `<div id="gzCalisan">${G.calisanHtml(gzR())}</div>` : ""}${degerlendirmelerHtml(p.id)}${MAP ? gunHaritasi(home, stops) : mapSVG(home, stops.map((s) => ({ ...s, isNew: !!s.reqId })))}
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
  $("#hScreen").addEventListener("input", (e) => { if (VG.onInput(e)) return; if (!G.onInput(e, gzR())) DG.onInput(e); });
  $("#hScreen").addEventListener("pointerdown", (e) => G.onPointerDown(e, gzR()));
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => $("#hScreen").addEventListener(ev, () => G.onPointerUp()));
  $("#hScreen").addEventListener("contextmenu", (e) => { if (e.target.closest("[data-gz-sure]")) e.preventDefault(); });
  $("#gzMasa").addEventListener("click", (e) => { if (G.onClick(e, P.request)) { renderP(); renderH(); gzYenile(true); } });
  // Güvenli Ziyaret: zamanlayıcı ilerler; yalnızca değişen kutular yeniden çizilir (PIN girişi bozulmasın)
  let gzImza = "";
  // Güvenli Ziyaret kutularını yenile. Yalnızca sayılar değiştiyse (geri sayım, dakika) yerinde güncellenir; kutu baştan
  // çizilmez. Böylece telefonda PIN yazarken klavye kapanmaz, düğmeye basılıyken düğme değişip dokunuş boşa gitmez.
  let gzBasili = null;
  document.addEventListener("pointerdown", (e) => { gzBasili = e.target; }, true);
  ["pointerup", "pointercancel"].forEach((ev) => document.addEventListener(ev, () => setTimeout(() => { gzBasili = null; }, 0), true));
  document.addEventListener("click", () => { gzBasili = null; }, true); // tıklama işlenirken gelen güncelleme ertelenmesin
  let gzBekleyen = false; // basılıyken ertelenen yenileme: bir sonraki turda yapılır
  const CANLI = /<span data-canli>([^<]*)<\/span>/g;
  function gzKoy(sel, html) {
    const el = $(sel); if (!el || el._html === html) return;
    const iskelet = (h) => h.replace(CANLI, "").replace(/ value="[^"]*"/g, ""); // yazılan PIN de kutuyu baştan çizdirmesin
    if (el._html !== undefined && iskelet(el._html) === iskelet(html)) {
      const yeni = [...html.matchAll(CANLI)].map((m) => m[1]);
      el.querySelectorAll("span[data-canli]").forEach((sp, i) => { if (yeni[i] !== undefined && sp.innerHTML !== yeni[i]) sp.innerHTML = yeni[i]; });
      el._html = html; return;
    }
    if (gzBasili && el.contains(gzBasili)) { gzBekleyen = true; return; } // parmak kalkınca (bir sonraki turda) çizilir
    const odak = document.activeElement && document.activeElement.id === "gzPin" && el.contains(document.activeElement);
    el.innerHTML = html; el._html = html;
    if (odak) { const i = $("#gzPin"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function gzYenile(zorla) {
    const imza = G.tick(P.request);
    if (!zorla && imza === gzImza && !gzBekleyen) return;
    gzImza = imza; gzBekleyen = false;
    if (P.screen === "done" && P.request) gzKoy("#gzHasta", G.hastaHtml(P.request));
    gzKoy("#gzCalisan", G.calisanHtml(gzR())); gzKoy("#gzUyari", G.uyariHtml(gzR())); gzKoy("#gzMasa", G.masaHtml(P.request));
    if ($("#hScreen .tabs") && !$("#gzCalisan") && G.aktif(gzR()) && H.tab === "rota" && !H.open) renderH(); // ilk görünüş
  }
  setInterval(() => gzYenile(false), 400);
  $("#hScreen").addEventListener("change", (e) => DG.onChange(e));
  $("#hScreen").addEventListener("keydown", (e) => {
    if (e.target.id === "gzPin" && e.key === "Enter") { e.preventDefault(); const b = e.target.parentElement.querySelector("[data-gz=pin]"); if (b) b.click(); return; }
    DG.onKey(e);
  });
  $("#demoCtl").addEventListener("click", (e) => DG.demoClick(e));
  $("#hScreen").addEventListener("click", async (e) => {
    if (e.target.closest("[data-vg]")) { await VG.onClick(e, vgCtx); return; }
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
    if (a === "hYoldayim" || a === "hAra") {
      const r = gzR(); if (!r) return;
      const pp = person(r.provider_id);
      if (a === "hAra") { H.toast = "Hasta aranıyor… (demo: numaralar gizli, platform bağlar)"; P.toast = `${pp.full} seni arıyor (demo).`; renderH(); renderP(); return; }
      const T = takipVerisi(r), d = takipDurumu(T, r), np = MAP.rotaNoktasi(T.rt, d.f);
      const kalan = d.adim <= 2 ? Math.max(1, Math.ceil((1 - d.f) * T.yolDk + T.park)) : 0;
      const metin = kalan ? `Yoldayım, yaklaşık ${kalan} dk sonra oradayım.` : "Kapınızdayım.";
      r.mesajlar = [...(r.mesajlar || []), { metin, saat: C.hhmm(Math.max(SIMDI, r.arrival_min - kalan)) }];
      putRequest(r); H.toast = "Mesaj hastaya gitti."; P.toast = `${pp.first}: ${metin}`; renderH(); renderP(); return;
    }
    if (a === "haccept" || a === "hreject") {
      const id = t.dataset.id, pid = H.pid;
      const r = inbox(pid).find((x) => x.id === id);
      if (!r) return;
      // Arayüz simülasyonu: gerçek uygulamada kabul yetkisi sunucuda denetlenir.
      if (a === "haccept" && !DG.canAccept()) { H.toast = "Başvurun onaylanmadan görev kabul edemezsin."; renderH(); return; }
      if (a === "haccept") {
        (H.accepted[pid] ||= []).push({ reqId: id, date: r.date || DATE, lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, service_code: r.service, uzaktan: uzaktanHizmet(r.service), earn: r.price.provider_gets });
        takvimeIsle(r);
        H.toast = uzaktanMi(r) ? `Kabul edildi. ${gunEki(r)}${C.hhmm(r.arrival_min)} görüntülü görüşme takvimine eklendi (rotana girmez).` : `Kabul edildi. ${gunEki(r)}${C.hhmm(r.arrival_min)} rotana eklendi.`;
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
  // Görüntülü görüşme, tek telefon demosu: doktor ekranı görünmüyorsa hasta odada bekledikten 5 sn sonra doktor adına demo katılım
  setInterval(() => VG.tick(document), 1000); // görüşme süresi yerinde güncellenir
  const vgOto = {};
  setInterval(() => {
    const r = P.request; if (!r || !vgVar(r) || r.status !== "kabul" || P.vgOda !== r.id) return;
    const s = VG.durum(r); if (s.hasta !== "bekleme" || s.doktor === "gorusmede" || s.kopuk) { delete vgOto[r.id]; return; }
    if (!vgHastaCtx(r).tekTelefon) return;
    vgOto[r.id] ||= Date.now();
    if (Date.now() - vgOto[r.id] < 5000) return;
    if (VG.doktorKatil(r)) { P.toast = `${person(vgDoktor(r)).full} görüşmeye katıldı (demo).`; renderP(); renderH(); }
  }, 1000);
  // Yalnız hasta telefonu açıkken (ortak veri yok): çalışan ekranı görünmediği için onayı demo olarak 6 sn sonra çalışan adına ver.
  const otoOnay = {};
  setInterval(() => {
    if (!document.body.classList.contains("rol-hasta") || CAP.db) return;
    const r = P.request;
    if (!r || r.synthetic || r.status !== "bekliyor" || r.gun) return;
    otoOnay[r.id] ||= Date.now();
    if (Date.now() - otoOnay[r.id] < 6000) return;
    const pid = r.provider_id;
    (H.accepted[pid] ||= []).push({ reqId: r.id, date: r.date || DATE, lat: r.patient.lat, lon: r.patient.lon, start_min: r.arrival_min, duration_min: svc(r.service).duration_min, service_code: r.service, uzaktan: uzaktanHizmet(r.service), earn: r.price.provider_gets });
    const upd = { ...r, status: "kabul", accepted_at: Date.now() };
    putRequest(upd); P.request = upd; P.toast = `${person(pid).full} talebini onayladı (demo).`;
    renderP(); renderH();
  }, 1000);

  // ---------- bildirimler: zil + liste + uygulama içi afiş + kilitli telefonlar ----------
  // Olaylar 1 sn'de bir izlenir; her olay bir kez bildirilir (anahtarla). Hasta: onay, teklif, yola çıktı, yaklaşıyor, kapında,
  // mesaj, ziyaret başladı/bitti, ödeme. Çalışan: yeni talep, teklif isteği, randevu kesinleşti, yola çıkma zamanı, vardın,
  // hasta kodu onayladı, "Her şey yolunda mı?", kazanç, yeni değerlendirme. Prototip: gerçek anlık bildirim (push) yok.
  const BLD_EL = { p: { panel: "#panelP", afis: "#afisP", kilit: "#kilitP", zil: '[data-zil="p"]' }, h: { panel: "#panelH", afis: "#afisH", kilit: "#kilitH", zil: '[data-zil="h"]' } };
  let bldSayac = 0;
  function bildir(taraf, anahtar, o) {
    if (BLD_ANAHTAR[taraf].has(anahtar)) return;
    BLD_ANAHTAR[taraf].add(anahtar);
    const n = { id: "b" + ++bldSayac, t: Date.now(), okundu: false, ikon: "🔔", ...o };
    BLD[taraf].unshift(n); BLD[taraf].length = Math.min(BLD[taraf].length, 40);
    bldCiz(taraf, n);
  }
  const bldZaman = (t) => { const sn = (Date.now() - t) / 1000; return sn < 45 ? "şimdi" : sn < 3600 ? `${Math.round(sn / 60)} dk önce` : `${Math.round(sn / 3600)} sa önce`; };
  function bldKart(n, etiket, ek) {
    const ic = `<span class="bld-ikon" aria-hidden="true">${n.ikon}</span><span class="bld-govde"><span class="bld-ust"><span>ANINDA SAĞLIK</span><span>${bldZaman(n.t)}</span></span><b>${esc(n.baslik)}</b>${n.metin ? `<span class="bld-metin">${esc(n.metin)}</span>` : ""}</span>`;
    return etiket === "div" ? `<div class="bld-kart ${n.acil ? "acil" : ""} ${ek || ""}">${ic}</div>` : `<button type="button" class="bld-kart ${n.acil ? "acil" : ""} ${n.okundu ? "" : "okunmadi"} ${ek || ""}" ${etiket}="${n.id}">${ic}</button>`;
  }
  const bldAfisZaman = { p: null, h: null };
  function bldCiz(taraf, yeni) {
    const E = BLD_EL[taraf], L = BLD[taraf], okunmamis = L.filter((n) => !n.okundu).length;
    document.querySelectorAll(E.zil).forEach((zil) => {
      const rz = zil.querySelector(".zil-rozet"); if (rz) { rz.hidden = !okunmamis; rz.textContent = okunmamis > 9 ? "9+" : String(okunmamis); }
      zil.setAttribute("aria-label", okunmamis ? `Bildirimler, ${okunmamis} okunmamış` : "Bildirimler");
      if (yeni) { zil.classList.remove("salla"); void zil.offsetWidth; zil.classList.add("salla"); }
    });
    const panel = $(E.panel);
    if (panel && BLD_PANEL[taraf]) {
      panel.innerHTML = `<div class="bld-bas"><b>Bildirimler</b><span class="row" style="gap:6px">${okunmamis ? `<button class="btn gz-mini" type="button" data-bld-okundu="${taraf}">Tümünü okundu say</button>` : ""}<button class="btn gz-mini" type="button" data-bld-kapat="${taraf}">Kapat</button></span></div>
        <div class="bld-liste">${L.length ? L.map((n) => bldKart(n, "data-bld")).join("") : `<div class="bld-bos">Henüz bildirim yok.</div>`}</div>`;
    }
    const kilit = $(E.kilit);
    if (kilit) {
      kilit.innerHTML = `<div class="k-kilit">🔒</div><div class="k-saat">09:30</div><div class="k-tarih">16 Kasım Pazartesi</div>
        ${L.slice(0, 3).map((n) => bldKart(n, "data-kilit-bld", yeni && n === yeni ? "yeni" : "")).join("")}
        ${L.length > 3 ? `<div class="k-daha">+${L.length - 3} bildirim daha</div>` : ""}
        <div class="k-alt">${L.length ? "Bildirime dokun: uygulamada açılır" : "Bildirim gelince burada görünür"}</div>`;
      if (yeni) {
        kilit.classList.add("uyan"); const tel = kilit.closest(".phone"); tel.classList.remove("titre"); void tel.offsetWidth; tel.classList.add("titre");
        clearTimeout(kilit._t); kilit._t = setTimeout(() => kilit.classList.remove("uyan"), 4000);
      }
    }
    const afis = $(E.afis);
    if (afis && yeni && !BLD_PANEL[taraf]) {
      afis.innerHTML = bldKart(yeni, "div"); afis.classList.add("acik");
      clearTimeout(bldAfisZaman[taraf]); bldAfisZaman[taraf] = setTimeout(() => afis.classList.remove("acik"), 3800);
    }
  }
  function bldPanel(taraf, ac) {
    BLD_PANEL[taraf] = ac;
    const panel = $(BLD_EL[taraf].panel);
    if (panel) panel.hidden = !ac;
    document.querySelectorAll(BLD_EL[taraf].zil).forEach((z) => z.setAttribute("aria-expanded", String(ac)));
    if (ac) { const a = $(BLD_EL[taraf].afis); if (a) a.classList.remove("acik"); }
    bldCiz(taraf, null);
    if (ac && panel) { const b = panel.querySelector("[data-bld-kapat]"); if (b) b.focus(); }
  }
  function bldAc(taraf, id) {
    const n = BLD[taraf].find((x) => x.id === id); if (!n) return;
    n.okundu = true; bldPanel(taraf, false);
    const h = n.hedef || {};
    if (taraf === "p") {
      if (h.tur === "takip") { const r = REQ.find((x) => x.id === h.id) || P.request; if (r) { P.request = r; P.screen = "done"; } }
      else if (h.tur === "teklif" && P.yz) P.screen = "options";
      else if (h.tur === "home") P.screen = "home";
      renderP();
      if (h.tur === "takip") { const hedef = $("#pScreen .puan") || (h.kaydir && $(h.kaydir)); if (hedef) hedef.scrollIntoView({ block: "center" }); }
    } else {
      if (h.tur === "rota") { H.tab = "rota"; H.open = null; }
      else if (h.tur === "talep") { H.tab = "talepler"; H.open = inbox(H.pid).some((r) => r.id === h.id) ? h.id : null; }
      else if (h.tur === "talepler") { H.tab = "talepler"; H.open = null; }
      renderH();
    }
    bldCiz(taraf, null);
  }
  document.addEventListener("click", (e) => {
    const z = e.target.closest("[data-zil]"); if (z) { const t = z.dataset.zil; bldPanel(t, !BLD_PANEL[t]); return; }
    const k = e.target.closest("[data-bld-kapat]"); if (k) { bldPanel(k.dataset.bldKapat, false); return; }
    const o = e.target.closest("[data-bld-okundu]"); if (o) { BLD[o.dataset.bldOkundu].forEach((n) => (n.okundu = true)); bldCiz(o.dataset.bldOkundu, null); return; }
    const b = e.target.closest("[data-bld]"); if (b) { bldAc(b.closest("#panelP") ? "p" : "h", b.dataset.bld); return; }
    const kb = e.target.closest("[data-kilit-bld]");
    if (kb) { const t = kb.closest("#kilitP") ? "p" : "h"; bldAc(t, kb.dataset.kilitBld); const tel = $(t === "p" ? "#colP .phone" : "#colH .phone"); if (tel) { tel.scrollIntoView({ block: "nearest", behavior: "smooth" }); tel.classList.remove("titre"); void tel.offsetWidth; tel.classList.add("titre"); } }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") ["p", "h"].forEach((t) => BLD_PANEL[t] && bldPanel(t, false)); });

  function takipAdimi(r) {
    if (!MAP || r.gun || r.status !== "kabul" || uzaktanMi(r)) return { adim: -1 };
    const T = takipVerisi(r), d = takipDurumu(T, r), np = MAP.rotaNoktasi(T.rt, d.f);
    return { T, adim: d.adim === 1 && np.kmLeft < 1 ? 2 : d.adim, kalan: d.adim <= 2 ? Math.max(1, Math.ceil((1 - d.f) * T.yolDk + T.park)) : 0 };
  }
  function bildirimIzle() {
    // ---- hasta ----
    const r = P.request;
    if (r && !r.synthetic) {
      const pp = person(r.provider_id), id = r.id, git = { tur: "takip", id };
      if (r.status === "kabul") bildir("p", id + ":kabul", { ikon: "✅", baslik: "Randevun kesinleşti", metin: `${pp.full} · ${gunEki(r)}${C.hhmm(r.arrival_min)} · ${tl(r.price.patient_pays)} TL`, hedef: git });
      if (r.status === "red") bildir("p", id + ":red", { ikon: "↩️", baslik: "Sağlık çalışanı uygun değil", metin: "Sana başka seçenekler gösterelim.", hedef: git });
      if (vgVar(r) && r.status === "kabul") { const s = VG.durum(r), dk = person(vgDoktor(r));
        if (VG.acikMi(r) && !VG.bitti(s)) bildir("p", id + ":vg-oda", { ikon: "🎥", baslik: "Görüşme odası açıldı", metin: `${dk.full} ile görüntülü görüşmen · ${C.hhmm(r.vgBaslangic ?? r.arrival_min)}`, hedef: git });
        if (s.durum === "tamamlandi") bildir("p", id + ":vg-bitti", { ikon: "✅", baslik: "Görüntülü görüşme tamamlandı", metin: `${dk.full} görüşmeyi tamamladı.`, hedef: git }); }
      const ta = takipAdimi(r);
      if (ta.adim >= 1) bildir("p", id + ":yolda", { ikon: ta.T.toplu ? "🚌" : "🚗", baslik: `${pp.first} yola çıktı`, metin: `${neyleGeliyor(ta.T).replace(/<[^>]+>/g, "")} · tahmini varış ${C.hhmm(r.arrival_min)}`, hedef: git });
      if (ta.adim >= 2) bildir("p", id + ":yakin", { ikon: "📍", baslik: `${pp.first} yaklaşıyor`, metin: `1 km'den az kaldı${ta.kalan ? ` · ~${ta.kalan} dk` : ""}.`, hedef: git });
      if (ta.adim >= 3) bildir("p", id + ":kapida", { ikon: "🚪", baslik: `${pp.first} kapında`, metin: "Kapıyı açmadan önce uygulamada kodu ve fotoğrafı doğrula.", hedef: { ...git, kaydir: "#gzHasta" } });
      (r.mesajlar || []).forEach((m, i) => bildir("p", `${id}:m${i}`, { ikon: "💬", baslik: pp.full, metin: m.metin, hedef: git }));
      const gs = G.durum(r) || {};
      if (gs.checkin) bildir("p", id + ":basladi", { ikon: "🩺", baslik: "Ziyaret başladı", metin: "Güvenli Ziyaret açık. Bir sorun olursa uygulamadan bildirebilirsin.", hedef: git });
      if (gs.checkout) bildir("p", id + ":bitti", { ikon: "⭐", baslik: "Ziyaret bitti", metin: "Hizmet tamamlandı mı? Onayla ve puan ver.", hedef: git });
      if (gs.hastaOnay === "tamam") bildir("p", id + ":odeme", { ikon: "💳", baslik: "Ödeme onaylandı", metin: `${tl(r.price.patient_pays)} TL (demo; gerçek ödeme alınmadı).`, hedef: git });
      if (r.puan) bildir("p", id + ":puan", { ikon: "🙏", baslik: "Teşekkürler!", metin: `Puanın ${pp.first}'in profiline eklendi.`, hedef: git });
    }
    if (P.yz && P.yz.plan && P.screen === "options") {
      for (const x of teklifDurumu(P.yz).satirlar) if (x.geldi && x.verir) bildir("p", `${P.yz.key}:t:${x.pid}`, { ikon: "💰", baslik: "Yeni teklif geldi", metin: `${person(x.pid).full} · hizmet ${tl(x.fiyat)} TL`, hedef: { tur: "teklif" } });
    }
    // ---- sağlık çalışanı ----
    const pid = H.pid; if (!pid) return;
    for (const q of inbox(pid)) if (!q.synthetic) bildir("h", q.id + ":yeni", { ikon: "🔔", baslik: "Yeni talep", metin: `${svc(q.service).name_tr} · ${q.patient.district} · ${gunEki(q)}${C.hhmm(q.arrival_min)} · +${tl(q.price.provider_gets)} TL`, hedef: { tur: "talep", id: q.id } });
    if (P.yz && P.yz.plan) {
      const d = teklifDurumu(P.yz), secilen = [...P.yz.plan.secilen, ...(d.ikinci ? P.yz.plan.tur2.secilen : [])];
      const ak = `${P.yz.key}:istek:${pid}`;
      if (!BLD_ANAHTAR.h.has(ak) && secilen.some((a) => a.pid === pid)) {
        let ad = "Ev ziyareti"; try { ad = svc(decide().t.services[0]).name_tr; } catch (e) { /* yok */ }
        bildir("h", ak, { ikon: "📨", baslik: "Teklif isteği", metin: `${ad} · ${P.info.district} · önerilen ${tl(P.yz.plan.oneri.fiyat)} TL`, hedef: { tur: "talepler" } });
      }
    }
    const v = siradakiZiyaret(pid);
    if (v) {
      const vid = v.id, git = { tur: "rota" };
      bildir("h", vid + ":h-kesin", { ikon: "📅", baslik: "Randevu kesinleşti", metin: `${svc(v.service).name_tr} · ${C.hhmm(v.arrival_min)} · ${v.patient.district || "İzmir"}`, hedef: git });
      const tav = MAP && !v.gun ? (() => { const T = takipVerisi(v), d = takipDurumu(T, v); return { T, adim: d.adim }; })() : null;
      if (tav) {
        const cikis = v.arrival_min - tav.T.yolDk - tav.T.park;
        bildir("h", vid + ":h-cik", { ikon: tav.T.toplu ? "🚌" : "🚗", baslik: "Yola çıkma zamanı", metin: `${tav.T.toplu ? `Toplu taşımayla: ${TOPLU.ozet(tav.T.rt)}` : "Araçla"} · yola çıkış ${cikis <= SIMDI + 1 ? "hemen" : C.hhmm(cikis)} · ~${tav.T.yolDk + tav.T.park} dk`, hedef: git });
        if (tav.adim >= 3) bildir("h", vid + ":h-vardin", { ikon: "🚪", baslik: "Vardın", metin: "Kapı kodunu uygulamada gör ve hastaya söyle.", hedef: git });
      }
      const s = !v.synthetic ? G.durum(v) : null;
      if (s) {
        if (s.kodDurum === "eslesti") bildir("h", vid + ":h-kod", { ikon: "✅", baslik: "Hasta kodu onayladı", metin: "Ziyareti başlatabilirsin (check-in).", hedef: git });
        if (s.kontrol) bildir("h", `${vid}:h-kontrol:${s.kontrolSayisi}`, { ikon: "🛡️", acil: true, baslik: "Her şey yolunda mı?", metin: "PIN ile yanıtla. Yanıt yoksa güvenlik masası seni arar.", hedef: git });
        if (s.checkout) bildir("h", vid + ":h-kazanc", { ikon: "💸", baslik: "Kazanç eklendi", metin: `+${tl(v.price ? v.price.provider_gets : 0)} TL (demo)`, hedef: git });
      }
    }
    for (const q of hTele(pid)) { const s = VG.durum(q);
      if ((s.hasta === "bekleme" || s.hasta === "hazirlik") && s.doktor !== "gorusmede" && !VG.bitti(s)) bildir("h", q.id + ":vg-bekliyor", { ikon: "🎥", baslik: "Hasta görüşmede bekliyor", metin: `Görüntülü görüşme · ${C.hhmm(q.vgBaslangic ?? q.arrival_min)}`, hedef: { tur: "rota" } }); }
    // tamamlanan ziyaretler için kazanç (sıradaki ziyaret değişse de)
    const gr = gzR(); const gs2 = gr && G.durum(gr);
    if (gs2 && gs2.checkout) bildir("h", gr.id + ":h-kazanc", { ikon: "💸", baslik: "Kazanç eklendi", metin: `+${tl(gr.price.provider_gets)} TL (demo)`, hedef: { tur: "rota" } });
    if (gs2 && gs2.kontrol) bildir("h", `${gr.id}:h-kontrol:${gs2.kontrolSayisi}`, { ikon: "🛡️", acil: true, baslik: "Her şey yolunda mı?", metin: "PIN ile yanıtla. Yanıt yoksa güvenlik masası seni arar.", hedef: { tur: "rota" } });
    // Tek tek puan bildirilmez (hangi hastanın kaç yıldız verdiği anlaşılmasın); yalnızca toplu özet yayımlanınca
    { const n = yayindaPuanlar(pid).length; if (n) bildir("h", `${pid}:puan-ozet:${n}`, { ikon: "⭐", baslik: "Değerlendirme özetin güncellendi", metin: `${PUAN_TOPLU} yeni değerlendirme ortalamana eklendi: ★ ${puanOrtalama(pid).ort.toFixed(2).replace(".", ",")}`, hedef: { tur: "rota" } }); }
    // genel
    if (DG.state && DG.state.status === "onaylandi") bildir("h", `${pid}:dg-onay`, { ikon: "🎓", baslik: "Mesleki başvurun onaylı (demo)", metin: "Artık görev kabul edebilirsin.", hedef: { tur: "talepler" } });
    if (!BLD_ANAHTAR.h.has(`${pid}:gunaydin`)) {
      const gun = hStops(pid), sira = gun.find((x) => x.start_min >= SIMDI);
      bildir("h", `${pid}:gunaydin`, { ikon: "☀️", baslik: "Günaydın!", metin: gun.length ? `Bugün ${gun.length} ziyaretin var${sira ? `; sıradaki ${C.hhmm(sira.start_min)}` : ""}.` : "Bugün henüz ziyaretin yok. Saatlerini açarsan talep gelir.", hedef: { tur: "rota" } });
    }
  }
  setTimeout(() => {
    bildir("p", "hosgeldin", { ikon: "👋", baslik: "anında sağlık'a hoş geldin", metin: "Ne olduğunu konuşarak ya da yazarak anlat; fiyatı seçmeden önce görürsün.", hedef: { tur: "home" } });
    bildir("p", "guvenli", { ikon: "🛡️", baslik: "Güvenli Ziyaret", metin: "Gelen kişiyi kapıda kod ve fotoğrafla doğrularsın; konum yalnızca ziyaret sırasında paylaşılır.", hedef: { tur: "home" } });
    bildirimIzle(); setInterval(bildirimIzle, 1000);
  }, 1500);
  ["p", "h"].forEach((t) => bldCiz(t, null));
  window.KapidaBildirim = { liste: (t) => BLD[t].map((n) => n.baslik), ac: (t) => bldPanel(t, true) };
  setInterval(() => ["p", "h"].forEach((t) => { const k = $(BLD_EL[t].kilit); if (k) k.querySelectorAll(".bld-ust span:last-child").forEach((sp, i) => { const n = BLD[t][i]; if (n) sp.textContent = bldZaman(n.t); }); }), 15000);

  // Yalnız hasta telefonu: kapı kodu eşleşince çalışan adına demo check-in (3 sn), kısa bir ziyaret (8 sn) ve çıkış.
  // Böylece tek telefonda da "tamamlandı → puanla" adımına gelinir. Çalışan ekranı açıkken (#ikisi) bunu çalışan yapar.
  const otoZiyaret = {};
  const gzTikla = (gz, v) => G.onClick({ target: { closest: () => ({ dataset: { gz, v } }) } }, P.request);
  setInterval(() => {
    if (!document.body.classList.contains("rol-hasta") || CAP.db) return;
    const r = P.request, s = r && r.status === "kabul" && !r.gun ? G.durum(r) : null;
    if (!s) return;
    const z = (otoZiyaret[r.id] ||= {});
    if (s.kodDurum === "eslesti" && !s.checkin) { z.kod ||= Date.now(); if (Date.now() - z.kod > 3000 && gzTikla("checkin")) { P.toast = `${person(r.provider_id).first} ziyareti başlattı (demo).`; renderP(); renderH(); } }
    else if (s.checkin && !s.checkout) { z.giris ||= Date.now(); if (Date.now() - z.giris > 8000) { gzTikla("cikis"); if (gzTikla("cikis-sec", "yok")) { P.toast = "Ziyaret bitti (demo)."; renderP(); renderH(); } } }
  }, 1000);

  // ---------- demo hesapları: hasta ve sağlık çalışanı (prototip; gerçek kimlik doğrulama yok, şifre sunucuya gitmez) ----------
  const HESAPLAR = {
    hasta: { kullanici: "hasta", sifre: "1234", ad: "Ayşe Demir", aciklama: "Hasta yakını · Bornova", ilce: "Bornova" },
    calisan: { kullanici: "hemsire", sifre: "1234", ad: person("HEM-12").full, aciklama: "Hemşire · HEM-12 · mesleki başvurusu onaylı (demo)", pid: "HEM-12", prof: "hemsire" },
    doktor: { kullanici: "doktor", sifre: "1234", ad: person("HEK-02").full, aciklama: "Pratisyen hekim · HEK-02 · Bayraklı · mesleki başvurusu onaylı (demo)", pid: "HEK-02", prof: "hekim", hekimType: "pratisyen" },
  };
  function hastaGir() { P.info.district = HESAPLAR.hasta.ilce; adresDefteriYukle(HESAPLAR.hasta.kullanici, true); hastaProfiliYukle(HESAPLAR.hasta.kullanici, { ad: HESAPLAR.hasta.ad }); }
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
  // ---------- Profil olayları ----------
  function veriIndir(ad, veri) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 2)], { type: "application/json" }));
    a.download = ad; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const cikisYap = () => $("#cikisBtn").click();
  // Form hatası: ekranı yeniden çizmeden yaz (kullanıcının yazdıkları kaybolmasın)
  const hataYaz = (sec, m) => { const el = $(sec); if (el) { el.textContent = m; el.scrollIntoView({ block: "nearest" }); } };
  const tarihNow = () => new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  function secimUygula(ad, deger, taraf) {
    if (ad === "yazi" || ad === "tema") { GORUNUM[ad] = deger; yerel.yaz("anindasaglik_gorunum", GORUNUM); gorunumUygula(); }
    else if (ad === "odeme") { PR.h.odeme = deger; hastaProfiliYaz(); }
    else if (ad === "yakinlik") P.yakinTaslak = deger;
    renderP(); renderH();
  }
  function anahtarUygula(id) {
    const [k, alan] = id.split(/\.(.+)/);
    if (k === "p") { if (alan === "sesliOku") P.voice = !P.voice; else { PR.h.bildirim[alan] = !PR.h.bildirim[alan]; hastaProfiliYaz(); } renderP(); return; }
    const cp = calisanProfili(H.pid);
    if (k === "h") { if (alan === "cevrimici") { cp.cevrimici = !cp.cevrimici; H.toast = cp.cevrimici ? "Çevrimiçisin; yeni talepler gelir." : "Çevrimdışısın; yeni talep almıyorsun."; } else cp.bildirim[alan] = !cp.bildirim[alan]; }
    else if (k === "hz") { const i = cp.kapaliHizmet.indexOf(alan); if (i >= 0) cp.kapaliHizmet.splice(i, 1); else cp.kapaliHizmet.push(alan); }
    calisanProfiliYaz(H.pid); P.saatler = null; renderH(); renderP();
  }
  $("#pScreen").addEventListener("click", (e) => {
    const t = e.target.closest("[data-profil],[data-secim],[data-anahtar],[data-yakin-sil],[data-act]"); if (!t) return;
    if (t.dataset.profil) { P.screen = "profil"; P.profilBolum = t.dataset.profil; P.profilHata = ""; renderP(); $("#pScreen").scrollTop = 0; return; }
    if (t.dataset.secim) { secimUygula(t.dataset.secim, t.dataset.deger, "p"); return; }
    if (t.dataset.anahtar) { anahtarUygula(t.dataset.anahtar); return; }
    if (t.dataset.yakinSil) { PR.h.yakinlar.splice(+t.dataset.yakinSil, 1); hastaProfiliYaz(); renderP(); return; }
    const a = t.dataset.act, v = (id) => (($("#" + id) || {}).value || "").trim();
    if (a === "profil") { P.screen = "profil"; P.profilBolum = null; P.adresSec = false; P.silOnay = false; renderP(); $("#pScreen").scrollTop = 0; }
    else if (a === "pprofilGeri") { P.profilBolum = null; P.profilHata = ""; P.silOnay = false; renderP(); }
    else if (a === "kisiselKaydet") {
      if (!v("prAd")) { hataYaz("#prHata", "Adını yaz."); return; }
      if (v("prTel") && !telGecerli(v("prTel"))) { hataYaz("#prHata", "Telefon 05 ile başlayan 11 haneli olmalı."); return; }
      if (v("prEposta") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("prEposta"))) { hataYaz("#prHata", "E-posta adresini kontrol et."); return; }
      Object.assign(PR.h, { ad: v("prAd"), telefon: v("prTel"), eposta: v("prEposta") }); hastaProfiliYaz(); P.profilBolum = null; P.profilHata = ""; P.toast = "Bilgilerin kaydedildi."; renderP();
    } else if (a === "yakinEkle") { PR.h.yakinlar.push({ yakinlik: P.yakinTaslak || "Annem", ad: v("prYakinAd") }); hastaProfiliYaz(); P.toast = "Yakının eklendi."; renderP(); }
    else if (a === "acilKaydet") {
      if (v("prAcilTel") && !telGecerli(v("prAcilTel"))) { hataYaz("#prHata", "Telefon 05 ile başlayan 11 haneli olmalı."); return; }
      if (v("prAcilAd") && !v("prAcilTel")) { hataYaz("#prHata", "Acil durum kişisinin telefonunu da yaz."); return; }
      PR.h.acil = { ad: v("prAcilAd"), yakinlik: v("prAcilYakin"), telefon: v("prAcilTel") }; hastaProfiliYaz(); P.profilBolum = null; P.profilHata = ""; P.toast = "Acil durum kişin kaydedildi."; renderP();
    } else if (a === "pdestek") { if (!v("pDestekMetin")) return; PR.h.destek.push({ tarih: tarihNow(), metin: v("pDestekMetin").slice(0, 600) }); hastaProfiliYaz(); P.toast = "Mesajın alındı (prototip: bu cihazda saklandı)."; renderP(); }
    else if (a === "pveriIndir") veriIndir("anindasaglik_verilerim.json", { profil: PR.h, adresler: AB.liste, gorunum: GORUNUM, randevular: (P.randevular || []).length });
    else if (a === "sohbetSil") { P.msgs = []; P.turns = []; P.report = null; P.photos = []; P.toast = "Bu oturumdaki sohbet silindi."; renderP(); }
    else if (a === "phesapSil") { P.silOnay = true; renderP(); }
    else if (a === "phesapSilHayir") { P.silOnay = false; renderP(); }
    else if (a === "phesapSilEvet") { try { localStorage.removeItem("anindasaglik_profil_" + PR.hesap); localStorage.removeItem(adresAnahtar()); } catch (er) { /**/ } cikisYap(); }
    else if (a === "cikisYap") cikisYap();
  });
  $("#hScreen").addEventListener("click", (e) => {
    const t = e.target.closest("[data-hprofil],[data-secim],[data-anahtar],[data-act]"); if (!t) return;
    if (t.dataset.hprofil) { H.profilBolum = t.dataset.hprofil; H.profilHata = ""; renderH(); $("#hScreen").scrollTop = 0; return; }
    if (t.dataset.secim) { secimUygula(t.dataset.secim, t.dataset.deger, "h"); return; }
    if (t.dataset.anahtar) { anahtarUygula(t.dataset.anahtar); return; }
    const a = t.dataset.act, v = (id) => (($("#" + id) || {}).value || "").trim(), cp = calisanProfili(H.pid);
    if (a === "hprofil") { H.profil = true; H.profilBolum = null; H.silOnay = false; renderH(); $("#hScreen").scrollTop = 0; }
    else if (a === "hprofilKapat") { H.profil = false; renderH(); }
    else if (a === "hprofilGeri") { H.profilBolum = null; H.profilHata = ""; H.silOnay = false; renderH(); }
    else if (a === "hCevrimiciOl") { cp.cevrimici = true; calisanProfiliYaz(H.pid); renderH(); renderP(); }
    else if (a === "hSaatlerim") { H.profil = false; H.tab = "saat"; H.open = null; renderH(); }
    else if (a === "hBasvuru") { H.profil = false; DG.state.open = true; renderH(); }
    else if (a === "hGuvenlikKaydet") {
      const pin = v("hrPin"), baski = v("hrBaski");
      if (pin || baski) {
        if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(baski)) { hataYaz("#hrHata", "PIN ve baskı PIN'i 4 rakam olmalı."); return; }
        if (pin === baski) { hataYaz("#hrHata", "Baskı PIN'i normal PIN'den farklı olmalı."); return; }
        if (/^(\d)\1{3}$|^(0123|1234|2345|3456|4567|5678|6789)$/.test(pin)) { hataYaz("#hrHata", "Tahmin edilmesi kolay bir PIN seçme (1111, 1234 gibi)."); return; }
        cp.pin = pin; cp.baskiPin = baski;
      }
      if (v("hrAcilTel") && !telGecerli(v("hrAcilTel"))) { hataYaz("#hrHata", "Telefon 05 ile başlayan 11 haneli olmalı."); return; }
      cp.acil = { ad: v("hrAcilAd"), telefon: v("hrAcilTel"), yakinlik: "" };
      calisanProfiliYaz(H.pid); H.profilBolum = null; H.profilHata = ""; H.toast = "Güvenli Ziyaret ayarların kaydedildi."; renderH();
    } else if (a === "hPinSifirla") { cp.pin = ""; cp.baskiPin = ""; calisanProfiliYaz(H.pid); H.toast = "Demo PIN'lerine dönüldü (2580 / 0852)."; renderH(); }
    else if (a === "hdestek") { if (!v("hDestekMetin")) return; cp.destek.push({ tarih: tarihNow(), metin: v("hDestekMetin").slice(0, 600) }); calisanProfiliYaz(H.pid); H.toast = "Mesajın alındı (prototip: bu cihazda saklandı)."; renderH(); }
    else if (a === "hveriIndir") { const kopya = JSON.parse(JSON.stringify(cp)); if (kopya.pin) kopya.pin = kopya.baskiPin = "(gizli)"; veriIndir("anindasaglik_calisan_verilerim.json", { profil: kopya, gorunum: GORUNUM }); }
    else if (a === "hhesapSil") { H.silOnay = true; renderH(); }
    else if (a === "hhesapSilHayir") { H.silOnay = false; renderH(); }
    else if (a === "hhesapSilEvet") { try { localStorage.removeItem("anindasaglik_calisan_" + H.pid); } catch (er) { /**/ } cikisYap(); }
    else if (a === "cikisYap") cikisYap();
  });
  $("#cikisBtn").addEventListener("click", () => { history.replaceState(null, "", location.pathname + location.search.replace(/[?&]rol=[^&]*/, "")); location.reload(); });
  // Bağlantı #hasta / #calisan ile açıldıysa o hesapla doğrudan; değilse giriş ekranı
  { const h = (location.hash || "").replace("#", "") || new URLSearchParams(location.search).get("rol") || "";
    // "ham": giriş yapılmamış ham görünüm (otomatik testler; doğrulama akışı baştan)
    if (["hasta", "calisan", "doktor", "ikisi"].includes(h)) oturumAc(h); else if (h !== "ham") girisEkrani(); }

  // Otomatik testler için salt okunur durum görüntüsü (uygulamayı değiştirmez)
  window.KapidaTest = { durum: () => JSON.parse(JSON.stringify({ ekran: P.screen, mesgul: P.busy, mod: P.mode, plan: P.info.plan, kim: P.info.forWhom,
    mesajlar: P.msgs.map((m) => ({ kim: m.who, metin: m.text, araLaf: !!m.araLaf })), rapor: P.report, acil: P.emergency })),
    talep: () => (P.request ? JSON.parse(JSON.stringify(P.request.patient)) : null),
    // Görüntülü görüşme provası (web/e2e_goruntulu.py): aday listesi, takvim, oda durumu
    adaylar: (code, when) => C.findCandidates(repo, code, patientPoint(), DATE, when ?? 570, SORTS.onerilen[1], 50, 500, gercekSimdi()).candidates
      .map((c) => ({ pid: c.provider_id, varis: c.arrival_min, ins: !!c.insertion, yol: c.price.actual_travel ?? null, paylasim: c.price.saving || 0, toplam: c.price.patient_pays })),
    takvim: (pid) => JSON.parse(JSON.stringify(repo.scheduled[pid + "|" + DATE] || [])),
    rota: (pid) => hStops(pid).map((x) => ({ reqId: x.reqId || null, bas: x.start_min, uzaktan: !!x.uzaktan })),
    oda: (id) => { const r = vgIstek(id); return r ? JSON.parse(JSON.stringify({ ...VG.durum(r), olaylar: undefined, medya: VG.medyaAcik(), istek: { status: r.status, vgSonuc: r.vgSonuc || null, hekim: r.goruntuluHekim || null, vgBas: r.vgBaslangic ?? null } })) : null; },
    calisan: () => H.pid,
    // yalnızca otomatik testler: başka hastalardan gelmiş gibi sentetik puan ekler (toplu yayımlamayı denemek için)
    puanEkle: (pid, yildiz, etiket, yorum) => { (PUAN[pid] ||= []).unshift({ yildiz, etiketler: etiket ? [etiket] : [], yorum: yorum || "", reqId: "TEST" + Math.random(), hizmet: "kan_alma", saat: 600 });
      repo.providers[pid].rating = Math.round(puanOrtalama(pid).ort * 10) / 10; renderH(); } };
  // Prova kurulumu (yalnızca testler): seçilen hizmet için ilk (ya da verilen) adayla randevu oluşturur — arayüzdeki onay akışının aynısı (confirmBooking)
  window.KapidaTest.randevuKur = async (code, o = {}) => {
    P.info.plan = o.plan ? "var" : "bilinmiyor"; P.info.bed = !!o.yatakta;
    P.pt = patientPoint(); P.info.gun = 0; P.info.when = o.when ?? 570; P.sort = "onerilen";
    P.triage = { level: svc(code).category === "tele" ? (uzaktanHizmet(code) ? "TELE" : "TELE_HEMSIRE") : "PLANLI", services: [code] };
    P.report = cannedReport(code);
    const res = C.findCandidates(repo, code, P.pt, DATE, P.info.when, SORTS.onerilen[1], 50, 500, gercekSimdi());
    const c = o.pid ? res.candidates.find((x) => x.provider_id === o.pid) : res.candidates[0];
    if (!c) return null;
    P.cands = [c]; P.sheet = 0; await confirmBooking();
    return { id: P.request.id, pid: c.provider_id, varis: c.arrival_min, ins: !!c.insertion, hekim: P.request.goruntuluHekim || null, vgBas: P.request.vgBaslangic ?? null };
  };
  window.KapidaTest.saat = (v) => { VG.saatAyarla(v); renderP(); renderH(); };
  window.KapidaTest.calisanSec = (pid) => { H.pid = pid; H.open = null; H.tab = "rota"; renderH(); };
  if (AB.hesap === "misafir" && !AB.liste.length) adresDefteriYukle("misafir", false); // hesapla girildiyse hastaGir yükledi
  if (!PR.hesap) hastaProfiliYukle("misafir", null);
  renderP(); renderH();
  initCaps();
})();
