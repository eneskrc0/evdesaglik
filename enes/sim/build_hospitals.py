"""Hastane katmanı: OSM listesini temizler, türlere ayırır, ilçe ve yol süresi analizi yapar.

Girdi:  data/izmir/hastaneler_osm.csv (Colab, osmnx: amenity/healthcare=hospital)
Çıktı:  data/izmir/hastaneler.csv      (temiz liste: ad, tür, ilçe, konum, acil)
        web/hospitals.json             (demo sayfaları için; her dünyanın konum havuzundaki en yakın nokta)
        results/izmir/hastane_erisim.csv (ilçe bazında en yakın hastaneye ortalama yol süresi)
Kullanım: python -m sim.build_hospitals

Tür kuralları elle belirlendi (OSM işleten bilgisi + ad). Emin olunamayanlar 'kontrol' sütununda işaretli.
"""
import json, os
from pathlib import Path

import numpy as np
import pandas as pd
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parent.parent

# Liste dışı bırakılanlar: ağız-diş merkezleri, laboratuvar, sağlık kabini, belirsiz kayıt, çift kayıt
EXCLUDE = {
    "İzmir Alsancak Ağız ve Diş Sağlığı Merkezine Bağlı Bayraklı Ağız ve Diş Sağlığı Polikliniği": "ağız-diş",
    "Diş Hekimliği Ağız ve Diş Sağlığı Hastanesi": "ağız-diş",
    "Ağız ve Diş Sağlığı Merkezi": "ağız-diş",
    "Tınaztepe Ağız ve Diş Sağlığı Merkezi": "ağız-diş",
    "Bornova Ağız ve Diş Sağlığı Merkezi (Çınarlı)": "ağız-diş",
    "Ağız ve Diş Sağlığı Hastanesi": "ağız-diş",
    "Diş Hekimliği Fakültesi Hastanesi": "ağız-diş",
    "Özel İzmir Ege Laboratuarı": "laboratuvar",
    "Özel Oksijen Sağlık Kabini": "hastane değil",
    "ozel kent": "belirsiz kayıt",
    "Ento KBB Tıp Merkezi": "çift kayıt (Özel EntoKBB Cerrahi Tıp Merkezi)",
}
DEVLET = ["Bakırçay Üniversitesi Çiğli Bölge Eğitim ve Araştırma Hastanesi", "Tepecik Eğitim ve Araştırma Hastanesi",
          "Behçet Uz Çocuk Hastanesi", "Dr. Suat Seren Göğüs Hastalıkları Hastanesi", "İzmir Atatürk Eğitim ve Araştırma Hastanesi",
          "İzmir Atatürk Eğitim ve Araştırma Hastanesi Hatay Hizmet Binası", "Buca Kadın Doğum ve Çocuk Hastanesi",
          "İzmir Bayraklı Entegre Sağlık Kampüsü", "Buca Seyfi Demirsoy Eğitim ve Araştırma Hastanesi",
          "Türkan Özilhan Devlet Hastanesi", "Tepecik Eğitim ve Araştırma Hastanesi Bornova Ek Binası",
          "Alsancak Nevvar - Salih İşgören Devlet Hastanesi", "Urla Devlet Hastanesi Güzelbahçe Polikliniği"]
BELEDIYE = ["Eşrefpaşa Hastanesi"]
DEVLET_UNI = ["Ege Üniversitesi Hastanesi", "Ege Üniversitesi Çocuk Hastanesi", "Dokuz Eylül Üniversitesi Hastanesi",
              "Nevvar Salih İşgören Çocuk Hastanesi"]
VAKIF_UNI = ["Başkent Üniversitesi Zübeyde Hanım Uygulama Merkezi", "Zübeyde Hanım Hastanesi Polikliniği",
             "Zübeyde Hanım Tıp Merkezi", "Tınaztepe Hastanesi", "Tınaztepe Galen Hastanesi"]
TIP_MERKEZI_KEYS = ["Tıp Merkezi"]
UNSURE = {"Çınarlı Kadın Doğum Hastanesi", "Karşıyaka Göz Hastanesi", "Kordon Kadın Doğum ve Çocuk Hastalıkları Hastanesi",
          "Zübeyde Hanım Tıp Merkezi", "Nevvar Salih İşgören Çocuk Hastanesi", "Egepol Hastanesi", "Gazi Hastanesi"}
TUR_AD = {"devlet": "Devlet hastanesi", "belediye": "Belediye hastanesi", "devlet_uni": "Devlet üniversitesi hastanesi",
          "vakif_uni": "Vakıf üniversitesi hastanesi", "ozel": "Özel hastane", "ozel_tm": "Özel tıp merkezi"}


def classify(name):
    if name in DEVLET:
        return "devlet"
    if name in BELEDIYE:
        return "belediye"
    if name in DEVLET_UNI:
        return "devlet_uni"
    if name in VAKIF_UNI:
        return "vakif_uni"
    if any(k in name for k in TIP_MERKEZI_KEYS):
        return "ozel_tm"
    return "ozel"


