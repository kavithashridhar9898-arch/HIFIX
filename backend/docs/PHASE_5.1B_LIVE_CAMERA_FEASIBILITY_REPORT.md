# HiFix Phase 5.1B — Live AI Diagnostic Camera Feasibility & Architecture Audit

## Executive Summary

This report presents a comprehensive technical feasibility and architecture audit for **HiFix Phase 5.1B: Live AI Diagnostic Camera**. 

The proposed feature aims to introduce real-time, on-device object detection (YOLOv8) via the mobile device camera to draw bounding boxes and confidence overlays over home service problems (e.g., pipe leaks, exposed wiring, wall cracks), allowing users to capture optimized frames for detailed processing by the existing **HiFix Phase 5.1 AI Gateway & Gemini Vision** pipeline.

---

## 1. Current Expo & React Native Compatibility

| Specification | Current HiFix State | Phase 5.1B Requirement | Compatibility Assessment |
|---------------|--------------------|------------------------|--------------------------|
| **React Native** | `0.81.5` | `0.73+` | ✅ Compatible |
| **Expo SDK** | `54.0.23` | `50+` | ✅ Compatible |
| **JS Engine** | `Hermes` | `Hermes` with C++ JSI | ✅ Compatible |
| **Camera Library** | `expo-camera: ^17.0.9` | High-frequency frame processor pipeline | ⚠️ Requires `react-native-vision-camera` |
| **Build System** | EAS / Development Build (`npx expo run:android`) | Development Build / Custom Native Code | ✅ Project is already configured for native dev builds |
| **Expo Go** | Compatible for general screens | **Incompatible** for custom C++ JSI Vision libraries | ⚠️ Requires Custom Development Build |

> [!IMPORTANT]
> **Expo Go Limitations**: Vanilla **Expo Go** does NOT support custom native C++ JSI modules (`onnxruntime-react-native`, `react-native-fast-tflite`, `vision-camera-onnx`). Implementing real-time native frame processing requires compiling a **Custom Development Build** (`npx expo run:android` / EAS Development Build), which HiFix already supports in its build pipeline.

---

## 2. Target Hybrid Architecture Evaluation

The evaluated hybrid architecture is **highly recommended and technically sound**:

```
Mobile Camera (30 FPS Viewfinder)
       ↓
Frame Sampler (Throttled to 4 FPS = every 250ms)
       ↓
On-Device YOLOv8n (ONNX / TFLite via C++ JSI ~15ms inference)
       ↓
Real-Time Visual Overlay (Bounding Box + Label + Confidence Score)
       ↓
User Taps "Capture & Diagnose" (or Auto-Trigger when Confidence > 80%)
       ↓
High-Resolution Frame Capture (1024x1024 JPEG ~150KB)
       ↓
HiFix Backend (POST /api/ai/image-diagnosis)
       ↓
Phase 5.0 AI Gateway → Gemini Vision AI
       ↓
Structured Diagnosis JSON (INR Costs, Urgency, Symptoms, Safety Warnings)
       ↓
React Native Results Screen → [ Book Service ] Bridge
```

### Architectural Benefits:
1. **Zero Gemini Cost for Live Framing**: The 30 FPS camera feed is processed **100% on-device** using YOLO. Zero API calls or network requests occur while moving the camera around.
2. **Instant Visual Feedback**: Homeowners receive real-time bounding boxes showing where the problem is recognized.
3. **Optimized Gemini Payload**: Only a single optimized, compressed frame is sent to Gemini when the user confirms or when YOLO confidence exceeds 80%.

---

## 3. Model Strategy & YOLO Evaluation

### Generic vs. Fine-Tuned Models
Standard pre-trained YOLOv8 models (trained on COCO 80 classes) detect generic objects like `person`, `chair`, `cup`, `laptop`, or `car`. They **CANNOT** detect HiFix domain-specific service defects like `pipe_leakage`, `exposed_wiring`, `wall_crack`, or `ac_water_drip` without a fine-tuned domain dataset.

### YOLO Model Benchmark Comparison

| Model Variant | Parameters | Input Resolution | INT8 Quantized Size | Mobile CPU Latency | Mobile NPU/GPU Latency | Memory Footprint | Recommended Starting Model |
|---------------|------------|------------------|---------------------|--------------------|------------------------|------------------|---------------------------|
| **YOLOv8n (Nano)** | **3.2 M** | **320x320 / 640x640** | **3.5 MB** | **~15–22 ms** | **~4–8 ms** | **< 45 MB** | ⭐ **RECOMMENDED** |
| **YOLOv8s (Small)** | 11.2 M | 640x640 | 11.5 MB | ~45–65 ms | ~15–25 ms | ~90 MB | Secondary Tier |
| **YOLOv11n (Nano)** | 2.6 M | 320x320 / 640x640 | 2.8 MB | ~12–18 ms | ~3–6 ms | < 40 MB | Alternative Option |
| **YOLOv8m (Medium)**| 25.9 M | 640x640 | 26.2 MB | ~120–180 ms | ~40–60 ms | > 180 MB | ❌ Unsuitable for 30 FPS Mobile |

### Primary Model Recommendation
**YOLOv8n (INT8 Quantized ONNX / TFLite format)**:
- Ultra-lightweight footprint (**3.5 MB**).
- Blazing fast inference (**~15ms on mid-range Android/iOS CPUs**).
- Minimal RAM allocation (**< 45 MB**).

