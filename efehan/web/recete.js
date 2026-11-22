/* Kapıda — reçete / hekim planı doğrulama. Sarp'ın reçete modülünden (sarp/dogrulama.html) uyarlandı.
   Akış: hasta "doktorumun planı / reçetesi var" der → hizmet reçete istiyorsa (needs_prescription: serum, kas içi iğne) e-Reçete no
   zorunlu, belge (e-Nabız "Reçetelerim" görüntüsü / PDF / kağıt reçete fotoğrafı) önerilir; hekim istemi gerektiren diğer hizmetlerde
   (needs_physician_order) plan/rapor belgesi isteğe bağlı → ön kontrol (yapay zekâ okuması + kurallar) → talep → çalışan kapıda
   hastanın e-Nabız'ını görerek 5 maddelik kişisel kontrol yapar → "doğrulandı" ya da "doğrulanamadı · uygulama yapılmadı".
   Yapay zekâ teşhis koymaz, ilacın ya da dozun tıbbi uygunluğunu değerlendirmez; yalnızca belgeyi okur ve tutarlılığına bakar.
   Uygulama hiçbir resmî sistemi (e-Nabız, Medula) sorgulamaz; "e-Nabız onaylı" gibi bir ifade kullanılmaz. Dosya saklanmaz. */
