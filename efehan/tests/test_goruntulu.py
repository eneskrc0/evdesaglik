"""Görüntülü randevu takvimi: yol yok, ama çalışanın zamanını kaplar ve çakışmaz (routing.tele_baslangic, best_insertion)."""
import json
import subprocess
from pathlib import Path

from app.routing import TELE_TAMPON_MIN, best_insertion, tele_baslangic

EV = (38.46, 27.22)


def test_bos_takvimde_en_erken():
    assert tele_baslangic((540, 1020), [], 600, 20) == 600


def test_goruntulu_randevuyla_cakismaz():
    dolu = [{"start_min": 600, "duration_min": 20, "uzaktan": True}]
    assert tele_baslangic((540, 1020), dolu, 600, 20) == 620
    assert tele_baslangic((540, 1020), dolu, 590, 20) == 620  # 590-610 çakışır
    assert tele_baslangic((540, 1020), dolu, 570, 20) == 570  # 570-590 boş


def test_ev_ziyaretinin_cevresinde_yol_payi():
    dolu = [{"start_min": 600, "duration_min": 30, "lat": 38.47, "lon": 27.23}]
    assert tele_baslangic((540, 1020), dolu, 600, 20) == 630 + TELE_TAMPON_MIN


def test_gun_doluysa_yok():
    assert tele_baslangic((540, 600), [{"start_min": 540, "duration_min": 60, "uzaktan": True}], 540, 20) is None


def test_ev_ziyareti_goruntulu_randevunun_ustune_konmaz():
    hedef = (38.465, 27.215)
    serbest = best_insertion(EV, (540, 1020), [], hedef, 30, 600)
    dolu = [{"start_min": serbest.arrival_min, "duration_min": 60, "uzaktan": True}]
    ins = best_insertion(EV, (540, 1020), dolu, hedef, 30, 600)
    assert ins is not None and (ins.arrival_min >= serbest.arrival_min + 60 + TELE_TAMPON_MIN or ins.arrival_min + 30 + TELE_TAMPON_MIN <= serbest.arrival_min)
    assert not ins.shared  # görüntülü randevu rota paylaşımı sayılmaz


def test_js_ile_ayni_ekleme():
    kok = Path(__file__).resolve().parents[1] / "web"
    hedef = [38.465, 27.215]
    serbest = best_insertion(EV, (540, 1020), [], tuple(hedef), 30, 600)
    v = [[list(EV), [540, 1020], [{"start_min": serbest.arrival_min, "duration_min": 60, "uzaktan": True}], hedef, 30, 600],
         [list(EV), [540, 1020], [{"start_min": 620, "duration_min": 20, "uzaktan": True}, {"start_min": 700, "duration_min": 30, "lat": 38.47, "lon": 27.23}], hedef, 30, 600]]
    js = subprocess.run(["node", "-e", "const C=require('./core.js');const v=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(v.map(x=>{const r=C.bestInsertion(...x);return r&&[r.arrival_min,r.added_km,r.shared];})))"],
                        input=json.dumps(v), capture_output=True, text=True, cwd=kok, check=True).stdout
    py = [(lambda r: r and [r.arrival_min, r.added_km, r.shared])(best_insertion(tuple(h), tuple(w), s, tuple(t), d, e)) for h, w, s, t, d, e in v]
    assert json.loads(js) == py


def test_js_ile_ayni():
    kok = Path(__file__).resolve().parents[1] / "web"
    vakalar = [[[540, 1020], [], 600, 20], [[540, 1020], [{"start_min": 600, "duration_min": 20, "uzaktan": True}], 590, 20],
               [[540, 1020], [{"start_min": 600, "duration_min": 30, "lat": 1, "lon": 1}], 600, 20], [[540, 600], [{"start_min": 540, "duration_min": 60, "uzaktan": True}], 540, 20]]
    js = subprocess.run(["node", "-e", "const C=require('./core.js');const v=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(v.map(x=>C.teleBaslangic(...x))))"],
                        input=json.dumps(vakalar), capture_output=True, text=True, cwd=kok, check=True).stdout
    assert json.loads(js) == [tele_baslangic(tuple(w), s, e, d) for w, s, e, d in vakalar]
