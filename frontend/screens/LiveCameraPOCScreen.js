import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Worklets } from 'react-native-worklets-core';

export default function LiveCameraPOCScreen({ navigation }) {
  const [cameraPosition, setCameraPosition] = useState('back');
  const [isActive, setIsActive] = useState(true);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [lastProcessTime, setLastProcessTime] = useState(Date.now());
  const [frameStatus, setFrameStatus] = useState('Initializing pipeline...');

  // Camera permissions hook from Vision Camera
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraPosition);

  // Performance tracking refs
  const frameCounterRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const lastThrottledTimeRef = useRef(0);

  // Request camera permission on mount if not yet granted
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // Worklet callback to bridge frame processor counts back to JS thread safely
  const onFrameProcessedJS = Worklets.createRunOnJS((timestamp) => {
    frameCounterRef.current += 1;
    setFrameCount(frameCounterRef.current);

    const now = Date.now();
    const delta = now - lastTimeRef.current;
    if (delta >= 1000) {
      setFps(Math.round((frameCounterRef.current * 1000) / delta));
      lastTimeRef.current = now;
      frameCounterRef.current = 0;
    }
    setLastProcessTime(now);
    setFrameStatus(`Frame Processor Active (Sampled @ 3 FPS, TS: ${timestamp})`);
  });

  // Throttled Frame Processor (Targeting ~3 FPS frame sampling)
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const now = Date.now();
    // Throttle to 1 frame every 300ms (~3.3 FPS)
    if (now - lastThrottledTimeRef.current >= 300) {
      lastThrottledTimeRef.current = now;
      onFrameProcessedJS(now);
    }
  }, []);

  // Handle camera permissions states
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Icon name="camera-alt" size={64} color="#38BDF8" />
        <Text style={styles.titleText}>Camera Permission Required</Text>
        <Text style={styles.subText}>
          Allow HiFix to use the camera for live AI problem diagnosis.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (device == null) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.titleText}>Initializing Camera Device...</Text>
        <Text style={styles.subText}>Selecting {cameraPosition} camera sensor.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live Vision Camera Viewfinder */}
      {isActive && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />
      )}

      {/* Control & Diagnostics Overlay Panel */}
      <SafeAreaView style={styles.overlayContainer}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Live Camera POC</Text>
            <Text style={styles.headerSub}>Phase 5.1B Frame Processor Test</Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'))}
          >
            <Icon name="flip-camera-android" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Diagnostics Info Box */}
        <View style={styles.diagnosticsBox}>
          <View style={styles.diagRow}>
            <View style={styles.statusDot} />
            <Text style={styles.diagLabel}>Camera State:</Text>
            <Text style={styles.diagValue}>{isActive ? 'ACTIVE (30 FPS Stream)' : 'PAUSED'}</Text>
          </View>

          <View style={styles.diagRow}>
            <Icon name="speed" size={16} color="#38BDF8" />
            <Text style={styles.diagLabel}>Processor Rate:</Text>
            <Text style={styles.diagValue}>~3 FPS (Throttled)</Text>
          </View>

          <View style={styles.diagRow}>
            <Icon name="auto-graph" size={16} color="#10B981" />
            <Text style={styles.diagLabel}>Processed Frames:</Text>
            <Text style={styles.diagValue}>{frameCount} frames</Text>
          </View>

          <View style={styles.diagRow}>
            <Icon name="memory" size={16} color="#F59E0B" />
            <Text style={styles.diagLabel}>Pipeline Status:</Text>
            <Text style={[styles.diagValue, { flex: 1 }]} numberOfLines={1}>
              {frameStatus}
            </Text>
          </View>
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isActive ? '#EF4444' : '#10B981' }]}
            onPress={() => setIsActive((prev) => !prev)}
          >
            <Icon name={isActive ? 'pause' : 'play-arrow'} size={24} color="#FFF" />
            <Text style={styles.actionBtnText}>{isActive ? 'Pause Camera' : 'Start Camera'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  titleText: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 16, marginBottom: 8 },
  subText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 24 },
  primaryBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },

  overlayContainer: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: { alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  diagnosticsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 10,
    alignSelf: 'center',
    width: '100%',
  },
  diagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
  diagLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, width: 120 },
  diagValue: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  bottomBar: { paddingVertical: 20, alignItems: 'center' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    width: '80%',
  },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
