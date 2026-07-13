import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';
import Logo from '../components/Logo';
import { api } from '../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

// Try to load video, fallback to null if it doesn't exist
let videoSource = null;
try {
  videoSource = require('../assets/videos/login-bg.mp4');
} catch (error) {
  console.log('Video file not found, using fallback background');
  videoSource = null;
}

const ForgotPasswordScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useTheme();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [videoStatus, setVideoStatus] = useState({});
  const videoRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Play video when screen mounts
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playAsync().catch(console.log);
    }
  }, []);

  useEffect(() => {
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
    ]).start();
  }, []);

  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleRequestOTP = async () => {
    if (!email) {
      showAlert('Email Required', 'Please enter your email address.', 'info');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data.success) {
        setStep(2);
        setCountdown(60);
        if (response.data.emailSent === false && response.data.otp) {
          showAlert('Email Configuration Error', `Could not send email. Use this OTP to continue testing: ${response.data.otp}`, 'warning');
        }
      } else {
        showAlert('Error', response.data.message, 'error');
      }
    } catch (error) {
      if (error.response?.status === 429) {
        showAlert('Please Wait', 'You must wait 60 seconds before requesting another OTP.', 'warning');
      } else {
        showAlert('Error', error.response?.data?.message || 'Failed to send OTP.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      showAlert('OTP Required', 'Please enter the 6-digit OTP sent to your email.', 'info');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-forgot-password-otp', { email, otp });
      if (response.data.success) {
        setStep(3);
      } else {
        showAlert('Error', response.data.message, 'error');
      }
    } catch (error) {
      showAlert('Verification Failed', error.response?.data?.message || 'Invalid OTP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      showAlert('Required Fields', 'Please enter and confirm your new password.', 'info');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Passwords Don\'t Match', 'The passwords you entered do not match.', 'error');
      return;
    }
    if (password.length < 6) {
      showAlert('Weak Password', 'Your password must be at least 6 characters.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', { email, password });
      if (response.data.success) {
        showAlert('Password Reset', 'Your password has been reset successfully!', 'success', () => {
          navigation.navigate('Login');
        });
      } else {
        showAlert('Error', response.data.message, 'error');
      }
    } catch (error) {
      showAlert('Reset Failed', error.response?.data?.message || 'Failed to reset password.', 'error');
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
            <View style={styles.gradient1} />
            <View style={styles.gradient2} />
          </View>
        )}
        <View style={styles.videoOverlay} pointerEvents="none" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Login')}>
            <Icon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', width: '100%' }}>
            <Logo size={100} />
            <Text style={[styles.title, { color: '#FFFFFF' }]}>
              {step === 1 ? 'Forgot Password' : step === 2 ? 'Verify OTP' : 'Reset Password'}
            </Text>
            <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              {step === 1 ? 'Enter your email to receive a reset code' : 
               step === 2 ? `We sent a code to ${email}` : 
               'Create a new strong password'}
            </Text>

            <View style={[styles.form, { 
              backgroundColor: isDarkMode ? 'rgba(44, 44, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
              borderColor: isDarkMode ? 'rgba(66, 133, 244, 0.2)' : 'rgba(0, 0, 0, 0.1)' 
            }]}>
              
              {step === 1 && (
                <>
                  <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.primary }]}
                    onPress={handleRequestOTP}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
                  </TouchableOpacity>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={[styles.label, { color: colors.text }]}>6-Digit OTP</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, textAlign: 'center', fontSize: 24, letterSpacing: 5 }]}
                    placeholder="••••••"
                    placeholderTextColor={colors.textSecondary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.primary }]}
                    onPress={handleVerifyOTP}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Code</Text>}
                  </TouchableOpacity>

                  <View style={styles.resendContainer}>
                    <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                      {countdown > 0 ? `Resend code in ${countdown}s` : 'Didn\'t receive a code?'}
                    </Text>
                    {countdown === 0 && (
                      <TouchableOpacity onPress={handleRequestOTP} disabled={loading}>
                        <Text style={[styles.resendLink, { color: colors.primary }]}> Resend</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {step === 3 && (
                <>
                  <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                  
                  <Text style={[styles.label, { color: colors.text, marginTop: 10 }]}>Confirm Password</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.primary, marginTop: 20 }]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
                  </TouchableOpacity>
                </>
              )}

            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;

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
    alignItems: 'center',
    paddingTop: 80,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  form: {
    width: '100%',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
