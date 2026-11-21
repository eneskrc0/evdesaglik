/* Kapıda — Sesli asistan (ChatGPT'nin sesli modu gibi, el değmeden konuşma).
   Döngü: asistan konuşur → mikrofon dinler → konuşmanın bittiğini sessizlikten anlar (VAD) → sesi yazıya çevirir
   → mesaj mevcut sohbet akışına gider (acil kuralı, en fazla 3 soru, meslek yönlendirmesi, rapor aynen çalışır)
   → yanıt cümle cümle seslendirilir → tekrar dinler. Küreye dokunarak sözünü kesebilir ya da konuşmayı bitirebilirsin.
   Dinleyiciler (ses → yazı):
     whisper   — sunucu varsa: MediaRecorder + VAD, Groq Whisper (yöresel ağızlarda en iyisi)
     tarayici  — sunucu yoksa: tarayıcının konuşma tanıması (Chrome/Android/Safari, tr-TR, canlı altyazılı)
     claude    — Claude içinde: Claude'un dikte yeteneği (konuşma bitince küreye dokunulur)
   Seslendirme: telefonun Türkçe sesi (sunucu.js telefonSesi) ya da Claude'un tts yeteneği.
   Saf parçalar (VAD, sesMetni, cumleler, halusinasyonMu) Node'da test edilir: node web/test_sesli.mjs */
