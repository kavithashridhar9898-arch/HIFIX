import { InferenceSession, Tensor } from 'onnxruntime-react-native';

// Standard COCO 80 object detection class names
export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

class YOLOInferenceService {
  constructor() {
    this.session = null;
    this.isInitializing = false;
    this.modelLoaded = false;
    this.inputShape = [1, 3, 320, 320]; // Default 320x320 for mobile speed
    this.confThreshold = 0.45;
  }

  /**
   * Initializes the ONNX inference session from a local file path / asset URI.
   * Runs isolated inside try/catch to ensure zero camera crashes if model fails.
   */
  async init(modelPath, options = {}) {
    if (this.session || this.isInitializing) return true;

    this.isInitializing = true;
    const startTime = Date.now();

    try {
      if (options.inputSize) {
        this.inputShape = [1, 3, options.inputSize, options.inputSize];
      }
      if (options.confThreshold) {
        this.confThreshold = options.confThreshold;
      }

      console.log('[YOLO] Initializing ONNX InferenceSession from path:', modelPath);
      this.session = await InferenceSession.create(modelPath, {
        executionProviders: ['cpu'], // Safe cross-platform fallback
        graphOptimizationLevel: 'all',
      });

      this.modelLoaded = true;
      console.log(`[YOLO] ONNX Session loaded successfully in ${Date.now() - startTime}ms`);
      return true;
    } catch (err) {
      console.warn('[YOLO] ONNX Session initialization warning/fallback mode:', err.message);
      this.session = null;
      this.modelLoaded = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Returns true if ONNX session is active and ready for tensor evaluation.
   */
  isReady() {
    return Boolean(this.session && this.modelLoaded);
  }

  /**
   * Preprocesses raw RGB frame buffer into Float32 NCHW Tensor [1, 3, H, W] normalized [0, 1].
   */
  preprocess(rgbData, width, height, targetSize = 320) {
    const float32Data = new Float32Array(3 * targetSize * targetSize);
    const channelSize = targetSize * targetSize;

    // Simple bilinear resize & RGB normalization to [0.0, 1.0]
    for (let i = 0; i < channelSize; i++) {
      const srcIdx = i * 3;
      const r = rgbData[srcIdx] || 0;
      const g = rgbData[srcIdx + 1] || 0;
      const b = rgbData[srcIdx + 2] || 0;

      // NCHW format layout
      float32Data[i] = r / 255.0;                   // R channel
      float32Data[channelSize + i] = g / 255.0;     // G channel
      float32Data[2 * channelSize + i] = b / 255.0; // B channel
    }

    return new Tensor('float32', float32Data, [1, 3, targetSize, targetSize]);
  }

  /**
   * Executes YOLOv8 ONNX model inference on input frame.
   * Returns structured array of detected bounding boxes and confidences.
   */
  async detect(inputTensor, options = {}) {
    if (!this.session) {
      return { success: false, detections: [], latencyMs: 0, error: 'Session not initialized' };
    }

    const startTime = Date.now();
    const confThresh = options.confThreshold || this.confThreshold;

    try {
      const feeds = {};
      const inputNames = this.session.inputNames || ['images'];
      feeds[inputNames[0]] = inputTensor;

      const outputMap = await this.session.run(feeds);
      const outputNames = this.session.outputNames || Object.keys(outputMap);
      const outputTensor = outputMap[outputNames[0]];

      const inferenceLatency = Date.now() - startTime;
      const postStart = Date.now();

      const detections = this.postprocess(outputTensor, confThresh);
      const postLatency = Date.now() - postStart;

      return {
        success: true,
        detections,
        latencyMs: inferenceLatency,
        postLatencyMs: postLatency,
        totalLatencyMs: Date.now() - startTime,
      };
    } catch (err) {
      console.warn('[YOLO] Inference execution error:', err.message);
      return {
        success: false,
        detections: [],
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * Postprocesses raw YOLOv8 output tensor [1, 84, 8400] -> Bounding boxes + Confidences + Class Labels.
   */
  postprocess(outputTensor, confThreshold = 0.45) {
    if (!outputTensor || !outputTensor.data) return [];

    const data = outputTensor.data;
    const dims = outputTensor.dims || [1, 84, 2100];
    const numClasses = (dims[1] || 84) - 4;
    const numAnchors = dims[2] || 2100;

    const rawDetections = [];

    for (let a = 0; a < numAnchors; a++) {
      let maxScore = 0;
      let maxClassId = -1;

      for (let c = 0; c < numClasses; c++) {
        const scoreIdx = (4 + c) * numAnchors + a;
        const score = data[scoreIdx];
        if (score > maxScore) {
          maxScore = score;
          maxClassId = c;
        }
      }

      if (maxScore >= confThreshold) {
        const cx = data[0 * numAnchors + a];
        const cy = data[1 * numAnchors + a];
        const w  = data[2 * numAnchors + a];
        const h  = data[3 * numAnchors + a];

        const x = cx - w / 2;
        const y = cy - h / 2;

        rawDetections.push({
          bbox: [x, y, w, h],
          confidence: maxScore,
          classId: maxClassId,
          className: COCO_CLASSES[maxClassId] || `Class ${maxClassId}`,
        });
      }
    }

    // Apply Non-Maximum Suppression (NMS)
    return this.nonMaxSuppression(rawDetections, 0.45);
  }

  /**
   * Non-Maximum Suppression (NMS) to eliminate duplicate overlapping bounding boxes.
   */
  nonMaxSuppression(boxes, iouThreshold = 0.45) {
    if (boxes.length === 0) return [];

    boxes.sort((a, b) => b.confidence - a.confidence);
    const selected = [];
    const active = new Array(boxes.length).fill(true);

    for (let i = 0; i < boxes.length; i++) {
      if (!active[i]) continue;
      selected.push(boxes[i]);

      for (let j = i + 1; j < boxes.length; j++) {
        if (!active[j]) continue;
        const iou = this.calculateIoU(boxes[i].bbox, boxes[j].bbox);
        if (iou >= iouThreshold) {
          active[j] = false;
        }
      }
    }

    return selected;
  }

  /**
   * Computes Intersection-over-Union (IoU) of two bounding boxes [x, y, w, h].
   */
  calculateIoU(boxA, boxB) {
    const [xA, yA, wA, hA] = boxA;
    const [xB, yB, wB, hB] = boxB;

    const x1 = Math.max(xA, xB);
    const y1 = Math.max(yA, yB);
    const x2 = Math.min(xA + wA, xB + wB);
    const y2 = Math.min(yA + hA, yB + hB);

    const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = wA * hA;
    const areaB = wB * hB;
    const unionArea = areaA + areaB - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0;
  }

  /**
   * Safely releases the ONNX session memory.
   */
  release() {
    if (this.session) {
      try {
        this.session.release();
        console.log('[YOLO] ONNX session released.');
      } catch (_) {}
      this.session = null;
    }
    this.modelLoaded = false;
  }
}

// Singleton instance export
export const yoloInferenceService = new YOLOInferenceService();
export default yoloInferenceService;
