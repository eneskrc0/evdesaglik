"""Eğitilmiş bildirim modelini (lojistik regresyon) JSON'a kaydet — Kapıda uygulaması için.

Model, demo sayfasında her açılışta yeniden eğitiliyordu; burada bir kez, izmir_tam dünyasında (toplu taşıma dahil)
geliştirme tohumlarının (0–9) keşif günlerinden toplanan veriyle eğitilip sabitlenir.
  p(uygun teklif ≤ 5 dk) = 1 / (1 + exp(-(b + Σ w_j · (x_j − mu_j) / sd_j)))
Ölçüm: AUC ayrılmış tohumların (1000–1009) keşif verisinde; 5 dk uygun teklif oranı ayrılmış tohumlarda, BU SABİT model ile
(MODELS['lr_sabit_*'], her tohumda yeniden eğitim yok).

    DUNYA=izmir OLCEK=tam OMP_NUM_THREADS=1 python -m sim.export_model
Çıktı: data/izmir/model_v5_demo_lr.json
"""
from __future__ import annotations

import json
import os
from concurrent.futures import ProcessPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score

from . import experiment as E
from .engine import FEATURE_NAMES, NOTIFY_K, ROUND_WAIT, run_day
from .world import SCENARIOS, SERVICES, make_requests, make_workers

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "izmir" / "model_v5_demo_lr.json"
FEAT_TR = ["yol süresi", "boşalmaya kalan", "aralık payı", "saat", "yoğun saat", "ziyarette", "geçmiş yanıt",
           "hızlı yanıt", "yoğun saat yanıtı", "bütçe farkı", "bütçe var", "doktor"]
KURAL_DEMO = {"a": 0.6, "b": 0.06, "c": 0.15, "alpha": 0.95}            # v5_demo_lr (demo sayfası)
KURAL_TRAFIK = {"a": 0.3, "b": 0.03, "c": 0.08, "alpha": 0.95}          # v5_ukota_trafik (izmir_tam seçilen)


def collect(seed: int, scn: str = "baz"):
    """run_seed'in 1–2. adımları: rastgele bildirimli keşif günleri → (X, y) ve çalışan geçmiş profilleri."""
    sc = SCENARIOS[scn]
    workers = make_workers(sc, np.random.default_rng([seed, 1]))
    day = 0

    def new_day():
        nonlocal day
        day += 1
        r = np.random.default_rng([seed, day, 2])
        for w in workers:
            w.reset_day(r)
        return make_requests(sc, r)

    logs = []
    for _ in range(E.HIST_DAYS):
        logs += run_day(sc, workers, new_day(), "rastgele", seed, day, log=True).log
    hist = E.build_history(logs)
    for w in workers:
        hist.setdefault(w.id, {"resp_rate": 0.5, "fast_rate": 0.5, "peak_resp_rate": 0.5})
    E._price_hist(hist, logs, workers)
    train = []
    for _ in range(E.TRAIN_DAYS):
        train += run_day(sc, workers, new_day(), "rastgele", seed, day, hist=hist, log=True).log
    X = np.array([f for f, *_ in train])
    y = np.array([l for _, l, *_ in train])
    allh = E.build_history(logs + train)
    for w in workers:
        allh.setdefault(w.id, {"resp_rate": 0.5, "fast_rate": 0.5, "peak_resp_rate": 0.5})
    E._price_hist(allh, logs + train, workers)
    prof = [(w.role, allh[w.id]["resp_rate"], allh[w.id]["fast_rate"], allh[w.id]["peak_resp_rate"], allh[w.id]["price_mult"])
            for w in workers]
    return X, y, prof


def _holdout(name):
    rows = []
    for s in range(1000, 1010):
        for r in E.run_seed("baz", s, model_name=name):
            r["model_adi"] = name
            rows.append(r)
    return rows


