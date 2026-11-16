"""Web sayfalarını tek HTML dosyasında birleştirir.

Çalıştır:  python web/build_web.py
  -> web/dist/index.html   (veritabanı test prototipi: template.html + app.js)
  -> web/dist/kapida.html  (hasta + sağlık çalışanı uygulaması: kapida.html + kapida.js)
(önce: python data/build_db.py && python web/export_json.py)
"""
from pathlib import Path

WEB = Path(__file__).resolve().parent
PAGES = [("template.html", "app.js", "index.html"), ("kapida.html", "kapida.js", "kapida.html")]


def build(template: str, app: str, out_name: str) -> Path:
    html = (WEB / template).read_text(encoding="utf-8")
    data = (WEB / "data.json").read_text(encoding="utf-8").replace("</", "<\\/")
    html = html.replace("/*__DATA__*/", "window.EVDE_DATA = " + data + ";")
    html = html.replace("/*__CORE__*/", (WEB / "core.js").read_text(encoding="utf-8"))
    html = html.replace("/*__APP__*/", (WEB / app).read_text(encoding="utf-8"))
    out = WEB / "dist" / out_name
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out} ({out.stat().st_size // 1024} KB)")
    return out


if __name__ == "__main__":
    for t, a, o in PAGES:
        build(t, a, o)
