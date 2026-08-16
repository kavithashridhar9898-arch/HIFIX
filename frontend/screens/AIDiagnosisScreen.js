import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import api from '../config/api';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';

const { width } = Dimensions.get('window');

export default function AIDiagnosisScreen({ navigation, route }) {
  const { isDarkMode } = useTheme();
  const [image, setImage] = useState(null); // { uri, type, name }
  const [contextNotes, setContextNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Glass style matching HiFix design system
  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(16, 20, 21, 0.75)' : 'rgba(255, 255, 255, 0.90)',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
  };

  const textPrimary = isDarkMode ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#475569';

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
        quality: 0.8,
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
        });
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
        quality: 0.8,
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
        });
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
  };

  // ── AI Diagnosis Trigger ───────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!image) {
      Alert.alert('Select Image', 'Please select or capture a photo first.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Pulse animation during loading
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: image.uri,
        name: image.name,
        type: image.type,
      });

      if (contextNotes.trim()) {
        formData.append('serviceContext', contextNotes.trim());
      }

      const response = await api.post('/ai/image-diagnosis', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.success) {
        setDiagnosisResult(response.data.data.diagnosis);
      } else {
        setErrorMsg(response.data?.message || 'Failed to complete AI diagnosis.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unable to connect to AI diagnosis service.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  };

  // ── Booking Bridge ─────────────────────────────────────────────────────────

  const handleProceedToBooking = () => {
    if (!diagnosisResult) return;
    const cat = diagnosisResult.category !== 'unknown' ? diagnosisResult.category : null;

    // Navigate to existing Workers screen with preselected service type
    navigation.navigate('Workers', {
      serviceType: cat,
      aiDiagnosis: {
        problem: diagnosisResult.problem,
        category: diagnosisResult.category,
        urgency: diagnosisResult.urgency,
      },
    });
  };

  // ── Rendering Helpers ─────────────────────────────────────────────────────

  const renderConfidenceBadge = (confidence, level) => {
    let bg = 'rgba(16, 185, 129, 0.15)';
    let color = '#10B981';
    let label = 'High Confidence';

    if (level === 'moderate') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#F59E0B';
      label = 'Moderate Confidence';
    } else if (level === 'low') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#EF4444';
      label = 'Low Confidence';
    }

    const percentage = Math.round((confidence || 0) * 100);

    return (
      <View style={[styles.confidenceBadge, { backgroundColor: bg }]}>
        <Icon name="verified" size={14} color={color} />
        <Text style={[styles.confidenceText, { color }]}>
          {percentage}% — {label}
        </Text>
      </View>
    );
  };

  const renderUrgencyBadge = (urgency) => {
    let color = '#3B82F6';
    let label = 'LOW URGENCY';

    if (urgency === 'medium') { color = '#F59E0B'; label = 'MEDIUM URGENCY'; }
    else if (urgency === 'high') { color = '#EF4444'; label = 'HIGH URGENCY'; }
    else if (urgency === 'critical') { color = '#DC2626'; label = 'CRITICAL URGENCY'; }

    return (
      <View style={[styles.urgencyBadge, { borderColor: color }]}>
        <Text style={[styles.urgencyText, { color }]}>{label}</Text>
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>AI Problem Scanner</Text>
            <Text style={[styles.headerSub, { color: textSecondary }]}>Instant visual diagnosis & estimate</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* AI Assistive Assessment Banner */}
          <View style={[styles.disclaimerTopBox, glassStyle]}>
            <Icon name="info-outline" size={18} color="#38BDF8" style={{ marginTop: 2 }} />
            <Text style={[styles.disclaimerTopText, { color: textSecondary }]}>
              AI provides an assistive visual assessment. Final diagnosis & pricing will be confirmed by your assigned professional.
            </Text>
          </View>

          {/* Step 1: Image Selection / Preview */}
          {!image ? (
            <View style={[styles.uploadBox, glassStyle]}>
              <View style={styles.uploadIconCircle}>
                <Icon name="center-focus-strong" size={44} color="#38BDF8" />
              </View>
              <Text style={[styles.uploadTitle, { color: textPrimary }]}>Take or Upload a Photo</Text>
              <Text style={[styles.uploadSub, { color: textSecondary }]}>
                Capture the problem clearly (leaking joint, exposed switch, damaged surface, etc.)
              </Text>

              <View style={styles.pickerBtnRow}>
                <TouchableOpacity style={styles.pickerBtnPrimary} onPress={handleTakePhoto}>
                  <LinearGradient colors={['#38BDF8', '#2563EB']} style={StyleSheet.absoluteFill} borderRadius={16} />
                  <Icon name="photo-camera" size={20} color="#FFFFFF" />
                  <Text style={styles.pickerBtnTextPrimary}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pickerBtnSecondary, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]} onPress={handlePickGallery}>
                  <Icon name="photo-library" size={20} color={textPrimary} />
                  <Text style={[styles.pickerBtnTextSecondary, { color: textPrimary }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.previewCard, glassStyle]}>
              <View style={styles.previewImageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity style={styles.removeImageBtn} onPress={handleRemoveImage}>
                  <Icon name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Context Notes Input */}
              <View style={styles.notesContainer}>
                <Text style={[styles.notesLabel, { color: textSecondary }]}>Describe issue (Optional)</Text>
                <TextInput
                  style={[styles.notesInput, { color: textPrimary, borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                  placeholder="e.g. Water leaking under kitchen sink for 2 days..."
                  placeholderTextColor={textSecondary}
                  value={contextNotes}
                  onChangeText={setContextNotes}
                  maxLength={300}
                  multiline
                />
              </View>

              {!loading && !diagnosisResult && (
                <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze}>
                  <LinearGradient colors={['#38BDF8', '#2563EB']} style={StyleSheet.absoluteFill} borderRadius={18} />
                  <Icon name="psychology" size={22} color="#FFFFFF" />
                  <Text style={styles.analyzeBtnText}>Analyze Problem with AI</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Loading Animation State */}
          {loading && (
            <View style={[styles.loadingBox, glassStyle]}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={styles.loadingPulseCircle}>
                  <ActivityIndicator size="large" color="#38BDF8" />
                </View>
              </Animated.View>
              <Text style={[styles.loadingTitle, { color: textPrimary }]}>Analyzing your problem...</Text>
              <Text style={[styles.loadingSub, { color: textSecondary }]}>
                Vision AI is examining visible symptoms, severity & service category.
              </Text>
            </View>
          )}

          {/* Error Message Display */}
          {errorMsg && !loading && (
            <View style={styles.errorBox}>
              <Icon name="error-outline" size={24} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleAnalyze}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Structured Diagnosis Result Display */}
          {diagnosisResult && !loading && (
            <View style={styles.resultsContainer}>

              {/* Safety Warning Alert (High Priority) */}
              {diagnosisResult.isSafetyRisk && (
                <View style={styles.safetyCard}>
                  <View style={styles.safetyHeaderRow}>
                    <Icon name="warning" size={24} color="#DC2626" />
                    <Text style={styles.safetyTitle}>SAFETY HAZARD DETECTED</Text>
                  </View>
                  <Text style={styles.safetyText}>
                    {diagnosisResult.safetyWarning || 'Caution: This issue presents a safety risk. Avoid touching affected areas.'}
                  </Text>
                </View>
              )}

              {/* Main Result Card */}
              <View style={[styles.resultCard, glassStyle]}>

                {/* Problem Title & Category Row */}
                <View style={styles.resultHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.problemTitle, { color: textPrimary }]}>
                      {diagnosisResult.problem}
                    </Text>
                    {renderConfidenceBadge(diagnosisResult.confidence, diagnosisResult.confidenceLevel)}
                  </View>
                  {renderUrgencyBadge(diagnosisResult.urgency)}
                </View>

                {/* Service Category Badge */}
                {(() => {
                  const catInfo = getCategoryIcon(diagnosisResult.category);
                  return (
                    <View style={styles.categoryBadgeRow}>
                      <View style={[styles.categoryIconCircle, { backgroundColor: `${catInfo.color}20` }]}>
                        <Icon name={catInfo.icon} size={22} color={catInfo.color} />
                      </View>
                      <View>
                        <Text style={[styles.categoryMetaLabel, { color: textSecondary }]}>RECOMMENDED SERVICE</Text>
                        <Text style={[styles.categoryMetaValue, { color: textPrimary }]}>{catInfo.label}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Low Confidence Alert */}
                {diagnosisResult.confidenceLevel === 'low' && (
                  <View style={styles.lowConfBox}>
                    <Icon name="error" size={18} color="#F59E0B" />
                    <Text style={styles.lowConfText}>
                      {diagnosisResult.lowConfidenceNotice || 'Low visual clarity. Image may be unclear. Please take another photo closer to the issue.'}
                    </Text>
                  </View>
                )}

                {/* Visible Symptoms */}
                {diagnosisResult.visibleSymptoms && diagnosisResult.visibleSymptoms.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.blockTitle, { color: textPrimary }]}>Visible Symptoms</Text>
                    {diagnosisResult.visibleSymptoms.map((symptom, idx) => (
                      <View key={idx} style={styles.symptomRow}>
                        <Icon name="check-circle-outline" size={16} color="#38BDF8" style={{ marginTop: 2 }} />
                        <Text style={[styles.symptomText, { color: textSecondary }]}>{symptom}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Estimates Grid: Duration & INR Cost */}
                <View style={styles.estimatesGrid}>
                  <View style={[styles.estimateCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <Icon name="schedule" size={20} color="#8B5CF6" />
                    <Text style={[styles.estimateLabel, { color: textSecondary }]}>ESTIMATED TIME</Text>
                    <Text style={[styles.estimateValue, { color: textPrimary }]}>
                      {diagnosisResult.estimatedDuration?.minHours}-{diagnosisResult.estimatedDuration?.maxHours} Hours
                    </Text>
                  </View>

                  <View style={[styles.estimateCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <Icon name="payments" size={20} color="#10B981" />
                    <Text style={[styles.estimateLabel, { color: textSecondary }]}>INDICATIVE COST</Text>
                    <Text style={[styles.estimateValue, { color: '#10B981' }]}>
                      {diagnosisResult.estimatedCost?.formatted || `₹${diagnosisResult.estimatedCost?.min} - ₹${diagnosisResult.estimatedCost?.max}`}
                    </Text>
                  </View>
                </View>

                {/* Recommended Action */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.blockTitle, { color: textPrimary }]}>Recommended Safe Action</Text>
                  <Text style={[styles.actionText, { color: textSecondary }]}>
                    {diagnosisResult.recommendedAction}
                  </Text>
                </View>

                {/* Limitations / Disclaimer */}
                <View style={[styles.disclaimerBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                  <Icon name="shield" size={16} color="#005bb5" />
                  <Text style={[styles.disclaimerText, { color: textSecondary }]}>
                    {diagnosisResult.limitations}
                  </Text>
                </View>

              </View>

              {/* Action Buttons */}
              <TouchableOpacity style={styles.bookNowBtn} onPress={handleProceedToBooking}>
                <LinearGradient colors={['#38BDF8', '#2563EB']} style={StyleSheet.absoluteFill} borderRadius={18} />
                <Text style={styles.bookNowBtnText}>
                  Find {getCategoryIcon(diagnosisResult.category).label} Professionals
                </Text>
                <Icon name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.rescanBtn} onPress={handleRemoveImage}>
                <Icon name="refresh" size={18} color={textSecondary} />
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrapper: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 20 },

  disclaimerTopBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    marginVertical: 12,
  },
  disclaimerTopText: { flex: 1, fontSize: 12, lineHeight: 17 },

  uploadBox: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 24,
    marginVertical: 12,
  },
  uploadIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56,189,248,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  uploadSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  pickerBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  pickerBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickerBtnTextPrimary: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  pickerBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickerBtnTextSecondary: { fontSize: 15, fontWeight: '600' },

  previewCard: { padding: 18, borderRadius: 24, marginVertical: 12 },
  previewImageWrapper: { position: 'relative', width: '100%', height: 220, borderRadius: 18, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesContainer: { marginTop: 16 },
  notesLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  analyzeBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  analyzeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  loadingBox: { alignItems: 'center', padding: 32, borderRadius: 24, marginVertical: 16 },
  loadingPulseCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(56,189,248,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  loadingSub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginVertical: 12,
  },
  errorText: { flex: 1, color: '#EF4444', fontSize: 13 },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EF4444', borderRadius: 8 },
  retryText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  resultsContainer: { marginVertical: 12 },
  safetyCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  safetyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  safetyTitle: { color: '#DC2626', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  safetyText: { color: '#991B1B', fontSize: 13, lineHeight: 18 },

  resultCard: { padding: 20, borderRadius: 24, marginBottom: 20 },
  resultHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  problemTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  confidenceText: { fontSize: 12, fontWeight: '700' },
  urgencyBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  urgencyText: { fontSize: 10, fontWeight: '800' },

  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  categoryIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  categoryMetaLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  categoryMetaValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },

  lowConfBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  lowConfText: { flex: 1, color: '#D97706', fontSize: 12, lineHeight: 16 },

  sectionBlock: { marginBottom: 16 },
  blockTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  symptomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  symptomText: { flex: 1, fontSize: 13, lineHeight: 18 },

  estimatesGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  estimateCard: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
  estimateLabel: { fontSize: 10, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  estimateValue: { fontSize: 14, fontWeight: '800' },

  actionText: { fontSize: 13, lineHeight: 19 },
  disclaimerBox: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, marginTop: 8 },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 16 },

  bookNowBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bookNowBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  rescanBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12 },
  rescanBtnText: { fontSize: 14, fontWeight: '600' },
});
