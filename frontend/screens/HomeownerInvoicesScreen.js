import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView, Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

const STATUS_COLOR = {
  requested: '#2563EB',
  viewed: '#8B5CF6',
  accepted: '#10B981',
  paid: '#059669',
  rejected: '#EF4444',
  cancelled: '#F59E0B',
};

export default function HomeownerInvoicesScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, [selectedFilter]);

  const fetchInvoices = async () => {
    try {
      const statusParam = selectedFilter === 'all' ? '' : `&status=${selectedFilter}`;
      const res = await api.get(`/invoice/my-requests?limit=50${statusParam}`);
      if (res.data.success) {
        setInvoices(res.data.data.invoices || []);
      }
    } catch (e) {
      console.warn('Fetch homeowner invoices error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const filters = [
    { id: 'all', label: 'All Invoices' },
    { id: 'requested', label: 'Pending Approval' },
    { id: 'accepted', label: 'Ready to Pay' },
    { id: 'paid', label: 'Completed' },
  ];

  const renderInvoiceItem = ({ item }) => {
    const statusColor = STATUS_COLOR[item.status] || colors.textSecondary;
    const isReadyToPay = item.status === 'accepted';
    const isNeedsReview = item.status === 'requested' || item.status === 'viewed';

    return (
      <TouchableOpacity
        style={[styles.invoiceCard, glassStyle]}
        onPress={() => navigation.navigate('InvoiceView', { invoiceId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.workerInfo}>
            {item.worker_photo ? (
              <Image source={{ uri: item.worker_photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.primary}25` }]}>
                <Icon name="engineering" size={20} color={colors.primary} />
              </View>
            )}
            <View>
              <Text style={[styles.workerName, { color: colors.text }]}>{item.worker_name || 'Worker'}</Text>
              <Text style={[styles.bookingNum, { color: colors.textSecondary }]}>Booking #{item.booking_id}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Total Amount</Text>
            <Text style={[styles.amountValue, { color: colors.primary }]}>{formatINRExact(item.grand_total)}</Text>
          </View>

          {isReadyToPay ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
              onPress={() => navigation.navigate('Payment', { invoiceId: item.id, amount: item.grand_total })}
            >
              <Icon name="payment" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Pay Now</Text>
            </TouchableOpacity>
          ) : isNeedsReview ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('InvoiceView', { invoiceId: item.id })}
            >
              <Icon name="rate-review" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Review</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
              onPress={() => navigation.navigate('InvoiceView', { invoiceId: item.id })}
            >
              <Text style={[styles.actionBtnText, { color: colors.text }]}>View</Text>
            </TouchableOpacity>
          )}
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Invoices</Text>
        </View>

        {/* Filter Pills */}
        <View style={{ height: 50 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filters}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const active = selectedFilter === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    { backgroundColor: active ? colors.primary : isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }
                  ]}
                  onPress={() => setSelectedFilter(item.id)}
                >
                  <Text style={[styles.filterText, { color: active ? '#FFF' : colors.textSecondary }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={invoices}
            renderItem={renderInvoiceItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="receipt-long" size={64} color={`${colors.textSecondary}40`} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No invoices found</Text>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  invoiceCard: { borderRadius: 20, padding: 16, marginBottom: 14, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  workerName: { fontSize: 16, fontWeight: '700' },
  bookingNum: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, marginVertical: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 11, fontWeight: '600' },
  amountValue: { fontSize: 18, fontWeight: '900' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 16 },
});
