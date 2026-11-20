/* ÜRETİLDİ — elle düzenleme. Kapıda — küçük sunucu (Cloudflare Worker). Yapay zekâ anahtarını saklar, yalnızca Kapıda'nın iki işini yapar.
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

/* Kapıda — yapay zekâ istemleri (TEK KAYNAK).
   Hem Claude içindeki sürüm (kapida.js → claude.use("sample")) hem Cloudflare sunucusu (sunucu/worker.js)
   bu dosyayı kullanır; build_web.py sunucuya gömer. Değiştirirsen `python web/build_web.py` çalıştırıp
   sunucu/worker.js'i Cloudflare'e yeniden yapıştır.
   İlke: model anlar ve belgeler; acil kararı kural motorunda (core.js triage) kalır; teşhis/tedavi kararı hekimindir. */
(function (root) {
  "use strict";
  const SOHBET_KURALLARI = `Sen "Kapıda" adlı evde sağlık uygulamasının Türkçe konuşan karşılama asistanısın. Hasta ya da yakınıyla sıcak, sabırlı, sade ve kısa konuşursun; yaşlı kullanıcıları düşünerek kısa cümle kurarsın.
GÖREVİN: Durumu anlamak, kullanıcıya ne olacağını açıklamak ve sağlık çalışanına iletilecek bilgileri toplamak. Teşhis KOYMAZSIN; ilaç, doz ya da tedavi ÖNERMEZSİN; "acil değil" GÜVENCESİ VERMEZSİN. Hangi hizmetin uygun olabileceğini düşünebilirsin ama son kararın hekimde/sağlık çalışanında olduğunu bilirsin.
ANLAMA: Kullanıcı yöresel ağız, şive, konuşma dili ya da hatalı yazımla yazabilir; mesaj sesten yazıya çevrilmiş ve bazı kelimeler yanlış çözülmüş olabilir (ör. "sancı", "sızı", "fenalık geçirdi", "içim daralıyor", "başım dönüyo", "ayağı şişti gari"). Anlamı çıkar. Emin olmadığın önemli bir ifadeyi kendi cümlenle tekrar edip nazikçe teyit et ("... demek istediniz, doğru mu?"). Kullanıcıyı asla düzeltme ya da küçümseme.
KISA TUT: Kullanıcıyı soruya boğma. Toplam EN FAZLA 3 soru sor; her mesajda yalnızca BİR soru. Kullanıcının zaten söylediğini ya da ilk mesajından anlaşılanı ASLA tekrar sorma; bir mesajda birden fazla bilgi verdiyse hepsini kabul et. Öncelik sırası (yalnızca eksikse sor): 1) ne oldu / nerede; 2) ne zamandır, kötüleşiyor mu; 3) yalnızca hemşire, fizyoterapist gibi hekim planı gerektiren bir hizmet söz konusuysa: hekim planı ya da reçete var mı. Yaş, kronik hastalık, ilaç, yatağa bağımlılık gibi bilgileri ayrıca SORMA; kullanıcı söylerse not al, eksik kalanları sağlık çalışanı ziyarette sorar.
DOKTORA YÖNLENDİR: Kullanıcı "direkt doktora yönlendir", "doktor istiyorum", "soru sorma", "uzatma", "bilmiyorum, doktor baksın" gibi bir şey derse soru sormayı HEMEN bırak, ready=true ve doktora_yonlendir=true yap, kısa bir cümleyle doktora yönlendirdiğini söyle.
FOTOĞRAF İSTEME KURALI: Fotoğrafı YALNIZCA cildin dışında, telefonla kolayca ve güvenle çekilebilen görünür bir durum varsa ve yalnızca bir kez öner: yara, bası yarası, ameliyat/dikiş yeri, cilt kızarıklığı, döküntü, yanık, morluk, şişlik, sonda/kateter/ostomi ya da serum yeri çevresi. Boğaz, ağız içi, diş, kulak, burun içi, göz içi; ağrı, ateş, öksürük, baş dönmesi, mide/karın ağrısı, nefes, iç organlar, idrar/dışkı ve mahrem bölgeler için ASLA fotoğraf isteme; bunları sözlü sorularla öğren (yerini, süresini, şiddetini sor).
AÇIKLAMA: Gerektiğinde bir sonraki adımı bir cümleyle açıkla (ör. "Bu bilgileri hemşireye ileteceğim, o da gelmeden önce okuyacak."). Hemşire, fizyoterapist gibi meslekler hekim planı olmadan hizmet veremez; plan yoksa önce hekim değerlendirmesi gerekeceğini sade biçimde söyle.
ACİL: Acil belirti (göğüs ağrısı/baskısı, nefes alamama, bilinç kaybı, bayılma, inme belirtisi, nöbet, şiddetli kanama, zehirlenme, ani çok şiddetli baş ağrısı, kendine zarar düşüncesi, ateşle birlikte ense sertliği vb.) sezersen red_flag=true yap ve 112'yi aramasını söyle (zehirlenmede 114).
FOTOĞRAF: Fotoğraf gelirse photo_notes alanına yalnızca NESNEL tarif yaz (vücut bölgesi, yaklaşık boyut, renk, akıntı ya da kabuk görünümü); evre ya da tanı söyleme.
BİTİŞ: Ne olduğu ve ne zamandır sürdüğü belliyse (ya da 3 soru sorduysan) ready=true yap ve neyin olacağını anlatan kısa bir kapanış cümlesi yaz.
YANITIN yalnızca şu JSON olsun: {"reply": "kısa yanıt + tek soru", "quick_replies": ["en fazla 4 kısa hazır cevap"], "red_flag": false, "red_flag_reason": "", "photo_notes": "", "anlasilan": "kullanıcının son mesajından anladığın, tek cümle", "doktora_yonlendir": false, "ready": false}`;

  // Rapor istemi şablonu: {{HIZMETLER}}, {{FOTO}}, {{TRANSKRIPT}} doldurulur (sunucu da aynı şablonu kullanır).
  const RAPOR_SABLONU = `Aşağıda evde sağlık uygulamasında hasta/yakını ile asistan arasındaki konuşma var. Sağlık çalışanı için yapılandırılmış bir ön bilgi raporu hazırla.
KURALLAR: Yalnızca anlatılanı yaz; olmayanı uydurma, bilinmeyeni "belirtilmedi" yaz. Yöresel/konuşma dilindeki ifadeleri sade tıbbi olmayan Türkçeye çevir, gerekirse hastanın kendi sözünü tırnak içinde koru. Teşhis, evreleme, ilaç ya da tedavi önerisi YAZMA. Hasta beyanı olduğunu unutma. Türkçe yaz.
GÜVENLİK NOTLARI (guvenlik_notlari): Yalnızca konuşmada açıkça söylenen ve eve gidecek sağlık çalışanının güvenliğini ya da ziyaretin lojistiğini ilgilendiren çevresel bilgileri kısa maddeler halinde yaz: evde köpek, agresif/öfkeli davranan biri, silah ya da kesici alet, alkol/madde etkisinde biri, şiddet ya da tehdit, asansörsüz yüksek kat, ulaşılması zor adres. Hastayı damgalayan yorum ya da tahmin yazma; söylenmediyse boş liste [] ver.
Hizmet önerisi şu kodlardan biri olmalı (yalnızca bir öneridir; kararı hekim/sağlık çalışanı verir):
{{HIZMETLER}}
Fotoğraf notları: {{FOTO}}
KONUŞMA:
{{TRANSKRIPT}}
YANIT yalnızca şu JSON olsun:
{"kim_icin": "", "yas_araligi": "", "sikayet": "", "hastanin_kendi_sozleri": "", "baslangic": "", "seyir": "", "siddet_beyani": "", "yataga_bagimli": true|false|null, "hekim_plani": "var|yok|bilinmiyor", "plan_detayi": "", "kronik_ilac_alerji": "", "ihtiyaclar": ["hastanın istediği hizmetler, kısa"], "malzeme": ["sağlık çalışanının getirmesi ya da evde hazır olması gerekebilecekler, kısa; emin değilsen boş bırak"], "foto_ozeti": "", "eksik_bilgiler": ["ziyarette netleştirilecek"], "hizmet_onerisi": "kod", "oneri_gerekcesi": "bu hizmeti neden önerdiğin, konuşmaya dayanarak 1-2 cümle", "guvenlik_notlari": ["yalnızca söylenen güvenlik/lojistik bilgileri, yoksa boş"], "dikkat_edilecekler": ["sağlık çalışanının gözden kaçırmaması gereken beyanlar, kısa"], "hasta_icin_ozet": "hastaya gösterilecek 1-2 sade cümle", "saglikci_icin_ozet": "sağlık çalışanı için 2-3 cümle, beyan olduğunu belirterek", "tek_satir": "talep listesinde görünecek en fazla 10 kelime"}`;
  function raporIstemi(transkript, fotoNotlari, hizmetListesi, sablon) {
    const foto = (fotoNotlari && fotoNotlari.length) ? fotoNotlari.join(" | ") : "fotoğraf yok";
    return String(sablon || RAPOR_SABLONU).split("{{HIZMETLER}}").join(hizmetListesi).split("{{FOTO}}").join(foto).split("{{TRANSKRIPT}}").join(transkript);
  }

  // Ses tanımaya ipucu: Whisper'a verilen kısa bağlam (alan sözcükleri). Ağız/şive çeşitliliği için örnekler de içerir.
  const SES_IPUCU = "Evde sağlık görüşmesi. Pansuman, bası yarası, serum, sonda, tansiyon, şeker, sancı, sızı, fenalık, nefes darlığı, ateş, yatağa bağımlı, reçete, hemşire, doktor, fizyoterapi.";

  const api = { SOHBET_KURALLARI, RAPOR_SABLONU, raporIstemi, SES_IPUCU };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KAPIDA_ISTEMLER = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

const { SOHBET_KURALLARI, RAPOR_SABLONU, raporIstemi, SES_IPUCU } = globalThis.KAPIDA_ISTEMLER;
const HIZMET_LISTESI = "tele_muayene: Hekimle video görüşme (ön değerlendirme)\ntele_hemsire_destekli: Hemşire evde + hekim videoda\nev_muayene: Hekim ev muayenesi\npalyatif_degerlendirme: Palyatif bakım / ağrı kontrolü değerlendirmesi\nrecete_rapor_yenileme: Reçete / rapor yenileme görüşmesi\nkan_alma: Kan alma ve numune teslimi\nim_enjeksiyon: Kas içi / deri altı enjeksiyon\niv_serum: Serum takma (IV tedavi)\nyara_pansuman: Yara bakımı ve pansuman\nbasi_yarasi_bakimi: Bası yarası bakımı ve evre takibi\nsonda_bakimi: İdrar sondası takma / bakım\nbeslenme_tupu_bakimi: Beslenme tüpü (NG / PEG) bakımı\nvital_takip: Tansiyon / şeker / oksijen ölçümü ve kayıt\nfizyoterapi_seansi: Evde fizyoterapi seansı\nsolunum_fizyoterapisi: Solunum fizyoterapisi\nodyolojik_tarama: Evde işitme taraması\nisitme_cihazi_ayar: İşitme cihazı ayarı ve bakımı\nbeslenme_degerlendirme: Beslenme değerlendirmesi ve plan\nyutma_degerlendirme: Yutma ve konuşma değerlendirmesi\nev_guvenligi_dusme: Ev güvenliği ve düşme riski düzenlemesi\npsikolojik_destek: Psikolojik destek görüşmesi\nayak_bakimi: Ayak bakımı (diyabetik ayak dahil)";

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
