/* Kapıda — Güvenli Ziyaret: ziyaret boyunca hastayı ve sağlık çalışanını korur.
   1) Ziyaret öncesi: rapordan risk notu (YZ'nin çıkardığı notlar + kural motoru) ve riskli ziyaret önerileri.
   2) Kapıda: 4 haneli kapı kodu + çalışanın fotoğrafı (hasta eşleştirir) ve konum kontrolü (adrese ≤150 m).
   3) Ziyaret sırasında: çalışanın konumu kaydedilir; kontrol zamanlayıcısı "Her şey yolunda mı?" sorar;
      yanıt yoksa yükseltme zinciri: ikinci uyarı → çalışanı arama → güvenlik masası → acil kişi → 112 (son konumla).
      Gizli SOS: süreye 2 sn basılı tutmak ya da "baskı PIN'i" (iptal ediyormuş gibi görünür, sessiz alarm verir).
   4) Ziyaret sonu: çalışan çıkış yapar, hasta onaylar; iki taraf da sorun bildirebilir; şiddette Beyaz Kod (113).
   Prototip: konum çalışanın planlı rotasından canlandırılır, aramalar ve 112 bildirimi simüledir (gerçek arama yapılmaz).
   Zaman: ziyaret süresi 1 sn ≈ 1 dk; yükseltme adımları gerçek saniyeyle (ekranda gerçek süre de yazar). */
