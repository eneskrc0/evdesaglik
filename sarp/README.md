# Mesleki ve reçete doğrulama (Kapıda / anında sağlık)

Sarp'ın klasörü. Kapıda'nın tasarım diliyle hazırlanmış, tek dosyalık çalışan prototip: `dogrulama.html`.

## Ne yapar

**1. Mesleki doğrulama (sağlık çalışanı → doğrulama görevlisi)**
- Çalışan ilk girişte 3 adımda başvurur: meslek → e-Devlet barkodlu belgeler (YÖK Mezun Belgesi, diploma tescil, uzman hekimse uzmanlık belgesi) → gönder.
- Barkod belgeden otomatik çıkarılır (karekod → PDF metin katmanı → yapay zeka → elle). Barkodsuz belgeyle başvuru tamamlanmaz.
- Yapay zeka ön kontrol yapar (alan okuma, T.C. algoritması, ad uyumu, tarih mantığı, düzenleme yazılımı izi, karekodun gittiği adres). Ön kontrol bilgi verir, belgeyi tek başına düşürmez.
- Görevli "e-Devlet'te aç" ile barkod + T.C. sorgular, asıl belgeyi PDF olarak "Asıl belgeyi bırak" kutusuna bırakır. Sistem ad, T.C., okul, bölüm, tarih ve barkodu alan alan karşılaştırır: hepsi tutarsa onay önerir, farklı alan kırmızı görünür ve ret önerilir.
- Onaylanmayan çalışan görev kabul edemez. Onaylananlar Kapıda'ya giden onaylı listeye eklenir (JSON dışa aktarma).

**2. Reçete doğrulama (hasta → sağlık çalışanı)**
- Yalnızca reçete / hekim istemi gerektiren hizmetlerde devreye girer (reçeteli serum, kas içi iğne, sonda bakımı). Kapıda'da hastanın "doktorun planı / reçetesi var" dediği nokta.
- Hasta e-Reçete numarasını yazar, e-Nabız "Reçetelerim" ekranının görüntüsünü / PDF'ini ya da kağıt reçete fotoğrafını ekler.
- Yapay zeka ön kontrolü: reçete no, hasta, tarih, hekim, tesis, reçete türü ve ilaçları okur; numara, hasta adı, tarih ve hizmet uyumunu kontrol eder; kırmızı/yeşil/turuncu/mor (kontrole tabi) reçeteyi işaretler. İlacın tıbbi uygunluğunu değerlendirmez. Sonuç: uygun / dikkat / şüpheli.
- Kişisel kontrol: talebi kabul eden çalışan kapıda hastanın e-Nabız'ını görerek 5 maddelik listeyi işaretler (kimlik, reçete no, ilaç ve doz, tarih ve hekim, ilaç kutusu); isterse asıl reçete PDF'ini bırakıp alan alan karşılaştırır. Doğrulanmayan reçeteyle uygulama yapılmaz.
- Görevli "Reçete" sekmesinde tüm reçeteli talepleri ve kapı sonuçlarını denetler.

## Kişisel veri
- T.C. kayıtlarda yalnızca maskeli tutulur; eşleştirme için `SHA-256("bdv1:" + TC)` ilk 20 hane kullanılır.
- Görevlinin e-Devlet sorgusu için tam T.C. karar verilene kadar yalnızca görevlinin okuyabildiği alanda geçici durur, karar anında silinir (karara bağlanmayanlarda 7 gün).
- Yüklenen PDF ve görüntüler saklanmaz; tarayıcıda işlenir.

## Çalıştırma
- **claude.ai sürümü:** yapay zeka okuması ve ekipçe ortak kayıt açık. Roller: görevli/çalışan = Düzenleyici, hasta/başvuran = Katkıda bulunan.
- **Bu dosyayı doğrudan açınca (GitHub, raw.githack):** "yerel deneme" modunda çalışır; ekranlar, karşılaştırma, kilit ve kurallar çalışır, yapay zeka okuması ve ortak kayıt çalışmaz (veri yalnızca o tarayıcıda kalır).

## Kapıda'ya bağlama noktaları
- Mesleki doğrulama: `efehan/web/dogrulama.js` (şu an belgeleri resmî sistemden doğrulamıyor).
- Reçete: `efehan/web/kapida.js` içinde hastanın "reçete var" dediği ve `plan_detayi: "…belge ziyarette görülmeli."` notunun düştüğü yer.
- Onaylı liste: `kimlik_anahtari`, `ad_soyad`, `meslek`, `tc_maskeli`, `onay_tarihi`, `basvuru_no`, `durum` alanlarıyla JSON.

Prototip · gerçek sağlık bilgisi girmeyin.

## Kapıda'ya bağlandı (22.11)
- Reçete doğrulama Kapıda'nın içinde: hasta "doktorumun planı / reçetesi var" deyince seçenekler ekranında kart, talepte ön kontrol, çalışanın Rotam'ında kapıda 5 maddelik kontrol (`efehan/web/recete.js`, `efehan/web/belge.js`; prova `efehan/web/e2e_recete.py`).
- Mesleki doğrulama: `efehan/web/dogrulama.js` bu sayfadaki belge listesi, barkod zorunluluğu, dosya ön kontrolü ve görevli kontrol listesiyle güncellendi; asıl PDF'le alan alan karşılaştırma için görevli bu sayfaya yönlendirilir.
- Kapıda dış kütüphane yüklemediği için PDF içeriği orada okunmaz (pdf.js / jsQR bu sayfada var). Yapay zekâ okuması Kapıda'da sunucunun `/recete` adresinden gelir.
