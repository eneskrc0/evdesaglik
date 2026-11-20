/* Kapıda — toplu taşımayla gelen çalışanın yolculuk planı (Enes'in enes/web/index.html transitRoute'u).
   Veri: enes/web/transit_izmir.json (enes/sim/build_transit.py; ESHOT + Metro + Tramvay + İZBAN + İZDENİZ, GTFS).
   Süre (ETA) her zaman core.js travel(..., "toplu") matrisinden gelir; bu modül yalnızca "hangi hatla, nereden
   nereye" planını ve haritada izlenecek rotayı üretir. Grafik: [adres noktaları][duraklar][hat-durak], desidakika.
   Kullanım: const T = KapidaToplu.create(window.KAPIDA_TOPLU, noktalar); T.rota(a, b, dakika) -> {pts, cum, km, total, legs}; T.metin(r, sn). */
(function () {
  "use strict";
  function b64(s, Tip) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Tip(u.buffer); }
  function km(a, b) {
    const R = Math.PI / 180, dl = (b[0] - a[0]) * R, dn = (b[1] - a[1]) * R;
    const d = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dn / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(d));
  }
  const temiz = (x) => String(x || "").replace(/[<>&"]/g, "");
  const IKON = { otobus: "🚌", metro: "🚇", tramvay: "🚊", izban: "🚆", vapur: "⛴️" };

  function create(NET, noktalar) {
    if (!NET || !noktalar || !noktalar.length) return null;
    let G = null;
    const anahtar = (lat, lon) => lat.toFixed(6) + "," + lon.toFixed(6);
    const idx = new Map(noktalar.map(([a, b], i) => [anahtar(a, b), i]));
    function kur() {
      if (G) return G;
      const pr = NET.param, KX = 111320 * Math.cos(pr.lat0 * Math.PI / 180), KY = 110540;
      const sx = b64(NET.sx, Int32Array), sy = b64(NET.sy, Int32Array), S = sx.length, ad = NET.sn.split("|");
      const rsDurak = b64(NET.rs_stop, Int32Array), rsHat = b64(NET.rs_line, Int16Array), R = rsDurak.length;
      const binis = b64(NET.board, Uint16Array), arac = b64(NET.ride, Int32Array), NB = NET.dilim.length, NR = NET.nride;
      const P = noktalar.length, px = noktalar.map((q) => Math.round(q[1] * KX)), py = noktalar.map((q) => Math.round(q[0] * KY));
      const yur = (d) => Math.floor(d * pr.dolambac / 1000 / pr.yurume_kmh * 60 * 10 + 0.5);
      const E = [];
      const hucre = 1000, izgara = new Map(), k = (x, y) => Math.floor(x / hucre) + "," + Math.floor(y / hucre);
      for (let j = 0; j < S; j++) { const kk = k(sx[j], sy[j]); (izgara.get(kk) || izgara.set(kk, []).get(kk)).push(j); }
      const yakin = (x, y, r, f) => { const cx = Math.floor(x / hucre), cy = Math.floor(y / hucre); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = izgara.get((cx + a) + "," + (cy + b)); if (L) for (const j of L) { const d = Math.hypot(sx[j] - x, sy[j] - y); if (d <= r) f(j, d); } } };
      for (let i = 0; i < P; i++) yakin(px[i], py[i], pr.erisim_m, (j, d) => { const w = yur(d); E.push([i, P + j, w, w, w, w], [P + j, i, w, w, w, w]); });
      for (let j = 0; j < S; j++) yakin(sx[j], sy[j], pr.aktarma_m, (q, d) => { if (q > j) { const w = yur(d); E.push([P + j, P + q, w, w, w, w], [P + q, P + j, w, w, w, w]); } });
      for (let n = 0; n < R; n++) { const b = [0, 1, 2, 3].map((q) => binis[n * NB + q] || -1); E.push([P + rsDurak[n], P + S + n, ...b], [P + S + n, P + rsDurak[n], 0, 0, 0, 0]); }
      for (let e = 0; e < NR; e++) { const o = e * (2 + NB); E.push([P + S + arac[o], P + S + arac[o + 1], arac[o + 2], arac[o + 3], arac[o + 4], arac[o + 5]]); }
      const N = P + S + R, off = new Uint32Array(N + 1);
      for (const e of E) off[e[0] + 1]++;
      for (let i = 0; i < N; i++) off[i + 1] += off[i];
      const pos = off.slice(0, N), tg = new Int32Array(E.length), w = new Float32Array(E.length * NB);
      for (const e of E) { const kk = pos[e[0]]++; tg[kk] = e[1]; for (let q = 0; q < NB; q++) w[q * E.length + kk] = e[2 + q]; }
      const lat = new Float64Array(N), lon = new Float64Array(N);
      for (let i = 0; i < P; i++) { lat[i] = noktalar[i][0]; lon[i] = noktalar[i][1]; }
      for (let j = 0; j < S; j++) { lat[P + j] = sy[j] / KY; lon[P + j] = sx[j] / KX; }
      for (let n = 0; n < R; n++) { lat[P + S + n] = lat[P + rsDurak[n]]; lon[P + S + n] = lon[P + rsDurak[n]]; }
      G = { P, S, R, N, NE: E.length, off, tg, w, lat, lon, ad, rsDurak, rsHat };
      return G;
    }
    function dilim(m) { m = ((m % 1440) + 1440) % 1440; const D = NET.dilim; for (let i = 0; i < D.length - 1; i++) if (m < D[i][2]) return i; return D.length - 1; }
    function dijkstra(s, t, q) {
      const g = kur(), dist = new Float64Array(g.N).fill(Infinity), prev = new Int32Array(g.N).fill(-1), H = [], base = q * g.NE;
      const push = (d, v) => { H.push([d, v]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
      const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
      dist[s] = 0; push(0, s);
      while (H.length) { const [d, v] = pop(); if (d > dist[v]) continue; if (v === t) break;
        for (let e = g.off[v]; e < g.off[v + 1]; e++) { const ww = g.w[base + e]; if (ww < 0) continue; const u = g.tg[e], nd = d + ww; if (nd < dist[u]) { dist[u] = nd; prev[u] = v; push(nd, u); } } }
      return { dist, prev };
    }
    const onbellek = new Map();
    // a, b: [lat, lon] (yol paketindeki noktalar); dakika: yola çıkış saati
    function rota(a, b, dakika) {
      const ia = idx.get(anahtar(a[0], a[1])), ib = idx.get(anahtar(b[0], b[1]));
      if (ia === undefined || ib === undefined) return null;
      const q = dilim(dakika), key = ia + ">" + ib + "@" + q;
      if (onbellek.has(key)) return onbellek.get(key);
      const g = kur(), { dist, prev } = dijkstra(ia, ib, q);
      const yurumeDk = (km(a, b) * NET.param.dolambac) / NET.param.yurume_kmh * 60;
      let r;
      if (!isFinite(dist[ib]) || yurumeDk * 10 <= dist[ib]) {
        r = { pts: [a, b], cum: [0, yurumeDk * 60], km: [0, km(a, b) * NET.param.dolambac], total: yurumeDk * 60, legs: [{ t: "yuru", min: yurumeDk, c0: 0 }], toplu: true };
      } else {
        const yol = []; for (let v = ib; v >= 0; v = prev[v]) yol.push(v); yol.reverse();
        const pts = yol.map((v) => [g.lat[v], g.lon[v]]), cum = yol.map((v) => dist[v] * 6), kms = [0];
        for (let i = 1; i < pts.length; i++) kms.push(kms[i - 1] + km(pts[i - 1], pts[i]));
        const tur = (v) => (v < g.P ? "p" : v < g.P + g.S ? "s" : "r"), ad = (v) => g.ad[v < g.P + g.S ? v - g.P : g.rsDurak[v - g.P - g.S]];
        const legs = [];
        for (let i = 1; i < yol.length; i++) {
          const u = yol[i - 1], v = yol[i], tu = tur(u), tv = tur(v), dt = (dist[v] - dist[u]) / 10;
          if (tu === "s" && tv === "r") legs.push({ t: "bin", hat: g.rsHat[v - g.P - g.S], from: ad(v), bekle: dt, min: 0, n: 0, c0: cum[i - 1] });
          else if (tu === "r" && tv === "r") { const L = legs[legs.length - 1]; L.min += dt; L.n++; L.to = ad(v); }
          else if (tu === "r" && tv === "s") { /* iniş */ }
          else { const L = legs[legs.length - 1]; if (L && L.t === "yuru") L.min += dt; else legs.push({ t: "yuru", min: dt, c0: cum[i - 1] }); if (tv === "s") legs[legs.length - 1].to = ad(v); }
        }
        pts[0] = [a[0], a[1]]; pts[pts.length - 1] = [b[0], b[1]];
        r = { pts, cum, km: kms, total: dist[ib] * 6, legs, toplu: true };
      }
      onbellek.set(key, r);
      return r;
    }
    // Bacakları tek satır metin olarak (sn: rotada geçen süre, o anki bacak vurgulanır)
    function metin(r, sn) {
      if (!r || !r.legs) return "";
      const ceza = NET.param.binis_ceza || 0;
      return r.legs.map((L, i) => {
        const nx = r.legs[i + 1], simdi = sn != null && sn >= L.c0 && (!nx || sn < nx.c0);
        let t;
        if (L.t === "yuru") t = `🚶 ${Math.max(1, Math.round(L.min))} dk${L.to ? " → " + temiz(L.to) : ""}`;
        else { const h = NET.lines[L.hat], adi = temiz(h.f === "ESHOT" ? "ESHOT " + h.k : (h.k || h.a)); t = `${IKON[h.m] || "🚌"} <b>${adi}</b> ${temiz(L.from)} → ${temiz(L.to) || "?"} · ${L.n} durak · ${Math.round(L.min)} dk (bekleme ~${Math.max(1, Math.round(L.bekle - ceza))} dk)`; }
        return simdi ? `<span class="toplu-simdi">${t}</span>` : t;
      }).join(" → ");
    }
    // Hattın okunur adı: "ESHOT 105", "İZBAN (Çiğli-Aliağa)", "Metro (F.Altay–Evka 3)", "Tramvay", "Vapur (Karşıyaka–Konak)"
    const MOD_AD = { otobus: "Otobüs", metro: "Metro", tramvay: "Tramvay", izban: "İZBAN", vapur: "Vapur" };
    function hatAdi(hat) {
      const h = NET.lines[hat] || {};
      if (h.f === "ESHOT") return "ESHOT " + temiz(h.k);
      const tur = MOD_AD[h.m] || temiz(h.f) || "Hat", ek = temiz(h.a || h.k);
      return ek && ek !== tur ? `${tur} (${ek})` : tur;
    }
    // Çalışan için adım adım tarif: [{ikon, metin, alt, dk, c0, son}]; sn verilirse o anki adım "simdi"
    function adimlar(r, sn) {
      if (!r || !r.legs) return [];
      const ceza = NET.param.binis_ceza || 0;
      return r.legs.map((L, i) => {
        const nx = r.legs[i + 1], son = i === r.legs.length - 1, simdi = sn != null && sn >= L.c0 && (!nx || sn < nx.c0);
        if (L.t === "yuru") {
          const dk = Math.max(1, Math.round(L.min));
          return { ikon: "🚶", metin: `${dk} dk yürü`, alt: son ? "hastanın adresine" : L.to ? `${temiz(L.to)} durağına` : "", dk, c0: L.c0, simdi, son };
        }
        const h = NET.lines[L.hat] || {}, bekle = Math.max(1, Math.round(L.bekle - ceza));
        return { ikon: IKON[h.m] || "🚌", metin: `${hatAdi(L.hat)} ile git`, alt: `bin: ${temiz(L.from)} · in: ${temiz(L.to) || "?"} · ${L.n} durak, ${Math.round(L.min)} dk (bekleme ~${bekle} dk)`,
          dk: Math.round(L.min) + bekle, c0: L.c0, simdi, son, hat: hatAdi(L.hat), from: temiz(L.from) };
      });
    }
    // Hasta için tek satır: "ESHOT 105 + İZBAN (Çiğli-Aliağa)"; yalnız yürüyüşse "yürüyerek"
    function ozet(r) {
      if (!r || !r.legs) return "";
      const hatlar = r.legs.filter((L) => L.t === "bin").map((L) => `${IKON[(NET.lines[L.hat] || {}).m] || "🚌"} ${hatAdi(L.hat)}`);
      return hatlar.length ? [...new Set(hatlar)].join(" + ") : "🚶 yürüyerek";
    }
    return { rota, metin, dilim, adimlar, ozet, hatAdi };
  }
  window.KapidaToplu = { create };
})();
