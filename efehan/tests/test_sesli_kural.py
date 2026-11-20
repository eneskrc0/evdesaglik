"""Sesli sohbet testlerinde bulunan kural motoru açıklarının gerileme testleri (sentetik cümleler)."""
from app.db import Patient, Repo
from app.text import normalize
from app.triage import konusma_degerlendir, triage

R = Repo()
PT = Patient("X", "Bornova", 38.46, 27.22, False, False)
acil = lambda t: triage(R, t, PT).is_emergency
deg = lambda *m: konusma_degerlendir(R, list(m), PT)


def test_cift_olumsuz_olumludur():
    assert acil("Göğüs ağrım yok diyemem")
    assert acil("Kanaması yok değil, durmuyor")
    assert normalize("yok değil") == " var "


def test_ek_ve_ara_kelime():
    assert acil("Annemin kanaması durmuyor")          # iyelik eki
    assert acil("İki yıl önce inme geçirdi, şimdi kolu yine tutmuyor")  # araya giren kelime
    assert not acil("Kalp hastası, sinir krizi geçirdi")  # en fazla bir ara kelime: uzak kelimeler birleşmez


def test_olumsuz_cumledeki_organ():
    assert not acil("Babamın göğüs ağrısı yok, ama dizi ağrıyor")
    assert not acil("Babamda göğüs ağrısı falan yok, sırtı ağrıyor")
    assert acil("Göğsümde ağrı yok, baskı var")  # söz düşmesi: baskı göğüste


def test_ses_tanima_bolmesi():
    assert acil("nefes ala miyorum") and acil("kana ma durmuyor") and acil("yüzü kay dı konuşamıyor")
    assert deg("hem şire lazım")["meslek"] == "hemsire"
    assert normalize("çok yorgun") == " cok yorgun "  # gerçek kelimeler birleşmez


def test_duzeltmede_son_meslek():
    assert deg("Hemşire istiyorum… aslında fizyoterapist lazım")["meslek"] == "fizyoterapist"
    assert deg("Doktor istiyorum, yok yok hemşire gelsin")["meslek"] == "hemsire"
    assert deg("pansuman için hemşire istiyorum")["meslek"] == "hemsire"


def test_gecmis_belirti_sorulur():
    assert deg("Geçen yıl bayılmıştı")["gecmis"]
    assert not deg("Geçen yıl bayılmıştı, şimdi gayet iyi")["gecmis"]  # şu anki durum söylendi
    assert not deg("Bayılmadı")["gecmis"]                              # olumsuzluk sorulmaz
    assert deg("Geçen ay bayılmıştı, şimdi yine bayıldı")["acil"]


def test_saglik_icerigi():
    assert not deg("Patates uzaya çıktı")["saglik"]
    assert not deg("Bugün hava çok güzel")["saglik"]
    assert not deg("Hemşire istiyorum")["saglik"]  # meslek adı tek başına içerik değildir
    assert deg("Annemin bacağında yara var")["saglik"]


def test_gizli_grupta_bulunan_kelime_aciklari():
    # Gizli grubun ilk koşusunda kaçan ifadeler (20.11): artık acil
    assert acil("Babam kıpırdamıyor, seslenince bakmıyor")
    assert acil("Annemin bir yanı tutmuyor")
    assert acil("Nefes darlığı yok. aslında var, şu an çok zorlanıyor")
    assert not acil("Nefes darlığı yok ama yürürken çok zorlanıyor")
