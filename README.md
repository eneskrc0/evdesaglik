# Evde Sağlık Eşleştirme — Gazi AI Tech 2026

Ortak proje deposu. Her ekip üyesi kendi klasöründe çalışır.

| Klasör | Kim | İçerik |
|---|---|---|
| [`enes/`](enes/) | Enes | Simülasyon, yapay zekâ modelleri (v1–v5), deney sonuçları, demo sayfaları (canlı takip, hastane katmanı) |
| [`efehan/`](efehan/) | Efehan | **Kapıda** — tek uygulama: YZ sohbeti ve kırmızı bayrak triyajı, kaynaklı veritabanı, ziyaret paylaşımı, YZ teklif akışı, canlı takip, Güvenli Ziyaret, hasta/çalışan arayüzü |
| [`ortak/`](ortak/) | — | Arşiv: Kapıda'dan önceki geçici birleşik demo |

**Uygulama:** `efehan/web/dist/kapida.html`. Ayrıntılar: [efehan/README.md](efehan/README.md), [efehan/CLAUDE.md](efehan/CLAUDE.md).

**Simülasyon ve deney (kanıt):** `enes/web/dist/izmir_site/index.html` (hafif, veriler ayrı dosyalarda) ya da tek dosya
`enes/web/dist/izmir.html`. Ayrıntılar: [enes/README.md](enes/README.md), [enes/CLAUDE.md](enes/CLAUDE.md).

## Birleşme: Kapıda ↔ simülasyon (20.11.2026)
Ortak kod kopyalanmaz; Kapıda enes/'in ürettiği dosyaları derlenirken okur (enes/ doğruluk kaynağı):

| enes/ dosyası | Kapıda'da | Okuyan |
|---|---|---|
| `data/izmir/model_v5_demo_lr.json` | "kime bildirim gidecek" (12 özellik, v5 kuralı, 3 kişi + 2. tur) | `efehan/web/build_web.py` → teklif.js |
| `data/izmir/pool_orta.npz`, `transit_orta.npz` | araba (OSM × TomTom) ve toplu taşıma süreleri, 240 nokta | `efehan/data/build_izmir.py` → izmir_yol.json |
| `web/roads_izmir.json`, `graph_izmir.json`, `hospitals.json` | harita, sokak rotası, en yakın acil | `efehan/data/build_izmir.py` |
| `web/transit_izmir.json` | toplu taşıma yolculuk planı (canlı takip) | `build_web.py` → toplu.js |
| `web/adres_izmir.json` | adres arama | `build_web.py` → adres.js |

Tutarlılık testleri: `python efehan/web/model_parity.py` (model, özellikler, v5 seçimi JS = Python), `python efehan/web/e2e_toplu.py`
(toplu taşıma süresi JS = Python, adres, yolculuk planı), `python efehan/web/parity_test.py`, `sh enes/tests/tutarlilik/calistir.sh`.
enes/ verisi değişince: `python efehan/data/build_izmir.py && python efehan/data/build_db.py && python efehan/web/export_json.py && python efehan/web/build_web.py`.

**Tüm demolar tek sayfada:** kökteki `index.html` (GitHub Pages açıldığında site ana sayfası).

GitHub'ı nasıl kullanacağımız: [GITHUB_KULLANIMI.md](GITHUB_KULLANIMI.md).

Yeni bir ekip üyesi kendi klasörünü (ör. `app/` veya kendi adı) açıp çalışmalarını oraya koyar.

## Ekip kararları (16.11.2026)
- Şehir: İzmir (gerçek yol ağı). Efehan'ın Ankara verisi yalnızca kendi prototipinde kalır.
- Fiyat: karma, yapay zekâ önde. YZ fiyat önerir, çalışan önerinin ±%10'u içinde teklif verir. Ziyaret paylaşımı indirimi hastaya yansır.
- İsim: şimdilik karar yok (Kapıda / Vizit).
- Birleşik demo: Kapıda (efehan/). ortak/ arşivlendi (20.11).
