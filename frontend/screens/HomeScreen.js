import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  Image,
  TextInput,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import api, { API_BASE_URL } from '../config/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import PremiumBackground from '../components/PremiumBackground';
import { useTabAnimation } from '../context/TabAnimationContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;
const CARD_SPACING = 16;

const HomeScreen = React.memo(function HomeScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { handleScroll } = useTabAnimation();
  const [loading, setLoading] = useState(true);
  const [topWorkers, setTopWorkers] = useState([]);
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [locationName, setLocationName] = useState('Locating...');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    InteractionManager.runAfterInteractions(() => {
      fetchData();
    });
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Kick off Global Top Workers fetch in parallel with location fetching
      const topWorkersPromise = api.get('/workers/search').then(topRes => {
        if (topRes.data.success) {
          const sorted = topRes.data.workers
            .sort((a, b) => b.averageRating - a.averageRating)
            .slice(0, 10);
          setTopWorkers(sorted);
        }
      }).catch(err => console.error('Top workers error:', err));

      // 2. Resolve Location
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        // Instantly use last known cached position to prevent UI freezing
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          // Only block on current position if cache is completely empty (first run)
          loc = await Location.getCurrentPositionAsync({});
        } else {
          // Silently update cache in background
          Location.getCurrentPositionAsync({}).catch(() => {});
        }
        
        if (loc) {
          // Parallelize Reverse Geocode & Nearby Workers
          const [geocode, nearbyRes] = await Promise.all([
            Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
            api.get(`/workers/nearby?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&radius=50`)
          ]);
          
          if (geocode && geocode.length > 0) {
            setLocationName(`${geocode[0].city || geocode[0].district}, ${geocode[0].region || geocode[0].country}`);
          } else {
            setLocationName('Current Location');
          }

          if (nearbyRes.data.success) {
            setNearbyWorkers(nearbyRes.data.workers.slice(0, 5));
          }
        }
      } else {
        setLocationName('Location Disabled');
      }

      // Wait for top workers to finish before dropping loader, since it runs in parallel
      await topWorkersPromise;

    } catch (error) {
      console.error('Error fetching data:', error);
      setLocationName('Location Unavailable');
    } finally {
      setLoading(false);
    }
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(16, 20, 21, 0.65)' : 'rgba(255, 255, 255, 0.85)',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
  };

  const textPrimary = '#FFFFFF';
  const textSecondary = 'rgba(255, 255, 255, 0.85)';
  
  const glassTextPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const glassTextSecondary = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)';

  const renderTopWorker = useCallback(({ item, index }) => {
    const inputRange = [
      (index - 1) * (CARD_WIDTH + CARD_SPACING),
      index * (CARD_WIDTH + CARD_SPACING),
      (index + 1) * (CARD_WIDTH + CARD_SPACING),
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.95, 1, 0.95],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.premiumCardContainer, { transform: [{ scale }], opacity }]}>
        <View style={[styles.premiumCard, glassStyle]}>
          
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.cardProfileWrapper}>
              {getImageUrl(item.profileImage) ? (
                <Image source={{ uri: getImageUrl(item.profileImage) }} style={styles.cardProfileImg} />
              ) : (
                <View style={[styles.cardProfilePlaceholder, { backgroundColor: isDarkMode ? 'rgba(56,189,248,0.1)' : 'rgba(37,99,235,0.1)' }]}>
                  <Icon name="person" size={40} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
                </View>
              )}
              {!!item.verified && (
                <View style={styles.cardVerified}>
                  <Icon name="verified" size={18} color="#38BDF8" />
                </View>
              )}
            </View>

            <View style={styles.cardHeaderInfo}>
              <Text style={[styles.cardName, { color: glassTextPrimary }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.cardProfession, { color: glassTextSecondary }]}>{item.serviceType?.toUpperCase() || 'EXPERT'}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={[styles.cardStats, { borderTopColor: glassStyle.borderColor, borderBottomColor: glassStyle.borderColor }]}>
            <View style={styles.statItem}>
              <Icon name="star" size={18} color="#FBBF24" />
              <Text style={[styles.statValue, { color: glassTextPrimary }]}>{Number(item.averageRating || 0).toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: glassTextSecondary }]}>Rating</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: glassStyle.borderColor }]} />
            <View style={styles.statItem}>
              <Icon name="work" size={18} color={isDarkMode ? '#8B5CF6' : '#8B5CF6'} />
              <Text style={[styles.statValue, { color: glassTextPrimary }]}>{item.totalJobs || 0}</Text>
              <Text style={[styles.statLabel, { color: glassTextSecondary }]}>Jobs</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: glassStyle.borderColor }]} />
            <View style={styles.statItem}>
              <Icon name="attach-money" size={18} color="#059669" />
              <Text style={[styles.statValue, { color: glassTextPrimary }]}>${item.hourlyRate}</Text>
              <Text style={[styles.statLabel, { color: glassTextSecondary }]}>/hr</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={[styles.actionBtnSecondary, { backgroundColor: 'rgba(0,0,0,0.06)' }]}
              onPress={() => navigation.navigate('Chat', { workerId: item.userId || item.id, workerName: item.name })}
            >
              <Icon name="chat-bubble-outline" size={20} color={glassTextPrimary} />
              <Text style={[styles.actionBtnText, { color: glassTextPrimary }]}>Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtnPrimary}
              onPress={() => navigation.navigate('ServiceRequest', { worker: item })}
            >
              <LinearGradient colors={['#38BDF8', '#2563EB']} style={StyleSheet.absoluteFill} borderRadius={16} />
              <Text style={styles.actionBtnPrimaryText}>Book Now</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Animated.View>
    );
  }, [colors, navigation, scrollX, isDarkMode, textPrimary, textSecondary, glassStyle]);

  const renderNearbyWorker = useCallback((worker, index) => {
    return (
      <TouchableOpacity
        key={worker.id}
        style={styles.nearbyWorkerCard}
        onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })}
        activeOpacity={0.8}
      >
        <View style={[styles.nearbyCardGlass, glassStyle]}>
          <View style={styles.nearbyImageContainer}>
            {getImageUrl(worker.profileImage) ? (
              <Image source={{ uri: getImageUrl(worker.profileImage) }} style={styles.nearbyImage} />
            ) : (
              <View style={[styles.nearbyPlaceholder, { backgroundColor: isDarkMode ? 'rgba(56,189,248,0.1)' : 'rgba(37,99,235,0.1)' }]}>
                <Icon name="person" size={24} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
              </View>
            )}
          </View>

          <View style={styles.nearbyInfo}>
            <Text style={[styles.nearbyName, { color: glassTextPrimary }]} numberOfLines={1}>{worker.name}</Text>
            <View style={styles.nearbyMetaRow}>
              <Text style={[styles.nearbyService, { color: glassTextSecondary }]}>{worker.serviceType}</Text>
              <View style={styles.nearbyDot} />
              <Text style={[styles.nearbyDistance, { color: '#005bb5' }]}>{worker.distance} km</Text>
            </View>
          </View>

          <View style={styles.nearbyArrow}>
            <Icon name="chevron-right" size={24} color={glassTextSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, isDarkMode, glassStyle, textPrimary, textSecondary]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#020617' : '#F8FAFC' }}>
        <PremiumBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      </View>
    );
  }

  const userFirstName = user?.name ? user.name.split(' ')[0] : 'Guest';

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#020617' : '#F8FAFC' }}>
      <PremiumBackground />
      <SafeAreaView style={styles.container}>
      
        <Animated.ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Main Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greeting, { color: textSecondary }]}>Good Morning,</Text>
              <Text style={[styles.userName, { color: textPrimary }]}>{userFirstName}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.notificationBtn}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Icon name="notifications-none" size={28} color={textPrimary} />
                {unreadCount > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Location Badge */}
          <Animated.View style={[{ paddingHorizontal: 24, marginBottom: 20, opacity: fadeAnim }]}>
            <View style={[styles.locationBadge, glassStyle]}>
              <Icon name="location-on" size={16} color="#005bb5" />
              <Text style={[styles.locationText, { color: glassTextPrimary }]} numberOfLines={1}>{locationName}</Text>
            </View>
          </Animated.View>

          {/* Search Bar */}
          <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
            <View style={[styles.searchBar, glassStyle]}>
              <Icon name="search" size={24} color={glassTextSecondary} />
              <TextInput 
                style={[styles.searchText, { color: glassTextPrimary, height: '100%', paddingVertical: 0 }]}
                placeholder="Find plumbers, electricians..."
                placeholderTextColor={glassTextSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => navigation.navigate('Workers', { searchQuery })}
                returnKeyType="search"
              />
              <TouchableOpacity 
                style={styles.searchFilterBtn} 
                onPress={() => navigation.navigate('Workers', { searchQuery })}
              >
                <Icon name="tune" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Promotional Banner */}
          <Animated.View style={[styles.promoContainer, { opacity: fadeAnim }]}>
            <LinearGradient 
              colors={['rgba(56, 189, 248, 0.15)', 'rgba(37, 99, 235, 0.05)']} 
              style={[styles.promoBanner, glassStyle]}
              start={{x: 0, y: 0}} end={{x: 1, y: 1}}
            >
              <View style={styles.promoContent}>
                <Text style={[styles.promoTitle, { color: glassTextPrimary }]}>Need an expert fast?</Text>
                <Text style={[styles.promoSub, { color: glassTextSecondary }]}>Book highly-rated pros in your area.</Text>
              </View>
              <View style={styles.promoIconWrapper}>
                <Icon name="bolt" size={32} color="#005bb5" />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Quick Categories */}
          <View style={styles.categoriesContainer}>
            {[
              { name: 'Plumber', icon: 'plumbing', color: '#38BDF8' },
              { name: 'Electric', icon: 'electrical-services', color: '#A78BFA' },
              { name: 'Painter', icon: 'format-paint', color: '#F472B6' },
              { name: 'Handyman', icon: 'build', color: '#FBBF24' },
            ].map((cat, i) => (
              <TouchableOpacity 
                key={i} 
                style={styles.categoryItem}
                onPress={() => navigation.navigate('Workers', { serviceType: cat.name.toLowerCase() })}
              >
                <View style={[styles.categoryIconGlass, glassStyle]}>
                  <Icon name={cat.icon} size={28} color={cat.color} />
                </View>
                <Text style={[styles.categoryName, { color: textPrimary }]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Top Workers Carousel */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Featured Professionals</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Workers')}>
                <Text style={[styles.seeAll, { color: '#38BDF8' }]}>View All</Text>
              </TouchableOpacity>
            </View>

            <Animated.FlatList
              data={topWorkers}
              renderItem={renderTopWorker}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselList}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            />
          </View>

          {/* Nearby List */}
          {nearbyWorkers.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Trusted Near You</Text>
              </View>
              <View style={styles.nearbyListContainer}>
                {nearbyWorkers.map((worker, index) => renderNearbyWorker(worker, index))}
              </View>
            </View>
          )}

        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerRight: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBtn: {
    position: 'relative',
    padding: 4,
  },
  badgeContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#020617', // Match dark bg to look like cutout
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  searchText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '400',
  },
  searchFilterBtn: {
    backgroundColor: '#38BDF8',
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 28,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  promoSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  promoIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(56,189,248,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 12,
  },
  categoryIconGlass: {
    width: 64,
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  carouselList: {
    paddingLeft: 24,
    paddingRight: 8, 
  },
  premiumCardContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  premiumCard: {
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardProfileWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  cardProfileImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  cardProfilePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardVerified: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  cardHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardProfession: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionBtnPrimary: {
    flex: 1.5,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  nearbyListContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  nearbyWorkerCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  nearbyCardGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
  },
  nearbyImageContainer: {
    marginRight: 16,
  },
  nearbyImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  nearbyPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nearbyName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  nearbyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearbyService: {
    fontSize: 13,
    fontWeight: '500',
  },
  nearbyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    marginHorizontal: 8,
  },
  nearbyDistance: {
    fontSize: 13,
    fontWeight: '600',
  },
  nearbyArrow: {
    paddingLeft: 12,
  }
});
