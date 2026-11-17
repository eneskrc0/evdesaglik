# CLAUDE.md — efehan/ (hasta asistanı kolu)

Talebin başı: hastanın anlattığını (yazı/ses/foto) güvenli bir hizmet seviyesine çevirir ve çalışana rapor verir.
Enes'in simülasyonundan (`enes/`) bağımsız çalışır; ortak kod yok, birleştirme ayrıca yapılacak.

## Yapı
- `data/` — SQLite şema + kaynaklı tohum CSV'leri (meslekler, hizmetler, 15 kırmızı bayrak, 22 şikâyet rotası; her tıbbi satırın `sources.csv`'de kaynağı var) ve sentetik Ankara verisi. `python data/build_db.py`.
- `app/triage.py` — hibrit triyaj: kural tabanlı kırmızı bayrak (112/114) → seviye (TELE, TELE_HEMSIRE, HEKIM_EV, PLANLI).
- `app/routing.py` — ziyaret paylaşımı (en ucuz ekleme), tasarruf %50 hasta / %30 çalışan / %20 platform.
- `app/matching.py` — yetkinlik/fiyat/hız ağırlıklı, açıklanabilir sıralama.
- `web/core.js` — Python mantığının JS kopyası; `web/parity_test.py` eşitliği dener. `web/kapida.html` hasta+çalışan arayüzü (YZ sohbeti, foto, çalışana rapor). `python web/build_web.py` → `web/dist/`.

- `web/dogrulama.js` — sağlık çalışanı mesleki doğrulama akışı (prototip; resmî doğrulama yok, dosyalar yalnız bellekte). `web/e2e_dogrulama.py` uçtan uca prova.

- `HARITA_VERISI.md` — Enes'in İzmir yol ağı, süre matrisi, rota grafiği ve hastane verisinin biçimi, okunuşu ve Kapıda'ya ekleme planı. Harita/rota işine başlamadan önce oku.

- `web/istemler.js` — YZ istemlerinin TEK kaynağı (sohbet kuralları, rapor istemi, ses ipucu); Claude sürümü ve sunucu birlikte kullanır.
- `web/sunucu.js` + `sunucu/` — Claude dışında gerçek YZ: Cloudflare Worker (`sunucu/worker.js`, build_web.py üretir; Groq Whisper + dil modeli), tarayıcıda ses kaydı ve telefonun Türkçe sesi. Kurulum: `sunucu/KURULUM.md`. Sunucu adresi `sunucu/adres.txt`'ten gömülür ya da `?sunucu=` ile verilir. Testler: `node sunucu/test_worker.mjs`, `python web/e2e_sunucu.py`.

## Kurallar
- Model anlar, protokol karar verir: acil kararı her zaman kırmızı bayrak kurallarından gelir, YZ tanı koymaz.
- Hemşire ve diğer meslekler yalnız hekim planıyla hizmet verir (S08).
- Yeni tıbbi kural eklerken kaynağını `sources.csv`'ye yaz; `data/eval/triage_cases.csv`'ye vaka ekle.
- Python ve JS mantığı aynı kalmalı: değişiklikten sonra `python web/parity_test.py`.
- Testler: `python -m pytest -q tests && python eval_triage.py` (48 vaka bizim yazdığımız, bağımsız test değil).

- YZ teşhis koymaz, tedavi önermez; görevi hastanın şikâyetini sağlık çalışanına en iyi biçimde raporlamaktır (ekip kararı 17.11). Hizmet önerisi yalnızca öneridir, kararı hekim/sağlık çalışanı verir.
- API anahtarı hiçbir dosyaya yazılmaz; yalnızca Cloudflare'de Secret olarak durur.
- Doğrulama metinlerinde "Bakanlık tarafından doğrulandı", "e-Devlet onaylı" gibi gerçekte yapılmayan ifadeler kullanılmaz; T.C. no, kimlik fotoğrafı, selfie, e-Devlet şifresi istenmez.

## Açık birleştirme kararları
Uygulama adı (Kapıda / Vizit) ve ücret varsayımları açık. Ekip kararı (16.11): şehir İzmir; fiyat karma (YZ önerir, çalışan ±%10 içinde teklif verir, paylaşım indirimi hastaya). Kapıda hâlâ Ankara verisiyle — İzmir'e taşıma planı HARITA_VERISI.md'de.
