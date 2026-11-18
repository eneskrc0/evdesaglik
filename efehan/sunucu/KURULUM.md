# Kapıda yapay zekâ sunucusu — kurulum (≈15 dk, ücretsiz)

Uygulama Claude dışında (GitHub sayfası, telefon) açıldığında gerçek yapay zekâyı bu küçük sunucu üzerinden kullanır.
Sunucu yapay zekâ anahtarını saklar; anahtar uygulamaya ya da GitHub'a **asla** konmaz (depo herkese açık).

Kullanılanlar: **Groq** (ses → yazı: Whisper large-v3; sohbet: `openai/gpt-oss-120b`; fotoğraf: Qwen 3.8 27B) ve
**Cloudflare Workers** (anahtarı saklayan sunucu). İkisinin de ücretsiz planı prototip için yeterli; sınırlar değişebilir.

## 1. Groq anahtarı
1. https://console.groq.com adresinde hesap aç.
2. **API Keys → Create API Key**. Çıkan anahtarı kopyala (bir daha gösterilmez).
3. Anahtarı kimseyle paylaşma; sohbete, WhatsApp'a, GitHub'a yazma.

## 2. Cloudflare Worker
1. https://dash.cloudflare.com adresinde hesap aç.
2. **Workers & Pages → Create → Create Worker** (Hello World) → ad ver (ör. `kapida`) → **Deploy**.
3. **Edit code**: içindeki her şeyi sil, `efehan/sunucu/worker.js` dosyasının **tamamını** yapıştır → **Deploy**.
   (GitHub'da dosyayı açıp sağ üstteki "Copy raw file" düğmesiyle kopyalayabilirsin.)
4. Worker sayfasında **Settings → Variables and Secrets → Add**:
   - Type: **Secret**, Name: `GROQ_API_KEY`, Value: Groq anahtarın → **Deploy**.
5. Worker'ın adresini kopyala: `https://kapida.<hesap-adın>.workers.dev`.
   Tarayıcıda açınca `{"ok":true,...,"anahtar":true}` görmelisin. `"anahtar":false` ise 4. adımı kontrol et.

## 3. Uygulamaya bağla
- Hemen denemek için: uygulama adresinin sonuna `?sunucu=https://kapida.<hesap-adın>.workers.dev` ekle.
- Kalıcı: adresi `efehan/sunucu/adres.txt` dosyasına yaz, `python efehan/web/build_web.py` çalıştır (ya da Claude'a "sunucu adresi şu, uygulamaya bağla" de).
- Sunucu yalnızca `https://eneskrc0.github.io`, `https://raw.githack.com` ve `localhost:8000`'den gelen istekleri kabul eder.
  Başka bir adreste yayınlarsanız Cloudflare'de `IZINLI_KOKENLER` adlı (Text) değişkene virgülle ayrılmış adresleri yazın.

## Canlı ayar (Cloudflare'e dokunmadan güncelleme)
Sunucu; sohbet talimatını, rapor şablonunu, ses ipucunu, hizmet listesini ve model adlarını her dakika
GitHub'daki `efehan/sunucu/ayar.json`'dan okur (`main` dalı). `build_web.py` bu dosyayı `istemler.js`'ten üretir.
Değişiklik main'e birleştirilince GitHub önbelleği yüzünden ~5 dakika içinde canlıya geçer. Sunucunun hangi
sürümü kullandığı `https://kapida.<hesap>.workers.dev/` adresinde görünür (`"ayar"` ve `"ayar_kaynagi": "github"`).
GitHub'a ulaşılamazsa ya da dosya bozuksa sunucu, `worker.js`'e gömülü talimatla çalışmaya devam eder.
Kapatmak için Cloudflare'de `AYAR_URL` = `yok` (Text) ekleyin.

## Güncelleme (yalnızca sunucu KODU değişince)
`istemler.js` ya da `worker_sablon.js` değişince `python efehan/web/build_web.py` yeni `worker.js` üretir; Cloudflare'de
**Edit code**'a yeniden yapıştırıp **Deploy** de. Anahtar ayarı korunur.

## Bilgisayarda deneme (Cloudflare'siz)
```
cd efehan
GROQ_API_KEY=... node sunucu/yerel_sunucu.mjs        # ya da sahte YZ ile: SAHTE=1 node sunucu/yerel_sunucu.mjs
python -m http.server 8000 -d web/dist                 # ayrı terminalde
# tarayıcı: http://localhost:8000/kapida.html?sunucu=http://localhost:8787
```
Testler: `node sunucu/test_worker.mjs` (sunucu, 16 kontrol) · `python web/e2e_sunucu.py` (uygulama + sunucu + sahte mikrofon, 15 kontrol).

## Sınırlar ve dürüst notlar
- Ücretsiz katman dakikalık/günlük istek sınırlıdır; yoğunlukta uygulama "Şu an çok yoğunum" der.
- Sunucu hiçbir şeyi kaydetmez; mesajlar yalnızca Groq'a iletilir. Prototipte **gerçek hasta bilgisi girmeyin**.
- Acil kararı yapay zekâda değil, telefondaki kural motorundadır (mesaj sunucuya gitmeden önce kontrol edilir).
- Sesli cevap telefonun kendi Türkçe sesiyle okunur; kalitesi cihaza göre değişir.