def main():
    raw = pd.read_csv(ROOT / "data/izmir/hastaneler_osm.csv")
    excluded = raw[raw.name.isin(EXCLUDE)].assign(neden=lambda d: d.name.map(EXCLUDE))
    df = raw[~raw.name.isin(EXCLUDE)].copy()
    df["tur"] = df.name.map(classify)
    df["tur_ad"] = df.tur.map(TUR_AD)
    df["acil"] = df.emergency.fillna("").eq("yes")
    df["kontrol"] = df.name.isin(UNSURE)
    feats = json.load(open(ROOT / "data/izmir/ilceler.geojson"))["features"]
    polys = [(f["properties"]["ilce"], shape(f["geometry"])) for f in feats]
    df["ilce"] = [next((n for n, p in polys if p.contains(Point(lo, la))), "11 ilçe dışı") for la, lo in zip(df.lat, df.lon)]
    out = df[["name", "tur", "tur_ad", "ilce", "acil", "kontrol", "lat", "lon"]].rename(columns={"name": "ad"})
    out.to_csv(ROOT / "data/izmir/hastaneler.csv", index=False)
    print(f"{len(raw)} kayıt → {len(out)} hastane/tıp merkezi; dışarıda bırakılan {len(excluded)}:")
    for _, r in excluded.iterrows():
        print(f"   - {r['name']} ({r.neden})")
    print(out.groupby("tur_ad").size().to_string())

    # ---- yol süresi analizi (İzmir konum havuzu) ----
    z = np.load(ROOT / ("data/izmir/pool_orta.npz" if os.environ.get("OLCEK") == "orta" else "data/izmir/pool.npz"))
    plat, plon, tt, ilce = z["lat"], z["lon"], z["tt"], z["ilce"]

    def nearest(la, lo):
        d = (plat - la) ** 2 + ((plon - lo) * np.cos(np.radians(la))) ** 2
        i = int(d.argmin())
        return i, float(np.sqrt(d[i]) * 111.0)

    out["pool_izmir"], out["snap_km"] = zip(*[nearest(a, b) for a, b in zip(out.lat, out.lon)])
    hosp = out[out.tur != "ozel_tm"]
    kamu = hosp[hosp.tur.isin(["devlet", "belediye", "devlet_uni"])]
    # gündüz trafik katsayısı 1,35 (sim/geo.congestion), park +3 dk
    to_any = tt[:, hosp.pool_izmir.values].min(axis=1) / 60 * 1.35 + 3
    to_pub = tt[:, kamu.pool_izmir.values].min(axis=1) / 60 * 1.35 + 3
    acc = pd.DataFrame({"ilce": ilce, "en_yakin_hastane_dk": to_any, "en_yakin_kamu_hastanesi_dk": to_pub})
    summ = acc.groupby("ilce").agg(en_yakin_hastane_dk=("en_yakin_hastane_dk", "mean"),
                                   en_yakin_kamu_hastanesi_dk=("en_yakin_kamu_hastanesi_dk", "mean"),
                                   en_kotu_kamu_dk=("en_yakin_kamu_hastanesi_dk", lambda x: np.percentile(x, 90)))
    summ["hastane_sayisi"] = hosp.groupby("ilce").size().reindex(summ.index).fillna(0).astype(int)
    summ["kamu_hastanesi_sayisi"] = kamu.groupby("ilce").size().reindex(summ.index).fillna(0).astype(int)
    summ = summ.sort_values("en_yakin_kamu_hastanesi_dk", ascending=False)
    (ROOT / "results/izmir").mkdir(parents=True, exist_ok=True)
    summ.round(1).to_csv(ROOT / "results/izmir/hastane_erisim.csv")
    print("\nİlçelere göre en yakın hastaneye ortalama yol (gündüz, dk):")
    print(summ.round(1).to_string())

    # ---- demo sayfaları için ----
    zb = np.load(ROOT / "data/bornova/pool.npz")

    def nearest_b(la, lo):
        d = (zb["lat"] - la) ** 2 + ((zb["lon"] - lo) * np.cos(np.radians(la))) ** 2
        i = int(d.argmin())
        return i, float(np.sqrt(d[i]) * 111.0)

    recs = []
    for _, r in out.iterrows():
        bi, bkm = nearest_b(r.lat, r.lon)
        recs.append({"ad": r.ad, "tur": r.tur, "turAd": r.tur_ad, "ilce": r.ilce, "acil": bool(r.acil),
                     "lat": round(r.lat, 6), "lon": round(r.lon, 6), "pi": int(r.pool_izmir), "pb": bi if bkm < 1.0 else None})
    json.dump(recs, open(ROOT / "web/hospitals.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nweb/hospitals.json: {len(recs)} kayıt; Bornova haritasında {sum(r['pb'] is not None for r in recs)}")


if __name__ == "__main__":
    main()
