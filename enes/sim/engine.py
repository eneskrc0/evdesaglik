"""Olay tabanlı gün simülatörü.

Aynı talepler ve aynı başlangıç takvimleriyle farklı bildirim yöntemleri
karşılaştırılır. Çalışan kararları (yanıt verir mi, kaç dk sürer, ücret,
gecikmeler) (tohum, gün, talep, çalışan) anahtarlı rastgele sayılarla üretilir:
aynı çalışana aynı talep gönderilirse her yöntemde aynı davranışı gösterir.
"""
from __future__ import annotations

import copy
import heapq
from dataclasses import dataclass, field

import numpy as np

from . import geo
from .world import SERVICES, Request, Scenario, Worker

NOTIFY_K = 3  # her turda bildirim gönderilen kişi sayısı
ROUND_WAIT = 5.0  # ikinci tura kadar bekleme (dk)
DECIDE_MAX = 10.0  # hastanın en geç karar anı (talepten sonra dk)
SEARCH_K = 6  # H3 halka yarıçapı (res 8'de ~5 km)
OVER_BUDGET_ACCEPT_P = 0.35  # yalnızca bütçe üstü teklif varsa kabul etme olasılığı


def is_peak(t: float) -> bool:
    h = t / 60.0
    return 8 <= h < 10 or 17 <= h < 19


@dataclass
class Offer:
    worker: int
    t: float  # teklifin geldiği an
    arrival: float
    price: float
    fits: bool


@dataclass
class DayResult:
    n_requests: int = 0
    fit_within_5: int = 0
    accepted: int = 0
    on_time: int = 0
    over_budget_accepted: int = 0
    notifications: int = 0
    notif_per_worker: dict = field(default_factory=dict)
    log: list = field(default_factory=list)  # model eğitimi için (özellikler, etiket)
    by_district: dict = field(default_factory=dict)  # ilçe -> [talep, 5dk uygun teklif, zamanında]
    visits: list = field(default_factory=list)  # kabul edilen ziyaretler: (çalışan, ücret, bütçe, yol dk, hizmet)
    first_fit_wait: list = field(default_factory=list)  # uygun teklif alan talepler için ilk uygun teklife kadar dk


def _rng(seed, day, rid, wid):
    return np.random.default_rng([seed, day, rid, wid + 1])


def worker_response(sc: Scenario, w: Worker, req: Request, t: float, seed: int, day: int):
    """Bildirim alan çalışanın davranışı. Teklif yoksa None."""
    r = _rng(seed, day, req.id, w.id)
    _, _, in_visit = w.position_and_free(t)
    p = w.resp_p * (sc.peak_factor if (is_peak(t) and w.peak_sensitive) else 1.0) * (0.6 if in_visit else 1.0)
    respond = r.random() < p
    lo, hi = sc.long_delay if w.long_delay else sc.short_delay
    delay = r.uniform(lo, hi)
    price_noise = r.normal(0, 0.05)
    match_budget = r.random() < 0.5
    if not respond:
        return None
    _, dur, base = SERVICES[req.service]
    ea = w.earliest_arrival(t + delay, req.loc, dur, req.win_start)
    if ea is None or ea[0] > req.win_end + 30:
        return None
    price = round(base * w.price_mult * (1 + price_noise), -1)
    if req.budget is not None and req.budget < price <= req.budget * 1.08 and match_budget:
        price = req.budget  # hastanın teklifini kabul eder
    fits = ea[0] <= req.win_end and (req.budget is None or price <= req.budget)
    return Offer(w.id, t + delay, ea[0], price, fits)


def candidates(workers: list[Worker], req: Request, t: float, exclude: set):
    role, dur, _ = SERVICES[req.service]
    near = geo.neighbours(geo.cell(req.loc), SEARCH_K)
    out = []
    for w in workers:
        if w.role != role or w.id in exclude:
            continue
        loc, free, in_visit = w.position_and_free(t)
        if geo.cell(loc) not in near:
            continue
        ea = w.earliest_arrival(t, req.loc, dur, req.win_start)
        if ea is None or ea[0] > req.win_end:
            continue
        out.append({
            "w": w, "loc": loc, "free": free, "in_visit": in_visit, "exp_arrival": ea[0],
            "dist_km": geo.haversine_km(loc, req.loc),
            # pencere başlangıcıyla kırpılmamış en erken varış (eşitlikleri bozmak için)
            "raw_arrival": max(t, free) + geo.travel_minutes(loc, req.loc, max(t, free)),
        })
    return out


