import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { api } from '../config/api';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export default function SecurityScreen({ navigation }) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({
    twoFactorAuth: false,
    biometricAuth: false,
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef([]);

  // Check biometric availability on mount
  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSetting();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setBiometricAvailable(compatible && enrolled);
      
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Fingerprint');
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType('Iris');
      } else {
        setBiometricType('Biometric');
      }
    } catch (error) {
      console.error('Biometric check error:', error);
      setBiometricAvailable(false);
    }
  };

  const loadBiometricSetting = async () => {
    try {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      if (enabled === 'true') {
        setSettings(prev => ({ ...prev, biometricAuth: true }));
      }
    } catch (error) {
      console.error('Error loading biometric setting:', error);
    }
  };

  const toggleBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert(
        'Biometric Not Available',
        'Your device does not support biometric authentication or you have not set it up in your device settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!settings.biometricAuth) {
      // Enabling biometric - authenticate first
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await AsyncStorage.setItem('biometricEnabled', 'true');
        setSettings(prev => ({ ...prev, biometricAuth: true }));
        Alert.alert('Success', `${biometricType} authentication enabled for login`);
      } else {
        Alert.alert('Failed', 'Biometric authentication failed. Please try again.');
      }
    } else {
      // Disabling biometric
      Alert.alert(
        'Disable Biometric?',
        `Are you sure you want to disable ${biometricType} authentication?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.setItem('biometricEnabled', 'false');
              setSettings(prev => ({ ...prev, biometricAuth: false }));
              Alert.alert('Disabled', 'Biometric authentication has been disabled');
            },
          },
        ]
      );
    }
  };

  // Timer for resend OTP
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const toggleSetting = (key) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleRequestOTP = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/request-password-otp');
      if (response.data.success) {
        setOtpSent(true);
        setResendTimer(60); // 60 seconds cooldown
        setShowPasswordModal(false);
        setShowOTPModal(true);
        
        // If email not configured, show OTP in alert
        if (!response.data.emailSent && response.data.otp) {
          Alert.alert(
            'Email Not Configured',
            `OTP: ${response.data.otp}\n\nEmail is not configured on the server. Use this OTP to continue.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Success', 'OTP sent to your email. Please check your inbox.');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (value, index) => {
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter complete OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', { otp: otpString });
      if (response.data.success) {
        setShowOTPModal(false);
        setShowNewPasswordModal(true);
        Alert.alert('Success', 'OTP verified! Now set your new password.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid OTP');
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/change-password-with-otp', {
        newPassword: passwordData.newPassword,
      });
      if (response.data.success) {
        Alert.alert('Success', 'Password changed successfully');
        setShowNewPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setOtp(['', '', '', '', '', '']);
        setOtpSent(false);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const securityItems = [
    {
      icon: 'lock',
      title: 'Change Password',
      description: 'Update your account password',
      action: () => setShowPasswordModal(true),
    },
    {
      icon: 'verified-user',
      title: 'Two-Factor Authentication',
      description: 'Add an extra layer of security',
      toggle: true,
      key: 'twoFactorAuth',
      disabled: true, // Not yet implemented
    },
    {
      icon: 'fingerprint',
      title: biometricType ? `${biometricType} Authentication` : 'Biometric Authentication',
      description: biometricAvailable 
        ? `Use ${biometricType || 'biometric'} to login quickly and securely`
        : 'Not available on this device',
      toggle: true,
      key: 'biometricAuth',
      customToggle: toggleBiometric,
    },
    {
      icon: 'devices',
      title: 'Active Sessions',
      description: 'Manage your logged-in devices',
      action: () => {},
      disabled: true, // Not yet implemented
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Security</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          {securityItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.securityItem, item.disabled && styles.disabledItem, { borderBottomColor: colors.border }]}
              onPress={item.action}
              disabled={item.toggle || item.disabled}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}10` }]}>
                <Icon name={item.icon} size={24} color={item.disabled ? colors.textSecondary : colors.primary} />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, item.disabled && styles.disabledText, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.itemDescription, item.disabled && styles.disabledText, { color: colors.textSecondary }]}>
                  {item.description}
                </Text>
              </View>
              {item.toggle ? (
                <Switch
                  trackColor={{ false: colors.border, true: `${colors.primary}80` }}
                  thumbColor={settings[item.key] ? colors.primary : colors.surface}
                  onValueChange={item.customToggle || (() => toggleSetting(item.key))}
                  value={settings[item.key]}
                  disabled={item.disabled}
                />
              ) : (
                !item.disabled && <Icon name="chevron-right" size={24} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Change Password Modal - Initial */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.infoBox, { backgroundColor: `${colors.primary}10` }]}>
              <Icon name="security" size={24} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                For security, we'll send an OTP to your email to verify your identity
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.disabledButton, { backgroundColor: colors.primary }]} 
              onPress={handleRequestOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="email" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.saveButtonText}>Send OTP to Email</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal
        visible={showOTPModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOTPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Enter OTP</Text>
              <TouchableOpacity onPress={() => {
                setShowOTPModal(false);
                setOtp(['', '', '', '', '', '']);
              }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.otpDescription, { color: colors.textSecondary }]}>
              We've sent a 6-digit code to your email. Enter it below:
            </Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (otpInputs.current[index] = ref)}
                  style={[styles.otpInput, { borderColor: colors.primary, color: colors.text, backgroundColor: colors.background }]}
                  value={digit}
                  onChangeText={(value) => handleOTPChange(value, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  placeholderTextColor={colors.textSecondary}
                />
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.disabledButton, { backgroundColor: colors.primary }]} 
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.resendButton}
              onPress={handleRequestOTP}
              disabled={resendTimer > 0}
            >
              <Text style={[styles.resendText, resendTimer > 0 && styles.disabledText, { color: resendTimer > 0 ? colors.textSecondary : colors.primary }]}>
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Password Modal */}
      <Modal
        visible={showNewPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Set New Password</Text>
              <TouchableOpacity onPress={() => setShowNewPasswordModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="New Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm New Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
            />

            <View style={[styles.passwordRequirements, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[styles.requirementText, { color: colors.textSecondary }]}>• At least 6 characters</Text>
              <Text style={[styles.requirementText, { color: colors.textSecondary }]}>• Contains letters and numbers</Text>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.disabledButton, { backgroundColor: colors.primary }]} 
              onPress={handleChangePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  input: {
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
  },
  saveButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  otpDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 24,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  passwordRequirements: {
    marginBottom: 15,
    padding: 10,
    borderRadius: 8,
  },
  requirementText: {
    fontSize: 13,
    marginVertical: 2,
  },
  disabledItem: {
    opacity: 0.5,
  },
});
