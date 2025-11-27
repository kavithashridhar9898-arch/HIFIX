import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';

export default function WorkerDashboardScreen({ navigation }) {
  const { user } = useAuth();
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

  const AnimatedBackground = () => {
    // Soft blobs + floating diamonds
    const blobCount = 3;
    const blobs = useRef([...Array(blobCount)].map(() => ({
      x: new Animated.Value(Math.random() * 100),
      y: new Animated.Value(Math.random() * 100),
      scale: new Animated.Value(0.8 + Math.random() * 0.6),
      hue: 180 + Math.random() * 120,
      size: 200 + Math.random() * 140,
    })) ).current;

    const shapeCount = 14;
    const shapes = useRef([...Array(shapeCount)].map(() => ({
      anim: new Animated.Value(0),
      left: Math.random() * 100,
      delay: Math.random() * 3000,
      duration: 6000 + Math.random() * 6000,
      size: 12 + Math.random() * 20,
      hue: 160 + Math.random() * 160,
      rotateFrom: Math.random() * 180,
      drift: (Math.random() - 0.5) * 80,
    })) ).current;

    useEffect(() => {
      blobs.forEach((b) => {
        const loop = () => {
          Animated.parallel([
            Animated.timing(b.x, { toValue: Math.random() * 100, duration: 7000, useNativeDriver: false }),
            Animated.timing(b.y, { toValue: Math.random() * 100, duration: 7000, useNativeDriver: false }),
            Animated.sequence([
              Animated.timing(b.scale, { toValue: 1.2, duration: 3000, useNativeDriver: false }),
              Animated.timing(b.scale, { toValue: 0.9, duration: 3000, useNativeDriver: false }),
            ]),
          ]).start(() => loop());
        };
        loop();
      });
      shapes.forEach((s) => {
        Animated.loop(
          Animated.timing(s.anim, { toValue: 1, duration: s.duration, delay: s.delay, useNativeDriver: true })
        ).start();
      });
    }, []);

    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {blobs.map((b, i) => (
          <Animated.View
            key={`blob-${i}`}
            style={{
              position: 'absolute',
              width: b.size,
              height: b.size,
              borderRadius: 999,
              backgroundColor: `hsla(${b.hue}, 90%, 60%, 0.15)`,
              shadowColor: `hsl(${b.hue}, 90%, 60%)`,
              shadowOpacity: 0.8,
              shadowRadius: 30,
              transform: [
                { translateX: b.x.interpolate({ inputRange: [0, 100], outputRange: [ -50, 350 ] }) },
                { translateY: b.y.interpolate({ inputRange: [0, 100], outputRange: [ -50, 650 ] }) },
                { scale: b.scale },
              ],
            }}
          />
        ))}
        {shapes.map((s, i) => {
          const translateY = s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });
          const translateX = s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, s.drift] });
          const rotate = s.anim.interpolate({ inputRange: [0, 1], outputRange: [`${s.rotateFrom}deg`, `${s.rotateFrom + 360}deg`] });
          const opacity = s.anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.8, 0.8, 0] });
          return (
            <Animated.View
              key={`shape-${i}`}
              style={{
                position: 'absolute',
                top: -40,
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                opacity,
                backgroundColor: `hsla(${s.hue}, 80%, 60%, 0.25)`,
                borderRadius: 6,
                transform: [{ translateY }, { translateX }, { rotate }],
              }}
            />
          );
        })}
      </View>
    );
  };

  const cards = [
    { key: 'pending', label: 'Pending', icon: 'hourglass-empty', color: '#FFB74D', value: stats.pending },
    { key: 'accepted', label: 'Accepted', icon: 'task-alt', color: '#64B5F6', value: stats.accepted },
    { key: 'in_progress', label: 'In Progress', icon: 'build', color: '#81C784', value: stats.in_progress },
    { key: 'completed', label: 'Completed', icon: 'check-circle', color: '#9575CD', value: stats.completed },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Animated.View
          style={[styles.header, {
            backgroundColor: headerAnim.interpolate({ inputRange: [0, 1], outputRange: ['#121212', '#1A1A1A'] }),
            borderBottomColor: headerAnim.interpolate({ inputRange: [0, 1], outputRange: ['#222', '#333'] }),
          }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.hello}>Welcome back</Text>
              <Text style={styles.name}>{user?.name || 'Worker'}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Jobs')} style={styles.pillButton}>
              <Icon name="list-alt" size={18} color="#fff" />
              <Text style={styles.pillText}>View Jobs</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.availabilityRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusDot, { backgroundColor: availability === 'available' ? '#2ecc71' : '#f1c40f' }]} />
              <Text style={styles.availabilityText}>{availability === 'available' ? 'Available' : 'Busy'}</Text>
            </View>
            <Switch
              value={availability === 'available'}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#555', true: '#6ab7ff' }}
              thumbColor={availability === 'available' ? '#4285F4' : '#ccc'}
            />
          </View>
        </Animated.View>

        <View style={styles.cardsGrid}>
          {cards.map((c) => (
            <View key={c.key} style={[styles.card, { borderColor: `${c.color}55` }] }>
              <View style={[styles.cardIcon, { backgroundColor: `${c.color}33` }]}>
                <Icon name={c.icon} size={22} color={c.color} />
              </View>
              <Text style={[styles.cardValue, { color: '#fff' }]}>{c.value}</Text>
              <Text style={[styles.cardLabel, { color: '#bbb' }]}>{c.label}</Text>
            </View>
          ))}
          <View style={[styles.card, { borderColor: '#4db6ac55' }] }>
            <View style={[styles.cardIcon, { backgroundColor: '#4db6ac33' }]}>
              <Icon name="attach-money" size={22} color="#4DB6AC" />
            </View>
            <Text style={[styles.cardValue, { color: '#fff' }]}>${stats.earnings.toFixed(0)}</Text>
            <Text style={[styles.cardLabel, { color: '#bbb' }]}>Earnings</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <Text style={styles.sectionTitle}>Recent Requests</Text>
          {bookings.filter(b => ['pending', 'accepted', 'in_progress'].includes(b.status)).slice(0, 6).map((b) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => navigation.navigate('BookingDetail', { id: b.id })}
              style={styles.requestRow}
            >
              <View style={[styles.requestIcon, { backgroundColor: 'rgba(66,133,244,0.2)' }]}>
                <Icon name="home-repair-service" size={18} color="#4285F4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>{(b.service_type || 'Service').toString().toUpperCase()}</Text>
                <Text style={styles.requestSub}>{b.address || b.homeowner_name}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{b.status.replace('_', ' ')}</Text>
              </View>
              <Icon name="chevron-right" size={22} color="#888" />
            </TouchableOpacity>
          ))}
          {bookings.length === 0 && !loading && (
            <Text style={{ color: '#888', marginTop: 8 }}>No requests yet. You’ll see new requests here.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  hello: { color: '#9aa0a6', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  availabilityRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availabilityText: { color: '#ddd', fontSize: 14, marginLeft: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  pillButton: { flexDirection: 'row', backgroundColor: '#243b55', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  pillText: { color: '#fff', marginLeft: 6, fontWeight: '600' },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12 },
  card: { width: '48%', margin: '1%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1 },
  cardIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardValue: { fontSize: 20, fontWeight: '800' },
  cardLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomColor: '#222', borderBottomWidth: 1 },
  requestIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestTitle: { color: '#fff', fontWeight: '700' },
  requestSub: { color: '#9aa0a6', fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999, marginRight: 6 },
  statusPillText: { color: '#ddd', fontSize: 12, textTransform: 'capitalize' },
});
