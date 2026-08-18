import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import GlassCard from './GlassCard';

export default function SkeletonLoader({ style, count = 3 }) {
  const { isDarkMode } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 0.7,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.3,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);
    const loop = Animated.loop(pulse);
    loop.start();
    return () => loop.stop();
  }, []);

  const skeletonColor = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View style={[styles.container, style]}>
      {[...Array(count)].map((_, i) => (
        <GlassCard key={`skel-${i}`} style={styles.card}>
          <View style={styles.row}>
            <Animated.View style={[styles.avatar, { backgroundColor: skeletonColor, opacity: opacityAnim }]} />
            <View style={styles.content}>
              <Animated.View style={[styles.titleLine, { backgroundColor: skeletonColor, opacity: opacityAnim }]} />
              <Animated.View style={[styles.subtitleLine, { backgroundColor: skeletonColor, opacity: opacityAnim }]} />
              <Animated.View style={[styles.shortLine, { backgroundColor: skeletonColor, opacity: opacityAnim }]} />
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  titleLine: {
    height: 16,
    width: '70%',
    borderRadius: 8,
  },
  subtitleLine: {
    height: 12,
    width: '50%',
    borderRadius: 6,
  },
  shortLine: {
    height: 10,
    width: '30%',
    borderRadius: 5,
  },
});
