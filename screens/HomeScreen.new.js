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
import api from '../config/api';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_SPACING = 15;

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [topWorkers, setTopWorkers] = useState([]);
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [location, setLocation] = useState(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Enhanced animated background
  const AnimatedBackground = () => {
    const orbCount = 5;
    const orbs = useRef([...Array(orbCount)].map((_, i) => ({
      x: new Animated.Value(Math.random() * 100),
      y: new Animated.Value(Math.random() * 100),
      scale: new Animated.Value(0.7 + Math.random() * 0.5),
      hue: [280, 200, 330, 170, 60][i],
      size: 260 + Math.random() * 180,
    })) ).current;

    const particleCount = 60;
    const particles = useRef([...Array(particleCount)].map(() => ({
      anim: new Animated.Value(0),
      size: 3 + Math.random() * 8,
      left: Math.random() * 100,
      delay: Math.random() * 5000,
      duration: 5000 + Math.random() * 8000,
      drift: (Math.random() - 0.5) * 60,
      hue: [280, 200, 330, 170, 60][Math.floor(Math.random() * 5)],
    })) ).current;

    useEffect(() => {
      orbs.forEach((orb) => {
        const loop = () => {
          Animated.parallel([
            Animated.timing(orb.x, { 
              toValue: Math.random() * 100, 
              duration: 9000, 
              useNativeDriver: false 
            }),
            Animated.timing(orb.y, { 
              toValue: Math.random() * 100, 
              duration: 9000, 
              useNativeDriver: false 
            }),
            Animated.sequence([
              Animated.timing(orb.scale, { 
                toValue: 1.3, 
                duration: 4000, 
                useNativeDriver: false 
              }),
              Animated.timing(orb.scale, { 
                toValue: 0.8, 
                duration: 4000, 
                useNativeDriver: false 
              }),
            ]),
          ]).start(() => loop());
        };
        loop();
      });

      particles.forEach((p) => {
        Animated.loop(
          Animated.timing(p.anim, { 
            toValue: 1, 
            duration: p.duration, 
            delay: p.delay, 
            useNativeDriver: true 
          })
        ).start();
      });
    }, []);

    return (
      <View pointerEvents="none" style={styles.animatedBackground}>
        {orbs.map((orb, i) => (
          <Animated.View
            key={`orb-${i}`}
            style={{
              position: 'absolute',
              width: orb.size,
              height: orb.size,
              borderRadius: 999,
              backgroundColor: `hsla(${orb.hue}, 90%, 55%, 0.18)`,
              shadowColor: `hsl(${orb.hue}, 100%, 60%)`,
              shadowOpacity: 0.9,
              shadowRadius: 40,
              transform: [
                { translateX: orb.x.interpolate({ inputRange: [0, 100], outputRange: [-100, 400] }) },
                { translateY: orb.y.interpolate({ inputRange: [0, 100], outputRange: [-100, 800] }) },
                { scale: orb.scale },
              ],
            }}
          />
        ))}

        {particles.map((p, i) => {
          const translateY = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1000],
          });
          const translateX = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.drift],
          });
          const opacity = p.anim.interpolate({
            inputRange: [0, 0.1, 0.9, 1],
            outputRange: [0, 1, 1, 0],
          });
          const scale = p.anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.3, 1.5, 0.3],
          });
          
          return (
            <Animated.View
              key={`particle-${i}`}
              style={{
                position: 'absolute',
                top: -30,
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                borderRadius: 999,
                opacity,
                backgroundColor: `hsla(${p.hue}, 100%, 70%, 0.95)`,
                shadowColor: `hsl(${p.hue}, 100%, 70%)`,
                shadowOpacity: 1,
                shadowRadius: 10,
                transform: [{ translateY }, { translateX }, { scale }],
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
            colors={['rgba(66, 133, 244, 0.2)', 'rgba(156, 39, 176, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Profile Image */}
            <View style={styles.profileImageContainer}>
              {item.profileImage ? (
                <Image 
                  source={{ uri: item.profileImage }} 
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Icon name="person" size={60} color="#4285F4" />
                </View>
              )}
              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Icon name="verified" size={24} color="#4285F4" />
                </View>
              )}
            </View>

            {/* Worker Info */}
            <View style={styles.workerInfo}>
              <Text style={styles.workerName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.workerService}>{item.serviceType}</Text>
              
              <View style={styles.ratingContainer}>
                <Icon name="star" size={20} color="#FFD700" />
                <Text style={styles.ratingText}>{item.averageRating?.toFixed(1) || '0.0'}</Text>
                <Text style={styles.ratingCount}>({item.totalJobs || 0} jobs)</Text>
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
          colors={['rgba(66, 133, 244, 0.15)', 'rgba(156, 39, 176, 0.15)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nearbyCardGradient}
        >
          {/* Worker Image */}
          <View style={styles.nearbyImageContainer}>
            {worker.profileImage ? (
              <Image 
                source={{ uri: worker.profileImage }} 
                style={styles.nearbyImage}
              />
            ) : (
              <View style={styles.nearbyPlaceholder}>
                <Icon name="person" size={30} color="#4285F4" />
              </View>
            )}
          </View>

          {/* Worker Details */}
          <View style={styles.nearbyInfo}>
            <Text style={styles.nearbyName} numberOfLines={1}>{worker.name}</Text>
            <Text style={styles.nearbyService}>{worker.serviceType}</Text>
            
            <View style={styles.nearbyMeta}>
              <View style={styles.nearbyRating}>
                <Icon name="star" size={14} color="#FFD700" />
                <Text style={styles.nearbyRatingText}>{worker.averageRating?.toFixed(1) || '0.0'}</Text>
              </View>
              <Text style={styles.nearbyDistance}>{worker.distance} km</Text>
            </View>
          </View>

          {/* Quick Action */}
          <TouchableOpacity style={styles.quickAction}>
            <Icon name="arrow-forward" size={20} color="#4285F4" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Finding the best workers for you...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
            <Text style={styles.greeting}>Welcome to</Text>
            <Text style={styles.appName}>HIFIX</Text>
          </View>
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={() => navigation.navigate('Workers')}
          >
            <Icon name="search" size={24} color="#fff" />
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
            <Text style={styles.sectionTitle}>⭐ Top Rated Experts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Workers')}>
              <Text style={styles.seeAll}>See All</Text>
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
          <Text style={styles.sectionTitle}>🔧 Quick Services</Text>
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
                  <Text style={styles.serviceName}>{service.name}</Text>
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
              <Text style={styles.sectionTitle}>📍 Near You</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Workers')}>
                <Text style={styles.seeAll}>See All</Text>
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
    backgroundColor: '#000',
  },
  animatedBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
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
    color: '#aaa',
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#4285F4',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  locationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(66, 133, 244, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.5)',
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
    color: '#fff',
  },
  seeAll: {
    fontSize: 14,
    color: '#4285F4',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    borderColor: '#4285F4',
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: width * 0.25,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  workerInfo: {
    alignItems: 'center',
  },
  workerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  workerService: {
    fontSize: 16,
    color: '#aaa',
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
    color: '#fff',
    marginLeft: 5,
  },
  ratingCount: {
    fontSize: 14,
    color: '#888',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nearbyImageContainer: {
    marginRight: 15,
  },
  nearbyImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  nearbyPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  nearbyInfo: {
    flex: 1,
  },
  nearbyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  nearbyService: {
    fontSize: 14,
    color: '#aaa',
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
    color: '#fff',
    marginLeft: 4,
  },
  nearbyDistance: {
    fontSize: 12,
    color: '#FF61D8',
  },
  quickAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.5)',
  },
});
