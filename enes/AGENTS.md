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
- Konum havuzu: data/izmir/pool_orta.npz (`python -m sim.build_izmir --n 1200 --temiz --yogunluk 30 --out pool_orta.npz`).
  Otoyol/çevre yolu 80 m yakını, yalnızca >40 km/s yola bağlı düğümler ve seyrek alanlar (250 m içinde <30 yol düğümü; bina verisi
  olmadığından yerleşim vekili) elenir. geo.py, OLCEK=orta iken bu dosyayı okur. Eski havuzla alınan sonuçlar: results/izmir_orta_eski_havuz/.
  Hastane ve rota ağı da bu havuzla: `OLCEK=orta python sim/build_hospitals.py`, `OLCEK=orta python sim/build_route_graph.py izmir`.
- Eski dünyalar (bornova, izmir büyük) birebir aynı (fizyoterapist yoksa RNG sırası değişmez).
- Hızlı arama: `python -m sim.search_orta` (yalnızca baz, tohum 0–9) → results/izmir_orta/arama_ozet.csv; grafik `python sim/plot_kota.py`.
- Seçilen: `v5_kota5_ayarli` = gbm_v3 + a=0.9, b=0.03, c=0.08, alpha=0.95 + sert günlük ziyaret kotası 5.
  Seçim kuralı: v1'e göre en fazla ~1 puan başarı kaybıyla en düşük yük (günlük en fazla iş) ve kısa yol.
- Sonuçlar, baz senaryo (geliştirme / ayrılmış), 5 dk uygun %: kural 53,8 / 52,4 · v1 76,3 / 74,0 · v5 75,1 / 73,2 ·
  v5_kota5 74,3 / 72,6 · v5_kota5_ayarli 75,3 / 73,1. Ayrılmış: ayarlı − kural +20,7 ± 1,1 puan; ayarlı − v1 −0,9 ± 0,4.
  Ayarlı, v1'e göre: günlük en fazla iş 8,6→5,2, kazanç Gini 0,65→0,57, bildirim Gini 0,48→0,39, yol 12,95→12,32 dk.
- Orta ölçekte başarı büyük ölçekten düşük (75 vs 88): çalışan yoğunluğu az, yakında aday az.
- Demo (izmir.html) bu ölçek ve havuzla: fizyoterapist dahil; harita görünümleri Genel / Hasta gözüyle / Çalışan gözüyle;
  yakınlaştırma/kaydırma (tekerlek, iki parmak, sürükleme, +/−/⤢).

## Dayanıklılık testi (2026-11-16)
- `python -m sim.duyarlilik` (OLCEK=orta havuzu, baz, tohum 0–9): çalışan 0,5/1/2 × orta (40–160 hemşire), talep/çalışan 0,8/1,25/2,0.
  Sonuç results/izmir_orta/duyarlilik.csv, grafik `python sim/plot_duyarlilik.py` → duyarlilik.png.
- Yapay zekâ − kural: küçük ekip +13–14, orta +21, büyük +26–27 puan (her hücrede). Başarıyı en çok çalışan sayısı belirliyor
  (v1: küçük ~63, orta ~76, büyük ~83); talep yoğunluğu 2–4 puan etkiliyor.
- En iyi sabit kota talebe bağlı: sakin 4, normal 5, yoğun 6–8. Uyarlanır kota `v5_ukota_ayarli`
  (vc="auto": round(2,5 + 2 × beklenen talep/çalışan); engine.notify) 9 hücrenin ortalamasında v1'e göre −1,1 puan (sabit kota 5: −1,4),
  günlük en fazla işi 5,5–12,4'ten 4,0–6,9'a indiriyor. Yoğun-büyük hücrede kayıp en yüksek (−2,4).
- Önerilen ürün kuralı: uyarlanır kota (sabit 5 yerine). Ayrılmış tohumlarla henüz doğrulanmadı.

## İzmir tam meslek dünyası (2026-11-17) — güncel ana dünya
- `DUNYA=izmir OLCEK=tam` → results/izmir_tam/. Havuz: pool_orta.npz (geo._POOL_TAG). 9 meslek, 155 çalışan: hemşire 80, doktor 25,
  fizyoterapist 20, klinik psikolog 8, dil-konuşma 6, diyetisyen 6, ergoterapist 4, odyolog 3, podolog 3; 195 talep/gün.
