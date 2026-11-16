# Model gelişim raporu

Referans (geliştirme): **001_v1** · Referans (ayrılmış): **008_v1_holdout**

Farklar aynı senaryo ve tohumlarda eşleştirilmiştir; ± değerler %95 güven aralığıdır. Oranlar yüzde puan olarak verilmiştir.

## Geliştirme tohumları (0–9)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 76.3% | +0.0 ± 0.0 | +22.5 ± 1.0 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 70.3% | -6.0 ± 0.7 | +16.5 ± 0.7 | -0.8 ± 0.4 | +0.24 ± 0.04 | -0.26 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 75.6% | -0.7 ± 0.3 | +21.9 ± 1.1 | +0.5 ± 0.2 | +0.00 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 75.5% | -0.8 ± 0.3 | +21.7 ± 1.0 | +0.5 ± 0.3 | +0.01 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 75.1% | -1.2 ± 0.4 | +21.3 ± 1.0 | +0.4 ± 0.3 | +0.02 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 74.3% | -2.0 ± 0.4 | +20.5 ± 1.0 | +0.1 ± 0.3 | +0.06 ± 0.02 | -0.12 ± 0.01 | ✔ |
| 007_v5_kota5_ayarli | v5_kota5_ayarli | 75.3% | -1.0 ± 0.4 | +21.5 ± 1.0 | +0.3 ± 0.1 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 71.9% | +0.0 ± 0.0 | +0.7 ± 0.5 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 71.3% | -0.6 ± 0.3 | +0.0 ± 0.7 | +0.1 ± 0.5 | +0.02 ± 0.02 | -0.14 ± 0.02 | ✔ |
| 003_v3 | v3_garanti | 71.5% | -0.5 ± 0.4 | +0.2 ± 0.8 | +0.3 ± 0.5 | +0.01 ± 0.02 | -0.12 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 71.9% | -0.0 ± 0.4 | +0.6 ± 0.7 | +0.5 ± 0.4 | -0.01 ± 0.02 | -0.11 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 72.1% | +0.2 ± 0.5 | +0.9 ± 0.6 | +0.6 ± 0.5 | -0.02 ± 0.03 | -0.10 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 72.1% | +0.2 ± 0.5 | +0.9 ± 0.6 | +0.6 ± 0.5 | -0.02 ± 0.03 | -0.10 ± 0.01 | ✔ |
| 007_v5_kota5_ayarli | v5_kota5_ayarli | 71.8% | -0.1 ± 0.5 | +0.6 ± 0.6 | +0.6 ± 0.5 | -0.01 ± 0.03 | -0.08 ± 0.01 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 66.1% | +0.0 ± 0.0 | +25.7 ± 0.9 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 57.2% | -8.9 ± 0.7 | +16.8 ± 0.8 | -2.6 ± 0.3 | +0.50 ± 0.04 | -0.30 ± 0.02 | ✔ |
| 003_v3 | v3_garanti | 65.5% | -0.6 ± 0.5 | +25.1 ± 1.0 | +0.2 ± 0.1 | +0.01 ± 0.03 | -0.08 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 65.4% | -0.7 ± 0.4 | +25.0 ± 1.0 | +0.2 ± 0.2 | +0.02 ± 0.02 | -0.07 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 65.8% | -0.3 ± 0.5 | +25.4 ± 1.0 | +0.3 ± 0.3 | -0.01 ± 0.03 | -0.06 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 64.1% | -2.0 ± 0.4 | +23.7 ± 0.8 | -0.3 ± 0.3 | +0.09 ± 0.02 | -0.11 ± 0.01 | ✔ |
| 007_v5_kota5_ayarli | v5_kota5_ayarli | 64.3% | -1.8 ± 0.4 | +23.9 ± 0.9 | -0.2 ± 0.2 | +0.08 ± 0.02 | -0.09 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 001_v1 ⭐ | gbm_v1 | 76.3% | +0.0 ± 0.0 | +22.5 ± 1.0 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 002_v2 | v2_adil | 70.3% | -6.0 ± 0.7 | +16.5 ± 0.7 | -0.6 ± 0.5 | +0.24 ± 0.04 | -0.26 ± 0.01 | ✔ |
| 003_v3 | v3_garanti | 75.6% | -0.7 ± 0.3 | +21.9 ± 1.1 | +0.7 ± 0.3 | +0.00 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 004_v4 | v4_mesafe | 75.5% | -0.8 ± 0.3 | +21.7 ± 1.0 | +0.6 ± 0.3 | +0.01 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 005_v5 | v5_denge | 75.1% | -1.2 ± 0.4 | +21.3 ± 1.0 | +0.6 ± 0.3 | +0.02 ± 0.02 | -0.09 ± 0.01 | ✔ |
| 006_v5_kota5 | v5_kota5 | 74.3% | -2.0 ± 0.4 | +20.5 ± 1.0 | +0.3 ± 0.3 | +0.06 ± 0.02 | -0.12 ± 0.01 | ✔ |
| 007_v5_kota5_ayarli | v5_kota5_ayarli | 75.3% | -1.0 ± 0.4 | +21.5 ± 1.0 | +0.3 ± 0.2 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |

