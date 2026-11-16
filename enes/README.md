# Evde Sağlık Anlık Teklif ve Eşleştirme — Simülasyon (v0.9)

Gazi AI Tech 2026 projesi. Hasta hizmeti, 60 dakikalık zaman aralığını ve (isteğe bağlı) bütçesini girer. Hemşire veya doktorlar fiyat ve varış saatiyle teklif verir. Yapay zekâ ilk bildirimin hangi 3 çalışana gideceğini seçer. Uygun teklif gelmezse 5 dakika sonra sıradaki 3 kişiye ikinci tur bildirim gider.

## Demoyu açmak (ilk önce bunu yapın)

ZIP'i çıkarın ve şu dosyalardan birini tarayıcıda açın (internet gerekmez):

| Dosya | İçerik |
|---|---|
| `web/dist/bornova.html` | Pilot bölge Bornova: demo, deney seti, model gelişimi |
| `web/dist/izmir.html` | Merkez İzmir'in 11 ilçesi, hastane katmanı dahil |

**Jüri provası (tek bilgisayar):**
1. Haritada bir noktaya dokunun. "Konum seçildi ✓" yazısı ve en yakın hastane kutusu çıkar.
2. Hizmeti seçip **Talep aç**'a basın. Sağda yapay zekânın sıraladığı adaylar görünür.
3. Çalışan paneli otomatik olarak bildirim alan ilk çalışana geçer. Fiyat ve saati seçip **Teklif ver**'e basın.
4. Hasta panelinde bu teklifte **Kabul et**'e basın. Ziyaret kesinleşir ve çalışanın "Bugünkü takvim" bölümüne eklenir.
5. **Canlı takip** kartı açılır: çalışan haritada gerçek sokaklar üzerinden hastaya ilerler. Kart kalan dakikayı, kalan km'yi, tahmini varış saatini ve muhtemel varış aralığını gösterir (Kabul edildi → Yolda → Yaklaşıyor → Kapıda → Ziyaret). Hızlı izlemek için saati "4 dk/sn" yapın.

Konum seçilince "bu konuma şu an en erken kaç dakikada hemşire/doktor gelebilir" bilgisi de çıkar.

Bu akış `tests/tutarlilik/e2e.py` ile otomatik olarak da denenir.

## Ana sonuç (tek tablo)

İzmir, geliştirme sırasında hiç kullanılmamış 10 ayrı tohum (= 10 farklı rastgele şehir/gün dizisi, her biri 10 test günü), baz senaryo. Tablo: `results/izmir/sonuc_tablosu.csv` (`python3 sim/sonuc_tablosu.py`).

| Ölçüt | En erken varış kuralı | v1 | v5 (en iyi) | Demodaki model | v5 − kural (%95 GA) |
|---|---|---|---|---|---|
| 5 dk içinde uygun teklif alan hasta | 55,0% | 88,2% | 87,1% | 84,8% | +32,1 ± 0,7 puan |
| Hiç eşleşemeyen hasta | 15,2% | 7,1% | 6,7% | 7,4% | −8,5 ± 0,4 puan |
| Zamanında gerçekleşen ziyaret | 84,7% | 90,8% | 91,3% | 90,5% | +6,6 ± 0,4 puan |
| Bildirim dağılımı eşitsizliği (Gini) | 0,174 | 0,686 | 0,543 | 0,593 | +0,368 |
| Ziyaret başına yol süresi | 8,5 dk | 13,6 dk | 12,8 dk | 13,0 dk | +4,3 dk |

Bedeli açıkça yazın: model, bildirimleri yanıt verme olasılığı yüksek çalışanlara yoğunlaştırır. Bu yüzden bildirimler basit kurala göre daha eşitsiz dağılır ve yol biraz uzar. v2–v5 bu bedeli düşürmek için yapıldı (Gini 0,69 → 0,54).

## Demo ile deney aynı modeli mi kullanıyor?

- **Karar kuralları (v5): evet.** Aynı olasılıklar verildiğinde JavaScript (demo) ve Python (deney) 2000 rastgele örneğin 2000'inde aynı 3 kişiyi aynı sırayla seçti (`tests/tutarlilik/calistir.sh`).
- **Olasılık modeli: hayır, bilerek.** Deneyler gradient boosting (gbm_v3) kullanır. Demo, tarayıcıda hızlı eğitilebilen lojistik regresyon kullanır. Bu farkın etkisi tablodaki "Demodaki model" sütununda görülüyor: uygun teklif oranı 87,1% yerine 84,8%. Jüriye sunulan sayılar v5 sütunundan gelir.

## Klasörler

- `sim/`: simülasyon motoru, modeller, deney ve takip (`python3 -m sim.track run|baseline|report`). Dünya seçimi `DUNYA=bornova|izmir`.
- `data/bornova`, `data/izmir`: OpenStreetMap yol ağı, konum havuzu ve yol süresi matrisi, hastane listesi.
- `results/`: Bornova sonuçları. `results/izmir/`: İzmir sonuçları (`runs/` altında her deneme ayrı klasörde).
- `sim/build_route_graph.py`: canlı takip için yol ağını sıkıştırıp `web/graph_<dünya>.json` yazar (rota tarayıcıda hesaplanır, süreler deneydeki yol süresi tablosuyla ±1 sn tutar).
- `web/index.html`: demo şablonu. `python3 web/build.py` → `web/dist/*.html`.
- `CLAUDE.md` / `AGENTS.md`: yapay zekâ asistanları için proje kuralları ve protokol.

## Sınırlamalar

- Hasta ve çalışan davranışları sentetiktir (varsayımlarla üretilir). Gerçek trafik verisi yok; saate bağlı katsayılar kullanılır (yoğun saat ×1,8).
- Ücretler (pansuman 600 TL, doktor 1500 TL) saha görüşmelerinden sonra yeniden ayarlanmalı.
- Hastane listesi OpenStreetMap'ten geliyor. Gaziemir'de hastane, Karşıyaka'da kamu hastanesi görünmüyor; doğrulanmalı.
- Demo tek bilgisayarda çalışır. İki ayrı telefonda talep ve teklif için ortak bir sunucu gerekir.
