// Sesli sohbet kataloğu — RAPOR katmanı: denetim.js (YZ raporu + kullanıcının söyledikleri → denetlenmiş rapor)
// Çalıştır: node web/test_rapor_denetim.mjs [--gizli]
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const kok = fileURLToPath(new URL("..", import.meta.url)); // Windows'ta .pathname "C:\\C:\\..." veriyordu
const gizli = process.argv.includes("--gizli");
const kat = JSON.parse(fs.readFileSync(kok + "data/eval/" + (gizli ? "sesli_gizli.json" : "sesli_senaryolar.json"), "utf8")).filter((k) => k.katman === "rapor");
let D = null;
try { D = require("./denetim.js"); } catch (e) { /* önce: modül yok */ }
const fold = (s) => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const sonuc = [];
for (const k of kat) {
  const mesajlar = k.girdi.map((m) => ({ kim: "me", metin: m }));
  const rep = D ? D.raporDenetle(structuredClone(k.rapor), { mesajlar }) : structuredClone(k.rapor);
  const b = k.beklenen, h = [];
  for (const [a, v] of Object.entries(b.alanlar || {})) if (rep[a] !== v) h.push(`${a} = ${JSON.stringify(rep[a])} (beklenen ${JSON.stringify(v)})`);
  for (const [a, v] of Object.entries(b.icerir || {})) if (!fold(rep[a]).includes(fold(v))) h.push(`${a} '${v}' içermiyor: ${JSON.stringify(rep[a])}`);
  for (const [a, v] of Object.entries(b.icermez || {})) if (fold(rep[a]).includes(fold(v))) h.push(`${a} '${v}' içeriyor: ${JSON.stringify(rep[a])}`);
  for (const [a, v] of Object.entries(b.icerir_herhangi || {})) if (!(rep[a] || []).some((x) => fold(x).includes(fold(v)))) h.push(`${a} içinde '${v}' yok`);
  if (b.cikarim_isaretli && !(rep._kaynak && Object.keys(rep._kaynak).length)) h.push("beyan/çıkarım işareti yok");
  sonuc.push({ id: k.id, kategori: k.kategori, onem: k.onem, gecti: !h.length, hatalar: h, rapor: rep });
  console.log((h.length ? "  ✗ " : "  ✓ ") + `${k.id} [${k.kategori}/${k.onem}] ${k.beklenen_metin}` + (h.length ? "  →  " + h.join("; ") : ""));
}
const g = sonuc.filter((s) => s.gecti).length;
console.log(`RAPOR (${gizli ? "gizli" : "geliştirme"}${D ? "" : ", denetim.js yok"}): ${g}/${sonuc.length} geçti`);
fs.writeFileSync(kok + `data/eval/sonuc/rapor_${gizli ? "gizli" : "gelistirme"}.json`, JSON.stringify(sonuc, null, 1));
process.exit(g === sonuc.length ? 0 : 1);
