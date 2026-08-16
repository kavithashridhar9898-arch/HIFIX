# HiFix Vision Dataset v1.0.0 Ingestion & Workflow Guide

## Overview

This guide explains how to safely add, verify, sanitize, quarantine, and document images for the **HiFix Vision Dataset v1.0.0** using the automated ingestion infrastructure (`backend/scripts/datasetIngestionTool.js`).

---

## 1. Where to Place Incoming Images

Place all candidate image files into the incoming workspace directory:
```
datasets/hifix-vision/v1.0.0/incoming/
```

Corresponding JSON metadata files (carrying license, provenance, consent, and class label fields) should be placed with matching file basenames into:
```
datasets/hifix-vision/v1.0.0/metadata/
```

Example:
- Image: `incoming/img_plumbing_001.jpg`
- Metadata: `metadata/img_plumbing_001.json`

---

## 2. Required Provenance Metadata Fields

Each metadata JSON file MUST conform to `datasets/hifix-vision/v1.0.0/metadata/provenance-schema.json`:

```json
{
  "image_id": "img_plumbing_001",
  "source_type": "hifix_original",
  "source_name": "HiFix Worker App Capture",
  "source_url": "internal://hifix-storage/captures/001.jpg",
  "license": "HiFix Proprietary Consent",
  "license_version": "1.0",
  "commercial_use_approved": true,
  "ml_training_approved": true,
  "attribution_required": false,
  "collection_date": "2026-08-16T20:00:00Z",
  "class_label": "visible_pipe_leak",
  "annotator_id": "qa_team_01",
  "consent_status": "CONSENT_VERIFIED",
  "privacy_sanitized": false,
  "exif_stripped": false,
  "dataset_version": "v1.0.0"
}
```

---

## 3. Approved Class Taxonomy

Only the **8 approved class IDs** (or `hard_negative: true`) are accepted by the validator:

| Class ID | Class Name | Service Category |
|----------|------------|------------------|
| 0 | `visible_pipe_leak` | Plumbing |
| 1 | `faucet_drain_leak` | Plumbing |
| 2 | `exposed_wire` | Electrical |
| 3 | `damaged_socket_switch` | Electrical |
| 4 | `wall_crack_major` | Painting |
| 5 | `water_seepage_stain` | Painting |
| 6 | `damaged_furniture_joint` | Carpentry |
| 7 | `ac_drain_leak` | AC Repair |
| N/A | Hard Negative (`hard_negative: true`) | Undamaged Fixtures |

---

## 4. Running the Ingestion Tool

Run the automated ingestion, validation, EXIF sanitization, hashing, and report generator:

```bash
node backend/scripts/datasetIngestionTool.js
```

### Ingestion Workflow:
1. **SHA-256 & dHash Duplicate Check**: Discards exact and near-duplicates to `quarantine/`.
2. **Format & Size Validation**: Verifies extension (`.jpg`, `.jpeg`, `.png`, `.webp`) and size (`5KB` to `15MB`).
3. **Consent & Class Verification**: Verifies `CONSENT_VERIFIED` for HiFix originals and valid class tags.
4. **EXIF Metadata Stripping**: Removes GPS/device tags and outputs sanitized copy to `sanitized/`.
5. **Manifest & Report Generation**: Automatically updates `manifests/dataset-manifest.json` and generates `reports/DATASET_VALIDATION_REPORT.md`.

---

## 5. Quarantine & Rejection Handling

Files that fail validation are moved to:
```
datasets/hifix-vision/v1.0.0/quarantine/
```
Detailed rejection reasons are logged in `quarantine/rejections.json`. Files in quarantine will NOT enter the verified training splits.