(function (root) {
  "use strict";

  // ---------- metin: seslendirmeye uygun hale getir ----------
  function sesMetni(t) {
    return String(t || "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*_#>`~|•→←↑↓✓✔⚠]/g, " ")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
      .replace(/\b112\b/g, "bir bir iki").replace(/\b113\b/g, "bir bir üç").replace(/\b114\b/g, "bir bir dört")
      .replace(/(\d)\s*TL\b/g, "$1 lira").replace(/\bTL\b/g, "lira")
      .replace(/(\d)\s*dk\b\.?/g, "$1 dakika").replace(/(\d)\s*sn\b\.?/g, "$1 saniye").replace(/(\d)\s*km\b/g, "$1 kilometre")
      .replace(/\bvb\./g, "ve benzeri").replace(/\bvs\./g, "ve saire").replace(/\bDr\./g, "Doktor").replace(/\bYZ\b/g, "yapay zekâ")
      .replace(/(\d)\s*-\s*(\d)/g, "$1 ile $2").replace(/\s*\/\s*/g, " ya da ")
      .replace(/\s*\n+\s*/g, ". ").replace(/\.\s*\./g, ".").replace(/\s{2,}/g, " ").trim();
  }
  // Uzun metni cümlelere böl (Chrome uzun konuşmayı ~15 sn'de keser; cümle cümle okumak hem güvenli hem doğal)
  function cumleler(t, sinir) {
    sinir = sinir || 180;
    const parca = String(t || "").match(/[^.!?…]+[.!?…]+["')]*|[^.!?…]+$/g) || [];
    const out = [];
    for (let p of parca.map((x) => x.trim()).filter(Boolean)) {
      while (p.length > sinir) {
        let k = p.lastIndexOf(", ", sinir); if (k < sinir / 3) k = p.lastIndexOf(" ", sinir); if (k < 1) k = sinir;
        out.push(p.slice(0, k + 1).trim()); p = p.slice(k + 1).trim();
      }
      if (p) out.push(p);
    }
    // çok kısa parçaları bir öncekine ekle ("Evet." gibi)
    return out.reduce((a, s) => { if (a.length && s.length < 12 && (a[a.length - 1] + " " + s).length <= sinir) a[a.length - 1] += " " + s; else a.push(s); return a; }, []);
  }
  // Whisper sessizlikte uydurabilir: bilinen kalıplar ve anlamsız kısa çıktılar
  // Gülme ("hahaha", en az 3 hece; "hı hı" = evet korunur), köşeli/yuvarlak ayraçlı ortam etiketi ("[Müzik]", "(alkış)", "♪") da konuşma değildir.
  const HALUSINASYON = [/altyaz/i, /[iİ]zlediğiniz için teşekkür/i, /abone ol/i, /teşekkürler\.?$/i, /^\W*$/, /^(ı+|h?ı+m*|e+h?|h?m+|a+h?)\W*$/i, /amara\.org/i, /www\./i, /^(müzik|alkış)\W*$/i,
    /^\W*(?:(?:ha|he|hi|hı|ho|hu)[\s,.!]*){3,}$/i, /^\s*[[(♪*].{0,40}[\])♪*]\s*$/, /^\W*(müzik|alkış|gülüşmeler|gülme|kahkaha|sessizlik|gürültü|anlaşılmıyor)\W*$/i];
  function halusinasyonMu(t) {
    const s = String(t || "").trim();
    if (s.length < 2) return true;
    if (/^teşekkürler\.?$/i.test(s) || /^teşekkür ederim\.?$/i.test(s)) return false; // gerçek yanıt olabilir
    return HALUSINASYON.some((r) => r.test(s));
  }

  // ---------- ara laflar: sohbetin içeriği değil, konuşmanın kendisi hakkında ----------
  // "Beni duyuyor musun?", "alo", "tekrar eder misin", "bir saniye", "merhaba" → yerel kısa cevap; soru sayısına girmez, YZ'ye gitmez.
  const katla = (t) => String(t || "").replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase()
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const NEZAKET = "(?: (?:lutfen|acaba|kanka|abi|abla|hocam|kardesim|evladim|kizim|oglum|yavrum|beni|bi|bir|ya|peki|tamam))*";
  const ARA_LAF = [
    ["duyma", new RegExp("^(?:alo+ )*(?:beni |sesimi |bizi )?(?:duyuyor|duyabiliyor|duyuyo|isitiyor|duydun|duydunuz|duyabildin)(?: ?mu(?:sun|sunuz)?| ?mi(?:sin|siniz)?)?" + NEZAKET + "$")],
    ["duyma", new RegExp("^(?:alo+ )*(?:sesim )?(?:geliyor|gidiyor|geliyo) ?mu" + NEZAKET + "$")],
    ["duyma", new RegExp("^(?:alo+ )*(?:orada|orda|burada) ?m(?:i|isin|isiniz)" + NEZAKET + "$")],
    ["duyma", /^(?:alo+ ?)+$/],
    ["tekrar", new RegExp("^(?:(?:tekrar|bir daha|bi daha)(?: (?:eder|soyler|sorar|anlatir|okur))? ?(?:misin|misiniz|mi)?|anlamadim|duyamadim|ne dedin(?:iz)?|ne dediniz|efendim|pardon|nasil yani|ne|hi+|hm+|soruyu tekrarla(?:r misin)?)" + NEZAKET + "$")],
    ["bekle", new RegExp("^(?:(?:bir|bi) (?:saniye|dakika|dakka|dk)(?: (?:bekle|bekler misin|bekleyin|dur))?|(?:dur|sus)(?: (?:bir|bi) (?:saniye|dakika|dakka|dk))?(?: bekle)?|bekle|bekler misin|bekleyin|dusuneyim|bakayim|hatirlayayim|sus|sessiz ol)" + NEZAKET + "$")],
    ["selam", new RegExp("^(?:alo )?(?:merhaba|merhabalar|selam|selamlar|iyi gunler|gunaydin|iyi aksamlar|selamun aleykum|selamin aleykum)(?: alo)?" + NEZAKET + "$")],
    // Gündelik sorular (22.11): "nasılsın", "sen kimsin", "ne yapabilirsin", "teşekkürler", "görüşürüz" → kısa, sıcak yerel cevap
    ["hal", new RegExp("^(?:alo )?(?:(?:merhaba|merhabalar|selam|selamlar|iyi gunler|gunaydin|iyi aksamlar)" + NEZAKET + " )?(?:(?:sen |siz )?(?:nasilsin|nasilsiniz|nasil gidiyor|naber|ne haber|nabersin|ne var ne yok|iyi misin|iyi misiniz|keyfin nasil|keyifler nasil|nasilsin bakalim)(?: (?:bakalim|bugun))?)(?: (?:sen|siz))?" + NEZAKET + "$")],
    ["kimlik", new RegExp("^(?:(?:sen|siz) )?(?:kimsin|kimsiniz|kim(?:sin)? sen|adin ne|ismin ne|adiniz ne|robot mu(?:sun)?|yapay zeka mi(?:sin)?|insan mi(?:sin)?|gercek (?:insan )?mi(?:sin)?|kiminle konusuyorum|seni kim yapti|kim yapti seni|makine mi(?:sin)?)(?: (?:sen|siz))?" + NEZAKET + "$")],
    ["yetenek", new RegExp("^(?:(?:sen|siz) )?(?:ne(?:ler)? yapabilirsin|ne(?:ler)? yapabiliyorsun|ne ise yariyorsun|ne ise yararsin|bana nasil yardim edebilirsin|nasil yardimci olabilirsin|ne yapiyorsun sen|bu uygulama ne(?: ise yarar| yapar)?|nasil calisiyorsun|nasil kullanilir)(?: (?:sen|siz|bana))?" + NEZAKET + "$")],
    ["tesekkur", new RegExp("^(?:(?:cok|cok cok) )?(?:tesekkurler|tesekkur ederim|tesekkur ederiz|sag ol|sagol|sag olun|sagolun|eyvallah|allah razi olsun|mersi|eline saglik|ellerine saglik)(?: (?:cok|canim|guzel kardesim))?" + NEZAKET + "$")],
    ["veda", new RegExp("^(?:tamam |peki )?(?:gorusuruz|gorusmek uzere|hosca kal|hoscakal|hosca kalin|iyi geceler|bay bay|bye|allaha emanet|kendine iyi bak|kolay gelsin)" + NEZAKET + "$")],
  ];
  // ---------- küfür / hakaret (22.11): yanıt verilmez, sohbet konuya döner ----------
  // Kelime kökü ya da tam kelime; "şikâyet" (sikayet), "sıkıntı" (sikinti), "normal", "malzeme", "götür" (gotur) yanlışlıkla yakalanmaz.
  const HAKARET_KOK = /^(salak|aptal|gerizekal|dangalak|embesil|ahmak|serefsiz|haysiyetsiz|orospu|orosbu|yavsak|pezevenk|siktir|kaltak|kahpe|dalyarak|yarrak|amcik|mankafa|hiyarto|aptalc|salakc|beyinsiz)/;
  const HAKARET_TAM = new Set(["mal", "malsin", "malsiniz", "malmisin", "malmisiniz", "pic", "pust", "oc", "amk", "aq", "amq", "mk", "sikerim", "sikeyim", "sikik", "sikim", "sokayim", "got", "gotveren", "ibne", "yarak", "amina", "anani", "avradini", "gavat", "manyak", "angut", "keriz"]);
  const KABA_EK = new Set(["lan", "ulan"]); // tek başına hakaret sayılmaz ("annem düştü lan"), yalnızca YZ'ye giden metinden çıkarılır
  function hakaret(t) {
    const ham = String(t || "").split(/\s+/).filter(Boolean), k = ham.map((w) => katla(w).replace(/ /g, ""));
    let sayi = 0;
    const temiz = [];
    for (let i = 0; i < k.length; i++) {
      const w = k[i];
      if ((w === "geri" && k[i + 1] === "zekali") || (w === "malin" && k[i + 1] === "teki")) { sayi++; i++; continue; }
      if (HAKARET_KOK.test(w) || HAKARET_TAM.has(w)) { sayi++; continue; }
      if (KABA_EK.has(w)) continue;
      temiz.push(ham[i]);
    }
    return { var: sayi > 0, temiz: temiz.join(" ") };
  }
  function araLaf(t) {
    const k = katla(t);
    if (!k || k.split(" ").length > 7) return null;
    for (const [tur, re] of ARA_LAF) if (re.test(k)) return tur;
    return null;
  }
  // Yankı: mikrofon asistanın kendi sesini (hoparlörden) yakaladı mı? Kullanıcının cümlesi en az 3 kelime ve kelimelerinin
  // (6 kelimede en fazla 1 tanıma farkıyla) asistanın son söylediğinde aynı sırayla geçiyorsa yankıdır. "Var", "evet", "bir haftadır var" yankı sayılmaz.
  function yankiMi(asistan, duyulan) {
    const a = katla(asistan).split(" ").filter(Boolean), k = katla(duyulan).split(" ").filter(Boolean);
    if (k.length < 3 || !a.length) return false;
    let j = 0, es = 0;
    for (const w of k) { const i = a.indexOf(w, j); if (i >= 0) { es++; j = i + 1; } }
    return es >= k.length - Math.floor(k.length / 6); // 6 kelimede en fazla 1 tanıma farkı; yeni kelime katan cevap yankı değildir
  }
  // Cümle yarım mı kaldı? ("...ve", "...ama", "...şey") → gönderme, devamını bekle
  const DEVAM = /(?:^| )(ve|ama|fakat|ancak|cunku|sey|yani|ile|ki|veya|yahut|bir de|bi de|sonra|hem|mesela|ozellikle)$/;
  function yarimMi(t) { const k = katla(t); return k.split(" ").length >= 2 && DEVAM.test(k); }

  // ---------- VAD: ses seviyesinden konuşmanın başını ve sonunu bulur (saf durum makinesi) ----------
  function VAD(o) {
    o = Object.assign({ minEsik: 0.012, carpan: 3.2, baslaMs: 250, sessizlikMs: 1300, minKonusmaMs: 350, beklemeMs: 9000, maksMs: 45000, kalibrasyonMs: 300 }, o || {});
    let t0 = null, taban = 0, ornek = 0, ustte = 0, alttaSure = 0, konustu = false, basla = null, sonT = null, bitti = false;
    return {
      get konustu() { return konustu; },
      get esik() { return Math.max(o.minEsik, taban * o.carpan); },
      adim(rms, t) {
        if (bitti) return null;
        if (t0 === null) { t0 = t; sonT = t; }
        const dt = Math.max(0, t - sonT); sonT = t;
        const gecen = t - t0;
        if (gecen < o.kalibrasyonMs && !konustu) { ornek++; taban += (rms - taban) / ornek; return null; } // gürültü tabanı
        const esik = Math.max(o.minEsik, taban * o.carpan);
        if (rms >= esik) { ustte += dt; alttaSure = 0; if (!konustu && ustte >= o.baslaMs) { konustu = true; basla = t; return "basladi"; } }
        else {
          ustte = 0;
          if (!konustu) taban += (rms - taban) * (rms < taban ? 0.3 : 0.02); // tabanı izle: düşüşe hızlı (dinleme konuşmanın ortasında başladıysa), yükselişe yavaş
          else { alttaSure += dt; if (alttaSure >= o.sessizlikMs && t - basla >= o.minKonusmaMs) { bitti = true; return "bitti"; } }
        }
        if (!konustu && gecen >= o.beklemeMs) { bitti = true; return "sessiz"; }
        if (gecen >= o.maksMs) { bitti = true; return konustu ? "bitti" : "sessiz"; }
        return null;
      },
    };
  }

  // ---------- dinleyiciler ----------
  const IOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent || "");

  // Sunucu (Whisper): mikrofon akışı oturum boyunca açık kalır (her turda izin sorulmaz); her konuşma ayrı kayıt.
  function whisperDinleyici(cevir) {
    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    const tur = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    const uzanti = /mp4/.test(tur) ? "m4a" : /ogg/.test(tur) ? "ogg" : "webm";
    let akim = null, ctx = null, analiz = null, kaynak = null, rec = null, saat = null, oturum = 0;
    let nesil = 0, bekleyenIzin = null; // nesil: birak() her çağrıldığında artar; izin beklerken kapatılırsa gelen akış hemen kapatılır
    const tampon = new Float32Array(1024);
    function izinAl() {
      if (bekleyenIzin) return bekleyenIzin; // aynı anda iki getUserMedia açılmasın (iki akış, biri sahipsiz kalır)
      const benim = nesil;
      bekleyenIzin = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .then((s) => {
          if (benim !== nesil) { s.getTracks().forEach((t) => t.stop()); const h = new Error("kapatıldı"); h.code = "iptal"; throw h; }
          return s;
        }, () => { const h = new Error("mikrofon izni yok"); h.code = "not_granted"; throw h; })
        .finally(() => { bekleyenIzin = null; });
      return bekleyenIzin;
    }
    async function hazirla() {
      if (!akim || !akim.active) {
        akim = await izinAl();
        if (kaynak) try { kaynak.disconnect(); } catch (e) { /* yok */ }
        kaynak = null;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx && AC) ctx = new AC();
      if (ctx && ctx.state === "suspended") { try { await ctx.resume(); } catch (e) { /* yok */ } }
      if (ctx && !kaynak) { kaynak = ctx.createMediaStreamSource(akim); analiz = ctx.createAnalyser(); analiz.fftSize = 1024; kaynak.connect(analiz); }
    }
    function rms() {
      if (!analiz) return 0;
      analiz.getFloatTimeDomainData(tampon);
      let s = 0; for (let i = 0; i < tampon.length; i++) s += tampon[i] * tampon[i];
      return Math.sqrt(s / tampon.length);
    }
    function durdur() { clearInterval(saat); saat = null; }
    return {
      tur: "whisper", vadVar: true, konusurkenBirak: IOS,
      hazirla,
      async baslat(cb, secenek) {
        const benim = ++oturum;
        await hazirla();
        if (benim !== oturum) return;
        // önceki kayıt hâlâ sürüyorsa kapat (üst üste dokunmada iki kayıt ve iki zamanlayıcı kalmasın)
        durdur(); if (rec && rec.state === "recording") { rec.onstop = null; try { rec.stop(); } catch (e) { /* yok */ } }
        const parcalar = []; const vad = VAD(secenek && secenek.beklemeMs ? { beklemeMs: secenek.beklemeMs } : null); let zorla = false, bitti = false;
        rec = tur ? new MediaRecorder(akim, { mimeType: tur }) : new MediaRecorder(akim);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) parcalar.push(e.data); };
        const bitir = (z) => {
          if (bitti) return; bitti = true; zorla = !!z; durdur();
          rec.onstop = async () => {
            if (benim !== oturum) return;
            const blob = new Blob(parcalar, { type: rec.mimeType || tur || "audio/webm" });
            if ((!vad.konustu && !zorla) || blob.size < 1200) { cb.sessiz(); return; }
            cb.isleniyor && cb.isleniyor();
            try { const metin = await cevir(blob, uzanti); if (benim === oturum) cb.son(String(metin || "").trim()); }
            catch (e) { if (benim === oturum) cb.hata(e && e.code === "rate_limited" ? "yogun" : "ceviri"); }
          };
          try { rec.stop(); } catch (e) { cb.sessiz(); }
        };
        this._bitir = bitir;
        rec.start(250);
        saat = setInterval(() => {
          const v = rms(), ev = vad.adim(v, performance.now());
          cb.seviye && cb.seviye(Math.min(1, v / 0.12));
          if (ev === "basladi") cb.basladi && cb.basladi();
          else if (ev === "bitti") bitir(false);
          else if (ev === "sessiz") { bitti = true; durdur(); try { rec.onstop = null; rec.stop(); } catch (e) { /* yok */ } cb.sessiz(); }
        }, 50);
      },
      bitir() { if (this._bitir) this._bitir(true); },
      iptal() { oturum++; durdur(); if (rec && rec.state === "recording") { rec.onstop = null; try { rec.stop(); } catch (e) { /* yok */ } } this._bitir = null; },
      birak() { this.iptal(); nesil++; if (akim) akim.getTracks().forEach((t) => t.stop()); akim = null; if (kaynak) try { kaynak.disconnect(); } catch (e) { /* yok */ } kaynak = null; },
      kapat() { this.birak(); if (ctx) { try { ctx.close(); } catch (e) { /* yok */ } ctx = null; } },
    };
  }

  // Tarayıcının konuşma tanıması (sunucu yokken; demo modunda da sesli konuşulur)
  function tarayiciDinleyici() {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return null;
    let r = null, oturum = 0;
    return {
      tur: "tarayici", vadVar: true, konusurkenBirak: false,
      async hazirla() { /* izin ilk start'ta sorulur */ },
      async baslat(cb) {
        const benim = ++oturum;
        let son = "", ara = "", hata = null;
        r = new SR(); r.lang = "tr-TR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
        r.onresult = (e) => {
          let f = "", i = "";
          for (let k = 0; k < e.results.length; k++) { const x = e.results[k]; if (x.isFinal) f += x[0].transcript; else i += x[0].transcript; }
          son = f.trim() || son; ara = (f + " " + i).trim();
          if (benim === oturum) { cb.ara && cb.ara(ara); cb.seviye && cb.seviye(0.6); }
        };
        r.onspeechstart = () => { if (benim === oturum) cb.basladi && cb.basladi(); };
        r.onerror = (e) => { hata = e.error; };
        r.onend = () => {
          if (benim !== oturum) return;
          const metin = son || ara;
          if (hata === "not-allowed" || hata === "service-not-allowed") cb.hata("izin");
          else if (metin) cb.son(metin);
          else if (hata === "network") cb.hata("ceviri");
          else cb.sessiz();
        };
        try { r.start(); } catch (e) { cb.hata("ceviri"); }
      },
      bitir() { try { r && r.stop(); } catch (e) { /* yok */ } },
      iptal() { oturum++; try { r && r.abort(); } catch (e) { /* yok */ } },
      birak() { this.iptal(); },
      kapat() { this.iptal(); },
    };
  }

  // Claude'un dikte yeteneği (VAD yok: konuşma bitince küreye dokunulur)
  function claudeDinleyici(dict) {
    if (!dict) return null;
    let cb = null, metin = "", aktif = false, bekleyen = false;
    dict.onPartial && dict.onPartial(({ text }) => { if (aktif && cb && text) cb.ara && cb.ara(text); });
    dict.onFinal && dict.onFinal(({ text }) => { if (aktif && text) metin = (metin + " " + text).trim(); });
    dict.onState && dict.onState(({ state }) => {
      if (state !== "idle" || !aktif || !bekleyen) return;
      aktif = false; bekleyen = false; const c = cb;
      setTimeout(() => (metin ? c.son(metin) : c.sessiz()), 30);
    });
    return {
      tur: "claude", vadVar: false, konusurkenBirak: false,
      async hazirla() { /* yok */ },
      async baslat(c) { cb = c; metin = ""; aktif = true; bekleyen = false; try { await dict.start(); } catch (e) { aktif = false; c.hata(e && e.code === "not_granted" ? "izin" : "ceviri"); } },
      bitir() { if (!aktif) return; bekleyen = true; Promise.resolve(dict.stop()).catch(() => {}); },
      iptal() { aktif = false; bekleyen = false; Promise.resolve(dict.stop && dict.stop()).catch(() => {}); },
      birak() { this.iptal(); },
      kapat() { this.iptal(); },
    };
  }

  // Seslendirici sarmalayıcı: {speak(t, {onCumle}) → Promise, stop(), kilidiAc()}
  function konusucu(tts) {
    if (!tts) return null;
    if (tts.cumleCumle) return tts; // telefonSesi zaten cümle cümle okur
    let kesildi = false;
    return {
      kilidiAc() { tts.kilidiAc && tts.kilidiAc(); },
      async speak(t, o) {
        kesildi = false;
        for (const [i, c] of cumleler(t).entries()) {
          if (kesildi) break;
          o && o.onCumle && o.onCumle(i, c);
          try { await tts.speak(c); } catch (e) { /* sessiz */ }
        }
        return { kesildi };
      },
      stop() { kesildi = true; try { (tts.stop || tts.cancel || (() => {})).call(tts); } catch (e) { /* yok */ } },
    };
  }

  // ---------- denetleyici ----------
  // o: { dinleyici, tts, gonder(metin) → Promise<{tur: "devam"|"acil"|"bitti"|"hata", metin}>, acilMi(metin) → bool (kural motoru), ciz(), dom(id) }
  function create(o) {
    const st = { acik: false, durum: "kapali", seviye: 0, ara: "", sen: "", asistan: "", cumle: -1, hata: "", kulaklik: false, sessizSay: 0, bosSay: 0, birikmis: "", parcaSay: 0 };
    let kes = 0; // her yeni adımda artar; eski geri çağrılar yok sayılır
    const ciz = () => { try { o.ciz(); } catch (e) { /* yok */ } };
    const dl = () => o.dinleyici;
    const acilMi = (t) => { try { return !!(o.acilMi && o.acilMi(t)); } catch (e) { return false; } };
    const tts = () => o.tts;
    function dom(id, f) { const el = typeof document !== "undefined" && document.getElementById(id); if (el) f(el); }
    function seviyeYaz(v) { st.seviye = st.seviye * 0.6 + v * 0.4; dom("svOrb", (el) => el.style.setProperty("--sv", st.seviye.toFixed(3))); }
    function araYaz(t) { st.ara = t; dom("svSen", (el) => { el.textContent = t ? "Sen: " + t : ""; el.hidden = !t; }); }

    async function soyle(metin, sonra) {
      const benim = ++kes;
      st.durum = "konusuyor"; st.asistan = metin; st.cumle = 0; st.hata = ""; ciz();
      if (dl() && dl().konusurkenBirak) dl().birak(); // iOS: mikrofon açıkken ses kulaklıktan kısık çıkar
      const T = tts();
      if (T) {
        const r = await T.speak(sesMetni(metin), { onCumle: (i) => { if (benim === kes) { st.cumle = i; dom("svOrb", (el) => el.dataset.cumle = i); } } }).catch(() => ({}));
        if (benim !== kes || (r && r.kesildi)) return;
      } else await new Promise((res) => setTimeout(res, 400));
      if (benim !== kes) return;
      if (!st.acik) { st.durum = "kapali"; ciz(); return; }
      if (sonra === "dinle") dinle();
    }

    async function dinle(secenek) {
      const D = dl(); if (!D || !st.acik) return;
      const benim = ++kes;
      st.durum = "dinliyor"; st.ara = st.birikmis; st.seviye = 0; ciz();
      try {
        await D.baslat({
          seviye: (v) => { if (benim === kes) seviyeYaz(v); },
          ara: (t) => { if (benim === kes) araYaz(t); },
          basladi: () => { if (benim === kes) dom("svDurum", (el) => (el.textContent = "Dinliyorum…")); },
          isleniyor: () => { if (benim === kes) { st.durum = "isleniyor"; ciz(); } },
          son: (t) => { if (benim === kes) isle(t, true); },
          sessiz: () => { if (benim === kes) sessizlik(); },
          hata: (k) => { if (benim === kes) hata(k); },
        }, secenek);
      } catch (e) { if (benim === kes && !(e && e.code === "iptal")) hata(e && e.code === "not_granted" ? "izin" : "ceviri"); }
    }

    function sessizlik() {
      if (st.birikmis) { const m = st.birikmis; st.birikmis = ""; st.parcaSay = 0; isle(m, false); return; } // yarım cümleden sonra sustu: olduğu gibi gönder
      st.sessizSay++;
      if (st.sessizSay >= 2) { st.durum = "beklemede"; st.hata = ""; ciz(); return; }
      soyle("Seni dinliyorum. Hazır olduğunda konuşabilirsin.", "dinle");
    }
    function hata(k) {
      if (k === "izin") { st.durum = "beklemede"; st.hata = "Mikrofon izni yok. Tarayıcı ayarlarından mikrofona izin ver ya da yazarak devam et."; ciz(); return; }
      if (k === "yogun") { soyle("Şu an çok yoğunum. Birkaç saniye sonra tekrar söyler misin?", "dinle"); return; }
      st.bosSay++;
      if (st.bosSay >= 3) { st.durum = "beklemede"; st.hata = "Sesini yazıya çeviremedim. İnternet bağlantını kontrol et ya da yazarak devam et."; ciz(); return; }
      soyle("Sesini tam anlayamadım. Bir daha söyler misin?", "dinle");
    }

    async function isle(metin, sestenMi) {
      metin = String(metin || "").trim();
      // Asistanın kendi sesi geri geldiyse (hoparlör → mikrofon) mesaj sayılmaz; sessizce yeniden dinle
      if (sestenMi && st.asistan && yankiMi(st.asistan, metin)) { st.bosSay++; araYaz(""); if (st.bosSay >= 3) { st.durum = "beklemede"; ciz(); return; } dinle(); return; }
      if (sestenMi && halusinasyonMu(metin)) { st.bosSay++; araYaz(""); if (st.bosSay >= 3) { st.durum = "beklemede"; ciz(); return; } soyle("Seni tam duyamadım. Bir daha söyler misin?", "dinle"); return; }
      if (!metin) return;
      // Yarım kalan cümle: gönderme, devamını dinle (en fazla 2 parça); sonra hepsini birleştirip gönder
      // …ama yarım cümlede acil belirti varsa ("Babam nefes alamıyor ve") beklemeden gönder: acil kararı gecikmesin
      if (sestenMi && yarimMi(metin) && st.parcaSay < 2 && !acilMi((st.birikmis + " " + metin).trim())) {
        st.birikmis = (st.birikmis + " " + metin).trim(); st.parcaSay++;
        dinle({ beklemeMs: 4000 }); araYaz(st.birikmis); return;
      }
      if (st.birikmis) { metin = (st.birikmis + " " + metin).trim(); st.birikmis = ""; st.parcaSay = 0; }
      const benim = ++kes;
      st.sessizSay = 0; st.bosSay = 0; st.sen = metin; st.ara = ""; st.durum = "dusunuyor"; ciz();
      let r;
      try { r = await o.gonder(metin); } catch (e) { r = { tur: "hata", metin: "Bağlantıda bir sorun oldu. Bir daha söyler misin?" }; }
      if (benim !== kes || !st.acik) return;
      r = r || { tur: "devam", metin: "" };
      if (r.tur === "acil" || r.tur === "bitti") {
        st.acik = false; st.durum = "kapali"; if (dl()) dl().kapat(); ciz();
        if (r.metin) soyle(r.metin, null);
        return;
      }
      if (r.tur === "dur") { st.durum = "beklemede"; ciz(); return; }
      soyle(r.metin || "Anladım. Devam edebilirsin.", "dinle");
    }

    return {
      st,
      get acik() { return st.acik; },
      var: () => !!(o.dinleyici),
      tur: () => (o.dinleyici ? o.dinleyici.tur : null),
      // Kullanıcı dokunuşuyla çağrılmalı (iOS ses ve mikrofon kilidi)
      ac(ilkMetin) {
        if (st.acik || !dl()) return;
        Object.assign(st, { acik: true, durum: "hazir", ara: "", sen: "", hata: "", sessizSay: 0, bosSay: 0, birikmis: "", parcaSay: 0 });
        const T = tts(); if (T && T.kilidiAc) T.kilidiAc();
        const D = dl();
        const hazir = D.hazirla ? D.hazirla() : Promise.resolve(); // getUserMedia dokunuşun içinde başlasın
        ciz();
        hazir.then(() => { if (st.acik) ilkMetin ? soyle(ilkMetin, "dinle") : dinle(); })
          .catch((e) => { if (st.acik && !(e && e.code === "iptal")) hata(e && e.code === "not_granted" ? "izin" : "ceviri"); });
      },
      kapat(sustur) {
        if (!st.acik && st.durum === "kapali") { if (sustur !== false && tts()) tts().stop(); return; }
        kes++; st.acik = false; st.durum = "kapali";
        if (dl()) dl().kapat();
        if (sustur !== false && tts()) tts().stop();
      },
      // Küreye dokunma: konuşurken sözünü keser, dinlerken "bitirdim" demektir, beklemedeyse yeniden dinler
      dokun() {
        if (!st.acik) return;
        if (st.durum === "konusuyor") { kes++; if (tts()) tts().stop(); st.sessizSay = 0; dinle(); }
        else if (st.durum === "dinliyor") { if (dl()) dl().bitir(); }
        else if (st.durum === "beklemede" || st.durum === "hazir") { st.sessizSay = 0; st.bosSay = 0; st.hata = ""; dinle(); }
      },
      duraklat() {
        if (!st.acik) return;
        if (st.durum === "beklemede") { st.sessizSay = 0; st.bosSay = 0; st.hata = ""; dinle(); return; }
        kes++; if (tts()) tts().stop(); if (dl()) dl().iptal(); st.durum = "beklemede"; ciz();
      },
      // Hızlı yanıt çipi ya da fotoğraf: dinlemeyi bırakıp metni gönder
      hizli(metin) { if (!st.acik) return; kes++; if (tts()) tts().stop(); if (dl()) dl().iptal(); st.birikmis = ""; st.parcaSay = 0; isle(metin, false); },
      dinleyiciDegistir(d) { o.dinleyici = d; },
      ttsDegistir(t) { o.tts = t; },
    };
  }

  const api = { create, VAD, sesMetni, cumleler, halusinasyonMu, araLaf, hakaret, yarimMi, yankiMi, whisperDinleyici, tarayiciDinleyici, claudeDinleyici, konusucu };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KapidaSesli = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
