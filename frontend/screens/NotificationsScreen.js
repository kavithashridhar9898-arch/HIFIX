import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  FlatList,
  RefreshControl,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationsScreen = React.memo(function NotificationsScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('history');
  const [refreshing, setRefreshing] = useState(false);

  // Hook into our new context
  const {
    notifications,
    preferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount
  } = useNotifications();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUnreadCount();
    setRefreshing(false);
  };

  // Preferences Mapping
  const dbKeyMapping = {
    pushNotifications: 'push_notifications',
    emailNotifications: 'email_notifications',
    bookingUpdates: 'booking_updates',
    newMessages: 'new_messages',
    paymentAlerts: 'payment_alerts',
    promotions: 'promotions'
  };

  const toggleSetting = (key) => {
    const dbKey = dbKeyMapping[key];
    const currentValue = preferences[dbKey] === 1;
    updatePreferences({ [dbKey]: currentValue ? 0 : 1 });
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

  const getIconForType = (type) => {
    switch (type) {
      case 'booking': return 'calendar-today';
      case 'chat': return 'chat';
      case 'payment': return 'payment';
      case 'promotion': return 'local-offer';
      default: return 'notifications';
    }
  };

  const renderNotificationItem = ({ item }) => {
    const isUnread = item.is_read === 0;
    
    return (
      <TouchableOpacity 
        style={[styles.notificationCard, isUnread && styles.unreadCard]}
        onPress={() => {
          if (isUnread) markAsRead(item.id);
          // Navigate based on type (Deep linking)
          if (item.type === 'chat' && item.related_entity_id) {
            navigation.navigate('Chat', { conversationId: item.related_entity_id });
          } else if (item.type === 'booking' && item.related_entity_id) {
             // Assuming we have a BookingDetail screen
             navigation.navigate('Bookings');
          }
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: isUnread ? 'rgba(66, 133, 244, 0.2)' : 'rgba(255, 255, 255, 0.05)' }]}>
          <Icon name={getIconForType(item.type)} size={24} color={isUnread ? colors.primary : '#888'} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.notificationTitle, isUnread && styles.unreadText]}>{item.title}</Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notificationTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {activeTab === 'history' && notifications.some(n => n.is_read === 0) && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
              <Icon name="done-all" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.activeTab, { borderBottomColor: colors.primary }]} 
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && { color: colors.primary, fontWeight: 'bold' }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'preferences' && styles.activeTab, { borderBottomColor: colors.primary }]} 
            onPress={() => setActiveTab('preferences')}
          >
            <Text style={[styles.tabText, activeTab === 'preferences' && { color: colors.primary, fontWeight: 'bold' }]}>Preferences</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'preferences' ? (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              {notificationSettings.map((item) => (
                <View key={item.key} style={styles.settingItem}>
                  <View style={styles.iconContainerPref}>
                    <Icon name={item.icon} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingDescription}>{item.description}</Text>
                  </View>
                  <Switch
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={preferences[dbKeyMapping[item.key]] === 1 ? colors.primary : '#f4f3f4'}
                    onValueChange={() => toggleSetting(item.key)}
                    value={preferences[dbKeyMapping[item.key]] === 1}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={item => item.id.toString()}
            renderItem={renderNotificationItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="notifications-none" size={60} color="#555" />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
});

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    justifyContent: 'space-between'
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: 15,
  },
  markAllBtn: {
    padding: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    // border color applied inline
  },
  tabText: {
    color: '#aaa',
    fontSize: 16,
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  iconContainerPref: {
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
  listContainer: {
    padding: 15,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },
  unreadCard: {
    backgroundColor: '#252a30',
    borderLeftWidth: 3,
    borderLeftColor: '#4285F4',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  notificationTitle: {
    fontSize: 16,
    color: '#eee',
    fontWeight: '500',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#fff',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
    marginLeft: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#888',
    marginTop: 10,
    fontSize: 16,
  }
});
