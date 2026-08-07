import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

export default function PaymentHistoryScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, [filter]);

  const fetchHistory = async () => {
    try {
      const filterParam = filter === 'all' ? '' : `?status=${filter}`;
      const res = await api.get(`/payment/history${filterParam}`);
      if (res.data.success) {
        setPayments(res.data.payments || res.data.data?.payments || []);
      }
    } catch (e) {
      console.warn('Fetch payment history error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const statusColors = {
    paid: '#10B981',
    requested: '#2563EB',
    pending: '#F59E0B',
    failed: '#EF4444',
    cancelled: '#6B7280',
  };

  const renderPaymentCard = ({ item }) => {
    const isOwner = user?.user_type === 'homeowner';
    const otherName = isOwner ? item.worker_name : item.customer_name;
    const statusColor = statusColors[item.status] || colors.textSecondary;

    return (
      <TouchableOpacity
        style={[styles.card, glassStyle]}
        onPress={() => {
          if (item.status === 'paid') {
            navigation.navigate('Receipt', { invoiceId: item.booking_id });
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.nameText, { color: colors.text }]}>{otherName || 'User'}</Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Booking #{item.booking_id} · {item.payment_method || 'Online'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{(item.status || 'PENDING').toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.cardFooter}>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          <Text style={[styles.amountText, { color: colors.primary }]}>
            {formatINRExact(item.requested_amount || item.amount || 0)}
          </Text>
        </View>
      </TouchableOpacity>
    );
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Payment History</Text>
        </View>

        {/* Filter Pills */}
        <View style={{ height: 50 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[
              { id: 'all', label: 'All' },
              { id: 'paid', label: 'Paid' },
              { id: 'requested', label: 'Requested' },
              { id: 'cancelled', label: 'Cancelled' },
            ]}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const active = filter === item.id;
              return (
                <TouchableOpacity
                  style={[styles.filterPill, { backgroundColor: active ? colors.primary : isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
                  onPress={() => setFilter(item.id)}
                >
                  <Text style={[styles.filterText, { color: active ? '#FFF' : colors.textSecondary }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={payments}
            renderItem={renderPaymentCard}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name="history" size={64} color={`${colors.textSecondary}40`} />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No payment transactions found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 22, fontWeight: '800', flex: 1, marginLeft: 8 },
  filterList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  card: { padding: 16, borderRadius: 18, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nameText: { fontSize: 16, fontWeight: '700' },
  metaText: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, marginVertical: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 12 },
  amountText: { fontSize: 17, fontWeight: '900' },
});
