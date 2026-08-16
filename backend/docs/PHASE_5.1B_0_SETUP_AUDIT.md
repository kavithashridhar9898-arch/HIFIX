# HiFix Phase 5.1B-0 — Live AI Camera POC Technical Setup Audit

## Executive Summary

This document presents the **Phase 5.1B-0 Technical Setup Audit** for establishing a **Live AI Diagnostic Camera POC** using on-device YOLO object detection in the HiFix mobile application.

This audit evaluates the existing frontend repository setup, dependency stack, build configuration, camera capabilities, and on-device machine learning options **without modifying source code or installing packages**.

---

## 1. Current Frontend Environment Inspection

| Environment Property | Configured Value | Assessment |
|----------------------|------------------|------------|
| **Expo SDK Version** | `54.0.23` | ✅ Modern, supports latest native Expo plugins |
| **React Native Version** | `0.81.5` | ✅ Compatible with C++ JSI native runtimes |
| **JavaScript Engine** | `Hermes` (`jsEngine: "hermes"` in `app.json`) | ✅ High performance, JSI enabled |
| **Camera Library** | `expo-camera: ^17.0.9` | ⚠️ Suitable for single captures, insufficient for 30 FPS Frame Processors |
| **Build System** | EAS Build (`eas.json` with `developmentClient: true`) + `android/` native project | ✅ Already configured for native development builds |
| **Existing Native Modules** | `@notifee/react-native`, `@react-native-firebase/app`, `@react-native-google-signin/google-signin`, `react-native-maps`, `react-native-reanimated: 4.1.4`, `react-native-worklets: ^0.10.2` | ✅ Reanimated & Worklets are already present in `package.json` |
| **Babel Preset** | `babel-preset-expo` in `babel.config.js` | ⚠️ Needs `react-native-worklets/plugin` if Worklet Frame Processors are added |

---

## 2. Capabilities Check

| Feature | Supported in Current Stack? | Requirements & Notes |
|---------|---------------------------|----------------------|
| **`react-native-vision-camera`** | ✅ YES (Native Build) | Requires adding package + Android Camera permissions in `app.json` |
| **On-Device ONNX Inference** | ✅ YES (Native Build) | Compatible via `onnxruntime-react-native` |
| **YOLO Model Execution** | ✅ YES | INT8 / FP16 ONNX models execute via C++ JSI bindings |
| **Native Frame Processors** | ✅ YES | Supported using Vision Camera v4 + Reanimated/Worklets |
| **Expo Go Execution** | ❌ **NO** | Standard Expo Go lacks native C++ JSI Vision libraries |
| **Custom Development Build** | ✅ **YES (Required)** | Supported via `npx expo run:android` or `eas build --profile development` |

---

## 3. Options Comparison

### Option A: `react-native-vision-camera` + `onnxruntime-react-native`
- **Pros**:
  - Native cross-platform ONNX runtime (NNAPI on Android, CoreML on iOS, CPU fallback).
  - Directly loads `.onnx` models exported natively by Ultralytics YOLOv8 (`yolov8n.onnx`).
  - Robust support for INT8 quantized tensors without manual graph conversion.
- **Cons**:
  - Adds ~6–8 MB to native binary APK size.

### Option B: `react-native-vision-camera` + `react-native-fast-tflite`
- **Pros**:
  - High performance GPU Delegate execution on Android and Metal on iOS.
  - Very lightweight JSI bridge.
- **Cons**:
  - Requires multi-step conversion pipeline (PyTorch → ONNX → TensorFlow → TFLite).
  - TFLite INT8 quantization often drops accuracy for multi-class object detection.

### Audit Recommendation: **Option A (`onnxruntime-react-native`) is MORE COMPATIBLE**
Option A is recommended for HiFix because YOLOv8 natively exports to ONNX format with 100% layer support, avoiding complex PyTorch → TFLite conversion quirks.

---

## 4. Required Packages & Native Configurations

When implementation proceeds, the following packages must be added:

### New Packages Required
- `react-native-vision-camera` (Camera frame processor host)
- `onnxruntime-react-native` (On-device neural network inference runtime)

### Required `app.json` Plugin & Permission Updates
Add Camera permissions and plugin configuration to `frontend/app.json`:
```json
"plugins": [
  [
    "expo-camera",
    {
      "cameraPermission": "Allow HiFix to use the camera for live AI problem diagnosis."
    }
  ]
],
"android": {
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO"
  ]
}
```

---

## 5. Risks & Development Notes

1. **Expo Go Incompatibility**: Real-time frame processors and ONNX inference CANNOT run inside the Expo Go app. Developers must run `npx expo run:android` or use an EAS Development Build.
2. **Build Time Increase**: Native C++ compilation during first prebuild adds ~2–3 minutes to native build time.
3. **Hermes & Worklets Compatibility**: Ensure `react-native-reanimated` worklet plugin is properly configured in `babel.config.js`.

---

## 6. Recommended Next Steps

1. Configure camera permissions in `app.json`.
2. Add `react-native-vision-camera` and `onnxruntime-react-native` to `frontend/package.json`.
3. Generate updated development build via `npx expo run:android`.
4. Create POC live camera screen (`LiveCameraScreen.js`) with 4 FPS frame sampling and ONNX model tensor execution.

---

```
==========================================================
FINAL ASSESSMENT: REQUIRES CONFIGURATION CHANGES
==========================================================
```
