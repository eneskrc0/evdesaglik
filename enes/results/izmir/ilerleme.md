# Model gelişim raporu

Referans (geliştirme): **007_v1** · Referans (ayrılmış): **008_v1_holdout**

Farklar aynı senaryo ve tohumlarda eşleştirilmiştir; ± değerler %95 güven aralığıdır. Oranlar yüzde puan olarak verilmiştir.

## Geliştirme tohumları (0–9)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_referans | gbm_v1 | 88.8% | +0.0 ± 0.0 | +32.6 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_yumusak_kota6 | gbm_v1_ybkota6 | 74.7% | -14.1 ± 0.7 | +18.4 ± 0.7 | -4.7 ± 0.6 | +0.65 ± 0.04 | -0.45 ± 0.01 | ✔ |
| 003_yumusak_kota4 | gbm_v1_ybkota4 | 69.9% | -18.9 ± 0.5 | +13.6 ± 0.4 | -5.2 ± 0.5 | +0.84 ± 0.03 | -0.55 ± 0.01 | ✔ |
| 004_yumusak_kota8 | gbm_v1_ybkota8 | 82.3% | -6.5 ± 0.4 | +26.0 ± 0.6 | -2.3 ± 0.4 | +0.30 ± 0.02 | -0.26 ± 0.01 | ✔ |
| 005_ziyaret_kota3 | gbm_v1_zkota3 | 84.2% | -4.6 ± 0.4 | +28.0 ± 0.6 | -1.7 ± 0.3 | +0.21 ± 0.02 | -0.16 ± 0.01 | ✔ |
| 007_v1 ⭐ | gbm_v1 | 88.8% | +0.0 ± 0.0 | +32.6 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v2 | v2_adil | 78.6% | -10.2 ± 0.5 | +22.4 ± 0.7 | -1.5 ± 0.4 | +0.40 ± 0.02 | -0.44 ± 0.01 | ✔ |
| 010_v3 | v3_garanti | 87.7% | -1.1 ± 0.3 | +31.4 ± 0.7 | +0.4 ± 0.2 | +0.03 ± 0.01 | -0.16 ± 0.01 | ✔ |
| 011_v4 | v4_mesafe | 87.8% | -1.0 ± 0.3 | +31.5 ± 0.8 | +0.4 ± 0.3 | +0.02 ± 0.01 | -0.16 ± 0.01 | ✔ |
| 012_v5 | v5_denge | 87.8% | -1.0 ± 0.3 | +31.6 ± 0.7 | +0.4 ± 0.3 | +0.02 ± 0.01 | -0.15 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_referans | gbm_v1 | 74.8% | +0.0 ± 0.0 | +0.0 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_yumusak_kota6 | gbm_v1_ybkota6 | 74.8% | +0.1 ± 0.2 | +0.1 ± 0.4 | +0.2 ± 0.3 | -0.01 ± 0.01 | -0.24 ± 0.04 | ✔ |
| 003_yumusak_kota4 | gbm_v1_ybkota4 | 74.5% | -0.2 ± 0.4 | -0.2 ± 0.5 | +0.0 ± 0.2 | +0.01 ± 0.02 | -0.33 ± 0.04 | ✔ |
| 004_yumusak_kota8 | gbm_v1_ybkota8 | 74.8% | +0.1 ± 0.2 | +0.1 ± 0.4 | +0.1 ± 0.2 | -0.00 ± 0.01 | -0.13 ± 0.03 | ✔ |
| 005_ziyaret_kota3 | gbm_v1_zkota3 | 74.6% | -0.2 ± 0.2 | -0.1 ± 0.4 | -0.1 ± 0.2 | +0.01 ± 0.01 | -0.06 ± 0.01 | ✔ |
| 007_v1 ⭐ | gbm_v1 | 74.8% | +0.0 ± 0.0 | +0.0 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v2 | v2_adil | 74.4% | -0.4 ± 0.4 | -0.3 ± 0.4 | +0.8 ± 0.4 | -0.01 ± 0.01 | -0.36 ± 0.04 | ✔ |
| 010_v3 | v3_garanti | 74.7% | -0.0 ± 0.3 | +0.0 ± 0.3 | +0.9 ± 0.3 | -0.02 ± 0.02 | -0.31 ± 0.04 | ✔ |
| 011_v4 | v4_mesafe | 74.6% | -0.1 ± 0.5 | -0.1 ± 0.4 | +0.9 ± 0.3 | -0.01 ± 0.02 | -0.30 ± 0.04 | ✔ |
| 012_v5 | v5_denge | 74.6% | -0.1 ± 0.5 | -0.1 ± 0.4 | +0.9 ± 0.4 | -0.00 ± 0.02 | -0.28 ± 0.04 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_referans | gbm_v1 | 83.1% | +0.0 ± 0.0 | +41.1 ± 0.3 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_yumusak_kota6 | gbm_v1_ybkota6 | 57.5% | -25.6 ± 0.8 | +15.5 ± 0.7 | -8.3 ± 0.6 | +1.32 ± 0.06 | -0.55 ± 0.01 | ✔ |
| 003_yumusak_kota4 | gbm_v1_ybkota4 | 59.6% | -23.5 ± 0.4 | +17.6 ± 0.2 | -7.1 ± 0.4 | +1.19 ± 0.03 | -0.54 ± 0.01 | ✔ |
| 004_yumusak_kota8 | gbm_v1_ybkota8 | 67.2% | -15.9 ± 0.9 | +25.1 ± 0.8 | -4.6 ± 0.5 | +0.77 ± 0.05 | -0.34 ± 0.01 | ✔ |
| 005_ziyaret_kota3 | gbm_v1_zkota3 | 73.3% | -9.8 ± 0.6 | +31.2 ± 0.5 | -3.1 ± 0.3 | +0.48 ± 0.03 | -0.18 ± 0.01 | ✔ |
| 007_v1 ⭐ | gbm_v1 | 83.1% | +0.0 ± 0.0 | +41.1 ± 0.3 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v2 | v2_adil | 65.1% | -18.0 ± 1.0 | +23.0 ± 1.0 | -3.9 ± 0.4 | +0.82 ± 0.07 | -0.52 ± 0.01 | ✔ |
| 010_v3 | v3_garanti | 82.0% | -1.1 ± 0.3 | +40.0 ± 0.5 | -0.0 ± 0.3 | +0.03 ± 0.01 | -0.10 ± 0.01 | ✔ |
| 011_v4 | v4_mesafe | 82.1% | -1.0 ± 0.3 | +40.0 ± 0.4 | +0.3 ± 0.3 | +0.03 ± 0.01 | -0.09 ± 0.01 | ✔ |
| 012_v5 | v5_denge | 82.2% | -0.9 ± 0.3 | +40.1 ± 0.4 | +0.4 ± 0.3 | +0.02 ± 0.01 | -0.09 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_referans | gbm_v1 | 88.8% | +0.0 ± 0.0 | +32.6 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_yumusak_kota6 | gbm_v1_ybkota6 | 74.7% | -14.1 ± 0.7 | +18.4 ± 0.7 | -4.4 ± 0.6 | +0.65 ± 0.04 | -0.45 ± 0.01 | ✔ |
| 003_yumusak_kota4 | gbm_v1_ybkota4 | 69.9% | -18.9 ± 0.5 | +13.6 ± 0.4 | -4.9 ± 0.5 | +0.84 ± 0.03 | -0.55 ± 0.01 | ✔ |
| 004_yumusak_kota8 | gbm_v1_ybkota8 | 82.3% | -6.5 ± 0.4 | +26.0 ± 0.6 | -2.2 ± 0.5 | +0.30 ± 0.02 | -0.26 ± 0.01 | ✔ |
| 005_ziyaret_kota3 | gbm_v1_zkota3 | 84.2% | -4.6 ± 0.4 | +28.0 ± 0.6 | -1.3 ± 0.3 | +0.21 ± 0.02 | -0.16 ± 0.01 | ✔ |
| 007_v1 ⭐ | gbm_v1 | 88.8% | +0.0 ± 0.0 | +32.6 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v2 | v2_adil | 78.6% | -10.2 ± 0.5 | +22.4 ± 0.7 | -0.8 ± 0.5 | +0.40 ± 0.02 | -0.44 ± 0.01 | ✔ |
| 010_v3 | v3_garanti | 87.7% | -1.1 ± 0.3 | +31.4 ± 0.7 | +0.8 ± 0.2 | +0.03 ± 0.01 | -0.16 ± 0.01 | ✔ |
| 011_v4 | v4_mesafe | 87.8% | -1.0 ± 0.3 | +31.5 ± 0.8 | +0.7 ± 0.3 | +0.02 ± 0.01 | -0.16 ± 0.01 | ✔ |
| 012_v5 | v5_denge | 87.8% | -1.0 ± 0.3 | +31.6 ± 0.7 | +0.6 ± 0.3 | +0.02 ± 0.01 | -0.15 ± 0.01 | ✔ |