## Ayrılmış tohumlar (1000–1009)

### Senaryo: baz

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 008_v1_holdout ⭐ | gbm_v1 | 74.0% | +0.0 ± 0.0 | +21.7 ± 1.2 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v5_holdout | v5_denge | 73.2% | -0.9 ± 0.5 | +20.8 ± 1.2 | +0.5 ± 0.3 | +0.01 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 010_v5_kota5_holdout | v5_kota5 | 72.6% | -1.4 ± 0.6 | +20.2 ± 1.2 | +0.3 ± 0.3 | +0.04 ± 0.03 | -0.12 ± 0.01 | ✔ |
| 011_v5_kota5_ayarli_holdout | v5_kota5_ayarli | 73.1% | -0.9 ± 0.4 | +20.7 ± 1.1 | +0.2 ± 0.2 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |

### Senaryo: homojen

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 008_v1_holdout ⭐ | gbm_v1 | 71.2% | +0.0 ± 0.0 | +0.4 ± 0.7 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v5_holdout | v5_denge | 70.5% | -0.7 ± 0.5 | -0.3 ± 0.5 | -0.1 ± 0.3 | +0.03 ± 0.02 | -0.10 ± 0.02 | ✔ |
| 010_v5_kota5_holdout | v5_kota5 | 70.5% | -0.7 ± 0.5 | -0.3 ± 0.5 | -0.1 ± 0.3 | +0.03 ± 0.02 | -0.10 ± 0.02 | ✔ |
| 011_v5_kota5_ayarli_holdout | v5_kota5_ayarli | 70.8% | -0.3 ± 0.5 | +0.1 ± 0.5 | +0.1 ± 0.4 | +0.01 ± 0.02 | -0.08 ± 0.02 | ✔ |

### Senaryo: yuksek_degiskenlik

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 008_v1_holdout ⭐ | gbm_v1 | 65.7% | +0.0 ± 0.0 | +26.2 ± 1.1 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v5_holdout | v5_denge | 65.1% | -0.7 ± 0.7 | +25.5 ± 1.3 | +0.4 ± 0.3 | +0.01 ± 0.04 | -0.06 ± 0.01 | ✔ |
| 010_v5_kota5_holdout | v5_kota5 | 63.1% | -2.6 ± 0.6 | +23.6 ± 1.0 | -0.1 ± 0.3 | +0.11 ± 0.03 | -0.12 ± 0.02 | ✔ |
| 011_v5_kota5_ayarli_holdout | v5_kota5_ayarli | 63.9% | -1.9 ± 0.5 | +24.3 ± 1.1 | -0.3 ± 0.4 | +0.10 ± 0.03 | -0.09 ± 0.01 | ✔ |

### Senaryo: belirsiz_yol

| Kayıt | Model | 5 dk uygun teklif | Referansa göre | En erkene göre | Zamanında ziyaret (ref. göre) | Bildirim/ziyaret (ref. göre) | Gini (ref. göre) | Geçerli |
|---|---|---|---|---|---|---|---|---|
| 008_v1_holdout ⭐ | gbm_v1 | 74.0% | +0.0 ± 0.0 | +21.7 ± 1.2 | +0.0 ± 0.0 | +0.00 ± 0.00 | +0.00 ± 0.00 | ✔ |
| 009_v5_holdout | v5_denge | 73.2% | -0.9 ± 0.5 | +20.8 ± 1.2 | +0.6 ± 0.4 | +0.01 ± 0.02 | -0.10 ± 0.01 | ✔ |
| 010_v5_kota5_holdout | v5_kota5 | 72.6% | -1.4 ± 0.6 | +20.2 ± 1.2 | +0.4 ± 0.4 | +0.04 ± 0.03 | -0.12 ± 0.01 | ✔ |
| 011_v5_kota5_ayarli_holdout | v5_kota5_ayarli | 73.1% | -0.9 ± 0.4 | +20.7 ± 1.1 | +0.4 ± 0.3 | +0.03 ± 0.02 | -0.09 ± 0.01 | ✔ |
