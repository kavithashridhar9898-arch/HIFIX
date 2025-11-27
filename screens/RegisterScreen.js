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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import AuroraBackground from '../components/AuroraBackground';
import { useTheme } from '../context/ThemeContext';

let videoSource = null;
try {
  videoSource = require('../assets/videos/login-bg.mp4');
} catch (error) {
  console.log('Video file not found, using fallback background');
}

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { colors } = useTheme();
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
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
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
        Alert.alert('Registration Failed', result.message || 'An error occurred');
      } else {
        Alert.alert('Success', 'Account created successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
      }
    } catch (error) {
      Alert.alert('Registration Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Video Background */}
      {videoSource ? (
        <View style={styles.video} pointerEvents="none">
          <Video
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.logoContainer}>
              <Logo size={100} />
            </View>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Join the HIFIX community</Text>

            <View style={styles.form}>
              {/* ...existing code for form fields, buttons, etc... */}
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#999"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#999"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />

              <View style={styles.userTypeContainer}>
                <TouchableOpacity
                  style={[styles.userTypeButton, formData.user_type === 'homeowner' && styles.userTypeButtonActive]}
                  onPress={() => setFormData({ ...formData, user_type: 'homeowner' })}
                >
                  <Text style={styles.userTypeButtonText}>Homeowner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.userTypeButton, formData.user_type === 'worker' && styles.userTypeButtonActive]}
                  onPress={() => setFormData({ ...formData, user_type: 'worker' })}
                >
                  <Text style={styles.userTypeButtonText}>Service Worker</Text>
                </TouchableOpacity>
              </View>

              {formData.user_type === 'worker' && (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.service_type}
                    onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
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
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
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

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
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
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    backgroundColor: 'rgba(44, 44, 44, 0.85)',
    borderRadius: 20,
    padding: 25,
  },
  input: {
    backgroundColor: 'rgba(58, 58, 58, 0.8)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  userTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(58, 58, 58, 0.8)',
    marginHorizontal: 5,
  },
  userTypeButtonActive: {
    backgroundColor: '#4285F4',
  },
  userTypeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: 'rgba(58, 58, 58, 0.8)',
    borderRadius: 12,
    marginBottom: 15,
  },
  picker: {
    color: '#fff',
  },
  pickerItem: {
    color: '#fff',
    backgroundColor: '#3A3A3A',
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#ccc',
  },
  footerLink: {
    color: '#4285F4',
    fontWeight: '600',
  },
});