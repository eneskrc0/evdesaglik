"""Tanıtım sitesini tek dosyaya derler: kaynak.html içindeki img/… ve fontlar/… adreslerini data: URI olarak gömer.
Çıktı: site/dist/index.html (anindasaglik.com'un kökü; Worker bunu GitHub main'den akıtır).
Çalıştır: python site/build_site.py"""
import base64
import re
from pathlib import Path

KOK = Path(__file__).resolve().parent
TUR = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2"}


def gom(m):
    yol = KOK / m.group(2)
    if not yol.exists():
        raise SystemExit(f"yok: {yol}")
    veri = base64.b64encode(yol.read_bytes()).decode()
    return f'{m.group(1)}data:{TUR[yol.suffix]};base64,{veri}'


def main():
    html = (KOK / "kaynak.html").read_text(encoding="utf-8")
    html = re.sub(r'(src="|url\()((?:img|fontlar)/[^")]+)', gom, html)
    (KOK / "dist").mkdir(exist_ok=True)
    cikti = KOK / "dist" / "index.html"
    cikti.write_text(html, encoding="utf-8")
    print(f"{cikti} ({cikti.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
