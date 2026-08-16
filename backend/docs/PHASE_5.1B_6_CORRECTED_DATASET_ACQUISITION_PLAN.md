# HiFix Phase 5.1B-6 — Corrected Dataset Acquisition Plan

## Executive Summary

This document establishes the **Corrected Legal & Technical Data Acquisition Plan** for acquiring training images to fine-tune the **YOLO11n ONNX** model for **HiFix Phase 5.1B**.

This corrected plan updates legal wording, corrects dataset size accounting, and establishes explicit verification requirements for open-source and original data sources **without downloading, collecting, or training any models in this planning phase**.

---

## 1. Legal Disclaimer & Verification Requirements

> [!IMPORTANT]
> **Legal Disclaimer & Verification Mandate**:
> The acquisition plan establishes licensing, consent, privacy, provenance, and quality-control requirements intended to support lawful commercial AI training. Each dataset/source must be individually verified before inclusion.
>
> **Public Dataset Verification Rule**:
> Public availability on the web does NOT grant permission for commercial AI training. For every public dataset/repository, the team MUST verify:
> 1. Exact dataset/repository name and version
> 2. Exact license type and official license text URL
> 3. Explicit commercial-use permission
> 4. AI/ML model training permission (where specified)
> 5. Attribution & copyright notice requirements
> 6. Redistribution or derivative work restrictions
>
> If the exact license or commercial permission cannot be verified for a specific repository:
> **STATUS = DO NOT USE / LICENSE REVIEW REQUIRED**

---

## 2. Corrected Dataset Size & Accounting Breakdown

The total dataset size **includes** hard negative images (approximately 15% of the total dataset count):

| Dataset Stage | TOTAL DATASET SIZE | POSITIVE / DEFECT IMAGES (~85%) | HARD NEGATIVE IMAGES (~15%) | Training Split (70%) | Validation Split (15%) | Test Split (15%) |
|---------------|--------------------|---------------------------------|-----------------------------|----------------------|------------------------|------------------|
| **MVP (v1.0.0)** | **1,200** | **1,020** | **180** | 840 | 180 | 180 |
| **Production (v1.1.0)** | **3,200** | **2,720** | **480** | 2,240 | 480 | 480 |
| **Scale Expansion** | **8,000** | **6,800** | **1,200** | 5,600 | 1,200 | 1,200 |

### Breakdown Explanation:
- **Positive / Defect Images (~85%)**: Images containing one or more of the 8 approved HiFix visual defect classes (`visible_pipe_leak`, `faucet_drain_leak`, `exposed_wire`, `damaged_socket_switch`, `wall_crack_major`, `water_seepage_stain`, `damaged_furniture_joint`, `ac_drain_leak`).
- **Hard Negative Images (~15%)**: Images containing normal, undamaged home fixtures (clean pipes, undamaged sockets, smooth painted walls) to prevent the YOLO detector from generating false positive detections on normal home surfaces.

---

## 3. Dataset Source Classification & Verification Table

| Dataset / Source Name | Target Scope | License Type | Commercial Use Permitted? | Verification Status | Action |
|-----------------------|--------------|--------------|---------------------------|---------------------|--------|
| **COCO 2017 Dataset** | Hard Negatives (normal sinks, chairs, tvs) | `CC-BY 4.0` | ✅ YES | Verified (Official License URL) | ⭐ **APPROVED** (Attribution required in docs) |
| **Google Open Images V7** | Surface context & hard negatives | `CC-BY 2.0` | ✅ YES | Verified (Official License URL) | ⭐ **APPROVED** (Attribution required in docs) |
| **Roboflow Universe (Verified CC-BY 4.0)** | `wall_crack`, `water_stain`, `exposed_wire` | `CC-BY 4.0` | ✅ YES | Pending Per-Repo Check | ⚠️ **CONDITIONALLY APPROVED** (Requires per-repo verification) |
| **Roboflow Universe (CC-BY-NC 4.0)** | Defects | `CC-BY-NC 4.0` | ❌ **NO** | Verified Non-Commercial | ⛔ **REJECTED (DO NOT USE)** |
| **Kaggle Non-Commercial Surface Sets** | Wall cracks | `Research / NC` | ❌ **NO** | Verified Non-Commercial | ⛔ **REJECTED (DO NOT USE)** |
| **Unlabeled Web Images** | Various | Unknown | ❓ **UNCLEAR** | Unverified License | ⛔ **REJECTED (DO NOT USE)** |
| **HiFix Original Worker App Collection** | All 8 Approved Classes | `HiFix Proprietary Consent` | ✅ YES | HiFix Legal Consent Protocol | ⭐ **PRIMARY APPROVED SOURCE** |

