# Birleşik demo (Enes + Efehan)

Tek sayfada uçtan uca akış, gerçek İzmir yol ağı üzerinde:

1. **Hasta derdini anlatır** (yazarak ya da 🎤 sesle). *Efehan: triyaj*
2. **Acil mi?** Kırmızı bayrak varsa randevu açılmaz, 112 / 114'e yönlendirilir. *Efehan*
3. **Hangi hizmet?** 22 hizmetlik kaynaklı katalogdan seçilir; hekim planı gerektiren hizmet plansız hastaya açılmaz (RG 29.03.2025). *Efehan*
4. **Kime bildirim gider?** Yapay zekâ v5, hizmete uygun meslekten 3 kişiyi seçer. *Enes: YZ bildirim*
5. **Fiyat:** Yapay zekâ bir fiyat önerir: seçilen 3 kişiden en az birinin uygun teklif verme olasılığını, fiyat sınırsız olsaydı ulaşılacak değerin %90'ında tutan en düşük fiyat. Çalışanlar önerinin ±%10'u içinde teklif verir. *Yeni (karma fiyat)*
6. **Teklifler** çalışan profiliyle (deneyim, puan, o hizmetteki ziyaret sayısı) ve **ziyaret paylaşımı indirimiyle** gelir. *Efehan: paylaşım; profil sentetik*
7. **Kabul** ve **canlı takip**: rota gerçek sokaklarda, kalan süre ve varış aralığı. *Enes*

## Açmak
`ortak/dist/izmir.html` (merkez İzmir, demo için pilot ölçeği: 60 hemşire, 20 doktor, 20 diğer meslek) veya `ortak/dist/bornova.html`. İnternet yalnızca harita hücre kütüphanesi için gerekir.

## Üretmek
```
python3 ortak/build.py
```
`enes/web/index.html` şablonunu temel alır, `efehan/web/core.js` ve `efehan/web/data.json`'u gömer, `ortak/ek.js` eklerini uygular.
Kaynak klasörlerde değişiklik yapmaz; şablon değişip bir yama tutmazsa betik hangi yamanın bozulduğunu söyleyerek durur.

## Sınırlamalar (dürüst not)
- Triyaj anahtar kelime kurallarıdır (bilerek: acil durumda tahmin değil kural). Klinisyen doğrulaması bekler.
- YZ fiyat önerisinin etkisi henüz simülasyonda **ölçülmedi**; Deney seti sekmesindeki sonuçlar eski (çalışan teklifi) fiyat düzenine aittir.
- Hemşire/doktor dışındaki meslekler (fizyoterapist vb.) demoya eklenmiş sentetik çalışanlardır; davranışları mevcut çalışanlardan kopyalanır.
- Çalışan profilleri (yıl, puan, ziyaret sayısı) sentetiktir.
- Video görüşme (TELE) canlandırılmaz.
