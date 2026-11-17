# Model gelişim raporu

Referans (geliştirme): **001_v1** · Referans (ayrılmış): **007_v1_holdout**

Farklar aynı senaryo ve tohumlarda eşleştirilmiştir; ± değerler %95 güven aralığıdır. Oranlar yüzde puan olarak verilmiştir.

## Geliştirme tohumları (0–9)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 74.2% | +0.0 ± 0.0 | +19.5 ± 0.9 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 68.6% | -5.6 ± 0.4 | +14.0 ± 1.0 | -1.2 ± 0.6 | +0.25 ± 0.02 | -0.22 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 73.3% | -0.9 ± 0.5 | +18.7 ± 0.8 | +0.4 ± 0.4 | +0.02 ± 0.02 | -0.08 ± 0.00 | ✔ |
| 004_v4 | v4_mesafe | 73.2% | -1.0 ± 0.5 | +18.6 ± 0.9 | +0.0 ± 0.5 | +0.03 ± 0.03 | -0.07 ± 0.00 | ✔ |
| 005_v5 | v5_denge | 73.3% | -0.9 ± 0.6 | +18.6 ± 0.9 | +0.1 ± 0.5 | +0.03 ± 0.03 | -0.07 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 72.6% | -1.6 ± 0.5 | +18.0 ± 0.7 | -0.2 ± 0.5 | +0.06 ± 0.03 | -0.07 ± 0.00 | ✔ |
| 009_v5_ukota_trafik | v5_ukota_trafik | 73.2% | -1.0 ± 0.5 | +18.5 ± 0.9 | -0.2 ± 0.6 | +0.04 ± 0.03 | -0.07 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 73.3% | +0.0 ± 0.0 | +0.4 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 72.9% | -0.4 ± 0.3 | -0.0 ± 0.6 | -0.3 ± 0.2 | +0.03 ± 0.02 | -0.11 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 73.3% | -0.1 ± 0.3 | +0.3 ± 0.6 | -0.0 ± 0.3 | +0.00 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 73.1% | -0.3 ± 0.3 | +0.1 ± 0.6 | -0.1 ± 0.4 | +0.01 ± 0.02 | -0.08 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 73.3% | -0.0 ± 0.2 | +0.4 ± 0.6 | +0.1 ± 0.3 | -0.00 ± 0.02 | -0.07 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 73.1% | -0.2 ± 0.4 | +0.2 ± 0.5 | +0.1 ± 0.4 | +0.01 ± 0.03 | -0.05 ± 0.01 | ✔ |
| 009_v5_ukota_trafik | v5_ukota_trafik | 73.5% | +0.1 ± 0.4 | +0.5 ± 0.5 | +0.1 ± 0.4 | -0.00 ± 0.03 | -0.07 ± 0.01 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 62.3% | +0.0 ± 0.0 | +22.0 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 54.5% | -7.8 ± 0.7 | +14.1 ± 0.8 | -3.0 ± 0.3 | +0.49 ± 0.05 | -0.26 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 62.0% | -0.3 ± 0.4 | +21.7 ± 0.6 | -0.3 ± 0.4 | +0.02 ± 0.03 | -0.05 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 62.1% | -0.2 ± 0.5 | +21.8 ± 0.6 | +0.0 ± 0.3 | +0.01 ± 0.03 | -0.05 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 62.0% | -0.3 ± 0.4 | +21.7 ± 0.6 | -0.1 ± 0.3 | +0.02 ± 0.02 | -0.04 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 60.9% | -1.4 ± 0.5 | +20.6 ± 0.5 | -0.5 ± 0.4 | +0.08 ± 0.03 | -0.07 ± 0.01 | ✔ |
| 009_v5_ukota_trafik | v5_ukota_trafik | 61.2% | -1.1 ± 0.3 | +20.9 ± 0.6 | -0.3 ± 0.1 | +0.07 ± 0.02 | -0.07 ± 0.00 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 74.2% | +0.0 ± 0.0 | +19.5 ± 0.9 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 68.6% | -5.6 ± 0.4 | +14.0 ± 1.0 | -0.9 ± 0.5 | +0.25 ± 0.02 | -0.22 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 73.3% | -0.9 ± 0.5 | +18.7 ± 0.8 | +0.5 ± 0.4 | +0.02 ± 0.02 | -0.08 ± 0.00 | ✔ |
| 004_v4 | v4_mesafe | 73.2% | -1.0 ± 0.5 | +18.6 ± 0.9 | +0.1 ± 0.6 | +0.03 ± 0.03 | -0.07 ± 0.00 | ✔ |
| 005_v5 | v5_denge | 73.3% | -0.9 ± 0.6 | +18.6 ± 0.9 | +0.2 ± 0.5 | +0.03 ± 0.03 | -0.07 ± 0.01 | ✔ |
| 006_v5_ukota_ayarli | v5_ukota_ayarli | 72.6% | -1.6 ± 0.5 | +18.0 ± 0.7 | -0.1 ± 0.5 | +0.06 ± 0.03 | -0.07 ± 0.00 | ✔ |
| 009_v5_ukota_trafik | v5_ukota_trafik | 73.2% | -1.0 ± 0.5 | +18.5 ± 0.9 | +0.0 ± 0.6 | +0.04 ± 0.03 | -0.07 ± 0.01 | ✔ |

## Ayrılmış tohumlar (1000–1009)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 72.1% | +0.0 ± 0.0 | +19.4 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 70.7% | -1.4 ± 0.4 | +18.1 ± 0.7 | -0.1 ± 0.3 | +0.05 ± 0.02 | -0.06 ± 0.01 | ✔ |
| 010_v5_ukota_trafik_holdout | v5_ukota_trafik | 71.1% | -1.0 ± 0.4 | +18.4 ± 0.7 | +0.0 ± 0.3 | +0.04 ± 0.02 | -0.06 ± 0.00 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 73.9% | +0.0 ± 0.0 | +0.1 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 73.8% | -0.1 ± 0.2 | +0.0 ± 0.6 | +0.5 ± 0.6 | -0.01 ± 0.01 | -0.05 ± 0.01 | ✔ |
| 010_v5_ukota_trafik_holdout | v5_ukota_trafik | 74.0% | +0.2 ± 0.3 | +0.3 ± 0.6 | +0.4 ± 0.3 | -0.02 ± 0.01 | -0.07 ± 0.01 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 61.3% | +0.0 ± 0.0 | +22.0 ± 0.6 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 59.5% | -1.7 ± 0.3 | +20.3 ± 0.6 | -0.4 ± 0.4 | +0.09 ± 0.03 | -0.07 ± 0.01 | ✔ |
| 010_v5_ukota_trafik_holdout | v5_ukota_trafik | 59.6% | -1.7 ± 0.3 | +20.3 ± 0.6 | -0.4 ± 0.4 | +0.09 ± 0.03 | -0.07 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 007_v1_holdout ⭐ | gbm_v1 | 72.1% | +0.0 ± 0.0 | +19.4 ± 0.8 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 008_v5_ukota_ayarli_holdout | v5_ukota_ayarli | 70.7% | -1.4 ± 0.4 | +18.1 ± 0.7 | -0.0 ± 0.3 | +0.05 ± 0.02 | -0.06 ± 0.01 | ✔ |
| 010_v5_ukota_trafik_holdout | v5_ukota_trafik | 71.1% | -1.0 ± 0.4 | +18.4 ± 0.7 | +0.2 ± 0.3 | +0.04 ± 0.02 | -0.06 ± 0.00 | ✔ |
