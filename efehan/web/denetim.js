// Rapor denetimi: YZ'nin raporunu kullanıcının GERÇEKTEN söyledikleriyle karşılaştırır.
// İlke: kullanıcının söylemediği yaş, hastalık, ilaç, alerji, reçete/hekim onayı rapora girmez; "bilmiyorum" → bilinmiyor
// (asla "yok"); düzeltmede son söylenen esastır; teşhis/tedavi cümlesi sağlıkçı özetinden çıkar. Her alan beyan mı
// YZ çıkarımı mı diye işaretlenir (rep._kaynak) ve yapılan değişiklikler rep._denetim'e yazılır.
// Saf işlev; DOM kullanmaz (tarayıcı + node).  Prova: node web/test_rapor_denetim.mjs
(function (root) {
  "use strict";
  const FOLD = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
  const n = (t) => " " + String(t || "").replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase().replace(/[çğıöşüâîû]/g, (c) => FOLD[c])
    .replace(/[^a-z0-9]+/g, " ").trim() + " ";
  const BOS = (v) => v == null || /^\s*(belirtilmedi|bilinmiyor|-)?\s*$/i.test(String(v));
  // Yan cümleler (ham metin) — "ama/fakat/ancak" ve noktalama ile
  const yanlar = (t) => String(t || "").split(/[.!?;,\n]+|\s(?:ama|fakat|ancak|lakin)\s/i).map((x) => x.trim()).filter(Boolean);
  const BILMIYOR = / (bilmiyorum|bilemiyorum|emin degilim|bilmem|hatirlamiyorum|bilmiyoruz|emin degiliz) /;
  const DUZELTME = / (aslinda|pardon|yok yok|hayir|yanlis soyledim|demek istedim|vazgectim|degil|dur) /;

  // ---- hekim planı / reçete beyanı (son söylenen) ----
  const PLAN_KONU = / (plan\w*|recete\w*|doktor\w*|hekim\w*|istem\w*) /;
  const PLAN_VAR = / ((plan|recete)\w* (var|vardi|yazildi|yazdi)|(doktor|hekim)\w* (yazdi|istedi|onerdi|soyledi|verdi|planladi|recete)|recete yazdi|evet( \w+)? var|var yazdi) /g;
  const PLAN_YOK = / ((plan|recete)\w* (yok|yoktu)|(doktor|hekim)\w* (gormedi|yazmadi|gitmedik)|doktora gitmedik|hayir yok|yok yazmadi) /g;
  function planBeyani(mesajlar) {
    let durum = null, soruldu = false;
    for (const m of mesajlar) {
      const t = n(m.metin);
      if (m.kim === "ai") { soruldu = /(plan|recete)/.test(t) && /\?/.test(m.metin); continue; }
      const konu = PLAN_KONU.test(t) || soruldu;
      soruldu = false;
      if (!konu) continue;
      if (BILMIYOR.test(t)) { durum = "bilinmiyor"; continue; }
      let son = -1, d = null;
      for (const mm of t.matchAll(PLAN_VAR)) if (mm.index >= son) { son = mm.index; d = "var"; }
      for (const mm of t.matchAll(PLAN_YOK)) if (mm.index > son) { son = mm.index; d = "yok"; }
      if (!d && konu) { if (/ (evet|var) /.test(t) && !/ (yok|hayir) /.test(t)) d = "var"; else if (/ (yok|hayir) /.test(t) && !/ var /.test(t)) d = "yok"; }
      if (d) durum = d;
    }
    return durum;
  }

  // ---- kişi (kim için) ----
  const KISI = [["anneanne", "Anneannesi"], ["babaanne", "Babaannesi"], ["kayinvalide", "Kayınvalidesi"], ["kayinpeder", "Kayınpederi"],
    ["kayin ?ana", "Kayınvalidesi"], ["kayin ?baba", "Kayınpederi"], ["anne", "Annesi"], ["baba", "Babası"], ["dede", "Dedesi"],
    ["nine", "Ninesi"], ["es(im|imin|ime|imi|imiz)", "Eşi"], ["kardes", "Kardeşi"], ["abla", "Ablası"], ["abi", "Abisi"],
    ["agabey", "Ağabeyi"], ["kiz(im|imin|ima|imi|imiz)", "Kızı"], ["ogl(um|umun|uma|umu|umuz)", "Oğlu"], ["teyze", "Teyzesi"],
    ["hala(m|mi|min|ma)", "Halası"], ["amca", "Amcası"], ["day(im|imin|ima|imi)", "Dayısı"], ["torun", "Torunu"],
    ["kendim|benim icin|bana", "Kendisi"]];
  const KISI_RE = new RegExp(" (" + KISI.map(([r], i) => `(?<k${i}>${r})`).join("|") + ")", "g");
  function kisiler(t) {
    const out = [];
    for (const m of t.matchAll(KISI_RE)) {
      const i = Object.entries(m.groups).find(([, v]) => v !== undefined)[0].slice(1);
      out.push({ ad: KISI[+i][1], kok: KISI[+i][0], yer: m.index });
    }
    return out;
  }

  // ---- süre / başlangıç (son söylenen) ----
  const SAYI = "(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|birkac|kac|bir iki|iki uc)";
  const SURE_RE = new RegExp(` (${SAYI} (saat|gun|hafta|ay|yil|sene)\\w*|dun\\w*|bugun\\w*|sabah\\w*|gecen (hafta|ay|yil)\\w*|uzun (suredir|zamandir))`, "g");

  // ---- yaş ve kronik/ilaç/alerji kanıtı ----
  const YAS = / (\d{1,3} (yas|yasinda|yasindaki|yasini)\w*|\d{2} li|\d{2} lu|yasli\w*|bebe\w*|cocu\w*|genc\w*|ergen\w*|lohusa\w*|hamile\w*) /;
  const KRONIK = / (alerj\w*|ilac\w*|hap\w*|insulin\w*|seker\w*|tansiyon\w*|diyabet\w*|astim\w*|koah|kalp\w*|bobrek\w*|kanser\w*|tiroid\w*|epilep\w*|sara|romatizma\w*|kolesterol\w*|kullaniyor\w*|kullanir\w*|hastaligi\w*|hastasi\w*|ameliyat\w*|demans\w*|alzheimer\w*|parkinson\w*|felc\w*|inme\w*) /;
  const TESHIS = /(tanı|teşhis|tanısı|düşünülür|olası (hastalık|tanı)|tedavi (öner|başla|edil)|ilaç öner|ağrı kesici|antibiyotik (öner|başla|ver)|kullanmalı|önerildi|reçete et|doz|mg\b)/i;
  const ONAY = /(onay|onaylandı|onayladı|onaylı|doğrulandı|teyit edildi)/i;

  function raporDenetle(rep, o) {
    rep = rep && typeof rep === "object" ? rep : {};
    const mesajlar = (o && o.mesajlar) || [];
    const kul = mesajlar.filter((m) => m.kim === "me" && !m.araLaf).map((m) => String(m.metin || ""));
    const tum = n(kul.join(". "));
    const degisti = [], kaynak = {};
    const not = (alan, ne) => degisti.push({ alan, ne });

    // Yaş: kullanıcı söylemediyse YZ tahmini çıkar
    if (!BOS(rep.yas_araligi)) {
      if (YAS.test(tum)) kaynak.yas_araligi = "beyan";
      else { not("yas_araligi", `Söylenmeyen yaş çıkarıldı (${rep.yas_araligi})`); rep.yas_araligi = "belirtilmedi"; }
    }

    // Kronik hastalık / ilaç / alerji: yalnızca kullanıcının belirsiz olmayan beyanı
    const kanit = kul.flatMap(yanlar).filter((c) => KRONIK.test(n(c)) && !BILMIYOR.test(n(c)));
    if (!BOS(rep.kronik_ilac_alerji)) {
      if (!kanit.length) { not("kronik_ilac_alerji", `Söylenmeyen/belirsiz bilgi çıkarıldı (${rep.kronik_ilac_alerji})`); rep.kronik_ilac_alerji = "belirtilmedi"; }
      else kaynak.kronik_ilac_alerji = "beyan";
    }
    // Alerji düzeltmesi: son alerji beyanı olumluysa "alerji yok" yazılamaz
    const alerji = kul.flatMap(yanlar).filter((c) => / alerj/.test(n(c)));
    const sonAlerji = alerji[alerji.length - 1];
    if (sonAlerji && !BILMIYOR.test(n(sonAlerji)) && !/ (yok|yoktur|degil|olmaz) /.test(n(sonAlerji))) {
      const v = String(rep.kronik_ilac_alerji || "");
      const tasiyor = n(sonAlerji).split(" ").filter((w) => w.length >= 5 && !/^alerj/.test(w)).some((w) => n(v).includes(" " + w.slice(0, 5)));
      if (!tasiyor) {
        rep.kronik_ilac_alerji = [BOS(v) ? "" : v.replace(/[^.;,]*alerji(si)?\s*(yok|bulunmuyor)[^.;,]*[.;,]?\s*/ig, "").trim(), `Alerji (son beyan): ${sonAlerji}`].filter(Boolean).join("; ");
        kaynak.kronik_ilac_alerji = "beyan"; not("kronik_ilac_alerji", "Son alerji beyanı eklendi (düzeltme)");
      }
    }

    // Hekim planı: kullanıcının son beyanı; beyan yoksa YZ "var/yok" diyemez
    const plan = planBeyani(mesajlar);
    if (plan) { if (rep.hekim_plani !== plan) not("hekim_plani", `Beyana göre '${plan}' (YZ: ${rep.hekim_plani})`); rep.hekim_plani = plan; kaynak.hekim_plani = "beyan"; }
    else if (["var", "yok"].includes(rep.hekim_plani)) { not("hekim_plani", `Beyan yok; '${rep.hekim_plani}' → bilinmiyor`); rep.hekim_plani = "bilinmiyor"; }
    // Onay/doğrulama iddiası: hiçbir zaman doğrulanmış bilgi olarak geçmez
    const onaySoylendi = ONAY.test(kul.join(" "));
    for (const a of ["plan_detayi", "saglikci_icin_ozet", "hasta_icin_ozet", "oneri_gerekcesi", "tek_satir"]) {
      if (typeof rep[a] !== "string" || !ONAY.test(rep[a])) continue;
      rep[a] = rep[a].split(/(?<=[.;!?])\s+/).filter((c) => !ONAY.test(c)).join(" ").trim();
      not(a, "Onay/doğrulama iddiası çıkarıldı");
    }
    if (rep.hekim_plani !== "var" && rep.plan_detayi) { rep.plan_detayi = ""; }
    if (onaySoylendi) (rep.eksik_bilgiler = Array.isArray(rep.eksik_bilgiler) ? rep.eksik_bilgiler : []).push("Hasta/yakını hekim kararı olduğunu söyledi; belge ziyarette görülmeli (doğrulanmadı)");

    // Teşhis / tedavi cümleleri sağlıkçı ve hasta özetinden çıkar
    for (const a of ["saglikci_icin_ozet", "hasta_icin_ozet", "tek_satir"]) {
      if (typeof rep[a] !== "string" || !TESHIS.test(rep[a])) continue;
      rep[a] = rep[a].split(/(?<=[.;!?])\s+/).filter((c) => !TESHIS.test(c)).join(" ").trim();
      not(a, "Teşhis/tedavi ifadesi çıkarıldı");
    }
    if (!String(rep.saglikci_icin_ozet || "").trim()) rep.saglikci_icin_ozet = "Hasta/yakını beyanı: " + (BOS(rep.sikayet) ? kul.join(". ").slice(0, 200) : rep.sikayet) + ". Bilgiler doğrulanmadı.";

    // Kim için: düzeltme varsa son anılan kişi; birden fazla kişi anıldıysa not
    const ks = kisiler(tum);
    const farkli = [...new Set(ks.map((k) => k.ad))];
    if (ks.length) {
      const d = [...tum.matchAll(new RegExp(DUZELTME.source, "g"))].pop();
      const hedef = d ? ks.filter((k) => k.yer > d.index).pop() || ks[ks.length - 1] : (farkli.length === 1 ? ks[0] : null);
      if (hedef) {
        const k = n(rep.kim_icin);
        if (!k.includes(" " + hedef.ad.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => FOLD[c]).slice(0, 4))) {
          not("kim_icin", `Kullanıcının söylediği kişi: ${hedef.ad} (YZ: ${rep.kim_icin})`); rep.kim_icin = hedef.ad;
        }
        kaynak.kim_icin = "beyan";
      }
      if (farkli.length > 1 && !d) {
        (rep.eksik_bilgiler = Array.isArray(rep.eksik_bilgiler) ? rep.eksik_bilgiler : []).push(`Birden fazla kişi anıldı (${farkli.join(", ")}); her kişi için ayrı talep gerekebilir`);
        not("kim_icin", "Birden fazla kişi");
      }
    }

    // Başlangıç: son söylenen süre
    const sureler = [...tum.matchAll(SURE_RE)];
    if (sureler.length) {
      const son = sureler[sureler.length - 1][1].trim();
      const birim = (son.match(/saat|gun|hafta|ay|yil|sene|dun|bugun|sabah|uzun/) || [""])[0];
      if (!n(rep.baslangic).includes(birim)) { not("baslangic", `Son söylenen süre: ${son} (YZ: ${rep.baslangic})`); rep.baslangic = kul.flatMap(yanlar).filter((c) => n(c).includes(" " + son.split(" ")[0])).pop() || son; }
      kaynak.baslangic = "beyan";
    }

    for (const a of ["sikayet", "kim_icin", "yas_araligi", "kronik_ilac_alerji", "hekim_plani", "baslangic", "seyir"]) {
      if (!kaynak[a] && !BOS(rep[a])) kaynak[a] = a === "sikayet" ? "beyan" : "yz";
    }
    rep._kaynak = kaynak; rep._denetim = degisti;
    return rep;
  }

  const api = { raporDenetle, planBeyani };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KapidaDenetim = api;
})(typeof window !== "undefined" ? window : globalThis);
