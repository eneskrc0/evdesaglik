/* Kapıda — küçük sunucu (Cloudflare Worker). Yapay zekâ anahtarını saklar, yalnızca Kapıda'nın iki işini yapar.
   BU DOSYA ÜRETİLİR: düzenleme için efehan/sunucu/worker_sablon.js ve efehan/web/istemler.js; sonra
   `python efehan/web/build_web.py` → efehan/sunucu/worker.js. Cloudflare'e worker.js'in TAMAMINI yapıştır.

   Uç noktalar:
     GET  /        → sağlık kontrolü {ok, model}
     POST /ses     → ses kaydı (multipart "dosya") → {metin}           (Groq Whisper)
     POST /sohbet  → {turlar, foto_notlari, resimler} → {yanit}       (sohbet istemi sunucuda)
     POST /rapor   → {transkript, foto_notlari, resimler} → {rapor}   (rapor istemi sunucuda)
   Ayarlar (Cloudflare → Settings → Variables and Secrets):
     GROQ_API_KEY   (Secret, ZORUNLU)  — kimseyle paylaşma, GitHub'a koyma
     IZINLI_KOKENLER (isteğe bağlı) — virgülle ayrılmış site adresleri; boşsa aşağıdaki varsayılan
     MODEL, GORSEL_MODEL, SES_MODEL (isteğe bağlı) — model adları (verilirse ayar.json'dakini ezer)
     AYAR_URL (isteğe bağlı) — talimat dosyası adresi; varsayılan GitHub main'deki efehan/sunucu/ayar.json, "yok" = kapalı
   Canlı ayar: sohbet talimatı, rapor şablonu, ses ipucu, hizmet listesi ve model adları her dakika GitHub'daki
   X
   Okunamazsa bu dosyaya gömülü sürüm kullanılır. Kod (bu dosya) değişirse yine Cloudflare'e yapıştırmak gerekir.
   Gizlilik: sunucu hiçbir şeyi kaydetmez; istek yalnızca Groq'a iletilir. Prototip: gerçek hasta verisi girmeyin. */

/*__ISTEMLER__*/
const HIZMET_LISTESI = /*__HIZMETLER__*/"";

const GOMULU = { surum: "gomulu", sohbet_kurallari: SOHBET_KURALLARI, rapor_sablonu: RAPOR_SABLONU, ses_ipucu: SES_IPUCU, hizmetler: HIZMET_LISTESI, modeller: {} };
const AYAR_URL = "https://raw.githubusercontent.com/eneskrc0/evdesaglik/main/efehan/sunucu/ayar.json";
let ayarOnbellek = null, ayarZaman = 0, ayarKaynak = "gomulu";
function ayarGecerli(a) {
  const metin = (x, en) => typeof x === "string" && x.length > 20 && x.length <= en;
  return a && metin(a.sohbet_kurallari, 30000) && metin(a.rapor_sablonu, 30000) && a.rapor_sablonu.includes("{{TRANSKRIPT}}")
    && metin(a.hizmetler, 20000) && typeof a.ses_ipucu === "string" && a.ses_ipucu.length <= 2000;
}
async function ayarlar(env) {
  if (ayarOnbellek && Date.now() - ayarZaman < 60000) return ayarOnbellek;
  const url = env.AYAR_URL || AYAR_URL;
  if (url !== "yok") {
    try {
      const r = await fetch(url, { cf: { cacheTtl: 60 } });
      if (r.ok) {
        const a = await r.json();
        if (ayarGecerli(a)) { ayarOnbellek = a; ayarZaman = Date.now(); ayarKaynak = "github"; return a; }
      }
    } catch (e) { /* gömülüye düş */ }
  }
  ayarZaman = Date.now(); // başarısızlıkta da bir dakika bekle
  if (!ayarOnbellek) { ayarOnbellek = GOMULU; ayarKaynak = "gomulu"; }
  return ayarOnbellek;
}
const modelAdi = (env, ayar, ad) => env[ad] || (ayar.modeller && ayar.modeller[ad]) || VARSAYILAN[ad];

const VARSAYILAN_KOKENLER = ["https://eneskrc0.github.io", "https://raw.githack.com", "http://localhost:8000", "http://127.0.0.1:8000"];
const GROQ = "https://api.groq.com/openai/v1";
const VARSAYILAN = { MODEL: "openai/gpt-oss-120b", GORSEL_MODEL: "qwen/qwen3.8-27b", SES_MODEL: "whisper-large-v3" };
const SINIR = { sesBayt: 10 * 1024 * 1024, tur: 40, turKarakter: 2000, transkript: 20000, resim: 3, resimKarakter: 1_600_000, istekPencereSn: 600, istekSayisi: 60 };

