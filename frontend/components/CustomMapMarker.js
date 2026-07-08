import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, Animated } from 'react-native';
import { Marker } from 'react-native-maps';
import { API_BASE_URL } from '../config/api';

const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${imageUrl}`;
};

const CustomMapMarker = ({ worker, isSelected, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.9)).current;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.25 : 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isSelected ? 1 : 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const imageUrl = getImageUrl(worker.profileImage);

  return (
    <Marker
      coordinate={{ latitude: worker.location.latitude, longitude: worker.location.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <Animated.View
        style={[
          styles.markerContainer,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            zIndex: isSelected ? 999 : 1,
          },
        ]}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.image} 
              onLoad={() => setTracksViewChanges(false)}
            />
          ) : (
            <View 
              style={[styles.image, styles.placeholder]}
              onLayout={() => setTracksViewChanges(false)}
            >
              <View style={styles.placeholderInner} />
            </View>
          )}
        </View>

        {/* Verified Blue Ring / Glow effect based on selection */}
        {worker.verified && (
          <View style={styles.verifiedRing} />
        )}

        {/* Online/Availability Indicator */}
        <View style={[
          styles.statusDot,
          { backgroundColor: worker.availabilityStatus === 'available' ? '#10B981' : '#F59E0B' } // Green if available, Amber if busy
        ]} />

        {/* The triangle pointer at the bottom of the pin */}
        <View style={styles.triangle} />
      </Animated.View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 70, // extra height for the triangle
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 2, // above the triangle
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  placeholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#94A3B8',
  },
  verifiedRing: {
    position: 'absolute',
    top: 9, // relative to the container 70px height, center the 48px circle
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#38BDF8', // Electric Cyan
    zIndex: 3,
  },
  statusDot: {
    position: 'absolute',
    top: 10,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 4,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -4, // overlap with the circle slightly
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default React.memo(CustomMapMarker);
