/* Kapıda — YZ teklif katmanı: Enes'in eğitilmiş bildirim modeli (enes/data/izmir/model_v5_demo_lr.json)
   ve birleşik demodaki (ortak/ek.js) YZ fiyat önerisi + ±%10 teklif bandı.
   1) Her uygun aday için p = "bildirim giderse 5 dk içinde uygun teklif verir" olasılığı:
      p = 1/(1+exp(−(b + Σ w·(x−mu)/sd))), özellik sırası modeldeki `ozellikler_kod` ile aynı.
   2) v5 kuralı: adj = p − a·yol/30 − b·bildirim − c·bugünkü ziyaret; ilk 3; başarı garantisi (alpha).
   3) Fiyat önerisi: 3 kişiden en az birinin teklif verme olasılığını, fiyat sınırsızken ulaşılacak değerin
      %90'ında tutan en düşük fiyat (ek.js aiPrice). Çalışan bu önerinin ±%10'u içinde teklif verir.
   4) Prototip: bildirim gönderilen kişilerin yanıtı modelin p'siyle canlandırılır (tohumlu); gerçek
      uygulamada yanıtı çalışanın kendisi verir. Çalışan geçmişi sentetiktir (Enes'in meslek dağılımından).
   Kullanım: const T = KapidaTeklif.create(model, C); T.planla({ adaylar, servis, hasta, simdi, pencereSonu, ... }) */