## Ayrılmış tohumlar (1000–1009)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 006_referans_holdout | gbm_v1 | 88.2% | +0.0 ± 0.0 | +33.2 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v1_holdout ⭐ | gbm_v1 | 88.2% | +0.0 ± 0.0 | +33.2 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 013_v5_holdout | v5_denge | 87.1% | -1.1 ± 0.3 | +32.1 ± 0.7 | +0.6 ± 0.2 | +0.02 ± 0.01 | -0.14 ± 0.01 | ✔ |
| 014_v5_demo_lr_holdout_holdout | v5_demo_lr | 84.8% | -3.4 ± 0.4 | +29.8 ± 0.5 | -0.3 ± 0.3 | +0.12 ± 0.01 | -0.09 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 006_referans_holdout | gbm_v1 | 74.7% | +0.0 ± 0.0 | +0.0 ± 0.4 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v1_holdout ⭐ | gbm_v1 | 74.7% | +0.0 ± 0.0 | +0.0 ± 0.4 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 013_v5_holdout | v5_denge | 74.5% | -0.2 ± 0.5 | -0.1 ± 0.4 | +1.0 ± 0.3 | -0.01 ± 0.02 | -0.23 ± 0.03 | ✔ |
| 014_v5_demo_lr_holdout_holdout | v5_demo_lr | 74.3% | -0.4 ± 0.4 | -0.3 ± 0.4 | +0.8 ± 0.4 | +0.01 ± 0.02 | -0.20 ± 0.03 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 006_referans_holdout | gbm_v1 | 82.2% | +0.0 ± 0.0 | +41.2 ± 0.4 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v1_holdout ⭐ | gbm_v1 | 82.2% | +0.0 ± 0.0 | +41.2 ± 0.4 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 013_v5_holdout | v5_denge | 81.4% | -0.8 ± 0.3 | +40.5 ± 0.4 | +0.1 ± 0.2 | +0.02 ± 0.02 | -0.08 ± 0.01 | ✔ |
| 014_v5_demo_lr_holdout_holdout | v5_demo_lr | 78.3% | -3.9 ± 0.3 | +37.4 ± 0.6 | -1.2 ± 0.3 | +0.15 ± 0.02 | -0.05 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 006_referans_holdout | gbm_v1 | 88.2% | +0.0 ± 0.0 | +33.2 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v1_holdout ⭐ | gbm_v1 | 88.2% | +0.0 ± 0.0 | +33.2 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 013_v5_holdout | v5_denge | 87.1% | -1.1 ± 0.3 | +32.1 ± 0.7 | +0.8 ± 0.4 | +0.02 ± 0.01 | -0.14 ± 0.01 | ✔ |
| 014_v5_demo_lr_holdout_holdout | v5_demo_lr | 84.8% | -3.4 ± 0.4 | +29.8 ± 0.5 | -0.2 ± 0.4 | +0.12 ± 0.01 | -0.09 ± 0.01 | ✔ |
