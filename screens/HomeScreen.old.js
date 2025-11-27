import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import AnimatedLogo from '../components/AnimatedLogo';
import * as Location from 'expo-location';
import api from '../config/api';
import WorkerCard from '../components/WorkerCard';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [featuredWorkers, setFeaturedWorkers] = useState([]);
  const [selectedHomeService, setSelectedHomeService] = useState(null);

  const windowWidth = Dimensions.get('window').width;
  const isSmall = windowWidth < 768;
  const columns = isSmall ? 2 : 3;
  const spacing = 16;
  const serviceItemWidth = (windowWidth - (spacing * (columns + 1))) / columns;

  // Neon border animation for video cards
  const neonAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(neonAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(neonAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const neonColor = neonAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#39ff14', '#7df9ff', '#ff3dff']
  });

  const AnimatedBackground = () => {
    // Enhanced animated background with unique home page aesthetics
    // Large glowing orbs - neon/electric colors
    const orbCount = 4;
    const orbs = useRef([...Array(orbCount)].map(() => ({
      x: new Animated.Value(Math.random() * 100),
      y: new Animated.Value(Math.random() * 100),
      scale: new Animated.Value(0.7 + Math.random() * 0.5),
      hue: [280, 200, 330, 170][Math.floor(Math.random() * 4)], // Purple, Cyan, Magenta, Green
      size: 260 + Math.random() * 180,
    })) ).current;

    // Floating geometric shapes - triangles, circles, hexagons
    const shapeCount = 20;
    const shapes = useRef([...Array(shapeCount)].map(() => ({
      anim: new Animated.Value(0),
      left: Math.random() * 100,
      delay: Math.random() * 4000,
      duration: 8000 + Math.random() * 8000,
      size: 15 + Math.random() * 30,
      hue: [280, 200, 330, 170, 60][Math.floor(Math.random() * 5)],
      rotateFrom: Math.random() * 360,
      drift: (Math.random() - 0.5) * 100,
      shapeType: Math.floor(Math.random() * 3), // 0: square, 1: circle, 2: triangle
    })) ).current;

    // Energy particles - small bright dots
    const particleCount = 50;
    const particles = useRef([...Array(particleCount)].map(() => ({
      anim: new Animated.Value(0),
      size: 3 + Math.random() * 8,
      left: Math.random() * 100,
      delay: Math.random() * 5000,
      duration: 5000 + Math.random() * 8000,
      drift: (Math.random() - 0.5) * 60,
      hue: [280, 200, 330, 170, 60][Math.floor(Math.random() * 5)],
    })) ).current;

    // Pulsing rings
    const ringCount = 5;
    const rings = useRef([...Array(ringCount)].map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      delay: Math.random() * 3000,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      hue: [280, 200, 330][Math.floor(Math.random() * 3)],
      size: 100 + Math.random() * 150,
    })) ).current;

    useEffect(() => {
      // Animate orbs
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

      // Animate shapes
      shapes.forEach((s) => {
        Animated.loop(
          Animated.timing(s.anim, { 
            toValue: 1, 
            duration: s.duration, 
            delay: s.delay, 
            useNativeDriver: true 
          })
        ).start();
      });

      // Animate particles
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

      // Animate rings
      rings.forEach((ring) => {
        const loop = () => {
          Animated.sequence([
            Animated.delay(ring.delay),
            Animated.parallel([
              Animated.timing(ring.scale, {
                toValue: 2,
                duration: 3000,
                useNativeDriver: false,
              }),
              Animated.timing(ring.opacity, {
                toValue: 0,
                duration: 3000,
                useNativeDriver: false,
              }),
            ]),
          ]).start(() => {
            ring.scale.setValue(0);
            ring.opacity.setValue(1);
            loop();
          });
        };
        loop();
      });
    }, []);

    return (
      <View pointerEvents="none" style={styles.animatedBackground}>
        {/* Glowing Orbs */}
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

        {/* Pulsing Rings */}
        {rings.map((ring, i) => (
          <Animated.View
            key={`ring-${i}`}
            style={{
              position: 'absolute',
              left: `${ring.x}%`,
              top: `${ring.y}%`,
              width: ring.size,
              height: ring.size,
              borderRadius: 999,
              borderWidth: 3,
              borderColor: `hsla(${ring.hue}, 100%, 60%, 0.8)`,
              opacity: ring.opacity,
              transform: [{ scale: ring.scale }],
            }}
          />
        ))}

        {/* Geometric Shapes */}
        {shapes.map((s, i) => {
          const translateY = s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1000] });
          const translateX = s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, s.drift] });
          const rotate = s.anim.interpolate({ 
            inputRange: [0, 1], 
            outputRange: [`${s.rotateFrom}deg`, `${s.rotateFrom + 360}deg`] 
          });
          const opacity = s.anim.interpolate({ 
            inputRange: [0, 0.1, 0.9, 1], 
            outputRange: [0, 0.85, 0.85, 0] 
          });
          
          return (
            <Animated.View
              key={`shape-${i}`}
              style={{
                position: 'absolute',
                top: -50,
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                opacity,
                backgroundColor: `hsla(${s.hue}, 85%, 55%, 0.3)`,
                borderRadius: s.shapeType === 1 ? 999 : 8,
                borderWidth: s.shapeType === 2 ? 2 : 0,
                borderColor: `hsla(${s.hue}, 100%, 60%, 0.5)`,
                transform: [{ translateY }, { translateX }, { rotate }],
                shadowColor: `hsl(${s.hue}, 100%, 60%)`,
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }}
            />
          );
        })}

        {/* Energy Particles */}
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

  const services = [
    { name: 'Painting', key: 'painting', icon: 'brush', color: '#FF61D8' },
    { name: 'Electrical', key: 'electrical', icon: 'electrical-services', color: '#4FC3F7' },
    { name: 'Plumbing', key: 'plumbing', icon: 'plumbing', color: '#64B5F6' },
    { name: 'Carpentry', key: 'carpentry', icon: 'build', color: '#FFB74D' },
    { name: 'Handyman', key: 'handyman', icon: 'home-repair-service', color: '#81C784' },
    { name: 'HVAC', key: 'hvac', icon: 'ac-unit', color: '#7986CB' },
  ];

  // Map UI keys to backend enum
  const toBackendServiceType = (key) => {
    const map = {
      painting: 'painter',
      electrical: 'electrician',
      plumbing: 'plumber',
      carpentry: 'carpenter',
      handyman: 'handyman',
      hvac: 'hvac',
    };
    return map[key] || null;
  };

  const findNearbyWorkers = async () => {
    setLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permission to access location was denied');
      setLoading(false);
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setLocation(location);

    try {
      const { data } = await api.get(`/workers/nearby?latitude=${location.coords.latitude}&longitude=${location.coords.longitude}&radius=50`);
      if (data.success) {
        setNearbyWorkers(data.workers);
      }
    } catch (error) {
      console.error('Error fetching nearby workers:', error);
      setErrorMsg('Could not fetch nearby workers.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedWorkers = async () => {
    try {
      // Fetch some featured workers (you can add a dedicated endpoint later)
      const { data } = await api.get('/workers/nearby?latitude=40.7128&longitude=-74.0060&radius=100');
      if (data.success) {
        setFeaturedWorkers(data.workers.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching featured workers:', error);
    }
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const serviceAnims = useRef(services.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = serviceAnims.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, animations).start();
    
    // Fetch featured workers and set loading to false
    fetchFeaturedWorkers();
    
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <AnimatedLogo size={100} />
        <Text style={styles.loadingText}>Preparing your experience...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedBackground />
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>HIFIX</Text>
          <Text style={styles.subtitle}>Your Home Service Solution</Text>
        </View>

        {/* Quick service selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.homeServiceChips}
        >
          {services.map(s => (
            <TouchableOpacity
              key={`chip-${s.key}`}
              style={[
                styles.homeChip,
                selectedHomeService === s.key && styles.homeChipActive,
                styles.glowBorder,
              ]}
              onPress={() => setSelectedHomeService(selectedHomeService === s.key ? null : s.key)}
            >
              <Text style={[styles.homeChipText, selectedHomeService === s.key && styles.homeChipTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.gpsButton, styles.gradientPrimary, styles.glowBorder]}
            onPress={() => navigation.navigate('Workers', { serviceType: toBackendServiceType(selectedHomeService) })}
          >
            <Icon name="my-location" size={24} color="#fff" />
            <Text style={styles.gpsButtonText}>
              {selectedHomeService ? `Find Nearby ${selectedHomeService.charAt(0).toUpperCase() + selectedHomeService.slice(1)}` : 'Find Nearby Workers'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {/* Featured Workers Section */}
        {featuredWorkers.length > 0 && nearbyWorkers.length === 0 && (
          <View style={styles.workersSection}>
            <Text style={styles.sectionTitle}>Top Rated Workers</Text>
            {featuredWorkers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} navigation={navigation} index={0} />
            ))}
          </View>
        )}

        {nearbyWorkers.length > 0 && (
          <View style={styles.workersSection}>
            <Text style={styles.sectionTitle}>Nearby Workers</Text>
            {nearbyWorkers.map((worker, index) => (
              <WorkerCard key={worker.id} worker={worker} navigation={navigation} index={index} />
            ))}
          </View>
        )}
        {/* Services Section */}
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Our Services</Text>
        </View>
        <View style={styles.serviceGrid}>
          {services.map((service, index) => {
            const translateY = serviceAnims[index].interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            });
            const opacity = serviceAnims[index].interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            });

            return (
              <Animated.View
                key={service.key}
                style={[
                  styles.serviceItem,
                  { width: serviceItemWidth, margin: spacing / 2, transform: [{ translateY }], opacity },
                ]}
              >
                <TouchableOpacity
                  onPress={() => navigation.navigate('Workers', { serviceType: toBackendServiceType(service.key) })}
                  style={[styles.serviceCard, styles.glowBorderThin]}
                >
                  <View style={[styles.iconBackground, { backgroundColor: service.color }]}>
                    <Icon name={service.icon} size={50} color="#fff" />
                  </View>
                  <Text style={[styles.serviceButtonText, { color: service.color }]}>
                    {service.name}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginTop: 10,
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#00f',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',
    marginTop: 5,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 30,
    marginHorizontal: 20,
    marginBottom: 30,
    shadowColor: '#00f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 5,
  },
  gpsButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  homeServiceChips: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  homeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  homeChipActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  homeChipText: {
    color: '#ccc',
    fontWeight: '600',
  },
  homeChipTextActive: {
    color: '#fff',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  workersSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  nearbyWorkersContainer: {
    marginBottom: 20,
    height: 220, // Give the container a fixed height
  },
  nearbyWorkersTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    marginLeft: 20,
  },
  workerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginRight: 10,
    alignItems: 'center',
  },
  workerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  workerService: {
    color: '#ccc',
    fontSize: 14,
  },
  sectionTitleContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#00f',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  serviceItem: {
    marginBottom: 16,
  },
  serviceCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 5,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    elevation: 10,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceButtonText: {
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  gradientPrimary: {
    backgroundColor: '#4285F4',
  },
  animatedBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  glowBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  glowBorderThin: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
