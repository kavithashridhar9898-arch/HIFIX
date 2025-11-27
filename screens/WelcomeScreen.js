import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { Video } from 'expo-av';
import Logo from '../components/Logo';
import { LinearGradient } from 'expo-linear-gradient';
import AuroraBackground from '../components/AuroraBackground';

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScale1 = useRef(new Animated.Value(1)).current;
  const buttonScale2 = useRef(new Animated.Value(1)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 45,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Logo subtle rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      })
    ).start();
  }, []);

  const animateButton = (anim, toValue) => {
    Animated.spring(anim, {
      toValue,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '3deg'],
  });

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View style={styles.container}>
      <AuroraBackground />
      
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Animated.View style={[
            styles.logoContainer,
            { transform: [{ rotate: logoRotation }] }
          ]}>
            <Logo size={180} />
          </Animated.View>

          <Text style={styles.title}>Welcome to HIFIX</Text>
          <Text style={styles.subtitle}>
            Your one-stop solution for home services.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() => animateButton(buttonScale1, 0.95)}
              onPressOut={() => animateButton(buttonScale1, 1)}
              onPress={() => navigation.navigate('Login')}
            >
              <Animated.View style={{ transform: [{ scale: buttonScale1 }] }}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500', '#FF8C00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Animated.View style={[
                    styles.shimmerOverlay,
                    { transform: [{ translateX: shimmerTranslate }] }
                  ]} />
                  <Text style={styles.primaryButtonText}>Login</Text>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
            
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() => animateButton(buttonScale2, 0.95)}
              onPressOut={() => animateButton(buttonScale2, 1)}
              onPress={() => navigation.navigate('Register')}
            >
              <Animated.View style={{ transform: [{ scale: buttonScale2 }] }}>
                <LinearGradient
                  colors={['#C882FF', '#A855F7', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.secondaryButton}
                >
                  <Animated.View style={[
                    styles.shimmerOverlay,
                    { transform: [{ translateX: shimmerTranslate }] }
                  ]} />
                  <Text style={styles.secondaryButtonText}>Create an Account</Text>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 2,
  },
  logoContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 60,
    paddingHorizontal: 20,
    lineHeight: 26,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 12,
    overflow: 'hidden',
  },
  primaryButtonText: {
    color: '#0a0a0f',
    fontSize: 20,
    fontWeight: 'bold',
    zIndex: 2,
  },
  secondaryButton: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C882FF',
    shadowColor: '#C882FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    zIndex: 2,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -100,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ skewX: '-20deg' }],
  },
});