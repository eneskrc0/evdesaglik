/* Kapıda — çevrimdışı adres arama (Enes'in enes/web/index.html adrSearch'ü).
   Veri: enes/web/adres_izmir.json (enes/sim/build_adres.py) — OpenStreetMap sokak/cadde/mahalle adları, © OSM katkıcıları (ODbL).
   "Kazımdirik Mah. 372. Sok.", "372 sk bornova", "kıbrıs şehitleri cad" gibi yazımları anlar; sorguda mahalle adı geçerse o
   mahalleye yakın sokakları öne çıkarır. Kullanım: const A = KapidaAdres.create(window.KAPIDA_ADRES); A.ara("...") -> [{ad, alt, ilce, ll}] */
(function () {
  "use strict";
  const kucuk = (t) => String(t).toLocaleLowerCase("tr-TR").normalize("NFC");
  const KISA = { sk: "sokak", sok: "sokak", sokağı: "sokak", sokagi: "sokak", cd: "cadde", cad: "cadde", caddesi: "cadde", mah: "mahalle", mh: "mahalle",
    mahallesi: "mahalle", blv: "bulvar", bulv: "bulvar", bulvarı: "bulvar", bul: "bulvar", bulvari: "bulvar", meydanı: "meydan", yolu: "yol", çıkmazı: "çıkmaz",
    apt: "", no: "", kat: "", daire: "", d: "" };
  const TUR = new Set(["sokak", "cadde", "mahalle", "bulvar", "meydan", "yol", "çıkmaz"]);
  const parca = (t) => kucuk(t).replace(/[.,/()\-]+/g, " ").split(/\s+/).filter(Boolean).map((w) => { w = w.replace(/^(\d+)\.?$/, "$1"); return KISA[w] ?? w; }).filter(Boolean);
  function km(a, b) {
    const R = Math.PI / 180, dl = (b[0] - a[0]) * R, dn = (b[1] - a[1]) * R;
    const d = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dn / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(d));
  }
  function create(A) {
    if (!A || !A.s) return null;
    const M = A.m, I = A.i;
    const X = A.s.map(([n, la, lo, mi, ii]) => ({ ad: n, ll: [la, lo], ilce: ii >= 0 ? I[ii] : "", mah: mi >= 0 ? M[mi][0] : "", t: parca(n),
      c: parca((mi >= 0 ? M[mi][0] : "") + " " + (ii >= 0 ? I[ii] : "")) }))
      .concat(M.map(([n, la, lo, ii]) => ({ ad: n, ll: [la, lo], ilce: ii >= 0 ? I[ii] : "", mah: "", t: parca(n), c: parca(ii >= 0 ? I[ii] : ""), mahalle: true })));
    function ara(q, enFazla = 6) {
      const qt = parca(q);
      if (!qt.length) return [];
      const qw = qt.filter((w) => !TUR.has(w) && !/^\d+$/.test(w));
      const capa = X.filter((e) => e.mahalle && e.t.some((x) => !TUR.has(x) && qw.includes(x)));
      const out = [];
      for (const e of X) {
        let sc = 0, cekirdek = 0;
        const hepsi = e.t.concat(e.c);
        for (const w of qt) {
          if (e.t.includes(w)) { sc += TUR.has(w) ? 1 : 4; if (!TUR.has(w)) cekirdek++; }
          else if (e.c.includes(w)) sc += 2;
          else if (w.length >= 3 && !/^\d+$/.test(w) && hepsi.some((x) => x.startsWith(w))) { sc += 1.5; if (e.t.some((x) => x.startsWith(w))) cekirdek++; }
          else if (/^\d+$/.test(w)) sc -= 3;
        }
        let yakin = null;
        if (capa.length && !e.mahalle) { let dk = 1e9; for (const a of capa) { const d = km(a.ll, e.ll); if (d < dk) { dk = d; yakin = a; } } sc += 4 * Math.exp(-dk / 0.8); if (dk > 1.5) yakin = null; }
        for (const x of e.t) if (/^\d+$/.test(x) && !qt.includes(x)) sc -= 2.5;
        if (e.mahalle && qw.length && qw.every((w) => e.t.includes(w) || e.c.includes(w))) sc += 3;
        if (cekirdek > 0 && sc > 0) {
          const alt = e.mahalle ? e.ilce : yakin ? `${yakin.ad.replace(" Mahallesi", "")} yakını, ${e.ilce}` : [e.mah, e.ilce].filter(Boolean).join(", ");
          out.push({ ad: e.ad, alt, ilce: e.ilce, ll: e.ll, mahalle: !!e.mahalle, sc: sc - (e.mahalle ? 0.5 : 0) - e.t.length * 0.05 });
        }
      }
      out.sort((a, b) => b.sc - a.sc);
      return out.slice(0, enFazla);
    }
    return { ara, km };
  }
  window.KapidaAdres = { create };
})();
