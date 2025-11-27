import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import AuroraBackground from '../components/AuroraBackground';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

// Try to load video, fallback to null if it doesn't exist
let videoSource = null;
try {
  videoSource = require('../assets/videos/login-bg.mp4');
} catch (error) {
  console.log('Video file not found, using fallback background');
  videoSource = null;
}

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const videoRef = useRef(null);
  const [videoStatus, setVideoStatus] = useState({});
  
  // Check biometric availability on mount
  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    try {
      const biometricEnabled = await AsyncStorage.getItem('biometricEnabled');
      const savedEmail = await AsyncStorage.getItem('userEmail');
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (biometricEnabled === 'true' && savedEmail && compatible && enrolled) {
        setBiometricAvailable(true);
        setEmail(savedEmail);
      }
    } catch (error) {
      console.error('Biometric check error:', error);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with biometrics',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        const savedEmail = await AsyncStorage.getItem('userEmail');
        const savedPassword = await AsyncStorage.getItem('userPassword');
        
        if (savedEmail && savedPassword) {
          setLoading(true);
          try {
            await login(savedEmail, savedPassword);
          } catch (error) {
            Alert.alert('Login Failed', 'Biometric authentication succeeded but login failed. Please try manual login.');
          } finally {
            setLoading(false);
          }
        } else {
          Alert.alert('Error', 'No saved credentials found. Please login manually first.');
        }
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      Alert.alert('Error', 'Biometric authentication failed');
    }
  };
  
  // Play video when screen mounts
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playAsync().catch(console.log);
    }
  }, []);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const emailBorderAnim = useRef(new Animated.Value(0)).current;
  const passwordBorderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Animate email input border on focus
    Animated.timing(emailBorderAnim, {
      toValue: emailFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [emailFocused]);

  useEffect(() => {
    // Animate password input border on focus
    Animated.timing(passwordBorderAnim, {
      toValue: passwordFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [passwordFocused]);

  const handleLogin = async () => {
    if (!email || !password) {
      // Shake animation for error
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const result = await login(email, password);
      console.log('Login result:', result);
      if (result.success) {
        // Save credentials if biometric is enabled
        const biometricEnabled = await AsyncStorage.getItem('biometricEnabled');
        if (biometricEnabled === 'true') {
          await AsyncStorage.setItem('userEmail', email);
          await AsyncStorage.setItem('userPassword', password);
        }
        // Navigate to Home screen after successful login
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        Alert.alert('Login Failed', String(result.message) || 'Unable to connect to server. Please check your connection.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please make sure:\n\n• Backend server is running\n• You are using the correct IP address\n• Both devices are on the same network'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Video Background */}
      {videoSource ? (
        <View style={styles.videoContainer} pointerEvents="none">
          <Video
            ref={videoRef}
            source={videoSource}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
            isMuted
            onError={e => console.log('Video error:', e)}
          />
          <View style={styles.videoOverlay} />
        </View>
      ) : (
        <AuroraBackground />
      )}

      {/* Animated Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ...existing code for logo, form, etc... */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Logo size={120} style={styles.logo} />
          </Animated.View>

          <Animated.View
            style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to continue</Text>
        </Animated.View>
          {/* ...existing code for form, buttons, etc... */}
          <Animated.View
            style={[
              styles.form,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
              },
            ]}
          >
            {/* ...existing code for inputs, buttons, etc... */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <Animated.View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: emailBorderAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [colors.border, colors.primary],
                    }),
                    borderWidth: emailBorderAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </Animated.View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <Animated.View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: passwordBorderAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [colors.border, colors.primary],
                    }),
                    borderWidth: passwordBorderAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </Animated.View>
            </View>

            <Animated.View
              style={{
                transform: [{ scale: buttonScale }],
              }}
            >
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.primary }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Sign In</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {biometricAvailable && (
              <Animated.View
                style={[
                  styles.biometricContainer,
                  {
                    opacity: fadeAnim,
                  },
                ]}
              >
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
                <TouchableOpacity
                  style={[styles.biometricButton, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}
                  onPress={handleBiometricLogin}
                  disabled={loading}
                >
                  <Icon name="fingerprint" size={32} color={colors.primary} />
                  <Text style={[styles.biometricText, { color: colors.primary }]}>Login with Biometrics</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <Animated.View
              style={[
                styles.footer,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.footerLink, { color: colors.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(26, 26, 26, 0.75)',
    zIndex: 1,
  },
  gradientFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  gradient1: {
    position: 'absolute',
    width: width * 1.5,
    height: height * 1.5,
    borderRadius: width,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    top: -height * 0.3,
    left: -width * 0.25,
  },
  gradient2: {
    position: 'absolute',
    width: width * 1.2,
    height: height * 1.2,
    borderRadius: width,
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    bottom: -height * 0.3,
    right: -width * 0.2,
  },
  keyboardView: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    // Additional logo styling if needed
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  form: {
    width: '100%',
    backgroundColor: 'rgba(44, 44, 44, 0.85)',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.2)',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  biometricContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    marginHorizontal: 10,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
