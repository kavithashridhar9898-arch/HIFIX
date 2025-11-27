import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuroraBackground from '../components/AuroraBackground';

const { width, height } = Dimensions.get('window');

export default function WorkerDetailScreen({ route, navigation }) {
  const { workerId } = route.params || {};
  const { user } = useAuth();
  const { colors } = useTheme();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    description: '',
    date: new Date().toISOString().split('T')[0],
    estimatedHours: 1,
  });
  const [offerAmount, setOfferAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Check if workerId is provided
  useEffect(() => {
    if (!workerId) {
      Alert.alert('Error', 'Worker ID not provided');
      navigation.goBack();
      return;
    }
    console.log('Worker ID from params:', workerId);
  }, [workerId]);

  // Helper to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  };

  useEffect(() => {
    if (workerId) {
      fetchWorkerDetails();
    }
  }, [workerId]);

  const fetchWorkerDetails = async () => {
    try {
      console.log('Fetching worker details for ID:', workerId);
      const response = await api.get(`/workers/${workerId}`);
      console.log('Worker details response:', response.data);
      
      if (response.data.success) {
        setWorker(response.data.worker);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to load worker details');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Worker details error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load worker details';
      Alert.alert('Error', errorMessage);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleRequestService = () => {
    navigation.navigate('ServiceRequest', { worker });
  };

  const handleBookNow = () => {
    setShowBookingModal(true);
  };

  const handleOpenChat = async () => {
    // Open in-app DM chat with this worker
    try {
      if (!worker?.userId) {
        Alert.alert('Error', 'Worker account not linked');
        return;
      }
      setMessageLoading(true);
      const res = await api.get(`/chat/conversation/${worker.userId}`);
      setMessageLoading(false);
      if (res.data?.success && res.data.conversation) {
        navigation.navigate('Chat', {
          conversationId: res.data.conversation.id,
          otherUserId: worker.userId,
          otherUserName: worker.name,
          otherUserAvatar: worker.profileImage,
          otherUserPhone: worker.phone,
        });
      } else {
        Alert.alert('Error', 'Unable to open chat');
      }
    } catch (e) {
      setMessageLoading(false);
      Alert.alert('Error', e?.response?.data?.message || 'Failed to open chat');
    }
  };

  const handleMessageWorker = async () => {
    try {
      if (!worker?.userId) {
        Alert.alert('Error', 'Worker account not linked');
        return;
      }
      // Get or create a conversation with this worker
      const res = await api.get(`/chat/conversation/${worker.userId}`);
      if (res.data?.success && res.data.conversation) {
        const convo = res.data.conversation;
        navigation.navigate('Chat', {
          conversationId: convo.id,
          otherUserId: worker.userId,
          otherUserName: worker.name,
          otherUserAvatar: worker.profileImage,
          otherUserPhone: worker.phone,
        });
      } else {
        Alert.alert('Error', 'Unable to start conversation');
      }
    } catch (e) {
      console.error('Start conversation error:', e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.message || 'Failed to open chat');
    }
  };

  // removed WhatsApp/SMS fallback; in-app DM is used

  const computeSuggestedAmount = () => {
    const rate = Number(worker?.hourlyRate || 0);
    const hours = Number(bookingDetails.estimatedHours || 1);
    const total = rate * hours;
    return Number.isFinite(total) ? total : 0;
  };

  const handleProceedToPayment = () => {
    if (!bookingDetails.description.trim()) {
      Alert.alert('Error', 'Please describe the service you need');
      return;
    }
    // Pre-fill offer amount from estimated calculation if empty
    const suggested = computeSuggestedAmount();
    const formatted = suggested > 0 ? suggested.toFixed(2) : '';
    setOfferAmount(prev => (prev && Number(prev) > 0 ? prev : String(formatted)));
    setShowBookingModal(false);
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
    if (!worker) {
      Alert.alert('Error', 'Worker information not loaded');
      return;
    }

    const amountNumber = Number(offerAmount);
    const amount = Number.isFinite(amountNumber) ? Math.max(amountNumber, 0) : 0;

    if (!upiId.trim()) {
      createBooking('pending_payment', 'cash', amount);
      return;
    }

    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(worker.name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Service Payment - ' + bookingDetails.description)}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (!supported) {
        Alert.alert(
          'UPI Not Available',
          'No UPI app found. Would you like to proceed with booking and pay after service?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed', onPress: () => createBooking('pending_payment', 'cash', amount) }
          ]
        );
        return;
      }

      await Linking.openURL(upiUrl);
      await createBooking('paid', 'upi', amount);
    } catch (error) {
      Alert.alert('Error', 'Unable to process payment');
    }
  };

  const handleMockPayment = async () => {
    if (!worker) {
      Alert.alert('Error', 'Worker information not loaded');
      return;
    }

    const amountNumber = Number(offerAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      Alert.alert('Error', 'Enter a valid amount to use mock payment');
      return;
    }

    await createBooking('paid', 'mock', amountNumber);
  };

  const createBooking = async (paymentStatus, paymentMethod = 'none', overrideAmount) => {
    if (!worker) {
      Alert.alert('Error', 'Worker information not loaded');
      return;
    }

    if (!bookingDetails.description.trim()) {
      Alert.alert('Error', 'Please describe the service you need');
      return;
    }

    const hoursValue = Number.isFinite(Number(bookingDetails.estimatedHours))
      ? Number(bookingDetails.estimatedHours)
      : 0;
    const estimatedTotal = computeSuggestedAmount();
    const amountToSend = Number.isFinite(Number(overrideAmount)) ? Number(overrideAmount) : estimatedTotal;

    try {
      setIsBookingSubmitting(true);
      const response = await api.post('/bookings/create', {
        workerId: worker.id,
        description: bookingDetails.description,
        bookingDate: bookingDetails.date,
        serviceType: worker.serviceType,
        estimatedHours: hoursValue,
        estimatedPrice: estimatedTotal,
        paymentStatus,
        paymentMethod,
        paymentAmount: paymentStatus === 'paid' ? amountToSend : null
      });

      if (response.data.success) {
        const successMessage = paymentStatus === 'paid'
          ? 'Payment successful! This job is now marked as completed.'
          : 'Booking created successfully. You can pay after the service.';
        setShowPaymentModal(false);
        setBookingDetails({ description: '', date: new Date().toISOString().split('T')[0], estimatedHours: 1 });
        setUpiId('');
        setOfferAmount('');
        Alert.alert('Success', successMessage);
        navigation.navigate('Bookings', { highlightBookingId: response.data.booking?.id });
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create booking');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= rating ? 'star' : 'star-border'}
          size={16}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!worker) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Worker not found</Text>
      </SafeAreaView>
    );
  }

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [250, 80],
    extrapolate: 'clamp',
  });

  const profileImageSize = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [120, 50],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground />
      {/* Back Button */}
      <TouchableOpacity 
        style={[styles.backButton, { backgroundColor: colors.surface }]} 
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Header with Profile Image */}
      <Animated.View style={[styles.header, { height: headerHeight, backgroundColor: colors.surface }]}>
        <Animated.Image
          source={{ uri: getImageUrl(worker.profileImage) || 'https://via.placeholder.com/150' }}
          style={[styles.profileImage, { 
            width: profileImageSize, 
            height: profileImageSize, 
            borderRadius: profileImageSize.interpolate({ inputRange: [50, 120], outputRange: [25, 60] }),
            borderColor: colors.primary
          }]}
        />
        <View style={styles.nameContainer}>
          <Text style={[styles.name, { color: colors.text }]}>{worker.name}</Text>
          {worker.verified && (
            <Icon name="verified" size={24} color={colors.primary} style={{ marginLeft: 10 }} />
          )}
        </View>
        <Text style={[styles.serviceTypeBadgeText, { color: colors.primary }]}>
          {worker.serviceType?.charAt(0).toUpperCase() + worker.serviceType?.slice(1)}
        </Text>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Stats Grid */}
          <View style={styles.infoGrid}>
            <LinearGradient
              colors={[`${colors.primary}20`, `${colors.primary}10`]}
              style={styles.infoBox}
            >
              <Icon name="star" size={28} color="#FFD700" />
              <Text style={[styles.infoText, { color: colors.text }]}>{worker.averageRating?.toFixed(1) || '0.0'}</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Rating</Text>
            </LinearGradient>
            <LinearGradient
              colors={['#4CAF5020', '#4CAF5010']}
              style={styles.infoBox}
            >
              <Icon name="work" size={28} color="#4CAF50" />
              <Text style={[styles.infoText, { color: colors.text }]}>{worker.totalJobs || 0}</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Jobs</Text>
            </LinearGradient>
            <LinearGradient
              colors={['#9C27B020', '#9C27B010']}
              style={styles.infoBox}
            >
              <Icon name="schedule" size={28} color="#9C27B0" />
              <Text style={[styles.infoText, { color: colors.text }]}>{worker.experienceYears || 0}y</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Experience</Text>
            </LinearGradient>
          </View>

          {/* Pricing Section */}
          <View style={styles.priceSection}>
            <LinearGradient
              colors={[`${colors.primary}15`, `${colors.surface}`]}
              style={styles.priceCard}
            >
              <Icon name="attach-money" size={32} color={colors.primary} />
              <View style={styles.priceInfo}>
                <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Hourly Rate</Text>
                <Text style={[styles.priceValue, { color: colors.text }]}>Rs.{worker.hourlyRate?.toFixed(2) || '0.00'}/hr</Text>
              </View>
            </LinearGradient>
            {worker.minCharge > 0 && (
              <LinearGradient
                colors={['#FF980020', '#FF980010']}
                style={styles.priceCard}
              >
                <Icon name="payments" size={32} color="#FF9800" />
                <View style={styles.priceInfo}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Minimum Charge</Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>Rs.{worker.minCharge?.toFixed(2) || '0.00'}</Text>
                </View>
              </LinearGradient>
            )}
          </View>

          {/* Contact Section */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Icon name="contact-phone" size={20} color={colors.primary} /> Contact Information
            </Text>
            {worker.phone && (
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={() => Linking.openURL(`tel:${worker.phone}`)}
              >
                <Icon name="phone" size={20} color={colors.primary} />
                <Text style={[styles.contactText, { color: colors.text }]}>{worker.phone}</Text>
              </TouchableOpacity>
            )}
            {worker.email && (
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={() => Linking.openURL(`mailto:${worker.email}`)}
              >
                <Icon name="email" size={20} color={colors.primary} />
                <Text style={[styles.contactText, { color: colors.text }]}>{worker.email}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Skills Section */}
          {worker.skills && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Icon name="build" size={20} color={colors.primary} /> Skills & Expertise
              </Text>
              <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{worker.skills}</Text>
            </View>
          )}

          {/* About Section */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Icon name="info" size={20} color={colors.primary} /> About
            </Text>
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
              {worker.bio || 'No bio available.'}
            </Text>
          </View>

          {/* Gallery */}
          {worker.gallery && worker.gallery.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Icon name="photo-library" size={20} color={colors.primary} /> Gallery
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                {worker.gallery.map((image, index) => (
                  <Image 
                    key={index} 
                    source={{ uri: getImageUrl(image.image_url) }} 
                    style={[styles.galleryImage, { borderColor: colors.border }]} 
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reviews Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Icon name="rate-review" size={20} color={colors.primary} /> Reviews ({worker.reviews?.length || 0})
            </Text>
            {worker.reviews && worker.reviews.length > 0 ? (
              worker.reviews.map((review) => (
                <View key={review.id} style={[styles.reviewItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      {review.reviewerImage ? (
                        <Image source={{ uri: getImageUrl(review.reviewerImage) }} style={styles.reviewerImage} />
                      ) : (
                        <View style={[styles.reviewerImagePlaceholder, { backgroundColor: `${colors.primary}20` }]}>
                          <Icon name="person" size={20} color={colors.primary} />
                        </View>
                      )}
                      <Text style={[styles.reviewerName, { color: colors.text }]}>{review.reviewerName || review.reviewer_name}</Text>
                    </View>
                    <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
                  </View>
                  <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>
                  <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                    {new Date(review.createdAt || review.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noReviews, { color: colors.textSecondary }]}>No reviews yet</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Book Service</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Service Description</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                placeholder="Describe the service you need..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                value={bookingDetails.description}
                onChangeText={(text) => setBookingDetails({...bookingDetails, description: text})}
              />

              <Text style={[styles.modalLabel, { color: colors.text }]}>Booking Date</Text>
              <TouchableOpacity 
                style={[styles.modalInput, { 
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }]}
                onPress={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setBookingDetails({...bookingDetails, date: today});
                }}
              >
                <Text style={{ color: bookingDetails.date ? colors.text : colors.textSecondary }}>
                  {bookingDetails.date || 'Select date'}
                </Text>
                <Icon name="calendar-today" size={20} color={colors.primary} />
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { color: colors.text }]}>Estimated Hours</Text>
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                placeholder="e.g., 2"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={bookingDetails.estimatedHours.toString()}
                onChangeText={(text) => setBookingDetails({...bookingDetails, estimatedHours: parseFloat(text) || 0})}
              />

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowBookingModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={handleProceedToPayment}
                >
                  <Text style={styles.confirmButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <LinearGradient
              colors={[`${colors.primary}20`, `${colors.primary}10`]}
              style={styles.totalAmountBox}
            >
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Estimated Total</Text>
              <Text style={[styles.totalAmount, { color: colors.text }]}>${(Number(offerAmount || 0)).toFixed(2)}</Text>
              <Text style={[styles.totalBreakdown, { color: colors.textSecondary }]}>
                ${worker.hourlyRate}/hr × {bookingDetails.estimatedHours} hours
              </Text>
            </LinearGradient>

            <Text style={[styles.modalLabel, { color: colors.text }]}>Offer Amount</Text>
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: colors.background, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="Enter amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={offerAmount}
              onChangeText={setOfferAmount}
            />

            <Text style={[styles.modalLabel, { color: colors.text }]}>UPI ID (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: colors.background, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="yourname@upi"
              placeholderTextColor={colors.textSecondary}
              value={upiId}
              onChangeText={setUpiId}
            />
            <Text style={[styles.paymentInfo, { color: colors.textSecondary }]}>
              <Icon name="info" size={14} color={colors.textSecondary} /> 
              {' '}You can pay now via UPI or choose to pay after service completion.
            </Text>

            <View style={styles.modalButtonStack}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.skipButton, styles.fullWidthButton, { borderColor: colors.border }]}
                onPress={() => createBooking('pending_payment', 'cash', Number(offerAmount))}
                disabled={isBookingSubmitting}
              >
                {isBookingSubmitting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Pay After Service</Text>
                )}
              </TouchableOpacity>

              <View style={styles.inlineButtonRow}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.mockPayButton]}
                  onPress={handleMockPayment}
                  disabled={isBookingSubmitting || !(Number(offerAmount) > 0)}
                >
                  {isBookingSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="account-balance-wallet" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmButtonText}>Mock Pay</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, styles.payButton, { backgroundColor: '#5F4BB6' }]}
                  onPress={handlePayment}
                  disabled={isBookingSubmitting || !upiId.trim() || !(Number(offerAmount) > 0)}
                >
                  {isBookingSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="payment" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmButtonText}>Pay with UPI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Book Now Button */}
      {user?.user_type === 'homeowner' && (
        <View style={[styles.floatingButtonContainer, { backgroundColor: colors.background }]}> 
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleOpenChat}
            >
              {messageLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Icon name="chat" size={22} color={colors.primary} />
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Message</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.bookButton, { backgroundColor: colors.primary }]}
              onPress={handleBookNow}
            >
              <Icon name="event" size={24} color="#fff" />
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  profileImage: {
    borderWidth: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  serviceTypeBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  infoBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  infoText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  priceSection: {
    marginBottom: 20,
    gap: 12,
  },
  priceCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  priceInfo: {
    marginLeft: 15,
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  contactText: {
    fontSize: 16,
  },
  galleryScroll: {
    marginTop: 10,
  },
  galleryImage: {
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
  },
  reviewItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewerImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerName: {
    fontWeight: '600',
    fontSize: 15,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
  },
  noReviews: {
    textAlign: 'center',
    fontSize: 15,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 5,
  },
  secondaryButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 20,
    padding: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
  },
  modalInput: {
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButtonStack: {
    marginTop: 20,
    gap: 12,
  },
  inlineButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidthButton: {
    alignSelf: 'stretch',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  payButton: {
    elevation: 3,
  },
  mockPayButton: {
    backgroundColor: '#6C63FF',
    elevation: 3,
  },
  workerInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    gap: 12,
  },
  workerAvatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  workerNameSmall: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  workerPhoneSmall: {
    fontSize: 14,
    marginTop: 2,
  },
  chatInfo: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  paymentInfo: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  totalAmountBox: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  totalBreakdown: {
    fontSize: 14,
  },
});