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
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';

export default function ServiceRequestScreen({ route, navigation }) {
  const { worker } = route.params;
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestService = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the service you need.');
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
        Alert.alert(
          'Request Sent',
          'Your service request has been sent to the worker. You will be notified when they respond.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to send service request.');
      }
    } catch (error) {
      console.error('Service request error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
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
            style={[styles.requestButton, loading && styles.disabledButton]}
            onPress={handleRequestService}
            disabled={loading}
          >
            <Text style={styles.requestButtonText}>
              {loading ? 'Sending...' : 'Send Request'}
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
