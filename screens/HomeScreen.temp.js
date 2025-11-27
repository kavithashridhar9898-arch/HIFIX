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
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import AnimatedLogo from '../components/AnimatedLogo';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const windowWidth = Dimensions.get('window').width;
  const isSmall = windowWidth < 768;
  const columns = isSmall ? 2 : 2;
  const spacing = 12;
  const serviceItemWidth = (windowWidth - (spacing * (columns + 1))) / columns;

  // Service definitions with icons and colors
  const services = [
    { icon: 'brush', name: 'Painting', key: 'painting', color: '#FF61D8' },
    { icon: 'electrical-services', name: 'Electrical', key: 'electrical', color: '#4FC3F7' },
    { icon: 'plumbing', name: 'Plumbing', key: 'plumbing', color: '#64B5F6' },
    { icon: 'build', name: 'Carpentry', key: 'carpentry', color: '#FFB74D' },
    { icon: 'home-repair-service', name: 'Handyman', key: 'handyman', color: '#81C784' },
    { icon: 'ac-unit', name: 'HVAC', key: 'hvac', color: '#7986CB' },
  ];

  // Create individual animations for each service
  const serviceAnimations = useRef(
    services.reduce((acc, service) => ({
      ...acc,
      [service.key]: {
        scale: new Animated.Value(1),
        glow: new Animated.Value(0),
        rotation: new Animated.Value(0),
      }
    }), {})
  ).current;

  // Animation functions
  useEffect(() => {
    // Animate each service icon
    services.forEach((service) => {
      const animations = serviceAnimations[service.key];
      
      // Pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(animations.scale, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(animations.scale, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(animations.glow, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(animations.glow, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();

      // Subtle rotation
      Animated.loop(
        Animated.sequence([
          Animated.timing(animations.rotation, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: true,
          }),
          Animated.timing(animations.rotation, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  /*
    AnimatedBackground: lightweight, reusable background that adds multiple
    animated layers: floating blurred circles, diagonal streaks, small
    rotating shapes and a subtle parallax effect on web. Kept inside the
    screen component so it can access dimensions and platform info.
  */
  const AnimatedBackground = () => {
    const circles = useRef(
      [...Array(10)].map(() => new Animated.Value(0))
    ).current;

    const streaks = useRef(
      [...Array(6)].map(() => new Animated.Value(0))
    ).current;

    const smallShapes = useRef(
      [...Array(8)].map(() => new Animated.Value(0))
    ).current;

    // Parallax for web using mouse position
    const pointer = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

    useEffect(() => {
      // Loop animated float for circles
      circles.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 6000 + i * 800, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 6000 + i * 800, useNativeDriver: true }),
          ])
        ).start();
      });

      // Loop streak movement
      streaks.forEach((anim, i) => {
        Animated.loop(
          Animated.timing(anim, { toValue: 1, duration: 7000 + i * 900, useNativeDriver: true })
        ).start();
      });

      // small rotating shapes
      smallShapes.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 3000 + i * 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 3000 + i * 300, useNativeDriver: true }),
          ])
        ).start();
      });

      // web mouse parallax
      if (Platform.OS === 'web') {
        const handleMove = (e) => {
          const x = (e.clientX / window.innerWidth) * 2 - 1;
          const y = (e.clientY / window.innerHeight) * 2 - 1;
          Animated.spring(pointer, { toValue: { x, y }, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
        };
        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
      }
    }, []);

    return (
      <View pointerEvents="none" style={styles.animatedBackground}>
        {/* Floating blurred circles */}
        {circles.map((anim, i) => {
          const inputRange = [0, 1];
          const translateY = anim.interpolate({ inputRange, outputRange: [-(30 + i * 14), 30 + i * 14] });
          const translateX = anim.interpolate({ inputRange, outputRange: [-(18 + i * 8), 18 + i * 8] });
          const scale = anim.interpolate({ inputRange, outputRange: [0.7, 1.6] });
          const opacity = anim.interpolate({ inputRange, outputRange: [0.18, 0.6] });

          // parallax offset
          const parallaxStyle = Platform.OS === 'web' ? {
            transform: [
              { translateX: Animated.add(translateX, Animated.multiply(pointer.x, (i % 2 === 0 ? 18 : -12))) },
              { translateY: Animated.add(translateY, Animated.multiply(pointer.y, (i % 2 === 0 ? 12 : -8))) },
              { scale },
            ],
            opacity,
          } : { transform: [{ translateX }, { translateY }, { scale }], opacity };

          return (
            <Animated.View
              key={`bg-circle-${i}`}
              style={[
                styles.bgCircle,
                parallaxStyle,
                { backgroundColor: i % 2 === 0 ? '#4285F4' : '#5C9FFF', left: `${6 + i * 10}%`, top: `${2 + i * 12}%`, width: 320 - i * 12, height: 320 - i * 12 }
              ]}
            />
          );
        })}

        {/* small rotating shapes for extra flash */}
        {smallShapes.map((anim, i) => {
          const rot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
          const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.18, 0] });
          return (
            <Animated.View
              key={`shape-${i}`}
              style={[styles.smallShape, { transform: [{ rotate: rot }], opacity, left: `${5 + i * 11}%`, top: `${10 + i * 8}%`, backgroundColor: i % 2 ? '#FF3DFF' : '#7DF9FF' }]}
            />
          );
        })}

        {/* Diagonal streaks */}
        {streaks.map((anim, i) => {
          const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-(200 + i * 80), 200 + i * 80] });
          const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.12, 0] });
          return (
            <Animated.View
              key={`streak-${i}`}
              style={[styles.streak, { transform: [{ translateX }, { rotate: '-18deg' }], opacity, backgroundColor: i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(66,133,244,0.04)' }]}
            />
          );
        })}

        {/* Top gradient highlight */}
        <Animated.View style={styles.gradientOverlay} />
      </View>
    );
  };

  useEffect(() => {
    setTimeout(() => setLoading(false), 2000);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <AnimatedLogo size={120} />
        <Text style={styles.loadingText}>
          Please wait while we prepare things for you...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedBackground />
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to HIFIX</Text>
          <Text style={styles.subtitle}>Find trusted local service workers</Text>
        </View>

        <View style={[styles.featuredCard, styles.gradientPrimary]}>
          <Text style={styles.featuredTitle}>Featured Services</Text>
          <Text style={styles.featuredText}>
            Discover top-rated professionals in your area
          </Text>
        </View>

        <View style={styles.serviceGrid}>
          {services.map((service) => {
            const animations = serviceAnimations[service.key];
            const rotate = animations.rotation.interpolate({
              inputRange: [0, 1],
              outputRange: ['-5deg', '5deg']
            });
            const glowOpacity = animations.glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1]
            });
            
            return (
              <View
                key={service.name}
                style={[styles.serviceItem, { width: serviceItemWidth }]}
              >
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Workers', { service: service.key })}
                  activeOpacity={0.7}
                  style={styles.serviceTouchable}
                >
                  <Animated.View 
                    style={[
                      styles.iconContainer,
                      {
                        transform: [
                          { scale: animations.scale },
                          { rotate }
                        ],
                        backgroundColor: `${service.color}15`,
                      }
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.innerGlow,
                        {
                          backgroundColor: service.color,
                          opacity: glowOpacity,
                        }
                      ]}
                    />
                    <Icon 
                      name={service.icon} 
                      size={40} 
                      color={service.color}
                      style={styles.serviceIcon}
                    />
                    <Text style={[styles.serviceButtonText, { color: service.color }]}>
                      {service.name}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  serviceTouchable: {
    width: '100%',
    aspectRatio: 1,
    padding: 12,
  },
  iconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    transform: [{ scale: 1.5 }],
    opacity: 0.15,
    filter: Platform.OS === 'web' ? 'blur(20px)' : undefined,
  },
  serviceIcon: {
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
    marginTop: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',
    opacity: 0.8,
  },
  featuredCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    elevation: 5,
  },
  featuredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  featuredText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 'auto',
    maxWidth: 1200,
  },
  serviceItem: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
  },
  serviceButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  gradientPrimary: {
    backgroundColor: '#4285F4',
  },
  animatedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -2,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.3,
    filter: Platform.OS === 'web' ? 'blur(60px)' : undefined,
  },
  streak: {
    position: 'absolute',
    height: 280,
    width: 40,
    left: '-40%',
    top: '10%',
    opacity: 0.08,
    borderRadius: 40,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(66,133,244,0.04)',
    zIndex: -1,
  },
  smallShape: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 6,
    opacity: 0.16,
  },
});