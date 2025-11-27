import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.05;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function WorkerMapScreen({ navigation }) {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(true);
  const locationWatchRef = useRef(null);

  useEffect(() => {
    initializeLocation();
    return () => {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (location && tracking) {
      updateWorkerLocation();
      fetchNearbyData();
    }
  }, [location, radius]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to show your position on the map.');
        setLoading(false);
        return;
      }

      // Get initial location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      });

      // Start watching location
      if (tracking) {
        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 30000, // Update every 30 seconds
            distanceInterval: 50, // Or when moved 50 meters
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            });
          }
        );
      }

      setLoading(false);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
      setLoading(false);
    }
  };

  const updateWorkerLocation = async () => {
    if (!location) return;
    try {
      await api.put('/workers/location', {
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (error) {
      console.error('Update location error:', error);
    }
  };

  const fetchNearbyData = async () => {
    if (!location) return;
    try {
      // Fetch nearby workers
      const workersRes = await api.get(
        `/workers/nearby?latitude=${location.latitude}&longitude=${location.longitude}&radius=${radius}`
      );
      if (workersRes.data.success) {
        setNearbyWorkers(workersRes.data.workers || []);
      }

      // Fetch nearby active service requests (pending bookings)
      const requestsRes = await api.get(
        `/bookings/nearby-requests?latitude=${location.latitude}&longitude=${location.longitude}&radius=${radius}`
      );
      if (requestsRes.data.success) {
        setNearbyRequests(requestsRes.data.requests || []);
      }
    } catch (error) {
      console.error('Fetch nearby data error:', error);
    }
  };

  const handleCallPhone = (phone) => {
    if (!phone) {
      Alert.alert('No Phone', 'Phone number not available');
      return;
    }
    const phoneUrl = Platform.OS === 'ios' ? `telprompt:${phone}` : `tel:${phone}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Error', 'Cannot make phone calls on this device');
        }
      })
      .catch((err) => console.error('Call error:', err));
  };

  const handleAcceptRequest = async (request) => {
    Alert.alert(
      'Accept Service Request',
      `Accept request from ${request.homeownerName}?\n\n${request.description || 'No description'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await api.put(`/bookings/${request.id}/status`, { status: 'accepted' });
              Alert.alert('Success', 'Request accepted! You can now contact the customer.');
              fetchNearbyData();
            } catch (error) {
              Alert.alert('Error', 'Failed to accept request');
            }
          },
        },
      ]
    );
  };

  const centerOnLocation = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion(location, 500);
    }
  };

  const getMarkerColor = (serviceType) => {
    const colors = {
      painter: '#FF61D8',
      electrician: '#4FC3F7',
      plumber: '#64B5F6',
      carpenter: '#FFB74D',
      handyman: '#81C784',
      hvac: '#7986CB',
    };
    return colors[serviceType] || '#9E9E9E';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Icon name="location-off" size={64} color="#888" />
          <Text style={styles.errorText}>Location not available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializeLocation}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={location}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {/* Current worker location circle */}
        <Circle
          center={{ latitude: location.latitude, longitude: location.longitude }}
          radius={radius * 1000}
          strokeColor="rgba(66, 133, 244, 0.5)"
          fillColor="rgba(66, 133, 244, 0.1)"
        />

        {/* Nearby workers */}
        {nearbyWorkers.map((worker) => (
          <Marker
            key={`worker-${worker.id}`}
            coordinate={{
              latitude: worker.location.latitude,
              longitude: worker.location.longitude,
            }}
            title={worker.name}
            description={`${worker.serviceType} - ${worker.experienceYears}y exp`}
            pinColor={getMarkerColor(worker.serviceType)}
          >
            <View style={styles.workerMarker}>
              <Icon name="person" size={20} color="#fff" />
            </View>
          </Marker>
        ))}

        {/* Nearby service requests */}
        {nearbyRequests.map((request) => (
          <Marker
            key={`request-${request.id}`}
            coordinate={{
              latitude: request.latitude,
              longitude: request.longitude,
            }}
            onCalloutPress={() => handleAcceptRequest(request)}
          >
            <View style={styles.requestMarker}>
              <Icon name="home-repair-service" size={20} color="#fff" />
            </View>
            <MapView.Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{request.homeownerName}</Text>
                <Text style={styles.calloutService}>{request.serviceType}</Text>
                <Text style={styles.calloutDesc}>{request.description}</Text>
                <View style={styles.calloutActions}>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => handleCallPhone(request.homeownerPhone)}
                  >
                    <Icon name="phone" size={16} color="#4285F4" />
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptButton}>
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </MapView.Callout>
          </Marker>
        ))}
      </MapView>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.radiusControl}>
          <Text style={styles.radiusLabel}>Radius: {radius}km</Text>
          <View style={styles.radiusButtons}>
            {[5, 10, 25, 50].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.radiusButton, radius === r && styles.radiusButtonActive]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.radiusButtonText, radius === r && styles.radiusButtonTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Icon name="work" size={16} color="#81C784" />
            <Text style={styles.statText}>{nearbyWorkers.length} workers</Text>
          </View>
          <View style={styles.statBadge}>
            <Icon name="home-repair-service" size={16} color="#FF61D8" />
            <Text style={styles.statText}>{nearbyRequests.length} requests</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.centerButton} onPress={centerOnLocation}>
        <Icon name="my-location" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.refreshButton} onPress={fetchNearbyData}>
        <Icon name="refresh" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9e9e9e' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#181818' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1b1b1b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a8a' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#373737' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4e4e4e' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d3d3d' }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
  },
  radiusControl: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  radiusLabel: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  radiusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  radiusButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  radiusButtonActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  radiusButtonText: {
    color: '#aaa',
    fontWeight: '600',
  },
  radiusButtonTextActive: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  centerButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4285F4',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: '#81C784',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  workerMarker: {
    backgroundColor: '#4285F4',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  requestMarker: {
    backgroundColor: '#FF61D8',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  callout: {
    width: 200,
    padding: 10,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  calloutService: {
    color: '#4285F4',
    fontSize: 14,
    marginBottom: 4,
  },
  calloutDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  calloutActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  callButtonText: {
    color: '#4285F4',
    marginLeft: 4,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
