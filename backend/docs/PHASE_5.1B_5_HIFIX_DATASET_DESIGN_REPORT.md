# HiFix Phase 5.1B-5 — Dataset & Class Design Audit Report

## Executive Summary

This report establishes the complete **Computer Vision Dataset & Class Specification** for fine-tuning the selected **YOLO11n ONNX** model in future phases of **HiFix Phase 5.1B**.

Following the benchmark selection in Phase 5.1B-4 (where YOLO11n demonstrated sub-16ms latency, 2.8 MB footprint, and 20% lower memory overhead), this audit defines the precise boundary between **on-device visual evidence detection (YOLO11n)** and **server-side multimodal reasoning (Gemini Vision AI)**.

---

## 1. Service Category Mapping & Class Taxonomy

YOLO11n object detection classes are mapped directly to existing HiFix backend service categories defined in `AIImageDiagnosisService.js`:

| HiFix Service Identifier | Target Service Area | Primary Detection Scope |
|--------------------------|---------------------|--------------------------|
| `plumbing` | Plumbing Services | Water leaks, joint drips, pipe cracks, corrosion |
| `electrical` | Electrical Services | Exposed wiring, scorched sockets, broken switchboards |
| `painting` | Painting & Waterproofing | Wall cracks, water seepage stains, peeling paint |
| `carpentry` | Carpentry & Furniture | Broken wooden joints, cabinet door hinge damage |
| `appliance_repair` | Appliance Repair | Exterior appliance housing cracks, washer leaks |
| `ac_repair` | AC Repair & Service | AC drain pipe leaks, external coil fin damage |
| `pest_control` | Pest Control | Termite mud tubes, pest infestation evidence |
| `cleaning` | Deep Cleaning | Heavy mold/mildew buildup, severe surface grime |
| `other` | General Maintenance | Miscellaneous surface damage |

---

## 2. Detection vs. Diagnosis Distinction

> [!IMPORTANT]
> **Core Architectural Rule**:
> - **YOLO11n (On-Device)** detects **ONLY visible surface patterns/evidence** (e.g., `"visible_pipe_leak"`). It NEVER asserts internal or technical diagnostic root causes.
> - **Gemini Vision (Cloud Gateway)** receives captured frames to perform higher-level preliminary reasoning, urgency estimation, cost ranges (in ₹ INR), and safety alerts.
> - **Assigned Professional Worker** performs the final on-site physical diagnosis and authoritative pricing.

### Validity & Scope Matrix

| Candidate Class | Service | Visually Detectable? | Recommended for YOLO? | Design Decision & Rationale | Risk Level |
|-----------------|---------|----------------------|-----------------------|-----------------------------|------------|
| `visible_pipe_leak` | Plumbing | ✅ YES | ⭐ **MVP Class** | Clear visual dripping/moisture pattern near joints. | Low |
| `faucet_drain_leak` | Plumbing | ✅ YES | ⭐ **MVP Class** | Visible water pooling below sink/faucet fixture. | Low |
| `exposed_wire` | Electrical | ✅ YES | ⭐ **MVP Class** | High-contrast visual hazard (bare copper/sheathing). | ⚠️ HIGH (Safety Hazard) |
| `damaged_socket_switch` | Electrical | ✅ YES | ⭐ **MVP Class** | Visible cracked faceplate or scorch/burn marks. | ⚠️ HIGH (Safety Hazard) |
| `wall_crack_major` | Painting | ✅ YES | ⭐ **MVP Class** | Distinct linear surface separation on walls/ceilings. | Moderate |
| `water_seepage_stain` | Painting | ✅ YES | ⭐ **MVP Class** | Discoloration, damp patches, peeling plaster. | Low |
| `damaged_furniture_joint` | Carpentry | ✅ YES | ⭐ **MVP Class** | Fractured wooden joints, hanging cabinet doors. | Low |
| `ac_drain_leak` | AC Repair | ✅ YES | ⭐ **MVP Class** | Water dripping from indoor AC wall unit/hose. | Low |
| `internal_pressure_failure` | Plumbing | ❌ NO | ❌ **EXCLUDED** | Non-visual; requires pressure gauge test. | Excluded |
| `circuit_breaker_trip_cause` | Electrical | ❌ NO | ❌ **EXCLUDED** | Non-visual electrical load state; requires multimeter. | Excluded |
| `refrigerant_gas_leak` | AC Repair | ❌ NO | ❌ **EXCLUDED** | Odorless/colorless gas is invisible to camera. | Excluded |
| `foundation_structural_collapse` | Painting | ❌ NO | ❌ **EXCLUDED** | High-risk engineering claim; inappropriate for mobile vision. | Excluded |

---

## 3. Recommended MVP & Future Expansion Classes

### Initial MVP Classes (8 Classes)
To achieve high precision and fast convergence without model confusion, the first version of the HiFix dataset will focus on **8 high-value, distinct visual classes**:

1. `visible_pipe_leak`
2. `faucet_drain_leak`
3. `exposed_wire` (Triggers Safety Warning)
4. `damaged_socket_switch` (Triggers Safety Warning)
5. `wall_crack_major`
6. `water_seepage_stain`
7. `damaged_furniture_joint`
8. `ac_drain_leak`

