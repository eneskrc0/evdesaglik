/* Kapıda — Mesleki doğrulama (sağlık çalışanı ilk giriş akışı). PROTOTİP.
   - 22.11: Sarp'ın akışı (sarp/dogrulama.html) bağlandı: belgeler e-Devlet barkodlu olmalı (YÖK Mezun Belgesi / diploma,
     Sağlık Bakanlığı diploma tescil belgesi, uzman hekimde uzmanlık belgesi); her belgenin doğrulama barkodu zorunlu
     (görüntüde karekod ya da belge metninde bulunursa kendiliğinden dolar). Dosya seçilince ön kontrol (belge.js): düzenleme
     yazılımı izi, PDF sonradan değiştirilmiş mi, e-imza alanı, görüntü mü PDF mi. Ön kontrol bilgi verir, tek başına düşürmez.
     Görevli incelemesi: barkodla turkiye.gov.tr belge doğrulamada asıl belgeyi açar, 5 maddelik karşılaştırmayı işaretler,
     onaylar / eksik belge ister / uygun bulmaz. Asıl PDF'le alan alan otomatik karşılaştırma Sarp'ın görevli panelinde.
   - Uygulama hiçbir resmî sistemi kendisi sorgulamaz; "e-Devlet onaylı" gibi bir ifade kullanılmaz. T.C. no istenmez
     (görevli, e-Devlet sorgusu için belgedeki numarayı kullanır).
   - Seçilen dosyalar yalnızca bu sekmenin belleğinde (V.files) tutulur: sunucuya gönderilmez,
     localStorage'a yazılmaz; sayfa yenilenince silinir.
   - Görev kabul kilidi (canAccept) YALNIZCA ARAYÜZ SİMÜLASYONUDUR. Gerçek uygulamada
     yetkilendirme sunucuda yapılmalı; istemci tarafındaki bu kontrol güvenlik sağlamaz.
   Kullanım: const DG = KapidaDogrulama.create({ esc, rerender, toast }); */
