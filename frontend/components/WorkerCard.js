import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, Alert, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL } from '../config/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { api } from '../config/api';

const WorkerCard = ({ worker, navigation, index }) => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);

  // Helper to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    // Remove /api from API_BASE_URL since image paths start with /uploads
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= rating ? 'star' : 'star-border'}
          size={18}
          color="#FBBF24" // A distinct star color
        />
      );
    }
    return stars;
  };

  const handleMessage = async () => {
    try {
      if (!user || user.user_type !== 'homeowner') {
        showAlert('Homeowners Only', 'Only homeowners can initiate chats with workers.', 'info');
        return;
      }
      if (!worker?.userId) {
        return;
      }
      const res = await api.get(`/chat/conversation/${worker.userId}`);
      if (res.data?.success && res.data.conversation) {
        navigation.navigate('Chat', {
          conversationId: res.data.conversation.id,
          otherUserId: worker.userId,
          otherUserName: worker.name,
          otherUserAvatar: worker.profileImage,
          otherUserPhone: worker.phone,
        });
      } else {
        showAlert('Chat Error', 'We couldn\'t start a conversation right now.', 'error');
      }
    } catch (e) {
      console.error('WorkerCard message error:', e?.response?.data || e.message);
      showAlert('Connection Error', e?.response?.data?.message || 'Failed to start chat. Please try again.', 'error');
    }
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View
        style={[styles.workerCard, { 
          backgroundColor: isDarkMode ? 'rgba(16,20,21,0.65)' : 'rgba(255,255,255,0.85)', 
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' 
        }]}
      >
        <TouchableOpacity style={styles.cardHeader} onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })} activeOpacity={0.8}>
          {getImageUrl(worker.profileImage) ? (
            <Image
              source={{ uri: getImageUrl(worker.profileImage) }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profilePlaceholder, { borderColor: '#38BDF8', backgroundColor: isDarkMode ? 'rgba(56,189,248,0.12)' : 'rgba(37,99,235,0.08)' }]}>
              <Icon name="person" size={30} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.workerName, { color: colors.text }]}>{worker.name}</Text>
            <Text style={[styles.serviceType, { color: colors.primary }]}>
              {worker.serviceType?.charAt(0).toUpperCase() + worker.serviceType?.slice(1) || 'Service Provider'}
            </Text>
            {worker.experienceYears > 0 && (
              <Text style={[styles.experience, { color: colors.textSecondary }]}>{worker.experienceYears} years experience</Text>
            )}
          </View>
          {!!worker.verified && (
            <View style={[styles.verifiedBadge, { backgroundColor: isDarkMode ? 'rgba(37,99,235,0.9)' : '#2563EB' }]}>
              <Icon name="verified" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
        
        {!!worker.bio && (
          <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={2}>{worker.bio}</Text>
        )}
        
        <View style={[styles.cardBody, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {renderStars(Math.round(worker.averageRating || 0))}
            </View>
            <Text style={[styles.ratingText, { color: colors.text }]}>
              {(worker.averageRating || 0).toFixed(1)} 
              <Text style={{ color: colors.textSecondary }}> ({worker.totalJobs || 0} jobs)</Text>
            </Text>
          </View>
          {!!worker.distance && (
            <View style={styles.distanceContainer}>
              <Icon name="location-on" size={16} color="#005bb5" />
              <Text style={[styles.distanceText, { color: '#005bb5' }]}>{worker.distance} km</Text>
            </View>
          )}
        </View>
        
        <View style={[styles.cardFooter, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={styles.priceContainer}>
            <Text style={[styles.hourlyRate, { color: isDarkMode ? '#10B981' : '#059669' }]}>${Number(worker.hourlyRate || 0).toFixed(2)}<Text style={{fontSize:14, color: colors.textSecondary}}>/hr</Text></Text>
            {!!worker.minCharge && (
              <Text style={[styles.minCharge, { color: colors.textSecondary }]}>Min: ${Number(worker.minCharge || 0).toFixed(2)}</Text>
            )}
          </View>
          
          <View style={styles.footerContainer}>
            <View style={styles.footerTopRow}>
              {user?.user_type === 'homeowner' && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.messageButton, { flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} 
                  onPress={handleMessage}
                >
                  <Icon name="chat" size={16} color={colors.text} style={styles.btnIcon} />
                  <Text style={[styles.messageButtonText, { color: colors.text }]}>Message</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.actionButton, styles.bookButton, { flex: 1 }]} 
                onPress={() => navigation.navigate('ServiceRequest', { worker })}
              >
                <Text style={styles.bookButtonText}>Book</Text>
                <Icon name="arrow-forward" size={16} color="#fff" style={styles.btnIconRight} />
              </TouchableOpacity>
            </View>

            {user?.user_type === 'homeowner' && (
              <View style={styles.footerBottomRow}>
                <TextInput
                  style={[styles.amountInput, { 
                    flex: 1,
                    backgroundColor: colors.surface, 
                    color: colors.text, 
                    borderColor: colors.border 
                  }]}
                  placeholder="Enter Amount"
                  placeholderTextColor={colors.textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.payButton, { flex: 1 }]}
                  disabled={paying}
                  onPress={async () => {
                    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                      showAlert('Invalid Amount', 'Please enter a valid payment amount.', 'info');
                      return;
                    }
                    setPaying(true);
                    try {
                      const bookingDetails = {
                        workerId: worker.id,
                        description: `Mock payment for ${worker.name}`,
                        bookingDate: new Date().toISOString().split('T')[0],
                        serviceType: worker.serviceType,
                        estimatedHours: 1,
                        estimatedPrice: Number(amount),
                        paymentStatus: 'paid',
                      };
                      const response = await api.post('/bookings/create', bookingDetails);
                      if (response.data.success) {
                        showAlert('Payment Successful', 'Booking created! You can now leave a review in Bookings tab.', 'success');
                        setAmount('');
                        navigation.navigate(user?.user_type === 'worker' ? 'Jobs' : 'Bookings');
                      } else {
                        showAlert('Payment Failed', response.data.message || 'We couldn\'t process your payment.', 'error');
                      }
                    } catch (error) {
                      showAlert('Payment Failed', error.response?.data?.message || 'We couldn\'t connect to the server.', 'error');
                    } finally {
                      setPaying(false);
                    }
                  }}
                >
                  <Icon name="payments" size={16} color="#fff" style={styles.btnIcon} />
                  <Text style={styles.bookButtonText}>{paying ? '...' : 'Pay'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  workerCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  profilePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  experience: {
    fontSize: 13,
  },
  verifiedBadge: {
    padding: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  bio: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  ratingContainer: {
    flex: 1,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  hourlyRate: {
    fontSize: 20,
    fontWeight: '700',
  },
  minCharge: {
    fontSize: 13,
  },
  footerContainer: {
    width: '100%',
    gap: 12,
  },
  footerTopRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  footerBottomRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  amountInput: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButton: {
    height: 48,
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButton: {
    borderWidth: 1,
  },
  bookButton: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payButton: {
    backgroundColor: '#5F4BB6',
    shadowColor: '#5F4BB6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnIcon: {
    marginRight: 6,
  },
  btnIconRight: {
    marginLeft: 6,
  },
});

export default React.memo(WorkerCard, (prevProps, nextProps) => {
  return (
    prevProps.worker.id === nextProps.worker.id &&
    prevProps.worker.averageRating === nextProps.worker.averageRating &&
    prevProps.worker.distance === nextProps.worker.distance &&
    prevProps.worker.availabilityStatus === nextProps.worker.availabilityStatus &&
    prevProps.index === nextProps.index
  );
});
