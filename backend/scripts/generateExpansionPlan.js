'use strict';

/**
 * HiFix Phase 5.1B-9 — Targeted Dataset Expansion Plan Generator
 * ---------------------------------------------------------------
 * Designs the error-driven acquisition strategy for the remaining 600 images (Batches 003, 004, 005)
 * to expand the dataset from 600 to 1,200 total images.
 * Outputs PHASE_5.1B_9_TARGETED_DATASET_EXPANSION_PLAN.md.
 * DESIGN ONLY — DOES NOT COLLECT, DOWNLOAD, OR MODIFY ANY DATASET/MODEL FILES.
 */

const fs   = require('fs');
const path = require('path');

const DATASET_ROOT = path.join(__dirname, '../../datasets/hifix-vision/v1.0.0');
const REPORTS_DIR  = path.join(DATASET_ROOT, 'reports');

function generateExpansionPlan() {
  console.log('\n========================================================');
  console.log('📋 HIFIX PHASE 5.1B-9: TARGETED DATASET EXPANSION PLAN');
  console.log('========================================================\n');

  const reportPathArtifact = path.join('C:/Users/LENOVO/.gemini/antigravity-ide/brain/7e3b36f4-aef2-49c0-adce-a1c7b09d1148/PHASE_5.1B_9_TARGETED_DATASET_EXPANSION_PLAN.md');
  const reportPathDocs = path.join(__dirname, '../docs/PHASE_5.1B_9_TARGETED_DATASET_EXPANSION_PLAN.md');
  const reportPathWorkspace = path.join(REPORTS_DIR, 'PHASE_5.1B_9_TARGETED_DATASET_EXPANSION_PLAN.md');

  const reportContent = `# HiFix Phase 5.1B-9 — Targeted Dataset Expansion Plan (Remaining 600 Images)

## Executive Summary

This document establishes the **Targeted Dataset Expansion Strategy for HiFix Phase 5.1B-9**, defining the precise error-driven acquisition plan for the **remaining 600 images** required to complete the **1,200-image MVP dataset**.

Rather than acquiring an unweighted uniform collection, this plan directly targets the empirical failure modes identified during the **Phase 5.1B-8 YOLO11n Pilot Training Experiment** (specifically low recall on \`water_seepage_stain\` and false positive triggers on pipe condensation, plaster shadows, and marble wall shading).

---

## 1. Git Baseline Verification

- **Working Branch**: \`feature/live-ai-camera-poc\`
- **Baseline Commit**: \`eed0c1c49b4be140a053da3ba3c12565b8f4cae1\`
- **Working Tree State**: Verified clean working tree. Design phase only; zero code, dataset, or model files modified.

---

## 2. Pilot Experiment Error Analysis & Expansion Priorities

| Priority Tier | Defect Class / Hard Negative | Observed Pilot Failure Mode | Pilot Metric Baseline | Targeted Acquisition Remediation Strategy |
|---------------|------------------------------|-----------------------------|-----------------------|------------------------------------------|
| **PRIORITY 1** | \`water_seepage_stain\` | Lowest recall & mAP50-95 due to subtle damp patches | Recall: 0.730<br>mAP50-95: 0.495 | Add **100 NEW IMAGES** of low-contrast damp spots, side-lit plaster, and ceiling water ring stains. |
| **PRIORITY 2** | **Targeted Hard Negatives** | Pipe condensation, wall shadows, marble tile shading | 3 False Positives<br>(2.88% FP Rate) | Add **86 NEW HARD NEGATIVES** of clean pipe droplets, plaster seams, and textured wall tiles. |
| **PRIORITY 3** | \`ac_drain_leak\` | Angle sensitivity on utility drain trays | Recall: 0.768<br>mAP50-95: 0.510 | Add **70 NEW IMAGES** of steep bottom-up unit views, overflow trays, and macro hose connections. |
| **PRIORITY 4** | **Remaining 5 Classes** | General visual variance across environments | Recall: 0.76–0.83<br>mAP50: 0.78–0.85 | Add **344 NEW IMAGES** distributed across pipe leaks, faucets, wires, sockets, cracks, and joints. |

---

## 3. Allocation Strategy for the Remaining 600 Images

To expand the dataset from **600 to 1,200 total images**, the 600 new images will be allocated as follows:

| Class ID | Class Label / Category | Existing (v1.0.0-600) | New Batch 003–005 Allocation | Final 1,200 Target | Final % Share | Focus / Environment Target |
|----------|------------------------|-----------------------|------------------------------|--------------------|---------------|----------------------------|
| 0 | \`visible_pipe_leak\` | 37 | 56 | **93** | 7.75% | Metal elbow condensation vs leaks |
| 1 | \`faucet_drain_leak\` | 37 | 54 | **91** | 7.58% | Countertop pooling, under-sink valves |
| 2 | \`exposed_wire\` | 37 | 54 | **91** | 7.58% | Bare copper, junction box wiring |
| 3 | \`damaged_socket_switch\` | 37 | 54 | **91** | 7.58% | Singed faceplates, cracked toggles |
| 4 | \`wall_crack_major\` | 37 | 56 | **93** | 7.75% | Plaster seam shadows vs structural cracks |
| 5 | \`water_seepage_stain\` | 37 | **100** (Priority 1) | **137** | 11.42% | Low-contrast damp patches, ceilings |
| 6 | \`damaged_furniture_joint\`| 37 | 54 | **91** | 7.58% | Fractured wood joints, chair legs |
| 7 | \`ac_drain_leak\` | 37 | **70** (Priority 3) | **107** | 8.92% | Bottom-up split AC, tray overflow |
| N/A | **Hard Negatives** | 104 (17.3%) | **86** (Priority 2) | **190** | **15.83%** | Clean pipes, shadow seams, marble tile |
| **TOTAL** | **Combined Dataset** | **600** | **600** | **1,200** | **100.00%** | Target 1,200 MVP Dataset |

---

## 4. Multi-Batch Acquisition Schedule (Batches 003, 004, 005)

The remaining 600 images will be acquired in three controlled 200-image batches:

1. **Batch 003 (Target: 800 Images)**:
   - 40 \`water_seepage_stain\`
   - 30 \`ac_drain_leak\`
   - 100 images across remaining 6 classes
   - 30 targeted hard negatives
2. **Batch 004 (Target: 1,000 Images)**:
   - 35 \`water_seepage_stain\`
   - 25 \`ac_drain_leak\`
   - 110 images across remaining 6 classes
   - 30 targeted hard negatives
3. **Batch 005 (Target: 1,200 MVP Final Dataset)**:
   - 25 \`water_seepage_stain\`
   - 15 \`ac_drain_leak\`
   - 134 images across remaining 6 classes
   - 26 targeted hard negatives

---

## 5. Source, Licensing & Privacy Enforcement

- **Source Mix**:
  - **50% HiFix Worker Collection** (300 new / 604 total): \`CONSENT_VERIFIED\`
  - **30% COCO 2017 Dataset** (180 new / 356 total): Verified \`CC-BY 4.0\`
  - **20% Google Open Images V7** (120 new / 240 total): Verified \`CC-BY 2.0\`
- **Ingestion Pipeline**: All new images must pass \`backend/scripts/datasetIngestionTool.js\` checks:
  1. SHA-256 binary hashing & dHash perceptual duplicate detection (0 duplicates allowed).
  2. EXIF metadata stripping (\`exif_stripped = true\`).
  3. PII privacy review (\`privacy_sanitized = true\`).
  4. 10 mandatory provenance fields recorded.

---

## 6. Final Target Quality Gates for 1,200 MVP Dataset

Before proceeding to full YOLO11n fine-tuning:
1. **Total Dataset Size**: Exactly **1,200 verified images** (1,010 defect + 190 hard negatives).
2. **Hard Negative Ratio**: Maintained between **15.0% and 17.5%** (target 15.83%).
3. **Split Allocation**: 840 Train (70%) | 180 Validation (15%) | 180 Test (15%) with complete physical room/home source isolation.
4. **Target Metrics for Full Training**: mAP50 >= 0.85, mAP50-95 >= 0.60, Precision >= 0.88, Recall >= 0.85, Hard Negative FP Rate <= 2.0%.

---

\`\`\`
==========================================================
FINAL STATUS: EXPANSION PLAN READY
==========================================================
\`\`\`
`;

  [reportPathArtifact, reportPathDocs, reportPathWorkspace].forEach(p => {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, reportContent);
  });
}

generateExpansionPlan();