def features(c: dict, req: Request, t: float, hist: dict) -> list[float]:
    """Karar anında bilinen bilgilerden özellik vektörü."""
    w = c["w"]
    h = hist.get(w.id, {})
    _, _, base = SERVICES[req.service]
    exp_price = base * h.get("price_mult", 1.0)
    has_b = req.budget is not None
    return [
        geo.travel_minutes(c["loc"], req.loc, t),
        max(0.0, c["free"] - t),
        req.win_end - c["exp_arrival"],
        t / 60.0,
        float(is_peak(t)),
        float(c["in_visit"]),
        h.get("resp_rate", 0.5),
        h.get("fast_rate", 0.5),
        h.get("peak_resp_rate", h.get("resp_rate", 0.5)),
        ((req.budget - exp_price) / base) if has_b else 0.0,
        float(has_b),
        float(req.service == "doktor"),
    ]


FEATURE_NAMES = [
    "yol_suresi", "bosalmaya_kalan", "pencere_payi", "saat", "yogun_saat", "ziyarette",
    "gecmis_yanit_orani", "gecmis_hizli_yanit_orani", "gecmis_yogun_saat_yanit",
    "butce_farki", "butce_var", "doktor",
]


def rank(policy: str, cands: list, req: Request, t: float, hist: dict, model, rng):
    if policy == "en_yakin":
        return sorted(cands, key=lambda c: c["dist_km"])
    if policy == "en_erken":
        return sorted(cands, key=lambda c: (c["exp_arrival"], c["raw_arrival"]))
    if policy == "kahin":
        # Teorik üst sınır: hangi çalışanın gerçekten uygun ve hızlı teklif vereceğini bilen (gerçekte imkânsız) seçim.
        sc_, seed_, day_ = rng.kahin_ctx
        def score(c):
            o = worker_response(sc_, c["w"], req, t, seed_, day_)
            return (o is not None and o.fits and o.t - t <= ROUND_WAIT, o is not None and o.fits, -(o.arrival if o else 1e9))
        return sorted(cands, key=score, reverse=True)
    if policy == "bilge":
        # Gerçekçi üst sınır: çalışanların GERÇEK davranış olasılıklarını bilen seçim (zar sonucunu bilmez).
        sc_ = rng.kahin_ctx[0]
        _, dur, base = SERVICES[req.service]
        def ptrue(c):
            w = c["w"]
            pr = w.resp_p * (sc_.peak_factor if (is_peak(t) and w.peak_sensitive) else 1.0) * (0.6 if c["in_visit"] else 1.0)
            lo, hi = sc_.long_delay if w.long_delay else sc_.short_delay
            pfast = min(1.0, max(0.0, (ROUND_WAIT - lo) / (hi - lo)))
            dmid = (lo + min(hi, ROUND_WAIT)) / 2
            ea = w.earliest_arrival(t + dmid, req.loc, dur, req.win_start)
            if ea is None or ea[0] > req.win_end:
                return 0.0
            if req.budget is None:
                pb = 1.0
            else:
                from math import erf, sqrt
                mu = base * w.price_mult
                z = lambda x: 0.5 * (1 + erf((x / mu - 1) / (0.05 * sqrt(2))))
                pb = z(req.budget) + 0.5 * (z(req.budget * 1.08) - z(req.budget))
            return pr * pfast * pb
        return sorted(cands, key=ptrue, reverse=True)
    if policy == "rastgele":
        idx = rng.permutation(len(cands))
        return [cands[i] for i in idx]
    if policy == "model":
        if not cands:
            return []
        X = np.array([features(c, req, t, hist) for c in cands])
        p = model.predict_proba(X)[:, 1]
        return [cands[i] for i in np.argsort(-p)]
    raise ValueError(policy)


