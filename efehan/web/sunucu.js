/* Kapıda — sunucu bağlantısı (Claude dışında açıldığında: GitHub Pages, telefon).
   - sohbet / rapor: Cloudflare Worker (efehan/sunucu/worker.js) üzerinden Groq dil modeli
   - dikte: tarayıcıda MediaRecorder ile kayıt → sunucuda Whisper ile yazıya çevirme
   - ses: telefonun kendi Türkçe sesi (speechSynthesis)
   Arayüzü, kapida.js'in Claude yetenekleriyle (dictation, tts) aynı biçimdedir. */
(function () {
  "use strict";

  function hataYap(kod, mesaj) { const e = new Error(mesaj || kod); e.code = kod; return e; }

  // Groq'un ücretsiz dakikalık kotası dolunca sunucu 429 döner: kullanıcıya "yoğunum" demeden önce bekleyip yeniden dene
  async function istek(url, yol, govde, zamanAsimiMs) {
    const beklemeler = [2500, 6000, 10000];
    for (let i = 0; ; i++) {
      try { return await istekTek(url, yol, govde, zamanAsimiMs); }
      catch (e) {
        if (e.code !== "rate_limited" || i >= beklemeler.length) throw e;
        await new Promise((r) => setTimeout(r, e.sonra ? Math.min(15000, e.sonra * 1000) : beklemeler[i]));
      }
    }
  }
  async function istekTek(url, yol, govde, zamanAsimiMs) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), zamanAsimiMs || 45000);
    try {
      const r = await fetch(url + yol, govde instanceof FormData ? { method: "POST", body: govde, signal: ctl.signal }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde), signal: ctl.signal });
      const v = await r.json().catch(() => null);
      if (r.status === 429) { const h = hataYap("rate_limited", "yoğun"); h.sonra = +(v && v.sonra) || +r.headers.get("Retry-After") || 0; throw h; }
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

  // Telefonun Türkçe sesi: en doğal Türkçe sesi seçer, metni cümle cümle okur (Chrome uzun metni yarıda keser),
  // her cümlede geri çağırır, durdurulabilir. Sesli asistan (sesli.js) ve "yanıtları sesli oku" bunu kullanır.
  function telefonSesi() {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") return null;
    const SS = window.speechSynthesis;
    const puan = (v) => (/natural|neural|online/i.test(v.name) ? 40 : 0) + (/premium|enhanced|yüksek/i.test(v.name) ? 30 : 0)
      + (/google/i.test(v.name) ? 20 : 0) + (/yelda|emel|ahmet|cem|filiz/i.test(v.name) ? 10 : 0) + (v.localService ? 2 : 0) + (/^tr[-_]TR/i.test(v.lang) ? 3 : 0);
    let ses = null;
    const sec = () => { const tr = SS.getVoices().filter((v) => /^tr/i.test(v.lang)); ses = tr.sort((a, b) => puan(b) - puan(a))[0] || null; return ses; };
    sec(); try { SS.addEventListener("voiceschanged", sec); } catch (e) { /* eski tarayıcı */ }
    const bol = (t) => (window.KapidaSesli ? window.KapidaSesli.cumleler(t) : String(t).match(/[^.!?]+[.!?]*/g) || [String(t)]);
    const temizle = (t) => (window.KapidaSesli ? window.KapidaSesli.sesMetni(t) : String(t).replace(/[*_#>]/g, ""));
    let kesildi = false, acildi = false, nesil = 0;
    function tek(metin) {
      return new Promise((res) => {
        const u = new SpeechSynthesisUtterance(metin);
        u.lang = "tr-TR"; u.rate = 1.0; u.pitch = 1.0;
        const v = ses || sec(); if (v) u.voice = v;
        let bitti = false; const son = () => { if (!bitti) { bitti = true; clearTimeout(emniyet); clearInterval(canli); res(); } };
        u.onend = son; u.onerror = son;
        // Bazı Android sürümlerinde onend gelmez: tahmini süre + pay sonra devam et
        const emniyet = setTimeout(son, 2500 + metin.length * 110);
        // Chrome masaüstü ~15 sn'de durur: arada duraklat/sürdür
        const canli = setInterval(() => { if (SS.speaking && !SS.paused && !/Android/i.test(navigator.userAgent)) { SS.pause(); SS.resume(); } }, 9000);
        SS.speak(u);
      });
    }
    return {
      cumleCumle: true,
      kilidiAc() { // iOS: ilk konuşma bir dokunuşun içinde başlamalı
        if (acildi) return; acildi = true;
        try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; u.lang = "tr-TR"; SS.speak(u); } catch (e) { /* yok */ }
      },
      async speak(metin, o) {
        const benim = ++nesil; kesildi = false;
        SS.cancel();
        const parca = bol(temizle(metin));
        for (let i = 0; i < parca.length; i++) {
          if (kesildi || benim !== nesil) return { kesildi: true };
          o && o.onCumle && o.onCumle(i, parca[i]);
          await tek(parca[i]);
        }
        return { kesildi: kesildi || benim !== nesil };
      },
      stop() { kesildi = true; nesil++; SS.cancel(); },
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
      // Sesli asistan: tek bir konuşmayı yazıya çevir (Whisper)
      async yaziyaCevir(blob, uzanti) {
        const f = new FormData();
        f.append("dosya", blob, "kayit." + (uzanti || "webm"));
        const v = await istek(url, "/ses", f, 60000);
        return v.metin || "";
      },
    };
  }

  // Sunucu adresi: ?sunucu=... (deneme için) ya da derlemede gömülen adres (sunucu/adres.txt)
  function adres() {
    try { const q = new URLSearchParams(location.search).get("sunucu"); if (q && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(q)) return q; } catch (e) { /* yok */ }
    return window.KAPIDA_SUNUCU || "";
  }

  window.KapidaSunucu = { create, adres, telefonSesi };
})();
