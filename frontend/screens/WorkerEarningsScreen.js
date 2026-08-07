import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

export default function WorkerEarningsScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const res = await api.get('/payment/earnings');
      if (res.data.success) {
        setEarnings(res.data.data.earnings);
      }
    } catch (e) {
      console.warn('Fetch earnings error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Earnings & Payouts</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Main Earnings Card */}
          <View style={[styles.mainCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.cardLabel}>TOTAL EARNED</Text>
            <Text style={styles.cardAmount}>{formatINRExact(earnings?.total_earned || 0)}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Pending Payouts</Text>
                <Text style={styles.statVal}>{formatINRExact(earnings?.total_pending || 0)}</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Jobs Paid</Text>
                <Text style={styles.statVal}>{earnings?.total_jobs_paid || 0}</Text>
              </View>
            </View>
          </View>

          {/* Quick Shortcuts */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={[styles.shortcutBtn, glassStyle]}
              onPress={() => navigation.navigate('PaymentRequests')}
            >
              <Icon name="receipt-long" size={22} color={colors.primary} />
              <Text style={[styles.shortcutText, { color: colors.text }]}>Payment Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, glassStyle]}
              onPress={() => navigation.navigate('PaymentHistory')}
            >
              <Icon name="history" size={22} color={colors.primary} />
              <Text style={[styles.shortcutText, { color: colors.text }]}>Payment History</Text>
            </TouchableOpacity>
          </View>

          {/* Monthly Breakdown */}
          <View style={[styles.card, glassStyle]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Earnings</Text>
            {earnings?.monthly_breakdown?.length ? (
              earnings.monthly_breakdown.map((item, idx) => (
                <View key={idx} style={[styles.monthlyRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.monthText, { color: colors.text }]}>{item.month}</Text>
                  <Text style={[styles.monthJobs, { color: colors.textSecondary }]}>{item.count} Jobs</Text>
                  <Text style={[styles.monthAmount, { color: colors.primary }]}>{formatINRExact(item.total)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSecondary, marginVertical: 12 }}>No payment history recorded yet</Text>
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
  headerTitle: { fontSize: 22, fontWeight: '800', flex: 1, marginLeft: 8 },
  mainCard: { padding: 24, borderRadius: 22, marginBottom: 16, elevation: 4 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  cardAmount: { color: '#FFF', fontSize: 38, fontWeight: '900', marginVertical: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  statCol: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  statVal: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  shortcutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16 },
  shortcutText: { fontSize: 13, fontWeight: '700' },
  card: { padding: 18, borderRadius: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  monthlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  monthText: { fontSize: 15, fontWeight: '700' },
  monthJobs: { fontSize: 13 },
  monthAmount: { fontSize: 16, fontWeight: '800' },
});
