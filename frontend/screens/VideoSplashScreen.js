import React, { useState, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions, TouchableOpacity, Text, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');

export default function VideoSplashScreen({ onFinish }) {
  const [opacity] = useState(new Animated.Value(1));
  const videoRef = useRef(null);
  const isFinished = useRef(false);

  const handleFinish = () => {
    if (isFinished.current) return;
    isFinished.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      if (onFinish) onFinish();
    });
  };

  const handlePlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      handleFinish();
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={handleFinish}>
        <View style={styles.touchArea}>
          <Video
            ref={videoRef}
            style={styles.video}
            source={require('../assets/videos/splash.mp4')}
            useNativeControls={false}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={false}
            isMuted={true}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleFinish}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.skipText}>Skip ➔</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101415',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  touchArea: {
    width: width,
    height: height,
    position: 'absolute',
  },
  video: {
    width: width,
    height: height,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 10000,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
