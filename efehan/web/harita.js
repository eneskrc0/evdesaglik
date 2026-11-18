/* Kapıda — gerçek İzmir haritası, sokak üzerinde rota ve canlı takip (Enes'in enes/web/index.html çalışmasından).
   Veri: data/seed/harita_izmir.json (build_izmir.py) — yol çizimi ve yol grafiği © OpenStreetMap katkıcıları.
   Rota: yol grafiğinde Dijkstra (Enes'in routeNodes'u); süreler serbest akış, trafik çarpanı çağıran tarafta.
   Kullanım: const M = KapidaHarita.create(window.KAPIDA_HARITA, yolPaketi); M.svg({...}); M.rota(a, b). */
(function () {
  "use strict";
  const anahtar = (lat, lon) => lat.toFixed(6) + "," + lon.toFixed(6);
  function b64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
  function km(a, b) {
    const R = Math.PI / 180, dl = (b[0] - a[0]) * R, dn = (b[1] - a[1]) * R;
    const d = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dn / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(d));
  }

  function create(H, yol) {
    if (!H || !yol) return null;
    const v = H.view, sx = H.W / (v.maxLon - v.minLon), sy = sx / Math.cos(((v.minLat + v.maxLat) / 2) * Math.PI / 180);
    const proj = (lat, lon) => [(lon - v.minLon) * sx, (v.maxLat - lat) * sy];
    const idx = new Map(yol.noktalar.map(([a, b], i) => [anahtar(a, b), i]));
    let G = null;
    function graf() {
      if (G) return G;
      const g = H.graph, la = new Uint16Array(b64(g.lat)), lo = new Uint16Array(b64(g.lon));
      G = { n: g.n, lat: Float64Array.from(la, (x) => g.lat0 + x * g.q), lon: Float64Array.from(lo, (x) => g.lon0 + x * g.q),
        off: new Uint32Array(b64(g.off)), tgt: new Uint16Array(b64(g.tgt)), tt: new Uint16Array(b64(g.tt)) };
      return G;
    }
    // Dijkstra (ikili yığın), hedefte durur — Enes'in routeNodes'u
    function dijkstra(s, t) {
      const g = graf(), dist = new Float64Array(g.n).fill(Infinity), prev = new Int32Array(g.n).fill(-1), Hp = [];
      const push = (d, x) => { Hp.push([d, x]); let i = Hp.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (Hp[p][0] <= Hp[i][0]) break; [Hp[p], Hp[i]] = [Hp[i], Hp[p]]; i = p; } };
      const pop = () => { const top = Hp[0], last = Hp.pop(); if (Hp.length) { Hp[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < Hp.length && Hp[l][0] < Hp[m][0]) m = l; if (r < Hp.length && Hp[r][0] < Hp[m][0]) m = r; if (m === i) break; [Hp[m], Hp[i]] = [Hp[i], Hp[m]]; i = m; } } return top; };
      dist[s] = 0; push(0, s);
      while (Hp.length) { const [d, x] = pop(); if (d > dist[x]) continue; if (x === t) break; for (let e = g.off[x]; e < g.off[x + 1]; e++) { const w = g.tgt[e], nd = d + g.tt[e] / 10; if (nd < dist[w]) { dist[w] = nd; prev[w] = x; push(nd, w); } } }
      if (!isFinite(dist[t])) return null;
      const path = []; for (let x = t; x >= 0; x = prev[x]) path.push(x); path.reverse();
      const pts = path.map((x) => [g.lat[x], g.lon[x]]), cum = path.map((x) => dist[x]), kms = [0];
      for (let i = 1; i < pts.length; i++) kms.push(kms[i - 1] + km(pts[i - 1], pts[i]));
      return { pts, cum, km: kms, total: dist[t], sokak: true };
    }
    const onbellek = new Map();
    function rota(a, b) {
      const k = anahtar(a[0], a[1]) + ">" + anahtar(b[0], b[1]);
      if (onbellek.has(k)) return onbellek.get(k);
      const ia = idx.get(anahtar(a[0], a[1])), ib = idx.get(anahtar(b[0], b[1]));
      let r = null;
      if (ia !== undefined && ib !== undefined && ia !== ib) r = dijkstra(H.dugum[ia], H.dugum[ib]);
      if (r) { r.pts[0] = [a[0], a[1]]; r.pts[r.pts.length - 1] = [b[0], b[1]]; }
      else { const d = km(a, b) * 1.3; r = { pts: [a, b], cum: [0, d / 30 * 3600], km: [0, d], total: d / 30 * 3600, sokak: false }; }
      onbellek.set(k, r);
      return r;
    }
    // Rota üzerinde oran (0..1, süreye göre) için konum ve kalan km
    function rotaNoktasi(r, f) {
      const target = Math.max(0, Math.min(1, f)) * r.total; let i = 1;
      while (i < r.cum.length - 1 && r.cum[i] < target) i++;
      const seg = r.cum[i] - r.cum[i - 1], g = seg > 0 ? (target - r.cum[i - 1]) / seg : 1, a = r.pts[i - 1], b = r.pts[i];
      const pos = [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g];
      const kmLeft = r.km[r.km.length - 1] - (r.km[i - 1] + (r.km[i] - r.km[i - 1]) * g);
      return { pos, i, kmLeft };
    }
    /* svg({ rotalar: [{ pts, renk, gecilen }], isaretler: [{ lat, lon, tur, etiket }], yukseklik })
       tur: "hasta" | "calisan" | "durak" | "ev" | "hareketli" */
    function svg(o) {
      const rotalar = o.rotalar || [], isaretler = o.isaretler || [];
      const tum = [...rotalar.flatMap((r) => r.pts), ...isaretler.map((m) => [m.lat, m.lon])].map((p) => proj(p[0], p[1]));
      if (!tum.length) return "";
      let x0 = Math.min(...tum.map((p) => p[0])), x1 = Math.max(...tum.map((p) => p[0]));
      let y0 = Math.min(...tum.map((p) => p[1])), y1 = Math.max(...tum.map((p) => p[1]));
      const oran = o.oran || 0.62, kmBirim = sx * 0.0115; // ~1 km
      let w = Math.max(x1 - x0, kmBirim * 1.6), h = Math.max(y1 - y0, kmBirim * 1.6 * oran);
      if (w * oran < h) w = h / oran; else h = w * oran;
      w *= 1.25; h *= 1.25;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, vx = cx - w / 2, vy = cy - h / 2, z = w / 100;
      const pl = (pts) => pts.map((p) => proj(p[0], p[1]).map((n) => n.toFixed(2)).join(",")).join(" ");
      let g = `<path d="${H.minor}" class="hr-minor"/><path d="${H.major}" class="hr-major"/><path d="${H.border}" class="hr-sinir"/>`;
      for (const r of rotalar) {
        if (r.gecilen && r.gecilen.length > 1) g += `<polyline points="${pl(r.gecilen)}" class="hr-rota hr-gecilen"/>`;
        g += `<polyline points="${pl(r.pts)}" class="hr-rota${r.kesik ? " hr-kesik" : ""}" style="stroke:${r.renk || "var(--brand)"}"/>`;
      }
      for (const m of isaretler) {
        const [x, y] = proj(m.lat, m.lon), r = (m.tur === "durak" ? 1.6 : m.tur === "hareketli" ? 2.3 : 2.1) * z;
        if (m.tur === "hareketli") g += `<circle cx="${x}" cy="${y}" r="${r * 2.4}" class="hr-nabiz"/>`;
        g += `<circle cx="${x}" cy="${y}" r="${r}" class="hr-isaret hr-${m.tur}"/>`;
        if (m.etiket) g += `<text x="${x + r * 1.5}" y="${y + r * 0.5}" class="hr-etiket" style="font-size:${3.6 * z}px">${String(m.etiket).replace(/[<&]/g, "")}</text>`;
      }
      return `<svg class="harita" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" role="img" aria-label="${(o.aciklama || "Harita").replace(/"/g, "")}" preserveAspectRatio="xMidYMid slice">${g}</svg>
        <div class="hr-atif">© OpenStreetMap katkıcıları</div>`;
    }
    return { proj, rota, rotaNoktasi, svg, km };
  }
  window.KapidaHarita = { create };
})();
