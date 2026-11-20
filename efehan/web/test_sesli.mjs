// Sesli asistanın saf parçaları: VAD, seslendirme metni, cümle bölme, Whisper halüsinasyon filtresi, denetleyici döngüsü.
// Çalıştır: node web/test_sesli.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("./sesli.js");
let ok = 0;
const check = (c, m) => { if (!c) { console.error("  ✗", m); process.exit(1); } ok++; console.log("  ✓", m); };

// ---- VAD: sentetik ses seviyesi dizileri (50 ms adım) ----
function calistir(seviyeler, o) {
  const v = S.VAD(o); const olaylar = [];
  seviyeler.forEach((r, i) => { const e = v.adim(r, i * 50); if (e) olaylar.push([e, i * 50]); });
  return olaylar;
}
const sessiz = (ms, r = 0.003) => Array(Math.round(ms / 50)).fill(r);
const konus = (ms) => Array.from({ length: Math.round(ms / 50) }, (_, i) => 0.05 + 0.04 * Math.sin(i)); // hece dalgalanması
let o = calistir([...sessiz(500), ...konus(1500), ...sessiz(1500)]);
check(o.length === 2 && o[0][0] === "basladi" && o[1][0] === "bitti", "konuşma başı ve sonu bulundu");
check(o[1][1] >= 2000 + 1000 && o[1][1] <= 2000 + 1300, `konuşma bitince ~1,1 sn sessizlikten sonra bitti (${o[1][1]} ms)`);
o = calistir([...sessiz(500), ...konus(800), ...sessiz(600), ...konus(800), ...sessiz(1500)]);
check(o.filter((x) => x[0] === "bitti").length === 1 && o[1][1] > 2700, "cümle arasındaki kısa duraklama konuşmayı bitirmez");
o = calistir(sessiz(10000));
check(o.length === 1 && o[0][0] === "sessiz" && o[0][1] >= 9000, "hiç konuşulmazsa 9 sn sonra 'sessiz'");
o = calistir([...sessiz(400), ...Array(4).fill(0.08), ...sessiz(9000)]);
check(!o.some((x) => x[0] === "basladi"), "kısa tıkırtı (200 ms) konuşma sayılmaz");
o = calistir([...sessiz(300, 0.02), ...sessiz(1000, 0.022), ...konus(1200).map((x) => x + 0.05), ...sessiz(1500, 0.02)]);
check(o[0] && o[0][0] === "basladi" && o[1] && o[1][0] === "bitti", "gürültülü ortamda taban kalibre ediliyor (taban 0,02)");
o = calistir([...sessiz(300, 0.02), ...sessiz(9000, 0.03)]);
check(!o.some((x) => x[0] === "basladi"), "gürültü tabanındaki küçük artış konuşma sanılmaz");
o = calistir([...sessiz(300), ...konus(50000)]);
check(o[o.length - 1][0] === "bitti" && o[o.length - 1][1] <= 45000, "45 sn üstü konuşma kesilip gönderilir");

// ---- seslendirme metni ----
const m = S.sesMetni("Acilse **112**'yi arayın. Ücret 1.200 TL, 30 dk sürer. Hemşire/fizyoterapist gelir • 2-3 gün 😊\nhttps://x.y/z");
check(m.includes("bir bir iki") && m.includes("lira") && m.includes("30 dakika") && m.includes("2 ile 3 gün"), "112, TL, dk, aralık okunabilir hâle geldi");
check(!/[*•😊]|https/.test(m) && m.includes("Hemşire ya da fizyoterapist"), "işaretler, emoji ve bağlantı temizlendi; / → 'ya da'");

// ---- cümle bölme ----
const c = S.cumleler("Geçmiş olsun. Topuğundaki yara ne zamandır var? Evet. " + "Uzun bir cümle ".repeat(20) + "bitti.");
check(c[0] === "Geçmiş olsun." && c[1] === "Topuğundaki yara ne zamandır var? Evet.", "cümlelere bölündü; çok kısa parça öncekine eklendi");
check(c.every((x) => x.length <= 180), "hiçbir parça 180 karakteri aşmıyor");

// ---- halüsinasyon ----
check(S.halusinasyonMu("Altyazı M.K.") && S.halusinasyonMu("İzlediğiniz için teşekkürler.") && S.halusinasyonMu("Hmm") && S.halusinasyonMu(""), "Whisper'ın sessizlik uydurmaları eleniyor");
check(!S.halusinasyonMu("Annemin topuğunda yara var") && !S.halusinasyonMu("Teşekkürler.") && !S.halusinasyonMu("Evet"), "gerçek kısa yanıtlar ('Evet', 'Teşekkürler.') korunuyor");