def main():
    from . import models as M
    with ProcessPoolExecutor(os.cpu_count()) as ex:
        dev = list(ex.map(collect, range(10)))
        hold = list(ex.map(collect, range(1000, 1010)))
    X = np.vstack([d[0] for d in dev]); y = np.concatenate([d[1] for d in dev])
    pipe = M.logreg_v1(X, y, 0)
    sc, lr = pipe.named_steps["standardscaler"], pipe.named_steps["logisticregression"]
    Xh = np.vstack([d[0] for d in hold]); yh = np.concatenate([d[1] for d in hold])
    auc_dev = roc_auc_score(y, pipe.predict_proba(X)[:, 1])
    auc_h = roc_auc_score(yh, pipe.predict_proba(Xh)[:, 1])
    obj = {
        "ad": "v5_demo_lr",
        "aciklama": "Bildirim modeli: bir çalışana bildirim gönderilirse 5 dk içinde hastanın saatine ve bütçesine uygun teklif "
                    "verme olasılığı. p = 1/(1+exp(-(b + Σ w_j·(x_j−mu_j)/sd_j))). Özellik sırası 'ozellikler' ile aynı olmalı.",
        "dunya": "izmir_tam (İzmir, 9 meslek, TomTom trafiği, çalışanların %40'ı toplu taşıma), sentetik veri",
        "egitim": {"tohumlar": "0-9 (geliştirme)", "gun": f"{E.HIST_DAYS} geçmiş + {E.TRAIN_DAYS} eğitim günü/tohum, rastgele bildirim",
                   "ornek": int(len(y)), "pozitif_oran": round(float(y.mean()), 4),
                   "yontem": "sklearn StandardScaler + LogisticRegression(C=1, L2); sd = nüfus std (ddof=0), JS trainLogReg ile aynı tanım"},
        "tarih": str(date.today()),
        "ozellikler": FEAT_TR,
        "ozellikler_kod": list(FEATURE_NAMES),
        "ozellik_tanimi": [
            "yol süresi: çalışanın şu anki/boşalacağı konumdan hastaya tahmini yol süresi, dk (kendi ulaşımıyla; araba +6 dk park)",
            "boşalmaya kalan: çalışanın elindeki işi bitirmesine kalan dk (boşsa 0)",
            "aralık payı: hastanın istediği aralığın bitişi − çalışanın en erken varışı, dk",
            "saat: talep anı, saat (ör. 13.5)",
            "yoğun saat: 1/0 (sabah 8–10 veya akşam 17–19 zirvesi; engine.is_peak)",
            "ziyarette: 1/0, çalışan şu an bir ziyarette",
            "geçmiş yanıt: çalışanın geçmişte bildirimlere teklif verme oranı (az veride 0,5'e büzülmüş); yeni çalışan 0,5",
            "hızlı yanıt: 5 dk içinde teklif verme oranı; yeni çalışan 0,5",
            "yoğun saat yanıtı: zirve saatlerdeki teklif oranı; yoksa geçmiş yanıt",
            "bütçe farkı: (hasta bütçesi − taban ücret × çalışanın fiyat çarpanı) / taban ücret; bütçe yoksa 0",
            "bütçe var: 1/0",
            "doktor: 1/0, hizmet doktor mesleğine ait",
        ],
        "mu": [float(v) for v in sc.mean_],
        "sd": [float(v) for v in sc.scale_],
        "w": [float(v) for v in lr.coef_[0]],
        "b": float(lr.intercept_[0]),
        "v5": {
            "bildirim_sayisi": int(NOTIFY_K),
            "tur_bekleme_dk": float(ROUND_WAIT),
            "kural": KURAL_DEMO,
            "kural_aciklama": "adj = p − a·yol_dk/30 − b·(çalışanın bugün aldığı bildirim) − c·(bugünkü platform ziyareti). adj'e göre "
                              "sırala, ilk 3'ü al; sonra garanti: 1−Π(1−p) üçlüsü, p'ye göre en iyi üçlünün alpha katından küçükse en düşük "
                              "p'liyi en yüksek p'li dışarıdakiyle değiştir. 5 dk'da uygun teklif yoksa 2. tur: sıradaki 3 kişi.",
            "kural_trafik_onerilen": dict(KURAL_TRAFIK, gunluk_ziyaret_kotasi="round(2.5 + 2 × günlük talep / çalışan)"),
        },
        "olcum": {"auc_egitim": round(float(auc_dev), 4), "auc_ayrilmis": round(float(auc_h), 4)},
    }
    # geçmiş profil dağılımı (yeni çalışan için varsayılan + meslek bazında yüzdelikler)
    prof = [p for d in dev for p in d[2]]
    q = lambda v: {k: round(float(x), 3) for k, x in zip(["p10", "p25", "p50", "p75", "p90"], np.percentile(v, [10, 25, 50, 75, 90]))}
    gec = {"yeni_calisan": {"resp": 0.5, "fast": 0.5, "peak": 0.5, "priceMult": 1.0}, "tum": {}, "meslek": {}}
    keys = ["resp", "fast", "peak", "priceMult"]
    for j, k in enumerate(keys):
        gec["tum"][k] = q([p[1 + j] for p in prof])
    for role in sorted({p[0] for p in prof}):
        rp = [p for p in prof if p[0] == role]
        gec["meslek"][role] = {"n": len(rp), **{k: q([p[1 + j] for p in rp]) for j, k in enumerate(keys)}}
    obj["gecmis"] = gec
    OUT.write_text(json.dumps(obj, ensure_ascii=False, indent=1))
    print("yazıldı (ön):", OUT, "AUC", obj["olcum"])
    # sabit modelle ayrılmış tohum ölçümü
    from importlib import reload
    reload(M)
    with ProcessPoolExecutor(os.cpu_count()) as ex:
        res = list(ex.map(_holdout, ["lr_sabit_demo", "lr_sabit_trafik"]))
    import pandas as pd
    df = pd.DataFrame([r for rs in res for r in rs])
    m = df[df.yontem == "model"].groupby("model_adi").uygun_teklif_5dk.mean()
    k = df[(df.yontem == "en_yakin") & (df.model_adi == "lr_sabit_demo")].uygun_teklif_5dk.mean()
    obj["olcum"].update({
        "uygun5_ayrilmis_kural_v5": round(100 * float(m["lr_sabit_demo"]), 1),
        "uygun5_ayrilmis_kural_trafik": round(100 * float(m["lr_sabit_trafik"]), 1),
        "uygun5_ayrilmis_klasik_kural": round(100 * float(k), 1),
        "aciklama": "Baz senaryo, ayrılmış tohumlar 1000–1009, 10'ar test günü; bu JSON'daki sabit model. Yüzde = 5 dk içinde "
                    "uygun teklif alan hasta oranı. Karşılaştırma: aynı dünyada GBM v1 %70,6, seçilen v5_ukota_trafik %70,1.",
    })
    OUT.write_text(json.dumps(obj, ensure_ascii=False, indent=1))
    print(json.dumps(obj["olcum"], ensure_ascii=False))


if __name__ == "__main__":
    main()
