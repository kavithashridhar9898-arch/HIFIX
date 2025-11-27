import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Animated,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api, { API_BASE_URL } from '../config/api';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_SPACING = 15;

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [topWorkers, setTopWorkers] = useState([]);
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [location, setLocation] = useState(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Helper to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    // Remove /api from API_BASE_URL since image paths start with /uploads
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  };

  // Premium aurora breathing animation background
  const AnimatedBackground = () => {
    const auroraCount = 4;
    const auroras = useRef([...Array(auroraCount)].map((_, i) => ({
      breathe: new Animated.Value(0),
      x: new Animated.Value(Math.random() * 100),
      y: new Animated.Value(20 + i * 25),
      rotate: new Animated.Value(0),
      hue: [280, 320, 45, 300][i],
      baseOpacity: 0.15 + Math.random() * 0.1,
    })) ).current;

    const particleCount = 120;
    const particles = useRef([...Array(particleCount)].map(() => ({
      anim: new Animated.Value(0),
      floatAnim: new Animated.Value(0),
      size: 1 + Math.random() * 4,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 10000,
      duration: 10000 + Math.random() * 15000,
      floatDuration: 3000 + Math.random() * 4000,
      drift: (Math.random() - 0.5) * 40,
      floatRange: 20 + Math.random() * 40,
      hue: Math.random() > 0.5 ? 45 : 280,
      isGolden: Math.random() > 0.5,
    })) ).current;

    useEffect(() => {
      // Aurora breathing animation - smooth expansion and contraction
      auroras.forEach((aurora, i) => {
        const breatheLoop = () => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(aurora.breathe, {
                toValue: 1,
                duration: 4000 + i * 500,
                useNativeDriver: false,
              }),
              Animated.timing(aurora.breathe, {
                toValue: 0,
                duration: 4000 + i * 500,
                useNativeDriver: false,
              }),
            ])
          ).start();
        };
        breatheLoop();

        // Slow horizontal drift
        const driftLoop = () => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(aurora.x, {
                toValue: 100,
                duration: 25000 + i * 3000,
                useNativeDriver: false,
              }),
              Animated.timing(aurora.x, {
                toValue: 0,
                duration: 25000 + i * 3000,
                useNativeDriver: false,
              }),
            ])
          ).start();
        };
        driftLoop();

        // Gentle rotation
        Animated.loop(
          Animated.timing(aurora.rotate, {
            toValue: 360,
            duration: 30000 + i * 5000,
            useNativeDriver: false,
          })
        ).start();
      });

      // Particles with floating and twinkling effect
      particles.forEach((p) => {
        // Main twinkle animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(p.anim, {
              toValue: 1,
              duration: p.duration / 2,
              delay: p.delay,
              useNativeDriver: true,
            }),
            Animated.timing(p.anim, {
              toValue: 0,
              duration: p.duration / 2,
              useNativeDriver: true,
            }),
          ])
        ).start();

        // Floating animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(p.floatAnim, {
              toValue: 1,
              duration: p.floatDuration,
              useNativeDriver: true,
            }),
            Animated.timing(p.floatAnim, {
              toValue: 0,
              duration: p.floatDuration,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    }, []);

    return (
      <View pointerEvents="none" style={styles.animatedBackground}>
        <LinearGradient
          colors={['#0a0a0f', '#1a0a1f', '#0f0a15', '#1f1a0f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Aurora waves with breathing animation */}
        {auroras.map((aurora, i) => {
          const scale = aurora.breathe.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.3],
          });
          const opacity = aurora.breathe.interpolate({
            inputRange: [0, 1],
            outputRange: [aurora.baseOpacity * 0.7, aurora.baseOpacity],
          });
          
          return (
            <Animated.View
              key={`aurora-${i}`}
              style={{
                position: 'absolute',
                width: width * 1.5,
                height: 400,
                top: `${aurora.y.interpolate({ inputRange: [0, 100], outputRange: [0, height * 0.8] })}%`,
                left: aurora.x.interpolate({ inputRange: [0, 100], outputRange: [-width * 0.5, width * 0.2] }),
                borderRadius: 999,
                backgroundColor: `hsla(${aurora.hue}, ${aurora.hue < 100 ? '90%' : '80%'}, ${aurora.hue < 100 ? '60%' : '50%'}, 1)`,
                opacity,
                transform: [
                  { scaleX: scale },
                  { scaleY: aurora.breathe.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
                  { rotate: aurora.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                ],
                shadowColor: `hsl(${aurora.hue}, 100%, ${aurora.hue < 100 ? '65%' : '55%'})`,
                shadowOpacity: 0.6,
                shadowRadius: 80,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
          );
        })}

        {/* Floating twinkling particles */}
        {particles.map((p, i) => {
          const floatY = p.floatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -p.floatRange],
          });
          const floatX = p.floatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.drift],
          });
          const opacity = p.anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.2, 1, 0.2],
          });
          const scale = p.anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.5, 1.5, 0.5],
          });
          
          return (
            <Animated.View
              key={`particle-${i}`}
              style={{
                position: 'absolute',
                top: `${p.top}%`,
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                borderRadius: 999,
                opacity,
                backgroundColor: p.isGolden ? 'rgba(255, 215, 0, 1)' : 'rgba(200, 130, 255, 1)',
                shadowColor: p.isGolden ? '#FFD700' : '#C882FF',
                shadowOpacity: 1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                transform: [{ translateY: floatY }, { translateX: floatX }, { scale }],
              }}
            />
          );
        })}
      </View>
    );
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
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get location
      let { status } = await Location.requestForegroundPermissionsAsync();
      let currentLocation = null;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        currentLocation = loc;
        setLocation(loc);

        // Fetch nearby workers
        const nearbyRes = await api.get(`/workers/nearby?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&radius=50`);
        if (nearbyRes.data.success) {
          setNearbyWorkers(nearbyRes.data.workers.slice(0, 10));
        }
      }

      // Fetch top-rated workers
      const topRes = await api.get('/workers/nearby?latitude=40.7128&longitude=-74.0060&radius=1000');
      if (topRes.data.success) {
        const sorted = topRes.data.workers
          .sort((a, b) => b.averageRating - a.averageRating)
          .slice(0, 10);
        setTopWorkers(sorted);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTopWorker = ({ item, index }) => {
    const inputRange = [
      (index - 1) * (CARD_WIDTH + CARD_SPACING),
      index * (CARD_WIDTH + CARD_SPACING),
      (index + 1) * (CARD_WIDTH + CARD_SPACING),
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1, 0.6],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('WorkerDetail', { workerId: item.id })}
      >
        <Animated.View style={[styles.topWorkerCard, { transform: [{ scale }], opacity }]}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(180, 130, 255, 0.15)', 'rgba(255, 180, 100, 0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Profile Image */}
            <View style={styles.profileImageContainer}>
              {getImageUrl(item.profileImage) ? (
                <Image 
                  source={{ uri: getImageUrl(item.profileImage) }} 
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Icon name="person" size={60} color="#FFD700" />
                </View>
              )}
              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Icon name="verified" size={24} color="#FFD700" />
                </View>
              )}
            </View>

            {/* Worker Info */}
            <View style={styles.workerInfo}>
              <Text style={[styles.workerName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.workerService, { color: colors.textSecondary }]}>{item.serviceType}</Text>
              
              <View style={styles.ratingContainer}>
                <Icon name="star" size={20} color="#FFD700" />
                <Text style={[styles.ratingText, { color: colors.text }]}>{item.averageRating?.toFixed(1) || '0.0'}</Text>
                <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>({item.totalJobs || 0} jobs)</Text>
              </View>

              <View style={styles.priceContainer}>
                <Icon name="attach-money" size={18} color="#4CAF50" />
                <Text style={styles.priceText}>${item.hourlyRate}/hr</Text>
              </View>

              {item.distance && (
                <View style={styles.distanceContainer}>
                  <Icon name="location-on" size={16} color="#FF61D8" />
                  <Text style={styles.distanceText}>{item.distance} km away</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderNearbyWorker = (worker, index) => {
    return (
      <TouchableOpacity
        key={worker.id}
        style={styles.nearbyWorkerCard}
        onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.12)', 'rgba(180, 130, 255, 0.12)', 'rgba(255, 180, 100, 0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nearbyCardGradient}
        >
          {/* Worker Image */}
          <View style={styles.nearbyImageContainer}>
            {getImageUrl(worker.profileImage) ? (
              <Image 
                source={{ uri: getImageUrl(worker.profileImage) }} 
                style={styles.nearbyImage}
              />
            ) : (
              <View style={styles.nearbyPlaceholder}>
                <Icon name="person" size={30} color="#FFD700" />
              </View>
            )}
          </View>

          {/* Worker Details */}
          <View style={styles.nearbyInfo}>
            <Text style={[styles.nearbyName, { color: colors.text }]} numberOfLines={1}>{worker.name}</Text>
            <Text style={[styles.nearbyService, { color: colors.textSecondary }]}>{worker.serviceType}</Text>
            
            <View style={styles.nearbyMeta}>
              <View style={styles.nearbyRating}>
                <Icon name="star" size={14} color="#FFD700" />
                <Text style={[styles.nearbyRatingText, { color: colors.text }]}>{worker.averageRating?.toFixed(1) || '0.0'}</Text>
              </View>
              <Text style={[styles.nearbyDistance, { color: colors.accent }]}>{worker.distance} km</Text>
            </View>
          </View>

          {/* Quick Action */}
          <TouchableOpacity style={styles.quickAction}>
            <Icon name="arrow-forward" size={20} color="#FFD700" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Finding the best workers for you...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome to</Text>
            <Text style={[styles.appName, { color: colors.text }]}>HIFIX</Text>
          </View>
          <TouchableOpacity 
            style={[styles.locationButton, { backgroundColor: `${colors.primary}30`, borderColor: `${colors.primary}50` }]}
            onPress={() => navigation.navigate('Workers')}
          >
            <Icon name="search" size={24} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Top Rated Section */}
        <Animated.View 
          style={[
            styles.section,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>⭐ Top Rated Experts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Workers')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>

          <Animated.FlatList
            data={topWorkers}
            renderItem={renderTopWorker}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            contentContainerStyle={styles.topWorkersList}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
          />
        </Animated.View>

        {/* Quick Services */}
        <Animated.View 
          style={[
            styles.section,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔧 Quick Services</Text>
          <View style={styles.servicesGrid}>
            {[
              { name: 'Plumber', icon: 'plumbing', color: '#64B5F6' },
              { name: 'Electrician', icon: 'electrical-services', color: '#4FC3F7' },
              { name: 'Painter', icon: 'brush', color: '#FF61D8' },
              { name: 'Carpenter', icon: 'build', color: '#FFB74D' },
            ].map((service, index) => (
              <TouchableOpacity
                key={service.name}
                style={styles.serviceCard}
                onPress={() => navigation.navigate('Workers', { serviceType: service.name.toLowerCase() })}
              >
                <LinearGradient
                  colors={[service.color + '30', service.color + '10']}
                  style={styles.serviceGradient}
                >
                  <Icon name={service.icon} size={32} color={service.color} />
                  <Text style={[styles.serviceName, { color: colors.text }]}>{service.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Nearby Workers */}
        {nearbyWorkers.length > 0 && (
          <Animated.View 
            style={[
              styles.section,
              { opacity: fadeAnim }
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📍 Near You</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Workers')}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.nearbyList}>
              {nearbyWorkers.slice(0, 5).map((worker, index) => renderNearbyWorker(worker, index))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
  },
  greeting: {
    fontSize: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
    letterSpacing: 2,
  },
  locationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  topWorkersList: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  topWorkerCard: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    borderRadius: 25,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 20,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    backgroundColor: 'rgba(10, 10, 20, 0.5)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: width * 0.25,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  workerInfo: {
    alignItems: 'center',
  },
  workerName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  workerService: {
    fontSize: 16,
    textTransform: 'capitalize',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  ratingCount: {
    fontSize: 14,
    marginLeft: 5,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    color: '#FF61D8',
    marginLeft: 4,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 15,
  },
  serviceCard: {
    width: (width - 55) / 2,
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
  },
  serviceGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    backgroundColor: 'rgba(10, 10, 20, 0.4)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  nearbyList: {
    paddingHorizontal: 20,
  },
  nearbyWorkerCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  nearbyCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    backgroundColor: 'rgba(10, 10, 20, 0.5)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  nearbyImageContainer: {
    marginRight: 15,
  },
  nearbyImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  nearbyPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  nearbyInfo: {
    flex: 1,
  },
  nearbyName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nearbyService: {
    fontSize: 14,
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  nearbyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  nearbyRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearbyRatingText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  nearbyDistance: {
    fontSize: 12,
  },
  quickAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
});
