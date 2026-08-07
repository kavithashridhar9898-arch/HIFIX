import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import PremiumBackground from '../components/PremiumBackground';

export default function WorkerDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const { unreadCount } = useNotifications();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState('available');
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
  }, []);

  useEffect(() => {
    // Load bookings and infer availability from most recent active job if needed
    const load = async () => {
      try {
        const { data } = await api.get('/bookings');
        if (data.success) {
          setBookings(data.bookings || []);
        }
      } catch (e) {
        console.warn('Failed to load bookings', e?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const byStatus = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
    const completed = bookings.filter(b => b.status === 'completed');
    const earnings = completed.reduce((sum, b) => sum + (Number(b.estimated_price) || 0), 0);
    return {
      pending: byStatus.pending || 0,
      accepted: byStatus.accepted || 0,
      in_progress: byStatus.in_progress || 0,
      completed: byStatus.completed || 0,
      earnings,
    };
  }, [bookings]);

  const toggleAvailability = async (nextOn) => {
    const next = nextOn ? 'available' : 'busy';
    setAvailability(next);
    try {
      await api.put('/workers/profile', { availability_status: next });
    } catch (e) {
      // revert on failure
      setAvailability(prev => (prev === 'available' ? 'busy' : 'available'));
    }
  };



  const cards = [
    { key: 'pending', label: 'Pending', icon: 'hourglass-empty', color: '#FFB74D', value: stats.pending },
    { key: 'accepted', label: 'Accepted', icon: 'task-alt', color: '#64B5F6', value: stats.accepted },
    { key: 'in_progress', label: 'In Progress', icon: 'build', color: '#81C784', value: stats.in_progress },
    { key: 'completed', label: 'Completed', icon: 'check-circle', color: '#9575CD', value: stats.completed },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Animated.View
          style={[styles.header, {
            backgroundColor: headerAnim.interpolate({ 
              inputRange: [0, 1], 
              outputRange: [isDarkMode ? '#121212' : 'rgba(255,255,255,0.8)', isDarkMode ? '#1A1A1A' : 'rgba(255,255,255,0.9)'] 
            }),
            borderBottomColor: colors.border,
          }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={[styles.hello, { color: colors.textSecondary }]}>Welcome back</Text>
              <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'Worker'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.notificationBtn}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Icon name="notifications-none" size={28} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={[styles.badgeContainer, { borderColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }]}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  const tabName = user?.user_type === 'worker' ? 'Jobs' : 'Bookings';
                  navigation.navigate(tabName);
                }} 
                style={[styles.pillButton, { backgroundColor: colors.primary }]}
              >
                <Icon name="list-alt" size={18} color="#fff" />
                <Text style={styles.pillText}>{user?.user_type === 'worker' ? 'Jobs' : 'Bookings'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.availabilityRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusDot, { backgroundColor: availability === 'available' ? '#2ecc71' : '#f1c40f' }]} />
              <Text style={[styles.availabilityText, { color: colors.text }]}>{availability === 'available' ? 'Available' : 'Busy'}</Text>
            </View>
            <Switch
              value={availability === 'available'}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#555', true: '#6ab7ff' }}
              thumbColor={availability === 'available' ? colors.primary : '#ccc'}
            />
          </View>
        </Animated.View>

        <View style={styles.cardsGrid}>
          {cards.map((c) => (
            <View key={c.key} style={[styles.card, { borderColor: `${c.color}55`, backgroundColor: colors.surface }] }>
              <View style={[styles.cardIcon, { backgroundColor: `${c.color}33` }]}>
                <Icon name={c.icon} size={22} color={c.color} />
              </View>
              <Text style={[styles.cardValue, { color: colors.text }]}>{c.value}</Text>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{c.label}</Text>
            </View>
          ))}
          <View style={[styles.card, { borderColor: '#4db6ac55', backgroundColor: colors.surface }] }>
            <View style={[styles.cardIcon, { backgroundColor: '#4db6ac33' }]}>
              <Icon name="currency-rupee" size={22} color="#4DB6AC" />
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>₹{stats.earnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Earnings</Text>
          </View>
        </View>

        {/* Phase 2: Payment Requests quick action */}
        <TouchableOpacity
          style={[styles.paymentRequestsBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('PaymentRequests')}
        >
          <View style={styles.paymentRequestsBtnLeft}>
            <View style={[styles.paymentRequestsIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Icon name="receipt-long" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.paymentRequestsTitle}>Payment Requests</Text>
              <Text style={styles.paymentRequestsSub}>View & manage your invoices</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Requests</Text>
          {bookings.filter(b => ['pending', 'accepted', 'in_progress'].includes(b.status)).slice(0, 6).map((b) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => navigation.navigate('BookingDetail', { id: b.id })}
              style={[styles.requestRow, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.requestIcon, { backgroundColor: 'rgba(37,99,235,0.15)' }]}>
                <Icon name="home-repair-service" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.requestTitle, { color: colors.text }]}>{(b.service_type || 'Service').toString().toUpperCase()}</Text>
                <Text style={[styles.requestSub, { color: colors.textSecondary }]}>{b.address || b.homeowner_name}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: colors.border }]}>
                <Text style={[styles.statusPillText, { color: colors.text }]}>{b.status.replace('_', ' ')}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
          {bookings.length === 0 && !loading && (
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No requests yet. You’ll see new requests here.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  hello: { fontSize: 14 },
  name: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  availabilityRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availabilityText: { fontSize: 14, marginLeft: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  notificationBtn: { position: 'relative', padding: 4, marginRight: 10 },
  badgeContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  pillButton: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  pillText: { color: '#fff', marginLeft: 6, fontWeight: '600' },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12 },
  card: { width: '48%', margin: '1%', borderRadius: 14, padding: 14, borderWidth: 1 },
  cardIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardValue: { fontSize: 20, fontWeight: '800' },
  cardLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  requestIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestTitle: { fontWeight: '700' },
  requestSub: { fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginRight: 6 },
  statusPillText: { fontSize: 12, textTransform: 'capitalize' },
  paymentRequestsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 10, padding: 16, borderRadius: 18, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  paymentRequestsBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentRequestsIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  paymentRequestsTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  paymentRequestsSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
});