check(S.halusinasyonMu("Hahaha") && S.halusinasyonMu("ha ha ha") && S.halusinasyonMu("[Müzik]") && S.halusinasyonMu("(alkış)"), "gülme ve ayraçlı ortam etiketleri eleniyor");
check(!S.halusinasyonMu("Hı hı") && !S.halusinasyonMu("He") && !S.halusinasyonMu("Yok") && !S.halusinasyonMu("Var") && !S.halusinasyonMu("Hayır"), "kısa onay/ret ('hı hı', 'he', 'yok', 'var') korunuyor");
// ---- yankı: asistanın kendi sesi ----
check(S.yankiMi("Bu yara ne zamandır var, kötüleşiyor mu?", "bu yara ne zamandır var kötüleşiyor mu") && S.yankiMi("Doktorun planı var mı?", "doktorun planı var mı"), "asistanın kendi cümlesi yankı sayılıyor");
check(!S.yankiMi("Doktorun planı var mı?", "var") && !S.yankiMi("Bu yara ne zamandır var?", "bir haftadır var") && !S.yankiMi("Ne zamandır var?", "iki gündür var kötüleşiyor") && !S.yankiMi("Ağrı ne zaman başladı?", "ağrı ne zaman başladı bilmiyorum"), "kısa ya da yeni bilgi taşıyan cevap yankı sayılmıyor");
// ---- ara laflar: soru sayılmaz ----
const LAF = { "Beni duyuyor musun?": "duyma", "Alo alo": "duyma", "Sesim geliyor mu?": "duyma", "Orada mısın?": "duyma", "Duyuyor musun kanka": "duyma",
  "Tekrar eder misin?": "tekrar", "Anlamadım": "tekrar", "Ne dediniz?": "tekrar", "Bir saniye": "bekle", "Dur bekle": "bekle", "Merhaba": "selam", "İyi günler": "selam", "Alo, merhaba": "selam" };
check(Object.entries(LAF).every(([t, k]) => S.araLaf(t) === k), "ara laflar tanınıyor (duyma, tekrar, bekle, selam)");
const ICERIK = ["Beni duyuyor musun annemin yarası var", "Merhaba annem hasta", "Annem için", "Evet", "Hayır yok", "Bir haftadır", "Doktor istiyorum", "Duymuyor kulağı", "Babam duymuyor"];
check(ICERIK.every((t) => S.araLaf(t) === null), "içerik taşıyan cümleler ara laf sayılmıyor ('Beni duyuyor musun annemin yarası var' gider)");
check(S.yarimMi("Annemin bacağında yara var ve") && S.yarimMi("Ağrısı var ama") && S.yarimMi("Bir haftadır, şey"), "yarım kalan cümle (ve / ama / şey ile biten) tanınıyor");
check(!S.yarimMi("Annem için") && !S.yarimMi("yara var") && !S.yarimMi("Kendim için de") && !S.yarimMi("şey"), "tam cümleler yarım sayılmıyor");

// ---- denetleyici: sahte dinleyici + sahte ses ile tam döngü ----
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
function sahteDinleyici(senaryo) {
  let i = 0, cb = null;
  return {
    tur: "sahte", konusurkenBirak: false, iptalSay: 0, kapatildi: false,
    async hazirla() {},
    async baslat(c) { cb = c; const s = senaryo[i++]; if (s === undefined) return; setTimeout(() => (s === null ? cb.sessiz() : s === "!" ? cb.hata("ceviri") : cb.son(s)), 20); },
    bitir() {}, iptal() { this.iptalSay++; }, birak() {}, kapat() { this.kapatildi = true; },
  };
}
// baslat sayacı ile fonksiyon adı çakışmasın
function dinleyici(senaryo) { const d = sahteDinleyici(senaryo); const b = d.baslat; d.sayac = 0; d.baslat = async (c) => { d.sayac++; return b.call(d, c); }; return d; }
const soylenen = [];
const sahteSes = { cumleCumle: true, kilidiAc() {}, async speak(t) { soylenen.push(t); await bekle(10); return { kesildi: false }; }, stop() {} };
const gelen = [];
let D = dinleyici(["Annemin topuğunda yara var", "Birkaç gündür", "Altyazı M.K.", "Evet reçete var"]);
const sv = S.create({ dinleyici: D, tts: sahteSes, ciz() {},
  gonder: async (t) => { gelen.push(t); await bekle(10); return gelen.length >= 3 ? { tur: "bitti", metin: "Özetini hazırladım, ekranda kontrol edebilirsin." } : { tur: "devam", metin: "Soru " + gelen.length + "?" }; } });
sv.ac("Merhaba, seni dinliyorum.");
await bekle(800);
check(gelen.join("|") === "Annemin topuğunda yara var|Birkaç gündür|Evet reçete var", "konuşmalar sırayla gönderildi; uydurma çıktı gönderilmedi");
check(soylenen[0] === "Merhaba, seni dinliyorum." && soylenen.includes("Soru 1?") && soylenen.includes("Soru 2?"), "karşılama ve yanıtlar seslendirildi");
check(soylenen.some((x) => /tam duyamadım/.test(x)), "anlaşılmayan konuşmada 'tekrar söyler misin' dedi");
check(soylenen[soylenen.length - 1].includes("Özetini hazırladım") && !sv.acik && D.kapatildi, "rapora geçince kapanış cümlesi okundu, mikrofon bırakıldı");