(function () {
  "use strict";
  const MAX_BYTES = 10 * 1024 * 1024;
  const OK_EXT = /\.(pdf|jpe?g|png)$/i;
  const OK_MIME = ["application/pdf", "image/jpeg", "image/png"];
  const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
  const PROFS = [["hekim", "Hekim"], ["hemsire", "Hemşire"], ["fizyoterapist", "Fizyoterapist"], ["diger", "Diğer"]];
  const HEKIM_TYPES = [["pratisyen", "Pratisyen hekim"], ["uzman", "Uzman hekim"]];
  const STATUS = {
    yok: { label: "Başvuru yapılmadı", cls: "plain" },
    bekliyor: { label: "İnceleme bekliyor", cls: "sun" },
    eksik: { label: "Eksik belge", cls: "coral" },
    onaylandi: { label: "Onaylandı — demo", cls: "good" },
    red: { label: "Uygun bulunmadı — demo", cls: "coral" },
  };
  const NOTICE = "Prototip: Belgeler resmî sistemlerden doğrulanmaz. Gerçek kişisel belge yüklemeyin.";
  const STEP_TITLES = ["Mesleğini belirt", "Belgelerini ekle", "Başvurunu gönder"];

  function create(ctx) {
    const esc = ctx.esc;
    const V = {
      open: true, // ilk girişte doğrulama ekranı açılır
      view: "form", // form | sent | status
      step: 1,
      f: { name: "", prof: "", profOther: "", hekimType: "", specialty: "", org: "", tescil: "" },
      files: { diploma: null, tescilBelge: null, uzmanlik: null, kurum: null }, // { name, size, type, file, onk, barkodSrc } — yalnızca bellekte
      barkod: { diploma: "", tescilBelge: "", uzmanlik: "" }, // e-Devlet / Bakanlık doğrulama barkodları
      gorevli: {}, // görevli kontrol listesi (demo)
      err: {},
      decl: false,
      status: "yok",
      reason: "",
      submitted: null, // gönderilen başvurunun anlık kopyası (özet için)
      showSummary: false,
      focus: null,
      toTop: false,
    };

    const needUzm = () => V.f.prof === "hekim" && V.f.hekimType === "uzman";
    const sizeTxt = (b) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
    function profText(f) {
      if (f.prof === "hekim") return f.hekimType === "uzman" ? `Uzman hekim${f.specialty ? " · " + f.specialty : ""}` : f.hekimType === "pratisyen" ? "Pratisyen hekim" : "Hekim";
      if (f.prof === "diger") return f.profOther || "Diğer";
      const p = PROFS.find((x) => x[0] === f.prof);
      return p ? p[1] : "";
    }

    // ---------- kontroller ----------
    function check1() {
      const f = V.f, e = {};
      if (f.name.trim().length < 3) e.name = "Ad soyadını yaz.";
      if (!f.prof) e.prof = "Mesleğini seç.";
      if (f.prof === "diger" && !f.profOther.trim()) e.profOther = "Mesleğinin adını yaz.";
      if (f.prof === "hekim" && !f.hekimType) e.hekimType = "Pratisyen mi, uzman mı olduğunu seç.";
      if (needUzm() && !f.specialty.trim()) e.specialty = "Uzmanlık alanını yaz.";
      if (!f.org.trim()) e.org = "Çalıştığın kuruluşu ya da birimi yaz.";
      return e;
    }
    const barkodTamam = (v) => String(v || "").toLocaleUpperCase("tr").replace(/[^A-Z0-9]/g, "").length >= 8;
    const BARKODLU = () => ["diploma", "tescilBelge", ...(needUzm() ? ["uzmanlik"] : [])];
    function check2() {
      const e = {};
      if (!V.files.diploma) e.diploma = "Diploma ya da mezuniyet belgeni ekle.";
      if (!V.files.tescilBelge) e.tescilBelge = "Diploma tescil belgeni ekle.";
      if (needUzm() && !V.files.uzmanlik) e.uzmanlik = "Uzmanlık belgeni ekle.";
      for (const k of BARKODLU()) if (V.files[k] && !barkodTamam(V.barkod[k])) e["barkod_" + k] = "Belgenin doğrulama barkodunu yaz (belgenin altında ya da karekodun yanında, en az 8 harf/rakam). Barkodsuz belgeyle başvuru tamamlanmaz.";
      const t = V.f.tescil.trim();
      if (t && !/^[0-9A-Za-zÇĞİÖŞÜçğıöşü\-\/ ]{1,30}$/.test(t)) e.tescil = "Yalnızca harf, rakam, tire ve eğik çizgi kullan (en fazla 30).";
      return e;
    }
    function checkFile(file) {
      if (!file) return "Dosya seçilemedi.";
      const typeOk = OK_MIME.includes(file.type) || OK_EXT.test(file.name);
      if (!typeOk) return "Bu dosya türü kabul edilmiyor. PDF, JPG ya da PNG seç.";
      if (file.size > MAX_BYTES) return `Dosya çok büyük (${sizeTxt(file.size)}). En fazla 10 MB olabilir.`;
      if (file.size === 0) return "Dosya boş görünüyor. Başka bir dosya seç.";
      return "";
    }
    const firstErrId = (e) => { const k = Object.keys(e)[0]; return k ? (k === "prof" || k === "hekimType" ? `v-${k}-0` : k === "decl" ? "v-decl" : ["diploma", "tescilBelge", "uzmanlik", "kurum"].includes(k) ? `v-pick-${k}` : `v-${k}`) : null; };

    // ---------- parçalar ----------
    const errP = (k) => (V.err[k] ? `<p class="v-err" id="v-${k}-err" role="alert">${esc(V.err[k])}</p>` : "");
    const inv = (k) => (V.err[k] ? ` aria-invalid="true" aria-describedby="v-${k}-err"` : "");
    const opt = `<span class="v-opt">(isteğe bağlı)</span>`;
    function field(k, label, ac = "off", optional = false) {
      return `<div class="v-field"><label class="v-label" for="v-${k}">${label}${optional ? " " + opt : ""}</label>
        <input class="v-inp" id="v-${k}" data-vf="${k}" value="${esc(V.f[k])}" autocomplete="${ac}"${inv(k)}>${errP(k)}</div>`;
    }
    function choices(k, legend, list) {
      return `<fieldset class="v-field"${V.err[k] ? ` aria-describedby="v-${k}-err"` : ""}><legend class="v-label">${legend}</legend>
        <div class="v-choices">${list.map(([v, l], i) => `<label class="v-choice"><input type="radio" id="v-${k}-${i}" name="v-${k}" value="${v}" data-vr="${k}"${V.f[k] === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>${errP(k)}</fieldset>`;
    }
    function fileBox(k, label, optional) {
      const fl = V.files[k];
      const pick = (txt, cls) => `<label class="${cls}" id="v-pick-${k}" for="v-file-${k}" role="button" tabindex="0" data-vpick="${k}">${txt}</label>`;
      return `<div class="v-field"><div class="v-label" id="v-${k}-lbl">${label}${optional ? " " + opt : ""}</div>
        ${fl ? `<div class="v-file"><span class="v-file-ico" aria-hidden="true">${/pdf$/i.test(fl.name) || fl.type === "application/pdf" ? "PDF" : "IMG"}</span>
            <div class="v-file-meta"><b>${esc(fl.name)}</b><span>${sizeTxt(fl.size)} · Eklendi, henüz incelenmedi</span></div></div>
          ${fl.onk ? `<div class="v-onk"><span class="v-onk-b">Ön kontrol</span>${fl.onk.length ? window.KapidaBelge.bayrakHtml(fl.onk, esc) : `<span class="tiny">Dosyada belirgin bir sorun görünmedi.</span>`}</div>` : fl.file && window.KapidaBelge ? `<div class="tiny v-onk">Ön kontrol yapılıyor…</div>` : ""}
          <div class="v-row">${pick("Değiştir", "btn v-btn2")}<button class="btn v-btn2" type="button" data-vact="rm" data-key="${k}">Kaldır</button></div>`
        : `${pick(`<b>+ Dosya seç</b><span>${k === "kurum" ? "PDF, JPG ya da PNG" : "e-Devlet'ten indirilen barkodlu PDF"} · en fazla 10 MB</span>`, "v-drop")}`}
        <input class="v-hidden" type="file" id="v-file-${k}" data-vfile="${k}" accept="${ACCEPT}" aria-labelledby="v-${k}-lbl" tabindex="-1">${errP(k)}
        ${k in V.barkod && fl ? `<div class="v-field v-barkod"><label class="v-label" for="v-barkod_${k}">Doğrulama barkodu${fl.barkodSrc ? ` <span class="v-opt">(${esc(fl.barkodSrc)}ndan okundu, kontrol et)</span>` : ""}</label>
          <input class="v-inp v-mono" id="v-barkod_${k}" data-vbarkod="${k}" value="${esc(V.barkod[k])}" autocomplete="off" maxlength="44" placeholder="ör. YOK-ABCD-1234-EFGH"${inv("barkod_" + k)}>${errP("barkod_" + k)}</div>` : ""}</div>`;
    }
    function steps(n) {
      return `<div class="v-steps" aria-hidden="true">${[1, 2, 3].map((i) => `<span class="${i <= n ? "on" : ""}"></span>`).join("")}</div>
        <div class="v-steplabel">Adım ${n} / 3 · ${STEP_TITLES[n - 1]}</div>`;
    }
    function summary(src) {
      const f = src ? src.f : V.f, files = src ? src.files : V.files;
      const bk = src ? src.barkod || {} : V.barkod;
      const docs = [["YÖK mezun belgesi / diploma", files.diploma, bk.diploma], ["Diploma tescil belgesi", files.tescilBelge, bk.tescilBelge], ...(f.prof === "hekim" && f.hekimType === "uzman" ? [["Uzmanlık belgesi", files.uzmanlik, bk.uzmanlik]] : []), ["Çalışma / kuruluş belgesi", files.kurum]].filter(([, x]) => x);
      const rows = [["Ad soyad", f.name], ["Meslek", profText(f)], ["Kuruluş / birim", f.org], ...(f.tescil.trim() ? [["Diploma tescil no", f.tescil]] : [])];
      return `<dl class="v-sum">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b || "—")}</dd>`).join("")}
        <dt>Belgeler</dt><dd>${docs.length ? docs.map(([a, x, b]) => `<div class="v-doc"><span>${a}</span><b>${esc(x.name)}</b>${b ? `<span class="v-mono">Barkod: ${esc(b)}</span>` : ""}</div>`).join("") : "—"}</dd></dl>`;
    }
    const pill = (s) => `<span class="pill ${STATUS[s].cls} v-pill">${STATUS[s].label}</span>`;

    // ---------- ekranlar ----------
    function formView() {
      if (V.step === 1) {
        return `${steps(1)}<h2 class="v-h">Mesleğini belirt</h2>
          ${field("name", "Ad soyad", "name")}
          ${choices("prof", "Meslek", PROFS)}
          ${V.f.prof === "diger" ? field("profOther", "Mesleğinin adı") : ""}
          ${V.f.prof === "hekim" ? choices("hekimType", "Hekimlik türü", HEKIM_TYPES) : ""}
          ${needUzm() ? field("specialty", "Uzmanlık alanı") : ""}
          ${field("org", "Çalıştığın kuruluş ya da birim", "organization")}
          <button class="btn primary block v-main" type="button" data-vact="next1">Devam et</button>`;
      }
      if (V.step === 2) {
        return `<button class="back v-back" type="button" data-vact="back">← Geri</button>${steps(2)}
          <h2 class="v-h">Belgelerini ekle</h2>
          <p class="v-p">Belgelerin, mesleki başvurunun incelenmesi için alınır. e-Devlet'ten indirdiğin barkodlu PDF'leri ekle; görevli barkodla asıl belgeyi açıp karşılaştırır.</p>
          ${V.status === "eksik" ? `<div class="v-reason"><b>Eksik belge</b><span>${esc(V.reason)}</span></div>` : ""}
          ${fileBox("diploma", "YÖK Mezun Belgesi ya da diploma", false)}
          ${fileBox("tescilBelge", "Diploma tescil belgesi (Sağlık Bakanlığı)", false)}
          ${needUzm() ? fileBox("uzmanlik", "Uzmanlık belgesi", false) : ""}
          ${field("tescil", "Diploma tescil numarası", "off", true)}
          ${fileBox("kurum", "Çalışma / kuruluş belgesi", true)}
          <button class="btn primary block v-main" type="button" data-vact="next2">Başvuruyu gözden geçir</button>`;
      }
      return `<button class="back v-back" type="button" data-vact="back">← Geri</button>${steps(3)}
        <h2 class="v-h">Başvurunu gönder</h2>
        <div class="v-card">${summary()}<button class="btn v-btn2 block" type="button" data-vact="edit">Bilgileri düzenle</button></div>
        <div class="v-field"><label class="v-check" for="v-decl"><input type="checkbox" id="v-decl" data-vdecl="1"${V.decl ? " checked" : ""}${inv("decl")}>
          <span>Paylaştığım bilgilerin doğru olduğunu beyan ediyorum.</span></label>${errP("decl")}</div>
        <button class="btn primary block v-main" type="button" data-vact="submit">İncelemeye gönder</button>`;
    }
    function sumToggle() {
      if (!V.submitted) return "";
      return `<button class="btn v-btn2 block" type="button" data-vact="toggleSum" aria-expanded="${V.showSummary}">${V.showSummary ? "Özeti gizle" : "Başvuru özetini gör"}</button>
        ${V.showSummary ? `<div class="v-card">${summary(V.submitted)}</div>` : ""}`;
    }
    function sentView() {
      return `<div class="v-done" aria-hidden="true">✓</div><h2 class="v-h">Başvurun alındı</h2>
        <div class="v-statusrow"><span>Durum:</span>${pill("bekliyor")}</div>
        <p class="v-p">Başvurun incelendikten sonra görev kabul etme durumun güncellenecek.</p>
        <button class="btn primary block v-main" type="button" data-vact="close">Panele git</button>${sumToggle()}`;
    }
    function statusView() {
      const s = V.status;
      const head = { bekliyor: "Başvurun inceleniyor", eksik: "Bir belge eksik", onaylandi: "Başvurun onaylandı", red: "Başvurun uygun bulunmadı", yok: "Henüz başvuru yok" }[s];
      const text = {
        bekliyor: "Başvurun incelendikten sonra görev kabul etme durumun güncellenecek.",
        eksik: "Başvurunu tamamlaman için bir belge daha gerekiyor.",
        onaylandi: "Bu prototipte görev kabul etme açıldı. Bu bir demo onayıdır; gerçek mesleki yetkilendirme değildir.",
        red: "Başvurun bu hâliyle uygun bulunmadı. Bilgilerini düzeltip yeniden inceleme isteyebilirsin.",
        yok: "Görev kabul etmek için önce mesleki başvurunu yapmalısın.",
      }[s];
      const main = { eksik: ["complete", "Belgeyi tamamla"], red: ["reapply", "Yeniden inceleme iste"], yok: ["start", "Başvuruya başla"] }[s] || ["close", "Panele git"];
      return `<h2 class="v-h">${head}</h2><div class="v-statusrow"><span>Durum:</span>${pill(s)}</div>
        <p class="v-p">${text}</p>
        ${V.reason && (s === "eksik" || s === "red") ? `<div class="v-reason"><b>Gerekçe (örnek)</b><span>${esc(V.reason)}</span></div>` : ""}
        <button class="btn primary block v-main" type="button" data-vact="${main[0]}">${main[1]}</button>
        ${s === "red" ? `<button class="btn v-btn2 block" type="button" data-vact="edit">Bilgileri düzenle</button>` : ""}
        ${main[0] !== "close" ? `<button class="btn ghost v-link" type="button" data-vact="close">Panele dön</button>` : ""}
        ${sumToggle()}`;
    }
    function render() {
      const body = V.view === "sent" ? sentView() : V.view === "status" ? statusView() : formView();
      return `<div class="v">
        <div class="v-top"><b>Mesleki doğrulama</b>${V.view === "form" ? `<button class="btn ghost v-link" type="button" data-vact="close">Panele dön</button>` : ""}</div>
        <div class="v-body">${body}</div>
        <p class="v-notice">${NOTICE}</p></div>`;
    }
    function afterRender(root) {
      if (V.toTop) { root.scrollTop = 0; V.toTop = false; }
      if (V.focus) { const el = document.getElementById(V.focus); if (el) el.focus({ preventScroll: false }); V.focus = null; }
    }

    // ---------- panel parçaları ----------
    // Not: Bu kontrol yalnızca arayüz simülasyonudur; gerçek uygulamada görev kabul yetkisi sunucuda denetlenir.
    const canAccept = () => V.status === "onaylandi";
    function headerLabel() { return STATUS[V.status].label; }
    function banner() {
      if (V.status === "onaylandi") return "";
      const text = { yok: "Görev kabul etmek için mesleki başvurunu tamamla.", bekliyor: "Başvurun inceleniyor. Onaylanınca görev kabul edebilirsin.", eksik: "Başvurunda eksik belge var.", red: "Başvurun uygun bulunmadı." }[V.status];
      return `<div class="v-banner"><div class="row between"><b>Görev kabul etme kapalı</b>${pill(V.status)}</div>
        <div>${text}</div><button class="btn block" type="button" data-vact="openStatus">${V.status === "yok" ? "Doğrulamaya başla" : "Başvuru durumunu gör"}</button></div>`;
    }

    // ---------- olaylar ----------
    function go(patch) { Object.assign(V, patch); ctx.rerender(); }
    function onClick(e) {
      const t = e.target.closest("[data-vact]");
      if (!t) return false;
      const a = t.dataset.vact;
      if (a === "next1") { const er = check1(); V.err = er; if (Object.keys(er).length) go({ focus: firstErrId(er) }); else go({ step: 2, toTop: true, focus: null }); }
      else if (a === "next2") { const er = check2(); V.err = er; if (Object.keys(er).length) go({ focus: firstErrId(er) }); else go({ step: 3, toTop: true }); }
      else if (a === "back") go({ step: Math.max(1, V.step - 1), err: {}, toTop: true });
      else if (a === "edit") go({ view: "form", step: 1, err: {}, toTop: true });
      else if (a === "rm") { V.files[t.dataset.key] = null; delete V.err[t.dataset.key]; go({ focus: `v-pick-${t.dataset.key}` }); }
      else if (a === "submit") {
        const e1 = check1(); if (Object.keys(e1).length) return go({ step: 1, err: e1, focus: firstErrId(e1), toTop: true }), true;
        const e2 = check2(); if (Object.keys(e2).length) return go({ step: 2, err: e2, focus: firstErrId(e2), toTop: true }), true;
        if (!V.decl) return go({ err: { decl: "Göndermek için beyan kutusunu işaretle." }, focus: "v-decl" }), true;
        // GERÇEK DOĞRULAMA SERVİSİ BURAYA BAĞLANACAK: belgeler sunucuya güvenli biçimde yüklenir,
        // başvuru inceleme kuyruğuna alınır, durum sunucudan okunur. Prototipte hiçbir şey gönderilmez.
        const files = {}; for (const k of Object.keys(V.files)) files[k] = V.files[k] && { name: V.files[k].name, size: V.files[k].size, type: V.files[k].type, onk: V.files[k].onk || [] };
        go({ submitted: { f: { ...V.f }, files, barkod: { ...V.barkod }, at: new Date() }, status: "bekliyor", reason: "", view: "sent", err: {}, showSummary: false, toTop: true, gorevli: {} });
      }
      else if (a === "toggleSum") go({ showSummary: !V.showSummary });
      else if (a === "close") go({ open: false, toTop: true });
      else if (a === "openStatus") go({ open: true, view: V.status === "yok" ? "form" : "status", toTop: true });
      else if (a === "start") go({ view: "form", step: 1, toTop: true });
      else if (a === "complete") go({ view: "form", step: 2, err: {}, decl: false, toTop: true });
      else if (a === "reapply") { go({ status: "bekliyor", reason: "", view: "status", toTop: true }); ctx.toast("Yeniden inceleme isteğin alındı."); }
      return true;
    }
    function onInput(e) {
      const bk = e.target.dataset.vbarkod;
      if (bk) { V.barkod[bk] = e.target.value; const ek = "barkod_" + bk; if (V.err[ek]) { delete V.err[ek]; e.target.removeAttribute("aria-invalid"); const n = document.getElementById(`v-${ek}-err`); if (n) n.remove(); } return true; }
      const k = e.target.dataset.vf;
      if (!k) return false;
      V.f[k] = e.target.value;
      if (V.err[k]) { delete V.err[k]; e.target.removeAttribute("aria-invalid"); e.target.removeAttribute("aria-describedby"); const n = document.getElementById(`v-${k}-err`); if (n) n.remove(); }
      return true;
    }
    function onChange(e) {
      const el = e.target;
      if (el.dataset.vr) { V.f[el.dataset.vr] = el.value; delete V.err[el.dataset.vr]; go({ focus: el.id }); return true; }
      if (el.dataset.vdecl) { V.decl = el.checked; if (V.err.decl) { delete V.err.decl; go({ focus: "v-decl" }); } return true; }
      if (el.dataset.vfile) {
        const k = el.dataset.vfile, file = el.files && el.files[0];
        if (!file) return true;
        const msg = checkFile(file);
        if (msg) V.err[k] = msg; else { V.files[k] = { name: file.name, size: file.size, type: file.type, file }; delete V.err[k]; onKontrol(k, V.files[k]); }
        go({ focus: `v-pick-${k}` });
        return true;
      }
      return false;
    }
    // Dosya ön kontrolü (belge.js): düzenleme izi, sonradan değişiklik, e-imza, görüntü/PDF; karekod ya da metinden barkod
    async function onKontrol(k, fl) {
      const KB = window.KapidaBelge; if (!KB) return;
      try {
        const doc = await KB.oku(fl.file, { maxPx: 1400 });
        if (V.files[k] !== fl) return; // bu arada değiştirildi
        fl.onk = KB.dosyaBulgulari(doc, { pdfBekleniyor: k !== "kurum" });
        const b = k in V.barkod ? KB.barkodBul(doc) : null;
        if (b && !V.barkod[k]) { V.barkod[k] = b.v; fl.barkodSrc = b.src; }
      } catch (e) { fl.onk = [KB.fl("bilgi", "", "Dosya okunamadı; görevli elle inceleyecek.")]; }
      if (V.open && V.view === "form" && V.step === 2) { const odak = document.activeElement && document.activeElement.id; ctx.rerender(); if (odak) { const el = document.getElementById(odak); if (el) el.focus({ preventScroll: true }); } }
    }
    function onKey(e) {
      const p = e.target.closest && e.target.closest("[data-vpick]");
      if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); const inp = document.getElementById(`v-file-${p.dataset.vpick}`); if (inp) inp.click(); return true; }
      return false;
    }

    // ---------- demo kontrolleri (ana akıştan ayrı, yalnızca sunum için) ----------
    const DEMO_REASON = {
      eksik: "Diploma belgesinin okunaklı ve tam bir kopyası gerekiyor.",
      red: "Belgedeki ad soyad, başvurudaki adla eşleşmiyor.",
    };
    // Görevli incelemesi (Sarp'ın akışı): barkodla e-Devlet'te asıl belgeyi aç, karşılaştır, karar ver
    const GOREVLI = [["acti", "Barkodla turkiye.gov.tr belge doğrulamada asıl belgeyi açtım."], ["ad", "Ad soyad başvurudaki adla aynı."], ["okul", "Okul, bölüm ve unvan beyan edilen meslekle uyumlu."],
      ["tarih", "Mezuniyet / tescil tarihleri ve numaraları tutarlı."], ["ayni", "Yüklenen belge asıl belgeyle aynı; düzenleme izi yok."]];
    function gorevliPanel() {
      const sb = V.submitted;
      if (!sb || V.status !== "bekliyor") return "";
      const KB = window.KapidaBelge, g = V.gorevli, hepsi = GOREVLI.every(([k]) => g[k]);
      const docs = [["YÖK mezun belgesi / diploma", "diploma"], ["Diploma tescil belgesi", "tescilBelge"], ["Uzmanlık belgesi", "uzmanlik"], ["Çalışma / kuruluş belgesi", "kurum"]].filter(([, k]) => sb.files[k]);
      return `<div class="v-gorevli"><b>Görevli incelemesi</b> <span class="tiny muted">${esc(sb.f.name)} · ${esc(profText(sb.f))}</span>
        ${docs.map(([ad, k]) => `<div class="v-gdoc"><div><b class="small">${ad}</b> <span class="tiny muted">${esc(sb.files[k].name)}</span></div>
          ${sb.barkod && sb.barkod[k] ? `<div class="small">Barkod: <b class="v-mono">${esc(sb.barkod[k])}</b> <a class="small" href="https://www.turkiye.gov.tr/belge-dogrulama" target="_blank" rel="noopener">e-Devlet'te aç ↗</a></div>` : ""}
          ${KB && (sb.files[k].onk || []).length ? KB.bayrakHtml(sb.files[k].onk, esc) : ""}</div>`).join("")}
        <div class="v-gchk">${GOREVLI.map(([k, t]) => `<label><input type="checkbox" data-vgorev="${k}" ${g[k] ? "checked" : ""}> <span>${t}</span></label>`).join("")}</div>
        <div class="seg"><button class="chip" type="button" data-vgkarar="onay" ${hepsi ? "" : "disabled"}>Onayla</button><button class="chip" type="button" data-vgkarar="eksik">Yeniden yükleme iste</button><button class="chip" type="button" data-vgkarar="red">Uygun değil</button></div>
        <span class="tiny muted">Asıl PDF'i bırakıp alan alan otomatik karşılaştırma: <a href="https://raw.githack.com/eneskrc0/evdesaglik/main/sarp/dogrulama.html" target="_blank" rel="noopener">Sarp'ın görevli paneli ↗</a> (prototip)</span></div>`;
    }
    function demoPanel() {
      return `${gorevliPanel()}<b>Demo kontrolleri</b><span class="tiny muted">Yalnızca sunum için · başvuru durumunu elle değiştirir</span>
        <div class="seg">${["bekliyor", "eksik", "onaylandi", "red"].map((s) => `<button class="chip" type="button" data-vdemo="${s}" aria-pressed="${V.status === s}">${STATUS[s].label}</button>`).join("")}
        <button class="chip" type="button" data-vdemo="reset">Baştan başlat</button></div>`;
    }
    function demoClick(e) {
      const gc = e.target.closest("[data-vgorev]");
      if (gc) { V.gorevli[gc.dataset.vgorev] = gc.checked; ctx.rerender(); return; }
      const gk = e.target.closest("[data-vgkarar]");
      if (gk && !gk.disabled) {
        const k = gk.dataset.vgkarar;
        if (k === "onay") go({ status: "onaylandi", reason: "", view: "status", open: true, showSummary: false, toTop: true });
        else go({ status: k === "eksik" ? "eksik" : "red", reason: k === "eksik" ? "Görevli: belgelerden biri e-Devlet'teki asıl belgeyle karşılaştırılamadı; barkodlu PDF'ini yeniden yükle." : "Görevli: yüklenen belge e-Devlet'teki asıl belgeyle eşleşmedi.", view: "status", open: true, showSummary: false, toTop: true });
        return;
      }
      const b = e.target.closest("[data-vdemo]");
      if (!b) return;
      const s = b.dataset.vdemo;
      if (s === "reset") {
        V.f = { name: "", prof: "", profOther: "", hekimType: "", specialty: "", org: "", tescil: "" };
        V.files = { diploma: null, tescilBelge: null, uzmanlik: null, kurum: null }; V.barkod = { diploma: "", tescilBelge: "", uzmanlik: "" }; V.gorevli = {};
        go({ status: "yok", reason: "", submitted: null, decl: false, err: {}, view: "form", step: 1, open: true, toTop: true });
      } else {
        go({ status: s, reason: DEMO_REASON[s] || "", view: "status", open: true, showSummary: false, toTop: true });
      }
    }

    return { state: V, render, afterRender, canAccept, banner, headerLabel, onClick, onInput, onChange, onKey, demoPanel, demoClick, _test: { check1, check2, checkFile } };
  }

  window.KapidaDogrulama = { create, MAX_BYTES };
})();
