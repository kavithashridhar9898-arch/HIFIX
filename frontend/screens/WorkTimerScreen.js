import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINR, msToHHMMSS } from '../utils/currency';

const STATUS_COLORS = {
  active:    '#22C55E',
  paused:    '#F59E0B',
  completed: '#2563EB',
};

export default function WorkTimerScreen({ route, navigation }) {
  const { bookingId, workerProfile } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef(null);

  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedMs, setElapsedMs]     = useState(0);
  const [workerData, setWorkerData]   = useState(workerProfile || null);

  const hourlyRate = parseFloat(workerData?.hourly_rate || workerData?.hourlyRate || 0);

  // ── Load session on mount ────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    fetchSession();
    if (!workerData) fetchWorkerProfile();
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Pulse animation for active status dot ────────────────────────────────────
  useEffect(() => {
    if (session?.status === 'active') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [session?.status]);

  // ── Live timer tick ──────────────────────────────────────────────────────────
  const startTick = useCallback((sess) => {
    clearInterval(intervalRef.current);
    if (!sess || sess.status === 'completed') {
      setElapsedMs(Number(sess?.total_duration_ms || 0));
      return;
    }
    const computeElapsed = () => {
      if (sess.status === 'paused') {
        const e = new Date(sess.paused_at).getTime() - new Date(sess.started_at).getTime() - Number(sess.total_paused_ms);
        setElapsedMs(Math.max(0, e));
      } else {
        const e = Date.now() - new Date(sess.started_at).getTime() - Number(sess.total_paused_ms);
        setElapsedMs(Math.max(0, e));
      }
    };
    computeElapsed();
    if (sess.status === 'active') {
      intervalRef.current = setInterval(computeElapsed, 1000);
    }
  }, []);

  const fetchSession = async () => {
    try {
      const res = await api.get(`/work-timer/${bookingId}`);
      const sess = res.data.data?.session || null;
      setSession(sess);
      startTick(sess);
    } catch (e) {
      console.warn('Timer fetch error', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerProfile = async () => {
    try {
      const res = await api.get('/worker-profile/me');
      if (res.data.success) setWorkerData(res.data.data.workerProfile);
    } catch (_) {}
  };

  // ── Timer actions ────────────────────────────────────────────────────────────
  const doAction = async (endpoint, successMsg) => {
    setActionLoading(true);
    clearInterval(intervalRef.current);
    try {
      const res = await api.post(`/work-timer/${endpoint}`, { booking_id: bookingId });
      const sess = res.data.data?.session;
      setSession(sess);
      startTick(sess);
      if (successMsg) Alert.alert('✅', successMsg);
      return sess;
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Action failed');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = () => doAction('start', null);
  const handlePause = () => doAction('pause', 'Timer paused');
  const handleResume = () => doAction('resume', null);

  const handleComplete = () => {
    Alert.alert(
      '🔒 Complete Work',
      'This will permanently lock the timer. You cannot restart it.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Work',
          style: 'destructive',
          onPress: async () => {
            const sess = await doAction('complete', 'Work completed!');
            if (sess?.status === 'completed') {
              // Navigate to invoice builder with session data
              navigation.replace('InvoiceBuilder', {
                bookingId,
                session: sess,
                workerProfile: workerData,
              });
            }
          },
        },
      ]
    );
  };

  // ── Derived values ───────────────────────────────────────────────────────────
  const currentLabourCost = Math.round((hourlyRate * (elapsedMs / 3600000)) * 100) / 100;
  const displayTime = msToHHMMSS(elapsedMs);
  const statusColor = STATUS_COLORS[session?.status] || colors.textSecondary;

  // ── Glass card style ─────────────────────────────────────────────────────────
  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#fff' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Work Timer</Text>
          <Text style={[styles.bookingTag, { backgroundColor: `${colors.primary}20`, color: colors.primary }]}>
            #{bookingId}
          </Text>
        </Animated.View>

        <Animated.View style={[{ flex: 1, padding: 20 }, { opacity: fadeAnim }]}>

          {/* Status Bar */}
          {session && (
            <View style={[styles.statusBar, { backgroundColor: `${statusColor}20`, borderColor: `${statusColor}40` }]}>
              <Animated.View style={[styles.statusDot, { backgroundColor: statusColor, transform: [{ scale: pulseAnim }] }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {session.status === 'active'    ? 'WORK IN PROGRESS'  :
                 session.status === 'paused'    ? 'TIMER PAUSED'      :
                 session.status === 'completed' ? 'WORK COMPLETED 🔒' : session.status.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Timer Display */}
          <View style={[styles.timerCard, glass]}>
            <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>WORK TIMER</Text>
            <Text style={[styles.timerDisplay, { color: colors.text }]}>{displayTime}</Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.rateRow}>
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Hourly Rate</Text>
                <Text style={[styles.rateValue, { color: colors.primary }]}>
                  {formatINR(hourlyRate)}/hr
                </Text>
              </View>
              <View style={[styles.rateDivider, { backgroundColor: colors.border }]} />
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Labour Cost</Text>
                <Animated.Text style={[styles.rateValueLarge, { color: colors.success || '#22C55E' }]}>
                  {formatINR(currentLabourCost)}
                </Animated.Text>
              </View>
            </View>

            {session?.status === 'paused' && (
              <View style={[styles.pauseNote, { backgroundColor: '#F59E0B20' }]}>
                <Icon name="pause-circle-outline" size={16} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>
                  Timer is paused — Labour cost frozen
                </Text>
              </View>
            )}

            {session?.status === 'completed' && (
              <View style={[styles.pauseNote, { backgroundColor: '#2563EB20' }]}>
                <Icon name="lock" size={16} color="#2563EB" />
                <Text style={{ color: '#2563EB', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>
                  Timer locked — Final: {formatINR(currentLabourCost)} labour cost
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.btnContainer}>
            {/* No session yet — show START WORK */}
            {!session && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnStart]}
                onPress={handleStart}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Icon name="play-circle-filled" size={26} color="#fff" />
                    <Text style={styles.actionBtnText}>START WORK</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {session?.status === 'active' && (
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnPause]}
                  onPress={handlePause}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Icon name="pause" size={24} color="#fff" />
                      <Text style={styles.actionBtnText}>Pause</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnComplete]}
                  onPress={handleComplete}
                  disabled={actionLoading}
                >
                  <Icon name="check-circle" size={24} color="#fff" />
                  <Text style={styles.actionBtnText}>Complete Work</Text>
                </TouchableOpacity>
              </View>
            )}

            {session?.status === 'paused' && (
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnResume]}
                  onPress={handleResume}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Icon name="play-arrow" size={24} color="#fff" />
                      <Text style={styles.actionBtnText}>Resume</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnComplete]}
                  onPress={handleComplete}
                  disabled={actionLoading}
                >
                  <Icon name="check-circle" size={24} color="#fff" />
                  <Text style={styles.actionBtnText}>Complete Work</Text>
                </TouchableOpacity>
              </View>
            )}

            {session?.status === 'completed' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnComplete]}
                onPress={() => navigation.navigate('InvoiceBuilder', { bookingId, session, workerProfile: workerData })}
              >
                <Icon name="receipt-long" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Create Invoice</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Session Info */}
          {session && (
            <View style={[styles.infoBox, glass, { marginTop: 16 }]}>
              <Text style={[styles.infoBoxTitle, { color: colors.textSecondary }]}>SESSION INFO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoItemLabel, { color: colors.textSecondary }]}>Started</Text>
                  <Text style={[styles.infoItemValue, { color: colors.text }]}>
                    {new Date(session.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {session.status === 'completed' && session.completed_at && (
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoItemLabel, { color: colors.textSecondary }]}>Ended</Text>
                    <Text style={[styles.infoItemValue, { color: colors.text }]}>
                      {new Date(session.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  bookingTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontWeight: '700', fontSize: 13 },
  statusBar: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  timerCard: { borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 6, marginBottom: 24 },
  timerLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  timerDisplay: { fontSize: 62, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  divider: { height: 1, width: '100%', marginVertical: 20 },
  rateRow: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  rateItem: { flex: 1, alignItems: 'center' },
  rateDivider: { width: 1, height: 40 },
  rateLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  rateValue: { fontSize: 18, fontWeight: '800' },
  rateValueLarge: { fontSize: 22, fontWeight: '900' },
  pauseNote: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginTop: 16, width: '100%' },
  btnContainer: { gap: 0 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 58, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnStart:    { backgroundColor: '#22C55E' },
  btnPause:    { backgroundColor: '#F59E0B' },
  btnResume:   { backgroundColor: '#22C55E' },
  btnComplete: { backgroundColor: '#2563EB' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  infoBox: { borderRadius: 16, padding: 14 },
  infoBoxTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  infoItem: {},
  infoItemLabel: { fontSize: 11, marginBottom: 2 },
  infoItemValue: { fontWeight: '700', fontSize: 14 },
});
