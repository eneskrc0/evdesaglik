"""Tek dosyalık demo sayfaları üretir.
web/index.html + web/roads_<dünya>.json + results/[<dünya>/]ilerleme.json -> web/dist/<dünya>.html
Kullanım: python web/build.py            (bornova ve izmir)
"""
from pathlib import Path
d = Path(__file__).parent
html = (d / "index.html").read_text()
assert "/*ROADS_JSON*/null" in html and "/*PROGRESS_JSON*/null" in html and "/*HOSP_JSON*/null" in html and "/*GRAPH_JSON*/null" in html
hf = d / "hospitals.json"
hosp = hf.read_text() if hf.exists() else "null"
(d / "dist").mkdir(exist_ok=True)
for world, res in [("bornova", d.parent / "results"), ("izmir", d.parent / "results" / "izmir_tam")]:
    rf = d / f"roads_{world}.json"
    if not rf.exists():
        continue
    pf = res / "ilerleme.json"
    prog = pf.read_text().replace("NaN", "null") if pf.exists() else "null"
    gf = d / f"graph_{world}.json"
    graph = gf.read_text() if gf.exists() else "null"
    # İzmir sayfası tüm meslek kataloğuyla (izmir_tam); Bornova eski iki hizmetle
    cat = (d.parent / "data" / "hizmet_katalogu.json").read_text() if world == "izmir" else "null"
    tf = d / "transit_izmir.json"  # GTFS toplu taşıma ağı (sim/build_transit.py), yalnız İzmir
    transit = tf.read_text() if (world == "izmir" and tf.exists()) else "null"
    af = d / "adres_izmir.json"  # OSM sokak/mahalle adları (sim/build_adres.py), yalnız İzmir
    adres = af.read_text() if (world == "izmir" and af.exists()) else "null"
    mf = d / "transit_mat_izmir.json"  # hazır toplu taşıma süre matrisi (sim/build_transit.write_mat)
    tmat = mf.read_text() if (world == "izmir" and mf.exists()) else "null"
    parts = {"TRANSIT_MAT": tmat, "ROADS": rf.read_text(), "PROGRESS": prog, "HOSP": hosp, "GRAPH": graph, "CATALOG": cat, "TRANSIT": transit, "ADRES": adres}
    out = d / "dist" / f"{world}.html"
    one = html
    for k, v in parts.items():
        one = one.replace(f"/*{k}_JSON*/null", v)
    out.write_text(one)
    print(out, round(out.stat().st_size / 1e6, 2), "MB")
    # Klasörlü sürüm (yayın için): büyük veriler ayrı .js dosyalarında, sayfa hafif kalır.
    site = d / "dist" / f"{world}_site"
    (site / "veri").mkdir(parents=True, exist_ok=True)
    page, tags = html, []
    for k, v in parts.items():
        if v == "null" or len(v) < 50_000:
            page = page.replace(f"/*{k}_JSON*/null", v)
            continue
        (site / "veri" / f"{k.lower()}.js").write_text(f"window.__VERI_{k}={v};")
        tags.append(f'<script src="veri/{k.lower()}.js"></script>')
        page = page.replace(f"/*{k}_JSON*/null", f"(window.__VERI_{k}||null)")
    i = page.index("<script")
    page = page[:i] + "\n".join(tags) + "\n" + page[i:]
    (site / "index.html").write_text(page)
    print(site, "index", round((site / "index.html").stat().st_size / 1e6, 2), "MB +", len(tags), "veri dosyası")
