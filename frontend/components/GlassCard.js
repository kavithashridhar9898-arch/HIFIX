import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function GlassCard({
  children,
  style,
  onPress,
  activeOpacity = 0.85,
  variant = 'default', // 'default' | 'compact' | 'modal'
  disabled = false,
  ...props
}) {
  const { colors, isDarkMode } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress || disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress || disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const getBorderRadius = () => {
    if (variant === 'modal') return 24;
    if (variant === 'compact') return 16;
    return 20; // default primary card radius
  };

  const cardStyle = [
    styles.card,
    {
      borderRadius: getBorderRadius(),
      backgroundColor: isDarkMode
        ? 'rgba(29, 32, 34, 0.82)'
        : 'rgba(255, 255, 255, 0.88)',
      borderColor: isDarkMode
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(37, 99, 235, 0.12)',
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        {...props}
      >
        <Animated.View style={[cardStyle, { transform: [{ scale: scaleAnim }] }]}>
          {children}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
});
