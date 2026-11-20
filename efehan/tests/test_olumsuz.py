"""Kırmızı bayrak: olumsuzluk, zaman, ağız ve çelişki (GPT testi 20.11 ve zorlayıcı setler)."""
from app.db import Patient, Repo
from app.text import normalize
from app.triage import triage

R = Repo()
P = Patient("T", "Bornova", 38.46, 27.22, False, False)
acil = lambda t: triage(R, t, P).is_emergency


def test_olumsuz_acil_degil():
    for t in ["Göğüs ağrım yok", "Nöbet geçirmedi ama ateşi var", "Göğüs ağrısı olmuyor sırtı ağrıyor", "Zehirlenme değil sanırım mide bulantısı var"]:
        assert not acil(t), t


def test_olumsuz_yan_cumle_diger_acili_gizlemez():
    assert acil("Göğüs ağrısı yok ama nefes alamıyorum")
    assert acil("Göğsümde ağrı yok, baskı var")


def test_yoklugun_kendisi_belirti():
    for t in ["Bilinci yok uyandıramıyoruz", "Nefesi yok", "Babam kendinde değil"]:
        assert acil(t), t


def test_celiskide_guvenli_taraf():
    assert acil("Göğüs ağrım yok, yani aslında biraz var")


def test_eski_olay_ama_simdi_yine():
    assert not acil("Geçen yıl kalp krizi geçirdi şimdi kontrol istiyoruz")
    assert acil("2 yıl önce felç geçirdi şimdi yine konuşamıyor")


def test_agiz_yor_dusmesi():
    assert normalize("alamıyo yapıyom durmuyo") == " alamiyor yapiyorum durmuyor "
    assert acil("Nefes alamıyo gari") and acil("kanama durmuyo")