def run_day(sc: Scenario, workers0: list[Worker], reqs: list[Request], policy: str, seed: int, day: int,
            hist: dict | None = None, model=None, log: bool = False) -> DayResult:
    workers = copy.deepcopy(workers0)
    wmap = {w.id: w for w in workers}
    hist = hist or {}
    res = DayResult(n_requests=len(reqs))
    pol_rng = np.random.default_rng([seed, day, 999])
    if policy in ("kahin", "bilge"):
        class _R: pass
        pol_rng = _R(); pol_rng.kahin_ctx = (sc, seed, day)
    state = {r.id: {"notified": set(), "offers": [], "done": False} for r in reqs}
    ev = []  # (zaman, sıra, tür, talep)
    seq = 0
    for r in reqs:
        heapq.heappush(ev, (r.t, seq, "notify", r)); seq += 1

    def notify(req: Request, t: float):
        nonlocal seq
        st = state[req.id]
        cands = candidates(workers, req, t, st["notified"])
        cfg = getattr(model, "cfg", None) if policy == "model" else None
        if cfg:
            ranked = select_with_policy(cands, req, t, hist, model, res, cfg)
        else:
            ranked = rank(policy, cands, req, t, hist, model, pol_rng)
        if policy == "model" and model is not None:
            nc, vc = getattr(model, "notif_cap", None), getattr(model, "visit_cap", None)
            if vc == "auto":  # uyarlanır kota: beklenen günlük talep/çalışan oranına göre (ρ=0,8→4, 1,25→5, 2→6-7)
                vc = int(round(2.5 + 2.0 * sc.requests_per_day / max(1, len(workers))))
            soft = getattr(model, "soft", False)

            def over_cap(c):
                return ((nc is not None and res.notif_per_worker.get(c["w"].id, 0) >= nc) or
                        (vc is not None and sum(1 for b in c["w"].blocks if b[3]) >= vc))
            ok = [c for c in ranked if not over_cap(c)]
            # sert kota: kotası dolan hiç bildirim almaz; yumuşak kota: sıranın sonuna geçer
            ranked = ok + ([c for c in ranked if over_cap(c)] if soft else [])
        for c in ranked[:NOTIFY_K]:
            w = c["w"]
            st["notified"].add(w.id)
            res.notifications += 1
            res.notif_per_worker[w.id] = res.notif_per_worker.get(w.id, 0) + 1
            off = worker_response(sc, w, req, t, seed, day)
            if off:
                st["offers"].append(off)
            if cfg and cfg.get("online"):
                # çevrimiçi öğrenme: sonuç 5 dk sonra bilinir, o an geçmişe işlenir
                learn_q.append((t + ROUND_WAIT, w.id, off, t))
            if log:
                label = int(off is not None and off.fits and off.t - t <= ROUND_WAIT)
                res.log.append((features(c, req, t, hist), label, w.id, off, t, is_peak(t)))

    learn_q = []
    online = policy == "model" and bool((getattr(model, "cfg", None) or {}).get("online"))

    def flush_learn(now):
        keep = []
        for item in learn_q:
            if item[0] <= now:
                _online_update(hist, item[1], item[2], item[3])
            else:
                keep.append(item)
        learn_q[:] = keep

    while ev:
        t, _, kind, req = heapq.heappop(ev)
        if learn_q:
            flush_learn(t)
        st = state[req.id]
        if kind == "notify":
            notify(req, t)
            fits = [o for o in st["offers"] if o.fits and o.t <= t + ROUND_WAIT]
            if fits:
                heapq.heappush(ev, (min(o.t for o in fits) + 1.0, seq, "decide", req)); seq += 1
            else:
                heapq.heappush(ev, (t + ROUND_WAIT, seq, "round2", req)); seq += 1
        elif kind == "round2":
            notify(req, t)
            fits = [o for o in st["offers"] if o.fits and o.t <= req.t + DECIDE_MAX]
            dt = min(o.t for o in fits) + 1.0 if fits else req.t + DECIDE_MAX
            heapq.heappush(ev, (max(dt, t), seq, "decide", req)); seq += 1
        elif kind == "decide":
            _decide(sc, req, t, st, wmap, res, seed, day, hist if online else None)

    for r in reqs:
        fits_t = [o.t for o in state[r.id]["offers"] if o.fits]
        if fits_t:
            res.first_fit_wait.append(min(fits_t) - r.t)
        ok5 = any(o.fits and o.t <= r.t + ROUND_WAIT for o in state[r.id]["offers"])
        res.fit_within_5 += ok5
        d = geo.DISTRICT[r.loc[2]] if geo.DISTRICT and len(r.loc) > 2 else "-"
        bd = res.by_district.setdefault(d, [0, 0, 0])
        bd[0] += 1
        bd[1] += ok5
        bd[2] += state[r.id].get("on_time", 0)
    return res