(function (root) {
  "use strict";
  const MESLEK = { hekim: "doktor", uzman_hekim: "doktor", hemsire: "hemsire", ebe: "hemsire", fizyoterapist: "fizyoterapist",
    odyolog: "odyolog", diyetisyen: "diyetisyen", ergoterapist: "ergoterapist", psikolog: "klinik_psikolog", klinik_psikolog: "klinik_psikolog",
    dil_konusma: "dil_konusma", dil_konusma_terapisti: "dil_konusma", podolog: "podolog" };
  const PRICE_SD = 0.12, AI_TARGET = 0.9, AI_BAND = 0.1;
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
  const u01 = (s) => (hash(s) % 100000) / 100000;
  function Phi(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  // Yüzdelik tablosundan (p10..p90) u'ya karşılık gelen değer (doğrusal ara değer)
  function yuzdelik(q, u) {
    const xs = [0.1, 0.25, 0.5, 0.75, 0.9], ys = [q.p10, q.p25, q.p50, q.p75, q.p90];
    if (u <= xs[0]) return ys[0]; if (u >= xs[4]) return ys[4];
    let i = 0; while (u > xs[i + 1]) i++;
    return ys[i] + (ys[i + 1] - ys[i]) * (u - xs[i]) / (xs[i + 1] - xs[i]);
  }

  function create(M, C) {
    if (!M || !M.w) return null;
    const K = M.v5.kural, N = M.v5.bildirim_sayisi || 3;
    // Sentetik çalışan geçmişi: Enes'in meslek dağılımından, çalışan kimliğine bağlı sabit yüzdelik
    function gecmis(pid, meslekKodu, yeni) {
      const g = M.gecmis;
      // Geçmişi olmayan (yeni) çalışan: modelin önerdiği nötr değerler (gecmis.yeni_calisan: 0,5 / 0,5 / 0,5)
      if (yeni && g.yeni_calisan) return { resp: g.yeni_calisan.resp, fast: g.yeni_calisan.fast, peak: g.yeni_calisan.peak, yeni: true };
      const d = (g.meslek && g.meslek[MESLEK[meslekKodu] || meslekKodu]) || g.tum;
      const ozet = (k) => yuzdelik(d[k] || g.tum[k], u01(pid + "#" + k));
      return { resp: ozet("resp"), fast: ozet("fast"), peak: ozet("peak") };
    }
    const sig = (z) => 1 / (1 + Math.exp(-z));
    function olasilik(x) {
      let z = M.b;
      for (let j = 0; j < M.w.length; j++) z += M.w[j] * (x[j] - M.mu[j]) / (M.sd[j] || 1);
      return sig(z);
    }
    /* o = { pid, meslek, yolDk, bosalmayaKalan, ziyarette, enErkenVaris, pencereSonu, simdi, doktor, butce, taban, carpan } */
    function ozellikler(o) {
      const h = gecmis(o.pid, o.meslek, o.yeni), saat = o.simdi / 60;
      const yogun = (o.simdi >= 480 && o.simdi < 600) || (o.simdi >= 1020 && o.simdi < 1140) ? 1 : 0;
      const butceVar = o.butce != null ? 1 : 0;
      const butceFarki = butceVar ? (o.butce - o.taban * o.carpan) / o.taban : 0;
      const x = { yol_suresi: o.yolDk, bosalmaya_kalan: o.bosalmayaKalan || 0, pencere_payi: o.pencereSonu - o.enErkenVaris, saat, yogun_saat: yogun,
        ziyarette: o.ziyarette ? 1 : 0, gecmis_yanit_orani: h.resp, gecmis_hizli_yanit_orani: h.fast, gecmis_yogun_saat_yanit: h.peak,
        butce_farki: butceFarki, butce_var: butceVar, doktor: o.doktor ? 1 : 0 };
      return { vektor: M.ozellikler_kod.map((k) => x[k]), ham: x, gecmis: h };
    }
    // v5 kuralı (Enes'in engine.select_with_policy açıklaması: v5.kural_aciklama)
    function sec(adaylar) {
      const s = adaylar.map((a) => ({ ...a, adj: a.p - K.a * a.yolDk / 30 - K.b * (a.bildirim || 0) - K.c * (a.ziyaretBugun || 0) }));
      s.sort((x, y) => y.adj - x.adj);
      let sec = s.slice(0, N);
      const basari = (l) => 1 - l.reduce((q, a) => q * (1 - a.p), 1);
      const enIyi = [...s].sort((x, y) => y.p - x.p).slice(0, N);
      let takas = 0;
      while (sec.length && basari(sec) < K.alpha * basari(enIyi) && takas < N) {
        const dis = s.filter((a) => !sec.some((x) => x.pid === a.pid)).sort((x, y) => y.p - x.p)[0]; // kimliğe göre (kopya nesne aynı kişiyi iki kez eklemesin)
        if (!dis) break;
        const enDusuk = [...sec].sort((x, y) => x.p - y.p)[0];
        if (dis.p <= enDusuk.p) break;
        sec = sec.map((a) => (a === enDusuk ? { ...dis, garanti: true } : a));
        takas++;
      }
      return { secilen: sec, sira: s, basari: basari(sec), enIyiBasari: basari(enIyi) };
    }
    // YZ fiyat önerisi (ortak/ek.js aiPrice)
    function fiyatOner(secilen, taban, butce) {
      const kabul = (a, x) => Phi((Math.log(x) - Math.log(taban * a.carpan)) / PRICE_SD);
      const basari = (x) => 1 - secilen.reduce((q, a) => q * (1 - a.p * kabul(a, x)), 1);
      const sMax = 1 - secilen.reduce((q, a) => q * (1 - a.p), 1);
      let fiyat = null;
      for (let x = Math.round(taban * 0.8 / 10) * 10; x <= taban * 1.6; x += 10) if (basari(x) >= AI_TARGET * sMax) { fiyat = x; break; }
      if (fiyat == null) fiyat = Math.round(taban * 1.6 / 10) * 10;
      let sinirli = false;
      if (butce != null && fiyat > butce) { fiyat = butce; sinirli = true; }
      return { fiyat, alt: Math.round(fiyat * (1 - AI_BAND) / 10) * 10, ust: Math.round(fiyat * (1 + AI_BAND) / 10) * 10, basari: basari(fiyat), sMax, taban, sinirli };
    }
    // Yanıt canlandırması: p olasılıkla teklif; kendi fiyatı bandın üstündeyse teklif vermez; fiyat banda çekilir
    function cevap(a, oneri, tohum) {
      const kendi = Math.round(oneri.taban * a.carpan / 10) * 10;
      const verir = u01(tohum + "|" + a.pid) < a.p && kendi <= oneri.ust;
      const gecikmeDk = 0.5 + 4.5 * u01(tohum + "|gec|" + a.pid); // 5 dk içinde
      return { pid: a.pid, verir, gecikmeDk, fiyat: Math.min(oneri.ust, Math.max(oneri.alt, kendi)), kendi, nedenYok: verir ? "" : kendi > oneri.ust ? "fiyatı bandın üstünde" : "yanıt vermedi" };
    }
    function planla(g) {
      const adaylar = g.adaylar.map((a) => {
        const f = ozellikler({ ...a, simdi: g.simdi, pencereSonu: g.pencereSonu, butce: g.butce ?? null, taban: g.taban });
        return { ...a, ozellik: f, p: olasilik(f.vektor) };
      });
      const s = sec(adaylar);
      const oneri = fiyatOner(s.secilen, g.taban, g.butce ?? null);
      const tur1 = s.secilen.map((a) => cevap(a, oneri, g.tohum));
      const kalan = s.sira.filter((a) => !s.secilen.some((x) => x.pid === a.pid)).slice(0, N);
      const tur2 = kalan.map((a) => cevap(a, oneri, g.tohum + "#2"));
      return { adaylar, ...s, oneri, tur1, tur2: { secilen: kalan, cevaplar: tur2 }, model: { ad: M.ad, auc: M.olcum.auc_ayrilmis, v5: M.olcum.uygun5_ayrilmis_kural_v5, klasik: M.olcum.uygun5_ayrilmis_klasik_kural } };
    }
    return { planla, olasilik, ozellikler, sec, fiyatOner, cevap, gecmis };
  }
  const api = { create, Phi };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KapidaTeklif = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
