# Evde Sağlık Eşleştirme — Gazi AI Tech 2026

Ortak proje deposu. Her ekip üyesi kendi klasöründe çalışır.

| Klasör | Kim | İçerik |
|---|---|---|
| [`enes/`](enes/) | Enes | Simülasyon, yapay zekâ modelleri (v1–v5), deney sonuçları, demo sayfaları (canlı takip, hastane katmanı) |
| [`ortak/`](ortak/) | Ortak | **Birleşik demo**: triyaj → YZ bildirim → YZ fiyat önerisi → teklif (profil + paylaşım indirimi) → canlı takip, İzmir haritasında |
| [`efehan/`](efehan/) | Efehan | Hasta asistanı: YZ sohbeti ve kırmızı bayrak triyajı, kaynaklı veritabanı, ziyaret paylaşımı, hasta/çalışan arayüzü (Kapıda) |

**Birleşik demo:** `ortak/dist/izmir.html`. Ayrıntılar: [ortak/README.md](ortak/README.md).

Demoyu açmak için: `enes/web/dist/bornova.html` veya `enes/web/dist/izmir.html` dosyasını indirip tarayıcıda açın.
Ayrıntılar: [enes/README.md](enes/README.md).

Hasta/çalışan arayüzü için: `efehan/web/dist/kapida.html`. Ayrıntılar: [efehan/README.md](efehan/README.md).

**Tüm demolar tek sayfada:** kökteki `index.html` (GitHub Pages açıldığında site ana sayfası).

GitHub'ı nasıl kullanacağımız: [GITHUB_KULLANIMI.md](GITHUB_KULLANIMI.md).

Yeni bir ekip üyesi kendi klasörünü (ör. `app/` veya kendi adı) açıp çalışmalarını oraya koyar.

## Ekip kararları (16.11.2026)
- Şehir: İzmir (gerçek yol ağı). Efehan'ın Ankara verisi yalnızca kendi prototipinde kalır.
- Fiyat: karma, yapay zekâ önde. YZ fiyat önerir, çalışan önerinin ±%10'u içinde teklif verir. Ziyaret paylaşımı indirimi hastaya yansır.
- İsim: şimdilik karar yok (Kapıda / Vizit).
- Birleşik demo: ortak/ (python3 ortak/build.py).
