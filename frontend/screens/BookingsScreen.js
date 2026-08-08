import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Animated, FlatList, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { useTabAnimation } from '../context/TabAnimationContext';
import { formatINRExact } from '../utils/currency';

const BookingsScreen = React.memo(function BookingsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const { handleScroll } = useTabAnimation();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchBookings();
  }, [selectedFilter]);

  const fetchBookings = async () => {
    try {
      const statusParam = selectedFilter === 'all' ? '' : `?status=${selectedFilter}`;
      const response = await api.get(`/bookings${statusParam}`);
      if (response.data.success) {
        setBookings(response.data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'accepted': return '#2563EB';
      case 'in_progress': return '#8B5CF6';
      case 'completed': return '#10B981';
      case 'paid': return '#059669';
      case 'cancelled': return '#EF4444';
      default: return colors.textSecondary;
    }
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.92)',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'paid', label: 'Paid' },
  ];

  const renderBookingCard = useCallback(({ item }) => {
    const statusColor = getStatusColor(item.status);
    const isWorker = user?.user_type === 'worker';

    return (
      <TouchableOpacity
        style={[styles.bookingCard, glassStyle]}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.serviceBadge}>
            <Icon name="build" size={18} color={colors.primary} />
            <Text style={[styles.serviceType, { color: colors.text }]}>
              {(item.service_type || 'SERVICE').toUpperCase()}
            </Text>
          </View>

          <View style={[styles.statusTag, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusTagText, { color: statusColor }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[styles.bookingDate, { color: colors.textSecondary }]}>
          {new Date(item.booking_date).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
          })}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Icon name="person" size={18} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {isWorker ? `Client: ${item.homeowner_name || 'Homeowner'}` : `Worker: ${item.worker_name || 'Assigned'}`}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="location-on" size={18} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.address || 'Location provided'}
            </Text>
          </View>

          {Number(item.estimated_price) > 0 && (
            <View style={styles.detailRow}>
              <Icon name="payments" size={18} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.primary, fontWeight: '800' }]}>
                {formatINRExact(item.estimated_price)}
              </Text>
            </View>
          )}
        </View>

        {/* Shortcut Action Buttons */}
        {isWorker && ['accepted', 'in_progress'].includes(item.status) && (
          <TouchableOpacity
            style={[styles.shortcutBtn, { backgroundColor: '#10B981' }]}
            onPress={() => navigation.navigate('WorkTimer', { bookingId: item.id })}
          >
            <Icon name="timer" size={16} color="#FFF" />
            <Text style={styles.shortcutText}>Work Timer</Text>
          </TouchableOpacity>
        )}

      </TouchableOpacity>
    );
  }, [navigation, user, isDarkMode, colors]);

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>My Bookings</Text>
        </View>

        {/* Filter Pills */}
        <View style={{ height: 46, marginBottom: 8 }}>
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
          <Animated.FlatList
            data={bookings}
            renderItem={renderBookingCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="calendar-today" size={64} color={`${colors.textSecondary}40`} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No bookings found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
});

export default BookingsScreen;

const styles = StyleSheet.create({
  titleContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  screenTitle: { fontSize: 28, fontWeight: '900' },
  filterList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bookingCard: { borderRadius: 22, padding: 16, marginBottom: 14, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serviceType: { fontSize: 16, fontWeight: '900' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTagText: { fontSize: 11, fontWeight: '800' },
  bookingDate: { fontSize: 12, marginTop: 4 },
  divider: { height: 1, marginVertical: 12 },
  cardBody: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, flex: 1 },
  shortcutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  shortcutText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 16 },
});