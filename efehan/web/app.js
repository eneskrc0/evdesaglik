/* Evde Sağlık Test Prototipi — arayüz. Mantık EvdeCore'da (core.js), veri EVDE_DATA'da. */
(function () {
  "use strict";
  const C = window.EvdeCore;
  const DATA = window.EVDE_DATA;
  const repo = new C.Repo(DATA);
  const DATE = "2026-11-16";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tl = (x) => Math.round(x).toLocaleString("tr-TR");
  const LEVELS = ["ACIL_112", "ZEHIR_114", "HEKIM_EV", "TELE_HEMSIRE", "TELE", "PLANLI"];
  const SEV = { ACIL_112: "crit", ZEHIR_114: "warn", HEKIM_EV: "info", TELE_HEMSIRE: "info", TELE: "info", PLANLI: "ok" };
  const profName = (code) => (repo.professions[code] || {}).name_tr || code;
  const svcName = (code) => (repo.services[code] || {}).name_tr || code;
  const srcTag = (id) => {
    const s = repo.sources[id];
    if (!s) return `<span class="tag plain">${esc(id)}</span>`;
    const label = `${esc(id)}`;
    return s.url ? `<a class="tag plain" href="${esc(s.url)}" title="${esc(s.title)}">${label}</a>` : `<span class="tag plain" title="${esc(s.title)}">${label}</span>`;
  };
  const levelOptions = (sel) => LEVELS.map((l) => `<option value="${l}"${l === sel ? " selected" : ""}>${esc(C.LEVEL_TEXT[l])}</option>`).join("");

  // ---------------- Yönlendirme (hash) ----------------
  const VIEWS = ["senaryo", "test-seti", "veritabani", "saglayici", "geri-bildirim"];
  function route() {
    const h = location.hash.replace("#", "");
    const v = VIEWS.includes(h) ? h : "senaryo";
    for (const id of VIEWS) $("#view-" + id).classList.toggle("active", id === v);
    document.querySelectorAll("nav.tabs a").forEach((a) => {
      if (a.dataset.view === v) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", route);

  // ---------------- Ortak: zaman çizelgesi ve harita ----------------
  const T0 = 7 * 60, T1 = 21 * 60;
  function timelineHTML(home, win, stops) {
    const pct = (m) => ((Math.min(Math.max(m, T0), T1) - T0) / (T1 - T0)) * 100;
    let h = `<div class="win" style="left:${pct(win[0])}%;width:${pct(win[1]) - pct(win[0])}%"></div>`;
    let prevLoc = home, prevReady = win[0];
    stops.forEach((s, i) => {
      const loc = [s.lat, s.lon];
      const tmin = C.travelMin(C.roadKm(prevLoc, loc));
      const ts = s.start_min - tmin;
      if (tmin > 0) h += `<div class="blk travel" style="left:${pct(ts)}%;width:${pct(s.start_min) - pct(ts)}%" title="yol ${tmin} dk"></div>`;
      h += `<div class="blk ${s.isNew ? "new" : "visit"}" style="left:${pct(s.start_min)}%;width:${Math.max(1.2, pct(s.start_min + s.duration_min) - pct(s.start_min))}%" title="${esc(C.hhmm(s.start_min) + " " + svcName(s.service_code))}">${C.hhmm(s.start_min)}</div>`;
      prevLoc = loc; prevReady = s.start_min + s.duration_min;
      if (i === stops.length - 1) {
        const back = C.travelMin(C.roadKm(loc, home));
        h += `<div class="blk travel" style="left:${pct(prevReady)}%;width:${pct(prevReady + back) - pct(prevReady)}%" title="eve dönüş ${back} dk"></div>`;
      }
    });
    for (let m = 8 * 60; m <= 20 * 60; m += 120) h += `<span class="tick" style="left:${pct(m)}%">${C.hhmm(m)}</span>`;
    return h;
  }

  function mapSVG(svg, home, stops, extraPoints = []) {
    const W = 520, H = 300, P = 28;
    const pts = [home, ...stops.map((s) => [s.lat, s.lon]), ...extraPoints.map((e) => e.loc)];
    const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const kx = 111 * Math.cos((lat0 * Math.PI) / 180), ky = 111;
    const xy = (p) => [p[1] * kx, -p[0] * ky];
    const k = pts.map(xy);
    let minX = Math.min(...k.map((q) => q[0])), maxX = Math.max(...k.map((q) => q[0]));
    let minY = Math.min(...k.map((q) => q[1])), maxY = Math.max(...k.map((q) => q[1]));
    const spanX = Math.max(maxX - minX, 2), spanY = Math.max(maxY - minY, 2);
    const sc = Math.min((W - 2 * P) / spanX, (H - 2 * P) / spanY);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const pr = (p) => { const q = xy(p); return [W / 2 + (q[0] - cx) * sc, H / 2 + (q[1] - cy) * sc]; };
    const css = getComputedStyle(document.documentElement);
    const col = (n) => css.getPropertyValue(n).trim();
    const route = [home, ...stops.map((s) => [s.lat, s.lon]), home].map(pr);
    let g = `<polyline points="${route.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${col("--muted")}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    for (const e of extraPoints) {
      const [x, y] = pr(e.loc);
      g += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${col("--muted")}"/>`;
    }
    const [hx, hy] = pr(home);
    g += `<rect x="${hx - 6}" y="${hy - 6}" width="12" height="12" fill="${col("--ink")}"/><text x="${hx + 9}" y="${hy + 4}">ev</text>`;
    stops.forEach((s, i) => {
      const [x, y] = pr([s.lat, s.lon]);
      const c = s.isNew ? col("--warn") : col("--accent");
      g += `<circle cx="${x}" cy="${y}" r="${s.isNew ? 8 : 6}" fill="${c}"/><text x="${x + 10}" y="${y + 4}">${i + 1}. ${C.hhmm(s.start_min)}</text>`;
    });
    // ölçek çubuğu: 2 km
    const bar = 2 * sc;
    g += `<line x1="${P}" y1="${H - 12}" x2="${P + bar}" y2="${H - 12}" stroke="${col("--ink")}" stroke-width="2"/><text x="${P}" y="${H - 18}">2 km</text>`;
    svg.innerHTML = g;
  }

  function routeKm(home, stops) {
    let km = 0, prev = home;
    for (const s of stops) { km += C.roadKm(prev, [s.lat, s.lon]); prev = [s.lat, s.lon]; }
    return stops.length ? km + C.roadKm(prev, home) : 0;
  }

  // ---------------- Geri bildirim deposu ----------------
  const FB = { db: null, user: null, uid: null, items: [], canWrite: true, mode: "loading", names: {} };
  async function fbInit() {
    const use = window.claude && typeof window.claude.use === "function" ? window.claude.use.bind(window.claude) : null;
    if (!use) return fbLocal("Bu görünümde ortak kayıt yok; notlar yalnızca bu tarayıcıda tutulur. Tümünü kopyala ile bana gönderebilirsiniz.");
    try {
      const [db, user] = await Promise.all([use("db"), use("user")]);
      FB.user = user;
      if (!db) return fbLocal("Ortak kayıt açılamadı (oturum kapalı olabilir). Notlar yalnızca bu tarayıcıda tutulur.");
      FB.db = db;
      if (user) {
        FB.uid = await user.id();
        const cw = await user.can("data.write");
        if (cw === false) FB.canWrite = false;
      }
      const timer = setTimeout(() => setStatus("Ortak notlara henüz ulaşılamadı; bağlantı gelince liste kendiliğinden yenilenir.", "warn"), 10000);
      db.collection("feedback").orderBy("created_at", "desc").limit(500).onSnapshot(async (snap) => {
        if (!snap.metadata.fromCache) clearTimeout(timer);
        FB.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        FB.mode = "db";
        await resolveNames();
        setStatus(FB.canWrite
          ? "Notlar ekipte ortak tutulur ve Claude okuyabilir. Sohbette \"notları işle\" deyin."
          : "Notları okuyabilirsiniz; yazmak için sayfa sahibinden Katkıda bulunan (Contributor) erişimi isteyin.", FB.canWrite ? "" : "warn");
        renderFeedback();
      }, (e) => { clearTimeout(timer); fbLocal("Ortak notlar okunamadı (" + (e && e.code) + "). Notlar bu tarayıcıda tutulacak."); });
    } catch (e) {
      fbLocal("Ortak kayıt kullanılamıyor. Notlar yalnızca bu tarayıcıda tutulur.");
    }
  }
  function fbLocal(msg) {
    FB.mode = "local";
    try { FB.items = JSON.parse(localStorage.getItem("evde_fb") || "[]"); } catch (e) { FB.items = []; }
    setStatus(msg, "warn");
    renderFeedback();
  }
  function setStatus(msg, cls) { const el = $("#fbStatus"); el.textContent = msg; el.className = "notice" + (cls ? " " + cls : ""); }
  async function resolveNames() {
    if (!FB.user) return;
    const ids = [...new Set(FB.items.map((i) => i.author).filter(Boolean))];
    if (!ids.length) return;
    try { const ps = await FB.user.profiles(ids); for (const id of ids) FB.names[id] = (ps[id] && ps[id].name) || "Ekipten biri"; } catch (e) { /* adlar opsiyonel */ }
  }
  async function saveFeedback(item) {
    item.created_at = new Date().toISOString();
    item.status = "acik";
    if (FB.mode === "db" && FB.db) {
      if (FB.uid) item.author = FB.uid;
      try { await FB.db.collection("feedback").add(item); return { ok: true }; }
      catch (e) {
        if (e && e.code === "invalid_argument") { FB.canWrite = false; return { ok: false, msg: "Yazma izniniz yok; sayfa sahibinden Katkıda bulunan erişimi isteyin." }; }
        if (e && e.code === "quota_exceeded") return { ok: false, msg: "Not kotası doldu; çözülen notları silmek gerekiyor." };
        return { ok: false, msg: "Kaydedilemedi, birazdan tekrar deneyin." };
      }
    }
    item.id = "L" + Date.now();
    FB.items.unshift(item);
    try { localStorage.setItem("evde_fb", JSON.stringify(FB.items)); } catch (e) { /* yer yoksa yalnızca bellekte */ }
    renderFeedback();
    return { ok: true, local: true };
  }
  async function toggleResolved(id) {
    const it = FB.items.find((i) => i.id === id);
    if (!it) return;
    const status = it.status === "cozuldu" ? "acik" : "cozuldu";
    if (FB.mode === "db") { try { await FB.db.collection("feedback").doc(id).update({ status }); } catch (e) { /* izin yoksa değişmez */ } }
    else { it.status = status; try { localStorage.setItem("evde_fb", JSON.stringify(FB.items)); } catch (e) { /**/ } renderFeedback(); }
  }
  const FB_TYPE = { yanlis_sonuc: ["Yanlış sonuç", "crit"], test_vakasi: ["Test vakası", "info"], veritabani: ["Veritabanı eksiği", "warn"], panel: ["Panel", "ok"], genel: ["Genel", "plain"] };
  function fbLine(i) {
    const parts = [`[${(FB_TYPE[i.type] || ["Not"])[0]}]`];
    if (i.complaint) parts.push(`şikayet: "${i.complaint}"`);
    if (i.patient) parts.push(`hasta: ${i.patient}`);
    if (i.got_level) parts.push(`bulunan: ${i.got_level}${i.got_code ? " / " + i.got_code : ""}`);
    if (i.expected_level) parts.push(`beklenen: ${i.expected_level}`);
    if (i.table) parts.push(`tablo: ${i.table}`);
    if (i.provider) parts.push(`sağlayıcı: ${i.provider}`);
    if (i.note) parts.push(`not: ${i.note}`);
    return parts.join(" · ");
  }
  function renderFeedback() {
    const f = $("#fbFilter").value;
    const items = FB.items.filter((i) => !f || i.type === f);
    $("#fbCount").textContent = FB.items.filter((i) => i.status !== "cozuldu").length;
    if (!items.length) { $("#fbList").innerHTML = `<div class="empty">Henüz not yok. Senaryo testinde "Bu sonucu bildir" ya da burada "Notu kaydet" ile ekleyin.</div>`; return; }
    $("#fbList").innerHTML = items.map((i) => {
      const [tname, tcls] = FB_TYPE[i.type] || ["Not", "plain"];
      const who = i.author ? esc(FB.names[i.author] || "Ekipten biri") : (FB.mode === "local" ? "bu tarayıcı" : "");
      const when = i.created_at ? new Date(i.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "";
      const done = i.status === "cozuldu";
      return `<div class="fb"${done ? ' style="opacity:.6"' : ""}>
        <div class="row"><span class="tag ${tcls}">${tname}</span>${done ? '<span class="tag ok">Çözüldü</span>' : ""}<span class="small muted">${esc(when)} · ${who}</span>
        ${FB.canWrite ? `<button class="btn small" data-resolve="${esc(i.id)}" type="button">${done ? "Yeniden aç" : "Çözüldü"}</button>` : ""}</div>
        <div>${esc(fbLine(i).replace(/^\[[^\]]*\] · ?/, ""))}</div></div>`;
    }).join("");
  }
  $("#fbList").addEventListener("click", (e) => { const b = e.target.closest("[data-resolve]"); if (b) toggleResolved(b.dataset.resolve); });
  $("#fbFilter").addEventListener("change", renderFeedback);
  $("#fbForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const note = $("#fbText").value.trim();
    if (!note) { $("#fbMsg").textContent = "Önce notu yazın."; return; }
    const r = await saveFeedback({ type: $("#fbType").value, note });
    $("#fbMsg").textContent = r.ok ? "Kaydedildi." : r.msg;
    if (r.ok) $("#fbText").value = "";
  });
  $("#fbCopy").addEventListener("click", async () => {
    const text = FB.items.filter((i) => i.status !== "cozuldu").map((i, n) => `${n + 1}. ${fbLine(i)}`).join("\n") || "Açık not yok.";
    try { await navigator.clipboard.writeText(text); $("#fbMsg").textContent = "Açık notlar panoya kopyalandı."; }
    catch (err) { $("#fbText").value = text; $("#fbText").select(); $("#fbMsg").textContent = "Pano izni yok; metni kutudan kopyalayın."; }
  });

  // ---------------- Not penceresi ----------------
  let dlgPayload = null;
  function openDialog({ title, context, type, expected, payload }) {
    dlgPayload = { type, ...payload };
    $("#dlgTitle").textContent = title;
    $("#dlgContext").textContent = context || "";
    $("#dlgExpWrap").style.display = expected === undefined ? "none" : "";
    $("#dlgExp").innerHTML = levelOptions(expected);
    $("#dlgText").value = "";
    $("#dlgMsg").textContent = FB.canWrite ? "" : "Yazma izniniz yok; not kaydedilemeyebilir.";
    $("#dialog").style.display = "block";
    $("#dlgText").focus();
  }
  const closeDialog = () => { $("#dialog").style.display = "none"; };
  $("#dlgCancel").addEventListener("click", closeDialog);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDialog(); });
  $("#dlgForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const item = { ...dlgPayload, note: $("#dlgText").value.trim() };
    if ($("#dlgExpWrap").style.display !== "none") item.expected_level = $("#dlgExp").value;
    if (!item.note && !item.expected_level) { $("#dlgMsg").textContent = "Kısa bir not yazın."; return; }
    const r = await saveFeedback(item);
    if (r.ok) { closeDialog(); flash("Not kaydedildi" + (r.local ? " (bu tarayıcıda)" : "") + "."); }
    else $("#dlgMsg").textContent = r.msg;
  });
  function flash(msg) {
    const el = document.createElement("div");
    el.className = "notice"; el.textContent = msg; el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:30;box-shadow:0 6px 20px rgba(0,0,0,.2)";
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }

  // ---------------- SENARYO ----------------
  const EXAMPLES = [
    ["Göğüs baskısı", "Babamın göğsünde baskı var, terliyor", false, false],
    ["Bası yarası, planlı", "Annemin sırtında bası yarası var, pansuman lazım", true, true],
    ["Ateş + öksürük, yatağa bağımlı", "Annemin ateşi var, öksürüyor", true, false],
    ["Fizik tedavi, plansız", "Diz protezi ameliyatı sonrası fizik tedavi istiyorum", false, false],
    ["Fizik tedavi, planlı", "Diz protezi ameliyatı sonrası fizik tedavi istiyorum", false, true],
    ["Reçeteli serum", "Doktorun yazdığı serumu evde taktırmak istiyorum", false, true],
    ["Çamaşır suyu", "Çocuğum yanlışlıkla çamaşır suyu içti", false, false],
    ["Mama raporu", "Annemin mama raporunu yenilemem lazım", true, false],
    ["Bilinmeyen şikayet", "Elimde kaşıntı var", false, false],
  ];
  $("#exampleChips").innerHTML = EXAMPLES.map((x, i) => `<button type="button" class="chip" data-ex="${i}">${esc(x[0])}</button>`).join("");
  $("#exampleChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ex]"); if (!b) return;
    const [, text, bed, plan] = EXAMPLES[+b.dataset.ex];
    $("#complaint").value = text; $("#bedridden").checked = bed; $("#hasPlan").checked = plan;
    renderScenario();
  });
  const patients = Object.values(repo.patients);
  $("#patientSel").innerHTML = patients.map((p) => `<option value="${p.id}">${p.id} · ${esc(p.district)}${p.bedridden ? " · yatağa bağımlı" : ""}</option>`).join("");
  $("#patientSel").value = "P16";
  $("#bedridden").checked = true; $("#hasPlan").checked = true;
  $("#patientSel").addEventListener("change", () => {
    const p = repo.patients[$("#patientSel").value];
    $("#bedridden").checked = p.bedridden; $("#hasPlan").checked = p.has_physician_plan; renderScenario();
  });
  let opts = "";
  for (let m = 8 * 60; m <= 18 * 60; m += 30) opts += `<option value="${m}"${m === 570 ? " selected" : ""}>${C.hhmm(m)}</option>`;
  $("#nowSel").innerHTML = opts;
  for (const id of ["wC", "wP", "wS"]) $("#" + id).addEventListener("input", () => { $("#" + id + "v").textContent = $("#" + id).value; renderScenario(); });
  let deb;
  $("#scnForm").addEventListener("input", (e) => { if (e.target.type !== "range") { clearTimeout(deb); deb = setTimeout(renderScenario, 150); } });
  $("#scnForm").addEventListener("submit", (e) => e.preventDefault());

  let lastScn = null;
  function currentPatient() {
    const base = repo.patients[$("#patientSel").value];
    return { ...base, bedridden: $("#bedridden").checked, has_physician_plan: $("#hasPlan").checked };
  }
  function renderScenario() {
    const complaint = $("#complaint").value;
    const p = currentPatient();
    const now = +$("#nowSel").value;
    const prefs = { yetkinlik: +$("#wC").value, fiyat: +$("#wP").value, hiz: +$("#wS").value };
    if (!complaint.trim()) { $("#scnResult").innerHTML = `<div class="panel empty">Bir şikayet yazın ya da hazır örneklerden birini seçin.</div>`; return; }
    const r = C.handleRequest(repo, complaint, p, DATE, now, prefs, 5);
    lastScn = { complaint, p, now, prefs, r };
    const t = r.triage;
    const sev = SEV[t.level];
    let h = `<div class="panel level ${sev} stack" style="gap:8px">
      <div class="row" style="justify-content:space-between"><span class="big">${esc(C.LEVEL_TEXT[t.level])}</span>
        <span class="row">${t.sources.map(srcTag).join("")}</span></div>
      <div>${esc(t.message)}</div>
      <ul class="reasons small">${t.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${t.other_routes.length ? `<div class="small muted">Ayrıca eşleşen kalıplar: ${t.other_routes.map((c) => `<span class="kwp">${esc(c)}</span>`).join(" ")} (en yüksek öncelikli seçildi)</div>` : ""}
      <div class="row"><button class="btn small" type="button" id="repScn">Bu sonucu bildir</button>
      <button class="btn small" type="button" id="caseScn">Bu cümleyi test vakası yap</button></div></div>`;
    if (t.is_emergency) {
      h += `<div class="panel"><b>Randevu önerilmez.</b> <span class="muted">Kırmızı bayrak varken sistem sağlık çalışanı eşleştirmez; kullanıcıyı acil hatta yönlendirir.</span></div>`;
    } else {
      h += `<div class="panel stack" style="gap:6px"><div class="row" style="justify-content:space-between"><h2>${esc(svcName(r.service))}</h2>
        <span class="small muted">${r.candidates.length ? r.candidates.length + " öneri" : "öneri yok"} · ağırlıklar Y${prefs.yetkinlik} F${prefs.fiyat} H${prefs.hiz}</span></div>
        ${r.notes.map((n) => `<div class="small muted">• ${esc(n)}</div>`).join("")}</div>`;
      if (!r.candidates.length) h += `<div class="panel empty">Bu koşullarda uygun sağlık çalışanı bulunamadı. Talep saatini erkene alın, hekim planı kutusunu kontrol edin ya da bunu eksik olarak bildirin.</div>`;
      r.candidates.forEach((c, i) => {
        const shared = c.insertion && c.insertion.shared;
        h += `<div class="panel">
          <div class="cand"><div class="rank">${i + 1}</div>
          <div class="stack" style="gap:4px">
            <div class="row"><b>${esc(c.name)}</b><span class="small muted">${esc(profName(c.profession))}</span>
              ${shared ? '<span class="tag ok">ziyaret paylaşımı</span>' : ""}${c.insertion ? "" : '<span class="tag info">uzaktan</span>'}</div>
            <div class="small">${esc(c.explanation)}</div>
            <div class="bars">${["yetkinlik", "fiyat", "hiz"].map((k) => `<div class="bar">${k === "hiz" ? "hız" : k} ${c.scores[k].toFixed(2)}<div class="track"><div class="fill" style="width:${(c.scores[k] * 100).toFixed(0)}%"></div></div></div>`).join("")}</div>
          </div>
          <div class="price"><div class="amt num">${tl(c.price.patient_pays)} TL</div><div class="small muted num">${C.hhmm(c.arrival_min)} · ${c.distance_km} km</div>
            <div class="small muted num">toplam puan ${c.total.toFixed(3)}</div>
            ${c.insertion ? `<button class="btn small" type="button" data-detail="${i}" style="margin-top:6px">Rota ve fiyat</button>` : ""}</div></div>
          <div class="detail" id="det${i}" hidden></div></div>`;
      });
    }
    $("#scnResult").innerHTML = h;
    $("#repScn").addEventListener("click", () => openDialog({
      title: "Bu sonucu bildir", type: "yanlis_sonuc", expected: t.level,
      context: `"${complaint}" → ${C.LEVEL_TEXT[t.level]}${t.route ? " (" + t.route + ")" : ""}`,
      payload: { complaint, patient: `${p.id}${p.bedridden ? " yatağa bağımlı" : ""}${p.has_physician_plan ? " planlı" : " plansız"}`, got_level: t.level, got_code: t.red_flags[0] || t.route || "" },
    }));
    $("#caseScn").addEventListener("click", () => openDialog({
      title: "Test vakası olarak kaydet", type: "test_vakasi", expected: t.level,
      context: `"${complaint}" — sistemin bulduğu: ${C.LEVEL_TEXT[t.level]}. Olması gerekeni seçin.`,
      payload: { complaint, bedridden: p.bedridden, has_plan: p.has_physician_plan, got_level: t.level, got_code: t.red_flags[0] || t.route || "" },
    }));
  }
  $("#scnResult").addEventListener("click", (e) => {
    const b = e.target.closest("[data-detail]"); if (!b || !lastScn) return;
    const i = +b.dataset.detail, c = lastScn.r.candidates[i], el = $("#det" + i);
    if (!el.hidden) { el.hidden = true; return; }
    const pv = repo.providers[c.provider_id];
    const base = repo.scheduled[c.provider_id + "|" + DATE] || [];
    const win = repo.availability[c.provider_id + "|" + DATE];
    const nv = { lat: lastScn.p.lat, lon: lastScn.p.lon, start_min: c.arrival_min, duration_min: repo.services[c.service].duration_min, service_code: c.service, isNew: true };
    const stops = [...base, nv].sort((a, b) => a.start_min - b.start_min);
    const pr = c.price;
    el.innerHTML = `<div class="stack">
      <div class="split">
        <div>Hasta öder<b>${tl(pr.patient_pays)} TL</b></div>
        <div>Sağlıkçı alır<b>${tl(pr.provider_gets)} TL</b></div>
        <div>Platform alır<b>${tl(pr.platform_gets)} TL</b></div></div>
      <div class="small muted">Hizmet bedeli ${tl(pr.service_fee)} TL (taban × ${pv.fee_multiplier}). Tek başına gidiş-dönüş ${c.insertion.standalone_km} km = ${tl(pr.standalone_travel)} TL; rotaya eklenince ek yol ${c.insertion.added_km} km = ${tl(pr.actual_travel)} TL.
      ${pr.saving > 0 ? `Tasarruf ${tl(pr.saving)} TL: %50 hastaya, %30 sağlıkçıya, %20 platforma.` : "Tasarruf yok: o gün bu bölgede başka ziyareti yok."}</div>
      <div class="small"><b>${esc(pv.display_name)}</b> günü (turuncu = bu talep)</div>
      <div class="timeline">${timelineHTML([pv.home_lat, pv.home_lon], win, stops)}</div>
      <svg class="map" viewBox="0 0 520 300" role="img" aria-label="Rota haritası"></svg></div>`;
    el.hidden = false;
    mapSVG($("svg", el), [pv.home_lat, pv.home_lon], stops);
  });

  // ---------------- TEST SETİ ----------------
  function runCase(text, bed, plan) {
    return C.triage(repo, text, { lat: 39.9, lon: 32.86, bedridden: bed, has_physician_plan: plan });
  }
  function renderEval() {
    const rows = DATA.triage_cases.map((c) => {
      const t = runCase(c.text, c.bedridden === "1", c.has_plan === "1");
      const codes = new Set([...t.red_flags, ...(t.route ? [t.route] : [])]);
      const okL = t.level === c.expected_level;
      const okC = c.expected_code ? codes.has(c.expected_code) : !t.route;
      return { c, t, ok: okL && okC };
    });
    const em = rows.filter((x) => ["ACIL_112", "ZEHIR_114"].includes(x.c.expected_level));
    const hit = em.filter((x) => x.t.is_emergency).length;
    const over = rows.filter((x) => !["ACIL_112", "ZEHIR_114"].includes(x.c.expected_level) && x.t.is_emergency).length;
    const okLevel = rows.filter((x) => x.t.level === x.c.expected_level).length;
    $("#evalTiles").innerHTML = [
      [rows.length, "etiketli vaka (ekip yazdı, bağımsız değil)"],
      [`${hit}/${em.length}`, "kırmızı bayrak duyarlılığı · hedef %100"],
      [over, "aşırı triyaj (gereksiz acil)"],
      [`%${Math.round((100 * okLevel) / rows.length)}`, "seviye doğruluğu"],
    ].map(([v, l]) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    const only = $("#onlyFail").checked;
    $("#evalTable").innerHTML = `<thead><tr><th>ID</th><th>Cümle</th><th>Durum</th><th>Beklenen</th><th>Bulunan</th><th>Eşleşen</th><th></th><th></th></tr></thead><tbody>` +
      rows.filter((x) => !only || !x.ok).map((x) => `<tr class="${x.ok ? "" : "fail"}"><td class="mono">${x.c.id}</td><td>${esc(x.c.text)}</td>
        <td class="small">${x.c.bedridden === "1" ? "yatağa bağımlı<br>" : ""}${x.c.has_plan === "1" ? "planlı" : "plansız"}</td>
        <td><span class="tag ${SEV[x.c.expected_level]}">${x.c.expected_level}</span></td><td><span class="tag ${SEV[x.t.level]}">${x.t.level}</span></td>
        <td class="mono small">${esc(x.t.red_flags[0] || x.t.route || "—")}</td><td>${x.ok ? "✓" : "✗"}</td>
        <td><button class="btn small" type="button" data-open="${esc(x.c.id)}">Senaryoda aç</button></td></tr>`).join("") + "</tbody>";
  }
  $("#onlyFail").addEventListener("change", renderEval);
  $("#evalTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]"); if (!b) return;
    const c = DATA.triage_cases.find((x) => x.id === b.dataset.open);
    $("#complaint").value = c.text; $("#bedridden").checked = c.bedridden === "1"; $("#hasPlan").checked = c.has_plan === "1";
    location.hash = "senaryo"; renderScenario();
  });
  const PROBES = [
    ["Göğsümde yanma var, reflü sanırım", "Göğüste yanma tek başına acil sayılmıyor. Doğru mu? Klinisyene sorulmalı."],
    ["En sonda kaldık, sıra bize gelmedi", "'sonda' kelimesi sıradan bir cümlede sonda bakımı sanılıyor (yanlış pozitif)."],
    ["Babam kelimeleri karıştırıyor, sağ eli tutmuyor", "İnme belirtisine benziyor; 'eli tutmuyor' anahtar kelimelerde yok."],
    ["Nefesim daralıyor, dudaklarım mosmor", "'mosmor' yazımı 'morarma' kalıbına uymuyor; acil kaçabilir."],
    ["Annemin şekeri 40'a düştü, terliyor", "Şeker düşüklüğü bilinç bulanıklığı olmadan acil sayılmıyor. Doğru mu?"],
    ["Kızımın 39 derece ateşi var, ensesi tutuldu", "Ateş + ense sertliği hafif akut şikayet sayılıyor; klinisyene sorulmalı."],
  ];
  function renderProbes() {
    $("#probeTable").innerHTML = `<thead><tr><th>Cümle</th><th>Sistemin cevabı</th><th>Şüphe</th><th></th></tr></thead><tbody>` +
      PROBES.map(([text, why], i) => { const t = runCase(text, false, false);
        return `<tr><td>${esc(text)}</td><td><span class="tag ${SEV[t.level]}">${t.level}</span> <span class="mono small">${esc(t.red_flags[0] || t.route || "")}</span></td>
        <td class="small">${esc(why)}</td><td><button class="btn small" type="button" data-probe="${i}">Bildir</button></td></tr>`; }).join("") + "</tbody>";
  }
  $("#probeTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-probe]"); if (!b) return;
    const [text, why] = PROBES[+b.dataset.probe]; const t = runCase(text, false, false);
    openDialog({ title: "Keşif cümlesini bildir", type: "yanlis_sonuc", expected: t.level, context: `"${text}" → ${C.LEVEL_TEXT[t.level]}. ${why}`,
      payload: { complaint: text, patient: "plansız", got_level: t.level, got_code: t.red_flags[0] || t.route || "" } });
  });
  $("#ncExp").innerHTML = levelOptions("TELE");
  function renderNewCase() {
    const text = $("#ncText").value.trim();
    if (!text) { $("#ncResult").innerHTML = ""; return; }
    const t = runCase(text, $("#ncBed").checked, $("#ncPlan").checked);
    const ok = t.level === $("#ncExp").value;
    $("#ncResult").innerHTML = `<div class="row small">Sistemin cevabı: <span class="tag ${SEV[t.level]}">${esc(C.LEVEL_TEXT[t.level])}</span>
      <span class="mono">${esc(t.red_flags.join(", ") || t.route || "kalıp yok")}</span> ${ok ? '<span class="tag ok">beklenenle aynı</span>' : '<span class="tag crit">beklenenden farklı</span>'}</div>`;
  }
  ["ncText", "ncBed", "ncPlan", "ncExp"].forEach((id) => $("#" + id).addEventListener(id === "ncText" ? "input" : "change", renderNewCase));
  $("#newCaseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#ncText").value.trim();
    if (!text) { $("#ncMsg").textContent = "Önce bir cümle yazın."; return; }
    const t = runCase(text, $("#ncBed").checked, $("#ncPlan").checked);
    const r = await saveFeedback({ type: "test_vakasi", complaint: text, bedridden: $("#ncBed").checked, has_plan: $("#ncPlan").checked,
      expected_level: $("#ncExp").value, got_level: t.level, got_code: t.red_flags[0] || t.route || "" });
    $("#ncMsg").textContent = r.ok ? "Kaydedildi; bir sonraki sürümde test setine eklenecek." : r.msg;
    if (r.ok) { $("#ncText").value = ""; renderNewCase(); }
  });

  // ---------------- VERİTABANI ----------------
  const TABLES = [
    ["Kaynaklı kurallar", [
      ["sources", "Her tıbbi ve mevzuat satırının dayandığı kaynak. S14 = ekip tasarım varsayımı."],
      ["professions", "Meslekler; tanı koyabilir mi, hekim istemi gerekir mi."],
      ["services", "Evde verilebilen hizmetler. Fiyatlar demo varsayımıdır."],
      ["profession_services", "Hangi meslek hangi hizmeti verebilir."],
      ["red_flags", "Acil belirtiler. Biri eşleşirse randevu önerilmez. Kelime kalıbı: a;b = ikisi birlikte, | = ya da."],
      ["complaint_routes", "Acil olmayan şikayetlerin hizmet seviyesine yönlendirilmesi (öncelik sırasıyla)."],
    ]],
    ["Sentetik demo verisi", [
      ["districts", "Yaklaşık ilçe merkezleri."],
      ["providers", "Sentetik sağlık çalışanları; gerçek kişi değildir."],
      ["provider_services", "Her çalışanın verdiği hizmetler ve o hizmetteki ziyaret sayısı."],
      ["availability", "16 Kasım müsaitlik aralıkları."],
      ["scheduled_visits", "16 Kasım için önceden planlı ziyaretler (ziyaret paylaşımının dayanağı)."],
      ["patients", "Sentetik hastalar."],
    ]],
    ["Değerlendirme", [["triage_cases", "Etiketli triyaj vakaları; YZ modeli için ilk ölçüm seti."]]],
  ];
  let curTable = "red_flags";
  function renderTableList() {
    $("#tableList").innerHTML = TABLES.map(([g, ts]) => `<div class="grp">${g}</div>` + ts.map(([t]) =>
      `<button type="button" data-t="${t}" aria-pressed="${t === curTable}"><span class="mono">${t}</span><span class="muted num">${DATA[t].length}</span></button>`).join("")).join("");
  }
  const TIME_COLS = new Set(["start_min", "end_min"]);
  const BOOL_COLS = new Set(["can_diagnose", "requires_physician_order", "needs_physician_order", "needs_prescription", "remote_possible", "licence_verified", "bedridden", "has_physician_plan"]);
  function cell(k, v) {
    if (v === null || v === undefined || v === "") return '<span class="muted">—</span>';
    if (k === "source_id") return srcTag(v);
    if (k === "url") return `<a href="${esc(v)}">bağlantı</a>`;
    if (k === "keywords") return v.split("|").map((a) => `<span class="kwp">${esc(a)}</span>`).join("");
    if (k === "services" && String(v).includes("_")) return String(v).split("|").map((a) => `<span class="kwp">${esc(a)}</span>`).join("");
    if (TIME_COLS.has(k)) return `<span class="num">${C.hhmm(v)}</span>`;
    if (BOOL_COLS.has(k)) return v === 1 || v === true || v === "1" ? "✓" : "—";
    if (k.startsWith("level")) return `<span class="tag ${SEV[v] || "plain"}">${esc(v)}</span>`;
    return esc(v);
  }
  function renderDbTable() {
    renderTableList();
    const desc = TABLES.flatMap((g) => g[1]).find((x) => x[0] === curTable)[1];
    $("#tblTitle").innerHTML = `<span class="mono">${curTable}</span>`;
    $("#tblDesc").textContent = desc;
    const q = C.normalize($("#tblSearch").value).trim();
    const rows = DATA[curTable].filter((r) => !q || C.normalize(Object.values(r).join(" ")).includes(q));
    const cols = Object.keys(DATA[curTable][0] || {});
    $("#dbTable").innerHTML = `<thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
      rows.slice(0, 500).map((r) => `<tr>${cols.map((c) => `<td class="${c === "keywords" ? "kw" : ""}">${cell(c, r[c])}</td>`).join("")}</tr>`).join("") +
      (rows.length ? "" : `<tr><td colspan="${cols.length}" class="muted">Eşleşen satır yok.</td></tr>`) + "</tbody>";
  }
  $("#tableList").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; curTable = b.dataset.t; $("#tblSearch").value = ""; renderDbTable(); });
  $("#tblSearch").addEventListener("input", renderDbTable);
  $("#tblReport").addEventListener("click", () => openDialog({ title: `${curTable} tablosunda eksik`, type: "veritabani",
    context: "Eksik satır, yanlış kural ya da eklenmesi gereken alanı yazın. Kaynak linki varsa ekleyin.", payload: { table: curTable } }));

  // ---------------- SAĞLAYICI PANELİ ----------------
  const PS = { id: "HEM-12", accepted: {}, rejected: {}, windows: {} };
  const provs = Object.values(repo.providers).sort((a, b) => a.profession_code.localeCompare(b.profession_code) || a.id.localeCompare(b.id));
  $("#provSel").innerHTML = provs.map((p) => `<option value="${p.id}">${p.id} · ${esc(profName(p.profession_code))} · ${esc(p.home_district)}</option>`).join("");
  $("#provSel").value = PS.id;
  $("#provSel").addEventListener("change", () => { PS.id = $("#provSel").value; renderProvider(); });
  const DAYS = ["Pzt 16", "Sal 17", "Çar 18", "Per 19", "Cum 20", "Cmt 21", "Paz 22"];
  function provWindow(id) {
    return PS.windows[id] || repo.availability[id + "|" + DATE] || [540, 1020];
  }
  function provStops(id) {
    return [...(repo.scheduled[id + "|" + DATE] || []), ...(PS.accepted[id] || [])].sort((a, b) => a.start_min - b.start_min);
  }
  function provRequests(p) {
    const offered = Object.keys(repo.provider_services[p.id] || {}).filter((s) => !(repo.services[s].remote_possible && repo.services[s].category === "tele"));
    if (!offered.length) return { list: [], blocked: 0 };
    const win = provWindow(p.id), stops = provStops(p.id), home = [p.home_lat, p.home_lon];
    const taken = new Set((PS.accepted[p.id] || []).map((v) => v.patient_id));
    const rej = PS.rejected[p.id] || new Set();
    const seed = [...p.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    let blocked = 0; const list = [];
    patients.forEach((pt, idx) => {
      if (taken.has(pt.id) || rej.has(pt.id)) return;
      const svc = repo.services[offered[(idx + seed) % offered.length]];
      if (svc.needs_physician_order && !pt.has_physician_plan) { blocked++; return; }
      const dist = C.roadKm(home, [pt.lat, pt.lon]);
      if (dist > 20) return;
      const ins = C.bestInsertion(home, win, stops, [pt.lat, pt.lon], svc.duration_min, 570 + C.CFG.LEAD_TIME_MIN);
      if (!ins) return;
      const price = C.priceVisit(svc.base_fee_tl, p.fee_multiplier, ins);
      list.push({ pt, svc, ins, price });
    });
    list.sort((a, b) => a.ins.added_km - b.ins.added_km);
    return { list: list.slice(0, 6), blocked };
  }
  function renderProvider() {
    const p = repo.providers[PS.id];
    const home = [p.home_lat, p.home_lon];
    const win = provWindow(p.id);
    const stops = provStops(p.id);
    $("#provBadges").innerHTML = `<span class="tag ${p.licence_verified ? "ok" : "crit"}">${p.licence_verified ? "ruhsat doğrulandı" : "ruhsat doğrulanmadı · talep almaz"}</span>
      <span class="tag plain">${p.years_experience} yıl</span><span class="tag plain">puan ${p.rating}</span><span class="tag plain">ücret ×${p.fee_multiplier}</span><span class="tag plain">${esc(p.home_district)}</span>`;
    const km = routeKm(home, stops);
    const earn = stops.reduce((a, s) => a + (s.price ? s.price.provider_gets : repo.services[s.service_code].base_fee_tl * p.fee_multiplier * (1 - C.CFG.COMMISSION)), 0);
    const busy = stops.reduce((a, s) => a + s.duration_min, 0);
    let travel = 0, prev = home; for (const s of stops) { travel += C.travelMin(C.roadKm(prev, [s.lat, s.lon])); prev = [s.lat, s.lon]; }
    if (stops.length) travel += C.travelMin(C.roadKm(prev, home));
    const idle = Math.max(0, win[1] - win[0] - busy - travel);
    $("#provTiles").innerHTML = [
      [stops.length, "bugünkü ziyaret"], [`${km.toFixed(1)} km`, "toplam yol"],
      [`${tl(earn)} TL`, "tahmini kazanç (komisyon sonrası)"], [`${Math.floor(idle / 60)} sa ${idle % 60} dk`, "boş süre"],
    ].map(([v, l]) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    $("#provDay").textContent = `16 Kasım · çalışma ${C.hhmm(win[0])}–${C.hhmm(win[1])}`;
    const vis = stops.map((s) => ({ ...s, isNew: !!s.accepted }));
    $("#provTimeline").innerHTML = timelineHTML(home, win, vis);
    const reqs = provRequests(p);
    mapSVG($("#provMap"), home, vis, reqs.list.map((r) => ({ loc: [r.pt.lat, r.pt.lon] })));
    $("#provStops").innerHTML = stops.length ? `<div class="tablewrap"><table><thead><tr><th>Saat</th><th>Hizmet</th><th>Süre</th><th></th></tr></thead><tbody>${stops.map((s) =>
      `<tr><td class="num">${C.hhmm(s.start_min)}</td><td>${esc(svcName(s.service_code))}${s.patient_id ? ` <span class="small muted">· ${s.patient_id}</span>` : ""}</td><td class="num">${s.duration_min} dk</td><td>${s.accepted ? '<span class="tag warn">yeni kabul</span>' : '<span class="tag plain">planlı</span>'}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">Bugün planlı ziyaret yok. Gelen taleplerden kabul ettikleriniz burada görünür.</div>`;
    $("#provRequests").innerHTML = (p.licence_verified ? "" : `<div class="notice warn">Ruhsatı doğrulanmayan sağlayıcıya hasta önerilmez; aşağıdakiler yalnızca önizleme.</div>`) +
      (reqs.list.length ? reqs.list.map((r, i) => `<div class="req"><div class="stack" style="gap:2px">
        <div class="row"><b>${esc(r.svc.name_tr)}</b>${r.ins.shared ? '<span class="tag ok">rotanıza uygun</span>' : ""}${r.pt.bedridden ? '<span class="tag plain">yatağa bağımlı</span>' : ""}</div>
        <div class="small muted">${r.pt.id} · ${esc(r.pt.district)} · ${C.hhmm(r.ins.arrival_min)} · ${r.svc.duration_min} dk · ek yol ${r.ins.added_km} km${r.ins.shared ? ` (tek başına ${r.ins.standalone_km} km)` : ""}</div>
        <div class="small">Kazancınız <b class="num">${tl(r.price.provider_gets)} TL</b> <span class="muted">· hasta öder ${tl(r.price.patient_pays)} TL</span></div></div>
        <div class="row"><button class="btn small primary" type="button" data-acc="${i}">Kabul et</button><button class="btn small" type="button" data-rej="${i}">Reddet</button></div></div>`).join("")
      : `<div class="empty">Çalışma saatlerinize sığan talep yok. Saatlerinizi genişletmeyi deneyin.</div>`) +
      (reqs.blocked ? `<div class="small muted" style="margin-top:8px">${reqs.blocked} talep hekim planı olmadığı için size gösterilmedi (önce hekime yönlendirildi).</div>` : "");
    $("#provRequests").onclick = (e) => {
      const a = e.target.closest("[data-acc]"), rj = e.target.closest("[data-rej]");
      if (a) { const r = reqs.list[+a.dataset.acc];
        (PS.accepted[p.id] ||= []).push({ id: "A" + Date.now(), lat: r.pt.lat, lon: r.pt.lon, start_min: r.ins.arrival_min, duration_min: r.svc.duration_min, service_code: r.svc.code, patient_id: r.pt.id, accepted: true, price: r.price });
        renderProvider(); }
      if (rj) { const r = reqs.list[+rj.dataset.rej]; (PS.rejected[p.id] ||= new Set()).add(r.pt.id); renderProvider(); }
    };
    let hours = ""; for (let m = 7 * 60; m <= 21 * 60; m += 30) hours += `<option value="${m}">${C.hhmm(m)}</option>`;
    $("#provWeek").innerHTML = DAYS.map((d, i) => `<div class="weekrow"><label class="check" for="wd${i}"><input type="checkbox" id="wd${i}" ${i < 5 ? "checked" : ""}> ${d}</label>
      <select id="ws${i}" aria-label="${d} başlangıç">${hours}</select><select id="we${i}" aria-label="${d} bitiş">${hours}</select></div>`).join("") +
      `<div class="small muted">Pazartesi 16 Kasım değişince rota ve talepler hemen yeniden hesaplanır. Diğer günler taslaktır.</div>`;
    for (let i = 0; i < 7; i++) { $("#ws" + i).value = win[0]; $("#we" + i).value = win[1]; }
    const onMon = () => { const s = +$("#ws0").value, e = +$("#we0").value;
      if (e - s >= 60) { PS.windows[p.id] = [s, e]; renderProvider(); } };
    $("#ws0").onchange = onMon; $("#we0").onchange = onMon;
    $("#wd0").onchange = () => { if (!$("#wd0").checked) { PS.windows[p.id] = [win[0], win[0]]; } else { delete PS.windows[p.id]; } renderProvider(); };
    $("#wd0").checked = win[1] > win[0];
    const ps = repo.provider_services[p.id] || {};
    $("#provServices").innerHTML = `<thead><tr><th>Hizmet</th><th>Ziyaret</th><th>Sizin bedeliniz</th><th>Hekim istemi</th></tr></thead><tbody>` +
      Object.entries(ps).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<tr><td>${esc(svcName(s))}</td><td class="num">${v}</td>
        <td class="num">${tl(repo.services[s].base_fee_tl * p.fee_multiplier)} TL</td><td>${repo.services[s].needs_physician_order ? "gerekir" : "—"}</td></tr>`).join("") + "</tbody>";
  }
  $("#panelReport").addEventListener("click", () => openDialog({ title: "Doktor / hemşire paneli için not", type: "panel",
    context: `${PS.id} olarak bakarken: eksik bilgi, yanlış hesap ya da eklenmesi gereken ekran.`, payload: { provider: PS.id } }));

  // ---------------- Başlat ----------------
  route();
  renderScenario();
  renderEval();
  renderProbes();
  renderDbTable();
  renderProvider();
  renderFeedback();
  fbInit();
})();
