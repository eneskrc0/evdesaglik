# CLAUDE.md — Evde sağlık anlık teklif ve eşleştirme (Gazi AI Tech 2026)

## Proje
Bornova'da planlı evde sağlık ziyareti (pansuman / doktor) isteyen hastaları,
ücret + varış saati teklifi veren hemşire/doktorlarla eşleştiren platformun
simülasyonu ve prototipi. Araştırma sorusu: "Yalnızca 3 kişiye bildirim
gönderebiliyorsak, hastanın 5 dk içinde saatine ve bütçesine uygun teklif alma
olasılığını nasıl artırırız?"

## Yapı
- `sim/geo.py` — konum havuzu (gerçek yol düğümleri), H3 (res 8) hücreleri, yol süresi (`travel_minutes`: OSM en kısa rota × trafik katsayısı).
- `sim/build_roads.py` — graphml + sınırdan `data/pool.npz` ve `web/roads.json` üretir.
- `web/index.html` — demo + deney sayfası (JS motoru Python ile aynı mantık); `web/build.py` tek dosya üretir.
- `sim/world.py` — senaryolar, sentetik çalışanlar ve talepler.
- `sim/engine.py` — olay tabanlı gün simülatörü, bildirim yöntemleri, atomik kabul.
- `sim/experiment.py` — model eğitimi + üç yöntem karşılaştırması, çok tohumlu sonuçlar.
- `sim/plot.py` — grafik. `tests/` — tutarlılık testleri.

## Kurallar
- Eşleştirme/sıralama kodu demo ve simülasyonda **aynı** fonksiyon olacak (`engine.rank`, `engine.candidates`).
- Kabul işlemi atomik: kabul anında çalışanın takvimi yeniden kontrol edilir; çakışma varsa teklif geçersiz.
- Model yalnızca karar anında bilinen bilgileri görür (`engine.features`). Gelecekten bilgi sızdırma yok.
- Çalışan davranışı (tohum, gün, talep, çalışan) anahtarlı RNG ile üretilir; yöntemler arasında ortak rastgele sayılar korunur.
- Eğitim günleri (rastgele bildirim, keşif verisi) ile test günleri ayrıdır.
- Yeni metrik/senaryo eklerken `tests/` çalıştır: `python -m pytest -q tests`.
- Ücretler temsilidir; tüm veriler sentetiktir.

## Model gelişim protokolü (değiştirme)
- Referans: `results/runs/001_referans` (geliştirme, tohum 0–9) ve `002_referans_holdout` (ayrılmış, tohum 1000–1009). `results/baseline.json` dondurulmuştur.
- Her model denemesi: `sim/models.py`'ye **yeni isimle** fonksiyon ekle (eskileri değiştirme), sonra
  `python -m sim.track run --name <kısa_ad> --model <isim> --note "<ne değişti>"`.
- Yeni özellik gerekiyorsa mevcut `engine.features`'ı değiştirme; sürümlü yeni bir özellik fonksiyonu ekle.
- Simülasyon dünyası (world/engine dinamiği, geo, pool.npz) değişirse sezgisel yöntem sonuçları referanstan sapar,
  rapor kaydı "ortam değişti" diye işaretler; o zaman yeni referans gerekir (`--force`) ve bu açıkça not edilir.
- Ayrılmış tohumlar yalnızca dönüm noktalarında (sunum öncesi) çalıştırılır.
- Ana metrik: baz senaryoda 5 dk içinde uygun teklif oranı. Koruma metrikleri: zamanında ziyaret düşmemeli, Gini raporlanmalı.

## Dünyalar
- `DUNYA=bornova` (varsayılan, pilot): data/bornova/, sonuçlar results/
- `DUNYA=izmir` (merkez 11 ilçe): data/izmir/, sonuçlar results/izmir/. Talep ve çalışan konumları ilçe nüfusuna göre
  (geo.DISTRICT_POP, TÜİK). Ölçek: 260 hemşire, 100 doktor, 450 talep/gün (world.SCALE, varsayım).
- Her dünyanın kendi referansı var; dünyalar arası kayıtlar karıştırılmaz.
- İzmir verisi: `python -m sim.build_izmir --n 1200` (girdi: data/izmir/ag.npz, ilceler.geojson, anayollar.geojson).
- Sunum cümlesi: "Önce Bornova'da denedik, model 100 hastada 58 yerine 87 hastayı eşleştirdi. Sonra şehrin 11 ilçesine
  genişlettik ve sonucun ölçek büyüyünce de tutup tutmadığına baktık."

## Sürümler (v1 → v5) — tamamlandı (2026-11-14)
Model + karar kuralları: sim/models.py (v2_adil, v3_garanti, v4_mesafe, v5_denge), kurallar sim/engine.select_with_policy.
- v1 gbm_v1 (referans) · v2 + yük cezası (b=0.08 bildirim, c=0.1 ziyaret) · v3 + başarı garantisi alpha=0.95
- v4 + yol cezası a=0.7 · v5 gbm_v3 + a=0.6, b=0.06, c=0.15, alpha=0.95 (en dengeli; seçilen sürüm)
- Üst sınırlar (EK_YONTEM=kahin,bilge): "bilge" gerçek olasılıkları bilen seçim, "kahin" sonucu önceden bilen seçim.
- Baz senaryo, 5 dk uygun teklif: Bornova v1 87,3 / v5 86,3 / bilge 88,7 / kahin 94,7 / klasik 58;
  İzmir v1 88,8 / v5 87,8 / bilge 89,4 / kahin 94,2 / klasik 56. Ayrılmış tohumlarda da tutarlı.
