import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import AuroraBackground from '../components/AuroraBackground';

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    bookingUpdates: true,
    promotions: false,
    newMessages: true,
    paymentAlerts: true,
  });

  const toggleSetting = (key) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const notificationSettings = [
    {
      key: 'pushNotifications',
      icon: 'notifications',
      title: 'Push Notifications',
      description: 'Receive push notifications on your device',
    },
    {
      key: 'emailNotifications',
      icon: 'email',
      title: 'Email Notifications',
      description: 'Get updates via email',
    },
    {
      key: 'bookingUpdates',
      icon: 'calendar-today',
      title: 'Booking Updates',
      description: 'Notifications about your bookings',
    },
    {
      key: 'newMessages',
      icon: 'message',
      title: 'New Messages',
      description: 'Alerts for new chat messages',
    },
    {
      key: 'paymentAlerts',
      icon: 'payment',
      title: 'Payment Alerts',
      description: 'Updates about payments and transactions',
    },
    {
      key: 'promotions',
      icon: 'local-offer',
      title: 'Promotions & Offers',
      description: 'Receive promotional messages',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          {notificationSettings.map((item) => (
            <View key={item.key} style={styles.settingItem}>
              <View style={styles.iconContainer}>
                <Icon name={item.icon} size={24} color="#4285F4" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingDescription}>{item.description}</Text>
              </View>
              <Switch
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={settings[item.key] ? '#4285F4' : '#f4f3f4'}
                onValueChange={() => toggleSetting(item.key)}
                value={settings[item.key]}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 15,
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 15,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    padding: 15,
    backgroundColor: '#252525',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  settingDescription: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
});
