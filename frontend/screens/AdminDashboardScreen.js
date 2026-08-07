import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

export default function AdminDashboardScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    fetchSummary();
  }, [period]);

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/payment/admin/summary?period=${period}`);
      if (res.data.success) {
        setSummary(res.data.data);
      }
    } catch (e) {
      console.warn('Fetch admin summary error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSummary();
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Financial Overview</Text>
        </View>

        {/* Period Selector */}
        <View style={{ height: 46 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[
              { id: 'daily', label: 'Last 24 Hours' },
              { id: 'weekly', label: 'Last 7 Days' },
              { id: 'monthly', label: 'Last 30 Days' },
            ]}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.periodList}
            renderItem={({ item }) => {
              const active = period === item.id;
              return (
                <TouchableOpacity
                  style={[styles.periodPill, { backgroundColor: active ? colors.primary : isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
                  onPress={() => setPeriod(item.id)}
                >
                  <Text style={[styles.periodText, { color: active ? '#FFF' : colors.textSecondary }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Revenue Card */}
          <View style={[styles.revenueCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.cardLabel}>TOTAL PLATFORM REVENUE</Text>
            <Text style={styles.cardAmount}>{formatINRExact(summary?.total_revenue || 0)}</Text>
            <Text style={styles.cardSub}>{summary?.total_payments || 0} Successful Transactions</Text>
          </View>

          {/* Breakdown Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Status Breakdown</Text>
          <View style={styles.grid}>
            {summary?.by_status?.map((item, idx) => (
              <View key={idx} style={[styles.gridCard, glassStyle]}>
                <Text style={[styles.gridStatus, { color: colors.textSecondary }]}>{item.status.toUpperCase()}</Text>
                <Text style={[styles.gridVal, { color: colors.text }]}>{formatINRExact(item.total)}</Text>
                <Text style={[styles.gridCount, { color: colors.primary }]}>{item.count} Invoices</Text>
              </View>
            ))}
          </View>

          {/* Recent Transactions */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Recent Receipts</Text>
          <View style={[styles.card, glassStyle]}>
            {summary?.recent_receipts?.length ? (
              summary.recent_receipts.map((r, idx) => (
                <View key={idx} style={[styles.txRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.txNum, { color: colors.text }]}>{r.receipt_number}</Text>
                    <Text style={[styles.txMeta, { color: colors.textSecondary }]}>
                      {r.customer_name} → {r.worker_name}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: colors.primary }]}>{formatINRExact(r.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSecondary }}>No transactions recorded</Text>
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
  periodList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  periodPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  periodText: { fontSize: 13, fontWeight: '700' },
  revenueCard: { padding: 22, borderRadius: 22, marginBottom: 20, elevation: 4 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  cardAmount: { color: '#FFF', fontSize: 36, fontWeight: '900', marginVertical: 6 },
  cardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: '48%', padding: 14, borderRadius: 16 },
  gridStatus: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  gridVal: { fontSize: 17, fontWeight: '900', marginTop: 4 },
  gridCount: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  card: { padding: 16, borderRadius: 20 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  txNum: { fontSize: 14, fontWeight: '700' },
  txMeta: { fontSize: 12 },
  txAmount: { fontSize: 15, fontWeight: '800' },
});