---

## 4. Class-by-Class Acquisition Strategy

| Approved Class | Target Service Area | Primary Acquisition Source | Secondary Backup Source | Original HiFix Collection Need | Acquisition Difficulty |
|----------------|---------------------|----------------------------|-------------------------|--------------------------------|-----------------------|
| `visible_pipe_leak` | Plumbing | HiFix Original Collection | Roboflow (Verified CC-BY 4.0) | High (~60%) | Moderate |
| `faucet_drain_leak` | Plumbing | HiFix Original Collection | Open Images V7 (CC-BY 2.0) | High (~60%) | Low |
| `exposed_wire` | Electrical | HiFix Original Collection | Roboflow (Verified CC-BY 4.0) | Moderate (~40%) | Moderate |
| `damaged_socket_switch` | Electrical | HiFix Original Collection | Open Images V7 (CC-BY 2.0) | Moderate (~40%) | Low |
| `wall_crack_major` | Painting | Open Images V7 + Roboflow | HiFix Original Collection | Low (~20%) | Low (Plentiful Open Data) |
| `water_seepage_stain` | Painting | HiFix Original Collection | Roboflow (Verified CC-BY 4.0) | High (~70%) | Moderate |
| `damaged_furniture_joint` | Carpentry | HiFix Original Collection | COCO Subsets (CC-BY 4.0) | High (~70%) | High |
| `ac_drain_leak` | AC Repair | HiFix Original Collection | Synthetic Render Supplement (Max 10%) | High (~80%) | High (Niche Class) |

---

## 5. Original HiFix Collection & Consent Protocol

To ensure clear ownership and commercial rights for original images:

1. **Collector Scope**: HiFix professional service workers and QA field staff capturing photos during active service calls.
2. **Explicit Worker Opt-in Consent**: Worker mobile application displays an explicit opt-in terms screen:
   > *"I grant HiFix full rights to use anonymized surface defect images captured during service visits to train computer vision AI models."*
3. **Incentive Compensation**: Workers receive micro-credits per verified defect submission.
4. **Zero Customer PII**: Photos must isolate the localized defect (e.g., pipe fitting, switchplate) and exclude faces, house numbers, or personal documents.

---

## 6. Automated Privacy & Anonymization Pipeline

All candidate images must pass through an automated pre-ingestion privacy sanitizer:

```
Raw Image Ingestion
       ↓
Automated Face & Person Detection (YOLO/RetinaFace) → Gaussian Blur
       ↓
Automated Text & License Plate Detection (OCR) → Black Mask
       ↓
EXIF Metadata Stripper (Removes GPS coordinates, camera serials, timestamps)
       ↓
SHA-256 Hash Generation & Anonymized Storage
```

---

## 7. Dataset Provenance & Metadata Schema

Every image in the dataset repository carries a JSON provenance record:

```json
{
  "image_id": "img_hifix_plumbing_001842",
  "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "source_type": "hifix_original",
  "source_url": "internal://storage/captures/2026/08/img_001842.jpg",
  "license": "HiFix Proprietary Consent",
  "license_version": "1.0",
  "commercial_use_approved": true,
  "collection_date": "2026-08-16T20:00:00Z",
  "class_label": "visible_pipe_leak",
  "privacy_sanitized": true,
  "exif_stripped": true,
  "annotator_id": "annotator_qa_04",
  "dataset_version": "v1.0.0"
}
```

---

## 8. Duplicate Prevention & Cross-Source De-duplication

- **Exact Duplicates**: Discard files matching SHA-256 hashes of existing images.
- **Near-Duplicates / Bursts**: Calculate Difference Hash (dHash) and Perceptual Hash (pHash). Images with Hamming distance `<= 4` are grouped and placed strictly into a single data split (Train or Val or Test) to eliminate data leakage.

---

## 9. Synthetic Data & Augmentation Guidelines

- **Synthetic Data Cap**: Maximum **10% of total dataset** (reserved for rare classes like `ac_drain_leak`). Synthetic images MUST NOT replace real-world defect photos.
- **Approved Augmentations**: HSV lighting jitter (`±15%`), horizontal flip (`50%`), rotation (`±10°`), and subtle Gaussian blur (`10%`).

---

```
==========================================================
FINAL STATUS: CORRECTED ACQUISITION PLAN READY
==========================================================
```

### Rationale:
The corrected plan resolves overclaimed legal compliance wording, enforces exact per-repository license verification rules, and fixes dataset size accounting so that hard negatives are correctly included within the total 1,200 MVP image budget.
