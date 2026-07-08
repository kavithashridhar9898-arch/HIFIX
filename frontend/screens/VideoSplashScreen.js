import React, { useState, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');

export default function VideoSplashScreen({ onFinish }) {
  const [opacity] = useState(new Animated.Value(1));
  const video = useRef(null);

  const handlePlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      // Fade out smoothly over 400ms when video finishes
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <StatusBar hidden />
      <Video
        ref={video}
        style={styles.video}
        source={require('../assets/videos/splash.mp4')}
        useNativeControls={false}
        resizeMode={ResizeMode.COVER}
        shouldPlay={true}
        isLooping={false}
        isMuted={true}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101415', // Premium dark background fallback
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999, // Ensure it's on top of everything
  },
  video: {
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});