// Basit kötüye kullanım sınırı: IP başına 10 dakikada 60 istek (yalnızca aynı sunucu örneği içinde; kaba bir korumadır).
const sayac = new Map();
function sinirAsildi(ip) {
  const simdi = Date.now(), pencere = SINIR.istekPencereSn * 1000;
  const k = sayac.get(ip) || [];
  const taze = k.filter((t) => simdi - t < pencere);
  taze.push(simdi);
  sayac.set(ip, taze);
  if (sayac.size > 5000) sayac.clear();
  return taze.length > SINIR.istekSayisi;
}

function kokenler(env) {
  const s = (env.IZINLI_KOKENLER || "").split(",").map((x) => x.trim()).filter(Boolean);
  return s.length ? s : VARSAYILAN_KOKENLER;
}
function corsBasliklari(koken) {
  return { "Access-Control-Allow-Origin": koken, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}
function json(veri, durum, koken) {
  return new Response(JSON.stringify(veri), { status: durum || 200, headers: { "Content-Type": "application/json; charset=utf-8", ...(koken ? corsBasliklari(koken) : {}) } });
}
const hata = (kod, mesaj, durum, koken) => json({ hata: kod, mesaj }, durum, koken);

function jsonCikar(metin) {
  if (!metin) return null;
  try { return JSON.parse(metin); } catch (e) { /* devam */ }
  const a = metin.indexOf("{"), b = metin.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(metin.slice(a, b + 1)); } catch (e) { /* yok */ } }
  return null;
}

async function groqSohbet(env, ayar, mesajlar, resimler) {
  const gorsel = resimler && resimler.length;
  const model = modelAdi(env, ayar, gorsel ? "GORSEL_MODEL" : "MODEL");
  if (gorsel) {
    // Görselleri son kullanıcı mesajına ekle (OpenAI uyumlu biçim)
    const son = mesajlar[mesajlar.length - 1];
    son.content = [{ type: "text", text: son.content }, ...resimler.map((u) => ({ type: "image_url", image_url: { url: u } }))];
  }
  const govde = { model, messages: mesajlar, temperature: 0.3, max_completion_tokens: 1500, response_format: { type: "json_object" } };
  for (let deneme = 0; deneme < 2; deneme++) {
    const r = await fetch(GROQ + "/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + env.GROQ_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(govde) });
    if (r.status === 429) return { hata: "yogun" };
    const v = await r.json().catch(() => null);
    if (!r.ok) {
      // JSON kipi ya da görsel desteklenmiyorsa bir kez sade istekle dene
      if (deneme === 0 && r.status === 400) {
        delete govde.response_format;
        if (gorsel) { govde.model = modelAdi(env, ayar, "MODEL"); const son = govde.messages[govde.messages.length - 1]; son.content = son.content[0].text + " [fotoğraf eklendi; görsel incelenemedi]"; }
        continue;
      }
      return { hata: "model", ayrinti: (v && v.error && v.error.message) || r.status };
    }
    const metin = v && v.choices && v.choices[0] && v.choices[0].message && v.choices[0].message.content;
    const sonuc = jsonCikar(metin);
    if (sonuc) return { sonuc, model: govde.model };
    if (deneme === 0) { govde.messages = [...govde.messages, { role: "user", content: "Yanıtın geçerli JSON değildi. Yalnızca istenen JSON nesnesini yaz." }]; continue; }
    return { hata: "bicim" };
  }
  return { hata: "bicim" };
}

function resimleriDenetle(resimler) {
  if (!Array.isArray(resimler)) return [];
  return resimler.filter((u) => typeof u === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(u) && u.length <= SINIR.resimKarakter).slice(0, SINIR.resim);
}

async function sohbet(istek, env) {
  const g = await istek.json().catch(() => null);
  if (!g || !Array.isArray(g.turlar) || !g.turlar.length) return { durum: 400, veri: { hata: "girdi", mesaj: "turlar gerekli" } };
  const turlar = g.turlar.slice(-SINIR.tur).filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, SINIR.turKarakter) }));
  if (!turlar.length || turlar[turlar.length - 1].role !== "user") return { durum: 400, veri: { hata: "girdi", mesaj: "son tur kullanıcıdan olmalı" } };
  const notlar = Array.isArray(g.foto_notlari) ? g.foto_notlari.slice(0, 6).map((x) => String(x).slice(0, 400)) : [];
  const ayar = await ayarlar(env);
  const sistem = ayar.sohbet_kurallari + (notlar.length ? `\nŞimdiye kadarki fotoğraf notları: ${notlar.join(" | ")}` : "");
  const r = await groqSohbet(env, ayar, [{ role: "system", content: sistem }, ...turlar], resimleriDenetle(g.resimler));
  if (r.hata) return { durum: r.hata === "yogun" ? 429 : 502, veri: { hata: r.hata, mesaj: String(r.ayrinti || "") } };
  return { durum: 200, veri: { yanit: r.sonuc, model: r.model } };
}

