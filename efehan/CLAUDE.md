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

## Kurallar
- Model anlar, protokol karar verir: acil kararı her zaman kırmızı bayrak kurallarından gelir, YZ tanı koymaz.
- Hemşire ve diğer meslekler yalnız hekim planıyla hizmet verir (S08).
- Yeni tıbbi kural eklerken kaynağını `sources.csv`'ye yaz; `data/eval/triage_cases.csv`'ye vaka ekle.
- Python ve JS mantığı aynı kalmalı: değişiklikten sonra `python web/parity_test.py`.
- Testler: `python -m pytest -q tests && python eval_triage.py` (48 vaka bizim yazdığımız, bağımsız test değil).

- Doğrulama metinlerinde "Bakanlık tarafından doğrulandı", "e-Devlet onaylı" gibi gerçekte yapılmayan ifadeler kullanılmaz; T.C. no, kimlik fotoğrafı, selfie, e-Devlet şifresi istenmez.

## Açık birleştirme kararları
Uygulama adı (Kapıda / Vizit), fiyat (çalışan teklifi + paylaşım indirimi), tek şehir (İzmir/Ankara), ücret varsayımları.
