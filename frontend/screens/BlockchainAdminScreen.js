import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';

export default function BlockchainAdminScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/blockchain/dashboard/summary');
      if (res.data.success) {
        setSummary(res.data.data);
      }
    } catch (e) {
      console.warn('Fetch blockchain summary error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  const handleRetryJob = async (jobId) => {
    try {
      setActionLoading(jobId);
      const res = await api.post(`/blockchain/jobs/${jobId}/retry`);
      if (res.data.success) {
        Alert.alert('Success', `Job #${jobId} reset to PENDING and re-triggered.`);
        fetchSummary();
      }
    } catch (e) {
      Alert.alert('Retry Failed', e?.response?.data?.message || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <ActivityIndicator size="large" color="#8247E5" />
      </View>
    );
  }

  const getJobCount = (status) => {
    return summary?.jobStats?.find((s) => s.status === status)?.count || 0;
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Blockchain Dashboard</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8247E5" />}
        >
          {/* Network Header Card */}
          <View style={[styles.netCard, { backgroundColor: '#8247E5' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="link" size={28} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.netName}>{summary?.network || 'Polygon Amoy'}</Text>
                <Text style={styles.netChain}>Chain ID: {summary?.chainId || 80002}</Text>
              </View>
              <View style={[styles.modeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.modeText}>{summary?.simulationMode ? 'SIMULATION' : 'LIVE RPC'}</Text>
              </View>
            </View>
            <Text style={styles.contractAddr} numberOfLines={1}>
              Contract: {summary?.contractAddress || '0xf7839B17D1f7940dc753645B99014152f3603e1D'}
            </Text>
          </View>

          {/* Durable Queue Status Cards Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>MySQL Durable Queue Status</Text>
          <View style={styles.grid}>
            <View style={[styles.gridCard, glassStyle]}>
              <Icon name="hourglass-top" size={22} color="#F59E0B" />
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Pending / Retry</Text>
              <Text style={[styles.gridVal, { color: colors.text }]}>
                {getJobCount('PENDING') + getJobCount('RETRYING')}
              </Text>
            </View>

            <View style={[styles.gridCard, glassStyle]}>
              <Icon name="sync" size={22} color="#2563EB" />
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Processing</Text>
              <Text style={[styles.gridVal, { color: colors.text }]}>
                {getJobCount('PROCESSING')}
              </Text>
            </View>

            <View style={[styles.gridCard, glassStyle]}>
              <Icon name="check-circle" size={22} color="#10B981" />
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Confirmed</Text>
              <Text style={[styles.gridVal, { color: colors.text }]}>
                {getJobCount('CONFIRMED')}
              </Text>
            </View>

            <View style={[styles.gridCard, glassStyle]}>
              <Icon name="error" size={22} color="#EF4444" />
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Dead Letter</Text>
              <Text style={[styles.gridVal, { color: colors.text }]}>
                {getJobCount('DEAD_LETTER') + getJobCount('FAILED')}
              </Text>
            </View>
          </View>

          {/* Average confirmation time */}
          <View style={[styles.card, glassStyle, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Avg Confirmation Time</Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: colors.primary }}>
                {summary?.avgConfirmationSeconds ? `${summary.avgConfirmationSeconds}s` : '~ 12s'}
              </Text>
            </View>
          </View>

          {/* Recent Queue Jobs */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Durable Queue Jobs</Text>
          <View style={[styles.card, glassStyle]}>
            {summary?.recentJobs?.length ? (
              summary.recentJobs.map((job, idx) => (
                <View key={idx} style={[styles.logRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.logAction, { color: job.status === 'CONFIRMED' ? '#10B981' : job.status === 'DEAD_LETTER' ? '#EF4444' : '#F59E0B' }]}>
                      Job #{job.id} • {job.job_type}
                    </Text>
                    <Text style={[styles.logEntity, { color: colors.textSecondary }]}>
                      Status: {job.status} ({job.attempt_count}/{job.max_attempts} attempts)
                    </Text>
                  </View>

                  {['FAILED', 'DEAD_LETTER', 'RETRYING'].includes(job.status) && (
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={() => handleRetryJob(job.id)}
                      disabled={actionLoading === job.id}
                    >
                      {actionLoading === job.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.retryBtnText}>Retry</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSecondary }}>No queue jobs recorded yet</Text>
            )}
          </View>

          {/* Live Audit Logs */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Live Audit Logs</Text>
          <View style={[styles.card, glassStyle]}>
            {summary?.recentLogs?.length ? (
              summary.recentLogs.map((log, idx) => (
                <View key={idx} style={[styles.logRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.logAction, { color: log.action.includes('SUCCESS') || log.action.includes('CONFIRMED') ? '#10B981' : colors.text }]}>
                      {log.action}
                    </Text>
                    <Text style={[styles.logEntity, { color: colors.textSecondary }]}>
                      {log.entity_type} #{log.entity_id}
                    </Text>
                  </View>
                  <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSecondary }}>No audit logs recorded yet</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  netCard: { padding: 20, borderRadius: 22, marginBottom: 20, elevation: 4 },
  netName: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  netChain: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  modeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  contractAddr: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'monospace', marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', padding: 14, borderRadius: 18, gap: 4 },
  gridLabel: { fontSize: 11, fontWeight: '600' },
  gridVal: { fontSize: 18, fontWeight: '900' },
  card: { padding: 16, borderRadius: 20 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  logAction: { fontSize: 13, fontWeight: '800' },
  logEntity: { fontSize: 11 },
  logTime: { fontSize: 11 },
  retryBtn: { backgroundColor: '#8247E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  retryBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});