- v5, v1'e göre: hemşire kazanç Gini 0,75→0,63 (İzmir), iş alamayan hemşire-gün %66→%50, yol 13,6→12,8 dk,
  zamanında ziyaret %91,4→%91,8; başarı bedeli ~1 puan.
- Önceki hedef (kazanç Gini ≤ 0,40) ulaşılamaz: en yüksek başarıyı veren 'bilge' bile 0,70–0,75; klasik yöntemler 0,35
  ama başarı 56–58. Bu bir denge sorusu.

## Komutlar
```
pip install -r requirements.txt
python -m sim.experiment --seeds 10            # tüm senaryolar (~3 dk)
python -m sim.plot results
python -m sim.track report       # results/ilerleme.md / .png / .json
DUNYA=izmir python -m sim.track run --name ... --model ...   # İzmir dünyası
DUNYA=izmir python -m sim.plot_districts                    # ilçe bazlı grafik
python web/build.py              # demo sayfası (yol + ilerleme verisi gömülü)
python -m pytest -q tests
```

## Sıradaki adımlar
1. Adalet: model skoruna bildirim yükü cezası ekleyip Gini / başarı dengesini raporla.
2. Gerçek çok kullanıcılı demo (FastAPI + WebSocket): hasta ve çalışan ayrı cihazlardan.

## Hastane katmanı (v0.7)
- Kaynak: data/izmir/izmir_hastaneler.csv (OSM) → `python3 sim/build_hospitals.py` → data/izmir/hastaneler.csv, results/izmir/hastane_erisim.csv, web/hospitals.json.
- 50 hastane/tıp merkezi (13 devlet, 4 devlet üni., 1 belediye, 5 vakıf üni., 18 özel, 9 özel tıp merkezi); diş klinikleri, laboratuvar, kabin vb. 11 kayıt çıkarıldı.
- Demo: haritada hastane işaretleri + "Hastaneler" düğmesi; hasta konumu seçilince en yakın hastane ve en yakın kamu hastanesi yol süresiyle gösterilir.
- İzmir'de dokunma noktası en yakın havuz noktasına 2 km içinde yapışır (Bornova 0.7 km).
- Doğrulanacak: Gaziemir'de listede hastane yok; Karşıyaka'da kamu hastanesi yok (OSM eksikliği olabilir).

## v0.8 notları
- Ana sonuç tablosu: `python3 sim/sonuc_tablosu.py` → results/izmir/sonuc_tablosu.csv (İzmir holdout, baz senaryo).
- `v5_demo_lr` = lojistik regresyon + v5 kuralları (demonun kullandığı bileşim); holdout: results/izmir/runs/014_v5_demo_lr_holdout.
- `tests/tutarlilik/calistir.sh`: JS ve Python v5 seçim kuralları eşitliği (2000/2000) + playwright ile uçtan uca demo provası.
- Demo: ilk turda çalışan paneli bildirim alan ilk çalışana otomatik geçer.

## v0.9 canlı takip
- `python3 sim/build_route_graph.py bornova|izmir` → web/graph_<dünya>.json (CSR, base64); build.py /*GRAPH_JSON*/ olarak gömer.
- Kabulde startTracking(): rota = Dijkstra (havuz düğümleri arası, matrisle ±1 sn), çıkış = planlanan varış − travelMin, yolculuk sonrası 3 dk park. Varış aralığı ±1.645×travelNoiseSd×kalan yol.
- tests/tutarlilik/track_test.py canlı takibi dener.

## İzmir orta ölçek (2026-11-16) — güncel ana dünya
- `DUNYA=izmir OLCEK=orta` → sonuçlar results/izmir_orta/. Ölçek: 80 hemşire, 25 doktor, 20 fizyoterapist, 155 talep/gün
  (world.SCALE["izmir_orta"]; hizmet karışımı pansuman %60 / doktor %25 / fizyoterapi %15; fizyoterapi 60 dk, 1200 TL temsili).
- Eski dünyalar birebir aynı (fizyoterapist yoksa RNG sırası değişmez; kontrol: izmir tohum 0 sonuçları aynı).
- Hızlı arama: `python -m sim.search_orta` (yalnızca baz, tohum 0–9) → results/izmir_orta/arama_ozet.csv; grafik `python sim/plot_kota.py`.
- Seçilen: `v5_kota5` = v5 kuralları + sert günlük ziyaret kotası 5 (models.policy_capped). Seçim kuralı: v1'e göre en fazla ~1 puan
  başarı kaybıyla en düşük yük/eşitsizlik. Kota 4 → −2 puan; kota 6 → yük azalması küçük.
- Sonuçlar (baz, geliştirme / ayrılmış): kural 52,4 / 51,6 · v1 72,7 / 71,5 · v5 72,3 / 70,6 · v5_kota5 71,7 / 70,1 (5 dk uygun %).
  v5_kota5 v1'e göre: günlük en fazla iş 8,9→5,1, kazanç Gini 0,63→0,55, bildirim Gini 0,46→0,35, iş alamayan hemşire-gün %57→%48.
- Orta ölçekte başarı büyük ölçekten düşük (72 vs 88): çalışan yoğunluğu az, yakında aday az.
- Demo (izmir.html) bu ölçekte: fizyoterapist dahil. Harita görünümleri: Genel / Hasta gözüyle / Çalışan gözüyle (viewSeg).
