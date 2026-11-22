/* Kapıda — belge ön kontrolü (mesleki belge ve reçete için ortak). Sarp'ın prototipinden (sarp/dogrulama.html) uyarlandı.
   Dışarıdan kütüphane yüklemez (uygulama tek dosya ve çevrimdışı çalışır): PDF içeriği çizilmez, metin katmanı okunmaz.
   Yapılanlar: dosya türü/boyutu, SHA-256 özeti, ham baytlarda düzenleme yazılımı izi, PDF sonradan değiştirilmiş mi (%%EOF sayısı),
   e-imza alanı (/ByteRange), görüntüde karekod (tarayıcı BarcodeDetector destekliyorsa), sıkıştırılmamış metinde barkod/e-Reçete no,
   görüntülerden küçültülmüş JPEG (yapay zekâ okuması ve önizleme için). Dosyanın kendisi saklanmaz.
   Ön kontrol bilgi verir; belgeyi tek başına reddetmez. Kesin karar kişisel kontroldedir. */
(function () {
  "use strict";
  const MAX_BYTES = 10 * 1024 * 1024;
  const OK_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const OK_EXT = /\.(pdf|jpe?g|png|webp)$/i;
  const EDIT_TOOLS = ["Photoshop", "GIMP", "Canva", "Pixelmator", "Affinity", "Paint.NET", "PicsArt", "Fotor", "iLovePDF", "Smallpdf", "Sejda", "PDFescape",
    "PDF-XChange", "Nitro", "PDFelement", "Foxit PhantomPDF", "Inkscape", "CorelDRAW", "Microsoft Word", "LibreOffice"];
  const SAFE_HOSTS = ["turkiye.gov.tr", "saglik.gov.tr", "yok.gov.tr", "enabiz.gov.tr", "gov.tr", "edu.tr"];
  // Seviye → [pill sınıfı, etiket]
  const LV = { kritik: ["coral", "Kritik"], yuksek: ["coral", "Yüksek"], orta: ["sun", "Orta"], bilgi: ["plain", "Bilgi"], ok: ["good", "Olumlu"] };
  const fl = (lv, code, text) => ({ lv, code, text });
  const normB = (s) => String(s || "").toLocaleUpperCase("tr").replace(/[^A-Z0-9]/g, "");

  function dosyaHatasi(file) {
    if (!file) return "Dosya seçilemedi.";
    if (!(OK_MIME.includes(file.type) || OK_EXT.test(file.name || ""))) return "Bu dosya türü kabul edilmiyor. PDF, JPG ya da PNG seç.";
    if (file.size > MAX_BYTES) return `Dosya çok büyük (${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB). En fazla 10 MB olabilir.`;
    if (file.size === 0) return "Dosya boş görünüyor. Başka bir dosya seç.";
    return "";
  }

  async function ozet(buf) {
    try { const h = await crypto.subtle.digest("SHA-256", buf); return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join(""); }
    catch (e) { return ""; }
  }
  function gorsel(file, maxPx) {
    return new Promise((res) => {
      const u = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.naturalWidth * s)); cv.height = Math.max(1, Math.round(img.naturalHeight * s));
        const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u); res({ cv, img });
      };
      img.onerror = () => { URL.revokeObjectURL(u); res(null); };
      img.src = u;
    });
  }
  async function karekod(kaynak) {
    try {
      if (!("BarcodeDetector" in window)) return null;
      const d = new window.BarcodeDetector({ formats: ["qr_code"] });
      const r = await d.detect(kaynak);
      return r && r[0] && r[0].rawValue ? String(r[0].rawValue) : null;
    } catch (e) { return null; }
  }

  // Dosyayı oku: { ad, tur, boyut, isPdf, hash, raw, imza, eof, resim (dataURL|null), qr }
  async function oku(file, { maxPx = 1600 } = {}) {
    const buf = await file.arrayBuffer();
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    const u8 = new Uint8Array(buf), lim = Math.min(u8.length, 6e6);
    let raw = "";
    for (let i = 0; i < lim; i += 65536) raw += String.fromCharCode.apply(null, u8.subarray(i, Math.min(lim, i + 65536)));
    const out = { ad: file.name || "belge", tur: file.type || "", boyut: file.size, isPdf, hash: await ozet(buf), raw, imza: /\/ByteRange\s*\[/.test(raw) || /\/Type\s*\/Sig\b/.test(raw),
      eof: (raw.match(/%%EOF/g) || []).length, resim: null, qr: null };
    if (!isPdf) {
      const g = await gorsel(file, maxPx);
      if (g) { out.resim = g.cv.toDataURL("image/jpeg", 0.82); out.qr = await karekod(g.cv); }
    }
    return out;
  }

  // Karekoddan ya da sıkıştırılmamış metinden barkod (e-Devlet belge doğrulama kodu)
  function barkodBul(doc) {
    if (doc && doc.qr) {
      try { const u = new URL(doc.qr); for (const [k, v] of u.searchParams) if (/barkod|belge|dogrulama|kod|no/i.test(k) && normB(v).length >= 8) return { v: v.toUpperCase().trim(), src: "karekod" }; }
      catch (e) { if (/^[A-Z0-9ÇĞİÖŞÜ\-\s]{8,40}$/i.test(doc.qr.trim())) return { v: doc.qr.trim().toUpperCase(), src: "karekod" }; }
    }
    const m = String((doc && doc.raw) || "").match(/(?:Barkod|Do[gğ]rulama)\s*(?:No|Numaras[ıi]|Kodu)?\s*[:：]?\s*([A-Z0-9][A-Z0-9\-]{7,40})/i);
    return m ? { v: m[1].toUpperCase(), src: "belge metni" } : null;
  }

  // Dosyanın kendisinden çıkan bulgular (içerik okunmadan)
  function dosyaBulgulari(doc, { pdfBekleniyor = true } = {}) {
    const f = [];
    const low = doc.raw.toLowerCase(), izler = EDIT_TOOLS.filter((x) => low.includes(x.toLowerCase()));
    if (izler.length) f.push(fl(izler.every((x) => /Word|LibreOffice/.test(x)) ? "orta" : "yuksek", "edit_tool", `Dosyada düzenleme/tasarım yazılımı izi: ${izler.join(", ")}. Resmî çıktıda beklenmez.`));
    if (doc.isPdf) {
      if (doc.imza) f.push(fl("ok", "esig", "PDF'te elektronik imza alanı var."));
      if (doc.eof > 1 && !doc.imza) f.push(fl("orta", "pdf_incremental", `PDF oluşturulduktan sonra ${doc.eof - 1} kez değiştirilmiş görünüyor.`));
    } else if (pdfBekleniyor) f.push(fl("orta", "not_pdf", "Belge PDF değil, görüntü olarak yüklenmiş. e-Devlet'ten PDF indirilmesi istenir."));
    if (doc.qr) {
      let host = ""; try { host = new URL(doc.qr).hostname.toLowerCase(); } catch (e) { /* düz metin */ }
      if (host) f.push(SAFE_HOSTS.some((h) => host === h || host.endsWith("." + h)) ? fl("ok", "qr_safe", `Karekod resmî adrese gidiyor: ${host}`) : fl("kritik", "qr_unsafe", `Karekod resmî olmayan bir siteye gidiyor: ${host}.`));
    }
    return f;
  }
  const risk = (flags) => Math.min(100, flags.reduce((a, x) => a + ({ kritik: 40, yuksek: 20, orta: 8 }[x.lv] || 0), 0));
  function bayrakHtml(flags, esc) {
    const l = (flags || []).filter((x) => x && x.text);
    return l.length ? `<ul class="belge-bayrak">${l.map((x) => `<li><span class="pill ${(LV[x.lv] || LV.bilgi)[0]}">${(LV[x.lv] || LV.bilgi)[1]}</span><span>${esc(x.text)}</span></li>`).join("")}</ul>` : "";
  }
  // T.C. kimlik numarası algoritması (yalnızca belgede okunan numara için; uygulama T.C. istemez)
  function tcGecerli(tc) {
    if (!/^[1-9]\d{10}$/.test(tc)) return false;
    const d = tc.split("").map(Number), d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
    return ((d10 + 10) % 10) === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
  }
  // Ad benzerliği (Levenshtein, 0–1)
  function benzer(a, b) {
    const n = (s) => String(s || "").toLocaleUpperCase("tr").replace(/[^A-ZÇĞİÖŞÜ0-9]/g, "");
    a = n(a); b = n(b); if (!a || !b) return 0;
    const m = []; for (let i = 0; i <= a.length; i++) { m[i] = [i]; for (let j = 1; j <= b.length; j++) m[i][j] = i ? Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; }
    return 1 - m[a.length][b.length] / Math.max(a.length, b.length);
  }
  function tarihOku(s) {
    if (!s) return null;
    let m = String(s).match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  window.KapidaBelge = { MAX_BYTES, LV, EDIT_TOOLS, dosyaHatasi, oku, barkodBul, dosyaBulgulari, risk, bayrakHtml, tcGecerli, benzer, tarihOku, normB, fl };
})();
