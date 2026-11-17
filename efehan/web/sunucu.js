/* Kapıda — sunucu bağlantısı (Claude dışında açıldığında: GitHub Pages, telefon).
   - sohbet / rapor: Cloudflare Worker (efehan/sunucu/worker.js) üzerinden Groq dil modeli
   - dikte: tarayıcıda MediaRecorder ile kayıt → sunucuda Whisper ile yazıya çevirme
   - ses: telefonun kendi Türkçe sesi (speechSynthesis)
   Arayüzü, kapida.js'in Claude yetenekleriyle (dictation, tts) aynı biçimdedir. */
(function () {
  "use strict";

  function hataYap(kod, mesaj) { const e = new Error(mesaj || kod); e.code = kod; return e; }

  async function istek(url, yol, govde, zamanAsimiMs) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), zamanAsimiMs || 45000);
    try {
      const r = await fetch(url + yol, govde instanceof FormData ? { method: "POST", body: govde, signal: ctl.signal }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde), signal: ctl.signal });
      const v = await r.json().catch(() => null);
      if (r.status === 429) throw hataYap("rate_limited", "yoğun");
      if (!r.ok || !v) throw hataYap("sunucu", (v && v.mesaj) || String(r.status));
      return v;
    } catch (e) {
      if (e.code) throw e;
      throw hataYap(e.name === "AbortError" ? "zaman_asimi" : "baglanti", String(e.message || e));
    } finally { clearTimeout(t); }
  }

  function kaydedici(url) {
    if (typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    const dinleyici = { partial: [], final: [], state: [] };
    const yay = (ad, v) => dinleyici[ad].forEach((f) => { try { f(v); } catch (e) { /* yok */ } });
    let rec = null, parcalar = [], akim = null, sinirSaat = null;
    const tur = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    const uzanti = /mp4/.test(tur) ? "m4a" : /ogg/.test(tur) ? "ogg" : "webm";
    async function cevir(blob) {
      yay("state", { state: "transcribing" });
      yay("partial", { text: "Sesin yazıya çevriliyor…" });
      try {
        const f = new FormData();
        f.append("dosya", blob, "kayit." + uzanti);
        const v = await istek(url, "/ses", f, 60000);
        if (v.metin) yay("final", { text: v.metin });
      } catch (e) {
        yay("partial", { text: e.code === "rate_limited" ? "Şu an yoğun; birazdan tekrar dene." : "Ses çevrilemedi; yazarak devam edebilirsin." });
      } finally { yay("state", { state: "idle" }); }
    }
    return {
      onPartial: (f) => dinleyici.partial.push(f),
      onFinal: (f) => dinleyici.final.push(f),
      onState: (f) => dinleyici.state.push(f),
      async start() {
        if (rec) return;
        try { akim = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch (e) { throw hataYap("not_granted", "mikrofon izni yok"); }
        parcalar = [];
        rec = tur ? new MediaRecorder(akim, { mimeType: tur }) : new MediaRecorder(akim);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) parcalar.push(e.data); };
        rec.onstop = () => {
          akim.getTracks().forEach((t) => t.stop());
          const blob = new Blob(parcalar, { type: rec.mimeType || tur || "audio/webm" });
          rec = null; clearTimeout(sinirSaat);
          if (blob.size > 1000) cevir(blob); else { yay("partial", { text: "Ses alınamadı, tekrar dene." }); yay("state", { state: "idle" }); }
        };
        rec.start();
        yay("state", { state: "listening" });
        yay("partial", { text: "Dinliyorum… bitince mikrofona tekrar bas." });
        sinirSaat = setTimeout(() => { if (rec && rec.state === "recording") rec.stop(); }, 90000); // en fazla 90 sn
      },
      async stop() { if (rec && rec.state === "recording") rec.stop(); },
    };
  }

  // Telefonun Türkçe sesi: varsa daha doğal sesleri tercih et
  function telefonSesi() {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") return null;
    const sec = () => {
      const tr = speechSynthesis.getVoices().filter((v) => /^tr/i.test(v.lang));
      return tr.find((v) => /natural|neural|premium|enhanced|yelda|google/i.test(v.name)) || tr.find((v) => v.localService) || tr[0] || null;
    };
    return {
      speak(metin) {
        return new Promise((res) => {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(String(metin).replace(/[*_#>]/g, ""));
          u.lang = "tr-TR"; u.rate = 0.97;
          const v = sec(); if (v) u.voice = v;
          u.onend = res; u.onerror = res;
          speechSynthesis.speak(u);
        });
      },
      stop() { speechSynthesis.cancel(); },
    };
  }

  function create(url) {
    url = String(url || "").replace(/\/+$/, "");
    return {
      url,
      async saglik() {
        try { const r = await fetch(url + "/", { method: "GET" }); const v = await r.json(); return !!(v && v.ok && v.anahtar); } catch (e) { return false; }
      },
      async sohbet(turlar, fotoNotlari, resimler) {
        const v = await istek(url, "/sohbet", { turlar, foto_notlari: fotoNotlari || [], resimler: resimler || [] });
        return v.yanit;
      },
      async rapor(transkript, fotoNotlari, resimler) {
        const v = await istek(url, "/rapor", { transkript, foto_notlari: fotoNotlari || [], resimler: resimler || [] }, 60000);
        return v.rapor;
      },
      dictation: kaydedici(url),
    };
  }

  // Sunucu adresi: ?sunucu=... (deneme için) ya da derlemede gömülen adres (sunucu/adres.txt)
  function adres() {
    try { const q = new URLSearchParams(location.search).get("sunucu"); if (q && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(q)) return q; } catch (e) { /* yok */ }
    return window.KAPIDA_SUNUCU || "";
  }

  window.KapidaSunucu = { create, adres, telefonSesi };
})();