async function rapor(istek, env) {
  const g = await istek.json().catch(() => null);
  if (!g || typeof g.transkript !== "string" || !g.transkript.trim()) return { durum: 400, veri: { hata: "girdi", mesaj: "transkript gerekli" } };
  const notlar = Array.isArray(g.foto_notlari) ? g.foto_notlari.slice(0, 6).map((x) => String(x).slice(0, 400)) : [];
  const ayar = await ayarlar(env);
  const istem = raporIstemi(g.transkript.slice(0, SINIR.transkript), notlar, ayar.hizmetler, ayar.rapor_sablonu);
  const r = await groqSohbet(env, ayar, [{ role: "user", content: istem }], resimleriDenetle(g.resimler));
  if (r.hata) return { durum: r.hata === "yogun" ? 429 : 502, veri: { hata: r.hata, mesaj: String(r.ayrinti || "") } };
  return { durum: 200, veri: { rapor: r.sonuc, model: r.model } };
}

async function ses(istek, env) {
  const form = await istek.formData().catch(() => null);
  const dosya = form && form.get("dosya");
  if (!dosya || typeof dosya === "string") return { durum: 400, veri: { hata: "girdi", mesaj: "dosya gerekli" } };
  if (dosya.size > SINIR.sesBayt) return { durum: 413, veri: { hata: "buyuk", mesaj: "ses kaydı 10 MB'tan büyük" } };
  const ayar = await ayarlar(env);
  const f = new FormData();
  f.append("file", dosya, dosya.name || "kayit.webm");
  f.append("model", modelAdi(env, ayar, "SES_MODEL"));
  f.append("language", "tr");
  f.append("prompt", ayar.ses_ipucu || SES_IPUCU);
  f.append("response_format", "json");
  f.append("temperature", "0");
  const r = await fetch(GROQ + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + env.GROQ_API_KEY }, body: f });
  if (r.status === 429) return { durum: 429, veri: { hata: "yogun" } };
  const v = await r.json().catch(() => null);
  if (!r.ok || !v) return { durum: 502, veri: { hata: "ses", mesaj: String((v && v.error && v.error.message) || r.status) } };
  return { durum: 200, veri: { metin: String(v.text || "").trim() } };
}

export default {
  async fetch(istek, env) {
    const koken = istek.headers.get("Origin");
    const izinli = koken && kokenler(env).includes(koken) ? koken : null;
    const yol = new URL(istek.url).pathname.replace(/\/+$/, "") || "/";
    if (istek.method === "OPTIONS") return izinli ? new Response(null, { status: 204, headers: corsBasliklari(izinli) }) : new Response(null, { status: 403 });
    if (istek.method === "GET" && yol === "/") {
      const ayar = await ayarlar(env);
      return json({ ok: true, ad: "kapida-sunucu", model: modelAdi(env, ayar, "MODEL"), anahtar: !!env.GROQ_API_KEY, ayar: ayar.surum || "?", ayar_kaynagi: ayarKaynak }, 200, izinli);
    }
    if (!izinli) return hata("koken", "Bu sunucu yalnızca Kapıda sayfasından kullanılabilir.", 403, null);
    if (!env.GROQ_API_KEY) return hata("ayar", "GROQ_API_KEY tanımlı değil.", 500, izinli);
    if (istek.method !== "POST") return hata("yontem", "POST bekleniyor", 405, izinli);
    if (sinirAsildi(istek.headers.get("CF-Connecting-IP") || "?")) return hata("sinir", "Çok fazla istek; biraz sonra tekrar deneyin.", 429, izinli);
    try {
      const is = { "/sohbet": sohbet, "/rapor": rapor, "/ses": ses }[yol];
      if (!is) return hata("yok", "Bilinmeyen adres", 404, izinli);
      const { durum, veri } = await is(istek, env);
      return json(veri, durum, izinli);
    } catch (e) {
      return hata("sunucu", "Beklenmeyen hata", 500, izinli);
    }
  },
};
