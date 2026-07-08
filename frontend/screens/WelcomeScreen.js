import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Video } from 'expo-av';
import Logo from '../components/Logo';

const WelcomeScreen = React.memo(function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Video
        source={require('../assets/videos/login-bg.mp4')}
        rate={1.0}
        volume={0.0}
        isMuted={true}
        resizeMode="cover"
        shouldPlay
        isLooping
        style={styles.backgroundVideo}
      />
      <View style={styles.overlay} />
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Logo size={180} />
        <Text style={styles.title}>Welcome to HIFIX</Text>
        <Text style={styles.subtitle}>
          Your one-stop solution for home services.
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.primaryButtonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.secondaryButtonText}>Create an Account</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
});

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 2,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#eee',
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
    backgroundColor: '#2563eb',
    paddingVertical: 18,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#2563eb',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 20,
    fontWeight: 'bold',
  },
});