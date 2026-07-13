import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../config/api';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = 380; // Expanded height
const SHEET_MIN_HEIGHT = 0; // Hidden height

const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${imageUrl}`;
};

const WorkerBottomSheet = ({ worker, visible, onClose, onBook, onMessage, onViewProfile }) => {
  const { colors, isDarkMode } = useTheme();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, worker]);

  // Handle Swipe Down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 100) {
          onClose(); // Swipe down enough to close
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!worker) return null;

  const imageUrl = getImageUrl(worker.profileImage);
  
  // Calculate mock ETA based on distance for UI flair (e.g. 1km ~ 3 mins)
  const distanceVal = parseFloat(worker.distance || '0');
  const mockEta = Math.max(3, Math.round(distanceVal * 3));

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(22, 32, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
  };

  const textPrimary = colors.text;
  const textSecondary = colors.textSecondary;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.sheet, glassStyle]}>
        {/* Drag Handle */}
        <View style={styles.dragHandleWrapper}>
          <View style={[styles.dragHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
        </View>

        {/* Header: Photo and Info */}
        <View style={styles.headerRow}>
          <View style={styles.avatarWrapper}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder, { backgroundColor: isDarkMode ? 'rgba(56,189,248,0.1)' : 'rgba(37,99,235,0.1)' }]}>
                <Icon name="person" size={32} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
              </View>
            )}
            {worker.verified && (
              <View style={styles.verifiedBadge}>
                <Icon name="verified" size={16} color="#38BDF8" />
              </View>
            )}
          </View>

          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: textPrimary }]} numberOfLines={1}>
              {worker.name}
            </Text>
            <Text style={[styles.profession, { color: textSecondary }]}>
              {worker.serviceType?.toUpperCase() || 'EXPERT'}
            </Text>
          </View>
          
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={24} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Stats Row (Rating, Distance/ETA, Price) */}
        <View style={[styles.statsRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={styles.statBox}>
            <Icon name="star" size={20} color="#FBBF24" />
            <Text style={[styles.statValue, { color: textPrimary }]}>{worker.averageRating?.toFixed(1) || '0.0'}</Text>
            <Text style={[styles.statLabel, { color: textSecondary }]}>({worker.totalJobs || 0} jobs)</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statBox}>
            <Icon name="directions-car" size={20} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
            <Text style={[styles.statValue, { color: textPrimary }]}>{mockEta} min</Text>
            <Text style={[styles.statLabel, { color: textSecondary }]}>{worker.distance || '0'} km away</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Icon name="attach-money" size={20} color="#10B981" />
            <Text style={[styles.statValue, { color: textPrimary }]}>${worker.hourlyRate}</Text>
            <Text style={[styles.statLabel, { color: textSecondary }]}>/ hr</Text>
          </View>
        </View>

        {/* Bio Snippet */}
        {worker.bio ? (
          <Text style={[styles.bioText, { color: textSecondary }]} numberOfLines={2}>
            {worker.bio}
          </Text>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.secondaryBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
            onPress={onViewProfile}
          >
            <Text style={[styles.secondaryBtnText, { color: textPrimary }]}>View Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconBtn, { backgroundColor: isDarkMode ? 'rgba(56,189,248,0.1)' : 'rgba(37,99,235,0.1)' }]}
            onPress={onMessage}
          >
            <Icon name="chat-bubble-outline" size={22} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={onBook}>
            <LinearGradient colors={['#38BDF8', '#2563EB']} style={StyleSheet.absoluteFill} borderRadius={16} />
            <Text style={styles.primaryBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  dragHandleWrapper: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 4,
  },
  dragHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  profession: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default WorkerBottomSheet;
