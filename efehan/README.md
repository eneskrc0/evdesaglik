# Evde Sağlık Eşleştirme — prototip v0.1

GAZİ AI TECH 2026 için ekip fikri: hasta şikayetini yazar, sistem **aciliyeti ve doğru hizmet seviyesini** belirler, hastanın tercihine (yetkinlik / fiyat / hız) göre **uygun sağlık çalışanını açıklamalı olarak önerir** ve ziyareti çalışanın o günkü rotasına ekleyerek **ziyaret paylaşımıyla fiyatı düşürür** (Martı TAG'ın boştaki kapasite mantığı).

> Bu yazılım **teşhis koymaz**. Kırmızı bayrak bulduğunda randevu önermez, 112 / 114'e yönlendirir. Tıbbi kurallar ekip tasarımıdır ve **klinisyen doğrulaması bekler**. Sağlayıcı ve hasta verileri **sentetiktir**, fiyatlar **varsayımdır**.

## Çalıştırma

Yalnızca Python 3.10+ standart kütüphanesi gerekir (testler için `pytest`).

```bash
python data/build_db.py     # veritabanını kur  -> data/evde_saglik.db
python demo.py              # 7 senaryo
python eval_triage.py       # triyaj ölçümü (48 vaka)
python -m pytest -q         # birim testleri
```

## Web test prototipi

`web/` klasörü aynı mantığın tarayıcı sürümüdür (`core.js`, Python ile birebir; `python web/parity_test.py` 76 triyaj + 3.840 eşleştirme durumunu karşılaştırır). Sekmeler: senaryo testi, test seti, veritabanı gezgini, doktor/hemşire paneli taslağı, eksikler ve notlar.

```bash
python web/export_json.py && python web/build_web.py   # -> web/dist/index.html
```

## Akış

```
şikayet metni ──► triage.py ──► kırmızı bayrak? ──evet──► 112 / 114 (randevu yok)
                      │
                      └─hayır─► hizmet seviyesi
                                  TELE          hekimle video görüşme
                                  TELE_HEMSIRE  hemşire evde + hekim videoda
                                  HEKIM_EV      hekim ev ziyareti
                                  PLANLI        hekim planı olan hastaya hemşire / fzt / odyolog ...
                                      │
                                      ▼
                    matching.py ──► yasal filtre (ruhsat, hekim planı)
                                    rota ekleme (routing.py) + fiyat
                                    yetkinlik / fiyat / hız puanı + gerekçe cümlesi
```

**Neden "PLANLI" ancak hekim planıyla?** Sağlık Meslek Mensuplarının Serbest Meslek İcrası Hakkında Yönetmelik'e (RG 29.03.2025/32856) göre hemşire, fizyoterapist, odyolog vb. yalnızca hekimin tanı koyduğu hastaya tedavi planı veya reçeteyle hizmet verebilir (kaynak S07, S08). Planı olmayan hasta önce hekime yönlendirilir.

## Dosyalar

| Yol | İçerik |
| --- | --- |
| `data/schema.sql` | Veritabanı şeması (12 tablo) |
| `data/seed/*.csv` | Kaynaklı tohum veri: meslekler, hizmetler, yetkiler, kırmızı bayraklar, şikayet yönlendirmeleri, kaynaklar |
| `data/build_db.py` | Veritabanını kurar, sentetik demo verisini üretir, tutarlılığı doğrular |
| `data/eval/triage_cases.csv` | Etiketli triyaj vakaları (YZ modeli için ilk değerlendirme seti) |
| `app/triage.py` | Kırmızı bayrak + hizmet seviyesi yönlendirmesi |
| `app/routing.py` | Ziyaret paylaşımı (en ucuz ekleme) ve kazan-kazan-kazan fiyatlama |
| `app/matching.py` | Açıklanabilir çok kriterli eşleştirme |
| `app/api.py` | Tek giriş noktası `handle_request(...)` |
| `demo.py`, `demo_cikti.txt` | Senaryolar ve örnek çıktı |
| `eval_triage.py` | Kırmızı bayrak duyarlılığı ve seviye doğruluğu |

## Veritabanı

| Tablo | Satır | Not |
| --- | --- | --- |
| `sources` | 14 | Her tıbbi / mevzuat satırı buraya bağlı |
| `professions` | 11 | Hekim, uzman hekim + serbest meslek yönetmeliğindeki 9 meslek |
| `services` | 22 | Evde verilebilen hizmetler; hekim istemi / reçete gereksinimi |
| `profession_services` | 28 | Hangi meslek hangi hizmeti verir |
| `red_flags` | 15 | Acil belirtiler (MEB İlk Yardım, Sağlık Bakanlığı UZEM vb.) |
| `complaint_routes` | 22 | Acil olmayan şikayet → seviye / hizmet |
| `districts`, `providers`, `provider_services`, `availability`, `scheduled_visits`, `patients` | — | **Sentetik** Ankara demo verisi (seed=42) |

Anahtar kelime biçimi: `a;b|c` = "(a ve b) ya da c". Eşleşme kelime başından yapılır ve Türkçe karaktersiz yazımı da yakalar (`göğsüm` = `gogsum`).

## Kazan-kazan-kazan fiyatı

```
tasarruf      = (tek başına yol km − rotaya eklenen yol km) × 12 TL/km
hasta öder    = hizmet bedeli + tek başına yol bedeli − %50 tasarruf
sağlıkçı alır = hizmet bedeli × %90 + gerçek yol bedeli + %30 tasarruf
platform alır = hizmet bedeli × %10 + %20 tasarruf
```

Hastanın ödediği = sağlıkçı + platform (testle doğrulanır). Oranlar `app/routing.py` başında, tasarım varsayımıdır.

## Ölçümler (v0.1)

`python eval_triage.py`: 48 vakada kırmızı bayrak duyarlılığı 21/21, seviye doğruluğu %100.
**Dikkat:** vakaları da kuralları da ekip yazdı; bu bağımsız bir test değil. Gerçek ölçüm için kurallardan habersiz kişilerin yazdığı yeni ifadeler gerekir. İlk demoda "göğsünde baskı var, terliyor" cümlesi bayrağı kaçırmıştı; düzeltildi ve vaka setine eklendi. Anahtar kelime yaklaşımının kırılganlığı tam olarak budur.

## Yol haritası

1. **Şikayet anlama için dil modeli**: serbest metinden belirti, süre ve şiddet çıkarma. Kırmızı bayraklar kural tabanlı güvenlik ağı olarak kalır; model yalnızca seviyeyi önerir. Ölçüt: duyarlılık %100'ün altına düşmemeli.
2. **Bası yarası evre takibi**: hasta yakınının fotoğrafından NPIAP evresi. Açık veri: PIID (Ay vd. 2022, S13).
3. **Çoklu ziyaret optimizasyonu**: tek ziyaret eklemeden günlük rota planına (HHCRSP, S12), gerçek yol süreleri.
4. **TELE_HEMSIRE için hekim ataması**: hemşire ziyaret saatine uygun hekim seçimi.
5. **Güvenlik**: sağlık çalışanı için konum paylaşımı / panik butonu, ruhsat doğrulama akışı.
6. **Klinisyen doğrulaması**: `red_flags` ve `complaint_routes` tablolarını bir hekim ve bir hemşireye gözden geçirtmek.

## Mesleki doğrulama ekranı (sağlık çalışanı ilk girişi)
`web/dogrulama.js` — 3 adım: Mesleğini belirt → Belgelerini ekle → Başvurunu gönder. Hekim seçilince pratisyen/uzman, uzman seçilince uzmanlık alanı ve uzmanlık belgesi sorulur. PDF/JPG/PNG, dosya başına 10 MB. Başvuru onaylanmadan (demo) görev kabul edilemez.
**Prototiptir:** belgeler resmî sistemlerden doğrulanmaz; dosyalar yalnızca tarayıcı belleğinde tutulur, hiçbir yere gönderilmez. Görev kabul kilidi arayüz simülasyonudur; gerçek uygulamada yetkilendirme sunucuda yapılır. Sağlık çalışanı telefonunun altındaki “Demo kontrolleri” ile İnceleme bekliyor / Eksik belge / Onaylandı — demo / Uygun bulunmadı — demo durumları gösterilir.
Prova: `python web/e2e_dogrulama.py <örnek dosya klasörü>` (56 kontrol).