- Hizmetler: data/hizmet_katalogu.json (Efehan'ın kataloğundan 20 ev hizmeti; tele_muayene ve reçete hariç; ebe → hemşire, uzman hekim → doktor).
  Talep payı = meslek kadro payı, meslek içinde hizmetler eşit (world.SERVICE_MIX). Ücret ve süreler katalogdan.
- Genişleyen arama (world.Scenario.expand_search, yalnız izmir_tam): yakında 3'ten az aday varsa k-halkası 2 kat, sonra tüm şehir
  (engine.candidates expand). Nadir mesleklerde eşleşmeyi büyütür (odyolog %9 → %41), yolu uzatır.
- Yeni metrikler (tüm dünyalarda, eskiler değişmedi): calisan_* (tüm meslekler), uygun5_<meslek>; Offer.base (ücret geçmişi);
  hemşire metrikleri artık hizmete değil mesleğe göre (eski dünyalarda aynı sonuç).
- Sonuç (baz, geliştirme / ayrılmış), 5 dk uygun %: kural 55,9 / 53,7 · v1 76,6 / 74,2 · v5 76,0 / – · seçilen v5_ukota_ayarli
  (kota bu ölçekte 5) 75,3 / 73,2. Ayrılmış: seçilen − kural +19,5 ± 1,0; seçilen − v1 −1,0 ± 0,4. Tüm çalışanlarda günlük en fazla iş
  9,2 → 5,2, kazanç Gini 0,58 → 0,55, yol 15,6 → 15,1 dk.
- Meslek bazında (ayrılmış): yapay zekâ kazancı hemşire +28, doktor +17, fizyoterapist +12, psikolog +7, dil-konuşma +7, diyetisyen +4,
  ergoterapist +2, odyolog/podolog 0 (3 kişi: herkese bildirim gidiyor, seçim yok). Nadir mesleklerde sınır kadro.
- Demo (izmir.html) bu dünyada: 20 hizmet (meslek gruplu liste), 9 meslek renkli, genişleyen arama; build.py katalogu /*CATALOG_JSON*/ ile gömer.

## Gerçekçi trafik (2026-11-17) — izmir_tam
- Eski trafik modeli İzmir için ~2 kat hızlıydı: OSM serbest akış 10 km = 9,3 dk (65 km/s) × 1,15/1,35/1,8 → 10,6–16,7 dk.
  TomTom Trafik Endeksi 2025 İzmir: ortalama 22:59, sabah zirvesi 25:38 (23,4 km/s), akşam zirvesi 34:41 (17,3 km/s), gece ~16 dk / 10 km.
- geo.congestion (yalnız izmir_tam, geo.TRAFIK_TOMTOM): saatlik "10 km kaç dk" eğrisi (_TT10_HEDEF) / 9,3; saat ortaları arası doğrusal.
  Park + bina girişi 6 dk (geo.PARK_DK; diğer dünyalar 3). Yol sapması baz %25, belirsiz_yol %45 (diğer dünyalar %15/%35).
  JS demo (izmir.html) aynı eğri, PARK=6, travelNoiseSd 0,25. Grafik: `python sim/plot_trafik.py` → results/izmir_tam/trafik.png.
- Eski trafikle alınan izmir_tam sonuçları: results/izmir_tam_eski_trafik/.
- Yeni sonuçlar (baz, geliştirme / ayrılmış), 5 dk uygun %: kural 54,6 / 52,6 · v1 74,2 / 72,1 · v5 73,3 / – ·
  v5_ukota_ayarli (a=0,9) 72,6 / 70,7 · **seçilen v5_ukota_trafik** (a=0,3, b=0,03, c=0,08, uyarlanır kota) 73,2 / 71,1.
  Ayrılmış: seçilen − kural +18,4 ± 0,7; − v1 −1,0 ± 0,4; − ayarlı +0,4 ± 0,4. Ziyaret başına yol ~27 dk (eskiden ~15).
  Günlük en fazla iş 8,2 → 5,1. Yollar uzayınca güçlü yol cezası (a=0,9) faydasını yitiriyor; a=0,3 daha iyi.
- Meslek (ayrılmış, kural → seçilen): hemşire 56→83, doktor 48→63, fizyoterapist 53→64, psikolog 50→57, dil-konuşma 49→54,
  diyetisyen 56→60, ergoterapist 45→47, odyolog 38→38, podolog 48→48.

## Toplu taşıma (2026-11-18) — izmir_tam
- Kaynak: İzmir Büyükşehir açık veri GTFS — ESHOT otobüs (eylül–ekim 2026 tarifesi, 421 hat), Metro (M1), Tramvay
  (Konak, Karşıyaka, Çiğli iç/dış, Turuncu ring), İZBAN (dosya tarihi 2022–2025, sefer yapısı kullanıldı). Hafta içi servis.
  İZDENİZ vapurları veride yok (Karşıyaka–Konak gibi yollarda toplu taşıma süresi gerçekten biraz uzun çıkabilir).
  Moovit kullanılmadı: ticari, kullanım koşulları veri çekmeyi yasaklıyor; Moovit de aynı resmi GTFS'i kullanıyor.
- `OLCEK=orta python -m sim.build_transit --gtfs <klasör>` (4 alt klasör: bus-eshot-gtfs, rail-metro-gtfs, rail-tramizmir-gtfs,
  rail-izban-gtfs) → data/izmir/transit_orta.npz (tt_d[dilim,i,j] desidakika, 4 dilim: sabah 7–10, gündüz 10–16, akşam 16–20, gece 20–23)
  ve web/transit_izmir.json (demo ağı, ~2 MB). Ham GTFS repoda yok (ESHOT stop_times 86 MB).
- Model: kapıdan kapıya = yürü (adres-durak ≤1 km, 4,5 km/s × 1,3) + bekle (sefer aralığı/2, en çok 12 dk) + 1,5 dk biniş cezası
  + araçta (o dilimdeki medyan süre; otobüs zirvede ×1,25–1,35 trafik payı) + aktarma (durak-durak ≤400 m yürüme + yeniden bekleme)
  + 2 dk bina. Yakın adreste doğrudan yürüme daha kısaysa o seçilir. Ortak sıklık (2026-11-18 gece, build_transit.ORTAK_SIKLIK):
  aynı durak → aynı sonraki durak giden tüm hatların seferleri birlikte sayılır (yolcu ilk gelene biner); gündüz medyan 72 → 62 dk,
  İZBAN beklemesi ~14 → ~6 dk. Ayrı sıklıklı sonuçlar: results/izmir_tam_ayri_siklik/.
- Sonuç (gündüz, havuz çiftleri medyanı): toplu taşıma arabanın ~2 katı (2–4 km: araba 18 / toplu 42 dk; 7–12 km: 37 / 76 dk).
  Örnek: Bornova Metro → Konak 37 dk (araba 28), Buca Şirinyer → Karşıyaka 57 dk (İZBAN), Çiğli → Gaziemir 85 dk.
- Simülasyon: Worker.mode ("araba" | "toplu"); geo.travel_minutes(a, b, t, mode). world.Scenario.transit_share = 0,4 (izmir_tam,
  varsayım: çalışanların %40'ının arabası yok). Mod ayrı bir RNG akışından (jumped) çekilir; eski dünyalar birebir aynı.
  Ek senaryolar (yalnız izmir_tam): arabali (0), toplu_cok (0,8). Model yol süresini çalışanın kendi ulaşımıyla görür.
- Arabalı (eski) izmir_tam sonuçları: results/izmir_tam_arabali/. Yeni sonuçlar results/izmir_tam/.
- Demo: aynı ağ JS'te kurulur, aynı Dijkstra (ters, dilim başına önbellekli; sorgu ~5 ms). Toplu taşımalı çalışanın canlı takibinde
  yolculuk planı ("🚶 5 dk → 🚇 M1 Bornova → Stadyum · 3 durak → 🚌 ESHOT 119 … → 🚶 2 dk"), o anki bacak vurgulu; harita durakta
  beklemeyi gösterir. Çalışan ekranında 🚗/🚌. `python tests/tutarlilik/transit_test.py web/dist/izmir.html`: JS = Python %99 aynı,
  en büyük fark 0,1 dk (calistir.sh'ye eklendi).
- Sonuç (5 dk uygun %, geliştirme / ayrılmış; seçilen = v5_ukota_trafik). Senaryo = arabası olmayan çalışan oranı:
  herkes arabalı: kural 54,7 / 52,7 · v1 74,2 / 72,1 · seçilen 73,2 / 71,1 (arşivle birebir aynı — kontrol tuttu)
  %40 toplu (yeni baz): kural 54,2 / 52,1 · v1 72,6 / 70,2 · seçilen 71,8 / 69,3; ayrılmış seçilen − kural +17,2 ± 1,0, − v1 −0,9 ± 0,2
  %80 toplu: kural 53,0 / 51,4 · v1 70,4 / 68,1 · seçilen 69,9 / 67,5; ayrılmış seçilen − kural +16,1 ± 0,9
  Ziyaret başına yol 27 → 35 → 45 dk; zamanında ziyaret %84 → %83 → %81. Toplu taşıma başarıyı yalnızca 2–4 puan düşürüyor
  (model yakındaki/arabalı çalışanı seçerek telafi ediyor); yapay zekâ farkı her durumda +16–18 puan.
- Uzun koşular yavaşsa: `OMP_NUM_THREADS=1` (2 çekirdekte sklearn iş parçacıkları süreçlerle çakışıyordu; tohum başına 9 sn).

## Kayıtlı bildirim modeli — Kapıda için (2026-11-18)
- `DUNYA=izmir OLCEK=tam OMP_NUM_THREADS=1 python -m sim.export_model` (~1 dk) → data/izmir/model_v5_demo_lr.json:
  özellik sırası (Türkçe + kod adı + tanım), mu/sd (StandardScaler, ddof=0 = JS trainLogReg), w/b (LogisticRegression C=1),
  v5 kuralları (a=0,6 b=0,06 c=0,15 alpha=0,95, 3 bildirim, 5 dk tur) + önerilen trafik kuralları, çalışan geçmiş profili
  yüzdelikleri (tüm + meslek), ölçüm. Eğitim: izmir_tam baz, tohum 0–9 keşif günleri birleşik (~45 bin örnek).
- Ölçüm: AUC eğitim 0,811 / ayrılmış (tohum 1000–1009 keşif verisi) 0,817. Sabit model ile ayrılmış 5 dk uygun:
  v5 kuralları %68,4, trafik kuralları + kota %67,9, klasik kural %52,1 (karşılaştırma: GBM v1 %70,2, seçilen v5_ukota_trafik %69,3).
- models.py: `lr_sabit_demo`, `lr_sabit_trafik` dosyadaki sabit modeli kullanır (tohumda yeniden eğitim yok).
- ortak/build.py: enes/ şablonunun kendisi yaptığı yamalar ('özellik', meslek adı/rengi) artık atlanıyor (patch(..., done=...));
  toplu taşıma ağı da gömülüyor. `python3 ortak/test_akis.py` hatasız.

## Ortak sıklıkla yeni sonuçlar (2026-11-18 gece) — izmir_tam güncel
- 5 dk uygun %, geliştirme / ayrılmış: herkes arabalı 73,2 / 71,1 (değişmedi) · %40 toplu (baz): kural 54,4 / 52,2 · v1 73,1 / 70,6 ·
  seçilen 72,2 / 70,1; ayrılmış seçilen − kural +17,9 ± 1,0, − v1 −0,5 ± 0,3 · %80 toplu: seçilen 71,0 / 68,5 (− kural +16,7).
  Ziyaret başına yol 27 / 33 / 40 dk. Kayıtlı model yeniden üretildi: AUC 0,818, sabit model ayrılmış %68,9 (klasik %52,2).
- Adres arama (çevrimdışı): `python -m sim.build_adres <overpass json>` → web/adres_izmir.json (OSM sokak/cadde/mahalle + ilçe);
  demo hasta formunda "Adres" kutusu (Türkçe kısaltmalar: sok/sk, cad/cd, mah/mh, blv); seçilen adres en yakın yol noktasına yapışır
  (≤2 km). Dosya yoksa kutu gizlenir. ortak/build.py de gömer.
- Vapur: build_transit FEEDS'te ship-izdeniz-gtfs (klasör varsa); servis adı bilinmiyorsa pazartesi çalışan servisler alınır.
