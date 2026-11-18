# izmir_tam — toplu taşımada ayrı hat sıklığı (arşiv, 2026-11-18)
Toplu taşıma beklemesi hat+yön bazında hesaplanıyordu (aynı duraktan geçen farklı hatların ortak sıklığı yok → bekleme kötümser).
Yeni hesapta aynı durak → aynı sonraki durak hatları birlikte sayılıyor (build_transit.ORTAK_SIKLIK); gündüz medyan kapıdan kapıya
süre 72 → 62 dk. Yeni sonuçlar results/izmir_tam/.
