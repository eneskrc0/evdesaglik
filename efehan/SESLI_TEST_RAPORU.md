# Sesli sohbet test raporu (20.11.2026)

Kapıda'nın Türkçe sesli/yazılı sohbeti 207 sentetik senaryoyla denendi, bulunan hatalar kök nedeninden düzeltildi ve
aynı senaryolar yeniden çalıştırıldı. **Bu sonuçlar klinik güvenlik kanıtı değildir.** Senaryoları, beklentileri ve kodu aynı
ekip yazdı; gerçek hasta, gerçek insan sesi ve klinisyen değerlendirmesi yok. Tüm veriler sentetiktir.

## 1. Ne denendi, nasıl

Katalog: `data/eval/sesli_katalog.py` → `sesli_senaryolar.json` (207 senaryo, 52'si çok turlu) ve `sesli_gizli.json`
(30 senaryo, geliştirme boyunca çalıştırılmadı). Beklentiler kod çalıştırılmadan, kaynaklı kurallara (red_flags.csv
S01–S06, S15; S07/S08 yönetmelik) ve ekip kurallarına göre yazıldı. Sabit tohumlu (20261120) 60 birleşim: dolgu kelimesi +
kişi + belirti + olumsuzluk + zaman; beklenen sonuç bileşenlerden türetildi. Kaynakların karar vermeye yetmediği 3 klinik
durum "uzman değerlendirmesi gerekli" diye işaretlendi; bunlar ölçüldü ama başarı/başarısızlık sayılmadı.

Tek değişiklik: ilk çalıştırmadan **önce** 4 beklenti düzeltildi ("şimdi iyi" dendiğinde "şu an da var mı" diye yeniden
sorulmasın). Çalıştırmadan sonra yalnızca test düzeneğinin hataları düzeltildi (ör. özet ekranındaki sabit "Hemşire…"
yazısını meslek sanan kontrol, geç cevabı gerçekten beklemeyen J05 adımı); beklentiler değiştirilmedi.

| Katman | Ne çalışır | Ne taklit | Sayı |
|---|---|---|---|
| Kural | core.js + triage.py (aynı vakalar, Python/JS eşitliği dahil) | — | 127 |
| Akış (yazı) | Gerçek tarayıcıda kapida.js; acil kuralı, ara laf, kısa yol, soru sınırı, rapor kapısı, hata/gecikme | YZ'nin sohbet ve rapor cevapları senaryoda yazılı (taklit sunucu) | 33 |
| Akış (sesli) | Aynı senaryolar sesli modda: gerçek VAD, MediaRecorder, /ses isteği, sesli.js denetleyicisi | Mikrofon = sentetik dalgalı ton (insan sesi değil); Whisper çevirisi senaryo cümlesi; telefon sesi taklit | 30 |
| Rapor | denetim.js: YZ raporu + kullanıcının söyledikleri | YZ raporu senaryoda yazılı (bilerek hatalı) | 15 |
| Ses | sesli.js saf işlevleri ve denetleyici | Dinleyici ve ses seviyeleri sentetik | 24 |
| Canlı | Gerçek Cloudflare sunucusu + Groq (tarayıcıdan), her vaka 2 kez | — | 8 |

## 2. Sonuçlar

Geliştirme seti (199 çevrimdışı senaryo; "önce" = değişiklikten önceki kod):

| Katman | Önce | Sonra |
|---|---|---|
| Kural | 77/127 | 127/127 (Python/JS farkı 0) |
| Akış, yazı | 21/33 | 32/33 + 1 uzman vakası ölçüldü |
| Akış, sesli (sentetik ton) | ilk koşu 26/30 (eski kodla koşulmadı) | 29/30 + 1 uzman vakası |
| Rapor | 3/15 | 15/15 |
| Ses | 16/24 | 24/24 |

Kategoriye göre (kural + akış yazı + rapor + ses; uzman vakaları iki tarafta da düşülmedi):

| Kategori | Vaka | Önce | Sonra |
|---|---|---|---|
| A doğal konuşma / dolgu | 14 | 12 | 14 |
| B olumsuzluk | 13 | 8 | 13 |
| C kendini düzeltme | 15 | 8 | 15 |
| D zaman ve kişi | 14 | 6 | 14 |
| E konuşma dili | 10 | 6 | 10 |
| F ses tanıma hataları | 10 | 4 | 10 |
| G anlamsız / konu dışı | 13 | 5 | 13 |
| H belirsizlik / çelişki | 10 | 3 | 10 |
| I sabırsızlık / kısa yol | 8 | 6 | 8 |
| J teknik hatalar | 13 | 12 | 13 |
| K ses çakışması / ara laf | 10 | 3 | 10 |
| L talimat değiştirme | 9 | 1 | 9 |
| Sabit tohumlu birleşim | 60 | 44 | 60 |
| **Toplam** | **199** | **118** | **199** |

Not: J04 (çift gönderim) eski kodda zamanlamaya bağlı: tam koşuda bir kez geçti, tek başına 3/3 kaldı. Yeni kodda 3/3 geçti.

**Gizli grup (en sonda, bir kez):** ilk koşu 26/30 (kural 20/24, rapor 3/3, ses 3/3; kural hatalarından biri uzman vakası).
Kaçanlar: "kıpırdamıyor, seslenince bakmıyor", "bir yanı tutmuyor", "nefes darlığı… şu an çok zorlanıyor" (kelime
eksikleri) ve "nefes darlığı yok değil" (uzman). İlk üçü sözlüğe eklendi → 23/24. **Gizli grup artık bağımsız sayılmaz.**

**Canlı (gerçek Groq, ayar 5dbb663d = şu anki main):** 16 denemenin çoğu Groq kotasına takıldı; cevap alınanlarda:
anlamsız girdide uydurmadı, teşhis istendiğinde reddetti (bir denemede ilk mesajda ready=true verdi); "pardon, babam için,
dizi ağrıyor" bir denemede doğru, bir denemede **"sırt ağrısı"** diye yanlış anlandı; "üç gündür… yok, bir haftadır"
düzeltmesi **ikisi birleştirilerek** anlaşıldı. En önemli bulgu aşağıda (yedek model). Yeni istem kuralları main'e
birleşince canlı yeniden denenmeli; şu an doğrulanmadı.

## 3. Bulunan sorunlar, nedenleri ve düzeltmeler

| # | Sorun (örnek) | Kök neden | Düzeltme | Dosya |
|---|---|---|---|---|
| 1 | "Annemin kanaması durmuyor" acil sayılmıyordu | Çok kelimeli anahtar bitişik aranıyordu; iyelik eki ("kanaması") ve araya giren kelime ("kolu **yine** tutmuyor") eşleşmeyi bozuyordu | Kelime ekleri ve araya en fazla bir kelime (`has()`) | text.py, core.js |
| 2 | "Göğüs ağrım yok diyemem", "kanaması yok değil" acil değil | Çift olumsuz olumsuz sayılıyordu | "yok değil / yok diyemem / yok sayılmaz" → "var" | text.py, core.js |
| 3 | "Babamın göğüs ağrısı yok, ama dizi ağrıyor" acil | Kuralın bir parçası ("ağrı") olumlu cümlede geçince tümü acil sayılıyordu | Her parça olumlu cümlede olmalı; organ söz düşmesiyle taşınır ("göğsümde ağrı yok, baskı var" acil kalır) | text.py, core.js |
| 4 | "nefes ala miyorum", "kana ma", "hem şire" | Ses tanıma kelimeyi ekinden/ortasından bölüyor | Ek parçaları birleşir; meslek adları boşluksuz da aranır | text.py, core.js, triage.py |
| 5 | "Hemşire… aslında fizyoterapist" → hemşire | Meslek önceliğe göre seçiliyordu | Son düzeltmeden sonra söylenen meslek | triage.py, core.js |
| 6 | "Geçen yıl bayılmıştı" hiç sorulmuyordu | Eski olay sessizce bastırılıyordu | Şu anki durum söylenmediyse bir kez "Bu belirti şu anda da var mı?"; evet → acil | triage.py, core.js, kapida.js |
| 7 | "Patates uzaya çıktı" + YZ "hazır" → rapor | Rapora geçiş yalnız kelime sayısına bakıyordu | Sağlık içeriği kapısı (meslek adı tek başına yetmez) | kapida.js, core.js |
| 8 | "Soru sorma" → boş rapor; ardından "babam nefes alamıyor" yazılamıyordu | Kısa yol içerik beklemeden rapora geçiyordu | İçerik yoksa tek cümle istenir; acil kontrolü önce | kapida.js |
| 9 | Eski sohbetin geç gelen cevabı yeni sohbete yazılıyordu | Bekleyen istek iptal edilmiyordu | Sohbet numarası; yeni sohbette plan/yatak/kişi/saat sıfırlanır, dikte durur | kapida.js |
| 10 | Aynı mesaj iki kez gidiyordu | Çift dokunma / iki kez biten ses tanıma | 1,5 sn içinde aynı mesaj yok sayılır | kapida.js |
| 11 | Raporda söylenmeyen yaş, ilaç, alerji, "doktor onayladı"; "bilmiyorum" → "yok"; düzeltmede ilk söylenen | YZ çıktısı denetlenmiyordu | `denetim.js`: kullanıcının sözleriyle karşılaştırır, beyan/YZ çıkarımı etiketi, değişiklik listesi; çalışan ekranında "YZ çıkarımı" ve "Rapor denetimi" | denetim.js, kapida.js |
| 12 | Asistanın kendi sesi kullanıcı mesajı olabiliyordu; "hahaha", "[Müzik]" gidiyordu; "sus" anlaşılmıyordu | Yankı denetimi yoktu, filtre eksikti | `yankiMi` (6 kelimede en fazla 1 fark), gülme/ortam etiketi; "hı hı", "he", "yok" korunur | sesli.js |
| 13 | Sesli modda "hava yetmiyor ama" devamı beklenip bekletiliyordu | Yarım cümle birleştirme acili gözetmiyordu | Acil olabilecek parça beklemeden gider | sesli.js, kapida.js |
| 14 | "Sadece fiyatları görmek istiyorum" soru hakkı harcıyordu | — | Başlangıç fiyatları yerel cevap | kapida.js |
| 15 | Zaman aşımında ~90 sn sessizlik | 45 sn + yeniden deneme | Sohbet 25 sn; zaman aşımında yeniden denenmez | sunucu.js |
| 16 | **Canlı:** kotalar dolunca kullanıcıya "Bağlantıda sorun" (502) | Yedek model `llama-3.3-70b-versatile` Groq'da 16.08.2026'da kapatılmış | Yedek: gpt-oss-20b, qwen/qwen3.8-27b (ayar.json'dan, birleşince canlıya geçer); kaldırılmış model atlanır, sonunda "yoğun" (429) döner | ayar.json, worker_sablon.js |
| 17 | Uzun sesli oturum sunucu sınırına takılabilir | IP başına 10 dk'da 60 istek; sesli turda 2 istek | 120 | worker_sablon.js |
| 18 | İstem: düzeltme, çok kişi, anlamsız girdi, talimat değiştirme, bilinmiyor ≠ yok | — | "ZOR DURUMLAR" ve rapor kuralları | istemler.js |

Sözlüğe eklenenler (S01/S02): kendinden geçti, ayıltamıyor, göğse bastırma, zor nefes alıyor, bayılmış, kıpırdamıyor,
seslenince bakmıyor, bir yanı tutmuyor, nefes darlığı + çok zorlanıyor; "doktor istiyor(uz)".

## 4. Önce / sonra konuşmalar (taklit YZ; yalnızca istemci davranışı)

- **Kısa yol + acil (I02)** — Önce: "Soru sorma" → "Tamam, soruları geçiyorum…" → boş rapor ekranı; "babam nefes alamıyor"
  yazılamadı. Sonra: "Kimin için ve ne olduğunu tek cümleyle söyle" → "babam nefes alamıyor" → **acil ekranı**.
- **Geç cevap (J05)** — Önce: yeni sohbete eski isteğin cevabı ("ESKİ CEVAP") yazıldı. Sonra: yeni sohbet temiz.
- **Geçmiş belirti (D02)** — Önce: "Geçen yıl nefes darlığı yaşamıştı" → "Anladım." Sonra: "Bu belirti şu anda da var mı?"
- **Anlamsız (G01)** — Önce: üç anlamsız cümle → rapor ekranı. Sonra: sohbet sürüyor, rapor yok.
- **Fiyat (I04)** — Önce: YZ'ye gidip soru hakkı harcadı. Sonra: "Başlangıç fiyatları: hekim ev muayenesi 2500 TL…".

Tüm konuşmalar: `data/eval/sonuc/akis_once.json`, `akis_gelistirme.json`, `akis_ses.json`.

## 5. Kalan sorunlar ve sınırlar

- **Gerçek insan sesi denenmedi.** Sahte mikrofon dalgalı tondur; Whisper'ın gerçek Türkçe konuşmadaki (yöresel ağız, gürültü,
  yaşlı sesi) hataları ölçülmedi. Yankı denetimi metin benzerliğine dayanır; hoparlör yankısı gerçek cihazda denenmeli.
- **Canlı katman yetersiz:** Groq ücretsiz kotası denemeleri kesti; yeni istem canlıda doğrulanmadı. Birleşmeden sonra
  yeniden çalıştırılmalı (komut aşağıda). Canlıda görülen "diz → sırt" yanlış anlaması ve süre düzeltmesinin birleştirilmesi
  YZ katmanında; rapor denetimi (son süre beyanı) istemci tarafında düzeltir, sohbetteki "Anladığım" satırı düzeltmez.
- **Uzman değerlendirmesi gerekli:** "nefes darlığı yok değil" (STT çelişkisi mi, gerçek beyan mı), geçmiş nefes darlığı
  "şu an da biraz var" (hafif nefes darlığı 112 mi?), "bayıldı ama emin değilim, şimdi uyanık". Kaynaklar yeterli değil.
- Sağlık içeriği kapısı kelime listesine dayanır; listede olmayan bir şikâyetle anlatan kullanıcı YZ "hazır" dese de
  rapora geçemez (sohbet sürer, 3 sorudan sonra da). Yanlış pozitif zararsız, yanlış negatif can sıkıcı.
- Rapor denetimi kural tabanlıdır: alışılmadık ifadelerle söylenen yaş/ilaç beyanını görmeyebilir ve silebilir.
- Worker kodu değişti (yedek model atlama, 5xx yedeği, sınır 120): Cloudflare'e yeniden yapıştırılmalı. Yedek model
  listesi ayar.json'da olduğu için o kısım birleşince yapıştırmadan da çalışır.

## 6. Yeniden çalıştırma

```
cd efehan
python data/eval/sesli_katalog.py            # katalog (sabit tohum)
python data/build_db.py && python web/export_json.py && python web/build_web.py
python data/eval/sesli_kural.py              # kural, Python + JS
node web/test_rapor_denetim.mjs              # rapor denetimi
node web/test_sesli_senaryo.mjs              # ses katmanı
python web/e2e_senaryo.py                    # akış, yazı (taklit YZ)
python web/e2e_senaryo.py --ses              # akış, sesli (sentetik ton + gerçek VAD/MediaRecorder)
# yalnızca en sonda: sesli_kural.py --gizli · test_rapor_denetim.mjs --gizli · test_sesli_senaryo.mjs --gizli
# gerileme: python -m pytest -q tests · python eval_triage.py · python eval_zor.py · python web/parity_test.py
#           node web/test_sesli.mjs · node sunucu/test_worker.mjs · python web/e2e_*.py
```
Canlı: Kapıda sayfası açıkken `web/canli_test.js` içeriğini tarayıcı konsoluna yapıştır, `await canliKos(2, 5000)` (kota nedeniyle istekler arası 5 sn).
