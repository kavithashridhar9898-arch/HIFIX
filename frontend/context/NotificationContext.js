import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { api } from '../config/api';

// Optional imports (they will be active once native client builds)
let messaging = null;
let notifee = null;
let EventType = null;
let AndroidImportance = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default;
  EventType = notifeeModule.EventType;
  AndroidImportance = notifeeModule.AndroidImportance;
} catch (e) {
  console.log('Firebase/Notifee not available in Expo Go. Will use fallback mechanism.');
}

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const socket = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({});

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      fetchPreferences();
      setupPushNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (socket && user) {
      socket.on('new_notification', handleRealtimeNotification);
      socket.on('unread_notification_count', (data) => setUnreadCount(data.count));

      return () => {
        socket.off('new_notification');
        socket.off('unread_notification_count');
      };
    }
  }, [socket, user]);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setUnreadCount(res.data.unreadCount);
        setNotifications(res.data.notifications);
      }
    } catch (e) {
      console.log('Error fetching notifications:', e);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data.success) {
        setPreferences(res.data.preferences);
      }
    } catch (e) {
      console.log('Error fetching preferences:', e);
    }
  };

  const setupPushNotifications = async () => {
    if (!messaging || !notifee) return;

    try {
      // 1. Request permissions (iOS)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permissions granted.');
        
        // 2. Get FCM Token
        const token = await messaging().getToken();
        await registerDeviceToken(token);

        // Listen for token refresh
        messaging().onTokenRefresh(registerDeviceToken);

        // 3. Create Android Channel for Notifee
        await notifee.createChannel({
          id: 'default',
          name: 'Default Channel',
          importance: AndroidImportance.HIGH,
        });

        // 4. Handle Foreground Messages
        messaging().onMessage(async (remoteMessage) => {
          console.log('A new FCM message arrived!', remoteMessage);
          
          // Display rich notification via Notifee
          await notifee.displayNotification({
            title: remoteMessage.notification?.title || 'New Notification',
            body: remoteMessage.notification?.body || '',
            android: {
              channelId: 'default',
              pressAction: {
                id: 'default',
              },
            },
            data: remoteMessage.data,
          });

          // Unread count is updated via Socket.IO, but if needed, we fetch
          fetchUnreadCount();
        });
      }
    } catch (error) {
      console.log('FCM setup failed:', error);
    }
  };

  const registerDeviceToken = async (token) => {
    try {
      await api.post('/notifications/token', {
        fcm_token: token,
        device_type: Platform.OS,
      });
    } catch (error) {
      console.log('Failed to register device token:', error);
    }
  };

  const handleRealtimeNotification = (payload) => {
    setNotifications((prev) => [payload, ...prev]);
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/read/${id}`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.log('Failed to mark as read', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.log('Failed to mark all as read', e);
    }
  };

  const updatePreferences = async (newPrefs) => {
    try {
      await api.put('/notifications/preferences', newPrefs);
      setPreferences(prev => ({ ...prev, ...newPrefs }));
    } catch (e) {
      console.log('Failed to update preferences', e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        preferences,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        updatePreferences
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