// sessizlik iki kez → beklemede, dokununca yeniden dinler
soylenen.length = 0; D = dinleyici([null, null, "Babam için"]);
const gelen2 = [];
const sv2 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, gonder: async (t) => { gelen2.push(t); return { tur: "devam", metin: "Tamam." }; } });
sv2.ac(); await bekle(300);
check(sv2.st.durum === "beklemede" && soylenen.some((x) => /Hazır olduğunda/.test(x)), "iki kez sessiz kalınca bir kez hatırlattı, sonra beklemeye geçti");
sv2.dokun(); await bekle(200);
check(gelen2[0] === "Babam için", "beklemedeyken dokununca yeniden dinledi");
// acil: dinlemeye dönmez
D = dinleyici(["göğsümde baskı var"]); soylenen.length = 0;
const sv3 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, gonder: async () => ({ tur: "acil", metin: "Bu acil olabilir. Hemen 112'yi arayın." }) });
sv3.ac(); await bekle(200);
check(!sv3.acik && soylenen[0].includes("bir bir iki") && D.sayac === 1 && sv3.st.durum === "kapali", "acil durumda uyarı okundu ve bir daha dinlemedi");
// hızlı yanıt çipi: dinlemeyi iptal edip gönderir
D = dinleyici([undefined]); const gelen4 = [];
const sv4 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, gonder: async (t) => { gelen4.push(t); return { tur: "devam", metin: "Peki." }; } });
sv4.ac(); await bekle(50); sv4.hizli("Annem için"); await bekle(100);
check(gelen4[0] === "Annem için" && D.iptalSay >= 1, "hızlı yanıt çipi dinlemeyi kesip metni gönderdi");
// konuşurken dokunma: sözünü keser, dinlemeye geçer
let durdu = 0; const yavasSes = { cumleCumle: true, kilidiAc() {}, speak: () => new Promise((r) => { yavasSes._r = r; }), stop() { durdu++; yavasSes._r && yavasSes._r({ kesildi: true }); } };
D = dinleyici([undefined]);
const sv5 = S.create({ dinleyici: D, tts: yavasSes, ciz() {}, gonder: async () => ({ tur: "devam", metin: "x" }) });
sv5.ac("Uzun bir karşılama"); await bekle(30);
check(sv5.st.durum === "konusuyor", "karşılama okunuyor");
sv5.dokun(); await bekle(30);
check(durdu === 1 && sv5.st.durum === "dinliyor", "konuşurken küreye dokununca sözü kesildi ve dinlemeye geçti");
sv5.duraklat();
check(sv5.st.durum === "beklemede", "duraklat: mikrofon kapandı");
sv5.kapat();
check(!sv5.acik && D.kapatildi, "kapat: oturum bitti, mikrofon bırakıldı");
// yarım cümle: "…ve" ile biten parça gönderilmez, devamıyla birleşir
D = dinleyici(["Annemin topuğunda yara var ve", "akıntı yapıyor"]); const gelen7 = [];
const sv7 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, gonder: async (t) => { gelen7.push(t); return { tur: "dur" }; } });
sv7.ac(); await bekle(200);
check(gelen7.length === 1 && gelen7[0] === "Annemin topuğunda yara var ve akıntı yapıyor", "yarım cümle devamıyla birleştirilip tek mesaj olarak gönderildi");
// yarım ama acil olabilecek parça beklemeden gider
D = dinleyici(["Hava yetmiyor ama", "unused"]); const gelen9 = [];
const sv9 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, acilMi: (t) => /hava yetmiyor/i.test(t), gonder: async (t) => { gelen9.push(t); return { tur: "dur" }; } });
sv9.ac(); await bekle(200);
check(gelen9[0] === "Hava yetmiyor ama", "'…ama' ile bitse de acil olabilecek parça devamı beklenmeden gönderildi");
// yarım cümleden sonra susarsa olduğu gibi gönderilir
D = dinleyici(["Babamın dizi ağrıyor ama", null]); const gelen8 = [];
const sv8 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, gonder: async (t) => { gelen8.push(t); return { tur: "dur" }; } });
sv8.ac(); await bekle(200);
check(gelen8[0] === "Babamın dizi ağrıyor ama", "yarım cümleden sonra susunca beklemeden gönderildi");
// hata üç kez → beklemede + açıklama
D = dinleyici(["!", "!", "!"]); soylenen.length = 0;
const sv6 = S.create({ dinleyici: D, tts: sahteSes, ciz() {}, gonder: async () => ({ tur: "devam", metin: "x" }) });
sv6.ac(); await bekle(300);
check(sv6.st.durum === "beklemede" && /yazıya çeviremedim/.test(sv6.st.hata), "çeviri üç kez başarısız olunca açıklamayla beklemeye geçti");
console.log(`Tamam: ${ok} kontrol geçti.`);