---

## 4. On-Device Inference Runtimes

| Runtime Option | Expo / React Native Package | Pros | Cons | Recommendation |
|----------------|-----------------------------|------|------|----------------|
| **ONNX Runtime** | `onnxruntime-react-native` | Direct cross-platform support (Core ML on iOS, NNAPI on Android), handles INT8 & FP16 ONNX models seamlessly. | Slightly larger native library binary size (+6 MB). | ⭐ **PRIMARY CHOICE** |
| **Fast TFLite** | `react-native-fast-tflite` | Uses GPU Delegate on Android & Metal on iOS via C++ JSI bindings. Extremely fast. | Requires custom TFLite conversion pipeline. | **SECONDARY CHOICE** |
| **WebAssembly / Canvas** | `@tensorflow/tfjs-react-native` | Works in Expo Go without native builds. | Slow (100–300ms per frame), drains battery, drops UI frame rate. | ❌ NOT RECOMMENDED |

---

## 5. Camera Performance & Sampling Budget

> [!WARNING]
> Running AI inference on every single camera frame (30 FPS) will cause severe thermal throttling, rapid battery drain, and UI stutter on mid-range devices.

### Recommended Frame Sampling Strategy
- **Camera Viewfinder**: 30 FPS (smooth preview stream at 720p or 1080p).
- **AI Inference Trigger**: **4 FPS** (Sample 1 frame every **250 ms**).
- **Inference Input Resolution**: Crop and resize frame tensor to **320x320 RGB**.
- **Detection Overlay Update**: Interpolate bounding box coordinates smoothly on UI thread at 60 FPS using `react-native-reanimated`.

### Confidence Thresholds
- **Visual Bounding Box Display**: Threshold **`>= 0.45`** (45%).
- **Auto-Capture Suggestion Prompt**: Threshold **`>= 0.75`** (75%).

---

## 6. Dataset & Training Requirements

To enable YOLOv8n to recognize HiFix service problems, a custom fine-tuned model must be trained.

### Target HiFix Classes (10 Service Categories)
1. `pipe_leak` (Plumbing)
2. `faucet_drain_issue` (Plumbing)
3. `exposed_wire` (Electrical)
4. `damaged_switchboard` (Electrical)
5. `wall_crack` (Masonry / Painting)
6. `water_seepage` (Plumbing / Painting)
7. `furniture_damage` (Carpentry)
8. `appliance_defect` (Appliance Repair)
9. `ac_coil_damage` (AC Repair)
10. `pest_evidence` (Pest Control)

### Dataset Size & Annotation Requirements
- **Dataset Size**: Minimum **500–800 annotated images per class** (Total: **5,000–8,000 images**).
- **Annotation Format**: YOLO Bounding Box format (`class_id x_center y_center width height`).
- **Data Augmentation**: Brightness variations, rotation, mosaic, blur, and lighting adjustments to mimic real homeowner environment conditions.
- **Training Pipeline**: PyTorch Ultralytics YOLOv8 → Export to ONNX INT8 (`yolov8n_hifix_int8.onnx`).

---

## 7. Security, Privacy & Offline Strategy

- **API Key Security**: Unchanged — API keys remain strictly on the backend (`.env`). Bounding boxes are computed locally; Gemini Vision API is called only via backend `/api/ai/image-diagnosis`.
- **Privacy & Camera Permissions**: Camera stream frames are processed strictly in volatile RAM memory. No local frames are saved to disk unless explicitly captured by the user.
- **Offline Behavior**:
  - **No Internet**: On-device YOLO continues drawing bounding boxes and labels locally ("Possible Pipe Leak 88%"). If user taps "Diagnose", app displays: *"Offline — Bounding box detected. Full AI analysis requires internet connection."*
  - **Camera Permission Denied**: Gracefully falls back to existing Phase 5.1 photo upload / gallery picker.

---

## 8. Final Decision & Architectural Recommendation

```
==========================================================
FINAL DECISION: REQUIRES ARCHITECTURE CHANGE
==========================================================
```

### Rationale:
1. **Native Module Additions Required**: Real-time 30 FPS camera frame processing with local tensor inference requires adding `react-native-vision-camera` and `onnxruntime-react-native` or `react-native-fast-tflite`. These native C++ JSI libraries require building a **Custom Development Build** (via `npx expo run:android` / EAS Build) and cannot run inside standard Expo Go.
2. **Domain Model Training Required**: A generic pre-trained YOLO model cannot detect HiFix home service defects without building a dataset of 5,000+ annotated domain images and fine-tuning `yolov8n_hifix.onnx`.

---

## 9. Recommended Implementation Roadmap (When Scheduled)

1. **Phase 5.1B-1**: Curate and annotate 5,000+ image dataset for 10 HiFix service categories on Roboflow/COCO.
2. **Phase 5.1B-2**: Train Ultralytics YOLOv8n model and export to `yolov8n_hifix_int8.onnx` (3.5 MB).
3. **Phase 5.1B-3**: Install `react-native-vision-camera` and `onnxruntime-react-native` in frontend and generate custom EAS/Android development build.
4. **Phase 5.1B-4**: Create `LiveCameraDiagnosisScreen` component with 4 FPS frame sampling, bounding box overlay, and seamless handoff to existing `/api/ai/image-diagnosis` backend endpoint.
