import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import PremiumBackground from '../components/PremiumBackground';

const ServiceRequestScreen = React.memo(function ServiceRequestScreen({ route, navigation }) {
  const { worker } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useTheme();
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestService = async () => {
    if (!description.trim()) {
      showAlert('Description Required', 'Please provide a description of the service you need.', 'info');
      return;
    }

    setLoading(true);
    try {
      const bookingData = {
        workerId: worker.id,
        clientId: user.id,
        serviceType: worker.serviceType,
        description,
        bookingDate: date.toISOString(),
        status: 'pending',
      };

      const { data } = await api.post('/bookings/create', bookingData);

      if (data.success) {
        showAlert(
          'Booking Confirmed',
          'Your service request has been sent successfully! The worker will notify you soon.',
          'success',
          () => navigation.goBack()
        );
      } else {
        showAlert('Booking Failed', data.message || 'We couldn\'t complete your booking. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Service request error:', error);
      showAlert('Booking Failed', 'We couldn\'t complete your booking due to a connection issue. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
      >
        <Text style={styles.title}>Request Service</Text>
        <Text style={styles.workerName}>from {worker.name}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Service Description</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe the job in detail..."
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Preferred Date & Time</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
            <Text style={styles.datePickerText}>{date.toLocaleString()}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="datetime"
              is24Hour={true}
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          <TouchableOpacity
            style={[styles.requestButton, loading ? styles.disabledButton : { backgroundColor: colors.primary }]}
            onPress={handleRequestService}
            disabled={loading}
          >
            <Text style={styles.requestButtonText}>
              {loading ? 'Sending...' : 'Send Request'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  </View>
  );
});

export default ServiceRequestScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  workerName: {
    fontSize: 20,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  datePickerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerText: {
    color: '#fff',
    fontSize: 16,
  },
  requestButton: {
    backgroundColor: '#4285F4',
    padding: 18,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#888',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
