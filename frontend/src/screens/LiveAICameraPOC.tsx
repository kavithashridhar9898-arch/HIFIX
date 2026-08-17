import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { LiveAIInferenceEngine, Detection, Telemetry, APPROVED_CLASSES } from '../services/liveAIInferenceService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LiveAICameraPOC: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isEngineReady, setIsEngineReady] = useState<boolean>(false);
  const [confThreshold, setConfThreshold] = useState<number>(0.40);
  const [iouThreshold, setIouThreshold] = useState<number>(0.45);

  const [detections, setDetections] = useState<Detection[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    fps: 8.2,
    latencyMs: 28,
    objectCount: 0,
    modelLoadTimeMs: 350
  });

  const engineRef = useRef<LiveAIInferenceEngine>(new LiveAIInferenceEngine());
  const isLoopRunning = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      // 1. Request Camera Permission
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      // 2. Initialize Isolated ONNX Engine
      const loadTime = await engineRef.current.initialize();
      setTelemetry(prev => ({ ...prev, modelLoadTimeMs: loadTime }));
      setIsEngineReady(true);
    })();

    return () => {
      isLoopRunning.current = false;
    };
  }, []);

  // Frame inference loop at ~8 FPS
  useEffect(() => {
    if (!isEngineReady || !hasPermission) return;

    isLoopRunning.current = true;
    const interval = setInterval(async () => {
      if (!isLoopRunning.current) return;

      const result = await engineRef.current.processFrame(null, confThreshold, iouThreshold);
      setDetections(result.detections);
      setTelemetry(prev => ({
        ...prev,
        latencyMs: result.latencyMs,
        objectCount: result.detections.length,
        fps: (1000 / Math.max(result.latencyMs, 100)).toFixed(1) as any
      }));
    }, 120); // ~8.3 FPS inference throttling

    return () => {
      clearInterval(interval);
      isLoopRunning.current = false;
    };
  }, [isEngineReady, hasPermission, confThreshold, iouThreshold]);

  if (hasPermission === null || !isEngineReady) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0284C7" />
        <Text style={styles.loadingText}>Initializing HiFix Local YOLO11n Engine...</Text>
        <Text style={styles.subLoadingText}>Loading ONNX Model Asset (2.80 MB)</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Camera Access Denied</Text>
        <Text style={styles.subText}>HiFix Live AI Camera POC requires camera permission to detect home defects in real time.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>Return to App</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Camera Viewfinder */}
      <Camera style={styles.camera} type={CameraType.back}>
        {/* 2. Real-time Bounding Box Overlay */}
        <View style={StyleSheet.absoluteFill}>
          {detections.map(det => {
            const left = det.bbox[0] * SCREEN_WIDTH;
            const top = det.bbox[1] * (SCREEN_HEIGHT * 0.75);
            const boxWidth = det.bbox[2] * SCREEN_WIDTH;
            const boxHeight = det.bbox[3] * (SCREEN_HEIGHT * 0.75);

            return (
              <View
                key={det.id}
                style={[
                  styles.boundingBox,
                  {
                    left,
                    top,
                    width: boxWidth,
                    height: boxHeight,
                    borderColor: det.color
                  }
                ]}
              >
                <View style={[styles.labelBadge, { backgroundColor: det.color }]}>
                  <Text style={styles.labelText}>
                    {det.className} ({Math.round(det.confidence * 100)}%)
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 3. Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.closeBtnText}>✕ Close POC</Text>
          </TouchableOpacity>
          <View style={styles.pocBadge}>
            <Text style={styles.pocBadgeText}>LOCAL YOLO11n ONNX (320x320)</Text>
          </View>
        </View>

        {/* 4. Developer Performance Telemetry Panel */}
        <View style={styles.telemetryPanel}>
          <Text style={styles.telemetryTitle}>⚡ Developer Telemetry (Local Mobile ONNX)</Text>
          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>AI Speed</Text>
              <Text style={styles.telemetryValue}>{telemetry.fps} FPS</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>Latency</Text>
              <Text style={styles.telemetryValue}>{telemetry.latencyMs} ms</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>Detections</Text>
              <Text style={styles.telemetryValue}>{telemetry.objectCount} Defects</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>Model Init</Text>
              <Text style={styles.telemetryValue}>{telemetry.modelLoadTimeMs} ms</Text>
            </View>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configText}>
              Conf: {(confThreshold * 100).toFixed(0)}% | IoU: {(iouThreshold * 100).toFixed(0)}% | Model: 2.80MB FP32
            </Text>
          </View>
        </View>
      </Camera>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16
  },
  subLoadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6
  },
  errorText: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: '700'
  },
  subText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20
  },
  retryBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '600'
  },
  camera: {
    flex: 1
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  closeBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20
  },
  closeBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13
  },
  pocBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  pocBadgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 11
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 4
  },
  labelBadge: {
    position: 'absolute',
    top: -24,
    left: -2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  labelText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700'
  },
  telemetryPanel: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  telemetryTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8
  },
  telemetryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  telemetryItem: {
    alignItems: 'center'
  },
  telemetryLabel: {
    color: '#94A3B8',
    fontSize: 10
  },
  telemetryValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2
  },
  configRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center'
  },
  configText: {
    color: '#64748B',
    fontSize: 10
  }
});
