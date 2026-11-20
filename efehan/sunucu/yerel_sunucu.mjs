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
if (process.env.SAHTE) {
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("https://api.groq.com")) return gercek(url, init);
    const yan = (o) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(o) } }] }));
    if (String(url).endsWith("/audio/transcriptions")) return new Response(JSON.stringify({ text: SAHTE_METINLER.length ? SAHTE_METINLER.shift() : "Annemin topuğunda yara var gari, akıntı yapıyo" }));
    const b = JSON.parse(init.body); const kullanici = b.messages.filter((m) => m.role === "user").length;
    if (b.messages[0].role !== "system") return yan({ kim_icin: "Annesi", yas_araligi: "70 üstü", sikayet: "Topukta akıntılı yara", hastanin_kendi_sozleri: "topuğunda yara var gari, akıntı yapıyo", baslangic: "bir haftadır", seyir: "kötüleşiyor (beyan)", siddet_beyani: "belirtilmedi", yataga_bagimli: true, hekim_plani: "var", plan_detayi: "Aile hekimi pansuman planı yazmış (beyan)", kronik_ilac_alerji: "Şeker hastalığı (beyan)", ihtiyaclar: ["Yara pansumanı"], malzeme: ["Pansuman seti"], foto_ozeti: "", eksik_bilgiler: ["Yaranın boyutu"], hizmet_onerisi: "basi_yarasi_bakimi", oneri_gerekcesi: "Yatağa bağımlı hastada topukta akıntılı yara ve hekim planı beyan edildi.", dikkat_edilecekler: ["Şeker hastalığı beyan edildi", "Akıntı var"], hasta_icin_ozet: "Annenizin topuğundaki yara için hemşire ziyareti öneriliyor.", saglikci_icin_ozet: "Yakın beyanı: yatağa bağımlı 70+ kadın, topukta bir haftadır akıntılı yara.", tek_satir: "Topukta akıntılı yara, yatağa bağımlı" });
    const sira = [
      { reply: "Geçmiş olsun. Topuğunda yara olduğunu anladım. Bu yara ne zamandır var, kötüleşiyor mu?", quick_replies: ["Birkaç gündür", "Bir haftadır"], anlasilan: "Annenizin topuğunda akıntılı bir yara var.", ready: false },
      { reply: "Anladım. Bu yara için bir doktorun planı ya da reçetesi var mı?", quick_replies: ["Evet var", "Yok"], anlasilan: "Bir haftadır var ve kötüleşiyor.", ready: false },
      { reply: "Teşekkürler. Bilgileri hemşireye iletmek için özetliyorum.", quick_replies: [], anlasilan: "Hekim planı var.", ready: true },
    ];
    return yan(sira[Math.min(kullanici - 1, sira.length - 1)]);
  };
}
http.createServer(async (req, res) => {
  const parcalar = []; for await (const p of req) parcalar.push(p);
  const govde = parcalar.length ? Buffer.concat(parcalar) : undefined;
  if (process.env.SAHTE && req.url === "/__sahte_metinler") { SAHTE_METINLER.splice(0, SAHTE_METINLER.length, ...JSON.parse(String(govde || "[]"))); res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end("{}"); return; }
  if (process.env.SAHTE && req.url === "/__ses_sayisi") { res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify({ kalan: SAHTE_METINLER.length })); return; }
  const r = await worker.fetch(new Request("http://localhost:" + PORT + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : govde, duplex: "half" }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`Kapıda sunucusu: http://localhost:${PORT}${process.env.SAHTE ? " (sahte yapay zekâ)" : ""}`));
