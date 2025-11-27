import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function BookingDetailScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      if (response.data.success) {
        setBooking(response.data.booking);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load booking details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (status) => {
    try {
      await api.put(`/bookings/${bookingId}/status`, { status });
      fetchBookingDetails();
      Alert.alert('Success', 'Booking status updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update booking status');
    }
  };

  const renderTimeline = () => {
    const statuses = ['pending', 'accepted', 'in_progress', 'completed'];
    const currentStatusIndex = statuses.indexOf(booking.status);

    return (
      <View style={styles.timelineContainer}>
        {statuses.map((status, index) => (
          <View key={status} style={styles.timelineItem}>
            <View style={[styles.timelineDot, index <= currentStatusIndex && styles.timelineDotActive]} />
            <Text style={[styles.timelineText, index <= currentStatusIndex && styles.timelineTextActive]}>
              {status.replace('_', ' ').toUpperCase()}
            </Text>
            {index < statuses.length - 1 && <View style={[styles.timelineConnector, index < currentStatusIndex && styles.timelineConnectorActive]} />}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Booking not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{booking.service_type?.toUpperCase()} Service</Text>
            <Text style={styles.headerSubtitle}>{String(new Date(booking.booking_date).toLocaleDateString())}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Status</Text>
            {renderTimeline()}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailRow}>
              <Icon name="event" size={20} color="#4285F4" />
              <Text style={styles.detailText}>{String(new Date(booking.booking_date).toLocaleString())}</Text>
            </View>
            <View style={styles.detailRow}>
              <Icon name="location-on" size={20} color="#4285F4" />
              <Text style={styles.detailText}>{String(booking.address || '')}</Text>
            </View>
            {booking.estimated_price && (
              <View style={styles.detailRow}>
                <Icon name="attach-money" size={20} color="#4285F4" />
                <Text style={styles.detailText}>${booking.estimated_price}</Text>
              </View>
            )}
          </View>

          {user?.user_type === 'homeowner' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Worker</Text>
              <Text style={styles.detailText}>{String(booking.worker_name || '')}</Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client</Text>
              <Text style={styles.detailText}>{String(booking.homeowner_name || '')}</Text>
            </View>
          )}

          {booking.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.detailText}>{String(booking.description || '')}</Text>
            </View>
          )}

          <View style={styles.actions}>
            {user?.user_type === 'worker' && booking.status === 'pending' && (
              <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={() => updateBookingStatus('accepted')}>
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
            )}
            {user?.user_type === 'worker' && booking.status === 'accepted' && (
              <TouchableOpacity style={[styles.button, styles.startButton]} onPress={() => updateBookingStatus('in_progress')}>
                <Text style={styles.buttonText}>Start Job</Text>
              </TouchableOpacity>
            )}
            {user?.user_type === 'worker' && booking.status === 'in_progress' && (
              <TouchableOpacity style={[styles.button, styles.completeButton]} onPress={() => updateBookingStatus('completed')}>
                <Text style={styles.buttonText}>Complete Job</Text>
              </TouchableOpacity>
            )}
            {(booking.status === 'pending' || booking.status === 'accepted') && (
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => updateBookingStatus('cancelled')}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        backgroundColor: '#1E1E1E',
        padding: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#888',
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    detailText: {
        fontSize: 16,
        color: '#ccc',
        marginLeft: 10,
    },
    timelineContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    timelineItem: {
        alignItems: 'center',
        flex: 1,
    },
    timelineDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#555',
    },
    timelineDotActive: {
        backgroundColor: '#4285F4',
    },
    timelineText: {
        fontSize: 10,
        color: '#888',
        marginTop: 5,
    },
    timelineTextActive: {
        color: '#4285F4',
        fontWeight: 'bold',
    },
    timelineConnector: {
        position: 'absolute',
        top: 7,
        left: '50%',
        right: '-50%',
        height: 2,
        backgroundColor: '#555',
    },
    timelineConnectorActive: {
        backgroundColor: '#4285F4',
    },
    actions: {
        padding: 20,
    },
    button: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    acceptButton: { backgroundColor: '#4CAF50' },
    startButton: { backgroundColor: '#FFC107' },
    completeButton: { backgroundColor: '#4285F4' },
    cancelButton: { backgroundColor: '#F44336' },
    errorText: {
        color: '#fff',
        textAlign: 'center',
        marginTop: 50,
    },
});