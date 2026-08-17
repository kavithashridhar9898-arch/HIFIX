# HiFix Vision Dataset v1.0.0 Validation Report

Generated At: 2026-08-17T10:07:26.469Z

## Executive Summary
- **Dataset Version**: `v1.0.0`
- **Target Size**: 1,200 images (1,020 defect + 180 hard negatives)
- **Current Total Verified Images**: 451
- **Sanitized Workspace Images**: 601
- **Quarantined / Rejected Images**: 3

---

## 1. Class Distribution

| Class ID | Class Label | Target Count | Verified Count | Status |
|----------|-------------|--------------|----------------|--------|
| 0 | `visible_pipe_leak` | 130 | 0 | Pending Ingestion |
| 1 | `faucet_drain_leak` | 130 | 0 | Pending Ingestion |
| 2 | `exposed_wire` | 130 | 0 | Pending Ingestion |
| 3 | `damaged_socket_switch` | 130 | 0 | Pending Ingestion |
| 4 | `wall_crack_major` | 130 | 0 | Pending Ingestion |
| 5 | `water_seepage_stain` | 130 | 0 | Pending Ingestion |
| 6 | `damaged_furniture_joint` | 120 | 0 | Pending Ingestion |
| 7 | `ac_drain_leak` | 120 | 0 | Pending Ingestion |
| N/A | **Hard Negatives (~15%)** | 180 | 0 | Pending Ingestion |

---

## 2. Dataset Split Breakdown

- **Train Split (70%)**: 324 images
- **Val Split (15%)**: 72 images
- **Test Split (15%)**: 55 images

---

## 3. Data Integrity & License Verification Status

- **SHA-256 Hashing**: Active & Enforced
- **Perceptual Duplicate Detection**: Active & Enforced (dHash Hamming <= 4)
- **EXIF Metadata Stripping**: Active & Enforced
- **License Policy Verification**: Verified (Strict CC-BY 4.0 / CC0 / Original Consent)
- **Privacy Sanitization**: Active (FLAG_FOR_PRIVACY_REVIEW enabled)
