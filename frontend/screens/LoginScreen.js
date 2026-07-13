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
  Modal,
  Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Logo from '../components/Logo';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { Picker } from '@react-native-picker/picker';
import { signInWithGoogle } from '../config/googleAuth';

const { width, height } = Dimensions.get('window');

// Try to load video, fallback to null if it doesn't exist
let videoSource = null;
try {
  videoSource = require('../assets/videos/login-bg.mp4');
} catch (error) {
  console.log('Video file not found, using fallback background');
  videoSource = null;
}

const LoginScreen = React.memo(function LoginScreen({ navigation }) {
  const { login, loginWithGoogle } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [googleToken, setGoogleToken] = useState('');
  const [selectedRole, setSelectedRole] = useState('homeowner');
  const [selectedServiceType, setSelectedServiceType] = useState('painter');
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
            showAlert('Login Failed', 'Biometric authentication succeeded but login failed. Please try manual login.', 'error');
          } finally {
            setLoading(false);
          }
        } else {
          showAlert('Credentials Not Found', 'No saved credentials found. Please login manually first.', 'info');
        }
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      showAlert('Authentication Failed', 'Biometric authentication failed. Please try again.', 'error');
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
      showAlert('Email and Password Required', 'Please fill in both email and password to sign in.', 'info');
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
      
      if (result.success) {
        // Save credentials if biometric is enabled
        const biometricEnabled = await AsyncStorage.getItem('biometricEnabled');
        if (biometricEnabled === 'true') {
          await AsyncStorage.setItem('userEmail', email);
          await AsyncStorage.setItem('userPassword', password);
        }
      } else {
        showAlert('Login Failed', result.message || 'The credentials you entered are incorrect.', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showAlert(
        'Connection Error',
        'We couldn\'t connect to our servers. Please check your internet connection and try again.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const showMockAlert = (callback) => {
        Alert.alert(
          'Google Sign-In (Expo Go Mock)',
          'Select a mock Google account:',
          [
            {
              text: 'Existing User (John Doe - Homeowner)',
              onPress: () => callback('mock_token_john_doe'),
            },
            {
              text: 'New User (Alice - Homeowner/Worker)',
              onPress: () => callback('mock_token_alice_smith'),
            },
            {
              text: 'Cancel',
              onPress: () => callback(null),
              style: 'cancel',
            },
          ],
          { cancelable: true }
        );
      };

      const { idToken } = await signInWithGoogle(showMockAlert);
      
      const result = await loginWithGoogle(idToken);

      if (result.success) {
        // Logged in successfully
      } else if (result.code === 'ROLE_REQUIRED') {
        setGoogleToken(idToken);
        setRoleModalVisible(true);
      } else {
        showAlert('Authentication Failed', result.message || 'Could not verify with Google.', 'error');
      }
    } catch (error) {
      if (error.message !== 'User cancelled sign-in') {
        showAlert('Error', error.message || 'An error occurred during Google sign-in.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegistrationSubmit = async () => {
    setRoleModalVisible(false);
    setLoading(true);
    try {
      const result = await loginWithGoogle(
        googleToken,
        selectedRole,
        selectedRole === 'worker' ? selectedServiceType : null
      );

      if (result.success) {
        // Logged in successfully
      } else {
        showAlert('Registration Failed', result.message || 'Could not complete registration.', 'error');
      }
    } catch (error) {
      showAlert('Error', error.message || 'An error occurred during registration.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Video Background with Fallback */}
      <View style={styles.videoContainer} pointerEvents="none">
        {videoSource ? (
          <Video
            ref={videoRef}
            source={videoSource}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
            onPlaybackStatusUpdate={(status) => setVideoStatus(status)}
            onError={(error) => {
              console.log('Video playback error:', error);
            }}
          />
        ) : (
          <View style={styles.gradientFallback}>
            {/* Animated gradient background */}
            <View style={styles.gradient1} />
            <View style={styles.gradient2} />
          </View>
        )}
        <View style={styles.videoOverlay} pointerEvents="none" />
      </View>

      {/* Animated Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
          <Text style={[styles.title, { color: '#FFFFFF' }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>Sign in to continue</Text>
        </Animated.View>          <Animated.View
            style={[
              styles.form,
              {
                backgroundColor: isDarkMode ? 'rgba(44, 44, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: isDarkMode ? 'rgba(66, 133, 244, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
              },
            ]}
          >
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

            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
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

            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[
                  styles.googleButton,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#E0E0E0',
                  }
                ]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={styles.googleIcon}
                />
                <Text style={[styles.googleButtonText, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                  Continue with Google
                </Text>
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
                <TouchableOpacity
                  style={[styles.biometricButton, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30`, marginTop: 15 }]}
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

      {/* Role Selection Modal for Google Auth */}
      <Modal
        visible={roleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            {
              backgroundColor: isDarkMode ? '#1E2224' : '#FFFFFF',
              borderColor: colors.border
            }
          ]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Account Type</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              To complete your registration, please select whether you are a Homeowner or a Service Worker.
            </Text>

            <View style={styles.roleSelectionContainer}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'homeowner' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setSelectedRole('homeowner')}
              >
                <Icon name="home" size={28} color={selectedRole === 'homeowner' ? '#FFF' : colors.text} />
                <Text style={[styles.roleButtonText, { color: selectedRole === 'homeowner' ? '#FFF' : colors.text }]}>
                  Homeowner
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'worker' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setSelectedRole('worker')}
              >
                <Icon name="construction" size={28} color={selectedRole === 'worker' ? '#FFF' : colors.text} />
                <Text style={[styles.roleButtonText, { color: selectedRole === 'worker' ? '#FFF' : colors.text }]}>
                  Service Worker
                </Text>
              </TouchableOpacity>
            </View>

            {selectedRole === 'worker' && (
              <View style={styles.pickerWrapper}>
                <Text style={[styles.pickerLabel, { color: colors.text }]}>Select Service Type</Text>
                <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Picker
                    selectedValue={selectedServiceType}
                    onValueChange={(itemValue) => setSelectedServiceType(itemValue)}
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Painter" value="painter" />
                    <Picker.Item label="Electrician" value="electrician" />
                    <Picker.Item label="Plumber" value="plumber" />
                    <Picker.Item label="Carpenter" value="carpenter" />
                    <Picker.Item label="Handyman" value="handyman" />
                    <Picker.Item label="HVAC" value="hvac" />
                  </Picker>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setRoleModalVisible(false)}
              >
                <Text style={[styles.modalCancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]}
                onPress={handleGoogleRegistrationSubmit}
              >
                <Text style={styles.modalSubmitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
});

export default LoginScreen;

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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
    shadowColor: '#2563eb',
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    resizeMode: 'contain',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 25,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  roleSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  roleButtonText: {
    marginTop: 8,
    fontWeight: '600',
  },
  pickerWrapper: {
    marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 10,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 10,
  },
  modalSubmitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
