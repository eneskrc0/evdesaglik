"""Kapıda'daki YZ bildirim modeli (teklif.js) = Enes'in simülasyondaki modeli mi? Çalıştır: python web/model_parity.py
1) Olasılık: teklif.js olasilik(x) ile enes/sim/models.SabitLR aynı (1000 rastgele vektör).
2) Özellik tanımları: yoğun saat (engine.is_peak), bütçe farkı, sıra (FEATURE_NAMES) aynı.
3) v5 seçimi: teklif.js sec() ile enes/sim/engine.select_with_policy aynı üçlüyü seçiyor (rastgele aday listeleri).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "enes"))
from sim import engine  # noqa: E402
from sim.models import SabitLR  # noqa: E402

MP = ROOT / "enes" / "data" / "izmir" / "model_v5_demo_lr.json"
M = json.loads(MP.read_text(encoding="utf-8"))
rng = np.random.default_rng(5)
X = np.c_[rng.uniform(2, 90, 1000), rng.uniform(0, 60, 1000), rng.uniform(-30, 150, 1000), rng.uniform(8, 19, 1000), rng.integers(0, 2, 1000),
          rng.integers(0, 2, 1000), rng.uniform(0, 1, 1000), rng.uniform(0, 1, 1000), rng.uniform(0, 1, 1000), rng.uniform(-0.5, 0.5, 1000),
          rng.integers(0, 2, 1000), rng.integers(0, 2, 1000)]
py = SabitLR(MP).predict_proba(X)[:, 1]
ok = 0


def check(c, m):
    global ok
    assert c, m
    ok += 1
    print("  ✓", m)


check(M["ozellikler_kod"] == list(engine.FEATURE_NAMES), "özellik sırası simülasyondakiyle aynı (12)")
# v5 seçim testleri için aday listeleri
cases = []
for _ in range(300):
    n = int(rng.integers(3, 11))
    cases.append([{"pid": f"W{i}", "p": float(rng.uniform(0.02, 0.9)), "yolDk": float(rng.uniform(3, 80)),
                   "bildirim": int(rng.integers(0, 6)), "ziyaretBugun": int(rng.integers(0, 6))} for i in range(n)])
js_src = (Path(__file__).resolve().parent / "teklif.js").read_text(encoding="utf-8")
node = f"""
const T = (function(){{ const module = {{exports:{{}}}}; {js_src}; return module.exports; }})();
const M = {json.dumps(M)};
const K = T.create(M, null);
const X = {json.dumps(X.tolist())};
const cases = {json.dumps(cases)};
const yogun = []; for (let m = 0; m < 1440; m++) yogun.push(K.ozellikler({{pid:"x", meslek:"hemsire", yolDk:10, enErkenVaris:m, pencereSonu:m+60, simdi:m, taban:1000, carpan:1}}).ham.yogun_saat);
const butce = K.ozellikler({{pid:"x", meslek:"hemsire", yolDk:10, enErkenVaris:600, pencereSonu:660, simdi:600, taban:1000, carpan:1.2, butce:1500}}).ham.butce_farki;
process.stdout.write(JSON.stringify({{p: X.map(x => K.olasilik(x)), yogun, butce, sec: cases.map(c => K.sec(c).secilen.map(a => a.pid).sort())}}));
"""
out = json.loads(subprocess.run(["node"], input=node, capture_output=True, text=True, check=True).stdout)
d = np.abs(np.array(out["p"]) - py)
check(d.max() < 1e-9, f"olasılık JS = Python (1000 vektör, en büyük fark {d.max():.1e})")
check(out["yogun"] == [int(engine.is_peak(m)) for m in range(1440)], "yoğun saat tanımı aynı (08–10, 17–19)")
check(abs(out["butce"] - (1500 - 1000 * 1.2) / 1000) < 1e-12, "bütçe farkı formülü aynı")

# Python v5 seçimi: enes/sim/engine.select_with_policy'deki aynı adımlar (adj sırası + başarı garantisi döngüsü)
def py_sec(p, tt, load, vis, a, b, c, alpha, K):
    adj = p - a * tt / 30.0 - b * load - c * vis
    order = [int(i) for i in np.argsort(-adj, kind="stable")]
    k = min(K, len(p))
    by_p = [int(i) for i in np.argsort(-p, kind="stable")]
    s_star = 1 - np.prod(1 - p[by_p[:k]])
    chosen = order[:k]
    while 1 - np.prod(1 - p[chosen]) < alpha * s_star:
        worst = min(chosen, key=lambda i: p[i])
        nxt = next((i for i in by_p if i not in chosen), None)
        if nxt is None or p[nxt] <= p[worst]:
            break
        chosen[chosen.index(worst)] = nxt
    return chosen


k = M["v5"]["kural"]
esit = 0
for ci, c in enumerate(cases):
    arr = lambda key: np.array([x[key] for x in c], float)
    sel = py_sec(arr("p"), arr("yolDk"), arr("bildirim"), arr("ziyaretBugun"), k["a"], k["b"], k["c"], k["alpha"], M["v5"]["bildirim_sayisi"])
    esit += sorted(c[i]["pid"] for i in sel) == out["sec"][ci]
check(esit == len(cases), f"v5 seçimi JS = Python ({esit}/{len(cases)})")
print(f"\nTamam: {ok} kontrol geçti.")
