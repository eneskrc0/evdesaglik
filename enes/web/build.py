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
    out = d / "dist" / f"{world}.html"
    out.write_text(html.replace("/*ROADS_JSON*/null", rf.read_text()).replace("/*PROGRESS_JSON*/null", prog).replace("/*HOSP_JSON*/null", hosp).replace("/*GRAPH_JSON*/null", graph).replace("/*CATALOG_JSON*/null", cat))
    print(out, round(out.stat().st_size / 1e6, 2), "MB")
