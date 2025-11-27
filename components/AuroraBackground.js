import React, { useRef, useEffect } from 'react';
import { View, Dimensions, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function AuroraBackground() {
  const auroraCount = 4;
  const auroras = useRef([...Array(auroraCount)].map((_, i) => ({
    breathe: new Animated.Value(0),
    x: new Animated.Value(Math.random() * 100),
    y: new Animated.Value(20 + i * 25),
    rotate: new Animated.Value(0),
    hue: [280, 320, 45, 300][i],
    baseOpacity: 0.15 + Math.random() * 0.1,
  })) ).current;

  const particleCount = 120;
  const particles = useRef([...Array(particleCount)].map(() => ({
    anim: new Animated.Value(0),
    floatAnim: new Animated.Value(0),
    size: 1 + Math.random() * 4,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 10000,
    duration: 10000 + Math.random() * 15000,
    floatDuration: 3000 + Math.random() * 4000,
    drift: (Math.random() - 0.5) * 40,
    floatRange: 20 + Math.random() * 40,
    hue: Math.random() > 0.5 ? 45 : 280,
    isGolden: Math.random() > 0.5,
  })) ).current;

  useEffect(() => {
    // Aurora breathing animation - smooth expansion and contraction
    auroras.forEach((aurora, i) => {
      const breatheLoop = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(aurora.breathe, {
              toValue: 1,
              duration: 4000 + i * 500,
              useNativeDriver: false,
            }),
            Animated.timing(aurora.breathe, {
              toValue: 0,
              duration: 4000 + i * 500,
              useNativeDriver: false,
            }),
          ])
        ).start();
      };
      breatheLoop();

      // Slow horizontal drift
      const driftLoop = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(aurora.x, {
              toValue: 100,
              duration: 25000 + i * 3000,
              useNativeDriver: false,
            }),
            Animated.timing(aurora.x, {
              toValue: 0,
              duration: 25000 + i * 3000,
              useNativeDriver: false,
            }),
          ])
        ).start();
      };
      driftLoop();

      // Gentle rotation
      Animated.loop(
        Animated.timing(aurora.rotate, {
          toValue: 360,
          duration: 30000 + i * 5000,
          useNativeDriver: false,
        })
      ).start();
    });

    // Particles with floating and twinkling effect
    particles.forEach((p) => {
      // Main twinkle animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.anim, {
            toValue: 1,
            duration: p.duration / 2,
            delay: p.delay,
            useNativeDriver: true,
          }),
          Animated.timing(p.anim, {
            toValue: 0,
            duration: p.duration / 2,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Floating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.floatAnim, {
            toValue: 1,
            duration: p.floatDuration,
            useNativeDriver: true,
          }),
          Animated.timing(p.floatAnim, {
            toValue: 0,
            duration: p.floatDuration,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#1a0a1f', '#0f0a15', '#1f1a0f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Aurora waves with breathing animation */}
      {auroras.map((aurora, i) => {
        const scale = aurora.breathe.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.3],
        });
        const opacity = aurora.breathe.interpolate({
          inputRange: [0, 1],
          outputRange: [aurora.baseOpacity * 0.7, aurora.baseOpacity],
        });
        
        return (
          <Animated.View
            key={`aurora-${i}`}
            style={{
              position: 'absolute',
              width: width * 1.5,
              height: 400,
              top: `${aurora.y.interpolate({ inputRange: [0, 100], outputRange: [0, height * 0.8] })}%`,
              left: aurora.x.interpolate({ inputRange: [0, 100], outputRange: [-width * 0.5, width * 0.2] }),
              borderRadius: 999,
              backgroundColor: `hsla(${aurora.hue}, ${aurora.hue < 100 ? '90%' : '80%'}, ${aurora.hue < 100 ? '60%' : '50%'}, 1)`,
              opacity,
              transform: [
                { scaleX: scale },
                { scaleY: aurora.breathe.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
                { rotate: aurora.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
              ],
              shadowColor: `hsl(${aurora.hue}, 100%, ${aurora.hue < 100 ? '65%' : '55%'})`,
              shadowOpacity: 0.6,
              shadowRadius: 80,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}

      {/* Floating twinkling particles */}
      {particles.map((p, i) => {
        const floatY = p.floatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -p.floatRange],
        });
        const floatX = p.floatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.2, 1, 0.2],
        });
        const scale = p.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.5, 1.5, 0.5],
        });
        
        return (
          <Animated.View
            key={`particle-${i}`}
            style={{
              position: 'absolute',
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              borderRadius: 999,
              opacity,
              backgroundColor: p.isGolden ? 'rgba(255, 215, 0, 1)' : 'rgba(200, 130, 255, 1)',
              shadowColor: p.isGolden ? '#FFD700' : '#C882FF',
              shadowOpacity: 1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
              transform: [{ translateY: floatY }, { translateX: floatX }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
