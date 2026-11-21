"""Web sayfalarını tek HTML dosyasında birleştirir.

Çalıştır:  python web/build_web.py
  -> web/dist/index.html   (veritabanı test prototipi: template.html + app.js)
  -> web/dist/kapida.html  (hasta + sağlık çalışanı uygulaması: kapida.html + istemler.js + sunucu.js + dogrulama.js + kapida.js)
  -> sunucu/worker.js      (Cloudflare Worker: worker_sablon.js + istemler.js + hizmet listesi)
(önce: python data/build_db.py && python web/export_json.py)
"""
import json
from pathlib import Path

WEB = Path(__file__).resolve().parent
SUNUCU = WEB.parent / "sunucu"
PAGES = [("template.html", "app.js", "index.html"), ("kapida.html", "kapida.js", "kapida.html")]


def build(template: str, app: str, out_name: str) -> Path:
    html = (WEB / template).read_text(encoding="utf-8")
    data = (WEB / "data.json").read_text(encoding="utf-8").replace("</", "<\\/")
    html = html.replace("/*__DATA__*/", "window.EVDE_DATA = " + data + ";")
    html = html.replace("/*__CORE__*/", (WEB / "core.js").read_text(encoding="utf-8"))
    if "/*__ISTEMLER__*/" in html:
        html = html.replace("/*__ISTEMLER__*/", (WEB / "istemler.js").read_text(encoding="utf-8"))
    if "/*__SUNUCU__*/" in html:
        adres = (SUNUCU / "adres.txt").read_text(encoding="utf-8").strip() if (SUNUCU / "adres.txt").exists() else ""
        html = html.replace("/*__SUNUCU__*/", "window.KAPIDA_SUNUCU = " + json.dumps(adres) + ";\n" + (WEB / "sunucu.js").read_text(encoding="utf-8"))
    if "/*__HARITA__*/" in html:
        hp = WEB.parent / "data" / "seed" / "harita_izmir.json"
        veri = hp.read_text(encoding="utf-8") if hp.exists() else "null"
        html = html.replace("/*__HARITA__*/", "window.KAPIDA_HARITA = " + veri + ";\n" + (WEB / "harita.js").read_text(encoding="utf-8"))
    if "/*__TEKLIF__*/" in html:  # Enes'in eğitilmiş bildirim modeli (enes/ doğruluk kaynağı) + teklif katmanı
        mp = WEB.parents[1] / "enes" / "data" / "izmir" / "model_v5_demo_lr.json"
        model = mp.read_text(encoding="utf-8") if mp.exists() else "null"
        html = html.replace("/*__TEKLIF__*/", "window.KAPIDA_MODEL = " + model + ";\n" + (WEB / "teklif.js").read_text(encoding="utf-8"))
    if "/*__DOGRULAMA__*/" in html:
        html = html.replace("/*__DOGRULAMA__*/", (WEB / "dogrulama.js").read_text(encoding="utf-8"))
    if "/*__GUVENLIK__*/" in html:
        html = html.replace("/*__GUVENLIK__*/", (WEB / "guvenlik.js").read_text(encoding="utf-8"))
    if "/*__SESLI__*/" in html:
        html = html.replace("/*__SESLI__*/", (WEB / "sesli.js").read_text(encoding="utf-8"))
    if "/*__GORUNTULU__*/" in html:
        html = html.replace("/*__GORUNTULU__*/", (WEB / "goruntulu.js").read_text(encoding="utf-8"))
    if "/*__DENETIM__*/" in html:
        html = html.replace("/*__DENETIM__*/", (WEB / "denetim.js").read_text(encoding="utf-8"))
    if "/*__TOPLU__*/" in html:  # Enes'in toplu taşıma ağı (GTFS; enes/sim/build_transit.py) — yolculuk planı için
        tp = WEB.parents[1] / "enes" / "web" / "transit_izmir.json"
        html = html.replace("/*__TOPLU__*/", "window.KAPIDA_TOPLU = " + (tp.read_text(encoding="utf-8") if tp.exists() else "null") + ";\n" + (WEB / "toplu.js").read_text(encoding="utf-8"))
    if "/*__ADRES__*/" in html:  # Enes'in çevrimdışı adres verisi (OSM; enes/sim/build_adres.py)
        ap = WEB.parents[1] / "enes" / "web" / "adres_izmir.json"
        html = html.replace("/*__ADRES__*/", "window.KAPIDA_ADRES = " + (ap.read_text(encoding="utf-8").replace("</", "<\\/") if ap.exists() else "null") + ";\n" + (WEB / "adres.js").read_text(encoding="utf-8"))
    html = html.replace("/*__APP__*/", (WEB / app).read_text(encoding="utf-8"))
    out = WEB / "dist" / out_name
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out} ({out.stat().st_size // 1024} KB)")
    return out


def build_worker() -> Path:
    """sunucu/worker_sablon.js + istemler.js + hizmet listesi -> sunucu/worker.js (Cloudflare'e yapıştırılan dosya)."""
    src = (SUNUCU / "worker_sablon.js").read_text(encoding="utf-8")
    data = json.loads((WEB / "data.json").read_text(encoding="utf-8"))
    hizmetler = "\n".join(f"{s['code']}: {s['name_tr']}" for s in data["services"])
    istem = (WEB / "istemler.js").read_text(encoding="utf-8")
    src = src.replace("/*__ISTEMLER__*/", istem + "\nconst { SOHBET_KURALLARI, RAPOR_SABLONU, raporIstemi, SES_IPUCU } = globalThis.KAPIDA_ISTEMLER;")
    src = src.replace('/*__HIZMETLER__*/""', json.dumps(hizmetler, ensure_ascii=False))
    src = src.replace("/* Kapıda — küçük sunucu", "/* ÜRETİLDİ — elle düzenleme. Kapıda — küçük sunucu", 1)
    # Canlı ayar dosyası: sunucu bunu GitHub main'den her dakika okur (Cloudflare'e yapıştırmadan güncelleme)
    import hashlib, subprocess
    node = subprocess.run(["node", "-e", "const I=require(process.argv[1]);process.stdout.write(JSON.stringify({s:I.SOHBET_KURALLARI,r:I.RAPOR_SABLONU,i:I.SES_IPUCU}))", str(WEB / "istemler.js")], capture_output=True, text=True, check=True)
    ist = json.loads(node.stdout)
    ayar = {"sohbet_kurallari": ist["s"], "rapor_sablonu": ist["r"], "ses_ipucu": ist["i"], "hizmetler": hizmetler,
            "modeller": {"MODEL": "openai/gpt-oss-120b", "GORSEL_MODEL": "qwen/qwen3.8-27b", "SES_MODEL": "whisper-large-v3", "YEDEK": ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]}}
    ayar = {"surum": hashlib.sha1(json.dumps(ayar, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:8], **ayar}
    (SUNUCU / "ayar.json").write_text(json.dumps(ayar, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{SUNUCU / 'ayar.json'} (sürüm {ayar['surum']})")
    out = SUNUCU / "worker.js"
    out.write_text(src, encoding="utf-8")
    print(f"{out} ({out.stat().st_size // 1024} KB)")
    return out


if __name__ == "__main__":
    for t, a, o in PAGES:
        build(t, a, o)
    build_worker()
