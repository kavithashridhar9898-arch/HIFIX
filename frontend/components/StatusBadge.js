import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';

export default function StatusBadge({ status, type = 'status', style, textStyle }) {
  const { colors, isDarkMode } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [status]);

  const getBadgeConfig = () => {
    const val = String(status || '').toLowerCase();

    // Urgency / Safety types
    if (type === 'urgency') {
      if (val.includes('emergency') || val.includes('high')) {
        return { bg: 'rgba(239, 68, 68, 0.18)', border: '#EF4444', text: '#EF4444', icon: 'warning' };
      }
      if (val.includes('medium') || val.includes('moderate')) {
        return { bg: 'rgba(245, 158, 11, 0.18)', border: '#F59E0B', text: '#F59E0B', icon: 'info' };
      }
      return { bg: 'rgba(16, 185, 129, 0.18)', border: '#10B981', text: '#10B981', icon: 'check-circle' };
    }

    // Booking Status types
    switch (val) {
      case 'accepted':
      case 'in_progress':
      case 'active':
        return { bg: 'rgba(56, 189, 248, 0.18)', border: '#38BDF8', text: '#38BDF8', icon: 'sync' };
      case 'completed':
        return { bg: 'rgba(16, 185, 129, 0.18)', border: '#10B981', text: '#10B981', icon: 'check' };
      case 'cancelled':
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.18)', border: '#EF4444', text: '#EF4444', icon: 'close' };
      case 'pending':
      default:
        return { bg: 'rgba(245, 158, 11, 0.18)', border: '#F59E0B', text: '#F59E0B', icon: 'schedule' };
    }
  };

  const config = getBadgeConfig();
  const label = (status || 'Pending').replace('_', ' ').toUpperCase();

  return (
    <Animated.View style={[{ opacity: fadeAnim }, styles.badge, { backgroundColor: config.bg, borderColor: config.border }, style]}>
      {config.icon && <Icon name={config.icon} size={12} color={config.text} style={styles.icon} />}
      <Text style={[styles.text, { color: config.text }, textStyle]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
