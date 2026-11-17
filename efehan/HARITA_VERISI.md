# Enes'in harita verisi — kullanım notu (efehan/ için)

Kaynak: `enes/` (simülasyon) ve `ortak/` (birleşik demo). Ekip kararı (16.11): şehir **İzmir**, gerçek yol ağı.
Bu not, Kapıda'ya (efehan/web) harita/rota eklerken neyin nerede olduğunu ve nasıl okunacağını özetler.
Tüm yol verisi OpenStreetMap'ten → sayfada **"© OpenStreetMap katkıcıları"** atfı gösterilmeli (ODbL).

## Güncel durum (17.11)
- **Ana dünya artık `DUNYA=izmir OLCEK=tam`** ve **temiz havuz `enes/data/izmir/pool_orta.npz`** (1.200 nokta; otoyol/çevre yolu üstü ve yerleşim dışı düğümler elendi; ortanca 12,6 dk, en uzun 46,6 dk). Demo (`roads_izmir.json`, `graph_izmir.json`, `hospitals.json`) bu havuzla üretiliyor. Aşağıdaki `pool.npz` eski/büyük ölçek içindir.
- 9 meslek, 155 çalışan, 195 talep/gün; yakında 3'ten az aday varsa arama genişliyor.
- **Bizim katalog Enes'te de kullanılıyor:** `enes/data/hizmet_katalogu.json` = `efehan/data/seed/services.csv` + `profession_services.csv`'den 20 ev hizmeti (tele_muayene ve reçete hariç; ebe → hemşire, uzman hekim → doktor). Bizde hizmet/süre/ücret/hekim planı değişirse onun kopyası da güncellenmeli (17.11'de birebir aynı). `ortak/build.py` ise `efehan/web/data.json` ve `core.js`'i doğrudan okur.
- Haritada yakınlaştırma/kaydırma, hasta/çalışan gözüyle görünümler, zaman çubuğu ve çalışanların yol üzerinde hareketi `enes/web/index.html`'de.

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
- `travel_minutes(a, b, dakika) = 3 + tt[a.i, b.i] / 60 × trafik(dakika)`  (+3 dk hazırlık/park)
- Trafik katsayısı: 07:30–09:30 ve 17:00–19:30 → **1,8**; 09:30–17:00 → **1,35**; diğer → **1,15**.
- Konumlar `(lat, lon, havuz_indeksi)` üçlüsü; havuz dışı nokta en yakın havuz noktasına **2 km** içinde yapışır (Bornova 0,7 km).
- Havuz yoksa yedek: kuş uçuşu × 1,35, hız 16/24/30 km/sa.
- Talep/çalışan konumu: önce ilçe (TÜİK nüfusuna orantılı, `DISTRICT_POP`), sonra ilçe içinde rastgele havuz noktası.
- Yakın aday arama: H3 çözünürlük 8 hücreleri (`h3-js@4.1.0` CDN'den yüklenir → sayfa internet ister).

## Tarayıcı tarafında kullanılan fonksiyonlar (`enes/web/index.html`)
- `proj([lat,lon])` / `unproj(x,y)`: `roads.view` ile 600 birim genişlikte SVG'ye eşdikdörtgen izdüşüm (enlem kosinüsüyle).
- Harita: `minor` (ince), `major` (kalın), `border` (kesikli) path'leri + ilçe etiketleri; hastaneler türe göre renkli kare + artı.
- `graphDecode()` + `routeNodes(s,t)`: ikili yığınlı Dijkstra, hedefte durur; dönen `pts`, `cum` (sn), `km`. Matrisle ±1 sn tutarlı (Python'da 4 örnekte birebir doğrulandı).
- Canlı takip: `startTracking` → `trackState` (Kabul → Yolda → Yaklaşıyor <1 km → Kapıda → Ziyaret), varış aralığı ±1,645 × travelNoiseSd × kalan süre.
- `nearestHospital(loc, filtre)`: matris süresiyle en yakın hastane / en yakın kamu hastanesi; `showNearEta`: en erken ve en yakın 3 kişinin ortalama varışı.

## Kapıda'ya ekleme planı (sonraki aşamalar)
1. **Şehri İzmir'e taşı:** `efehan/data` sentetik Ankara ilçe/konumları yerine İzmir havuz noktaları; çalışan ve hasta konumları havuzdan.
2. **Yol süresi:** `core.js` içindeki `roadKm × 1,3 / 25 km/sa` tahmini yerine `travelMin` (matris + trafik katsayısı). Ziyaret paylaşımı (en ucuz ekleme) gerçek sürelerle çalışır; Python `routing.py` ve parity testi birlikte güncellenmeli.
3. **Harita:** hasta seçenek kartları ve çalışanın "Rotam" sekmesi için `roads_izmir.json` çizimi + `routeNodes` ile gerçek sokak rotası.
4. **Acil ekranı:** 112 yönlendirmesinin yanına en yakın acil servisli hastane (`acil=true`) ve yol süresi.
5. **Canlı takip:** kabulden sonra hasta ekranında Enes'in takip kartı.
6. **Boyut:** Kapıda şu an 185 KB; İzmir verisiyle ~6 MB olur. Telefon için `tt` matrisini yalnız gereken satırlarla ya da `graph` + istemci Dijkstra ile vermek, `anayollar` çizimini sadeleştirmek düşünülmeli.

Not: `ortak/build.py` bu birleşimin bir kısmını (triyaj + katalog + paylaşım + takip) Enes'in şablonu üzerinde zaten yapıyor; `efehan/web/data.json` ve `core.js`'i oradan okur — bu iki dosyanın biçimi değişirse `python3 ortak/build.py` yeniden çalıştırılıp kontrol edilmeli.
