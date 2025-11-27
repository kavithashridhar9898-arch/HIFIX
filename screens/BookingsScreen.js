import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuroraBackground from '../components/AuroraBackground';

export default function BookingsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (route?.params?.highlightBookingId) {
      fetchBookings();
      navigation.setParams({ highlightBookingId: null });
    }
  }, [route?.params?.highlightBookingId]);

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

  const formatPaymentMethod = (method) => {
    const normalized = (method || '').toLowerCase();
    switch (normalized) {
      case 'mock':
        return 'Mock Wallet';
      case 'upi':
        return 'UPI';
      case 'cash':
        return 'Cash';
      default:
        return 'Not Specified';
    }
  };

  const renderStarIcons = (value = 0, size = 16) => {
    const ratingValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    return (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((index) => (
          <Icon
            key={index}
            name={index <= ratingValue ? 'star' : 'star-border'}
            size={size}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  const renderInteractiveStars = () => (
    <View style={styles.interactiveStarRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <TouchableOpacity
          key={value}
          onPress={() => setReviewRating(value)}
          activeOpacity={0.7}
        >
          <Icon
            name={value <= reviewRating ? 'star' : 'star-border'}
            size={32}
            color="#FFD700"
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const openReviewModal = (booking) => {
    setSelectedBooking(booking);
    setReviewRating(Number.isFinite(Number(booking.review_rating)) ? Number(booking.review_rating) : 5);
    setReviewComment(booking.review_comment || '');
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedBooking(null);
    setReviewComment('');
    setReviewRating(5);
  };

  const submitReview = async () => {
    if (!selectedBooking) {
      return;
    }

    try {
      setSubmittingReview(true);
      await api.post(`/bookings/${selectedBooking.id}/review`, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      setBookings((prev) => prev.map((booking) => (
        booking.id === selectedBooking.id
          ? {
              ...booking,
              review_rating: reviewRating,
              review_comment: reviewComment.trim(),
              review_created_at: new Date().toISOString(),
            }
          : booking
      )));

      Alert.alert('Thank you', 'Your feedback has been submitted.');
      closeReviewModal();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderBookingItem = ({ item, index }) => {
    const statusStyle = getStatusStyle(item.status);
    const inputRange = [-1, 0, 150 * index, 150 * (index + 2)];
    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [1, 1, 1, 0.8],
    });
    const opacity = scrollY.interpolate({
      inputRange: [-1, 0, 150 * index, 150 * (index + 0.5)],
      outputRange: [1, 1, 1, 0.5],
    });

    return (
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <TouchableOpacity
          style={styles.bookingCard}
          onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
        >
          <View style={styles.bookingHeader}>
            <Icon name={statusStyle.icon} size={24} color={statusStyle.color} />
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.serviceType}>{String(item.service_type?.toUpperCase() || 'SERVICE')}</Text>
          <Text style={styles.bookingDate}>{String(formatDate(item.booking_date))}</Text>
          
          <View style={styles.divider} />

          <View style={styles.bookingDetails}>
            {user.user_type === 'homeowner' && item.worker_name && (
              <View style={styles.detailRow}>
                <Icon name="person-outline" size={18} color="#ccc" />
                <Text style={styles.detailText}>Worker: {item.worker_name}</Text>
              </View>
            )}
            {user.user_type === 'worker' && item.homeowner_name && (
              <View style={styles.detailRow}>
                <Icon name="person-outline" size={18} color="#ccc" />
                <Text style={styles.detailText}>Client: {item.homeowner_name}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Icon name="location-on" size={18} color="#ccc" />
              <Text style={styles.detailText} numberOfLines={1}>{String(item.address || '')}</Text>
            </View>
            {item.estimated_price && (
              <View style={styles.detailRow}>
                <Icon name="monetization-on" size={18} color="#ccc" />
                <Text style={styles.detailText}>
                  Estimate: Rs.{Number.isFinite(Number(item.estimated_price)) ? Number(item.estimated_price).toFixed(2) : item.estimated_price}
                </Text>
              </View>
            )}
          </View>

          {item.status === 'completed' && (
            <View style={styles.completedSection}>
              <View style={styles.completedBadge}>
                <Icon name="verified" size={18} color="#4CAF50" />
                <Text style={styles.completedText}>Work Completed</Text>
              </View>

              {item.review_rating ? (
                <View style={styles.reviewSummary}>
                  {renderStarIcons(item.review_rating)}
                  {item.review_comment ? (
                    <Text style={styles.reviewComment} numberOfLines={2}>
                      "{item.review_comment}"
                    </Text>
                  ) : null}
                </View>
              ) : (
                user.user_type === 'homeowner' ? (
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={() => openReviewModal(item)}
                  >
                    <Icon name="star-rate" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.rateButtonText}>Leave Feedback</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.pendingFeedbackText}>Awaiting homeowner feedback</Text>
                )
              )}

              {item.payment_status === 'paid' && (
                <Text style={styles.paymentSummary}>
                  {Number.isFinite(Number(item.payment_amount))
                    ? `Paid Rs.${Number(item.payment_amount).toFixed(2)}`
                    : 'Payment confirmed'} via {formatPaymentMethod(item.payment_method)}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Fetching your bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground />
      <Animated.FlatList
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListHeaderComponent={
          <Text style={styles.screenTitle}>Your Bookings</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="calendar-today" size={80} color="#444" />
            <Text style={styles.emptyText}>No bookings found.</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4285F4"
            colors={['#4285F4', '#34A853', '#FBBC05', '#EA4335']}
          />
        }
      />

        <Modal
          visible={showReviewModal}
          transparent
          animationType="slide"
          onRequestClose={closeReviewModal}
        >
          <View style={styles.reviewModalOverlay}>
            <View style={styles.reviewModalContent}>
              <View style={styles.reviewModalHeader}>
                <Text style={styles.reviewModalTitle}>
                  {selectedBooking?.worker_name ? `Rate ${selectedBooking.worker_name}` : 'Share Your Feedback'}
                </Text>
                <TouchableOpacity onPress={closeReviewModal}>
                  <Icon name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {renderInteractiveStars()}

              <TextInput
                style={styles.reviewInput}
                placeholder="Leave a short note for the worker..."
                placeholderTextColor="#aaa"
                multiline
                numberOfLines={4}
                value={reviewComment}
                onChangeText={setReviewComment}
              />

              <TouchableOpacity
                style={styles.submitReviewButton}
                onPress={submitReview}
                disabled={submittingReview}
                activeOpacity={0.8}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitReviewButtonText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
}

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
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
  completedSection: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1a2a1f',
    borderWidth: 1,
    borderColor: '#2e5d3a',
    gap: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    color: '#b8f5c8',
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewSummary: {
    gap: 8,
  },
  reviewComment: {
    color: '#cfd8dc',
    fontStyle: 'italic',
    fontSize: 14,
  },
  paymentSummary: {
    color: '#8bc34a',
    fontSize: 13,
    fontWeight: '600',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FF9800',
  },
  rateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  pendingFeedbackText: {
    color: '#9e9e9e',
    fontSize: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  interactiveStarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 20,
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
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E1E1E',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2F2F2F',
  },
  reviewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    minHeight: 110,
    textAlignVertical: 'top',
    fontSize: 15,
    backgroundColor: '#121212',
  },
  submitReviewButton: {
    marginTop: 16,
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitReviewButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});