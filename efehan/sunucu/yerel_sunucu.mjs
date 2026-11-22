// Sunucuyu bilgisayarda çalıştırır (Cloudflare'e yüklemeden deneme için).
//   GROQ_API_KEY=... node sunucu/yerel_sunucu.mjs     → gerçek Groq ile
//   SAHTE=1 node sunucu/yerel_sunucu.mjs              → sahte yapay zekâ (internetsiz, testler için)
// Adres: http://localhost:8787 . Uygulamayı http://localhost:8000/kapida.html?sunucu=http://localhost:8787 ile aç
// (dist klasöründe: python -m http.server 8000).
import http from "node:http";
const worker = (await import(new URL("./worker.js", import.meta.url))).default;
const PORT = +(process.env.PORT || 8787);
const env = { GROQ_API_KEY: process.env.GROQ_API_KEY || (process.env.SAHTE ? "sahte" : ""), IZINLI_KOKENLER: process.env.IZINLI_KOKENLER || "", AYAR_URL: process.env.AYAR_URL || (process.env.SAHTE ? "yok" : "") };

// Sahte modda sıradaki ses çevirileri (sesli asistan testleri: POST /__sahte_metinler ["...", "..."])
const SAHTE_METINLER = [];
// Reçete okuma testleri: POST /__sahte_recete {...} sıradaki /recete cevabını belirler
const SAHTE_RECETE = { v: { recete_no: "1A2B3C4", hasta_ad_soyad: "Ayşe Demir", tc_kimlik: null, recete_tarihi: "14.11.2026", hekim_ad_soyad: "Dr. Mehmet Kaya", tesis: "Bornova ASM", recete_turu: "normal", ilaclar: [{ ad: "Serum fizyolojik 500 ml", doz: "1x1", kullanim: "damar içi" }], belge_kaynagi: "e-nabiz", hizmetle_uyumlu: true, bulgular: [], ozet: "e-Nabız reçete ekranı." } };
if (process.env.SAHTE) {
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("https://api.groq.com")) return gercek(url, init);
    const yan = (o) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(o) } }] }));
    if (String(url).endsWith("/audio/transcriptions")) return new Response(JSON.stringify({ text: SAHTE_METINLER.length ? SAHTE_METINLER.shift() : "Annemin topuğunda yara var gari, akıntı yapıyo" }));
    const b = JSON.parse(init.body); const kullanici = b.messages.filter((m) => m.role === "user").length;
    const ilk = b.messages[0], ilkMetin = typeof ilk.content === "string" ? ilk.content : (ilk.content[0] || {}).text || "";
    if (/REÇETE \/ HEKİM İSTEMİ BELGESİ/.test(ilkMetin)) return yan(SAHTE_RECETE.v);
    if (b.messages[0].role !== "system") return yan({ kim_icin: "Annesi", yas_araligi: "70 üstü", sikayet: "Topukta akıntılı yara", hastanin_kendi_sozleri: "topuğunda yara var gari, akıntı yapıyo", baslangic: "bir haftadır", seyir: "kötüleşiyor (beyan)", siddet_beyani: "belirtilmedi", yataga_bagimli: true, hekim_plani: "var", plan_detayi: "Aile hekimi pansuman planı yazmış (beyan)", kronik_ilac_alerji: "Şeker hastalığı (beyan)", ihtiyaclar: ["Yara pansumanı"], malzeme: ["Pansuman seti"], foto_ozeti: "", eksik_bilgiler: ["Yaranın boyutu"], hizmet_onerisi: "basi_yarasi_bakimi", oneri_gerekcesi: "Yatağa bağımlı hastada topukta akıntılı yara ve hekim planı beyan edildi.", dikkat_edilecekler: ["Şeker hastalığı beyan edildi", "Akıntı var"], hasta_icin_ozet: "Annenizin topuğundaki yara için hemşire ziyareti öneriliyor.", saglikci_icin_ozet: "Yakın beyanı: yatağa bağımlı 70+ kadın, topukta bir haftadır akıntılı yara.", tek_satir: "Topukta akıntılı yara, yatağa bağımlı" });
    const sira = [
      { reply: "Geçmiş olsun. Topuğunda yara olduğunu anladım. Bu yara ne zamandır var, kötüleşiyor mu?", quick_replies: ["Birkaç gündür", "Bir haftadır"], anlasilan: "Annenizin topuğunda akıntılı bir yara var.", ready: false },
      { reply: "Anladım. Bu yara için bir doktorun planı ya da reçetesi var mı?", quick_replies: ["Evet var", "Yok"], anlasilan: "Bir haftadır var ve kötüleşiyor.", ready: false },
      { reply: "Teşekkürler. Bilgileri hemşireye iletmek için özetliyorum.", quick_replies: [], anlasilan: "Hekim planı var.", ready: true },
    ];
    return yan(sira[Math.min(kullanici - 1, sira.length - 1)]);
  };
}
// Senaryo testleri: sıradaki sohbet/rapor cevapları (POST /__sahte_sohbet {sohbet:[...], rapor:{...}|null}).
// Öğe {durum: 429|500} hata döndürür, {gecikme: ms, ...} cevabı geciktirir. GET /__sahte_sayac istek sayılarını verir.
const SENARYO = { sohbet: [], rapor: null, sayac: { sohbet: 0, rapor: 0 }, son: { sohbet: null, rapor: null } };
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
http.createServer(async (req, res) => {
  const parcalar = []; for await (const p of req) parcalar.push(p);
  const govde = parcalar.length ? Buffer.concat(parcalar) : undefined;
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (process.env.SAHTE && req.url === "/__sahte_sohbet") { const g = JSON.parse(String(govde || "{}")); SENARYO.sohbet = g.sohbet || []; SENARYO.rapor = g.rapor || null; SENARYO.sayac = { sohbet: 0, rapor: 0 }; SENARYO.son = { sohbet: null, rapor: null }; res.writeHead(200, cors); res.end("{}"); return; }
  if (process.env.SAHTE && req.url === "/__sahte_sayac") { res.writeHead(200, cors); res.end(JSON.stringify({ ...SENARYO.sayac, kalan: SENARYO.sohbet.length, son: SENARYO.son })); return; }
  const yolu = (req.url || "").split("?")[0];
  if (process.env.SAHTE && req.method === "POST" && (yolu === "/sohbet" || yolu === "/rapor")) SENARYO.sayac[yolu.slice(1)]++; // sıradakiler bitse de say
  if (process.env.SAHTE && req.method === "POST" && ((yolu === "/sohbet" && SENARYO.sohbet.length) || (yolu === "/rapor" && SENARYO.rapor))) {
    const tur = yolu.slice(1);
    try { SENARYO.son[tur] = JSON.parse(String(govde || "{}")); } catch (e) { /* yok */ }
    const oge = tur === "sohbet" ? SENARYO.sohbet.shift() : SENARYO.rapor;
    const { durum, gecikme, ...cevap } = oge;
    if (gecikme) await bekle(gecikme);
    if (durum) { res.writeHead(durum === 429 ? 429 : 502, cors); res.end(JSON.stringify({ hata: durum === 429 ? "yogun" : "model", mesaj: "sahte", sonra: 0 })); return; }
    res.writeHead(200, { ...cors, "Access-Control-Allow-Origin": req.headers.origin || "*" }); res.end(JSON.stringify(tur === "sohbet" ? { yanit: cevap, model: "sahte" } : { rapor: cevap, model: "sahte" })); return;
  }
  if (process.env.SAHTE && req.url === "/__sahte_recete") { SAHTE_RECETE.v = JSON.parse(String(govde || "{}")); res.writeHead(200, cors); res.end("{}"); return; }
  if (process.env.SAHTE && req.url === "/__sahte_metinler") { SAHTE_METINLER.splice(0, SAHTE_METINLER.length, ...JSON.parse(String(govde || "[]"))); res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end("{}"); return; }
  if (process.env.SAHTE && req.url === "/__ses_sayisi") { res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify({ kalan: SAHTE_METINLER.length })); return; }
  // Sahte modda her istek ayrı "IP" sayılır: uzun test koşuları sunucunun IP başına istek sınırına takılmasın
  const basliklar = process.env.SAHTE ? { ...req.headers, "cf-connecting-ip": "test-" + Math.random() } : req.headers;
  const r = await worker.fetch(new Request("http://localhost:" + PORT + req.url, { method: req.method, headers: basliklar, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : govde, duplex: "half" }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`Kapıda sunucusu: http://localhost:${PORT}${process.env.SAHTE ? " (sahte yapay zekâ)" : ""}`));
