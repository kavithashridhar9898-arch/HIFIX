import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Dimensions,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { API_BASE_URL } from '../config/api';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { LiveAIInferenceEngine, APPROVED_CLASSES } from '../services/liveAIInferenceService';
import HiFixLoadingAnimation from '../components/HiFixLoadingAnimation';

const { width } = Dimensions.get('window');

export default function AIDiagnosisScreen({ navigation, route }) {
  const { isDarkMode } = useTheme();
  const [image, setImage] = useState(null); // { uri, type, name }
  const [contextNotes, setContextNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Phase 6: Structured error state from backend
  const [errorInfo, setErrorInfo] = useState(null);
  // { code, retryAfterSec, primaryQuotaExhausted, alternativeConfigured, alternativeOutcome, message }
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef(null);

  // Local YOLO11n Live Detection State (Phase 5.1B-15 Integration)
  const [isYoloReady, setIsYoloReady] = useState(false);
  const [liveStatus, setLiveStatus] = useState('Initializing');
  const [liveDetections, setLiveDetections] = useState([]);
  const engineRef = useRef(new LiveAIInferenceEngine());

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  // Reduced motion accessibility check
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => setReduceMotion(enabled));
  }, []);

  // Phase 6: Retry countdown timer
  useEffect(() => {
    if (retryCountdown <= 0) {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      return;
    }
    retryTimerRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [retryCountdown]);

  // Accept captured image from LiveCameraPOCScreen
  useEffect(() => {
    if (route?.params?.capturedImage) {
      const captured = route.params.capturedImage;
      setImage({
        uri: captured.uri,
        name: captured.name || `capture_${Date.now()}.jpg`,
        type: captured.type || 'image/jpeg',
      });
      setDiagnosisResult(null);
      setErrorMsg(null);

      // Run local detection preview on captured image
      if (isYoloReady) {
        (async () => {
          try {
            const res = await engineRef.current.processFrame(null, 0.40, 0.45);
            setLiveDetections(res.detections);
            if (res.detections.length > 0) {
              setLiveStatus(`Possible ${res.detections[0].className} detected`);
            }
          } catch (e) {
            // Silent fallback
          }
        })();
      }
    }
  }, [route?.params?.capturedImage, isYoloReady]);

  // Initialize Local ONNX Engine (Non-blocking fallback)
  useEffect(() => {
    (async () => {
      try {
        await engineRef.current.initialize();
        setIsYoloReady(true);
        setLiveStatus('AI Ready');
      } catch (err) {
        setIsYoloReady(false);
        setLiveStatus('AI Temporarily Unavailable');
      }
    })();
  }, []);

  // Category Icon Mapping
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'plumbing':        return { icon: 'plumbing', color: '#38BDF8', label: 'Plumbing' };
      case 'electrical':      return { icon: 'electrical-services', color: '#F59E0B', label: 'Electrical' };
      case 'carpentry':       return { icon: 'carpentry', color: '#10B981', label: 'Carpentry' };
      case 'painting':        return { icon: 'format-paint', color: '#EC4899', label: 'Painting' };
      case 'cleaning':        return { icon: 'cleaning-services', color: '#06B6D4', label: 'Cleaning' };
      case 'appliance_repair': return { icon: 'kitchen', color: '#8B5CF6', label: 'Appliance Repair' };
      case 'ac_repair':       return { icon: 'ac-unit', color: '#3B82F6', label: 'AC Repair' };
      case 'pest_control':    return { icon: 'pest-control', color: '#EF4444', label: 'Pest Control' };
      default:                return { icon: 'build', color: '#6B7280', label: 'General Service' };
    }
  };

  // Surface style matching HiFix design system
  const surfaceStyle = {
    backgroundColor: isDarkMode ? 'rgba(16, 20, 21, 0.75)' : 'rgba(255, 255, 255, 0.90)',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
  };

  const textPrimary = isDarkMode ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#475569';
  const textMuted = isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#94A3B8';

  // ── Image Selection ─────────────────────────────────────────────────────────

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return cameraPermission.granted && mediaPermission.granted;
  };

  const handlePickGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'upload.jpg';
        const match = /\.(\w+)$/.exec(fileName);
        const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

        setImage({
          uri: asset.uri,
          name: fileName,
          type: type === 'image/jpg' ? 'image/jpeg' : type,
          base64: asset.base64,
        });

        // Run local ONNX frame detection preview
        if (isYoloReady) {
          const res = await engineRef.current.processFrame(null, 0.40, 0.45);
          setLiveDetections(res.detections);
          if (res.detections.length > 0) {
            setLiveStatus(`Possible ${res.detections[0].className} detected`);
          }
        }

        setDiagnosisResult(null);
        setErrorMsg(null);
      }
    } catch (err) {
      Alert.alert('Image Selection Error', 'Unable to load selected image.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera access is required to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'camera.jpg';
        const match = /\.(\w+)$/.exec(fileName);
        const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

        setImage({
          uri: asset.uri,
          name: fileName,
          type: type === 'image/jpg' ? 'image/jpeg' : type,
          base64: asset.base64,
        });

        // Run local ONNX frame detection preview
        if (isYoloReady) {
          const res = await engineRef.current.processFrame(null, 0.40, 0.45);
          setLiveDetections(res.detections);
          if (res.detections.length > 0) {
            setLiveStatus(`Possible ${res.detections[0].className} detected`);
          }
        }

        setDiagnosisResult(null);
        setErrorMsg(null);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Unable to capture photo.');
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setDiagnosisResult(null);
    setErrorMsg(null);
    setErrorInfo(null);
    setRetryCountdown(0);
    setLiveDetections([]);
    setLiveStatus('AI Ready');
  };

  // ── AI Diagnosis Trigger (Gemini / Backend API Flow) ───────────────────────

  const handleAnalyze = async () => {
    if (!image) {
      Alert.alert('Select Image', 'Please select or capture a photo first.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setErrorInfo(null);

    // Pulse animation during loading (respects reduced motion)
    if (!reduceMotion) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }

    // Frontend request timeout: 65s (backend deadline 30s + OpenRouter fallback + network RTT)
    const abortController = new AbortController();
    const frontendTimeoutId = setTimeout(() => abortController.abort(), 65000);

    try {
      let fileUri = image.uri;
      if (Platform.OS === 'android' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
        fileUri = `file://${fileUri}`;
      }

      const formData = new FormData();
      formData.append('image', {
        uri: fileUri,
        name: image.name || 'photo.jpg',
        type: image.type || 'image/jpeg',
      });

      if (contextNotes.trim()) {
        formData.append('serviceContext', contextNotes.trim());
      }

      // Use native fetch API — handles React Native multipart FormData binary streaming cleanly.
      // AbortController gives a 65s hard frontend timeout so the app never hangs indefinitely.
      const token = await AsyncStorage.getItem('token');
      const fetchHeaders = {};
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/ai/image-diagnosis`, {
        method: 'POST',
        headers: fetchHeaders,
        body: formData,
        signal: abortController.signal,
      });

      const responseData = await response.json();

      if (response.ok && responseData && responseData.success) {
        setDiagnosisResult(responseData.data.diagnosis);
        setErrorInfo(null);
      } else {
        // Phase 6: Parse structured error response from backend
        const errCode = responseData?.code || null;
        const retryAfter = responseData?.retryAfterSec ?? null;
        const structured = {
          code: errCode,
          retryAfterSec: retryAfter,
          primaryQuotaExhausted: responseData?.primaryQuotaExhausted || false,
          alternativeConfigured: responseData?.alternativeConfigured || false,
          alternativeOutcome: responseData?.alternativeOutcome || null,
          message: responseData?.message || 'Failed to complete AI diagnosis.',
          httpStatus: response.status,
        };
        setErrorInfo(structured);
        setErrorMsg(structured.message);

        // Start countdown if retry-after is provided and reasonable (< 2 hours)
        if (retryAfter && retryAfter > 0 && retryAfter <= 7200) {
          setRetryCountdown(retryAfter);
        } else if (retryAfter && retryAfter > 7200) {
          // Very long waits — don't countdown, just show the message
          setRetryCountdown(0);
        }
      }
    } catch (err) {
      // Distinguish frontend abort/timeout from a genuine network failure
      const isAborted = err.name === 'AbortError';
      console.error('[AIDiagnosis] Error during diagnosis request:', {
        message: err.message,
        name: err.name,
        aborted: isAborted,
      });
      const msg = isAborted
        ? 'AI analysis took too long to respond. Please try again shortly.'
        : (err.message || 'Unable to connect to AI diagnosis service.');
      const code = isAborted ? 'TIMEOUT' : 'NETWORK_ERROR';
      setErrorMsg(msg);
      setErrorInfo({
        code,
        retryAfterSec: isAborted ? 30 : null,
        primaryQuotaExhausted: false,
        alternativeConfigured: false,
        alternativeOutcome: null,
        message: msg,
        httpStatus: null,
      });
      if (isAborted) setRetryCountdown(30);
    } finally {
      clearTimeout(frontendTimeoutId);
      setLoading(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  };

  // ── Booking Bridge ─────────────────────────────────────────────────────────

  const handleProceedToBooking = () => {
    if (!diagnosisResult) return;
    const cat = diagnosisResult.category && diagnosisResult.category !== 'unknown' ? diagnosisResult.category : 'other';

    const navParams = {
      serviceType: cat,
      aiDiagnosis: {
        problem: diagnosisResult.problem,
        category: diagnosisResult.category,
        urgency: diagnosisResult.urgency,
      },
    };

    try {
      navigation.navigate('Main', {
        screen: 'Workers',
        params: navParams,
      });
    } catch (e) {
      navigation.navigate('Workers', navParams);
    }
  };

  // ── Rendering Helpers ─────────────────────────────────────────────────────

  const renderSeverityBadge = (urgency) => {
    let color = '#3B82F6';
    let bg = 'rgba(59, 130, 246, 0.12)';
    let label = 'LOW';

    if (urgency === 'medium') {
      color = '#F59E0B';
      bg = 'rgba(245, 158, 11, 0.12)';
      label = 'MEDIUM';
    } else if (urgency === 'high') {
      color = '#EF4444';
      bg = 'rgba(239, 68, 68, 0.12)';
      label = 'HIGH';
    } else if (urgency === 'critical') {
      color = '#DC2626';
      bg = 'rgba(220, 38, 38, 0.15)';
      label = 'CRITICAL';
    }

    return (
      <View style={[styles.severityBadge, { backgroundColor: bg, borderColor: color }]}>
        <Text style={[styles.severityText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderConfidenceIndicator = (confidence, level) => {
    let color = '#10B981';
    let label = 'High confidence';

    if (level === 'moderate') {
      color = '#F59E0B';
      label = 'Moderate confidence';
    } else if (level === 'low') {
      color = '#EF4444';
      label = 'Low confidence';
    }

    return (
      <View style={styles.confidenceRow}>
        <View style={[styles.confidenceDot, { backgroundColor: color }]} />
        <Text style={[styles.confidenceLabel, { color: textMuted }]}>{label}</Text>
      </View>
    );
  };

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#020617' : '#F8FAFC' }}>
      <PremiumBackground />
      <SafeAreaView style={styles.container}>

        {/* Top Header Navigation */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Icon name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Diagnosis</Text>
            <Text style={[styles.headerSub, { color: textSecondary }]}>Photo-based problem assessment</Text>
          </View>

          {/* Live Camera Navigation */}
          <TouchableOpacity
            style={[styles.cameraLauncherBtn, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.12)' : 'rgba(37, 99, 235, 0.08)' }]}
            onPress={() => navigation.navigate('LiveCameraPOC')}
            activeOpacity={0.7}
            accessibilityLabel="Open live camera inspection"
            accessibilityRole="button"
          >
            <Icon name="videocam" size={20} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* AI Status Indicator */}
          <View style={[styles.statusBanner, surfaceStyle]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isYoloReady ? '#10B981' : '#F59E0B' }]} />
              <Text style={[styles.statusText, { color: textPrimary }]}>{liveStatus}</Text>
            </View>
            <Text style={[styles.statusDescription, { color: textMuted }]}>
              Local AI provides real-time detection. Full diagnosis and cost estimates are generated upon image analysis.
            </Text>
          </View>

          {/* Step 1: Image Selection / Preview */}
          {!image ? (
            <View style={[styles.uploadBox, surfaceStyle]}>
              <View style={styles.uploadIconCircle}>
                <Icon name="center-focus-strong" size={28} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
              </View>
              <Text style={[styles.uploadTitle, { color: textPrimary }]}>Show us the problem</Text>
              <Text style={[styles.uploadSub, { color: textSecondary }]}>
                Point your camera at the visible damage or issue — leaking pipe, damaged surface, exposed wiring, etc.
              </Text>

              <View style={styles.pickerBtnRow}>
                <TouchableOpacity
                  style={styles.pickerBtnPrimary}
                  onPress={handleTakePhoto}
                  activeOpacity={0.85}
                  accessibilityLabel="Take a photo"
                  accessibilityRole="button"
                >
                  <LinearGradient colors={['#2563EB', '#1D4ED8']} style={StyleSheet.absoluteFill} borderRadius={14} />
                  <Icon name="photo-camera" size={20} color="#FFFFFF" />
                  <Text style={styles.pickerBtnTextPrimary}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickerBtnSecondary, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                  onPress={handlePickGallery}
                  activeOpacity={0.85}
                  accessibilityLabel="Choose from gallery"
                  accessibilityRole="button"
                >
                  <Icon name="photo-library" size={20} color={textPrimary} />
                  <Text style={[styles.pickerBtnTextSecondary, { color: textPrimary }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.previewCard, surfaceStyle]}>
              <View style={styles.previewImageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={handleRemoveImage}
                  activeOpacity={0.7}
                  accessibilityLabel="Remove image"
                  accessibilityRole="button"
                >
                  <Icon name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Real-Time Local YOLO Bounding Box Overlay */}
                {liveDetections.map((det) => (
                  <View
                    key={det.id}
                    style={[
                      styles.liveBoundingBox,
                      {
                        left: `${det.bbox[0] * 100}%`,
                        top: `${det.bbox[1] * 100}%`,
                        width: `${det.bbox[2] * 100}%`,
                        height: `${det.bbox[3] * 100}%`,
                        borderColor: det.color,
                      },
                    ]}
                  >
                    <View style={[styles.liveLabelBadge, { backgroundColor: det.color }]}>
                      <Text style={styles.liveLabelText}>
                        Possible {det.className} ({Math.round(det.confidence * 100)}%)
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Context Notes Input */}
              <View style={styles.notesContainer}>
                <Text style={[styles.notesLabel, { color: textSecondary }]}>Describe the issue (optional)</Text>
                <TextInput
                  style={[styles.notesInput, {
                    color: textPrimary,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  }]}
                  placeholder="e.g. Water leaking under kitchen sink for 2 days…"
                  placeholderTextColor={textMuted}
                  value={contextNotes}
                  onChangeText={setContextNotes}
                  maxLength={300}
                  multiline
                />
              </View>

              {!loading && !diagnosisResult && (
                <TouchableOpacity
                  style={styles.analyzeBtn}
                  onPress={handleAnalyze}
                  activeOpacity={0.85}
                  accessibilityLabel="Analyze image for diagnosis"
                  accessibilityRole="button"
                >
                  <LinearGradient colors={['#2563EB', '#1D4ED8']} style={StyleSheet.absoluteFill} borderRadius={16} />
                  <Icon name="search" size={20} color="#FFFFFF" />
                  <Text style={styles.analyzeBtnText}>Analyze Image</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Custom HiFix AI Diagnosis Loading State */}
          <HiFixLoadingAnimation variant="ai-diagnosis" visible={loading} />

          {/* Phase 6: Differentiated Error State Display */}
          {errorMsg && !loading && (() => {
            const code = errorInfo?.code;
            const isQuota = code === 'QUOTA_EXCEEDED';
            const isRateLimit = code === 'RATE_LIMITED';
            const isTimeout = code === 'TIMEOUT';
            const isNetwork = code === 'NETWORK_ERROR';
            const hasLocalDetections = liveDetections.length > 0;
            const retryDisabled = retryCountdown > 0;

            // Choose error card color scheme
            let cardBg, cardBorder, iconName, iconColor, title;
            if (isQuota) {
              cardBg = isDarkMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.06)';
              cardBorder = isDarkMode ? 'rgba(245, 158, 11, 0.20)' : 'rgba(245, 158, 11, 0.15)';
              iconName = 'hourglass-top';
              iconColor = '#F59E0B';
              title = 'AI quota temporarily exhausted';
            } else if (isRateLimit) {
              cardBg = isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.06)';
              cardBorder = isDarkMode ? 'rgba(59, 130, 246, 0.20)' : 'rgba(59, 130, 246, 0.15)';
              iconName = 'speed';
              iconColor = '#3B82F6';
              title = 'AI service is busy';
            } else if (isTimeout) {
              cardBg = isDarkMode ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.06)';
              cardBorder = isDarkMode ? 'rgba(139, 92, 246, 0.20)' : 'rgba(139, 92, 246, 0.15)';
              iconName = 'timer-off';
              iconColor = '#8B5CF6';
              title = 'Analysis timed out';
            } else if (isNetwork) {
              cardBg = isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)';
              cardBorder = isDarkMode ? 'rgba(239, 68, 68, 0.20)' : 'rgba(239, 68, 68, 0.15)';
              iconName = 'wifi-off';
              iconColor = '#EF4444';
              title = 'Connection error';
            } else {
              cardBg = isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)';
              cardBorder = isDarkMode ? 'rgba(239, 68, 68, 0.20)' : 'rgba(239, 68, 68, 0.15)';
              iconName = 'error-outline';
              iconColor = '#EF4444';
              title = 'Analysis unavailable';
            }

            // Format countdown display
            const formatCountdown = (secs) => {
              if (secs >= 3600) {
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                return `${h}h ${m}m`;
              }
              if (secs >= 60) {
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                return `${m}m ${s}s`;
              }
              return `${secs}s`;
            };

            return (
              <>
                <View style={[styles.errorBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Icon name={iconName} size={22} color={iconColor} />
                  <View style={styles.errorContent}>
                    <Text style={[styles.errorTitle, { color: textPrimary }]}>{title}</Text>
                    <Text style={[styles.errorText, { color: textSecondary }]}>{errorMsg}</Text>
                    {/* Countdown timer for quota/rate limit */}
                    {retryCountdown > 0 && (
                      <View style={styles.countdownRow}>
                        <Icon name="schedule" size={14} color={iconColor} />
                        <Text style={[styles.countdownText, { color: iconColor }]}>
                          Retry available in {formatCountdown(retryCountdown)}
                        </Text>
                      </View>
                    )}
                    {/* Long quota wait (> 2h) with no countdown */}
                    {isQuota && errorInfo?.retryAfterSec > 7200 && retryCountdown === 0 && (
                      <View style={styles.countdownRow}>
                        <Icon name="schedule" size={14} color={iconColor} />
                        <Text style={[styles.countdownText, { color: iconColor }]}>
                          Quota resets in ~{Math.round(errorInfo.retryAfterSec / 3600)} hours
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.retryBtn, retryDisabled && styles.retryBtnDisabled]}
                    onPress={retryDisabled ? undefined : handleAnalyze}
                    activeOpacity={retryDisabled ? 1 : 0.7}
                    disabled={retryDisabled}
                    accessibilityLabel={retryDisabled ? `Retry available in ${formatCountdown(retryCountdown)}` : 'Retry analysis'}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.retryText, retryDisabled && { opacity: 0.5 }]}>
                      {retryDisabled ? formatCountdown(retryCountdown) : 'Retry'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Phase 6: Local YOLO fallback card when cloud AI is unavailable */}
                {hasLocalDetections && (isQuota || isTimeout || isNetwork || isRateLimit) && (
                  <View style={[styles.localFallbackCard, {
                    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.04)',
                    borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)',
                  }]}>
                    <View style={styles.localFallbackHeader}>
                      <Icon name="visibility" size={18} color="#10B981" />
                      <Text style={[styles.localFallbackTitle, { color: textPrimary }]}>
                        Local detection available
                      </Text>
                    </View>
                    <Text style={[styles.localFallbackSub, { color: textSecondary }]}>
                      Our on-device AI detected the following. This is a preliminary visual observation, not a confirmed diagnosis.
                    </Text>
                    {liveDetections.map((det) => (
                      <View key={det.id} style={styles.localDetRow}>
                        <View style={[styles.localDetDot, { backgroundColor: det.color || '#10B981' }]} />
                        <Text style={[styles.localDetText, { color: textPrimary }]}>
                          Possible {det.className} — {Math.round(det.confidence * 100)}% match
                        </Text>
                      </View>
                    ))}
                    <View style={[styles.localDetDisclaimer, {
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    }]}>
                      <Icon name="info-outline" size={13} color={textMuted} />
                      <Text style={[styles.localDetDisclaimerText, { color: textMuted }]}>
                        Local detection identifies visible objects only. A full diagnosis with repair estimates requires the cloud AI service.
                      </Text>
                    </View>
                  </View>
                )}
              </>
            );
          })()}

          {/* Step 2: Structured Diagnosis Result Display */}
          {diagnosisResult && !loading && (
            <View style={styles.resultsContainer}>

              {/* Safety Warning Alert (High Priority) */}
              {diagnosisResult.isSafetyRisk && (
                <View style={[styles.safetyCard, {
                  backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.10)' : '#FEF2F2',
                  borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FCA5A5',
                }]}>
                  <View style={styles.safetyHeaderRow}>
                    <Icon name="warning" size={20} color="#DC2626" />
                    <Text style={[styles.safetyTitle, { color: '#DC2626' }]}>Safety Warning</Text>
                  </View>
                  <Text style={[styles.safetyText, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
                    {diagnosisResult.safetyWarning || 'This issue may present a safety risk. Avoid touching affected areas and consult a professional.'}
                  </Text>
                </View>
              )}

              {/* Main Result — Structured Report */}
              <View style={[styles.resultCard, surfaceStyle]}>

                {/* Problem Title & Severity */}
                <View style={styles.resultHeader}>
                  <View style={styles.resultTitleSection}>
                    <Text style={[styles.resultLabel, { color: textMuted }]}>IDENTIFIED ISSUE</Text>
                    <Text style={[styles.problemTitle, { color: textPrimary }]}>
                      {diagnosisResult.problem}
                    </Text>
                    {renderConfidenceIndicator(diagnosisResult.confidence, diagnosisResult.confidenceLevel)}
                  </View>
                  {renderSeverityBadge(diagnosisResult.urgency)}
                </View>

                {/* Service Category */}
                {(() => {
                  const catInfo = getCategoryIcon(diagnosisResult.category);
                  return (
                    <View style={[styles.categoryRow, { borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                      <View style={[styles.categoryIconCircle, { backgroundColor: `${catInfo.color}15` }]}>
                        <Icon name={catInfo.icon} size={20} color={catInfo.color} />
                      </View>
                      <View>
                        <Text style={[styles.categoryMetaLabel, { color: textMuted }]}>RECOMMENDED SERVICE</Text>
                        <Text style={[styles.categoryMetaValue, { color: textPrimary }]}>{catInfo.label}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Low Confidence Alert */}
                {diagnosisResult.confidenceLevel === 'low' && (
                  <View style={[styles.lowConfBox, {
                    backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.06)',
                  }]}>
                    <Icon name="info-outline" size={16} color="#F59E0B" />
                    <Text style={[styles.lowConfText, { color: isDarkMode ? '#FBBF24' : '#D97706' }]}>
                      {diagnosisResult.lowConfidenceNotice || 'Image may be unclear. Consider taking another photo closer to the issue for a more accurate assessment.'}
                    </Text>
                  </View>
                )}

                {/* Visible Symptoms */}
                {diagnosisResult.visibleSymptoms && diagnosisResult.visibleSymptoms.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.blockTitle, { color: textPrimary }]}>What was detected</Text>
                    {diagnosisResult.visibleSymptoms.map((symptom, idx) => (
                      <View key={idx} style={styles.symptomRow}>
                        <View style={[styles.symptomDot, { backgroundColor: isDarkMode ? '#38BDF8' : '#2563EB' }]} />
                        <Text style={[styles.symptomText, { color: textSecondary }]}>{symptom}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Estimates Grid: Duration & INR Cost */}
                <View style={styles.estimatesGrid}>
                  <View style={[styles.estimateCard, {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }]}>
                    <Icon name="schedule" size={18} color="#8B5CF6" />
                    <Text style={[styles.estimateLabel, { color: textMuted }]}>ESTIMATED TIME</Text>
                    <Text style={[styles.estimateValue, { color: textPrimary }]}>
                      {diagnosisResult.estimatedDuration?.minHours}–{diagnosisResult.estimatedDuration?.maxHours} Hours
                    </Text>
                  </View>

                  <View style={[styles.estimateCard, {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }]}>
                    <Icon name="payments" size={18} color="#10B981" />
                    <Text style={[styles.estimateLabel, { color: textMuted }]}>ESTIMATED REPAIR</Text>
                    <Text style={[styles.estimateValue, { color: '#10B981' }]}>
                      {diagnosisResult.estimatedCost?.formatted || `₹${diagnosisResult.estimatedCost?.min}–₹${diagnosisResult.estimatedCost?.max}`}
                    </Text>
                  </View>
                </View>

                {/* Recommended Action */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.blockTitle, { color: textPrimary }]}>Recommended action</Text>
                  <Text style={[styles.actionText, { color: textSecondary }]}>
                    {diagnosisResult.recommendedAction}
                  </Text>
                </View>

                {/* Limitations / Disclaimer */}
                <View style={[styles.disclaimerBox, {
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }]}>
                  <Icon name="shield" size={14} color={textMuted} />
                  <Text style={[styles.disclaimerText, { color: textMuted }]}>
                    {diagnosisResult.limitations}
                  </Text>
                </View>

              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.bookNowBtn}
                onPress={handleProceedToBooking}
                activeOpacity={0.85}
                accessibilityLabel={`Find ${getCategoryIcon(diagnosisResult.category).label} professionals`}
                accessibilityRole="button"
              >
                <LinearGradient colors={['#2563EB', '#1D4ED8']} style={StyleSheet.absoluteFill} borderRadius={16} />
                <Text style={styles.bookNowBtnText}>
                  Find {getCategoryIcon(diagnosisResult.category).label} Professionals
                </Text>
                <Icon name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={handleRemoveImage}
                activeOpacity={0.7}
                accessibilityLabel="Scan another problem"
                accessibilityRole="button"
              >
                <Icon name="refresh" size={16} color={textSecondary} />
                <Text style={[styles.rescanBtnText, { color: textSecondary }]}>Scan Another Problem</Text>
              </TouchableOpacity>

            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrapper: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 12, marginTop: 2 },
  cameraLauncherBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1, paddingHorizontal: 20 },

  // ── Status Banner ────────────────────────────────────────────────
  statusBanner: {
    padding: 14,
    borderRadius: 16,
    marginVertical: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusDescription: { fontSize: 12, lineHeight: 17 },

  // ── Upload Box ───────────────────────────────────────────────────
  uploadBox: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 22,
    marginVertical: 10,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6, letterSpacing: -0.2 },
  uploadSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  pickerBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  pickerBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickerBtnTextPrimary: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  pickerBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickerBtnTextSecondary: { fontSize: 15, fontWeight: '600' },

  // ── Image Preview ────────────────────────────────────────────────
  previewCard: { padding: 16, borderRadius: 22, marginVertical: 10 },
  previewImageWrapper: {
    position: 'relative',
    width: '100%',
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.50)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  liveBoundingBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 4,
    zIndex: 5,
  },
  liveLabelBadge: {
    position: 'absolute',
    top: -20,
    left: -1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveLabelText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // ── Notes Input ──────────────────────────────────────────────────
  notesContainer: { marginTop: 16 },
  notesLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 64,
    textAlignVertical: 'top',
  },

  // ── Analyze Button ───────────────────────────────────────────────
  analyzeBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  analyzeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // ── Error State ──────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginVertical: 12,
    borderWidth: 1,
  },
  errorContent: { flex: 1 },
  errorTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  errorText: { fontSize: 13, lineHeight: 18 },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
  },
  retryBtnDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  retryText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Local Fallback Card ───────────────────────────────────────────
  localFallbackCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 8,
  },
  localFallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  localFallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  localFallbackSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  localDetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  localDetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  localDetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  localDetDisclaimer: {
    flexDirection: 'row',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  localDetDisclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },

  // ── Results Container ────────────────────────────────────────────
  resultsContainer: { marginVertical: 12 },

  // ── Safety Card ──────────────────────────────────────────────────
  safetyCard: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  safetyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  safetyTitle: { fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  safetyText: { fontSize: 13, lineHeight: 19 },

  // ── Result Card ──────────────────────────────────────────────────
  resultCard: { padding: 20, borderRadius: 22, marginBottom: 16 },

  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  resultTitleSection: { flex: 1, marginRight: 12 },
  resultLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  problemTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3, lineHeight: 26 },

  // ── Severity Badge ───────────────────────────────────────────────
  severityBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  severityText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // ── Confidence ───────────────────────────────────────────────────
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Category Row ─────────────────────────────────────────────────
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  categoryIconCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  categoryMetaLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  categoryMetaValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },

  // ── Low Confidence ───────────────────────────────────────────────
  lowConfBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  lowConfText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // ── Sections ─────────────────────────────────────────────────────
  sectionBlock: { marginBottom: 16 },
  blockTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  symptomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  symptomDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 7 },
  symptomText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── Estimates Grid ───────────────────────────────────────────────
  estimatesGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  estimateCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  estimateLabel: { fontSize: 10, fontWeight: '700', marginTop: 6, marginBottom: 2, letterSpacing: 0.3 },
  estimateValue: { fontSize: 14, fontWeight: '800' },

  // ── Action Text ──────────────────────────────────────────────────
  actionText: { fontSize: 13, lineHeight: 20 },

  // ── Disclaimer ───────────────────────────────────────────────────
  disclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 16 },

  // ── Book Now Button ──────────────────────────────────────────────
  bookNowBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bookNowBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // ── Rescan Button ────────────────────────────────────────────────
  rescanBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12 },
  rescanBtnText: { fontSize: 14, fontWeight: '600' },
});
