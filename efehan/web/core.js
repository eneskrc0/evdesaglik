// Evde Sağlık — çekirdek mantık (app/*.py ile birebir aynı davranış).
// DOM kullanmaz; hem tarayıcıda hem node'da çalışır.
(function (root) {
  "use strict";

  // ---------- text.py ----------
  const FOLD = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
  // Konuşma dilinde -yor'un r'si düşer: "alamıyo", "durmuyo", "yapıyom" (text.py _AGIZ)
  const AGIZ_EK = { "": "r", m: "rum", n: "rsun", z: "ruz", lar: "rlar" };
  // Ses tanıma bölmesi ("ala miyorum", "kana ma", "kay dı", "de gil") ve çift olumsuz ("yok değil" → "var"); text.py ile aynı
  const EK_BOLUNME = /(?<=[a-z]) (m[iu]yor\w*|ma|me|d[iu]|t[iu]|yor|yorum|yoruz)(?= )/g;
  const CIFT_OLUMSUZ = / (yok|degil) (degil|diyemem|diyemeyiz|denemez|sayilmaz)(?= )/g;
  function normalize(text) {
    let t = String(text).replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
    t = t.replace(/[çğıöşüâîû]/g, (c) => FOLD[c]);
    t = " " + t.replace(/[^a-z0-9;|]+/g, " ").trim() + " ";
    t = t.replace(/ de gil/g, " degil").replace(EK_BOLUNME, "$1").replace(CIFT_OLUMSUZ, " var");
    return t.replace(/(iyo|uyo)(m|n|z|lar)?(?= )/g, (_, a, b) => a + AGIZ_EK[b || ""]);
  }
  // Çok kelimeli anahtar: kelime ekleri ve araya en fazla bir kelime ("kanamasi hala durmuyor"); text.py has()
  const IFADE = {};
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function has(part, text) {
    if (!part.includes(" ")) return text.includes(" " + part);
    const rx = IFADE[part] || (IFADE[part] = new RegExp(" " + part.split(" ").filter(Boolean).map(esc).join("\\w* (?:\\w+ )?")));
    return rx.test(text);
  }
  // Olumsuzluk ve zaman (text.py clauses / match_live ile aynı)
  const YAN = /[.!?;,\n]+|\s(?:ama|fakat|ancak|lakin|şimdi|simdi|şu an|su an|bugün|bugun)\s/;
  const OLUMSUZ = new Set(["yok", "yoktu", "yoktur", "yokmus", "degil", "degildi", "degildir", "degilim", "olmadi", "olmamis",
    "gecirmedi", "gecirmemis", "olmuyor", "hissetmiyor", "yasanmiyor", "yasamadi", "yasamamis", "bayilmadi", "kusmadi", "kanamadi", "zehirlenmedi"]);
  const ESKI = / (gecen (yil|sene|ay)|(yil|yillar|sene|seneler|ay|aylar) once|eskiden|gecmiste|cocukken|gencken) /;
  const YOKLUK_BELIRTI = / (bilinc\w*|nefes\w*|nabz\w*|nabiz\w*|solunum\w*|tepki\w*|kendinde|yerinde degil|hareket\w*) (yok|degil|kalmadi)/;
  const SIMDI = / (simdi|su an|bugun|yine|tekrar|az once|demin|biraz once|hala) /;
  const CELISKI = / (aslinda|yani|galiba|sanki|biraz) (\w+ )?var | (yok|degil) var | var yok /;
  const SIMDI_DURUM = / (simdi|su an|su anda|artik|bugun) (\w+ ){0,2}(iyi|yok|gecti|normal|duzeldi|olmuyor|kalmadi)/;
  const ORGAN = new RegExp(" (gogu?s\\w*|gogs\\w*|diz\\w*|sirt\\w*|bel(i|im|in|inde|imde)?|bas(i|im|in|inda|imda|ina|ima)|kafa\\w*|" +
    "kol(u|um|lari|larim|unda|umda)?|bacak\\w*|bacag\\w*|ayak\\w*|ayag\\w*|karin\\w*|karn\\w*|mide\\w*|boyun\\w*|" +
    "boyn\\w*|omuz\\w*|omz\\w*|kalca\\w*|dis(i|im|leri|lerim)|kulak\\w*|kulag\\w*|goz\\w*|bogaz\\w*|" +
    "el(i|im|leri|lerim)|parmak\\w*|parmag\\w*|yuz(u|um|unde|umde)|agz\\w*|kasik\\w*|kasig\\w*) ");
  const eski = (n) => ESKI.test(n) && !SIMDI.test(n);
  function clauses(text) {
    const t = String(text).replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
    const out = [];
    for (const c of t.split(YAN)) {
      if (c === undefined) continue;
      const n = normalize(c);
      if (!n.trim()) continue;
      const neg = (n.split(" ").some((w) => OLUMSUZ.has(w)) && !YOKLUK_BELIRTI.test(n)) || eski(n);
      out.push([n, neg]);
    }
    return out;
  }
  const canli = (p, cl) => { const yer = cl.filter(([n]) => has(p, n)).map(([, neg]) => neg); return !yer.length || !yer.every(Boolean); };
  function matchLive(parsed, rawText) {
    const full = normalize(rawText), cl = clauses(rawText), celiski = CELISKI.test(full);
    for (const parts of parsed) {
      if (!parts.every((p) => has(p, full))) continue;
      if (celiski) return parts.join(" + ");
      // Her parça olumlu bir yan cümlede olmalı; söz düşmesinde organ taşınır ("göğsümde ağrı yok, baskı var") — text.py
      const olu = parts.filter((p) => !canli(p, cl));
      if (!olu.length) return parts.join(" + ");
      if (olu.every((p) => ORGAN.test(" " + p + " ")) &&
          cl.some(([n, neg]) => !neg && !ORGAN.test(n) && parts.some((p) => !olu.includes(p) && has(p, n)))) return parts.join(" + ");
    }
    return null;
  }
  // Yalnızca geçmiş zaman yüzünden sayılmayan eşleşme, şu anki durum söylenmediyse (text.py gecmis_eslesme)
  function gecmisEslesme(parsed, rawText) {
    const full = normalize(rawText);
    if (SIMDI_DURUM.test(full) || matchLive(parsed, rawText)) return null;
    const cl = clauses(rawText);
    for (const parts of parsed) {
      if (!parts.every((p) => has(p, full))) continue;
      if (cl.some(([n, neg]) => neg && eski(n) && !n.split(" ").some((w) => OLUMSUZ.has(w)) && parts.some((p) => has(p, n)))) return parts.join(" + ");
    }
    return null;
  }
  function parseKeywords(spec) {
    const alts = [];
    for (const alt of spec.split("|")) {
      const parts = alt.split(";").filter((p) => p.trim()).map((p) => normalize(p).trim());
      if (parts.length) alts.push(parts);
    }
    return alts;
  }
  function match(specOrParsed, normText) {
    const alts = typeof specOrParsed === "string" ? parseKeywords(specOrParsed) : specOrParsed;
    for (const parts of alts) {
      if (parts.every((p) => has(p, normText))) return parts.join(" + ");
    }
    return null;
  }

  // ---------- db.py ----------
  function Repo(data) {
    this.raw = data;
    setYol(data.yol || null);
    this.services = {};
    for (const s of data.services) {
      this.services[s.code] = {
        code: s.code, name_tr: s.name_tr, category: s.category, duration_min: s.duration_min,
        needs_physician_order: !!s.needs_physician_order, needs_prescription: !!s.needs_prescription,
        remote_possible: !!s.remote_possible, base_fee_tl: s.base_fee_tl,
      };
    }
    this.professions = {};
    for (const p of data.professions) this.professions[p.code] = p;
    this.profession_services = {};
    for (const r of data.profession_services) {
      (this.profession_services[r.profession_code] ||= new Set()).add(r.service_code);
    }
    this.red_flags = data.red_flags.map((r) => ({ ...r, parsed: parseKeywords(r.keywords) }));
    this.routes = data.complaint_routes.map((r) => ({
      ...r, parsed: parseKeywords(r.keywords), service_list: r.services.split("|"),
    }));
    this.intents = (data.profession_intents || []).map((r) => ({ ...r, parsed: parseKeywords(r.keywords) })); // öncelik sırasıyla (export)
    this.sources = {};
    for (const s of data.sources) this.sources[s.id] = s;
    this.providers = {};
    for (const p of data.providers) this.providers[p.id] = { ...p, licence_verified: !!p.licence_verified };
    this.provider_services = {};
    for (const r of data.provider_services) (this.provider_services[r.provider_id] ||= {})[r.service_code] = r.visits_done;
    this.availability = {};
    for (const r of data.availability) this.availability[r.provider_id + "|" + r.date] = [r.start_min, r.end_min];
    this.scheduled = {};
    for (const r of data.scheduled_visits) (this.scheduled[r.provider_id + "|" + r.date] ||= []).push({ ...r });
    this.patients = {};
    for (const p of data.patients) {
      this.patients[p.id] = { ...p, bedridden: !!p.bedridden, has_physician_plan: !!p.has_physician_plan };
    }
  }
  Repo.prototype.professionsFor = function (serviceCode) {
    const out = new Set();
    for (const [p, s] of Object.entries(this.profession_services)) if (s.has(serviceCode)) out.add(p);
    return out;
  };

  // ---------- triage.py ----------
  const DISCLAIMER = "Bu bir teşhis değildir; yönlendirmedir. Durum kötüleşirse ya da emin değilseniz 112'yi arayın.";
  const LEVEL_DEFAULT_SERVICE = { TELE: "tele_muayene", TELE_HEMSIRE: "tele_hemsire_destekli", HEKIM_EV: "ev_muayene" };
  const LEVEL_TEXT = {
    ACIL_112: "Acil: 112", ZEHIR_114: "Zehir danışma: 114", TELE: "Hekimle video görüşme",
    TELE_HEMSIRE: "Hemşire evde + hekim videoda", HEKIM_EV: "Hekim ev ziyareti",
    PLANLI: "Planlı ev hizmeti (hekim planına göre)",
  };
  const REMOTE_OK_ROUTES = new Set(["CR_RECETE", "CR_PSIKO"]);
  const PHYSICIANS = new Set(["hekim", "uzman_hekim"]);
  // Kullanıcı belirli bir meslek istiyor mu? (profession_intents; triage.py requested_profession)
  // Düzeltmeden sonra söylenen meslek geçerli; ses tanıma bölmesine karşı uzun anahtarlar boşluksuz da denenir (triage.py)
  const DUZELTME = / (aslinda|pardon|yok yok|hayir|yanlis soyledim|demek istedim|vazgectim|degil|yerine) /g;
  function meslekAra(repo, text) {
    for (const it of repo.intents) { const m = match(it.parsed, text); if (m) return [it, m]; }
    const sik = text.replace(/ /g, "");
    for (const it of repo.intents) for (const parts of it.parsed) {
      if (parts.every((p) => p.replace(/ /g, "").length >= 6 && sik.includes(p.replace(/ /g, "")))) return [it, parts.join(" + ")];
    }
    return [null, null];
  }
  function requestedProfession(repo, text) {
    const ds = [...text.matchAll(DUZELTME)];
    for (let i = ds.length - 1; i >= 0; i--) {
      const r = meslekAra(repo, text.slice(ds[i].index + ds[i][0].length - 1));
      if (r[0]) return r;
    }
    return meslekAra(repo, text);
  }
  const SAGLIK_KOK = ["agri", "agriy", "aci", "yara", "ates", "oksur", "hasta", "ilac", "tansiyon", "seker", "nefes", "gogus", "gogs",
    "bayil", "nobet", "kan ", "kanam", "dikis", "ameliyat", "igne", "serum", "pansuman", "sonda", "halsiz", "yorgun",
    "uyus", "sis", "kizar", "kasin", "idrar", "ishal", "kabiz", "kus", "dus", "yuruy", "felc", "inme", "kalp", "bobrek",
    "diyabet", "astim", "koah", "kanser", "demans", "alzheimer", "unutkan", "uyku", "uyuy", "istah", "kilo", "tahlil",
    "recete", "rahatsiz", "bas don", "bulanti", "mide", "karin", "bel ", "sirt", "diz", "kalca", "kol", "bacak", "ayak",
    "goz", "kulak", "isit", "konusma", "yutk", "yatalak", "yatag", "bakim", "lohusa", "dogum", "hamile", "bebek",
    "asi", "tedavi", "kontrol", "muayene", "olcum", "vital", "zehir", "alerji", "kasil", "titre", "terle", "morar",
    "sislik", "enfeksiyon", "iltihap", "akinti", "yanik", "kirik", "carp", "agzi", "yuzu", "bilinc", "kendinde", "tepki"];
  // Sağlık içeriği var mı? (rapor kapısı; meslek adı tek başına yetmez) — triage.py saglik_icerigi
  function saglikIcerigi(repo, raw) {
    const n = normalize(raw);
    if (repo.red_flags.some((rf) => match(rf.parsed, n)) || repo.routes.some((r) => match(r.parsed, n))) return true;
    return SAGLIK_KOK.some((k) => n.includes(" " + k));
  }
  const GECMIS_EK = [{ code: "GB_NEFES_DARLIGI", parsed: [["nefes darligi"], ["nefes darlik"]] }];
  // Sohbetin kullanıcı mesajları → acil, istenen meslek, şu an durumu sorulacak geçmiş belirtiler, sağlık içeriği (triage.py konusma_degerlendir)
  function konusmaDegerlendir(repo, mesajlar, patient) {
    const metin = mesajlar.join(". ");
    const t = triage(repo, metin, patient);
    const [it] = requestedProfession(repo, normalize(metin));
    const gecmis = t.is_emergency ? [] : [...repo.red_flags, ...GECMIS_EK].filter((rf) => gecmisEslesme(rf.parsed, metin)).map((rf) => rf.code);
    return { acil: t.is_emergency, level: t.level, message: t.message, red_flags: t.red_flags, reasons: t.reasons,
      meslek: it ? it.profession_code : null, gecmis, saglik: saglikIcerigi(repo, metin) };
  }
  function intentOnly(repo, it, m, patient) {
    const prof = it.profession_code, svc = it.default_service, name = repo.professions[prof].name_tr;
    const reasons = [`Meslek isteği '${name}' (eşleşen: ${m})`];
    let level, services;
    if (PHYSICIANS.has(prof)) { level = svc === "tele_muayene" ? "TELE" : "HEKIM_EV"; services = [svc]; }
    else if (patient.has_physician_plan) { level = "PLANLI"; services = [svc]; reasons.push("Hekim planı/reçetesi var: istenen meslek atanabilir (S07, S08)"); }
    else if (prof === "hemsire") { level = "TELE_HEMSIRE"; services = ["tele_hemsire_destekli"]; reasons.push("Hekim planı yok: hemşire evine gelir, hekim aynı anda görüntülü değerlendirir (S08, S14)"); }
    else { level = patient.bedridden ? "HEKIM_EV" : "TELE"; services = [LEVEL_DEFAULT_SERVICE[level]]; reasons.push(`Hekim planı yok: ${name} ancak hekim planıyla gelebilir; önce hekim (S08)`); }
    const src = new Set([it.source_id, "S08"]); if (level === "PLANLI") src.add("S07");
    return { level, services, message: `Önerilen: ${LEVEL_TEXT[level]}. ` + DISCLAIMER, red_flags: [], route: it.code, reasons,
      other_routes: [], sources: [...src].sort(), is_emergency: false, profession: prof };
  }
  function applyIntent(repo, res, it, m) {
    const prof = it.profession_code, name = repo.professions[prof].name_tr;
    res.profession = prof;
    res.reasons.push(`Meslek isteği '${name}' (eşleşen: ${m})`);
    if (PHYSICIANS.has(prof)) {
      const svc = it.default_service;
      res.level = svc === "tele_muayene" ? "TELE" : "HEKIM_EV"; res.services = [svc];
      res.reasons.push("Kullanıcı doktor istedi: hekim hizmeti");
      res.message = `Önerilen: ${LEVEL_TEXT[res.level]}. ` + DISCLAIMER;
      return res;
    }
    const offered = repo.profession_services[prof] || new Set();
    if (res.level === "PLANLI") {
      const mine = res.services.filter((s) => offered.has(s));
      if (mine.length) res.services = mine;
      else { res.profession = null; res.reasons.push(`${name} bu hizmeti vermiyor; şikâyete uygun meslek önerildi`); }
    } else if (prof === "hemsire" && res.level === "TELE") {
      res.level = "TELE_HEMSIRE"; res.services = ["tele_hemsire_destekli"];
      res.reasons.push("Hekim planı yok: hemşire evine gelir, hekim görüntülü bağlanır");
      res.message = `Önerilen: ${LEVEL_TEXT[res.level]}. ` + DISCLAIMER;
    } else res.reasons.push(`Hekim planı yok: ${name} ancak hekim planıyla gelebilir (S08)`);
    return res;
  }

  function triage(repo, complaint, patient) {
    const text = normalize(complaint);
    const hits = [];
    for (const rf of repo.red_flags) {
      const m = matchLive(rf.parsed, complaint);
      if (m) hits.push([rf, m]);
    }
    if (hits.length) {
      const urgent = hits.filter((h) => h[0].action === "112");
      const [rf] = (urgent.length ? urgent : hits)[0];
      const level = urgent.length ? "ACIL_112" : "ZEHIR_114";
      let msg = rf.message_tr;
      if (urgent.length && hits.some((h) => h[0].action === "114")) msg += " Zehirlenme şüphesini 112'ye söyleyin.";
      return {
        level, services: [], message: msg, red_flags: hits.map((h) => h[0].code), route: null,
        reasons: hits.map((h) => `Kırmızı bayrak '${h[0].name_tr}' (eşleşen: ${h[1]})`),
        other_routes: [], sources: [...new Set(hits.map((h) => h[0].source_id))].sort(),
        is_emergency: true, profession: null,
      };
    }
    const [it, im] = requestedProfession(repo, text);
    const matched = [];
    for (const r of repo.routes) {
      const m = match(r.parsed, text);
      if (m) matched.push([r, m]);
    }
    if (!matched.length && it) return intentOnly(repo, it, im, patient);
    if (!matched.length) {
      const level = patient.bedridden ? "TELE_HEMSIRE" : "TELE";
      return {
        level, services: [LEVEL_DEFAULT_SERVICE[level]],
        message: "Şikayetinizi bir hekimin değerlendirmesi en doğrusu. " + DISCLAIMER,
        red_flags: [], route: null,
        reasons: ["Bilinen bir şikayet kalıbı bulunamadı; güvenli varsayılan: hekim"],
        other_routes: [], sources: ["S14"], is_emergency: false, profession: null,
      };
    }
    const [route, m] = matched[0];
    const plan = patient.has_physician_plan;
    let level = plan ? route.level_with_plan : route.level_no_plan;
    const reasons = [`Şikayet kalıbı '${route.name_tr}' (eşleşen: ${m})`];
    let services;
    if (level === "PLANLI") {
      services = route.service_list;
      reasons.push("Hekim planı/reçetesi var: sağlık meslek mensubu atanabilir (S07, S08)");
    } else {
      if (!plan && route.level_with_plan === "PLANLI") reasons.push("Hekim planı yok: önce hekim değerlendirmesi gerekir (S08)");
      if (level === "TELE" && patient.bedridden && !REMOTE_OK_ROUTES.has(route.code)) {
        level = "TELE_HEMSIRE";
        reasons.push("Yatağa bağımlı hasta: hemşire evde ölçüm yapar, hekim videoda");
      }
      const doc = repo.profession_services["hekim"] || new Set();
      const routeDoc = route.service_list.filter((s) => doc.has(s));
      if (routeDoc.length && (level === "HEKIM_EV" || level === "TELE") &&
          (level !== "TELE" || repo.services[routeDoc[0]].remote_possible)) {
        services = routeDoc;
      } else {
        services = [LEVEL_DEFAULT_SERVICE[level]];
      }
    }
    const src = new Set([route.source_id, "S08"]);
    if (level === "PLANLI") src.add("S07");
    const res = {
      level, services, message: `Önerilen: ${LEVEL_TEXT[level]}. ` + DISCLAIMER,
      red_flags: [], route: route.code, reasons,
      other_routes: matched.slice(1).map((x) => x[0].code), sources: [...src].sort(), is_emergency: false, profession: null,
    };
    return it ? applyIntent(repo, res, it, im) : res;
  }

  // ---------- routing.py ----------
  const CFG = {
    CITY_SPEED_KMH: 25.0, PARKING_MIN: 5, ROAD_FACTOR: 1.3, LEAD_TIME_MIN: 30, MIN_SAVED_KM: 1.0,
    TRAVEL_TL_PER_KM: 12.0, COMMISSION: 0.10, SPLIT: { hasta: 0.5, saglikci: 0.3, platform: 0.2 },
    PRICE_SENSITIVITY: 3.0, SPEED_HORIZON_MIN: 480,
  };
  const rad = (d) => (d * Math.PI) / 180;
  function haversineKm(lat1, lon1, lat2, lon2) {
    const p1 = rad(lat1), p2 = rad(lat2), dp = p2 - p1, dl = rad(lon2 - lon1);
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * 6371.0 * Math.asin(Math.sqrt(a));
  }
  const roadKm = (a, b) => haversineKm(a[0], a[1], b[0], b[1]) * CFG.ROAD_FACTOR;
  const travelMin = (km) => (km === 0 ? 0 : Math.ceil((km / CFG.CITY_SPEED_KMH) * 60) + CFG.PARKING_MIN);
  // İzmir yol paketi (routing.py YOL ile aynı): Enes'in OSM süre matrisi + TomTom 2025 trafik eğrisi
  let YOL = null;
  const noktaAnahtari = (lat, lon) => lat.toFixed(6) + "," + lon.toFixed(6);
  function setYol(p) {
    if (!p) { YOL = null; return; }
    const bin = atob(p.tt_sn_b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const tt = new Uint16Array(u8.length / 2), dv = new DataView(u8.buffer);
    for (let i = 0; i < tt.length; i++) tt[i] = dv.getUint16(2 * i, true);
    const idx = new Map(p.noktalar.map(([a, b], i) => [noktaAnahtari(a, b), i]));
    let toplu = null;
    if (p.toplu) { // Enes'in GTFS toplu taşıma süreleri: 4 dilim × n × n, tam dakika (uint8) — routing.py ile aynı
      const tb = atob(p.toplu.dk_b64), dk = new Uint8Array(tb.length);
      for (let i = 0; i < tb.length; i++) dk[i] = tb.charCodeAt(i);
      toplu = { dk, bitis: p.toplu.dilim_bitis };
    }
    YOL = { n: p.noktalar.length, tt, tt10: p.trafik.tt10_dk, ff10: p.trafik.ff10_dk, park: p.trafik.park_dk, idx, paket: p, toplu };
  }
  function trafikKatsayisi(m) {
    const x = (((m / 60 - 0.5) % 24) + 24) % 24, i = Math.floor(x), f = x - i, t = YOL.tt10;
    return (t[i] * (1 - f) + t[(i + 1) % 24] * f) / YOL.ff10;
  }
  function topluDilim(m) {
    m = ((m % 1440) + 1440) % 1440;
    const e = YOL.toplu.bitis;
    for (let i = 0; i < e.length - 1; i++) if (m < e[i]) return i;
    return e.length - 1;
  }
  // mode "toplu": kapıdan kapıya toplu taşıma süresi (yürüme + bekleme + araç + aktarma + bina)
  function travel(a, b, depart, mode) {
    if (YOL) {
      const ia = YOL.idx.get(noktaAnahtari(a[0], a[1])), ib = YOL.idx.get(noktaAnahtari(b[0], b[1]));
      if (ia !== undefined && ib !== undefined) {
        if (ia === ib) return 0;
        if (mode === "toplu" && YOL.toplu) return YOL.toplu.dk[topluDilim(depart) * YOL.n * YOL.n + ia * YOL.n + ib];
        return Math.ceil(YOL.park + (YOL.tt[ia * YOL.n + ib] / 60) * trafikKatsayisi(depart));
      }
    }
    return travelMin(roadKm(a, b));
  }
  // En yakın acil servisler (yol süresi, verilen saatte; park payı yok)
  function yakinAcil(lat, lon, depart) {
    if (!YOL) return [];
    const i = YOL.idx.get(noktaAnahtari(lat, lon));
    if (i === undefined) return [];
    return YOL.paket.en_yakin_acil[i].map(([h, sn]) => ({ ...YOL.paket.hastaneler[h], dk: Math.max(1, Math.round((sn / 60) * trafikKatsayisi(depart))) }));
  }
  const round2 = (x) => Math.round(x * 100) / 100;

  function bestInsertion(home, window, stops, target, duration, earliest, mode) {
    const [start, end] = window;
    const points = [{ loc: home, ready: start }];
    for (const s of stops) points.push({ loc: [s.lat, s.lon], start: s.start_min, ready: s.start_min + s.duration_min });
    const standalone = 2 * roadKm(home, target);
    let best = null;
    for (let i = 0; i < points.length; i++) {
      const prev = points[i];
      const nxt = i + 1 < points.length ? points[i + 1] : null;
      const nxtLoc = nxt ? nxt.loc : home;
      const deadline = nxt ? nxt.start : end;
      const d1 = roadKm(prev.loc, target), d2 = roadKm(target, nxtLoc);
      const arrival = Math.max(prev.ready + travel(prev.loc, target, prev.ready, mode), earliest);
      const finish = arrival + duration;
      if (finish + travel(target, nxtLoc, finish, mode) > deadline) continue;
      const added = d1 + d2 - roadKm(prev.loc, nxtLoc);
      const cand = {
        arrival_min: arrival, added_km: round2(added), standalone_km: round2(standalone), position: i,
        shared: stops.length > 0 && standalone - added >= CFG.MIN_SAVED_KM,
      };
      if (!best || cand.added_km < best.added_km || (cand.added_km === best.added_km && cand.arrival_min < best.arrival_min)) best = cand;
    }
    return best;
  }

  function priceVisit(baseFee, mult, ins) {
    const fee = baseFee * mult;
    if (!ins) return { service_fee: fee, patient_pays: fee, provider_gets: fee * (1 - CFG.COMMISSION), platform_gets: fee * CFG.COMMISSION, patient_saving: 0 };
    const standaloneCost = ins.standalone_km * CFG.TRAVEL_TL_PER_KM;
    const actualCost = ins.added_km * CFG.TRAVEL_TL_PER_KM;
    const saving = Math.max(0, standaloneCost - actualCost);
    return {
      service_fee: fee,
      patient_pays: fee + standaloneCost - CFG.SPLIT.hasta * saving,
      provider_gets: fee * (1 - CFG.COMMISSION) + actualCost + CFG.SPLIT.saglikci * saving,
      platform_gets: fee * CFG.COMMISSION + CFG.SPLIT.platform * saving,
      patient_saving: CFG.SPLIT.hasta * saving,
      standalone_travel: standaloneCost, actual_travel: actualCost, saving,
    };
  }

  // ---------- matching.py ----------
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  function competenceScore(visits, years, rating) {
    const v = Math.min(1, Math.log1p(visits) / Math.log1p(200));
    const y = Math.min(1, years / 20);
    const r = Math.max(0, Math.min(1, (rating - 3.5) / 1.5));
    return 0.5 * v + 0.3 * y + 0.2 * r;
  }
  function normPrefs(p) {
    const s = p.yetkinlik + p.fiyat + p.hiz;
    if (s <= 0) return [1 / 3, 1 / 3, 1 / 3];
    return [p.yetkinlik / s, p.fiyat / s, p.hiz / s];
  }

  function findCandidates(repo, serviceCode, patient, date, nowMin, prefs, maxKm = 20, topK = 5) {
    prefs = prefs || { yetkinlik: 1, fiyat: 1, hiz: 1 };
    const svc = repo.services[serviceCode];
    const notes = [];
    if (svc.needs_physician_order && !patient.has_physician_plan) {
      notes.push(`'${svc.name_tr}' hekim planı/reçetesi ister; hastanın planı yok (S08).`);
      return { candidates: [], notes };
    }
    const profs = repo.professionsFor(serviceCode);
    const earliest = nowMin + CFG.LEAD_TIME_MIN;
    const target = [patient.lat, patient.lon];
    const cands = [];
    const elim = { ruhsat: 0, "müsaitlik": 0, mesafe: 0, rota: 0 };
    for (const p of Object.values(repo.providers)) {
      if (!profs.has(p.profession_code)) continue;
      const visits = (repo.provider_services[p.id] || {})[serviceCode];
      if (visits === undefined) continue;
      if (!p.licence_verified) { elim.ruhsat++; continue; }
      const win = repo.availability[p.id + "|" + date];
      if (!win || win[1] <= earliest) { elim["müsaitlik"]++; continue; }
      const home = [p.home_lat, p.home_lon];
      const dist = roadKm(home, target);
      let ins = null, arrival;
      if (svc.remote_possible && svc.category === "tele") {
        arrival = Math.max(win[0], earliest);
      } else {
        if (dist > maxKm) { elim.mesafe++; continue; }
        const stops = repo.scheduled[p.id + "|" + date] || [];
        ins = bestInsertion(home, win, stops, target, svc.duration_min, earliest, p.transport);
        if (!ins) { elim.rota++; continue; }
        arrival = ins.arrival_min;
      }
      const price = priceVisit(svc.base_fee_tl, p.fee_multiplier, ins);
      cands.push({
        provider_id: p.id, name: p.display_name, profession: p.profession_code, service: serviceCode,
        arrival_min: arrival, distance_km: Math.round(dist * 10) / 10, insertion: ins, price,
        competence: competenceScore(visits, p.years_experience, p.rating), visits,
      });
    }
    for (const [k, v] of Object.entries(elim)) if (v) notes.push(`${v} aday elendi: ${k}`);
    if (!cands.length) return { candidates: [], notes };
    const pmin = Math.min(...cands.map((c) => c.price.patient_pays));
    const [wc, wp, ws] = normPrefs(prefs);
    for (const c of cands) {
      const priceS = Math.max(0, 1 - (CFG.PRICE_SENSITIVITY * (c.price.patient_pays - pmin)) / pmin);
      const speedS = Math.max(0, 1 - (c.arrival_min - earliest) / CFG.SPEED_HORIZON_MIN);
      c.scores = { yetkinlik: c.competence, fiyat: priceS, hiz: speedS };
      // Python ile aynı: 4 basamağa yuvarla (eşitlikte varış saati belirler)
      c.total = Math.round((wc * c.competence + wp * priceS + ws * speedS) * 1e4) / 1e4;
      c.explanation = explain(repo, c);
    }
    cands.sort((a, b) => b.total - a.total || a.arrival_min - b.arrival_min);
    return { candidates: cands.slice(0, topK), notes, all: cands };
  }

  function explain(repo, c) {
    const p = repo.providers[c.provider_id];
    const parts = [`bu hizmette ${c.visits} ziyaret, ${p.years_experience} yıl deneyim, puan ${p.rating}`];
    if (!c.insertion) parts.push(`en erken görüşme ${hhmm(c.arrival_min)}`);
    else {
      parts.push(`tahmini varış ${hhmm(c.arrival_min)}`);
      if (c.insertion.shared) {
        parts.push(`ziyaretiniz o günkü rotasına eklenir: ek yol ${c.insertion.added_km} km (tek başına ${c.insertion.standalone_km} km), size ${Math.round(c.price.patient_saving)} TL indirim`);
      }
    }
    parts.push(`ödeyeceğiniz ${Math.round(c.price.patient_pays)} TL`);
    return parts.join("; ");
  }

  function handleRequest(repo, complaint, patient, date, nowMin, prefs, topK = 3) {
    const t = triage(repo, complaint, patient);
    const out = { triage: t, candidates: [], notes: [], service: null };
    if (t.is_emergency) return out;
    const service = t.services[0];
    const r = findCandidates(repo, service, patient, date, nowMin, prefs, 20, topK);
    out.service = service;
    out.candidates = r.candidates;
    out.notes = r.notes.slice();
    if (t.level === "TELE_HEMSIRE") out.notes.push("Hekim video görüşmesi o saatte müsait bir hekime ayrıca atanır.");
    return out;
  }

  const api = {
    normalize, parseKeywords, match, matchLive, clauses, has, gecmisEslesme, saglikIcerigi, konusmaDegerlendir, Repo, triage, requestedProfession, bestInsertion, priceVisit, findCandidates,
    handleRequest, competenceScore, roadKm, travelMin, travel, trafikKatsayisi, yakinAcil, setYol, hhmm, LEVEL_TEXT, CFG,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EvdeCore = api;
})(typeof window !== "undefined" ? window : globalThis);
