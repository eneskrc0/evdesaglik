"""Temel tutarlılık testleri: çift rezervasyon yok, metrikler aralıkta, CRN tekrarlanabilir."""
import copy
import numpy as np
from sim import engine
from sim.world import SCENARIOS, make_requests, make_workers


def _setup(seed=0):
    sc = SCENARIOS["baz"]
    ws = make_workers(sc, np.random.default_rng([seed, 1]))
    r = np.random.default_rng([seed, 1, 2])
    for w in ws:
        w.reset_day(r)
    return sc, ws, make_requests(sc, r)


def test_no_double_booking():
    sc, ws, reqs = _setup()
    for pol in ["en_yakin", "en_erken", "rastgele"]:
        captured = {}
        orig = copy.deepcopy
        engine.copy.deepcopy = lambda x: captured.setdefault("w", orig(x))
        try:
            engine.run_day(sc, ws, reqs, pol, 0, 1)
        finally:
            engine.copy.deepcopy = orig
        for w in captured["w"]:
            b = sorted(w.blocks)
            for (s1, e1, *_), (s2, e2, *_) in zip(b, b[1:]):
                assert s2 >= e1 - 1e-6, (pol, w.id, b)


def test_metrics_in_range_and_reproducible():
    sc, ws, reqs = _setup()
    a = engine.run_day(sc, ws, reqs, "en_erken", 0, 1)
    b = engine.run_day(sc, ws, reqs, "en_erken", 0, 1)
    assert (a.accepted, a.on_time, a.notifications) == (b.accepted, b.on_time, b.notifications)
    assert 0 <= a.on_time <= a.accepted <= a.n_requests
    assert a.fit_within_5 <= a.n_requests
