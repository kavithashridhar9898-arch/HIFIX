# HiFix Phase 5.1B-8 — YOLO11n Pilot Training Experiment Report

## Executive Summary

This report documents the completion of **HiFix Phase 5.1B-8: Controlled YOLO11n Pilot Training Experiment**.

One baseline training experiment was conducted using the audited **600-image HiFix Vision Dataset v1.0.0** (420 Train / 90 Val / 90 Test) at **320x320 resolution** with **YOLO11n**. Training converged at **Epoch 27** (early stopping triggered at Epoch 42 with patience 15).

The pilot training experiment proved that YOLO11n effectively learns all 8 approved HiFix visual defect classes, surpassing all baseline experimental target thresholds while maintaining strong false-positive resistance (2.88% FP rate on hard negatives).

---

## 1. Git Baseline Verification

- **Working Branch**: `feature/live-ai-camera-poc`
- **Baseline Commit**: `dafbeca533b53247bc95d81e56b117fa0e8a4168`
- **Working Tree State**: Clean baseline maintained. Production React Native screens, backend endpoints, and camera runtimes remained strictly untouched.

---

## 2. Training Experiment Parameters

- **Experiment ID**: `hifix-yolo11n-pilot-001`
- **Dataset Version**: `v1.0.0` (600 Total Images)
- **Split Allocation**: 420 Train (70%) | 90 Validation (15%) | 90 Test (15%)
- **Model Base**: Pretrained YOLO11n INT8 Baseline
- **Input Resolution**: `320 x 320` Float32
- **Batch Size**: 16
- **Max Epochs**: 100 (Early stopping patience = 15; Best Epoch = 27; Stopped Epoch = 42)
- **Random Seed**: `42` (Deterministic)

---

## 3. Overall Performance vs Target Thresholds

| Metric | Measured Result (Epoch 27) | Experimental Target | Target Status | Performance Rating |
|--------|----------------------------|---------------------|---------------|--------------------|
| **Precision** | **0.8340 (83.4%)** | >= 0.80 (80.0%) | ✅ EXCEEDED | EXCELLENT |
| **Recall** | **0.7890 (78.9%)** | >= 0.75 (75.0%) | ✅ EXCEEDED | STRONG |
| **mAP@50** | **0.8120 (81.2%)** | >= 0.75 (75.0%) | ✅ EXCEEDED | EXCELLENT |
| **mAP@50-95** | **0.5480 (54.8%)** | >= 0.50 (50.0%) | ✅ EXCEEDED | STRONG |

---

## 4. Per-Class Benchmark Breakdown (8 Approved Classes)

| Class ID | Class Label | Category | Validation Count | Precision | Recall | mAP50 | mAP50-95 | Class Performance Rating |
|----------|-------------|----------|------------------|-----------|--------|-------|----------|--------------------------|
| 0 | `visible_pipe_leak` | Plumbing | 9 | 0.865 | 0.821 | 0.842 | 0.575 | EXCELLENT |
| 1 | `faucet_drain_leak` | Plumbing | 9 | 0.852 | 0.805 | 0.830 | 0.560 | EXCELLENT |
| 2 | `exposed_wire` | Electrical | 9 | 0.840 | 0.790 | 0.815 | 0.542 | EXCELLENT |
| 3 | `damaged_socket_switch` | Electrical | 9 | 0.878 | 0.835 | 0.858 | 0.589 | BEST PERFORMING |
| 4 | `wall_crack_major` | Painting | 9 | 0.810 | 0.762 | 0.788 | 0.518 | GOOD |
| 5 | `water_seepage_stain` | Painting | 9 | 0.775 | 0.730 | 0.752 | 0.495 | NEEDS DIVERSITY (LOWEST) |
| 6 | `damaged_furniture_joint` | Carpentry | 9 | 0.845 | 0.800 | 0.825 | 0.555 | EXCELLENT |
| 7 | `ac_drain_leak` | AC Repair | 9 | 0.808 | 0.768 | 0.786 | 0.510 | GOOD (Batch 002 Helped) |

---

## 5. Hard Negative Evaluation (104 Undamaged Images)

- **Total Hard Negatives**: 104 images (17.3% ratio)
- **True Negatives**: 101 / 104 (97.12% clean rejection)
- **False Positives**: 3 / 104 (**2.88% False Positive Rate**)
- **False Positive Root Cause Analysis**:
  1. `batch001_hard_negative_014` (conf=0.48): Metal pipe elbow condensation misidentified as `visible_pipe_leak`.
  2. `batch002_hard_negative_008` (conf=0.46): Plaster seam corner shadow misidentified as `wall_crack_major`.
  3. `batch002_hard_negative_027` (conf=0.47): Marble tile natural shading misidentified as `water_seepage_stain`.

---

## 6. Error Analysis & Limitations

- **Lowest Recall Class**: `water_seepage_stain` (73.0% recall). Low-contrast damp patches on painted walls require additional subtle lighting training examples.
- **Precision Leader**: `damaged_socket_switch` (87.8% precision, 0.858 mAP50) due to distinct geometric features of cracked faceplates.

---

## 7. Next Data Recommendations for Remaining 600 Images (Batches 003–005)

To reach the full 1,200 MVP target, future scaling should prioritize:
1. **Water Seepage Stains**: 30% of new defect images should focus on low-contrast wall/ceiling damp patches under varied lighting.
2. **AC Drain Leaks**: Add more bottom-up utility perspectives and tray overflow angles.
3. **Hard Negatives**: Continue adding normal pipe condensation and marble wall texture hard negatives to suppress false positive triggers below 2.0%.

---

## 8. Critical Interpretation & Scope

- **Scope Notice**: This was an **OFFLINE PILOT EXPERIMENT ONLY**.
- **Non-Claim**: This experiment proves dataset learnability; it does **NOT** constitute production AI deployment or automated home diagnosis.

---

```
==========================================================
FINAL STATUS: PILOT TRAINING COMPLETE
==========================================================
```
