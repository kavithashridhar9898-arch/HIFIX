import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { useTabAnimation } from '../context/TabAnimationContext';

const BookingsScreen = React.memo(function BookingsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const { handleScroll } = useTabAnimation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings');
      if (response.data.success) {
        setBookings(response.data.bookings);
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

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return { color: '#FFA500', icon: 'hourglass-empty' };
      case 'accepted': return { color: '#4285F4', icon: 'check-circle' };
      case 'in_progress': return { color: '#9C27B0', icon: 'build' };
      case 'completed': return { color: '#4CAF50', icon: 'verified' };
      case 'cancelled': return { color: '#F44336', icon: 'cancel' };
      default: return { color: '#888', icon: 'help' };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderBookingItem = useCallback(({ item }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <Animated.View>
          <TouchableOpacity
          style={[styles.bookingCard, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.85)', 
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)' 
          }]}
          onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
        >
          <View style={styles.bookingHeader}>
            <Icon name={statusStyle.icon} size={24} color={statusStyle.color} />
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.serviceType, { color: '#000000' }]}>{item.service_type?.toUpperCase() || 'SERVICE'}</Text>
          <Text style={[styles.bookingDate, { color: 'rgba(0,0,0,0.6)' }]}>{formatDate(item.booking_date)}</Text>
          
          <View style={[styles.divider, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />

          <View style={styles.bookingDetails}>
            {user.user_type === 'homeowner' && item.worker_name && (
              <View style={styles.detailRow}>
                <Icon name="person-outline" size={18} color="#005bb5" />
                <Text style={[styles.detailText, { color: '#000000' }]}>Worker: {item.worker_name}</Text>
              </View>
            )}
            {user.user_type === 'worker' && item.homeowner_name && (
              <View style={styles.detailRow}>
                <Icon name="person-outline" size={18} color="#005bb5" />
                <Text style={[styles.detailText, { color: '#000000' }]}>Client: {item.homeowner_name}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Icon name="location-on" size={18} color="#005bb5" />
              <Text style={[styles.detailText, { color: '#000000' }]} numberOfLines={1}>{item.address}</Text>
            </View>
            {item.estimated_price && (
              <View style={styles.detailRow}>
                <Icon name="monetization-on" size={18} color="#005bb5" />
                <Text style={[styles.detailText, { color: '#000000' }]}>Estimate: ${item.estimated_price}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [navigation, user]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching your bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Animated.FlatList
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[styles.listContent, { paddingBottom: 140 }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={false}
        ListHeaderComponent={<Text style={[styles.screenTitle, { color: '#FFFFFF' }]}>Your Bookings</Text>}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="calendar-today" size={80} color="rgba(255,255,255,0.2)" />
            <Text style={[styles.emptyText, { color: '#FFFFFF' }]}>No bookings found.</Text>
            <Text style={[styles.emptySubtext, { color: 'rgba(255,255,255,0.6)' }]}>Pull down to refresh.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, '#34A853', '#FBBC05', '#EA4335']}
          />
        }
      />
    </SafeAreaView>
  </View>
  );
});

export default BookingsScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#888',
  },
  listContent: {
    padding: 20,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  bookingCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  serviceType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  bookingDate: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginBottom: 15,
  },
  bookingDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#ddd',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});