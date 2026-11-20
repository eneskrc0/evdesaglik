# CLAUDE.md — efehan/ (hasta asistanı kolu)

Talebin başı: hastanın anlattığını (yazı/ses/foto) güvenli bir hizmet seviyesine çevirir ve çalışana rapor verir.
Enes'in simülasyonundan (`enes/`) bağımsız çalışır; ortak kod yok, birleştirme ayrıca yapılacak.

## Yapı
- `data/` — SQLite şema + kaynaklı tohum CSV'leri (meslekler, hizmetler, 15 kırmızı bayrak, 22 şikâyet rotası; her tıbbi satırın `sources.csv`'de kaynağı var) ve sentetik İzmir verisi: konumlar Enes'in temiz havuzundan gerçek yol noktaları (`data/seed/izmir_yol.json`, `python data/build_izmir.py` ile enes/ verisinden üretilir, numpy ister). `python data/build_db.py`.
- `app/triage.py` — hibrit triyaj: kural tabanlı kırmızı bayrak (112/114) → seviye (TELE, TELE_HEMSIRE, HEKIM_EV, PLANLI).
- `app/routing.py` — ziyaret paylaşımı (en ucuz ekleme), tasarruf %50 hasta / %30 çalışan / %20 platform. Varış süresi `travel()`: İzmir yol paketindeki OSM rota süresi × TomTom 2025 saatlik trafik + 6 dk park (Enes'in `enes/sim/geo.py` izmir_tam modeli); yol maliyeti hâlâ kuş uçuşu × 1,3 km.
- `app/matching.py` — yetkinlik/fiyat/hız ağırlıklı, açıklanabilir sıralama.
- `web/core.js` — Python mantığının JS kopyası; `web/parity_test.py` eşitliği dener. `web/kapida.html` hasta+çalışan arayüzü (YZ sohbeti, foto, çalışana rapor). `python web/build_web.py` → `web/dist/`.

- `web/dogrulama.js` — sağlık çalışanı mesleki doğrulama akışı (prototip; resmî doğrulama yok, dosyalar yalnız bellekte). `web/e2e_dogrulama.py` uçtan uca prova.

- `web/harita.js` — gerçek İzmir haritası (Enes'in yol çizimi), yol grafiğinde Dijkstra ile sokak rotası, hastada canlı takip (kabulden sonra; 1 sn ≈ 1 dk canlandırma), çalışanın 'Rotam' sekmesinde günlük rota. Veri `data/seed/harita_izmir.json` (build_izmir.py, ~2 MB, build_web.py yalnızca kapida.html'e gömer). Prova: `python web/e2e_harita.py`.
- `web/teklif.js` — YZ teklif katmanı: Enes'in kayıtlı bildirim modeli (`enes/data/izmir/model_v5_demo_lr.json`, build_web.py gömer; p = sigmoid(b + Σw(x−mu)/sd), 12 özellik) ile v5 kuralı → 3 kişiye bildirim (+2. tur), YZ fiyat önerisi (ortak/ek.js aiPrice) ve ±%10 teklif bandı. Hasta teklifi kabul edince randevu kesin. Yanıtlar p ile canlandırılır (1 sn ≈ 1 dk); çalışan geçmişi sentetik (modelin meslek dağılımından). Prova: `python web/e2e_teklif.py`.
- İki demo günü: bugün 2026-11-16 (Pzt, şimdi = 09:30) ve yarın 2026-11-17 (Salı; build_db.py ayrı rastgele diziyle, bugünün verisi değişmez). 'Ne zaman gelsin?' iki günün gerçekten uygun saatlerini gösterir (findCandidates, tüm adaylar); yarınki randevuda canlı takip yok, çalışanın rotası yalnızca bugünü gösterir.
- `web/guvenlik.js` — Güvenli Ziyaret: ziyaret öncesi risk notu (rapordaki YZ `guvenlik_notlari` + kural motoru; yalnızca o ziyarette gösterilir), kapıda 4 haneli kapı kodu + çalışan fotoğrafı (hasta eşleştirir) ve konum kontrolü (adrese ≤150 m), check-in/çıkış, ziyaret boyunca çalışanın konum kaydı, kontrol zamanlayıcısı ("Her şey yolunda mı?", PIN ile yanıt) ve yanıt yoksa yükseltme zinciri (ikinci uyarı → çalışanı arama → güvenlik masası → acil kişi → 112, son konumla), gizli SOS (süreye 2 sn basılı tut) ve baskı PIN'i, hasta tarafında "sorun bildir", şiddette Beyaz Kod (113, beyazkod.saglik.gov.tr). Aramalar ve 112 bildirimi simüledir. Güvenlik masası paneli çalışan telefonunun altında. Demo PIN 2580, baskı PIN'i 0852. Prova: `python web/e2e_guvenlik.py`.
- `HARITA_VERISI.md` — Enes'in İzmir yol ağı, süre matrisi, rota grafiği ve hastane verisinin biçimi, okunuşu ve Kapıda'ya ekleme planı. Harita/rota işine başlamadan önce oku.

- `web/istemler.js` — YZ istemlerinin TEK kaynağı (sohbet kuralları, rapor istemi, ses ipucu); Claude sürümü ve sunucu birlikte kullanır.
- `web/sunucu.js` + `sunucu/` — Claude dışında gerçek YZ: Cloudflare Worker (`sunucu/worker.js`, build_web.py üretir; Groq Whisper + dil modeli), tarayıcıda ses kaydı ve telefonun Türkçe sesi. Kurulum: `sunucu/KURULUM.md`. Sunucu adresi `sunucu/adres.txt`'ten gömülür ya da `?sunucu=` ile verilir. Canlı sunucu: https://kapida.efehanemir7.workers.dev (Efehan'ın Cloudflare hesabı). Talimat/model/hizmet listesi `sunucu/ayar.json`'dan (main) her dakika okunur → bunlar için Cloudflare'e yapıştırma gerekmez; yalnızca worker kodu değişirse yapıştırılır. Testler: `node sunucu/test_worker.mjs`, `python web/e2e_sunucu.py`.

