import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Animated, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

export default function BookingDetailScreen({ route, navigation }) {
  const { bookingId, showReview } = route.params || {};
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const [booking, setBooking] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [reviewing, setReviewing] = useState(!!showReview);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      if (response.data.success) {
        setBooking(response.data.booking);

        // Fetch associated invoice for this specific booking
        try {
          const invRes = await api.get(`/invoice/booking/${bookingId}`);
          if (invRes.data.success && invRes.data.data.invoice) {
            setInvoice(invRes.data.data.invoice);
          }
        } catch (_) {}

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
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
      Alert.alert('Success', `Booking status updated to ${status.toUpperCase()}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update booking status');
    }
  };

  const handleSubmitReview = async () => {
    if (!rating) {
      Alert.alert('Review', 'Please select a rating');
      return;
    }
    setSubmittingReview(true);
    try {
      const response = await api.post(`/bookings/${bookingId}/review`, { rating, comment });
      if (response.data.success) {
        Alert.alert('Success', 'Review submitted successfully!');
        setReviewing(false);
        fetchBookingDetails();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to submit review');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStarRating = () => (
    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => setRating(star)}>
          <Icon name={star <= rating ? 'star' : 'star-border'} size={36} color={star <= rating ? '#F59E0B' : colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) return null;

  const isWorker = user?.user_type === 'worker';
  const isPaid = booking.status === 'paid';
  const statuses = isPaid ? ['accepted', 'in_progress', 'completed', 'paid'] : ['pending', 'accepted', 'in_progress', 'completed'];
  const currentIdx = statuses.indexOf(booking.status);

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Booking #{booking.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={[styles.statusBadgeText, { color: colors.primary }]}>{booking.status.toUpperCase()}</Text>
          </View>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Service Title Card */}
            <View style={[styles.card, glassStyle]}>
              <View style={styles.titleRow}>
                <View style={[styles.serviceIcon, { backgroundColor: colors.primary }]}>
                  <Icon name="build" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceTitle, { color: colors.text }]}>{(booking.service_type || 'Service').toUpperCase()}</Text>
                  <Text style={[styles.bookingDateText, { color: colors.textSecondary }]}>
                    {new Date(booking.booking_date).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Timeline Progress Card */}
            <View style={[styles.card, glassStyle]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Job Status Timeline</Text>
              <View style={styles.timelineRow}>
                {statuses.map((st, idx) => {
                  const active = idx <= currentIdx;
                  return (
                    <View key={st} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: active ? colors.primary : `${colors.textSecondary}40` }]}>
                        {active && <Icon name="check" size={12} color="#FFF" />}
                      </View>
                      <Text style={[styles.timelineText, { color: active ? colors.text : colors.textSecondary }]}>
                        {st.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Counterparty Info Card */}
            <View style={[styles.card, glassStyle]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isWorker ? '👤 Customer Details' : '🛠️ Assigned Worker'}
              </Text>
              <Text style={[styles.infoName, { color: colors.text }]}>
                {isWorker ? booking.homeowner_name : booking.worker_name || 'Assigned Professional'}
              </Text>
              <View style={styles.infoRow}>
                <Icon name="location-on" size={18} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>{booking.address || 'Address provided upon acceptance'}</Text>
              </View>
              {booking.estimated_price && (
                <View style={styles.infoRow}>
                  <Icon name="payments" size={18} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>Estimated: {formatINRExact(booking.estimated_price)}</Text>
                </View>
              )}
            </View>

            {/* Job Description */}
            {booking.description && (
              <View style={[styles.card, glassStyle]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📝 Job Description</Text>
                <Text style={[styles.descText, { color: colors.textSecondary }]}>{booking.description}</Text>
              </View>
            )}

            {/* Associated Invoice Card */}
            {invoice ? (
              <View style={[styles.card, glassStyle, { borderColor: colors.primary }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>🧾 Payment Invoice</Text>
                  <Text style={[styles.invoiceStatus, { color: colors.primary }]}>{invoice.status.toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.primary, marginVertical: 4 }}>
                  {formatINRExact(invoice.grand_total)}
                </Text>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
                  onPress={() => navigation.navigate('InvoiceView', { invoiceId: invoice.id })}
                >
                  <Text style={styles.smallBtnText}>View Full Invoice</Text>
                </TouchableOpacity>
              </View>
            ) : (
              ['accepted', 'in_progress', 'completed'].includes(booking.status) && (
                <View style={[styles.card, glassStyle, { borderStyle: 'dashed' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="info-outline" size={20} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
                      {isWorker
                        ? 'No invoice generated yet. Tap "Work Timer & Invoice Builder" below to complete work and send an invoice.'
                        : 'No invoice issued yet. The worker will generate an invoice after completing the job.'}
                    </Text>
                  </View>
                </View>
              )
            )}

            {/* Action Buttons */}
            <View style={{ gap: 12, marginTop: 12 }}>
              {/* Worker Timer CTA */}
              {isWorker && ['accepted', 'in_progress'].includes(booking.status) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => navigation.navigate('WorkTimer', { bookingId: booking.id })}
                >
                  <Icon name="timer" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Work Timer & Invoice Builder</Text>
                </TouchableOpacity>
              )}

              {/* Worker Status Updates */}
              {isWorker && booking.status === 'pending' && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => updateBookingStatus('accepted')}>
                  <Text style={styles.actionBtnText}>Accept Booking</Text>
                </TouchableOpacity>
              )}

              {isWorker && booking.status === 'accepted' && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => updateBookingStatus('in_progress')}>
                  <Text style={styles.actionBtnText}>Start Work Session</Text>
                </TouchableOpacity>
              )}

              {/* Homeowner Pay Now Shortcut */}
              {!isWorker && invoice && invoice.status === 'accepted' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => navigation.navigate('Payment', { invoiceId: invoice.id, amount: invoice.grand_total })}
                >
                  <Icon name="payment" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Pay Now ₹{invoice.grand_total}</Text>
                </TouchableOpacity>
              )}

              {/* Homeowner View Receipt */}
              {!isWorker && isPaid && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => navigation.navigate('Receipt', { invoiceId: invoice?.id || booking.id })}
                >
                  <Icon name="receipt" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>View Digital Receipt</Text>
                </TouchableOpacity>
              )}

              {/* View Certificate & Blockchain Proof */}
              {['accepted', 'in_progress', 'completed', 'paid'].includes(booking.status) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#8247E5' }]}
                  onPress={() => navigation.navigate('CertificateVerification', { bookingId: booking.id })}
                >
                  <Icon name="verified-user" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Digital Certificate & Blockchain</Text>
                </TouchableOpacity>
              )}

              {/* Review CTA */}
              {!isWorker && isPaid && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={() => setReviewing(true)}
                >
                  <Icon name="star" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Leave Review for Worker</Text>
                </TouchableOpacity>
              )}

              {/* Cancel Button */}
              {['pending', 'accepted'].includes(booking.status) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#EF4444' }]}
                  onPress={() => updateBookingStatus('cancelled')}
                >
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel Booking</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Review Form Modal Box */}
            {reviewing && (
              <View style={[styles.card, glassStyle, { marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Rate Your Service</Text>
                {renderStarRating()}
                <TextInput
                  style={[styles.reviewInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Share details about the work quality..."
                  placeholderTextColor={colors.textSecondary}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.smallBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => setReviewing(false)}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, { flex: 2, backgroundColor: colors.primary }]}
                    onPress={handleSubmitReview}
                    disabled={submittingReview}
                  >
                    <Text style={styles.smallBtnText}>{submittingReview ? 'Submitting...' : 'Submit Review'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  card: { borderRadius: 20, padding: 16, marginBottom: 14, elevation: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  serviceTitle: { fontSize: 18, fontWeight: '900' },
  bookingDateText: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineItem: { alignItems: 'center', flex: 1 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  timelineText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  infoName: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  infoText: { fontSize: 14 },
  descText: { fontSize: 14, lineHeight: 22 },
  invoiceStatus: { fontSize: 12, fontWeight: '800' },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  smallBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  actionBtn: { height: 52, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 3 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  reviewInput: { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 80, fontSize: 14 },
});