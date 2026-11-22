// Sesli sohbet kataloğu — SES katmanı: sesli.js saf işlevleri ve denetleyici (sahte dinleyici + sahte ses)
// Gerçek mikrofon/insan sesi DEĞİL: dinleyicinin döndürdüğü metin ve VAD'ın ses seviyesi dizileri sentetiktir.
// Çalıştır: node web/test_sesli_senaryo.mjs [--gizli]
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const S = require("./sesli.js");
const kok = fileURLToPath(new URL("..", import.meta.url)); // Windows'ta .pathname "C:\\C:\\..." veriyordu
const gizli = process.argv.includes("--gizli");
const kat = JSON.parse(fs.readFileSync(kok + "data/eval/" + (gizli ? "sesli_gizli.json" : "sesli_senaryolar.json"), "utf8")).filter((k) => k.katman === "ses");
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

function vad(tur) {
  const v = S.VAD(); const ol = []; let t = 0;
  const it = (ms, f) => { for (let i = 0; i < ms / 50; i++, t += 50) { const e = v.adim(f(i), t); if (e) ol.push(e); } };
  const sessiz = (ms, r = 0.003) => it(ms, () => r);
  const konus = (ms, ek = 0) => it(ms, (i) => 0.05 + 0.04 * Math.sin(i) + ek);
  if (tur === "kisa_tik") { sessiz(400); it(150, () => 0.09); sessiz(9500); }
  if (tur === "uzun_konusma") { sessiz(300); konus(50000); }
  if (tur === "gurultu_konusma") { sessiz(1300, 0.02); konus(1500, 0.05); sessiz(1600, 0.02); }
  return ol.includes("bitti") ? "bitti" : ol.includes("basladi") ? "basladi" : ol.includes("sessiz") ? "sessiz" : "yok";
}
function dinleyici(senaryo, o = {}) {
  let i = 0;
  return { tur: "sahte", hazirlaSay: 0, kapatildi: false, iptalSay: 0,
    async hazirla() { this.hazirlaSay++; if (o.izinYok) { const e = new Error("izin"); e.code = "not_granted"; throw e; } },
    async baslat(c) { const s = senaryo[i++]; if (s === undefined) return; setTimeout(() => (s === null ? c.sessiz() : s === "!" ? c.hata("ceviri") : c.son(s)), 15); },
    bitir() {}, iptal() { this.iptalSay++; }, birak() {}, kapat() { this.kapatildi = true; } };
}
const ses = { cumleCumle: true, kilidiAc() {}, async speak() { await bekle(5); return { kesildi: false }; }, stop() {} };

async function denetleyici(fonk, girdi) {
  if (fonk === "kesme") {
    const yavas = { kilidiAc() {}, speak: () => new Promise((r) => { yavas._r = r; }), stop() { yavas._r && yavas._r({ kesildi: true }); } };
    const sv = S.create({ dinleyici: dinleyici([undefined]), tts: yavas, ciz() {}, gonder: async () => ({ tur: "devam", metin: "x" }) });
    sv.ac("Uzun bir karşılama"); await bekle(30); sv.dokun(); await bekle(30); return sv.st.durum;
  }
  if (fonk === "yanki_dongu") {
    const [asistan, duyulan] = girdi; const gelen = [];
    const sv = S.create({ dinleyici: dinleyici([duyulan, null, null]), tts: ses, ciz() {}, gonder: async (t) => { gelen.push(t); return { tur: "devam", metin: "x" }; } });
    sv.ac(asistan); await bekle(400); sv.kapat();
    return gelen.includes(duyulan) ? "gonderildi" : "gonderilmedi";
  }
  if (fonk === "izin") {
    const sv = S.create({ dinleyici: dinleyici([], { izinYok: true }), tts: ses, ciz() {}, gonder: async () => ({ tur: "devam" }) });
    sv.ac(); await bekle(80); return sv.st.durum;
  }
  if (fonk === "ag") {
    const sv = S.create({ dinleyici: dinleyici(["!", "!", "!"]), tts: ses, ciz() {}, gonder: async () => ({ tur: "devam", metin: "x" }) });
    sv.ac(); await bekle(400); return sv.st.durum;
  }
  if (fonk === "cift_baslat") {
    const d = dinleyici([undefined]);
    const sv = S.create({ dinleyici: d, tts: ses, ciz() {}, gonder: async () => ({ tur: "devam" }) });
    sv.ac(); sv.ac(); await bekle(50); return d.hazirlaSay;
  }
}

const sonuc = [];
for (const k of kat) {
  const { fonk, sonuc: bek } = k.beklenen; let gercek;
  try {
    if (fonk === "halusinasyon") gercek = S.halusinasyonMu(k.girdi);
    else if (fonk === "araLaf") gercek = S.araLaf(k.girdi);
    else if (fonk === "yarim") gercek = S.yarimMi(k.girdi);
    else if (fonk === "yanki") gercek = S.yankiMi ? S.yankiMi(k.girdi[0], k.girdi[1]) : "işlev yok";
    else if (fonk === "vad") gercek = vad(k.girdi);
    else gercek = await denetleyici(fonk, k.girdi);
  } catch (e) { gercek = "hata: " + e.message; }
  const gecti = gercek === bek;
  sonuc.push({ id: k.id, kategori: k.kategori, onem: k.onem, gecti, gercek, beklenen: bek });
  console.log((gecti ? "  ✓ " : "  ✗ ") + `${k.id} [${k.kategori}/${k.onem}] ${k.beklenen_metin}` + (gecti ? "" : `  →  ${JSON.stringify(gercek)} (beklenen ${JSON.stringify(bek)})`));
}
const g = sonuc.filter((s) => s.gecti).length;
console.log(`SES (${gizli ? "gizli" : "geliştirme"}): ${g}/${sonuc.length} geçti`);
fs.writeFileSync(kok + `data/eval/sonuc/ses_${gizli ? "gizli" : "gelistirme"}.json`, JSON.stringify(sonuc, null, 1));
process.exit(g === sonuc.length ? 0 : 1);
