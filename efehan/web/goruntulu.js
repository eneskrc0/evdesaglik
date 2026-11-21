/* anında sağlık — Görüntülü doktor görüşmesi (hasta + doktor arayüzü, DEMO görüşme).
   Gerçek iki kişilik görüntülü bağlantı YOK: bu dosya randevu/oda durumlarını, kamera-mikrofon önizlemesini (yalnızca
   kullanıcının kendi cihazı, açık eylemle) ve arayüzü kurar. Doktorun görüntüsü yerine "Demo görüşme" etiketli profil alanı
   gösterilir. Gerçek bağlantı için WebRTC + sinyal sunucusu (ör. Cloudflare Calls / LiveKit / Jitsi) ve TURN gerekir.

   Randevu akışı: planlandi → bekleme → gorusme → tamamlandi  (+ iptal, katilmadi)
   - Bağlantının kopması randevuyu bitirmez; ayrılmak, yeniden katılmak ve tamamlamak ayrı işlemlerdir.
   - Tamamlama yalnızca doktordadır; görüşme bitince kamera/mikrofon kapatılır.
   - Doktorun özel notu hastaya gösterilmez.
*/
(function () {
  "use strict";
  const DURUM_AD = { planlandi: "Planlandı", bekleme: "Bekleme odası açık", gorusme: "Görüşme sürüyor", tamamlandi: "Tamamlandı", iptal: "İptal edildi", katilmadi: "Katılım olmadı" };
  const ODA_ACILIR = 10; // görüşme saatinden kaç dk önce katılınabilir

  function create(o) {
    const esc = o.esc, hhmm = o.hhmm;
    const S = {};          // oda durumu, oda anahtarına göre
    let medya = null;      // hastanın kendi kamera/mikrofon akışı (yalnızca bu cihaz)
    let medyaHata = "", medyaIsteniyor = false;
    let saat = o.simdi;    // demo saati (dk); gerçek uygulamada cihaz saati
    const sn = () => Date.now();

    const oda = (k, r) => (S[k] ||= { durum: "planlandi", hasta: "yok", doktor: "yok", kopuk: false, basla: null, not: "", hastaMik: true, hastaKam: true,
      doktorMik: true, doktorKam: true, ayrilOnay: null, ozetAcik: false, bitirOnay: false, katildiMi: false, olaylar: [] });
    const olay = (s, m) => { s.olaylar.unshift({ t: hhmm(saat), m }); };
    const bas = (r) => r.vgBaslangic != null ? r.vgBaslangic : r.arrival_min;
    const sure = (r) => r.vgSure || o.hizmet(r.service).duration_min;
    const anahtar = (r) => r.vgAnahtar || r.id;
    const durum = (r) => oda(anahtar(r), r);
    const acikMi = (r) => saat >= bas(r) - ODA_ACILIR && saat <= bas(r) + sure(r) + 30;
    const bitti = (s) => ["tamamlandi", "iptal", "katilmadi"].includes(s.durum);

    // ---- medya: yalnızca kullanıcının açık eylemiyle ----
    async function medyaAc() {
      if (medya || medyaIsteniyor) return true;
      medyaIsteniyor = true; medyaHata = "";
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error("yok"), { name: "NotSupportedError" });
        medya = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      } catch (e) {
        medya = null;
        medyaHata = e.name === "NotAllowedError" || e.name === "SecurityError" ? "izin" : e.name === "NotFoundError" || e.name === "OverconstrainedError" ? "cihaz" : e.name === "NotSupportedError" ? "desteksiz" : "diger";
      }
      medyaIsteniyor = false;
      for (const s of Object.values(S)) { s.hastaKam = !!medya; s.hastaMik = !!medya; }
      return !!medya;
    }
    function medyaKapat() { if (medya) medya.getTracks().forEach((t) => t.stop()); medya = null; }
    function izYansit(s) { if (!medya) return; medya.getVideoTracks().forEach((t) => { t.enabled = s.hastaKam; }); medya.getAudioTracks().forEach((t) => { t.enabled = s.hastaMik; }); }
    function videolariBagla(kok) {
      kok.querySelectorAll("video[data-vg-akis]").forEach((v) => { if (medya && v.srcObject !== medya) { v.srcObject = medya; v.play().catch(() => {}); } });
    }
    const HATA_METNI = {
      izin: "Kamera ya da mikrofon izni verilmedi. Tarayıcının adres çubuğundaki kilit simgesinden izin verip yeniden deneyebilirsin. İzin vermeden de görüşmeye sesli/görüntüsüz katılabilirsin.",
      cihaz: "Kamera ya da mikrofon bulunamadı. Takılı olduğundan emin olup yeniden dene.",
      desteksiz: "Bu tarayıcı kamera erişimini desteklemiyor ya da sayfa güvenli (https) açılmadı.",
      diger: "Kamera ya da mikrofon açılamadı. Başka bir uygulama kullanıyor olabilir; kapatıp yeniden dene.",
    };

    // ---- ortak parçalar ----
    const dk = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
    const profilAlani = (ad, alt, bas2) => `<div class="vg-profil"><span class="vg-avatar">${esc(bas2)}</span><b>${esc(ad)}</b><span>${esc(alt)}</span></div>`;
    const kendiOnizleme = (s, buyuk) => medya && s.hastaKam
      ? `<video class="${buyuk ? "vg-onizleme-buyuk" : "vg-kendi"}" data-vg-akis autoplay muted playsinline aria-label="Kendi kamera görüntün"></video>`
      : `<div class="${buyuk ? "vg-onizleme-buyuk" : "vg-kendi"} vg-kapali" role="img" aria-label="Kameran kapalı">${buyuk ? `<span>${medya ? "Kameran kapalı" : "Kamera henüz açılmadı"}</span>` : "Kameran kapalı"}</div>`;
    const kontrol = (taraf, s) => {
      const mik = taraf === "p" ? s.hastaMik : s.doktorMik, kam = taraf === "p" ? s.hastaKam : s.doktorKam;
      const yok = taraf === "p" && !medya;
      return `<button class="vg-btn" type="button" data-vg="${taraf}-mik" aria-pressed="${!mik}" ${yok ? "disabled" : ""}>${mik ? "Mikrofonu kapat" : "Mikrofonu aç"}</button>
        <button class="vg-btn" type="button" data-vg="${taraf}-kam" aria-pressed="${!kam}" ${yok ? "disabled" : ""}>${kam ? "Kamerayı kapat" : "Kamerayı aç"}</button>`;
    };
    const demoEtiket = `<span class="vg-demo" title="Gerçek görüntülü bağlantı değil">DEMO GÖRÜŞME · gerçek bağlantı değil</span>`;

    // Hastanın gördüğü bekleme/görüşme durumu (doktor gecikmesi, erken gelme ve bağlantı sorunu ayrı)
    function hastaDurumMetni(r, s) {
      if (s.kopuk) return ["kopuk", "Bağlantı kesildi, yeniden bağlanılıyor…"];
      if (s.durum === "gorusme" && s.doktor === "gorusmede") return ["iyi", "Görüşme sürüyor"];
      if (s.doktor === "ayrildi") return ["bekle", "Doktorun bağlantısı koptu; geri dönmesi bekleniyor"];
      if (saat < bas(r)) return ["erken", `Erken geldin. Görüşme ${hhmm(bas(r))}'de başlar; doktorun o saatte katılacak.`];
      if (saat >= bas(r) + 5) return ["gecikme", `Doktorun ${saat - bas(r)} dk gecikti. Bekleme odasında kalabilirsin; 15 dk içinde katılmazsa ücret alınmaz ve yeniden planlayabilirsin.`];
      return ["bekle", "Doktorunuz bekleniyor"];
    }

    // ======================= HASTA =======================
    function hastaRandevuHtml(r, ctx) {
      const s = durum(r), pp = o.kisi(ctx.doktorId || r.provider_id), onay = r.status === "kabul";
      const ad = DURUM_AD[r.status === "iptal" ? "iptal" : r.status === "red" ? "iptal" : s.durum];
      const katilabilir = onay && !bitti(s) && acikMi(r);
      return `<div class="card stack vg-randevu" style="gap:12px">
        <div class="row between"><span class="pill kirmizi">Görüntülü doktor görüşmesi</span><span class="pill ${s.durum === "tamamlandi" ? "plain" : onay ? "good" : "sun"}">${esc(r.status === "bekliyor" ? "Onay bekleniyor" : r.status === "red" ? "Uygun değil" : ad)}</span></div>
        <div class="row" style="gap:12px;flex-wrap:nowrap"><span class="profil-foto vg-doktor-foto">${o.avatar ? o.avatar() : ""}</span><div style="min-width:0"><div class="profil-ad">${esc(pp.full)}</div><div class="vg-metin muted">${esc(pp.prof)}${ctx.karma ? " · hemşire ziyaretine görüntülü katılır" : ""}</div></div></div>
        <dl class="vg-bilgi"><dt>Tarih</dt><dd>${esc(ctx.gunAd)}</dd><dt>Saat</dt><dd>${hhmm(bas(r))} – ${hhmm(bas(r) + sure(r))}</dd><dt>Süre</dt><dd>${sure(r)} dakika</dd>${ctx.karma ? "" : `<dt>Toplam ücret</dt><dd><b>${esc(ctx.ucret)} TL</b></dd>`}</dl>
        <div class="vg-uyari">${ctx.karma ? "Doktor bu ziyarete görüntülü katılacak; evine yalnızca hemşire gelir." : "Bu randevu görüntülüdür. Doktor evinize gelmeyecek."}</div>
        ${s.durum === "tamamlandi" ? `<div class="vg-metin">Görüşme tamamlandı. Doktorun gerekirse ev ziyareti ya da tahlil isteyebilir; bildirimlerden haber veririz.</div>`
          : s.durum === "katilmadi" ? `<div class="vg-metin">Bu görüşmeye katılım olmadı. Yeniden planlamak için ana sayfadan yeni talep oluşturabilirsin.</div>`
          : r.status === "iptal" ? `<div class="vg-metin">Randevu iptal edildi; doktorun takviminden çıkarıldı.</div>`
          : `<button class="vg-btn vg-btn-ikinci" type="button" data-vg="p-hazirlik" data-id="${esc(anahtar(r))}">Kamera ve mikrofonu kontrol et</button>
             <button class="vg-katil" type="button" data-vg="p-katil" data-id="${esc(anahtar(r))}" ${katilabilir ? "" : "disabled"}>${s.hasta !== "yok" || (s.durum === "gorusme") ? "Görüşmeye yeniden katıl" : "Görüşmeye katıl"}</button>
             <div class="vg-metin muted">${!onay ? "Doktor onaylayınca katılabileceksin." : katilabilir ? (s.doktor === "gorusmede" ? "Doktorun görüşmede, seni bekliyor." : "Görüşme odası açık.") : `Görüşme odası ${hhmm(bas(r) - ODA_ACILIR)}'de açılır (şu an ${hhmm(saat)}).`}</div>
             ${onay && !acikMi(r) && saat < bas(r) ? `<button class="btn ghost" type="button" data-vg="demo-saat" data-v="${bas(r) - 5}">Demo: saati ${hhmm(bas(r) - 5)}'e ilerlet</button>` : ""}`}
        ${!bitti(s) && r.status !== "iptal" && s.durum !== "gorusme" && !ctx.karma ? `<button class="btn block" type="button" data-act="cancel">Randevuyu iptal et</button>` : ""}
      </div>`;
    }
    function hastaOdaHtml(r, ctx) {
      const s = durum(r), pp = o.kisi(ctx.doktorId || r.provider_id);
      if (s.hasta === "hazirlik" || s.hasta === "yok") { // hazırlık: kendi önizleme + ayarlar
        const [, metin] = hastaDurumMetni(r, s);
        return `<div class="vg-ekran stack">
          <button class="back" type="button" data-vg="p-geri">← Randevuya dön</button>
          <h2 class="vg-baslik">Görüşmeye hazırlan</h2>
          ${kendiOnizleme(s, true)}
          ${medyaHata ? `<div class="vg-hata" role="alert">${esc(HATA_METNI[medyaHata])}<button class="vg-btn" type="button" data-vg="p-medya">Yeniden dene</button></div>` : ""}
          ${medya ? `<div class="vg-dugmeler">${kontrol("p", s)}</div>` : `<button class="vg-btn" type="button" data-vg="p-medya" ${medyaIsteniyor ? "disabled" : ""}>${medyaIsteniyor ? "İzin bekleniyor…" : "Kamerayı ve mikrofonu aç"}</button>`}
          <div class="vg-durum vg-durum-${hastaDurumMetni(r, s)[0]}" role="status">${esc(acikMi(r) ? metin : `Görüşme odası ${hhmm(bas(r) - ODA_ACILIR)}'de açılır.`)}</div>
          <button class="vg-katil" type="button" data-vg="p-odaya" ${acikMi(r) && !bitti(s) ? "" : "disabled"}>Görüşmeye katıl</button>
          <div class="vg-metin muted">Doktor: ${esc(pp.full)} · ${hhmm(bas(r))}</div></div>`;
      }
      const [tur, metin] = hastaDurumMetni(r, s);
      const gorusmede = s.durum === "gorusme" && s.doktor === "gorusmede";
      return `<div class="vg-ekran vg-gorusme">
        <div class="vg-ust"><div><b>${esc(pp.full)}</b><div class="vg-ust-alt"><span class="vg-nokta vg-${tur}"></span>${esc(gorusmede && !s.kopuk ? "Bağlı" : metin)}${s.basla ? ` · <span data-vg-sure="${esc(anahtar(r))}">${dk(sn() - s.basla)}</span>` : ""}</div></div>${demoEtiket}</div>
        <div class="vg-buyuk">${gorusmede && s.doktorKam ? `<div class="vg-uzak-demo">${profilAlani(pp.full, "Doktorun görüntüsü (demo: gerçek kamera akışı yok)", pp.initials)}<span class="vg-konusuyor" aria-hidden="true"></span></div>`
          : gorusmede ? profilAlani(pp.full, "Doktorun kamerası kapalı", pp.initials)
          : `<div class="vg-bekleme" role="status">${profilAlani(pp.full, metin, pp.initials)}</div>`}
          ${s.kopuk ? `<div class="vg-kopuk" role="alert"><b>Bağlantı kesildi, yeniden bağlanılıyor…</b><span>İnternetini kontrol et. Randevun iptal olmadı.</span><button class="vg-btn" type="button" data-vg="p-yeniden">Yeniden dene</button></div>` : ""}
          ${kendiOnizleme(s, false)}</div>
        <div class="vg-dugmeler">${kontrol("p", s)}<button class="vg-btn vg-ayril" type="button" data-vg="p-ayril-sor">Görüşmeden ayrıl</button></div>
        ${s.ayrilOnay === "p" ? `<div class="vg-onay" role="alertdialog" aria-label="Görüşmeden ayrılma onayı"><b>Görüşmeden ayrılmak istiyor musun?</b><span>Ayrılırsan randevu bitmez; görüşme süresi içinde yeniden katılabilirsin.</span>
          <div class="vg-dugmeler"><button class="vg-btn" type="button" data-vg="p-kal">Görüşmede kal</button><button class="vg-btn vg-ayril" type="button" data-vg="p-ayril">Evet, ayrıl</button></div></div>` : ""}
        <details class="vg-demo-panel"><summary>Demo kontrolleri (sunum için)</summary><div class="vg-dugmeler">
          ${ctx.tekTelefon && s.doktor !== "gorusmede" ? `<button class="btn" type="button" data-vg="demo-doktor" data-id="${esc(anahtar(r))}">Doktoru katılt</button>` : ""}
          ${saat < bas(r) + 7 ? `<button class="btn" type="button" data-vg="demo-saat" data-v="${bas(r) + 7}">Doktor 7 dk gecikti</button>` : ""}
          <button class="btn" type="button" data-vg="demo-kop" data-id="${esc(anahtar(r))}">Bağlantıyı kopar</button></div></details>
      </div>`;
    }

    // ======================= DOKTOR =======================
    function doktorKartHtml(r, ctx) {
      const s = durum(r);
      const hastaYazi = s.hasta === "bekleme" || s.hasta === "gorusmede" ? `<span class="pill good">Hasta bekleme odasında</span>` : s.hasta === "hazirlik" ? `<span class="pill sun">Hasta hazırlanıyor</span>` : `<span class="pill plain">Hasta henüz katılmadı</span>`;
      return `<div class="card stack vg-doktor-kart" style="gap:8px"><div class="row between"><span class="row" style="gap:6px"><span class="pill kirmizi">Görüntülü</span><b>${hhmm(bas(r))} · ${sure(r)} dk</b></span>${bitti(s) || r.status === "iptal" ? `<span class="pill plain">${esc(r.status === "iptal" ? "İptal edildi" : DURUM_AD[s.durum])}</span>` : hastaYazi}</div>
        <div class="small">${esc(ctx.baslik)}</div>${ctx.karma ? `<div class="tiny muted">Hemşire evde; sen görüntülü katılıyorsun. Yolculuk yok.</div>` : ""}
        ${bitti(s) || r.status === "iptal" ? "" : `<button class="vg-katil" type="button" data-vg="h-katil" data-id="${esc(anahtar(r))}" ${acikMi(r) ? "" : "disabled"}>${s.doktor === "ayrildi" ? "Görüşmeye yeniden katıl" : "Görüşmeye katıl"}</button>
        ${acikMi(r) ? "" : `<div class="tiny muted">Oda ${hhmm(bas(r) - ODA_ACILIR)}'de açılır (şu an ${hhmm(saat)}). <button class="btn ghost" type="button" data-vg="demo-saat" data-v="${bas(r) - 5}" style="min-height:0;padding:0">Demo: saati ilerlet</button></div>`}`}</div>`;
    }
    function doktorOdaHtml(r, ctx) {
      const s = durum(r);
      const hastaOdada = s.hasta === "bekleme" || s.hasta === "gorusmede";
      const sureMs = s.basla ? sn() - s.basla : 0;
      return `<div class="vg-ekran vg-gorusme">
        <div class="vg-ust"><div><b>Hasta · ${esc(ctx.hastaEtiket)}</b><div class="vg-ust-alt"><span class="vg-nokta vg-${hastaOdada ? "iyi" : "bekle"}"></span>${hastaOdada ? "Hasta bağlı" : s.hasta === "hazirlik" ? "Hasta kamerasını deniyor" : "Hasta henüz katılmadı"}${s.basla ? ` · <span data-vg-sure="${esc(anahtar(r))}">${dk(sureMs)}</span>` : ""}</div></div>${demoEtiket}</div>
        <div class="vg-buyuk">${hastaOdada && medya && s.hastaKam ? `<video class="vg-uzak" data-vg-akis autoplay muted playsinline aria-label="Hastanın görüntüsü (demo: aynı cihazdaki kamera)"></video><span class="vg-video-not">Demo: aynı tarayıcıdaki hasta kamerası</span>`
          : profilAlani(ctx.hastaEtiket, hastaOdada ? (s.hastaKam ? "Hastanın kamerası açılmadı" : "Hastanın kamerası kapalı") : "Hasta bekleniyor", "H")}
          ${s.kopuk ? `<div class="vg-kopuk" role="alert"><b>Bağlantı kesildi, yeniden bağlanılıyor…</b><span>Randevu bitmedi; bağlantı dönünce görüşme sürer.</span><button class="vg-btn" type="button" data-vg="h-yeniden">Yeniden dene</button></div>` : ""}
          <div class="vg-kendi vg-kapali">${s.doktorKam ? "Kameran (demo)" : "Kameran kapalı"}</div></div>
        <div class="vg-dugmeler">${kontrol("h", s)}<button class="vg-btn" type="button" data-vg="h-ozet" aria-expanded="${s.ozetAcik}">${s.ozetAcik ? "Özeti kapat" : "Hasta özetini aç"}</button></div>
        ${s.ozetAcik ? `<div class="vg-ozet" role="region" aria-label="Hasta özeti">${ctx.ozetHtml}</div>` : ""}
        <label class="stack small" style="gap:4px"><b>Görüşme notu</b> <span class="muted">(özel: hastaya otomatik gösterilmez)</span>
          <textarea class="inp" id="vgNot" data-id="${esc(anahtar(r))}" rows="3" maxlength="1500" placeholder="Değerlendirme, plan, takip…">${esc(s.not)}</textarea></label>
        <div class="vg-dugmeler"><button class="vg-btn vg-ayril" type="button" data-vg="h-ayril-sor">Görüşmeden ayrıl</button>
          <button class="vg-btn vg-tamamla" type="button" data-vg="h-bitir-sor" ${s.basla ? "" : "disabled"}>Görüşmeyi tamamla</button>
          ${!s.katildiMi && saat >= bas(r) + 10 ? `<button class="vg-btn" type="button" data-vg="h-katilmadi">Hasta katılmadı</button>` : ""}</div>
        ${!s.basla && !s.katildiMi && saat < bas(r) + 10 ? `<div class="tiny muted">Hasta ${hhmm(bas(r) + 10)}'a kadar katılmazsa "Hasta katılmadı" diyebilirsin.</div>` : ""}
        ${s.ayrilOnay === "h" ? `<div class="vg-onay" role="alertdialog"><b>Görüşmeden ayrılmak istiyor musun?</b><span>Randevu tamamlanmaz; yeniden katılabilirsin. Bitirmek için "Görüşmeyi tamamla"yı kullan.</span>
          <div class="vg-dugmeler"><button class="vg-btn" type="button" data-vg="h-kal">Görüşmede kal</button><button class="vg-btn vg-ayril" type="button" data-vg="h-ayril">Evet, ayrıl</button></div></div>` : ""}
        ${s.bitirOnay ? `<div class="vg-onay" role="alertdialog"><b>Görüşmeyi tamamlamak istiyor musun?</b><span>Randevu "Tamamlandı" olur; hasta da görür. Notun sende kalır.</span>
          <div class="vg-dugmeler"><button class="vg-btn" type="button" data-vg="h-bitir-vazgec">Vazgeç</button><button class="vg-btn vg-tamamla" type="button" data-vg="h-bitir">Evet, tamamla</button></div></div>` : ""}
      </div>`;
    }

    // ======================= OLAYLAR =======================
    // ctx: { odaAc(taraf, k), odaKapat(taraf), yenile(), tekTelefon, istek(k) → r, tamamlandi(r), katilmadi(r) }
    async function onClick(e, ctx) {
      const b = e.target.closest("[data-vg]"); if (!b || b.disabled) return false;
      const a = b.dataset.vg, k = b.dataset.id || ctx.aktifOda(a[0] === "h" ? "h" : "p");
      const r = k ? ctx.istek(k) : null, s = r ? durum(r) : null;
      if (a === "demo-saat") { saat = Math.max(saat, +b.dataset.v); ctx.yenile(); return true; }
      if (!r) return true;
      switch (a) {
        case "p-hazirlik": s.hasta = s.hasta === "yok" ? "hazirlik" : s.hasta; ctx.odaAc("p", k); break;
        case "p-katil": if (s.hasta === "yok") s.hasta = "hazirlik"; ctx.odaAc("p", k); break;
        case "p-geri": if (s.hasta === "hazirlik") s.hasta = "yok"; medyaKapat(); ctx.odaKapat("p"); break;
        case "p-medya": { const iz = medyaAc(); ctx.yenile(); await iz; izYansit(s); break; } // getUserMedia dokunuşun içinde çağrılır
        case "p-mik": s.hastaMik = !s.hastaMik; izYansit(s); break;
        case "p-kam": s.hastaKam = !s.hastaKam; izYansit(s); break;
        case "p-odaya": s.hasta = "bekleme"; s.katildiMi = true; s.ayrilOnay = null; olay(s, "Hasta odaya katıldı");
          if (s.doktor === "gorusmede") { s.durum = "gorusme"; s.hasta = "gorusmede"; s.basla ||= sn(); } else if (s.durum === "planlandi") s.durum = "bekleme"; break;
        case "p-ayril-sor": s.ayrilOnay = "p"; break;
        case "p-kal": case "h-kal": s.ayrilOnay = null; break;
        case "p-ayril": s.ayrilOnay = null; s.hasta = "yok"; medyaKapat(); olay(s, "Hasta görüşmeden ayrıldı"); ctx.odaKapat("p"); break;
        case "p-yeniden": case "h-yeniden": s.kopuk = "deniyor"; ctx.yenile(); setTimeout(() => { if (s.kopuk && navigator.onLine !== false) { s.kopuk = false; olay(s, "Bağlantı yeniden kuruldu"); } ctx.yenile(); }, 1200); return true;
        case "demo-kop": s.kopuk = true; olay(s, "Bağlantı koptu (demo)"); break;
        case "demo-doktor": s.doktor = "gorusmede"; if (s.hasta === "bekleme") { s.hasta = "gorusmede"; s.durum = "gorusme"; s.basla ||= sn(); } break;
        case "h-katil": s.doktor = "gorusmede"; s.ayrilOnay = null; olay(s, "Doktor katıldı");
          if (s.hasta === "bekleme" || s.hasta === "gorusmede") { s.hasta = "gorusmede"; s.durum = "gorusme"; s.basla ||= sn(); } else if (s.durum === "planlandi") s.durum = "bekleme";
          ctx.odaAc("h", k); break;
        case "h-mik": s.doktorMik = !s.doktorMik; break;
        case "h-kam": s.doktorKam = !s.doktorKam; break;
        case "h-ozet": s.ozetAcik = !s.ozetAcik; break;
        case "h-ayril-sor": s.ayrilOnay = "h"; break;
        case "h-ayril": s.ayrilOnay = null; s.doktor = "ayrildi"; olay(s, "Doktor görüşmeden ayrıldı"); ctx.odaKapat("h"); break;
        case "h-bitir-sor": s.bitirOnay = true; break;
        case "h-bitir-vazgec": s.bitirOnay = false; break;
        case "h-bitir": s.bitirOnay = false; s.durum = "tamamlandi"; s.doktor = "yok"; s.hasta = "yok"; medyaKapat(); olay(s, "Görüşme tamamlandı"); ctx.tamamlandi(r); ctx.odaKapat("h"); ctx.odaKapat("p"); break;
        case "h-katilmadi": s.durum = "katilmadi"; s.doktor = "yok"; olay(s, "Hasta katılmadı"); ctx.katilmadi(r); ctx.odaKapat("h"); break;
        default: return false;
      }
      ctx.yenile(); return true;
    }
    function onInput(e) { if (e.target.id === "vgNot") { const s = S[e.target.dataset.id]; if (s) s.not = e.target.value; return true; } return false; }
    // Süre sayacı yerinde güncellenir (video öğeleri yeniden çizilmesin)
    function tick(kok) { kok.querySelectorAll("[data-vg-sure]").forEach((el) => { const s = S[el.dataset.vgSure]; if (s && s.basla) el.textContent = dk(sn() - s.basla); }); }
    // Gerçek ağ kesintisi: oda kopuk görünür; bağlantı dönünce kullanıcı "Yeniden dene" der
    window.addEventListener("offline", () => { for (const s of Object.values(S)) if (s.hasta !== "yok" || s.doktor === "gorusmede") s.kopuk = true; o.yenile && o.yenile(); });
    function iptal(r) { const s = durum(r); s.durum = "iptal"; s.hasta = "yok"; s.doktor = "yok"; medyaKapat(); }

    return { durum, durumAd: (r) => DURUM_AD[durum(r).durum], hastaRandevuHtml, hastaOdaHtml, doktorKartHtml, doktorOdaHtml, onClick, onInput, tick, videolariBagla, medyaKapat, iptal,
      saat: () => saat, saatAyarla: (v) => { saat = v; }, medyaAcik: () => !!medya, bitti, acikMi };
  }
  window.KapidaGoruntulu = { create };
})();