def _decide(sc, req, t, st, wmap, res, seed, day, live_hist=None):
    _, dur, _ = SERVICES[req.service]
    offers = [o for o in st["offers"] if o.t <= t]
    fitting = sorted([o for o in offers if o.fits], key=lambda o: o.arrival + o.price / 20.0)
    pr = _rng(seed, day, req.id, 20_000)
    over = []
    if not fitting:
        over = sorted([o for o in offers if o.arrival <= req.win_end], key=lambda o: o.price)
        if not (over and pr.random() < OVER_BUDGET_ACCEPT_P):
            return
    for o in fitting or over:
        w = wmap[o.worker]
        ea = w.earliest_arrival(t, req.loc, dur, req.win_start)  # atomik kontrol
        if ea is None or ea[0] > o.arrival + 5:
            continue  # çalışan bu arada başka ziyaret almış
        planned, depart, from_loc = max(ea[0], o.arrival), ea[1], ea[2]
        w.blocks.append((planned - geo.travel_minutes(from_loc, req.loc, depart), planned + dur, req.loc, True))
        w.blocks.sort()
        res.accepted += 1
        if not o.fits:
            res.over_budget_accepted += 1
        # gerçekleşen varış
        r = _rng(seed, day, req.id, 10_000 + w.id)
        travel = geo.travel_minutes(from_loc, req.loc, depart)
        noise = r.normal(0, sc.travel_noise_sd * travel)
        prev_end = max([b[1] for b in w.blocks if b[1] <= depart + 1e-6], default=None)
        overrun = 0.0
        if prev_end is not None:
            ov = abs(r.normal(0, sc.overrun_sd)) * (2.0 if w.often_late else 1.0)
            overrun = max(0.0, ov - (depart - prev_end))
        ok = planned + noise + overrun <= req.win_end
        if ok:
            res.on_time += 1
            st["on_time"] = 1
        res.visits.append((w.id, float(o.price), req.budget, float(travel), req.service, bool(ok)))
        if live_hist is not None:
            # not: gerçekte geç kalma ziyaret anında öğrenilir; basitlik için kabul anında işlenir
            h = live_hist.setdefault(w.id, {})
            h["v_n"] = h.get("v_n", 0) + 1
            h["v_late"] = h.get("v_late", 0) + (not ok)
            h["late_rate"] = (h["v_late"] + 0.2) / (h["v_n"] + 2)
        return


def _online_update(hist, wid, off, t):
    h = hist.setdefault(wid, {})
    for k in ("n", "off", "fast", "pn", "poff"):
        h.setdefault(k, 0)
    pk = is_peak(t)
    h["n"] += 1
    h["pn"] += pk
    if off is not None:
        h["off"] += 1
        h["poff"] += pk
        h["fast"] += int(off.t - t <= ROUND_WAIT)
    h["resp_rate"] = (h["off"] + 1) / (h["n"] + 2)
    h["fast_rate"] = (h["fast"] + 1) / (h["n"] + 2)
    h["peak_resp_rate"] = (h["poff"] + 1) / (h["pn"] + 2)


def select_with_policy(cands, req, t, hist, model, res, cfg):
    """Model olasılığı + karar kuralları (v2–v5).
    a: yol süresi cezası (30 dk başına), b: o gün alınan bildirim başına ceza,
    c: o gün alınan platform ziyareti başına ceza, late_w/late_tau: gecikme riski indirimi,
    alpha: üçlünün 'en az bir uygun teklif' olasılığı en iyi üçlünün alpha katının altına düşmesin."""
    if not cands:
        return []
    X = np.array([features(c, req, t, hist) for c in cands])
    p = model.predict_proba(X)[:, 1]
    tt = X[:, 0]
    load = np.array([res.notif_per_worker.get(c["w"].id, 0) for c in cands], dtype=float)
    vis = np.array([sum(1 for b in c["w"].blocks if b[3]) for c in cands], dtype=float)
    late = np.array([hist.get(c["w"].id, {}).get("late_rate", 0.1) for c in cands])
    slack = np.array([req.win_end - c["exp_arrival"] for c in cands])
    lw = cfg.get("late_w", 0.0)
    pl = p * (1 - lw * late * np.exp(-np.maximum(slack, 0) / cfg.get("late_tau", 20.0))) if lw else p
    adj = pl - cfg.get("a", 0.0) * tt / 30.0 - cfg.get("b", 0.0) * load - cfg.get("c", 0.0) * vis
    order = [int(i) for i in np.argsort(-adj, kind="stable")]
    alpha = cfg.get("alpha")
    if alpha:
        k = min(NOTIFY_K, len(cands))
        by_p = [int(i) for i in np.argsort(-pl, kind="stable")]
        s_star = 1 - np.prod(1 - pl[by_p[:k]])
        chosen = order[:k]
        while 1 - np.prod(1 - pl[chosen]) < alpha * s_star:
            worst = min(chosen, key=lambda i: pl[i])
            nxt = next((i for i in by_p if i not in chosen), None)
            if nxt is None or pl[nxt] <= pl[worst]:
                break
            chosen[chosen.index(worst)] = nxt
        order = chosen + [i for i in order if i not in chosen]
    return [cands[i] for i in order]
