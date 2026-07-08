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
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';

export default function BookingDetailScreen({ route, navigation }) {
  const { bookingId, showReview } = route.params || {};
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
   const [paying, setPaying] = useState(false);
  const [reviewing, setReviewing] = useState(!!showReview);
  // Hide 'pending' status if booking is paid
  const isPaid = booking?.status === 'paid';
   const [rating, setRating] = useState(5);
   const [comment, setComment] = useState('');
   const [submittingReview, setSubmittingReview] = useState(false);


  const handleSubmitReview = async () => {
    if (!rating) {
      Alert.alert('Review', 'Please select a rating');
      return;
    }
    setSubmittingReview(true);
    try {
      const response = await api.post(`/bookings/${bookingId}/review`, { rating, comment });
      if (response.data.success) {
        Alert.alert('Review', 'Review submitted!');
        setReviewing(false);
        fetchBookingDetails();
      } else {
        Alert.alert('Review', response.data.message || 'Failed to submit review');
      }
    } catch (error) {
      Alert.alert('Review', 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };
  // Show review form if booking is paid and not yet reviewed
  const showReviewForm = user?.user_type === 'homeowner' && (booking?.status === 'paid' || reviewing);
  // Render star rating input
  const renderStarRating = () => (
    <View style={{ flexDirection: 'row', marginVertical: 10 }}>
      {[1,2,3,4,5].map((star) => (
        <TouchableOpacity key={star} onPress={() => setRating(star)}>
          <Icon name={star <= rating ? 'star' : 'star-border'} size={32} color={star <= rating ? '#FFD700' : '#888'} />
        </TouchableOpacity>
      ))}
    </View>
  );

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
    // If paid, show only paid and completed
    const statuses = isPaid ? ['paid', 'completed'] : ['pending', 'accepted', 'in_progress', 'completed'];
    const currentStatusIndex = statuses.indexOf(booking.status);
    return (
      <View style={styles.timelineContainer}>
        {statuses.map((status, index) => (
          <View key={status} style={styles.timelineItem}>
            <View style={[styles.timelineDot, index <= currentStatusIndex && { backgroundColor: colors.primary }]} />
            <Text style={[styles.timelineText, index <= currentStatusIndex && { color: colors.primary, fontWeight: 'bold' }]}>
              {status.replace('_', ' ').toUpperCase()}
            </Text>
            {index < statuses.length - 1 && <View style={[styles.timelineConnector, index < currentStatusIndex && { backgroundColor: colors.primary }]} />}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
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
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{booking.service_type?.toUpperCase()} Service</Text>
            <Text style={styles.headerSubtitle}>{new Date(booking.booking_date).toLocaleDateString()}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Status</Text>
            {renderTimeline()}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailRow}>
              <Icon name="event" size={20} color={colors.primary} />
              <Text style={styles.detailText}>{new Date(booking.booking_date).toLocaleString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Icon name="location-on" size={20} color={colors.primary} />
              <Text style={styles.detailText}>{booking.address}</Text>
            </View>
            {booking.estimated_price && (
              <View style={styles.detailRow}>
                <Icon name="attach-money" size={20} color={colors.primary} />
                <Text style={styles.detailText}>${booking.estimated_price}</Text>
              </View>
            )}
          </View>

          {user?.user_type === 'homeowner' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Worker</Text>
              <Text style={styles.detailText}>{booking.worker_name}</Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client</Text>
              <Text style={styles.detailText}>{booking.homeowner_name}</Text>
            </View>
          )}

          {booking.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.detailText}>{booking.description}</Text>
            </View>
          )}

          <View style={styles.actions}>
            {/* Homeowner: Review option is available immediately after booking is paid */}
            {/* Homeowner: Show review form after payment */}
            {showReviewForm && !reviewing && (
              <TouchableOpacity style={[styles.button, styles.completeButton]} onPress={() => setReviewing(true)}>
                <Text style={styles.buttonText}>Leave Review</Text>
              </TouchableOpacity>
            )}
            {showReviewForm && reviewing && (
              <View style={{ backgroundColor: '#222', borderRadius: 10, padding: 16, marginVertical: 10 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Leave a Review</Text>
                {renderStarRating()}
                <TextInput
                  style={{ backgroundColor: '#333', color: '#fff', borderRadius: 8, padding: 10, minHeight: 60, marginBottom: 10 }}
                  placeholder="Write a comment..."
                  placeholderTextColor="#aaa"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={handleSubmitReview} disabled={submittingReview}>
                  <Text style={styles.buttonText}>{submittingReview ? 'Submitting...' : 'Submit Review'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setReviewing(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
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
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => updateBookingStatus('completed')}>
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
  </View>
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