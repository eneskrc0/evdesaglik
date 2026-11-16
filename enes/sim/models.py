"""Model kayıt defteri.

Yeni bir model denemesi = buraya yeni bir isimle eklenen fonksiyon. Eski isimler
DEĞİŞTİRİLMEZ; böylece her sonuç hangi modelden geldiği bilinerek tekrar üretilebilir.
Her fonksiyon (X, y, seed) alır ve predict_proba sağlayan eğitilmiş model döndürür.
"""
from __future__ import annotations

from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def gbm_v1(X, y, seed):
    """Referans model (v0.3): gradient boosting, 12 özellik."""
    return HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, max_leaf_nodes=15,
                                          random_state=seed).fit(X, y)


def gbm_v2(X, y, seed):
    """Daha derin gradient boosting, iç doğrulama ile erken durdurma."""
    return HistGradientBoostingClassifier(max_iter=600, learning_rate=0.03, max_leaf_nodes=31, min_samples_leaf=40,
                                          l2_regularization=1.0, early_stopping=True, validation_fraction=0.15,
                                          n_iter_no_change=30, random_state=seed).fit(X, y)


def gbm_v3(X, y, seed):
    """Sığ ve düzenli gradient boosting (aşırı öğrenmeye karşı)."""
    return HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=7, min_samples_leaf=80,
                                          l2_regularization=2.0, random_state=seed).fit(X, y)


def logreg_v1(X, y, seed):
    """Basit karşılaştırma: lojistik regresyon (demo sayfasındaki modele denk)."""
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(X, y)


class Capped:
    """Bir modeli günlük kota kurallarıyla sarar (yalnızca model yöntemine uygulanır).
    notif_cap: çalışana günde en fazla bu kadar bildirim gider.
    visit_cap: çalışan günde en fazla bu kadar platform ziyareti alır."""

    def __init__(self, base, notif_cap=None, visit_cap=None, soft=False):
        self.base, self.notif_cap, self.visit_cap, self.soft = base, notif_cap, visit_cap, soft

    def predict_proba(self, X):
        return self.base.predict_proba(X)


def capped(base_fn, notif_cap=None, visit_cap=None, soft=False):
    def fn(X, y, seed):
        return Capped(base_fn(X, y, seed), notif_cap, visit_cap, soft)
    fn.__doc__ = (f"{base_fn.__name__} + günlük {'yumuşak' if soft else 'sert'} kota "
                  f"(bildirim={notif_cap}, ziyaret={visit_cap})")
    return fn


class Policy:
    """Model + karar kuralları (sim/engine.select_with_policy)."""

    def __init__(self, base, cfg):
        self.base, self.cfg = base, dict(cfg)

    def predict_proba(self, X):
        return self.base.predict_proba(X)


class PolicyCapped(Policy):
    """Karar kuralları + günlük kota birlikte (izmir_orta denemeleri)."""

    def __init__(self, base, cfg, notif_cap=None, visit_cap=None, soft=False):
        super().__init__(base, cfg)
        self.notif_cap, self.visit_cap, self.soft = notif_cap, visit_cap, soft


def policy_capped(base_fn, notif_cap=None, visit_cap=None, soft=False, **cfg):
    def fn(X, y, seed):
        return PolicyCapped(base_fn(X, y, seed), cfg, notif_cap, visit_cap, soft)
    fn.__doc__ = f"{base_fn.__name__} + karar kuralları {cfg} + günlük {'yumuşak' if soft else 'sert'} kota (bildirim={notif_cap}, ziyaret={visit_cap})"
    return fn


def policy(base_fn, **cfg):
    def fn(X, y, seed):
        return Policy(base_fn(X, y, seed), cfg)
    fn.__doc__ = f"{base_fn.__name__} + karar kuralları {cfg}"
    return fn


def get_model(name):
    """Kayıtlı isim ya da deneme için 'pol:a=0.1,b=0.02,online=1' biçimi."""
    if name in MODELS:
        return MODELS[name]
    if name.startswith("pol:"):
        cfg = {}
        for kv in name[4:].split(","):
            k, v = kv.split("=")
            cfg[k] = float(v)
        base = {1: gbm_v1, 2: gbm_v2, 3: gbm_v3}[int(cfg.pop("base", 1))]
        caps = {k: cfg.pop(k) for k in ("nc", "vc", "soft") if k in cfg}
        if caps:  # ör. 'pol:a=0.6,b=0.06,c=0.15,alpha=0.95,base=3,vc=3,soft=1'
            return policy_capped(base, notif_cap=int(caps["nc"]) if "nc" in caps else None,
                                 visit_cap=int(caps["vc"]) if "vc" in caps else None, soft=bool(caps.get("soft", 0)), **cfg)
        return policy(base, **cfg)
    raise KeyError(name)


MODELS = {
    "gbm_v1": gbm_v1,
    "logreg_v1": logreg_v1,
    "gbm_v2": gbm_v2,
    "gbm_v3": gbm_v3,
}
# Sürümler (v1 = gbm_v1)
MODELS["v2_adil"] = policy(gbm_v1, b=0.08, c=0.1)
MODELS["v3_garanti"] = policy(gbm_v1, b=0.08, c=0.1, alpha=0.95)
MODELS["v4_mesafe"] = policy(gbm_v1, a=0.7, b=0.08, c=0.1, alpha=0.95)
MODELS["v5_denge"] = policy(gbm_v3, a=0.6, b=0.06, c=0.15, alpha=0.95)
# izmir_orta (2026-11-16): v5 kuralları + sert günlük ziyaret kotası 5 (arama: results/izmir_orta/arama_ozet.csv)
MODELS["v5_kota5"] = policy_capped(gbm_v3, visit_cap=5, a=0.6, b=0.06, c=0.15, alpha=0.95)
# Demo sayfasının kullandığı bileşim: lojistik regresyon + v5 kuralları
MODELS["v5_demo_lr"] = policy(logreg_v1, a=0.6, b=0.06, c=0.15, alpha=0.95)
for _n in (4, 6, 8, 10, 12):
    MODELS[f"gbm_v1_bkota{_n}"] = capped(gbm_v1, notif_cap=_n)
for _v in (2, 3, 4, 5):
    MODELS[f"gbm_v1_zkota{_v}"] = capped(gbm_v1, visit_cap=_v)
for _n in (4, 6, 8):
    MODELS[f"gbm_v1_ybkota{_n}"] = capped(gbm_v1, notif_cap=_n, soft=True)
for _v in (2, 3):
    MODELS[f"gbm_v1_yzkota{_v}"] = capped(gbm_v1, visit_cap=_v, soft=True)