(function () {
  "use strict";
  const B = () => window.KapidaBelge;
  const RX_TURU = { normal: "Normal (beyaz)", kirmizi: "Kırmızı", yesil: "Yeşil", turuncu: "Turuncu", mor: "Mor", belirsiz: "Belirtilmemiş" };
  const FORM = { iv_serum: "damar içi (IV) uygulanan serum ya da ilaç", im_enjeksiyon: "kas içi / deri altı uygulanan enjeksiyonluk ilaç",
    sonda_bakimi: "sonda bakımı istemi", sonda_takma: "sonda takma / değişim istemi", kan_alma: "tahlil (laboratuvar) istemi",
    fizyoterapi_seansi: "fizik tedavi / fizyoterapi istemi ya da raporu", solunum_fizyoterapisi: "solunum fizyoterapisi istemi" };
  const SONUC = {
    uygun: ["good", "✓", "Ön kontrol: uygun", "Belirgin bir tutarsızlık yok. Kesin doğrulamayı sağlık çalışanı kapıda yapar."],
    dikkat: ["sun", "!", "Ön kontrol: dikkat", "Bazı bilgiler eksik ya da teyit gerektiriyor. Sağlık çalışanı kapıda bunlara özellikle bakar."],
    supheli: ["coral", "✗", "Ön kontrol: şüpheli", "Ciddi bir tutarsızlık var. Reçeteni ve numarasını kontrol et ya da doktoruna danış."],
  };
  const KAPI = {
    recete: [["kimlik", "Hastanın kimliğine baktım; ad soyad reçetedekiyle aynı."], ["enabiz", "Hastanın e-Nabız › Reçetelerim ekranında bu reçete numarası var."],
      ["ilac", "İlaç adı, dozu ve kullanım şekli e-Nabız'daki reçeteyle aynı."], ["tarih", "Reçete tarihi ve yazan hekim görünüyor, reçete güncel."],
      ["kutu", "Evdeki ilaç kutusu reçetedeki ilaçla aynı, son kullanma tarihi geçmemiş."]],
    plan: [["kimlik", "Hastanın kimliğine baktım; ad soyad belgedekiyle aynı."], ["belge", "Hekim planını / istemini gördüm (e-Nabız, rapor ya da epikriz)."],
      ["kapsam", "Plandaki istem bu hizmeti kapsıyor."], ["tarih", "Planın tarihi ve yazan hekim görünüyor, plan güncel."],
      ["malzeme", "Gerekli malzeme ve ilaçlar evde, uygulamaya engel bir durum yok."]],
  };

  // Hizmet reçete mi, hekim planı mı istiyor? (veri: services.csv needs_prescription / needs_physician_order)
  const tur = (s) => (!s ? null : s.needs_prescription ? "recete" : s.needs_physician_order ? "plan" : null);
  const noTemiz = (s) => String(s || "").toLocaleUpperCase("tr").replace(/[^A-Z0-9]/g, "");
  const noGecerli = (s) => /^[A-Z0-9]{5,12}$/.test(noTemiz(s));

  // Kural tabanlı ön kontrol (+ varsa yapay zekâ okuması). bugun: uygulamanın "bugün"ü (demo tarihi)
  function onKontrol({ doc, ai, tur: t, svcAd, beyan, bugun }) {
    const K = B(), flags = doc ? K.dosyaBulgulari(doc, { pdfBekleniyor: false }) : [];
    const A = ai || {};
    if (doc && !A.recete_no) { const m = String(doc.raw || "").match(/(?:e-?Re[cç]ete|Re[cç]ete)\s*(?:No|Numaras[ıi])\s*[:：]?\s*([A-Z0-9]{5,12})/i); if (m) A.recete_no = m[1]; }
    const no = noTemiz(A.recete_no), bno = noTemiz(beyan.rxNo);
    if (t === "recete") {
      if (!no && !bno) flags.push(K.fl("kritik", "rx_no_yok", "e-Reçete numarası yok. Reçeteli hizmet numarasız istenemez."));
      else if (bno && !noGecerli(bno)) flags.push(K.fl("yuksek", "rx_no_bicim", "e-Reçete numarası 5–12 harf ve rakamdan oluşur; yazdığın numarayı kontrol et."));
      else if (doc && !no && ai) flags.push(K.fl("orta", "rx_no_okunmadi", "Reçete numarası belgeden okunamadı; yazdığın numara kapıda kontrol edilecek."));
      if (no && bno && no !== bno) flags.push(K.fl("kritik", "rx_no_fark", `Yazdığın numara (${beyan.rxNo}) belgedekiyle (${A.recete_no}) aynı değil.`));
    } else if (bno && !noGecerli(bno)) flags.push(K.fl("orta", "rx_no_bicim", "Yazdığın numara e-Reçete/rapor biçimine uymuyor; kapıda kontrol edilecek."));
    if (!doc) flags.push(K.fl("bilgi", "belge_yok", t === "recete" ? "Belge eklenmedi; sağlık çalışanı reçeteyi kapıda e-Nabız'ından görecek." : "Belge eklenmedi; planı kapıda sağlık çalışanına göstermen gerekir."));
    if (ai) {
      if (A.hasta_ad_soyad && beyan.hasta && K.benzer(A.hasta_ad_soyad, beyan.hasta) < 0.85) flags.push(K.fl("yuksek", "rx_hasta_fark", `Belgedeki hasta (${A.hasta_ad_soyad}) talepteki adla aynı değil.`));
      const tcd = String(A.tc_kimlik || "").replace(/\D/g, ""); if (tcd.length === 11 && !K.tcGecerli(tcd)) flags.push(K.fl("kritik", "tc_gecersiz", "Belgedeki T.C. kimlik numarası geçersiz."));
      const d = K.tarihOku(A.recete_tarihi), gun = d ? Math.floor((bugun - d) / 864e5) : null;
      if (d && gun < 0) flags.push(K.fl("kritik", "rx_ileri_tarih", "Reçete tarihi ileri bir tarih."));
      else if (d && gun > 30) flags.push(K.fl("orta", "rx_eski", `Reçete ${gun} gün önce yazılmış; güncelliği hekimle teyit edilmeli.`));
      else if (!d) flags.push(K.fl("orta", "rx_tarih_yok", "Reçete tarihi okunamadı."));
      if (!A.hekim_ad_soyad) flags.push(K.fl("orta", "rx_hekim_yok", "Yazan hekim okunamadı."));
      if (t === "recete" && !(A.ilaclar || []).some((x) => x && x.ad)) flags.push(K.fl("yuksek", "rx_ilac_yok", "Reçetede ilaç ya da istem okunamadı."));
      if (["kirmizi", "yesil", "turuncu", "mor"].includes(A.recete_turu)) flags.push(K.fl("yuksek", "rx_kontrollu", `${RX_TURU[A.recete_turu]} reçete: kontrole tabi ilaç. Evde uygulama öncesi hekim teyidi gerekir.`));
      if (A.hizmetle_uyumlu === false) flags.push(K.fl("orta", "rx_hizmet_uyumsuz", `Belgede "${svcAd}" hizmetiyle uyumlu bir kalem görünmüyor.`));
      (A.bulgular || []).forEach((b) => b && b.aciklama && b.onem !== "dusuk" && flags.push(K.fl(b.onem === "yuksek" ? "yuksek" : "orta", "yz_gorsel", String(b.aciklama).slice(0, 240))));
      if (A.belge_kaynagi === "e-nabiz" || A.belge_kaynagi === "e-devlet") flags.push(K.fl("ok", "rx_kaynak", `Belge ${A.belge_kaynagi === "e-nabiz" ? "e-Nabız" : "e-Devlet"} ekranından alınmış görünüyor.`));
    } else if (doc) flags.push(K.fl("bilgi", "yz_yok", "Belgenin içeriği yapay zekâyla okunamadı; numara ve belge kapıda kontrol edilecek."));
    const r = K.risk(flags);
    const sonuc = flags.some((x) => x.lv === "kritik") ? "supheli" : r >= 20 ? "dikkat" : "uygun";
    const ilaclar = (A.ilaclar || []).filter((x) => x && x.ad).slice(0, 12).map((x) => ({ ad: String(x.ad).slice(0, 80), doz: x.doz ? String(x.doz).slice(0, 40) : "", kullanim: x.kullanim ? String(x.kullanim).slice(0, 60) : "" }));
    return { flags, risk: r, sonuc, ozet: String(A.ozet || "").slice(0, 300), ilaclar,
      alan: { recete_no: noTemiz(A.recete_no || beyan.rxNo), hasta_ad_soyad: A.hasta_ad_soyad || "", recete_tarihi: A.recete_tarihi || "", hekim: A.hekim_ad_soyad || "", tesis: A.tesis || "", recete_turu: A.recete_turu || "", kaynak: A.belge_kaynagi || "" } };
  }

  // Ön kontrol kartı (hasta ve çalışan)
  function raporHtml(k, esc, { kisa = false } = {}) {
    const s = SONUC[k.sonuc] || SONUC.dikkat, a = k.alan || {};
    const satir = [["e-Reçete / belge no", a.recete_no], ["Hasta (belgede)", a.hasta_ad_soyad], ["Tarih", a.recete_tarihi], ["Hekim", a.hekim], ["Tesis", a.tesis], ["Reçete türü", RX_TURU[a.recete_turu]]].filter((x) => x[1]);
    return `<div class="rx-sonuc ${s[0]}"><span class="rx-ikon" aria-hidden="true">${s[1]}</span><div><b>${s[2]}</b><span class="small">${s[3]}</span></div></div>
      ${satir.length ? `<dl class="kv rx-kv">${satir.map(([x, y]) => `<dt>${x}</dt><dd>${esc(y)}</dd>`).join("")}</dl>` : ""}
      ${!kisa && (k.ilaclar || []).length ? `<div class="stack rx-ilac" style="gap:4px"><b class="small">İlaçlar / istemler (belgeden okunan)</b>${k.ilaclar.map((x) => `<div class="row between small"><span>${esc(x.ad)}${x.kullanim ? ` <span class="muted">· ${esc(x.kullanim)}</span>` : ""}</span><span class="muted">${esc(x.doz)}</span></div>`).join("")}</div>` : ""}
      ${B().bayrakHtml(k.flags, esc)}`;
  }

  window.KapidaRecete = { tur, noGecerli, noTemiz, onKontrol, raporHtml, SONUC, KAPI, FORM, RX_TURU };
})();
