import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Easing,
  Dimensions,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../config/api';
import WorkerCard from '../components/WorkerCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import AuroraBackground from '../components/AuroraBackground';

export default function WorkersScreen({ route, navigation }) {
  const { colors } = useTheme();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
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
  const [clickSound, setClickSound] = useState(null);
  const accentBlobAnim = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
  const screenWidth = Dimensions.get('window').width;

  const serviceTypes = ['painting', 'electrical', 'plumbing', 'carpentry', 'handyman', 'hvac'];

  useEffect(() => {
    loadWorkers();
  }, [selectedService]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(accentBlobAnim, {
            toValue: 1,
            duration: 5000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(accentBlobAnim, {
            toValue: 0,
            duration: 5000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();
  }, [accentBlobAnim, headerFade]);

  useEffect(() => {
    let mounted = true;
    let localSound;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/tap.wav'),
          { volume: 0.25, shouldPlay: false }
        );
        if (mounted) {
          setClickSound(sound);
          localSound = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.warn('Failed to load click sound', error);
      }
    })();

    return () => {
      mounted = false;
      if (localSound) {
        localSound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const playClick = useCallback(async () => {
    try {
      if (clickSound) {
        await clickSound.replayAsync();
      }
    } catch (error) {
      // Ignore transient playback errors
    }
  }, [clickSound]);

  const InteractiveTouchable = ({ children, style, onPress, disabled, ...rest }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      if (disabled) return;
      playClick();
      onPress?.();
    };

    const animateTo = (value) => {
      Animated.spring(scale, {
        toValue: value,
        speed: 14,
        bounciness: 8,
        useNativeDriver: true,
      }).start();
    };

    return (
      <AnimatedTouchable
        activeOpacity={0.9}
        {...rest}
        onPress={handlePress}
        onPressIn={() => animateTo(0.94)}
        onPressOut={() => animateTo(1)}
        style={[style, { transform: [{ scale }] }]}
        disabled={disabled}
      >
        {children}
      </AnimatedTouchable>
    );
  };

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
  // update counts for radius chips
  updateRadiusChipCounts(loc.coords);

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

  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderWorker = ({ item, index }) => (
    <WorkerCard
      worker={item}
      navigation={navigation}
      index={index}
      onPlayClick={playClick}
    />
  );

  const pinColorForService = (serviceType) => {
    const map = {
      painter: '#FF61D8',
      electrician: '#4FC3F7',
      plumber: '#64B5F6',
      carpenter: '#FFB74D',
      handyman: '#81C784',
      hvac: '#7986CB',
    };
    return map[serviceType] || '#4285F4';
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

  const updateRadiusChipCounts = async (coords) => {
    try {
      const pairs = await Promise.all(
        radiusOptions.map(async (r) => {
          const url = `/workers/nearby?latitude=${coords.latitude}&longitude=${coords.longitude}&radius=${r}` + (selectedService ? `&service_type=${selectedService}` : '');
          const res = await api.get(url);
          return [r, res.data?.count || 0];
        })
      );
      const map = {};
      pairs.forEach(([r, c]) => (map[r] = c));
      setRadiusCounts(map);
    } catch (e) {
      // ignore errors
    }
  };

  const blobTranslate = accentBlobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -22],
  });

  const blobScale = accentBlobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground />

        <Animated.View style={[styles.headerCard, { opacity: headerFade, transform: [{ translateY: headerFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }] }>
          <LinearGradient
            colors={['rgba(66,133,244,0.25)', 'rgba(126,87,194,0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Find Skilled Professionals</Text>
                <Text style={styles.headerSubtitle}>Discover trusted workers nearby with tailored filters.</Text>
              </View>
              <InteractiveTouchable
                style={styles.viewToggle}
                onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              >
                <Icon name={viewMode === 'list' ? 'map' : 'view-list'} size={22} color="#fff" />
              </InteractiveTouchable>
            </View>
            <View style={styles.searchRow}>
              <Icon name="search" size={20} color="rgba(255,255,255,0.85)" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by worker name or skill"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </LinearGradient>
        </Animated.View>

      {infoMessage ? (
        <Text style={styles.infoText}>{infoMessage}</Text>
      ) : null}

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceFilterContainer}
        >
          {serviceTypes.map((s) => (
            <InteractiveTouchable
              key={s}
              style={[styles.serviceChip, selectedService === toBackendServiceType(s) && styles.serviceChipActive]}
              onPress={() => setSelectedService(selectedService === toBackendServiceType(s) ? null : toBackendServiceType(s))}
            >
              <Text style={[styles.serviceChipText, selectedService === toBackendServiceType(s) && styles.serviceChipTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </InteractiveTouchable>
          ))}
        </ScrollView>
      </View>

      {/* Radius and Sort controls */}
      <View style={styles.controlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusChips}>
          {radiusOptions.map(r => (
            <InteractiveTouchable key={`r-${r}`} style={[styles.controlChip, selectedRadius === r && styles.controlChipActive]} onPress={() => setSelectedRadius(r)}>
              <Text style={[styles.controlChipText, selectedRadius === r && styles.controlChipTextActive]}>
                {r} km{radiusCounts[r] != null ? ` (${radiusCounts[r]})` : ''}
              </Text>
            </InteractiveTouchable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
          {sortOptions.map(opt => (
            <InteractiveTouchable key={`s-${opt}`} style={[styles.controlChip, sortBy === opt && styles.controlChipActive]} onPress={() => setSortBy(opt)}>
              <Text style={[styles.controlChipText, sortBy === opt && styles.controlChipTextActive]}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </InteractiveTouchable>
          ))}
        </ScrollView>
        <InteractiveTouchable style={styles.applyButton} onPress={loadWorkers}>
          <Icon name="refresh" size={18} color="#fff" />
          <Text style={styles.applyButtonText}>Apply</Text>
        </InteractiveTouchable>
      </View>

      {/* Advanced filters */}
      <View style={styles.advancedRow}>
        <View style={styles.switchRow}>
          <Text style={styles.advLabel}>Verified only</Text>
          <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} />
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceField}>
            <Text style={styles.advLabel}>Min $</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor="#777"
              value={minPrice}
              onChangeText={setMinPrice}
            />
          </View>
          <View style={styles.priceField}>
            <Text style={styles.advLabel}>Max $</Text>
            <TextInput
              style={styles.priceInput}
              placeholder=""
              keyboardType="numeric"
              placeholderTextColor="#777"
              value={maxPrice}
              onChangeText={setMaxPrice}
            />
          </View>
          <View style={styles.priceField}>
            <Text style={styles.advLabel}>Min ★</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0-5"
              keyboardType="numeric"
              placeholderTextColor="#777"
              value={minRating}
              onChangeText={setMinRating}
            />
          </View>
        </View>
      </View>

      {/* City fallback UI */}
      {infoMessage ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{infoMessage} </Text>
          <InteractiveTouchable onPress={() => setShowCitySearch(v => !v)}>
            <Text style={styles.infoLink}>{showCitySearch ? 'Use GPS' : 'Search by city instead'}</Text>
          </InteractiveTouchable>
        </View>
      ) : (
        <View style={styles.infoRow}>
          <InteractiveTouchable onPress={() => setShowCitySearch(v => !v)}>
            <Text style={styles.infoLink}>{showCitySearch ? 'Use GPS' : 'Or search by city'}</Text>
          </InteractiveTouchable>
        </View>
      )}

      {showCitySearch && (
        <View style={styles.cityRow}>
          <TextInput
            style={styles.cityInput}
            placeholder="Enter city"
            placeholderTextColor="#888"
            value={cityQuery}
            onChangeText={setCityQuery}
          />
          <InteractiveTouchable style={styles.citySearchButton} onPress={searchByCity}>
            <Icon name="search" size={20} color="#fff" />
          </InteractiveTouchable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4285F4" style={{ flex: 1 }} />
      ) : viewMode === 'list' ? (
        <FlatList
          data={filteredWorkers}
          renderItem={renderWorker}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No workers found.</Text>}
        />
      ) : (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location?.latitude || 37.78825,
            longitude: location?.longitude || -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {location && (
            <Marker
              coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              title={'You'}
              description={'Current location'}
              pinColor={'#4285F4'}
            />
          )}
          {filteredWorkers.map(worker => (
            <Marker
              key={worker.id}
              coordinate={{ latitude: worker.location.latitude, longitude: worker.location.longitude }}
              title={worker.name}
              description={worker.serviceType}
              pinColor={pinColorForService(worker.serviceType)}
            />
          ))}
        </MapView>
      )}
      </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    decorLayer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    glowingBlob: {
      position: 'absolute',
      top: -120,
      right: -80,
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: 'rgba(66,133,244,0.25)',
      shadowColor: '#7e57c2',
      shadowOpacity: 0.6,
      shadowRadius: 120,
      },
    headerCard: {
      marginTop: 8,
      marginBottom: 18,
    },
    headerGradient: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: 'rgba(12,20,35,0.65)',
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    headerTitle: {
      fontSize: 22,
      color: '#ffffff',
      fontWeight: '700',
      marginBottom: 6,
    },
    headerSubtitle: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      lineHeight: 18,
    },
    viewToggle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(15,23,42,0.8)',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    searchInput: {
      flex: 1,
      color: '#f8fafc',
      fontSize: 15,
    },
  infoText: {
    color: '#ccc',
    paddingHorizontal: 15,
    marginBottom: 6,
  },
  controlsRow: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  advancedRow: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  advLabel: {
    color: '#ccc',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
  },
  priceInput: {
    color: '#fff',
    width: 60,
    marginLeft: 6,
  },
  radiusChips: {
    paddingRight: 8,
  },
  sortChips: {
    paddingRight: 8,
  },
  controlChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.8)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  controlChipActive: {
    backgroundColor: 'rgba(37,99,235,0.95)',
    borderColor: 'rgba(148,163,184,0.3)',
    shadowOpacity: 0.25,
  },
  controlChipText: {
    color: 'rgba(226,232,240,0.75)',
    fontWeight: '600',
    fontSize: 12,
  },
  controlChipTextActive: {
    color: '#fff',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    marginLeft: 'auto',
    shadowColor: '#60a5fa',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
  },
  applyButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '700',
    fontSize: 12,
  },
    serviceFilterContainer: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    serviceChip: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: 'rgba(15,23,42,0.8)',
      marginRight: 10,
      borderWidth: 1,
      borderColor: 'rgba(148,163,184,0.18)',
    },
    serviceChipActive: {
      backgroundColor: 'rgba(14,165,233,0.85)',
      borderColor: 'rgba(125,211,252,0.6)',
      shadowColor: '#0ea5e9',
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    serviceChipText: {
      color: 'rgba(226,232,240,0.75)',
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    serviceChipTextActive: {
      color: '#fff',
    },
    list: {
      paddingHorizontal: 4,
      paddingBottom: 30,
      paddingTop: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: '#888',
        marginTop: 50,
        fontSize: 16,
    },
    map: {
        flex: 1,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    infoLink: {
      color: '#60a5fa',
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(15,23,42,0.8)',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(148,163,184,0.18)',
    },
    cityInput: {
      flex: 1,
      color: '#f8fafc',
      fontSize: 15,
      marginRight: 12,
    },
    citySearchButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(59,130,246,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(147,197,253,0.5)',
      shadowColor: '#60a5fa',
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
});