# Model gelişim raporu

Referans (geliştirme): **001_v1** · Referans (ayrılmış): **007_v1_holdout**

Farklar aynı senaryo ve tohumlarda eşleştirilmiştir; ± değerler %95 güven aralığıdır. Oranlar yüzde puan olarak verilmiştir.

## Geliştirme tohumları (0–9)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 72.7% | +0.0 ± 0.0 | +20.3 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 67.6% | -5.1 ± 0.8 | +15.1 ± 0.4 | -1.2 ± 0.5 | +0.25 ± 0.04 | -0.24 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 71.9% | -0.8 ± 0.3 | +19.5 ± 0.5 | +0.1 ± 0.3 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 72.1% | -0.6 ± 0.4 | +19.7 ± 0.7 | +0.2 ± 0.4 | +0.01 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 72.3% | -0.4 ± 0.3 | +19.9 ± 0.7 | +0.5 ± 0.2 | +0.00 ± 0.02 | -0.08 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 71.7% | -1.0 ± 0.4 | +19.3 ± 0.6 | +0.2 ± 0.3 | +0.03 ± 0.02 | -0.11 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 69.7% | +0.0 ± 0.0 | +0.1 ± 0.7 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 69.6% | -0.2 ± 0.6 | -0.0 ± 0.4 | -0.0 ± 0.2 | +0.01 ± 0.02 | -0.12 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 69.9% | +0.2 ± 0.6 | +0.3 ± 0.6 | +0.2 ± 0.2 | -0.01 ± 0.03 | -0.11 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 69.7% | -0.1 ± 0.9 | +0.1 ± 0.6 | +0.1 ± 0.3 | -0.00 ± 0.03 | -0.10 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 69.8% | +0.1 ± 0.9 | +0.2 ± 0.4 | +0.4 ± 0.3 | -0.01 ± 0.04 | -0.09 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 69.8% | +0.1 ± 0.9 | +0.2 ± 0.4 | +0.4 ± 0.3 | -0.01 ± 0.04 | -0.09 ± 0.01 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 63.5% | +0.0 ± 0.0 | +24.4 ± 0.9 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 55.1% | -8.4 ± 0.7 | +16.0 ± 0.8 | -2.5 ± 0.6 | +0.48 ± 0.06 | -0.27 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 62.7% | -0.8 ± 0.3 | +23.6 ± 0.9 | -0.1 ± 0.2 | +0.04 ± 0.02 | -0.07 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 62.6% | -0.9 ± 0.4 | +23.5 ± 0.9 | -0.1 ± 0.3 | +0.04 ± 0.02 | -0.07 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 63.0% | -0.5 ± 0.4 | +23.9 ± 0.9 | +0.1 ± 0.4 | +0.02 ± 0.02 | -0.06 ± 0.00 | ✔ |
| 006_v5_kota5 | v5_kota5 | 61.4% | -2.0 ± 0.6 | +22.4 ± 0.9 | -0.5 ± 0.5 | +0.11 ± 0.04 | -0.10 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 72.7% | +0.0 ± 0.0 | +20.3 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 67.6% | -5.1 ± 0.8 | +15.1 ± 0.4 | -1.0 ± 0.5 | +0.25 ± 0.04 | -0.24 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 71.9% | -0.8 ± 0.3 | +19.5 ± 0.5 | +0.1 ± 0.3 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 72.1% | -0.6 ± 0.4 | +19.7 ± 0.7 | +0.3 ± 0.4 | +0.01 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 72.3% | -0.4 ± 0.3 | +19.9 ± 0.7 | +0.6 ± 0.2 | +0.00 ± 0.02 | -0.08 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 71.7% | -1.0 ± 0.4 | +19.3 ± 0.6 | +0.3 ± 0.3 | +0.03 ± 0.02 | -0.11 ± 0.01 | ✔ |

## Ayrılmış tohumlar (1000–1009)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 71.5% | +0.0 ± 0.0 | +19.9 ± 1.0 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_holdout | v5_denge | 70.6% | -0.9 ± 0.5 | +19.0 ± 1.0 | -0.0 ± 0.3 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 009_v5_kota5_holdout | v5_kota5 | 70.1% | -1.4 ± 0.5 | +18.5 ± 1.0 | -0.1 ± 0.3 | +0.05 ± 0.02 | -0.11 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 69.5% | +0.0 ± 0.0 | +0.3 ± 0.7 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_holdout | v5_denge | 69.3% | -0.2 ± 0.4 | +0.1 ± 0.6 | +0.0 ± 0.4 | -0.00 ± 0.02 | -0.09 ± 0.02 | ✔ |
| 009_v5_kota5_holdout | v5_kota5 | 69.3% | -0.2 ± 0.4 | +0.1 ± 0.6 | +0.0 ± 0.4 | -0.00 ± 0.02 | -0.09 ± 0.02 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 63.1% | +0.0 ± 0.0 | +23.8 ± 1.0 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_holdout | v5_denge | 62.6% | -0.5 ± 0.4 | +23.3 ± 1.1 | +0.2 ± 0.4 | +0.00 ± 0.03 | -0.06 ± 0.01 | ✔ |
| 009_v5_kota5_holdout | v5_kota5 | 60.7% | -2.5 ± 0.5 | +21.4 ± 1.1 | -0.4 ± 0.6 | +0.11 ± 0.04 | -0.11 ± 0.02 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 71.5% | +0.0 ± 0.0 | +19.9 ± 1.0 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_holdout | v5_denge | 70.6% | -0.9 ± 0.5 | +19.0 ± 1.0 | +0.2 ± 0.3 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 009_v5_kota5_holdout | v5_kota5 | 70.1% | -1.4 ± 0.5 | +18.5 ± 1.0 | +0.0 ± 0.3 | +0.05 ± 0.02 | -0.11 ± 0.01 | ✔ |
