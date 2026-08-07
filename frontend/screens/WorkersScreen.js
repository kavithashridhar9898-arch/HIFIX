import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  ScrollView,
  Switch,
  Animated,
  Alert,
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../config/api';
import WorkerCard from '../components/WorkerCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { useTabAnimation } from '../context/TabAnimationContext';
import CustomMapMarker from '../components/CustomMapMarker';
import WorkerBottomSheet from '../components/WorkerBottomSheet';

const WorkersScreen = React.memo(function WorkersScreen({ route, navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { handleScroll, setIsTabBarVisible } = useTabAnimation();
  const params = route.params || {};
  const initialServiceParam = params.serviceType || params.service || null; // supports both keys
  
  // Map UI keys/names to backend enum values
  const toBackendServiceType = (val) => {
    if (!val) return null;
    const v = String(val).toLowerCase().trim();
    const map = {
      painting: 'painter',
      painter: 'painter',
      electrical: 'electrician',
      electrician: 'electrician',
      plumbing: 'plumber',
      plumber: 'plumber',
      carpentry: 'carpenter',
      carpenter: 'carpenter',
      handyman: 'handyman',
      hvac: 'hvac',
    };
    return map[v] || null;
  };

  const [selectedService, setSelectedService] = useState(toBackendServiceType(initialServiceParam));
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(params.searchQuery || '');
  const [viewMode, setViewMode] = useState('map'); // 'list' or 'map' - Defaulted to map for Redesign
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = React.useRef(null);
  const [location, setLocation] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const radiusOptions = [10, 25, 50, 250];
  const [selectedRadius, setSelectedRadius] = useState(50);
  const sortOptions = ['distance', 'rating', 'price'];
  const [sortBy, setSortBy] = useState('distance');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [radiusCounts, setRadiusCounts] = useState({});

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setIsMapReady(true);
    });

    if (setIsTabBarVisible) {
      if (viewMode === 'map' && selectedWorker) {
        setIsTabBarVisible(false);
      } else {
        setIsTabBarVisible(true);
      }
    }
  }, [viewMode, selectedWorker, setIsTabBarVisible]);

  useEffect(() => {
    return () => {
      if (setIsTabBarVisible) setIsTabBarVisible(true);
    };
  }, [setIsTabBarVisible]);

  const serviceTypes = ['painting', 'electrical', 'plumbing', 'carpentry', 'handyman', 'hvac'];

  useEffect(() => {
    loadWorkers();
  }, [selectedService]);

  useEffect(() => {
    if (params.searchQuery !== undefined) {
      setSearchQuery(params.searchQuery);
    }
  }, [params.searchQuery]);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('workersPrefs');
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.selectedService) setSelectedService(prefs.selectedService);
          if (prefs.selectedRadius) setSelectedRadius(prefs.selectedRadius);
          if (prefs.sortBy) setSortBy(prefs.sortBy);
          if (typeof prefs.verifiedOnly === 'boolean') setVerifiedOnly(prefs.verifiedOnly);
          if (prefs.minPrice != null) setMinPrice(String(prefs.minPrice));
          if (prefs.maxPrice != null) setMaxPrice(String(prefs.maxPrice));
          if (prefs.minRating != null) setMinRating(String(prefs.minRating));
        }
      } catch {}
    })();
  }, []);

  // Persist preferences
  useEffect(() => {
    const prefs = {
      selectedService,
      selectedRadius,
      sortBy,
      verifiedOnly,
      minPrice: minPrice === '' ? null : Number(minPrice),
      maxPrice: maxPrice === '' ? null : Number(maxPrice),
      minRating: minRating === '' ? null : Number(minRating),
    };
    AsyncStorage.setItem('workersPrefs', JSON.stringify(prefs)).catch(() => {});
  }, [selectedService, selectedRadius, sortBy, verifiedOnly, minPrice, maxPrice, minRating]);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        setInfoMessage('Location permission is required to find nearby workers.');
        // Offer to open settings if user previously denied
        try {
          const { Linking } = require('react-native');
          if (!canAskAgain && Linking && Linking.openSettings) {
            Linking.openSettings();
          }
        } catch {}
        return;
      }

  const loc = await Location.getCurrentPositionAsync({});
  setLocation(loc.coords);

      // Try selected radius first, then progressively larger radii if nothing is found nearby
      const radiiKm = Array.from(new Set([selectedRadius, 50, 250, 2000, 20000]));
      let found = [];
      for (const r of radiiKm) {
        const url = `/workers/nearby?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&radius=${r}` + (selectedService ? `&service_type=${selectedService}` : '');
        const res = await api.get(url);
        if (res.data?.success && res.data.workers?.length) {
          found = res.data.workers;
          if (r > 50) {
            setInfoMessage(`No workers within 50km. Showing results within ${r}km.`);
          } else {
            setInfoMessage('');
          }
          break;
        }
      }
      // Calculate radius chip counts in-memory from fetched workers
      updateRadiusChipCounts(found);
      // Apply filters and sorting
      let sorted = [...found];
      const minP = minPrice === '' ? null : Number(minPrice);
      const maxP = maxPrice === '' ? null : Number(maxPrice);
      const minR = minRating === '' ? null : Number(minRating);
      if (verifiedOnly) sorted = sorted.filter(w => w.verified);
      if (minP != null) sorted = sorted.filter(w => (w.hourlyRate || 0) >= minP);
      if (maxP != null) sorted = sorted.filter(w => (w.hourlyRate || 0) <= maxP);
      if (minR != null) sorted = sorted.filter(w => (w.averageRating || 0) >= minR);
      if (sortBy === 'rating') {
        sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      } else if (sortBy === 'price') {
        sorted.sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0));
      } else if (sortBy === 'distance') {
        // Distance is string from backend toFixed(2); convert to number when present
        sorted.sort((a, b) => (parseFloat(a.distance || '0') - parseFloat(b.distance || '0')));
      }
      setWorkers(sorted);
    } catch (error) {
      console.error('Error loading workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(w => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    return (
      w.name?.toLowerCase().includes(query) || 
      w.serviceType?.toLowerCase().includes(query) ||
      w.bio?.toLowerCase().includes(query) ||
      w.skills?.toLowerCase().includes(query) ||
      w.location?.city?.toLowerCase().includes(query)
    );
  });

  const renderWorker = useCallback(({ item, index }) => (
    <WorkerCard worker={item} navigation={navigation} index={index} />
  ), [navigation]);

  const pinColorForService = (serviceType) => {
    const map = {
      painter: '#FF61D8',
      electrician: '#4FC3F7',
      plumber: '#64B5F6',
      carpenter: '#FFB74D',
      handyman: '#81C784',
      hvac: '#7986CB',
    };
    return map[serviceType] || '#2563eb';
  };

  const searchByCity = async () => {
    if (!cityQuery.trim()) {
      setInfoMessage('Enter a city to search.');
      return;
    }
    try {
      setLoading(true);
      const url = `/workers/search?city=${encodeURIComponent(cityQuery.trim())}` + (selectedService ? `&service_type=${selectedService}` : '');
      const res = await api.get(url);
      if (res.data?.success) {
        setWorkers(res.data.workers || []);
        setInfoMessage(res.data.count ? '' : 'No workers found for that city.');
      }
    } catch (e) {
      console.error('City search error:', e);
      setInfoMessage('Unable to search by city.');
    } finally {
      setLoading(false);
    }
  };

  const updateRadiusChipCounts = (workerList = workers) => {
    try {
      const map = {};
      radiusOptions.forEach((r) => {
        map[r] = (workerList || []).filter(w => parseFloat(w.distance || '0') <= r).length;
      });
      setRadiusCounts(map);
    } catch (e) {
      // ignore errors
    }
  };

  const handleMarkerPress = (worker) => {
    setSelectedWorker(worker);
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: worker.location.latitude - 0.015, // Offset so bottom sheet doesn't cover marker
        longitude: worker.location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    }
  };

  const handleMessageWorker = async (worker) => {
    try {
      if (!worker?.userId) {
        Alert.alert('Error', 'Worker account not linked');
        return;
      }
      const res = await api.get(`/chat/conversation/${worker.userId}`);
      if (res.data?.success && res.data.conversation) {
        const convo = res.data.conversation;
        navigation.navigate('Chat', {
          conversationId: convo.id,
          otherUserId: worker.userId,
          otherUserName: worker.name,
          otherUserAvatar: worker.profileImage,
          otherUserPhone: worker.phone,
        });
      } else {
        Alert.alert('Error', 'Unable to start conversation');
      }
    } catch (e) {
      console.error('Start conversation error:', e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.message || 'Failed to open chat');
    }
  };

  const closeBottomSheet = () => {
    setSelectedWorker(null);
  };

  const recenterMap = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }, 500);
    }
  };

  const renderHeader = () => (
    <>
      {/* Header / Search Area */}
      <View style={styles.header}>
        <View style={[styles.searchContainer, { 
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
        }]}>
          <Icon name="search" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
            placeholder="Search by name..."
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} 
          style={[styles.viewModeButton, {
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
          }]}
        >
          <Icon name={viewMode === 'list' ? 'map' : 'view-list'} size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Info Message */}
      {infoMessage ? (
        <Text style={[styles.infoText, { color: '#FFFFFF' }]}>{infoMessage}</Text>
      ) : null}

      <View style={styles.filterSection}>
        {/* Service Types */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceFilterContainer}
        >
          {serviceTypes.map((s) => {
            const isActive = selectedService === toBackendServiceType(s);
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.serviceChip, 
                  isActive && styles.serviceChipActive,
                  !isActive && {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
                  }
                ]}
                onPress={() => setSelectedService(isActive ? null : toBackendServiceType(s))}
              >
                <Text style={[
                  styles.serviceChipText, 
                  isActive ? styles.serviceChipTextActive : { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }
                ]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Controls Wrap Row */}
        <View style={styles.controlsWrapRow}>
          {radiusOptions.map(r => {
            const isActive = selectedRadius === r;
            return (
              <TouchableOpacity 
                key={`r-${r}`} 
                style={[
                  styles.controlChip, 
                  isActive && styles.controlChipActive,
                  !isActive && {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
                  }
                ]} 
                onPress={() => setSelectedRadius(r)}
              >
                <Text style={[
                  styles.controlChipText, 
                  isActive ? styles.controlChipTextActive : { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }
                ]}>
                  {r} km{radiusCounts[r] != null ? ` (${radiusCounts[r]})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
          
          {sortOptions.map(opt => {
            const isActive = sortBy === opt;
            return (
              <TouchableOpacity 
                key={`s-${opt}`} 
                style={[
                  styles.controlChip, 
                  isActive && styles.controlChipActive,
                  !isActive && {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
                  }
                ]} 
                onPress={() => setSortBy(opt)}
              >
                <Text style={[
                  styles.controlChipText, 
                  isActive ? styles.controlChipTextActive : { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }
                ]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Advanced Filters Wrap Row */}
        <View style={styles.advancedWrapRow}>
          <View style={[styles.switchRow, { 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' 
          }]}>
            <Text style={[styles.advLabel, { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }]}>Verified</Text>
            <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{ true: '#2563EB' }} />
          </View>

          <View style={[styles.priceField, { 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' 
          }]}>
            <Text style={[styles.advLabel, { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }]}>Min $</Text>
            <TextInput
              style={[styles.priceInput, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={minPrice}
              onChangeText={setMinPrice}
            />
          </View>

          <View style={[styles.priceField, { 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' 
          }]}>
            <Text style={[styles.advLabel, { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }]}>Max $</Text>
            <TextInput
              style={[styles.priceInput, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
              placeholder="Any"
              keyboardType="numeric"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={maxPrice}
              onChangeText={setMaxPrice}
            />
          </View>

          <View style={[styles.priceField, { 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' 
          }]}>
            <Text style={[styles.advLabel, { color: isDarkMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)' }]}>Min ★</Text>
            <TextInput
              style={[styles.priceInput, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={minRating}
              onChangeText={setMinRating}
            />
          </View>
        </View>
        
        {/* Apply Button */}
        <View style={styles.applyButtonContainer}>
          <TouchableOpacity style={styles.applyButtonFull} onPress={loadWorkers}>
            <Icon name="refresh" size={20} color="#fff" />
            <Text style={styles.applyButtonTextFull}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* City fallback UI */}
      <View style={styles.citySection}>
        <TouchableOpacity style={styles.cityToggle} onPress={() => setShowCitySearch(v => !v)}>
          <Text style={styles.cityToggleText}>{showCitySearch ? 'Use GPS Location Instead' : 'Search by City Instead'}</Text>
        </TouchableOpacity>

        {showCitySearch && (
          <View style={[styles.cityRow, { 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' 
          }]}>
            <TextInput
              style={[styles.cityInput, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
              placeholder="Enter city name..."
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={cityQuery}
              onChangeText={setCityQuery}
            />
            <TouchableOpacity style={styles.citySearchButton} onPress={searchByCity}>
              <Icon name="search" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        
        {/* Main Content */}
        <View style={styles.contentArea}>
          {loading && !location ? (
            <View style={{ flex: 1 }}>
               {viewMode === 'list' && renderHeader()}
              <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
            </View>
          ) : viewMode === 'list' ? (
            <Animated.FlatList
              ListHeaderComponent={renderHeader()}
              data={filteredWorkers}
              renderItem={renderWorker}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={[styles.list, { paddingBottom: 140 }]}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: 'rgba(255,255,255,0.8)' }]}>No workers found.</Text>}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={3}
              removeClippedSubviews={true}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          ) : (
            <View style={styles.fullScreenMapContainer}>
              {isMapReady ? (
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{
                    latitude: location?.latitude || 37.78825,
                    longitude: location?.longitude || -122.4324,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  showsCompass={false}
                  customMapStyle={isDarkMode ? darkMapStyle : []}
                  onPress={() => setSelectedWorker(null)} // Click outside closes sheet
                >
                  {filteredWorkers.map(worker => (
                    <CustomMapMarker
                      key={worker.id}
                      worker={worker}
                      isSelected={selectedWorker?.id === worker.id}
                      onPress={() => handleMarkerPress(worker)}
                    />
                  ))}
                </MapView>
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? '#101415' : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="large" color="#38BDF8" />
                </View>
              )}

              {/* Floating Top UI (Search & Filters) */}
              <View style={styles.floatingTopUI}>
                <View style={[styles.floatingSearchBar, { 
                  backgroundColor: isDarkMode ? 'rgba(22, 32, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
                }]}>
                  <Icon name="search" size={24} color={isDarkMode ? '#FFFFFF' : '#101415'} style={{ marginRight: 12 }} />
                  <TextInput
                    style={[styles.floatingSearchInput, { color: isDarkMode ? '#FFFFFF' : '#101415' }]}
                    placeholder="Search nearby electricians, plumbers..."
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <TouchableOpacity onPress={() => setViewMode('list')} style={styles.listViewToggleBtn}>
                    <Icon name="view-list" size={24} color="#38BDF8" />
                  </TouchableOpacity>
                </View>

                {/* Floating Horizontal Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.floatingFiltersContainer}
                >
                  <TouchableOpacity 
                    style={[styles.floatingChip, { backgroundColor: isDarkMode ? 'rgba(22,32,42,0.85)' : 'rgba(255,255,255,0.95)', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                    onPress={() => setVerifiedOnly(!verifiedOnly)}
                  >
                    <Icon name="verified" size={16} color={verifiedOnly ? '#38BDF8' : (isDarkMode ? '#FFFFFF' : '#101415')} />
                    <Text style={[styles.floatingChipText, { color: verifiedOnly ? '#38BDF8' : (isDarkMode ? '#FFFFFF' : '#101415') }]}>Verified</Text>
                  </TouchableOpacity>
                  {serviceTypes.map((s) => {
                    const isActive = selectedService === toBackendServiceType(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.floatingChip, 
                          isActive && styles.floatingChipActive,
                          !isActive && { backgroundColor: isDarkMode ? 'rgba(22,32,42,0.85)' : 'rgba(255,255,255,0.95)', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                        ]}
                        onPress={() => setSelectedService(isActive ? null : toBackendServiceType(s))}
                      >
                        <Text style={[
                          styles.floatingChipText, 
                          isActive ? { color: '#FFFFFF' } : { color: isDarkMode ? '#FFFFFF' : '#101415' }
                        ]}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Floating Controls Right */}
              <View style={styles.floatingControlsRight}>
                <TouchableOpacity style={[styles.floatingControlBtn, { backgroundColor: isDarkMode ? 'rgba(22,32,42,0.85)' : 'rgba(255,255,255,0.95)' }]} onPress={recenterMap}>
                  <Icon name="my-location" size={24} color="#38BDF8" />
                </TouchableOpacity>
              </View>

              {/* Premium Bottom Sheet */}
              <WorkerBottomSheet 
                worker={selectedWorker}
                visible={!!selectedWorker}
                onClose={closeBottomSheet}
                onBook={() => navigation.navigate('ServiceRequest', { worker: selectedWorker })}
                onMessage={() => handleMessageWorker(selectedWorker)}
                onViewProfile={() => navigation.navigate('WorkerDetail', { workerId: selectedWorker.id })}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
});

export default WorkersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  viewModeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoText: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  filterSection: {
    paddingBottom: 8,
  },
  serviceFilterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  serviceChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  serviceChipText: {
    fontWeight: '600',
    fontSize: 14,
  },
  serviceChipTextActive: {
    color: '#FFFFFF',
  },
  controlsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  controlChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlChipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  controlChipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  controlChipTextActive: {
    color: '#101415',
  },
  advancedWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    height: 40,
  },
  priceField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    minWidth: 90,
  },
  advLabel: {
    fontWeight: '600',
    fontSize: 13,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  applyButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  applyButtonFull: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonTextFull: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  citySection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cityToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  cityToggleText: {
    color: '#38BDF8',
    fontWeight: '600',
    fontSize: 14,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingLeft: 16,
    height: 48,
    borderWidth: 1,
    marginTop: 8,
  },
  cityInput: {
    flex: 1,
    fontSize: 15,
  },
  citySearchButton: {
    backgroundColor: '#2563EB',
    height: 48,
    width: 48,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentArea: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  map: {
    flex: 1,
  },
  fullScreenMapContainer: {
    flex: 1,
    position: 'relative',
  },
  floatingTopUI: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingSearchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  listViewToggleBtn: {
    padding: 8,
    marginLeft: 8,
  },
  floatingFiltersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  floatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 6,
  },
  floatingChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  floatingChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  floatingControlsRight: {
    position: 'absolute',
    top: 160,
    right: 16,
    zIndex: 10,
    gap: 12,
  },
  floatingControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#242f3e"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#746855"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#242f3e"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#d59563"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#d59563"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#263c3f"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#6b9a76"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#38414e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#212a37"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9ca5b3"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#746855"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#1f2835"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#f3d19c"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#2f3948"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#d59563"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#17263c"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#515c6d"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#17263c"
      }
    ]
  }
];