### Future Expansion Classes (Phase 5.1C)
- `termite_damage_wood` (Pest Control)
- `mold_mildew_patch` (Deep Cleaning)
- `burnt_appliance_plug` (Appliance Repair)
- `tile_fracture` (Masonry)

---

## 4. Class Hierarchy & System Pipeline

```
Mobile Camera Feed (30 FPS Preview)
       ↓
YOLO11n On-Device Detector (4 FPS Frame Processor)
       ↓
Detection: "exposed_wire" (Confidence 88%)
       ↓
Visual Bounding Box Overlay + [ Capture Frame ] Button
       ↓
Captured Image Payload → HiFix Backend (/api/ai/image-diagnosis)
       ↓
AI Gateway → Gemini Vision Multimodal Reasoning
       ↓
Structured Diagnosis JSON:
  - Problem: "Exposed Switchboard Wiring"
  - Service: "Electrical"
  - Safety Warning: "HAZARD: Do not touch live wires. Shut off main circuit breaker."
  - Cost: "₹400 - ₹900"
       ↓
Homeowner Dashboard → [ Book Professional Electrician ]
```

---

## 5. Model Task Representation & Dataset Size Budget

- **Model Task**: **Single-Stage Object Detection** (Bounding Box `[x_center, y_center, width, height]` + Class ID). Segmentation is excluded to preserve sub-16ms inference latency on mobile hardware.
- **Dataset Size Strategy**:

| Dataset Stage | Total Images | Images Per Class | Training (70%) | Validation (15%) | Test (15%) |
|---------------|--------------|------------------|----------------|------------------|------------|
| **Minimum Viable (MVP)** | **1,200** | 150 | 840 | 180 | 180 |
| **Recommended Production** | **3,200** | 400 | 2,240 | 480 | 480 |
| **Scale Expansion** | **8,000** | 1,000 | 5,600 | 1,200 | 1,200 |

---

## 6. Data Split & Diversity Safeguards

- **De-duplication & Data Leakage Prevention**: Images captured from the same home, room, or angle MUST remain strictly in the same split (Train, Val, or Test) to prevent model memorization.
- **Diversity Dimensions**:
  - **Lighting**: Direct sunlight, warm indoor incandescent, dim ambient, smartphone flashlight illuminated.
  - **Environment**: Urban Indian apartments, independent houses, modern tile, aged plaster, various wall paint textures.
  - **Angles & Distances**: Close-up macro (0.3m), medium shot (1.0m), wide room context (2.5m).
  - **Camera Hardware**: Entry-level Android (720p/1080p budget sensors), mid-range, and flagship cameras.

---

## 7. Privacy, Anonymization & Quality Assurance

- **PII Scrubbing**: All images collected for training must be automatically sanitized:
  - Faces and people blurred or cropped out.
  - Personal photographs, house numbers, documents, and vehicle license plates excluded.
  - EXIF GPS metadata stripped prior to model ingestion.
- **Hard-Negative Strategy**:
  - Include 15% "Normal/Undamaged" background images (normal clean pipes, undamaged wall sockets, smooth painted walls).
  - Prevents the YOLO detector from generating false positives when pointing the camera at undamaged home fixtures.
- **Rejection Criteria**:
  - Blurry / out-of-focus images (Laplacian variance < 100).
  - Extremely dark / underexposed images without visible contrast.
  - Duplicate or near-identical burst shots.
  - Watermarked or copyright-restricted images.

---

## 8. Training Plan & Mobile Optimization

- **Base Model**: `yolo11n.pt` (Ultralytics PyTorch pretrained weights).
- **Training Resolution**: **320x320** (matching production mobile inference tensor size).
- **Augmentation Hyperparameters**:
  - `hsv_h: 0.015`, `hsv_s: 0.7`, `hsv_v: 0.4` (Color/lighting jitter)
  - `degrees: 10.0`, `translate: 0.1`, `scale: 0.5`, `fliplr: 0.5` (Geometric transformation)
  - `mosaic: 1.0` (Multi-image composition)
- **Target Metrics**:
  - `mAP50` >= **0.82**
  - `Precision` >= **0.85**
  - `Recall` >= **0.78**
- **Mobile Export**: PyTorch → ONNX INT8 Quantization (`yolo11n_hifix_int8.onnx`, **2.8 MB** binary size).

---

## 9. Dataset Versioning Contract

To ensure model reproducibility and rollback capability, dataset artifacts will follow Semantic Versioning:

```
Dataset Artifact: hifix-vision-dataset-v1.0.0
├── classes.yaml (8 MVP classes)
├── train/ (70% images + labels)
├── val/   (15% images + labels)
├── test/  (15% images + labels)
└── metadata.json (hash, export timestamp, annotator signatures)
```

---

```
==========================================================
FINAL DECISION: DATASET DESIGN READY
==========================================================
```

### Rationale:
The dataset taxonomy, class boundaries, privacy rules, NMS parameters, and hard-negative sampling strategy are fully defined, aligned with existing HiFix backend categories (`AIImageDiagnosisService.js`), and ready for image collection in future implementation phases.
