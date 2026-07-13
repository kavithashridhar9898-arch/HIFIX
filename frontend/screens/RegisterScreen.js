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
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';
import Logo from '../components/Logo';
import { signInWithGoogle } from '../config/googleAuth';

let videoSource = null;
try {
  videoSource = require('../assets/videos/login-bg.mp4');
} catch (error) {
  console.log('Video file not found, using fallback background');
}

const RegisterScreen = React.memo(function RegisterScreen({ navigation }) {
  const { register, loginWithGoogle } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    user_type: 'homeowner',
    service_type: 'painter',
  });
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  const handleRegister = async () => {
    const { name, email, phone, password, confirmPassword, user_type, service_type } = formData;

    if (!name || !email || !phone || !password || !confirmPassword) {
      showAlert('Incomplete Form', 'Please fill in all required fields to continue.', 'info');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Passwords Don\'t Match', 'Please ensure both password fields match exactly.', 'error');
      return;
    }
    if (password.length < 6) {
      showAlert('Weak Password', 'Your password must be at least 6 characters long.', 'error');
      return;
    }

    setLoading(true);
    const registerData = {
      name,
      email,
      phone,
      password,
      user_type,
      ...(user_type === 'worker' && { service_type }),
    };

    try {
      const result = await register(registerData);
      if (!result.success) {
        showAlert('Registration Failed', result.message || 'We couldn\'t create your account at this time.', 'error');
      } else {
        showAlert(
          'Account Created',
          'Your account has been successfully created! You can now log in.',
          'success',
          () => navigation.navigate('Login')
        );
      }
    } catch (error) {
      showAlert('Registration Error', error.message || 'An unexpected error occurred during registration.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    try {
      const showMockAlert = (callback) => {
        Alert.alert(
          'Google Sign-In (Expo Go Mock)',
          'Select a mock Google account to register:',
          [
            {
              text: 'Jane Doe (jane_doe@gmail.com)',
              onPress: () => callback('mock_token_jane_doe'),
            },
            {
              text: 'Bob Builder (bob_builder@gmail.com)',
              onPress: () => callback('mock_token_bob_builder'),
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
      
      const { user_type, service_type } = formData;
      const result = await loginWithGoogle(idToken, user_type, user_type === 'worker' ? service_type : null);

      if (result.success) {
        showAlert('Success', 'Google registration successful!', 'success');
      } else {
        showAlert('Registration Failed', result.message || 'Could not register with Google.', 'error');
      }
    } catch (error) {
      if (error.message !== 'User cancelled sign-in') {
        showAlert('Error', error.message || 'An error occurred during Google registration.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {videoSource && (
        <Video
          source={videoSource}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
        />
      )}
      <View style={styles.videoOverlay} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.logoContainer}>
              <Logo size={100} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Create Your Account</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Join the HIFIX community</Text>

            <View style={[styles.form, { 
              backgroundColor: isDarkMode ? 'rgba(29, 32, 34, 0.85)' : 'rgba(255, 255, 255, 0.9)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
            }]}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Full Name"
                placeholderTextColor={colors.textSecondary}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Email Address"
                placeholderTextColor={colors.textSecondary}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Phone Number"
                placeholderTextColor={colors.textSecondary}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />

              <View style={styles.userTypeContainer}>
                <TouchableOpacity
                  style={[styles.userTypeButton, formData.user_type === 'homeowner' && styles.userTypeButtonActive]}
                  onPress={() => setFormData({ ...formData, user_type: 'homeowner' })}
                >
                  <Text style={[styles.userTypeButtonText, { color: formData.user_type === 'homeowner' ? '#fff' : colors.text }]}>Homeowner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.userTypeButton, formData.user_type === 'worker' && styles.userTypeButtonActive]}
                  onPress={() => setFormData({ ...formData, user_type: 'worker' })}
                >
                  <Text style={[styles.userTypeButtonText, { color: formData.user_type === 'worker' ? '#fff' : colors.text }]}>Service Worker</Text>
                </TouchableOpacity>
              </View>

              {formData.user_type === 'worker' && (
                <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Picker
                    selectedValue={formData.service_type}
                    onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                    style={[styles.picker, { color: colors.text }]}
                    itemStyle={{ color: colors.text, backgroundColor: colors.surface }}
                  >
                    <Picker.Item label="Painter" value="painter" />
                    <Picker.Item label="Electrician" value="electrician" />
                    <Picker.Item label="Plumber" value="plumber" />
                    <Picker.Item label="Carpenter" value="carpenter" />
                    <Picker.Item label="Handyman" value="handyman" />
                    <Picker.Item label="HVAC" value="hvac" />
                  </Picker>
                </View>
              )}

              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textSecondary}
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, loading && styles.buttonDisabled]}
                onPress={handleGoogleRegister}
                disabled={loading}
              >
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

export default RegisterScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101415',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 20, 21, 0.8)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#c3c6d7',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    backgroundColor: 'rgba(29, 32, 34, 0.85)',
    borderRadius: 24,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  userTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userTypeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  userTypeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  picker: {
    color: '#fff',
  },
  pickerItem: {
    color: '#fff',
    backgroundColor: '#1d2022',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#ccc',
  },
  footerLink: {
    color: '#7bd0ff',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#c3c6d7',
    fontSize: 12,
    marginHorizontal: 10,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    resizeMode: 'contain',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
});