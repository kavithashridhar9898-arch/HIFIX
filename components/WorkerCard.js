import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, Alert } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { API_BASE_URL } from '../config/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../config/api';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const WorkerCard = ({ worker, navigation, index, onPlayClick }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

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
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  const animatePress = (toValue) => {
    Animated.spring(pressAnim, {
      toValue,
      speed: 16,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleMessage = async () => {
    onPlayClick?.();
    try {
      if (!user || user.user_type !== 'homeowner') {
        Alert.alert('Messaging', 'Only homeowners can initiate chats.');
        return;
      }
      if (!worker?.userId) {
        Alert.alert('Error', 'Worker account link missing');
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
        Alert.alert('Error', 'Could not open conversation');
      }
    } catch (e) {
      console.error('WorkerCard message error:', e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.message || 'Failed to start chat');
    }
  };

  const handleNavigate = () => {
    onPlayClick?.();
    navigation.navigate('WorkerDetail', { workerId: worker.id });
  };

  const handleBook = () => {
    onPlayClick?.();
    navigation.navigate('ServiceRequest', { workerId: worker.id });
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <AnimatedTouchable
        activeOpacity={0.95}
        style={{ transform: [{ scale: pressAnim }] }}
        onPress={handleNavigate}
        onPressIn={() => animatePress(0.97)}
        onPressOut={() => animatePress(1)}
      >
        <LinearGradient
          colors={['rgba(30,64,175,0.65)', 'rgba(30,27,75,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCard, { borderColor: `${colors.primary}25` }]}
        >
          <View style={styles.cardHeader}>
          {getImageUrl(worker.profileImage) ? (
            <Image
              source={{ uri: getImageUrl(worker.profileImage) }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profilePlaceholder, { borderColor: colors.primary, backgroundColor: `${colors.primary}20` }]}>
              <Icon name="person" size={30} color={colors.primary} />
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
          {worker.verified && (
            <View style={[styles.verifiedBadge, { backgroundColor: `${colors.primary}10` }]}>
              <Icon name="verified" size={20} color={colors.primary} />
            </View>
          )}
        </View>
        
          {worker.bio && (
            <Text style={[styles.bio, { color: 'rgba(226,232,240,0.72)' }]} numberOfLines={2}>{worker.bio}</Text>
          )}

          <View style={styles.cardBody}>
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {renderStars(Math.round(worker.averageRating || 0))}
              </View>
              <Text style={styles.ratingText}>
                {(worker.averageRating || 0).toFixed(1)} ({worker.totalJobs || 0} jobs)
              </Text>
            </View>
            {worker.distance && (
              <View style={styles.distanceContainer}>
                <Icon name="location-on" size={16} color={colors.primary} />
                <Text style={styles.distanceText}>{worker.distance} km</Text>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.hourlyRate}>${(worker.hourlyRate || 0).toFixed(2)}/hr</Text>
              {worker.minCharge && (
                <Text style={styles.minCharge}>Min: ${worker.minCharge.toFixed(2)}</Text>
              )}
            </View>
            <View style={styles.footerButtons}>
              {user?.user_type === 'homeowner' && (
                <TouchableOpacity 
                  style={styles.messageButton}
                  onPress={handleMessage}
                  activeOpacity={0.9}
                >
                  <Icon name="chat" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.messageButtonText, { color: colors.primary }]}>Message</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.bookButton, { backgroundColor: colors.primary }]}
                onPress={handleBook}
                activeOpacity={0.9}
              >
                <Text style={styles.bookButtonText}>Book</Text>
                <Icon name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </AnimatedTouchable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
    gradientCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        backgroundColor: 'rgba(15,23,42,0.75)',
        shadowColor: '#60a5fa',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    profileImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 12,
        borderWidth: 2,
        borderColor: 'rgba(96,165,250,0.8)',
    },
    profilePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 12,
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
      marginBottom: 2,
      color: '#f8fafc',
    },
    serviceType: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(125,211,252,0.95)',
    },
    experience: {
      fontSize: 12,
      marginTop: 2,
      color: 'rgba(226,232,240,0.7)',
    },
    verifiedBadge: {
        padding: 5,
        borderRadius: 20,
      backgroundColor: 'rgba(15,118,110,0.2)',
    },
    bio: {
        fontSize: 13,
        marginBottom: 12,
        lineHeight: 18,
      color: 'rgba(226,232,240,0.7)',
    },
    cardBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: 'rgba(148,163,184,0.15)',
    },
    ratingContainer: {
        flex: 1,
    },
    stars: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    ratingText: {
      fontSize: 12,
      color: 'rgba(226,232,240,0.65)',
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
      backgroundColor: 'rgba(15,23,42,0.65)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    distanceText: {
      marginLeft: 4,
      fontSize: 12,
      color: 'rgba(226,232,240,0.75)',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      borderTopWidth: 1,
      borderColor: 'rgba(148,163,184,0.15)',
      paddingTop: 12,
    },
    priceContainer: {
        flex: 1,
    },
    hourlyRate: {
      fontSize: 18,
      fontWeight: '700',
      color: '#e0f2fe',
    },
    minCharge: {
      fontSize: 12,
      marginTop: 2,
      color: 'rgba(226,232,240,0.6)',
    },
    bookButton: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: 'center',
      shadowColor: '#22d3ee',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
    bookButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginRight: 4,
    },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderColor: 'rgba(148,163,184,0.25)',
  },
  messageButtonText: {
    fontWeight: 'bold',
  },
});

export default WorkerCard;
