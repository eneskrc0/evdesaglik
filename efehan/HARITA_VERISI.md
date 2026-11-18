# Enes'in harita verisi — kullanım notu (efehan/ için)

Kaynak: `enes/` (simülasyon) ve `ortak/` (birleşik demo). Ekip kararı (16.11): şehir **İzmir**, gerçek yol ağı.
Bu not, Kapıda'ya (efehan/web) harita/rota eklerken neyin nerede olduğunu ve nasıl okunacağını özetler.
Tüm yol verisi OpenStreetMap'ten → sayfada **"© OpenStreetMap katkıcıları"** atfı gösterilmeli (ODbL).

## Güncel durum (19.11)
- **Ana dünya artık `DUNYA=izmir OLCEK=tam`** ve **temiz havuz `enes/data/izmir/pool_orta.npz`** (1.200 nokta; otoyol/çevre yolu üstü ve yerleşim dışı düğümler elendi; ortanca 12,6 dk, en uzun 46,6 dk). Demo (`roads_izmir.json`, `graph_izmir.json`, `hospitals.json`) bu havuzla üretiliyor. Aşağıdaki `pool.npz` eski/büyük ölçek içindir.
- 9 meslek, 155 çalışan, 195 talep/gün; yakında 3'ten az aday varsa arama genişliyor.
- **Bizim katalog Enes'te de kullanılıyor:** `enes/data/hizmet_katalogu.json` = `efehan/data/seed/services.csv` + `profession_services.csv`'den 20 ev hizmeti (tele_muayene ve reçete hariç; ebe → hemşire, uzman hekim → doktor). Bizde hizmet/süre/ücret/hekim planı değişirse onun kopyası da güncellenmeli (17.11'de birebir aynı). `ortak/build.py` ise `efehan/web/data.json` ve `core.js`'i doğrudan okur.
- Haritada yakınlaştırma/kaydırma, hasta/çalışan gözüyle görünümler, zaman çubuğu ve çalışanların yol üzerinde hareketi `enes/web/index.html`'de.
- **Gerçekçi trafik (17.11, a958bd3):** eski katsayılar İzmir'de ~2 kat hızlıydı. `izmir_tam` artık TomTom Trafik Endeksi 2025 İzmir'e göre saatlik eğri kullanıyor (10 km: gece 16, ortalama 23, akşam zirvesi 34,7 dk), park + bina girişi **6 dk**, yol sapması %25. Ziyaret başına ortalama yol ~27 dk (eskiden ~15). Ayrıntı aşağıda "Yol süresi modeli". Veri dosyalarının biçimi değişmedi.
- **Toplu taşıma (18.11, 515044f):** `izmir_tam`'da çalışanların **%40'ı arabasız** (varsayım, `Scenario.transit_share = 0,4`) ve ESHOT + Metro + Tramvay + İZBAN ile gidiyor (İzmir Büyükşehir açık veri GTFS, hafta içi; 18.11 gecesinden beri İZDENİZ vapuru da var, aşağıda). Yeni dosyalar `enes/data/izmir/transit_orta.npz` ve `enes/web/transit_izmir.json`; `travel_minutes`'e 4. parametre `mode` ("araba" | "toplu") geldi. Toplu taşıma kabaca arabanın **~2 katı** sürüyor (gündüz 2–4 km: araba 18 / toplu 42 dk). Eski dosyaların (pool, roads, graph, hospitals) biçimi değişmedi. Ayrıntı aşağıda "Toplu taşıma modeli". Herkes arabalı eski sonuçlar `enes/results/izmir_tam_arabali/`.
- **18–19.11 gecesi (9c6e6cb, 397a432, 3a35c37):** toplu taşımada **ortak sıklık** (aynı duraktan aynı sonraki durağa giden tüm hatlar birlikte sayılır → bekleme kısaldı; gündüz medyan 72 → 62 dk, İZBAN beklemesi ~14 → ~6 dk), **İZDENİZ vapuru** (4 hat, 5 iskele), süreler artık **tam dakika** (`geo.TRANSIT = rint(tt_d/10)`, demo ile birebir), **çevrimdışı adres arama** (`enes/web/adres_izmir.json`) ve demo açılışı için **hazır toplu taşıma matrisi** (`enes/web/transit_mat_izmir.json`). Kayıtlı bildirim modeli (`model_v5_demo_lr.json`) yeniden üretildi; biçimi aynı, yalnız katsayılar değişti. Eski dosyaların (pool, roads, graph, hospitals) biçimi değişmedi.
- **Boyut sınırı:** Enes'in gözlemi — tek HTML dosyası ~8,6 MB'ı geçince artifact görüntüleyicisi sayfayı açmıyor (boş ekran). Enes demoyu `enes/web/dist/izmir_site/` (hafif `index.html` + `veri/*.js`) olarak da üretiyor. Kapıda (~2,5 MB) şimdilik sınırın altında.

## Dosyalar

| Dosya | Boyut | İçerik |
|---|---|---|
| `enes/data/izmir/ag.npz` | 1,6 MB | Ham sürüş ağı (Colab + osmnx): 54.299 düğüm (`node` OSM id, `x` boylam, `y` enlem), 152.316 yönlü kenar (`u`,`v` int32, `tt` serbest akış süresi sn, `major` ana yol mu) |
| `enes/data/izmir/ilceler.geojson` | 250 KB | 11 ilçe sınırı, özellik `ilce` (Balçova, Bayraklı, Bornova, Buca, Çiğli, Gaziemir, Güzelbahçe, Karabağlar, Karşıyaka, Konak, Narlıdere) |
| `enes/data/izmir/anayollar.geojson` | 6,3 MB | 28.318 LineString, özellik `h` (motorway/trunk/primary/…) — yalnızca çizim için |
| `enes/data/izmir/pool.npz` | 5,1 MB | **Konum havuzu**: 1.200 yol düğümü (`lat`,`lon`,`node`,`ilce`) + aralarındaki **en kısa rota süresi matrisi** `tt` 1200×1200 float32 sn (tek yönlü yollar dahil, asimetrik). Ortanca 13,8 dk, en uzun 56,9 dk |
| `enes/data/izmir/hastaneler.csv` | | 50 hastane: `ad,tur,tur_ad,ilce,acil,kontrol,lat,lon` (`hastaneler_osm.csv` ham OSM listesi) |
| `enes/web/roads_izmir.json` | 4,6 MB | Tarayıcı için: `view` (min/max lat/lon), `W`=600, `H`, SVG path dizeleri `major`/`minor`/`border`, ilçe `labels`, `pool` [[lat,lon]…], `ilce`, `tt` = base64 uint16 süre matrisi (sn, satır-öncelikli, N×N) |
| `enes/web/graph_izmir.json` | 1,4 MB | Canlı takip rotası için sıkıştırılmış ağ (CSR): 54.177 düğüm; `lat`/`lon` = `lat0/lon0 + uint16 × 1e-5`; `off` uint32, `tgt` uint16, `tt` uint16 **desisaniye**; `pool[i]` = havuz noktası i'nin ağdaki sırası. Hepsi base64 |
| `enes/web/hospitals.json` | 8 KB | 50 kayıt `{ad,tur,turAd,ilce,acil,lat,lon,pi,pb}`; `pi` = İzmir havuzunda en yakın nokta, `pb` = Bornova havuzunda |
| `enes/data/izmir/transit_orta.npz` | 8,3 MB | **Toplu taşıma kapıdan kapıya süre matrisi** (`pool_orta` ile aynı 1.200 nokta): `tt_d` [4, 1200, 1200] uint16 **desidakika** (÷10 → dk; üst sınır 240 dk), `mode` aynı boyut uint8 (0 = yürümek daha kısa, 1 = toplu taşıma), `dilim` [[420,600],[600,960],[960,1200],[1200,1380]] = sabah 7–10, gündüz 10–16, akşam 16–20, gece 20–23 (dk) |
| `enes/web/transit_izmir.json` | 2 MB | Tarayıcı için toplu taşıma ağı (yolculuk planı/canlı takip): `dilim` [[ad,baş,bit]…], `param` {lat0, yurume_kmh 4,5, dolambac 1,3, erisim_m 1000, aktarma_m 400, bina_dk 2, binis_ceza 1,5, bekle_max 12}, base64 diziler `sx`,`sy` (durak konumu Int32), `rs_stop` (Int32), `rs_line` (Int16), `board` (Uint16, dilim başına bekleme), `ride` (Int32 araç kenarları), sayı `nride`, `sn` = "\|" ile ayrılmış durak adları, `lines` 866 hat `{f: işletme, m: otobus/metro/tramvay/izban/vapur, k: hat no, a: ad, r: renk, b}` (836 otobüs, 12 İZBAN, 8 tramvay, 8 vapur, 2 metro) |
| `enes/web/transit_mat_izmir.json` | 3,6 MB | **Hazır toplu taşıma süre matrisi** (tam dakika, 1200×1200×4 dilim): `{n, sira:[0,2,3], taban:1, base, delta}`; `base` = gündüz dilimi uint8, `delta` = diğer dilimler (sabah, akşam, gece) − gündüz, int16 LE; ikisi de zlib + base64. Tarayıcı `DecompressionStream` ile açar (açılış ~1,8 sn). `build_transit.write_mat` üretir; `web/build.py` `/*TRANSIT_MAT_JSON*/` yer tutucusuna gömer. Dijkstra yalnız yolculuk planı için kalır |
| `enes/web/adres_izmir.json` | 0,44 MB | Çevrimdışı adres arama: `{i: [11 ilçe], m: [[mahalle, lat, lon, ilçe_i]…] (452), s: [[sokak, lat, lon, mahalle_i, ilçe_i]…] (10.379), kaynak}`. Kaynak `enes/data/izmir/osm_sokaklar.json` (Overpass, 3,5 MB) → `python -m sim.build_adres`. Seçilen adres en yakın havuz noktasına (≤ 2 km) yapışır; Türkçe kısaltmalar (sok/sk, cad/cd, mah/mh, blv). `/*ADRES_JSON*/` yer tutucusu; dosya yoksa kutu gizlenir |
| `enes/data/bornova/…`, `roads_bornova.json`, `graph_bornova.json` | | Aynı yapı, pilot Bornova (600 nokta, ilçe alanı yok) |

Hastane türleri (`tur`): devlet 13, devlet_uni 4, belediye 1, vakif_uni 5, ozel 18, ozel_tm 9; 25'inde acil var (OSM).
Bilinen boşluk: Gaziemir'de hastane yok, Karşıyaka'da kamu hastanesi yok (OSM eksikliği olabilir, doğrulanmalı).

## Üretim zinciri (yeniden üretmek gerekirse)
1. Colab + osmnx → `ag.npz`, `ilceler.geojson`, `anayollar.geojson`, `hastaneler_osm.csv` (bu adımın betiği depoda yok).
2. `cd enes && python -m sim.build_izmir --n 1200` → `pool.npz` + `web/roads_izmir.json` (en büyük güçlü bağlı bileşen, ilçe içi düğümlerden tohum 42 ile seçim, scipy Dijkstra).
3. `python3 sim/build_route_graph.py izmir` → `web/graph_izmir.json` (havuzu kapsayan kutu +3 km).
4. `python -m sim.build_hospitals` → `hastaneler.csv`, `web/hospitals.json`.
5. `python web/build.py` JSON'ları `/*ROADS_JSON*/`, `/*GRAPH_JSON*/`, `/*HOSP_JSON*/` yer tutucularına gömer.

## Yol süresi modeli (Python `enes/sim/geo.py` = JS `enes/web/index.html`)
- `travel_minutes(a, b, dakika) = PARK_DK + tt[a.i, b.i] / 60 × congestion(dakika)` (JS: `travelMin`, `PARK`)
- **İzmir tam (`geo.TRAFIK_TOMTOM`, JS `WORLD==="izmir"`)**: `PARK_DK = 6`. Katsayı = saatlik "10 km kaç dk" hedefi / 9,3 (bizim ağda serbest akışta 10 km = 9,3 dk). Saat ortaları (x:30) arasında doğrusal geçiş. Hedef dizi `_TT10_HEDEF` (saat 0–23):
  `16,16,16,16,16,16,17,20,25.6,24,21.5,21.5,22.5,23,23,24.5,27,31.5,34.7,29,23,19.5,18,17`
  → katsayı gece ~1,72, öğlen ~2,4, sabah zirvesi ~2,75, akşam zirvesi (18:30) ~3,73. Kaynak: tomtom.com/traffic-index/izmir-traffic.
- Yol süresi sapması (göreli SS): izmir_tam %25 (`belirsiz_yol` senaryosu %45); varış aralığı ±1,645 × SS × kalan süre.
- Diğer dünyalar (Bornova, eski İzmir ölçekleri) eski model: `PARK_DK = 3`; 07:30–09:30 ve 17:00–19:30 → **1,8**; 09:30–17:00 → **1,35**; diğer → **1,15**; sapma %15 (%35).
- Eski trafikle alınan izmir_tam sonuçları `enes/results/izmir_tam_eski_trafik/` altında. Eğri grafiği: `cd enes && python sim/plot_trafik.py` → `results/izmir_tam/trafik.png` (18.11'den beri hazır kopyası `results/izmir_tam_arabali/trafik.png`).
- Konumlar `(lat, lon, havuz_indeksi)` üçlüsü; havuz dışı nokta en yakın havuz noktasına **2 km** içinde yapışır (Bornova 0,7 km).
- Havuz yoksa yedek: kuş uçuşu × 1,35, hız 16/24/30 km/sa.
- Talep/çalışan konumu: önce ilçe (TÜİK nüfusuna orantılı, `DISTRICT_POP`), sonra ilçe içinde rastgele havuz noktası.
- Yakın aday arama: H3 çözünürlük 8 hücreleri (`h3-js@4.1.0` CDN'den yüklenir → sayfa internet ister).

## Toplu taşıma modeli (18.11; Python `geo.travel_minutes(a, b, dakika, mode)` = JS `travelMin(a, b, m, mode)`)
- Yalnız `izmir_tam` (`geo.TRAFIK_TOMTOM` ve `transit_orta.npz` varsa `geo.TRANSIT` dolu); diğer dünyalar ve `mode="araba"` eskisi gibi.
- `mode="toplu"`: aynı havuz noktası → **2 dk**; değilse `TRANSIT[dilim, a.i, b.i]` (**tam dakika**, 19.11'den beri `rint(tt_d/10)`, en çok 255). Dilim seçimi: dakika < 600 → sabah (07:00 öncesi de sabah sayılır), < 960 gündüz, < 1200 akşam, diğer gece. Toplu taşımada trafik katsayısı ve 6 dk park **eklenmez** (matrisin içinde 2 dk bina var; JS `parkOf(w)` = `bina_dk`).
- Kapıdan kapıya = yürü (adres–durak ≤ 1 km, 4,5 km/sa × 1,3) + bekle (sefer aralığı / 2, en çok 12 dk) + 1,5 dk biniş cezası + araçta (dilimdeki medyan süre; otobüs zirvede ×1,25–1,35) + aktarma (≤ 400 m yürüme + yeniden bekleme) + 2 dk bina. Yürümek daha kısaysa o seçilir (`mode` = 0). Sefer aralığı **ortak sıklıkla** (`build_transit.ORTAK_SIKLIK`): aynı durak → aynı sonraki durak giden tüm hatların seferleri birlikte sayılır (yolcu ilk gelene biner). Ayrı sıklıklı eski sonuçlar `enes/results/izmir_tam_ayri_siklik/`.
- Vapur: resmî İZDENİZ GTFS'i yayında olmadığından `python -m sim.build_izdeniz` duyuru/tarifeden küçük bir GTFS üretir: 5 iskele (Karşıyaka, Bostanlı, Konak, Pasaport, Alsancak), 4 hat × 2 yön, yoğun saat 15 dk, diğer saatler 30 dk (varsayım). Üçkuyular/Göztepe/arabalı vapur yok. Etkisi küçük (Karşıyaka → Konak 45 → 44 dk). Vapursuz sonuçlar `enes/results/izmir_tam_vapursuz/`.
- Örnek (gündüz): Bornova Metro → Konak 37 dk (araba 28), Buca Şirinyer → Karşıyaka 57 dk, Çiğli → Gaziemir 85 dk.
- Simülasyonda `Worker.mode`, ayrı RNG akışından çekilir; ek senaryolar `arabali` (%0) ve `toplu_cok` (%80). Model (YZ bildirim) yol süresini çalışanın kendi ulaşımıyla görür.
- JS: `transitInit()` ağı kurar, `transitMin` / `transitRoute` (ters Dijkstra, dilim başına önbellek, ~5 ms) yolculuk planını verir ("🚶 5 dk → 🚇 M1 … → 🚌 ESHOT 119 … → 🚶 2 dk"); `build.py` `/*TRANSIT_JSON*/` yer tutucusuna gömer. Tutarlılık testi: `cd enes && python tests/tutarlilik/transit_test.py web/dist/izmir.html` (JS = Python, en büyük fark 0,1 dk).
- Yeniden üretim: `OLCEK=orta python -m sim.build_transit --gtfs <klasör>` (ham GTFS depoda yok; ESHOT `stop_times` tek başına 86 MB).

## Tarayıcı tarafında kullanılan fonksiyonlar (`enes/web/index.html`)
- `proj([lat,lon])` / `unproj(x,y)`: `roads.view` ile 600 birim genişlikte SVG'ye eşdikdörtgen izdüşüm (enlem kosinüsüyle).
- Harita: `minor` (ince), `major` (kalın), `border` (kesikli) path'leri + ilçe etiketleri; hastaneler türe göre renkli kare + artı.
- `graphDecode()` + `routeNodes(s,t)`: ikili yığınlı Dijkstra, hedefte durur; dönen `pts`, `cum` (sn), `km`. Matrisle ±1 sn tutarlı (Python'da 4 örnekte birebir doğrulandı).
- Canlı takip: `startTracking` → `trackState` (Kabul → Yolda → Yaklaşıyor <1 km → Kapıda → Ziyaret), varış aralığı ±1,645 × travelNoiseSd × kalan süre.
- `nearestHospital(loc, filtre)`: matris süresiyle en yakın hastane / en yakın kamu hastanesi; `showNearEta`: en erken ve en yakın 3 kişinin ortalama varışı.

## Kapıda'ya ekleme planı (sonraki aşamalar)
1. ✅ (18.11) **Şehri İzmir'e taşı:** `efehan/data` sentetik Ankara ilçe/konumları yerine İzmir havuz noktaları; çalışan ve hasta konumları havuzdan.
2. ✅ (18.11, süre; maliyet km'si hâlâ kuş uçuşu×1,3) **Yol süresi:** `core.js` içindeki `roadKm × 1,3 / 25 km/sa` tahmini yerine `travelMin` (matris + trafik katsayısı). Ziyaret paylaşımı (en ucuz ekleme) gerçek sürelerle çalışır; Python `routing.py` ve parity testi birlikte güncellenmeli.
   - Sonraki: çalışanın ulaşımı (araba / toplu taşıma) kayda girmeli; toplu taşımalı çalışan için `transitMin` (park yok, 2 dk bina) kullanılmalı, paylaşımlı rotada süre ~2 kat uzar. Hazır matris `transit_mat_izmir.json` (aşağıda) bunu tarayıcıda Dijkstra'sız yapmayı sağlar.
3. ✅ (18.11, harita.js) **Harita:** hasta seçenek kartları ve çalışanın "Rotam" sekmesi için `roads_izmir.json` çizimi + `routeNodes` ile gerçek sokak rotası.
4. ✅ (18.11) **Acil ekranı:** 112 yönlendirmesinin yanına en yakın acil servisli hastane (`acil=true`) ve yol süresi.
5. ✅ (18.11, canlandırma) **Canlı takip:** kabulden sonra hasta ekranında Enes'in takip kartı.
6. **Boyut:** Kapıda şu an ~2,5 MB (harita paketiyle); tek dosya ~8,6 MB'ı geçerse artifact görüntüleyicisi açmıyor (Enes 19.11) → toplu taşıma ağı/matrisi eklenecekse Enes'in `_site` yaklaşımı (ayrı `veri/*.js`) gerekebilir. Telefon için `tt` matrisini yalnız gereken satırlarla ya da `graph` + istemci Dijkstra ile vermek, `anayollar` çizimini sadeleştirmek düşünülmeli.

Not: `ortak/build.py` bu birleşimin bir kısmını (triyaj + katalog + paylaşım + takip) Enes'in şablonu üzerinde zaten yapıyor; `efehan/web/data.json` ve `core.js`'i oradan okur — bu iki dosyanın biçimi değişirse `python3 ortak/build.py` yeniden çalıştırılıp kontrol edilmeli. (17.11 akşamı: `ortak/build.py` bizim dosyalardan değil, `enes/web/index.html`'de `+(req.service==="doktor")` satırı 2907586'da değiştiği için "özellik" yamasında duruyor; düzeltmesi `ortak/` tarafında. 18.11 kontrolü: hâlâ duruyor; o yama atlanınca "renk", "teklif-profil", "sıralama-profil" ve meslek adı yamaları da tutmuyor — Enes bunları şablona zaten almış görünüyor. Bizim dosyalara bağlı yamalar ("core.js", "katalog", "katalog-hizmetler") sorunsuz. 18.11 akşamı (5392d4a) Enes düzeltti: şablonun zaten yaptığı yamalar atlanıyor, toplu taşıma da gömülüyor. 19.11 kontrolü: `python3 ortak/build.py` hatasız; `ortak/dist/izmir.html` 12,2 MB — tek dosya olarak 8,6 MB sınırını aşıyor, `ortak/`'ta `_site` benzeri klasörlü çıktı yok.)
