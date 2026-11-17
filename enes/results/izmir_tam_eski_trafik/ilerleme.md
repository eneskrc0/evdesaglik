# Model gelişim raporu

Referans (geliştirme): **001_v1** · Referans (ayrılmış): **007_v1_holdout**

Farklar aynı senaryo ve tohumlarda eşleştirilmiştir; ± değerler %95 güven aralığıdır. Oranlar yüzde puan olarak verilmiştir.

## Geliştirme tohumları (0–9)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 76.6% | +0.0 ± 0.0 | +20.7 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 70.2% | -6.4 ± 0.8 | +14.3 ± 0.8 | -1.5 ± 0.3 | +0.30 ± 0.04 | -0.26 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 75.6% | -1.0 ± 0.3 | +19.7 ± 0.9 | +0.3 ± 0.4 | +0.03 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 75.4% | -1.2 ± 0.4 | +19.5 ± 0.9 | -0.0 ± 0.4 | +0.04 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 76.0% | -0.6 ± 0.5 | +20.1 ± 0.8 | +0.0 ± 0.4 | +0.02 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 75.3% | -1.3 ± 0.5 | +19.4 ± 0.5 | -0.2 ± 0.4 | +0.06 ± 0.02 | -0.09 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 74.3% | +0.0 ± 0.0 | +0.3 ± 0.7 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 74.1% | -0.2 ± 0.4 | +0.1 ± 0.4 | -0.1 ± 0.3 | +0.01 ± 0.02 | -0.12 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 73.9% | -0.4 ± 0.3 | -0.1 ± 0.7 | +0.2 ± 0.3 | +0.01 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 73.7% | -0.6 ± 0.4 | -0.3 ± 0.5 | +0.2 ± 0.2 | +0.02 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 73.8% | -0.5 ± 0.4 | -0.2 ± 0.5 | +0.2 ± 0.2 | +0.01 ± 0.02 | -0.08 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 74.0% | -0.3 ± 0.6 | -0.0 ± 0.4 | +0.2 ± 0.2 | +0.01 ± 0.03 | -0.07 ± 0.01 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 65.8% | +0.0 ± 0.0 | +24.2 ± 1.0 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 56.9% | -8.9 ± 0.4 | +15.3 ± 1.1 | -3.2 ± 0.5 | +0.53 ± 0.02 | -0.29 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 65.4% | -0.5 ± 0.4 | +23.7 ± 1.1 | -0.2 ± 0.4 | +0.03 ± 0.02 | -0.06 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 65.5% | -0.4 ± 0.4 | +23.8 ± 1.0 | +0.1 ± 0.2 | +0.02 ± 0.02 | -0.06 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 65.2% | -0.6 ± 0.3 | +23.6 ± 1.0 | +0.0 ± 0.2 | +0.02 ± 0.02 | -0.05 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 63.6% | -2.2 ± 0.4 | +22.0 ± 0.9 | -0.6 ± 0.2 | +0.12 ± 0.02 | -0.10 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 76.6% | +0.0 ± 0.0 | +20.7 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 70.2% | -6.4 ± 0.8 | +14.3 ± 0.8 | -1.1 ± 0.3 | +0.30 ± 0.04 | -0.26 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 75.6% | -1.0 ± 0.3 | +19.7 ± 0.9 | +0.3 ± 0.3 | +0.03 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 75.4% | -1.2 ± 0.4 | +19.5 ± 0.9 | +0.1 ± 0.4 | +0.04 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 76.0% | -0.6 ± 0.5 | +20.1 ± 0.8 | +0.2 ± 0.3 | +0.02 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 75.3% | -1.3 ± 0.5 | +19.4 ± 0.5 | -0.1 ± 0.5 | +0.06 ± 0.02 | -0.09 ± 0.01 | ✔ |

## Ayrılmış tohumlar (1000–1009)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 74.2% | +0.0 ± 0.0 | +20.5 ± 1.1 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 73.2% | -1.0 ± 0.4 | +19.5 ± 1.0 | -0.0 ± 0.4 | +0.04 ± 0.02 | -0.08 ± 0.00 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 74.5% | +0.0 ± 0.0 | +0.3 ± 0.7 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 74.7% | +0.1 ± 0.4 | +0.4 ± 0.5 | +0.4 ± 0.3 | -0.01 ± 0.02 | -0.08 ± 0.01 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 64.6% | +0.0 ± 0.0 | +24.5 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 62.6% | -2.0 ± 0.5 | +22.5 ± 0.6 | -1.0 ± 0.3 | +0.12 ± 0.02 | -0.09 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 74.2% | +0.0 ± 0.0 | +20.5 ± 1.1 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 73.2% | -1.0 ± 0.4 | +19.5 ± 1.0 | +0.1 ± 0.4 | +0.04 ± 0.02 | -0.08 ± 0.00 | ✔ |