## Kurallar
- Model anlar, protokol karar verir: acil kararı her zaman kırmızı bayrak kurallarından gelir, YZ tanı koymaz.
- Hemşire ve diğer meslekler yalnız hekim planıyla hizmet verir (S08).
- Yeni tıbbi kural eklerken kaynağını `sources.csv`'ye yaz; `data/eval/triage_cases.csv`'ye vaka ekle.
- Python ve JS mantığı aynı kalmalı: değişiklikten sonra `python web/parity_test.py`.
- Testler: `python -m pytest -q tests && python eval_triage.py` (48 vaka bizim yazdığımız, bağımsız test değil).

- YZ teşhis koymaz, tedavi önermez; görevi hastanın şikâyetini sağlık çalışanına en iyi biçimde raporlamaktır (ekip kararı 17.11). Hizmet önerisi yalnızca öneridir, kararı hekim/sağlık çalışanı verir.
- Güvenli Ziyaret: konum yalnızca ziyaret penceresinde (yolda + ziyarette) kaydedilir; risk notu hastayı damgalamaz, yalnızca beyana dayanır. Demo/simülasyonda gerçek arama yapılmaz; yalnızca kullanıcının bastığı 112/113 düğmeleri gerçek tel: bağlantısıdır.
- API anahtarı hiçbir dosyaya yazılmaz; yalnızca Cloudflare'de Secret olarak durur.
- Sohbet en fazla 3 soru sorar; kullanıcı "direkt doktora yönlendir" derse ya da sohbetteki düğmeye basarsa sorular atlanır, hekim ev muayenesine gidilir (acil kontrolü her zaman önce).
- YZ fotoğrafı yalnızca dışarıdan görünen cilt durumları için ister (yara, kızarıklık, şişlik…); boğaz/ağız içi, ağrı, ateş vb. için istemez (istemler.js).
- Doğrulama metinlerinde "Bakanlık tarafından doğrulandı", "e-Devlet onaylı" gibi gerçekte yapılmayan ifadeler kullanılmaz; T.C. no, kimlik fotoğrafı, selfie, e-Devlet şifresi istenmez.

## Açık birleştirme kararları
Uygulama adı (Kapıda / Vizit) ve ücret varsayımları açık. Ekip kararı (16.11): şehir İzmir; fiyat karma (YZ önerir, çalışan ±%10 içinde teklif verir, paylaşım indirimi hastaya). Kapıda 18.11'den beri İzmir verisiyle (konum + yol süresi + trafik + en yakın acil servis); harita, sokak rotası ve canlı takip de var (18.11). 18.11 gece: Enes'in teklif akışı, YZ bildirim modeli ve YZ fiyat önerisi de Kapıda'da (teklif.js). Klasik liste 'Tüm uygun kişiler' altında duruyor.