(function (root) {
  "use strict";
  const HIZ = 1000;                 // ziyaret dakikası başına ms (1 sn ≈ 1 dk)
  const GEOFENCE_M = 150;           // check-in için adrese en fazla uzaklık
  const PIN = "2580", BASKI_PIN = "0852"; // demo PIN'leri (gerçekte çalışan kendisi belirler)
  const ZINCIR = [                  // [ad, gerçekte, demoda sn]
    ["Bildirim: “Her şey yolunda mı?”", "2 dk yanıt süresi", 15],
    ["İkinci uyarı (sesli ve titreşimli)", "2 dk", 15],
    ["Güvenlik masası çalışanı arıyor", "1 dk çalar", 15],
    ["Operatör devrede: hastanın telefonu aranır", "2 dk", 10],
    ["Çalışanın acil kişisi aranır", "2 dk", 10],
    ["112'ye son konumla bildirim", "", 0],
  ];
  const SOS_IPTAL_SN = 30;
  // Kural motoru: hasta/yakını beyanında çalışanın güvenliğini ilgilendiren ifadeler (protokol karar verir).
  const KURALLAR = [
    { re: /silah|tabanca|tüfe[kğ]|bıça[kğ]|satır|kesici alet|ruhsatlı/, sev: 3, not: "Evde silah ya da kesici alet olduğu söylendi", oneri: "Hastadan ziyaret sırasında silah/kesici aletin kilitli ya da başka odada olmasını iste" },
    { re: /tehdit|dövüyor|dövdü|vuruyor|vurdu|saldır|şiddet|kavga/, sev: 3, not: "Evde şiddet ya da tehdit olduğu söylendi", oneri: "Tek başına gitme: iki kişilik ziyaret iste" },
    { re: /agresif|saldırgan|çok sinirl|sinirlen|öfke|bağırıyor|bağırır|kırıp döküyor/, sev: 2, not: "Evde ani öfke ya da agresif davranış olabileceği söylendi", oneri: "Kapıda hasta yakınıyla sakin bir ön konuşma yap; çıkış yolunu açık tut" },
    { re: /alkol|sarhoş|içkili|uyuşturucu|madde kullan|bonzai/, sev: 2, not: "Evde alkol ya da madde etkisinde biri olabileceği söylendi", oneri: "Önce görüntülü ön görüşme yap" },
    { re: /köpe[kğ]|pitbull|kangal/, sev: 2, not: "Evde köpek var", oneri: "Hastadan köpeği ziyaret boyunca kapalı bir odaya almasını iste" },
    { re: /asansör yok|asansörsüz|merdiven|çatı katı|bodrum/, sev: 1, not: "Merdiven/asansörsüz ya da bodrum kat", oneri: "Taşınacak malzemeyi buna göre planla; bodrumda bağlantı zayıf olabilir" },
  ];
  const SEV_AD = ["yok", "düşük", "orta", "yüksek"];
  const kucuk = (s) => String(s || "").toLocaleLowerCase("tr");

  function riskAnaliz(rapor, metin, varisDk) {
    rapor = rapor || {};
    const yz = (Array.isArray(rapor.guvenlik_notlari) ? rapor.guvenlik_notlari : []).map((x) => String(x).trim()).filter((x) => x && x !== "belirtilmedi").slice(0, 5);
    const tum = kucuk([metin, rapor.sikayet, rapor.hastanin_kendi_sozleri, rapor.saglikci_icin_ozet, ...(rapor.dikkat_edilecekler || []), ...yz].join(" . "));
    let sev = 0; const notlar = yz.map((x) => ({ metin: x, kaynak: "YZ" })), oneriler = [];
    for (const k of KURALLAR) {
      if (!k.re.test(tum)) continue;
      sev = Math.max(sev, k.sev); oneriler.push(k.oneri);
      if (!yz.some((x) => k.re.test(kucuk(x)))) notlar.push({ metin: k.not + " (beyan)", kaynak: "kural" });
    }
    if (yz.length && !sev) sev = 1;
    if (varisDk != null && (varisDk >= 20 * 60 || varisDk < 7 * 60)) { sev = Math.max(sev, 2); notlar.push({ metin: "Akşam/gece ziyareti", kaynak: "kural" }); oneriler.push("Mümkünse gündüz saatine al"); }
    if (sev >= 3) oneriler.unshift("Önce görüntülü ön görüşme yap", "Gündüz saatine al ya da iki kişilik ziyaret iste");
    return { seviye: sev, ad: SEV_AD[sev], notlar, oneriler: [...new Set(oneriler)], sikKontrol: sev >= 3 };
  }

  const uzaklik = (m) => (m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",") + " km" : m + " m");
  function mesafeM(a, b) {
    const R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function create(o) {
    const esc = o.esc, hhmm = o.hhmm;
    const S = {};                     // ziyaret durumu, talep kimliğine göre
    let surum = 0, basili = null;
    const degis = () => { surum++; };
    const aktif = (r) => !!(r && r.status === "kabul" && !r.gun);

    function durum(r) {
      if (!r) return null;
      if (S[r.id]) return S[r.id];
      const h = [...r.id].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
      const sure = (o.hizmet(r.service) || {}).duration_min || 30;
      const risk = riskAnaliz(r.report, o.metin ? o.metin(r) : "", r.arrival_min);
      S[r.id] = { id: r.id, kod: String(1000 + (h % 9000)), kodDurum: null, checkin: null, checkout: null, sure, risk,
        konumlar: [], sonKayit: 0, sonraki: null, kontrol: null, kontrolSayisi: 0, sessiz: null, sos: null, uzak: false,
        hata: "", pin: "", pinHata: "", cikisSoru: false, cikisSorun: null, hastaOnay: null, hastaSorunAcik: false, olaylar: [], uzunUyari: false, oneriler: {} };
      return S[r.id];
    }
    const vdk = (s) => (s.checkin ? ((s.checkout || Date.now()) - s.checkin) / HIZ : 0);
    const saat = (s, r) => hhmm(Math.round(r.arrival_min + vdk(s)));
    const aralik = (s) => (s.risk.sikKontrol || vdk(s) >= s.sure ? 10 : Math.max(10, Math.round(s.sure / 2)));
    function olay(s, r, kim, metin, tur) { s.olaylar.unshift({ saat: saat(s, r), kim, metin, tur: tur || "" }); degis(); }
    function konum(s, r) {
      const k = o.konum(r); if (!k) return null;
      const pos = s.uzak ? [k.pos[0] + 0.0108, k.pos[1]] : k.pos; // demo: ~1,2 km kuzey
      return { pos, hedef: k.hedef, ulasti: k.ulasti && !s.uzak, m: Math.round(mesafeM(pos, k.hedef)) };
    }
    function seviye(s) {
      const k = s.kontrol; if (!k) return -1;
      if (k.acildi) return 2;
      let e = (Date.now() - k.t0) / 1000, i = 0;
      for (; i < ZINCIR.length - 1; i++) { if (e < ZINCIR[i][2]) break; e -= ZINCIR[i][2]; }
      return i;
    }
    function kalanSn(s) {
      const k = s.kontrol; if (!k || k.acildi) return 0;
      let e = (Date.now() - k.t0) / 1000;
      for (let i = 0; i < ZINCIR.length - 1; i++) { if (e < ZINCIR[i][2]) return Math.ceil(ZINCIR[i][2] - e); e -= ZINCIR[i][2]; }
      return 0;
    }
    function kontrolBaslat(s, r, neden) {
      s.kontrol = { t0: Date.now(), kayitli: 0, neden }; s.kontrolSayisi++; s.pin = ""; s.pinHata = "";
      olay(s, r, "Sistem", neden === "sure" ? "Planlanan süre doldu: çalışana “Her şey yolunda mı?” bildirimi gitti" : "Ara kontrol: çalışana “Her şey yolunda mı?” bildirimi gitti");
      try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* titreşim yok */ }
    }
    function sessizAlarm(s, r, neden) {
      if (s.sessiz) return;
      s.sessiz = { t0: Date.now(), neden, bildirildi: false };
      olay(s, r, "Güvenlik masası", `SESSİZ ALARM (${neden}). Operatör ziyareti izliyor; çalışanın ekranında hiçbir şey değişmez, telefonu çalınmaz.`, "alarm");
    }
    function kontrolCoz(s, r, nasil) {
      const sev = seviye(s);
      s.kontrol = null; s.pin = ""; s.pinHata = "";
      s.sonraki = vdk(s) + aralik(s);
      s.onay = { t: Date.now(), saat: saat(s, r), dk: Math.round(aralik(s)) };
      olay(s, r, "Çalışan", `${nasil}${sev >= 2 ? " (geç yanıt; zincir durduruldu)" : ""}. Sonraki kontrol ~${Math.round(aralik(s))} dk sonra`);
    }

    // Periyodik ilerletme: konum kaydı, kontrol zamanlayıcısı, yükseltme zinciri. Değişiklik imzası döner.
    function tick(r) {
      if (!aktif(r)) return "yok";
      const s = durum(r), now = Date.now(), k = konum(s, r);
      if (k && !s.checkout) { // konum yalnızca ziyaret penceresinde (yolda + ziyarette) kaydedilir
        const aralikMs = s.checkin ? 5 * HIZ : 4000;
        if (now - s.sonKayit >= aralikMs) { s.sonKayit = now; s.konumlar.unshift({ saat: saat(s, r), pos: k.pos, m: k.m, evre: s.checkin ? "ziyarette" : k.ulasti ? "kapıda" : "yolda" }); s.konumlar.length = Math.min(s.konumlar.length, 60); degis(); }
      }
      if (s.checkin && !s.checkout) {
        const v = vdk(s);
        if (!s.kontrol && v >= s.sonraki) kontrolBaslat(s, r, v >= s.sure ? "sure" : "ara");
        if (!s.uzunUyari && v > s.sure * 1.5) { s.uzunUyari = true; olay(s, r, "YZ", `Anormallik: ziyaret planlanan sürenin %50 üstüne çıktı (${s.sure} dk planlıydı). Operatör takipte.`, "uyari"); }
        if (s.kontrol) {
          const sev = seviye(s);
          while (s.kontrol.kayitli < sev) { s.kontrol.kayitli++; const z = ZINCIR[s.kontrol.kayitli]; olay(s, r, "Sistem", `Yanıt yok → ${z[0]}${s.kontrol.kayitli === ZINCIR.length - 1 ? ` · son konum ${k ? k.pos.map((x) => x.toFixed(4)).join(", ") : "-"} (demo: gerçek arama yapılmaz)` : ""}`, s.kontrol.kayitli >= 3 ? "alarm" : "uyari"); }
        }
      }
      if (s.sessiz && !s.sessiz.bildirildi && now - s.sessiz.t0 > 5000) { s.sessiz.bildirildi = true; olay(s, r, "Güvenlik masası", `112'ye sessiz alarm bildirildi · son konum ${k ? k.pos.map((x) => x.toFixed(4)).join(", ") : "-"} (demo: gerçek arama yapılmaz)`, "alarm"); }
      if (s.sos && !s.sos.iptal && !s.sos.bildirildi && now - s.sos.t0 > SOS_IPTAL_SN * 1000) { s.sos.bildirildi = true; olay(s, r, "Güvenlik masası", "SOS iptal edilmedi → 112'ye son konumla bildirildi (demo: gerçek arama yapılmaz)", "alarm"); }
      const kalan = s.kontrol ? kalanSn(s) : s.sos && !s.sos.iptal && !s.sos.bildirildi ? Math.ceil(SOS_IPTAL_SN - (now - s.sos.t0) / 1000) : "";
      return [surum, k ? k.ulasti : "-", Math.floor(vdk(s)), kalan, s.onay && now - s.onay.t < 5000].join("|");
    }

    // ---------- görünümler ----------
    function riskHtml(risk, opt) {
      opt = opt || {};
      if (!risk || !risk.seviye) return opt.bosGoster ? `<div class="gz-risk ok small">Ziyaret güvenliği: raporda risk beyanı yok.</div>` : "";
      const s = opt.s;
      return `<div class="gz-risk sev${risk.seviye} stack">
        <div class="row between"><b>Ziyaret öncesi risk notu</b><span class="pill ${risk.seviye >= 3 ? "coral" : risk.seviye === 2 ? "sun" : "plain"}">risk ${risk.ad}</span></div>
        ${risk.notlar.map((n) => `<div class="row small" style="flex-wrap:nowrap;align-items:flex-start"><span aria-hidden="true">•</span><span>${esc(n.metin)} <span class="tiny muted">${n.kaynak === "YZ" ? "YZ" : "kural"}</span></span></div>`).join("")}
        ${risk.oneriler.length ? `<div class="tiny muted" style="margin-top:2px">Öneriler</div>${risk.oneriler.slice(0, 4).map((x, i) => s && opt.butonlu && i < 2 && risk.seviye >= 3
          ? `<button class="btn gz-mini" type="button" data-gz="oneri" data-v="${esc(x)}" ${s.oneriler[x] ? "disabled" : ""}>${s.oneriler[x] ? "İstendi ✓ " : ""}${esc(x)}</button>`
          : `<div class="small">→ ${esc(x)}</div>`).join("")}` : ""}
        ${risk.sikKontrol ? `<div class="tiny">Güvenlik masası bu ziyarette her 10 dakikada kontrol eder.</div>` : ""}
        <div class="tiny muted">Hasta/yakını beyanından; yalnızca bu ziyaret için gösterilir, hastanın kaydına damga olarak işlenmez.</div></div>`;
    }

    function hastaHtml(r) {
      if (!aktif(r)) return "";
      const s = durum(r), k = konum(s, r), pp = o.kisi(r.provider_id);
      const foto = `<span class="gz-foto" aria-hidden="true">${esc(pp.initials)}</span>`;
      if (s.checkout) {
        if (s.hastaOnay === "tamam") return `<div class="card gz stack"><b>Ziyaret tamamlandı</b><div class="small">Teşekkürler. Onayınla ödeme alınır (demo).</div></div>`;
        return `<div class="card gz stack"><b>${esc(pp.first)} ziyareti bitirdi</b><div class="small">Hizmet tamamlandı mı?</div>
          <div class="row"><button class="btn primary" type="button" data-gz="h-tamam" style="flex:1">Evet, tamamlandı</button><button class="btn" type="button" data-gz="h-sorun">Sorun var</button></div>${sorunSecim(s)}</div>`;
      }
      if (s.checkin) {
        return `<div class="card gz stack"><div class="row between"><b>Güvenli ziyaret açık</b><span class="pill good"><span data-canli>${Math.floor(vdk(s))}</span> / ${s.sure} dk</span></div>
          <div class="small">${esc(pp.first)} ${saat({ checkin: s.checkin, checkout: s.checkin }, r)} itibarıyla evinde. Ziyaret boyunca güvenlik masası çalışanla düzenli kontrol yapıyor.</div>
          ${s.hastaSorunAcik ? sorunSecim(s) : `<button class="btn ghost gz-mini" type="button" data-gz="h-sorun">Sorun bildir</button>`}</div>`;
      }
      if (!k || !k.ulasti) return `<div class="card soft small gz-bekle">Kapıya gelince burada <b>kapı kodu</b> ve çalışanın fotoğrafı çıkacak. Kodu söyleyen ve fotoğrafa benzeyen kişiye kapıyı aç.</div>`;
      if (s.kodDurum === "tutmadi") return `<div class="card gz alarm stack"><b>Kapıyı açma</b><div class="small">Güvenlik masası bilgilendirildi ve seni arayacak. Tehlikedeysen hemen 112'yi ara.</div>
        <a class="btn block" href="tel:112" style="text-align:center;text-decoration:none">112'yi ara</a><button class="btn ghost" type="button" data-gz="h-kod-tekrar">Yanlış bastım, tekrar doğrula</button></div>`;
      if (s.kodDurum === "eslesti") return `<div class="card gz stack"><div class="row" style="gap:10px">${foto}<div><b>Kimlik doğrulandı</b><div class="small">${esc(pp.full)} kapında. Çalışan ziyareti başlatınca süre işlemeye başlar.</div></div></div></div>`;
      return `<div class="card gz stack" aria-live="polite"><b>Kapıdaki kişiyi doğrula</b>
        <div class="row" style="gap:12px;flex-wrap:nowrap">${foto}<div><div class="tiny muted">KAPI KODU</div><div class="gz-kod" aria-label="Kapı kodu ${s.kod.split("").join(" ")}">${s.kod}</div><div class="small">${esc(pp.full)}</div></div></div>
        <div class="small">Kapıyı açmadan önce çalışandan bu kodu söylemesini iste ve yüzünü fotoğrafla karşılaştır.</div>
        <div class="row"><button class="btn primary" type="button" data-gz="h-kod-ok" style="flex:1">Kod ve fotoğraf eşleşiyor</button><button class="btn" type="button" data-gz="h-kod-yok">Eşleşmiyor</button></div>
        <div class="tiny muted">Prototip: fotoğraf yerine baş harfler. Gerçekte doğrulanmış profil fotoğrafı gösterilir.</div></div>`;
    }
    function sorunSecim(s) {
      if (!s.hastaSorunAcik) return "";
      const sec = [["guvende-degil", "Kendimi güvende hissetmiyorum"], ["davranis", "Uygunsuz davranış"], ["kisi", "Gelen kişi farklı"], ["diger", "Başka bir sorun"]];
      return `<div class="stack" style="gap:6px"><div class="tiny muted">Bildirimin çalışana gösterilmez; güvenlik masası sana yazılı döner.</div>
        <div class="seg">${sec.map(([v, l]) => `<button class="chip" type="button" data-gz="h-sorun-sec" data-v="${v}">${l}</button>`).join("")}</div></div>`;
    }

    function calisanHtml(r) {
      if (!aktif(r)) return "";
      const s = durum(r), k = konum(s, r), pp = o.kisi(r.provider_id);
      const risk = riskHtml(s.risk, { s, butonlu: !s.checkin, bosGoster: !s.checkin });
      const bas = `<div class="row between"><b>Güvenli ziyaret · ${esc((o.hizmet(r.service) || {}).name_tr || "")}</b><span class="tiny muted">${hhmm(r.arrival_min)}</span></div>`;
      if (s.checkout) {
        const siddet = s.cikisSorun === "sozlu" || s.cikisSorun === "fiziksel";
        return `<div class="card gz stack">${bas}<div class="small">Çıkış yapıldı (${Math.round(vdk(s))} dk). Konum paylaşımı durdu.</div>
          ${siddet ? beyazKodHtml(s, r) : s.cikisSorun === "diger" ? `<div class="small">Bildirimin güvenlik masasına iletildi; seni arayacaklar.</div>` : ""}</div>`;
      }
      if (s.checkin) {
        if (s.cikisSoru) {
          const sec = [["yok", "Hayır, sorun yok"], ["sozlu", "Sözlü şiddet ya da tehdit"], ["fiziksel", "Fiziksel şiddet"], ["diger", "Başka bir sorun"]];
          return `<div class="card gz stack">${bas}<b class="small">Ziyarette sorun yaşadın mı?</b><div class="stack" style="gap:6px">${sec.map(([v, l]) => `<button class="btn ${v === "yok" ? "primary" : ""}" type="button" data-gz="cikis-sec" data-v="${v}">${l}</button>`).join("")}</div></div>`;
        }
        return `<div class="card gz stack">${bas}
          <div class="row between" style="flex-wrap:nowrap"><button class="gz-sure" type="button" data-gz-sure="1" aria-label="Ziyaret süresi"><span data-canli>${Math.floor(vdk(s))}</span><small> / ${s.sure} dk</small></button>
            <div class="tiny muted" style="text-align:right">Konum paylaşılıyor<br>son kayıt <span data-canli>${s.konumlar[0] ? s.konumlar[0].saat : "-"}</span><br>sonraki kontrol ~<span data-canli>${Math.max(0, Math.ceil(s.sonraki - vdk(s)))}</span> dk${s.onay ? `<br>son yanıt ✓ ${s.onay.saat}` : ""}</div></div>
          <div class="row"><button class="btn primary" type="button" data-gz="cikis" style="flex:1">Ziyareti bitir (çıkış)</button><button class="btn gz-sos" type="button" data-gz="sos">Acil yardım</button></div>
          <div class="tiny muted">Gizli alarm: süreye 2 saniye basılı tut. Ekranda hiçbir şey değişmez, güvenlik masası sessizce devreye girer.</div></div>`;
      }
      const yakin = k && k.m <= GEOFENCE_M;
      return `<div class="card gz stack">${bas}${risk}
        <div class="gz-kodkutu"><div class="tiny muted">KAPI KODUN</div><div class="gz-kod">${s.kod}</div><div class="small">Kapıda hastaya söyle; hasta kendi ekranındaki kod ve fotoğrafla eşleştirir.</div>
          <div class="small">${s.kodDurum === "eslesti" ? "✓ Hasta kodu onayladı" : s.kodDurum === "tutmadi" ? "⚠ Hasta kodu doğrulayamadı. Kimlik kartını göster; masa hastayı arıyor." : "Hasta onayı bekleniyor"}</div></div>
        <div class="small">${k ? (yakin ? `✓ Konum: adrese ${k.m} m` : `Konum: adrese ${uzaklik(k.m)} (check-in için ${GEOFENCE_M} m içinde ol)`) : "Konum alınamadı"}</div>
        <button class="btn primary block" type="button" data-gz="checkin">Ziyareti başlat (check-in)</button>
        ${s.hata ? `<div class="lockmsg" role="alert">${esc(s.hata)}</div>` : ""}</div>`;
    }
    function beyazKodHtml(s, r) {
      return `<div class="gz-beyaz stack"><b>Beyaz Kod: şiddeti bildir</b>
        <div class="small">Sağlık çalışanına yönelik şiddet Sağlık Bakanlığı'nın Beyaz Kod sistemine bildirilir. Acil tehlike sürüyorsa önce 112.</div>
        <div class="row"><a class="btn" href="tel:113" style="flex:1;text-align:center;text-decoration:none">113 Beyaz Kod'u ara</a><a class="btn" href="https://beyazkod.saglik.gov.tr" target="_blank" rel="noopener" style="flex:1;text-align:center;text-decoration:none">beyazkod.saglik.gov.tr</a></div>
        <div class="tiny muted">Bildirim için hazır olay kaydı: ${esc(o.tarih || "")} ${hhmm(r.arrival_min)}–${saat(s, r)}, ${esc(r.patient.district)}, ${s.konumlar.length} konum kaydı, ${s.olaylar.length} olay. Kayıt güvenlik masasında saklanır.</div></div>`;
    }

    // Çalışan ekranının üstünde: kontrol bildirimi, gelen arama ya da SOS iptali (PIN ile)
    function uyariHtml(r) {
      if (!aktif(r)) return "";
      const s = durum(r);
      const pinAlani = (baglam) => `<div class="row" style="flex-wrap:nowrap"><input class="inp gz-pin" id="gzPin" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" maxlength="4" autocomplete="one-time-code" data-baglam="${baglam}" aria-label="PIN" placeholder="PIN" value="${esc(s.pin)}">
        <button class="btn primary" type="button" data-gz="pin" data-baglam="${baglam}">${baglam === "sos" ? "İptal et" : "Yolundayım"}</button></div>${s.pinHata ? `<div class="tiny" role="alert" style="color:var(--coral)">${esc(s.pinHata)}</div>` : ""}<div class="tiny muted">Demo PIN: ${PIN}</div>`;
      if (s.sos && !s.sos.iptal) {
        const kalan = Math.max(0, Math.ceil(SOS_IPTAL_SN - (Date.now() - s.sos.t0) / 1000));
        return `<div class="gz-uyari alarm stack" role="alert"><b>Alarm gönderildi</b><div class="small">Güvenlik masası konumunu görüyor ve seni arıyor. ${s.sos.bildirildi ? "112'ye bildirildi (demo)." : `<span data-canli>${kalan}</span> sn içinde iptal edilmezse 112'ye son konumla bildirilir.`}</div>
          <a class="btn block" href="tel:112" style="text-align:center;text-decoration:none">112'yi ara</a>${s.sos.bildirildi ? "" : `<div class="tiny">Yanlış alarm mı? PIN ile iptal et:</div>${pinAlani("sos")}`}</div>`;
      }
      if (!s.kontrol) return s.onay && Date.now() - s.onay.t < 5000 ? `<div class="gz-uyari ok stack" role="status"><b>✓ Teşekkürler, yanıtın alındı</b><div class="small">Güvenlik masası kaydetti. Sonraki kontrol ~${s.onay.dk} dk sonra${s.checkin && vdk(s) >= s.sure ? "; ziyaret bittiyse “Ziyareti bitir”e bas" : ""}.</div></div>` : "";
      const sev = seviye(s);
      if (sev === 2 && !s.kontrol.acildi) return `<div class="gz-uyari arama stack" role="alert"><b>Gelen arama · anında sağlık Güvenlik Masası</b><div class="small">Bildirimlere yanıt vermedin; operatör seni arıyor.</div>
        <div class="row"><button class="btn primary" type="button" data-gz="ac" style="flex:1">Aç</button><button class="btn" type="button" data-gz="yardim">Yardım gerekiyor</button></div></div>`;
      const baslik = s.kontrol.acildi ? "Operatör hatta: iyiysen PIN'ini gir" : sev >= 3 ? "Yanıt bekleniyor: güvenlik masası devrede" : sev === 1 ? "İkinci uyarı: Her şey yolunda mı?" : "Her şey yolunda mı?";
      return `<div class="gz-uyari ${sev >= 1 ? "sev" : ""} stack" role="alert"><b>${baslik}</b>
        <div class="small">${s.kontrol.neden === "sure" ? "Planlanan ziyaret süresi doldu." : "Ziyaret sırasında düzenli kontrol."} ${sev <= 1 && !s.kontrol.acildi ? `<span data-canli>${kalanSn(s)}</span> sn içinde yanıt vermezsen bir sonraki adıma geçilir (demo; gerçekte 2 dk).` : ""}</div>
        ${pinAlani("kontrol")}<div class="row">${s.kontrol.neden === "sure" || vdk(s) >= s.sure ? `<button class="btn" type="button" data-gz="cikis" style="flex:1">Ziyareti bitir</button>` : ""}<button class="btn gz-sos" type="button" data-gz="yardim" style="flex:1">Yardım gerekiyor</button></div></div>`;
    }

    // Güvenlik masası (platform operasyonu) — jüri ve demo için görünür panel
    function masaHtml(r) {
      if (!aktif(r)) return `<h3>Güvenlik masası</h3><div class="small muted">Hasta tarafında bugün için randevu alıp kabul edilince ziyaret burada izlenir: konum kaydı, kontrol zamanlayıcısı ve yükseltme zinciri.</div>`;
      const s = durum(r), k = konum(s, r), pp = o.kisi(r.provider_id), sev = seviye(s);
      const evre = s.checkout ? "Bitti" : s.checkin ? `Ziyarette · <span data-canli>${Math.floor(vdk(s))}</span>/${s.sure} dk` : k && k.ulasti ? "Kapıda" : "Yolda";
      return `<h3>Güvenlik masası <span class="tiny muted">(platform operasyonu · demo görünümü)</span></h3>
        <div class="row between small"><span><b>${esc(pp.full)}</b> · ${esc(r.patient.district)}</span><span class="pill ${s.sessiz || (s.sos && !s.sos.iptal) || sev >= 3 ? "coral" : s.kontrol ? "sun" : "good"}">${s.sessiz ? "SESSİZ ALARM" : s.sos && !s.sos.iptal ? "SOS" : sev >= 3 ? "ALARM" : s.kontrol ? "Kontrol" : evre}</span></div>
        <div class="tiny">Kapı kodu: ${s.kodDurum === "eslesti" ? "doğrulandı" : s.kodDurum === "tutmadi" ? "DOĞRULANAMADI" : "bekliyor"} · risk: ${s.risk.ad} · son konum: ${s.konumlar[0] ? `${s.konumlar[0].saat}, adrese ${uzaklik(s.konumlar[0].m)} (${s.konumlar.length} kayıt)` : "-"}${s.checkout ? " · paylaşım durdu" : ""}</div>
        <ol class="gz-zincir">${ZINCIR.map((z, i) => `<li class="${s.kontrol ? (i < sev ? "gecti" : i === sev ? "simdi" : "") : ""}">${esc(z[0])}${z[1] ? ` <span class="tiny muted">${esc(z[1])}</span>` : ""}</li>`).join("")}</ol>
        <div class="gz-log">${s.olaylar.slice(0, 8).map((e) => `<div class="tiny ${e.tur}"><b>${esc(e.saat)}</b> ${esc(e.kim)}: ${esc(e.metin)}</div>`).join("") || `<div class="tiny muted">Henüz olay yok.</div>`}</div>
        <div class="row" style="gap:6px">${s.checkin && !s.checkout ? `<button class="btn gz-mini" type="button" data-gz="d-simdi" ${s.kontrol ? "disabled" : ""}>Kontrolü şimdi gönder</button><button class="btn gz-mini" type="button" data-gz="d-hizli" ${s.kontrol && sev < ZINCIR.length - 1 && !s.kontrol.acildi ? "" : "disabled"}>Zinciri hızlandır</button>` : ""}
          ${!s.checkin ? `<button class="btn gz-mini" type="button" data-gz="d-uzak" aria-pressed="${s.uzak}">Konum hatası dene</button>` : ""}</div>
        <div class="tiny muted">Demo PIN ${PIN} · baskı PIN'i ${BASKI_PIN} (iptal ediyormuş gibi görünür, sessiz alarm verir). Konum yalnızca ziyaret penceresinde ve çalışanın onayıyla kaydedilir; olay yoksa süreli saklanıp silinmesi önerilir (KVKK).</div>`;
    }

    // ---------- etkileşim ----------
    function onClick(e, r) {
      const t = e.target.closest("[data-gz]"); if (!t || !aktif(r)) return false;
      const s = durum(r), a = t.dataset.gz, v = t.dataset.v;
      if (a === "h-kod-ok") { s.kodDurum = "eslesti"; s.hata = ""; olay(s, r, "Hasta", "Kapı kodu ve fotoğraf eşleşti"); }
      else if (a === "h-kod-yok") { s.kodDurum = "tutmadi"; olay(s, r, "Hasta", "Kapıdaki kişiyi doğrulayamadı → operatör hastayı ve çalışanı arıyor", "alarm"); }
      else if (a === "h-kod-tekrar") { s.kodDurum = null; olay(s, r, "Hasta", "Doğrulamayı yeniledi"); }
      else if (a === "h-tamam") { s.hastaOnay = "tamam"; s.hastaSorunAcik = false; olay(s, r, "Hasta", "Hizmetin tamamlandığını onayladı"); }
      else if (a === "h-sorun") { s.hastaSorunAcik = !s.hastaSorunAcik; degis(); }
      else if (a === "h-sorun-sec") {
        s.hastaSorunAcik = false; if (s.checkout) s.hastaOnay = "sorun";
        const ad = { "guvende-degil": "Kendini güvende hissetmiyor", davranis: "Uygunsuz davranış bildirdi", kisi: "Gelen kişinin farklı olduğunu bildirdi", diger: "Sorun bildirdi" }[v] || "Sorun bildirdi";
        olay(s, r, "Hasta", `${ad} (çalışana gösterilmez) → operatör hastaya yazılı dönüyor`, v === "diger" ? "uyari" : "alarm");
        o.bildir && o.bildir("p", "Bildirimin güvenlik masasına iletildi. Tehlikedeysen 112'yi ara.");
      }
      else if (a === "checkin") {
        const k = konum(s, r);
        if (!k || k.m > GEOFENCE_M) { s.hata = `Adrese ${k ? uzaklik(k.m) : "?"} uzaktasın. Check-in için adrese ${GEOFENCE_M} m içinde olmalısın.`; olay(s, r, "Sistem", "Check-in reddedildi: konum adresle eşleşmiyor", "uyari"); }
        else if (s.kodDurum !== "eslesti") { s.hata = "Hasta kapı kodunu henüz onaylamadı. Kodu hastaya söyle."; degis(); }
        else { s.hata = ""; s.checkin = Date.now(); s.sonraki = aralik(s); olay(s, r, "Çalışan", `Check-in: adrese ${k.m} m, kapı kodu doğrulandı. Kontrol zamanlayıcısı başladı (ilk kontrol ~${aralik(s)} dk)`); }
      }
      else if (a === "pin") {
        const pin = (s.pin || "").trim(), bag = t.dataset.baglam;
        if (pin === PIN || pin === BASKI_PIN) {
          if (bag === "sos" && s.sos) { s.sos.iptal = true; s.pin = ""; s.pinHata = ""; olay(s, r, "Çalışan", "SOS iptal edildi (yanlış alarm)"); }
          else if (s.kontrol) kontrolCoz(s, r, "“Yolundayım” yanıtı verdi (PIN)");
          if (pin === BASKI_PIN) sessizAlarm(s, r, "baskı PIN'i girildi");
        } else { s.pinHata = "PIN yanlış."; degis(); }
      }
      else if (a === "ac") { if (s.kontrol) { s.kontrol.acildi = Date.now(); olay(s, r, "Çalışan", "Operatörün aramasını açtı"); } }
      else if (a === "yardim" || a === "sos") {
        if (s.kontrol) { s.kontrol = null; s.sonraki = vdk(s) + aralik(s); }
        if (!s.sos || s.sos.iptal) { s.sos = { t0: Date.now() }; s.pin = ""; s.pinHata = ""; olay(s, r, "Çalışan", `ACİL YARDIM istedi · konum ${konum(s, r) ? konum(s, r).pos.map((x) => x.toFixed(4)).join(", ") : "-"} → operatör arıyor, ${SOS_IPTAL_SN} sn içinde iptal edilmezse 112`, "alarm"); }
      }
      else if (a === "cikis") { if (s.kontrol && seviye(s) <= 1) { kontrolCoz(s, r, "Ziyareti bitirmeye geçti"); s.onay = null; } s.cikisSoru = true; degis(); }
      else if (a === "cikis-sec") {
        s.checkout = Date.now(); s.cikisSoru = false; s.cikisSorun = v; s.kontrol = null;
        const ad = { yok: "sorun yok", sozlu: "sözlü şiddet/tehdit bildirdi", fiziksel: "fiziksel şiddet bildirdi", diger: "başka bir sorun bildirdi" }[v];
        olay(s, r, "Çalışan", `Çıkış yaptı (${Math.round(vdk(s))} dk): ${ad}. Konum paylaşımı durdu`, v === "yok" ? "" : "alarm");
        if (v === "sozlu" || v === "fiziksel") olay(s, r, "Sistem", "Beyaz Kod (113) bildirimi için olay kaydı hazırlandı", "uyari");
      }
      else if (a === "oneri") { s.oneriler[v] = true; olay(s, r, "Çalışan", `Öneri istendi: ${v} (demo: platform hastaya iletir)`); o.bildir && o.bildir("h", "İstek hastaya iletildi (demo)."); }
      else if (a === "d-simdi") { if (s.checkin && !s.kontrol) s.sonraki = vdk(s); }
      else if (a === "d-hizli") { if (s.kontrol) { const kal = kalanSn(s); s.kontrol.t0 -= kal * 1000; } }
      else if (a === "d-uzak") { s.uzak = !s.uzak; s.hata = ""; degis(); }
      else return false;
      degis();
      return true;
    }
    function onInput(e, r) { if (e.target.id === "gzPin" && aktif(r)) { durum(r).pin = e.target.value.replace(/\D/g, "").slice(0, 4); return true; } return false; }
    function onPointerDown(e, r) {
      const t = e.target.closest("[data-gz-sure]"); if (!t || !aktif(r)) return;
      clearTimeout(basili); basili = setTimeout(() => { const s = durum(r); sessizAlarm(s, r, "gizli tuş: süreye 2 sn basılı tutuldu"); try { navigator.vibrate && navigator.vibrate(30); } catch (x) { /* yok */ } }, 2000);
    }
    function onPointerUp() { clearTimeout(basili); basili = null; }

    return { riskAnaliz, riskHtml, aktif, durum: (r) => (aktif(r) ? durum(r) : null), tick, hastaHtml, calisanHtml, uyariHtml, masaHtml, onClick, onInput, onPointerDown, onPointerUp, surum: () => surum, PIN, BASKI_PIN, ZINCIR };
  }

  const api = { create, riskAnaliz, mesafeM, ZINCIR, GEOFENCE_M };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KapidaGuvenlik = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
