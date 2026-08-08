import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, SafeAreaView, Animated, ActivityIndicator,
  RefreshControl, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  requested: { label: 'Requested',  color: '#2563EB', bg: '#2563EB20', icon: 'send'           },
  viewed:    { label: 'Viewed',     color: '#8B5CF6', bg: '#8B5CF620', icon: 'visibility'      },
  accepted:  { label: 'Accepted',   color: '#22C55E', bg: '#22C55E20', icon: 'task-alt'        },
  rejected:  { label: 'Rejected',   color: '#EF4444', bg: '#EF444420', icon: 'cancel'          },
  expired:   { label: 'Expired',    color: '#6B7280', bg: '#6B728020', icon: 'timer-off'       },
  paid:      { label: 'Paid',       color: '#10B981', bg: '#10B98120', icon: 'check-circle'    },
  completed: { label: 'Completed',  color: '#059669', bg: '#05966920', icon: 'verified'        },
  cancelled: { label: 'Cancelled',  color: '#F59E0B', bg: '#F59E0B20', icon: 'block'           },
  refunded:  { label: 'Refunded',   color: '#6366F1', bg: '#6366F120', icon: 'reply'           },
};

const FILTER_TABS = [
  'all','requested','viewed','accepted','rejected','paid','completed','cancelled','refunded'
];

const StatusBadge = ({ status, colors }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: colors.textSecondary, bg: colors.border, icon: 'help' };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Icon name={cfg.icon} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

export default function PaymentRequestsScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [invoices, setInvoices]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [activeFilter, setFilter]     = useState('all');
  const [pagination, setPagination]   = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]               = useState(1);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    fetchInvoices(1, true);
  }, [activeFilter, search]);

  const fetchInvoices = async (pageNum = 1, reset = false) => {
    if (pageNum === 1) reset ? setLoading(true) : setRefreshing(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        page: pageNum, limit: 10,
        ...(activeFilter !== 'all' && { status: activeFilter }),
        ...(search.trim() && { search: search.trim() }),
      });
      const res = await api.get(`/invoice/my-requests?${params}`);
      if (res.data.success) {
        const newItems = res.data.data.invoices || [];
        setInvoices(prev => (reset || pageNum === 1) ? newItems : [...prev, ...newItems]);
        setPagination(res.data.data.pagination);
        setPage(pageNum);
      }
    } catch (e) {
      console.warn('Invoice list error', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleWithdraw = (id) => {
    Alert.alert('Withdraw', 'Are you sure you want to withdraw this payment request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/invoice/${id}/withdraw`);
            fetchInvoices(1, true);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Cannot withdraw');
          }
        },
      },
    ]);
  };

  const renderCard = useCallback(({ item }) => {
    const canEdit = !item.viewed_at && item.status === 'requested';
    const date    = new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={[styles.card, {
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.90)',
            borderColor:     isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.6)',
          }]}
          onPress={() => navigation.navigate('InvoiceView', { invoiceId: item.id })}
          activeOpacity={0.85}
        >
          {/* Card Top */}
          <View style={styles.cardTop}>
            {/* Avatar */}
            <View style={[styles.avatarCircle, { backgroundColor: `${colors.primary}25` }]}>
              <Icon name={user?.user_type === 'worker' ? 'home' : 'engineering'} size={22} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                {user?.user_type === 'worker' ? item.customer_name : item.worker_name}
              </Text>
              <Text style={[styles.bookingTag, { color: colors.textSecondary }]}>Booking #{item.booking_id}</Text>
            </View>

            <StatusBadge status={item.status} colors={colors} />
          </View>

          {/* Amount */}
          <View style={[styles.amountRow, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Grand Total</Text>
            <Text style={[styles.amountValue, { color: colors.primary }]}>{formatINRExact(item.grand_total)}</Text>
          </View>

          {/* Meta */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Icon name="event" size={13} color={colors.textSecondary} />
            <Text style={[styles.dateMeta, { color: colors.textSecondary, marginLeft: 4, marginBottom: 0 }]}>
              {date}{item.viewed_at ? '  ·  👁 Viewed by homeowner' : ''}
            </Text>
          </View>

          {/* Action Buttons */}
          {user?.user_type === 'worker' && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
                onPress={() => navigation.navigate('InvoiceView', { invoiceId: item.id })}
              >
                <Icon name="visibility" size={15} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>View</Text>
              </TouchableOpacity>

              {canEdit && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}
                  onPress={() => navigation.navigate('InvoiceEdit', { invoiceId: item.id })}
                >
                  <Icon name="edit" size={15} color="#F59E0B" />
                  <Text style={[styles.actionText, { color: '#F59E0B' }]}>Edit</Text>
                </TouchableOpacity>
              )}

              {canEdit && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}
                  onPress={() => handleWithdraw(item.id)}
                >
                  <Icon name="undo" size={15} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Withdraw</Text>
                </TouchableOpacity>
              )}

              {item.viewed_at && item.status !== 'cancelled' && (
                <View style={[styles.lockedBadge, { backgroundColor: '#6B728020' }]}>
                  <Icon name="lock" size={13} color="#6B7280" />
                  <Text style={[styles.actionText, { color: '#6B7280' }]}>Locked</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colors, isDarkMode, user, fadeAnim]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="receipt-long" size={72} color={`${colors.textSecondary}40`} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        {activeFilter === 'all' ? 'No payment requests yet' : `No ${activeFilter} requests`}
      </Text>
      <Text style={[styles.emptySubtitle, { color: `${colors.textSecondary}80` }]}>
        Complete a job and create an invoice to see it here
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ margin: 20 }} color={colors.primary} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Payment Requests</Text>
            {!!pagination && <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>{pagination.total} total</Text>}
          </View>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* Search Bar */}
        <View style={[styles.searchBar, {
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
          borderColor:     isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.6)',
        }]}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by Booking ID or Name..."
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {FILTER_TABS.map(tab => {
            const isActive = tab === activeFilter;
            const cfg = STATUS_CONFIG[tab];
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setFilter(tab)}
                style={[
                  styles.filterTab,
                  isActive
                    ? { backgroundColor: cfg?.color || colors.primary, borderColor: cfg?.color || colors.primary }
                    : { backgroundColor: 'transparent', borderColor: colors.border },
                ]}
              >
                {cfg && <Icon name={cfg.icon} size={13} color={isActive ? '#fff' : colors.textSecondary} />}
                <Text style={[styles.filterTabText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                  {tab === 'all' ? 'All' : STATUS_CONFIG[tab]?.label || tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={invoices}
            renderItem={renderCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={() => {
              if (pagination?.hasNext && !loadingMore) fetchInvoices(page + 1);
            }}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchInvoices(1, true)}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerMeta: { fontSize: 12, marginTop: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, height: 46 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  filterRow: { maxHeight: 46, marginBottom: 6 },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterTabText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  customerName: { fontSize: 16, fontWeight: '700' },
  bookingTag: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  amountLabel: { fontSize: 13 },
  amountValue: { fontSize: 20, fontWeight: '900' },
  dateMeta: { fontSize: 12, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  actionText: { fontSize: 12, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
