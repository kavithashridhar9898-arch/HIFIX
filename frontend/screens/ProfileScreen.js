import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Animated,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api, { API_BASE_URL } from '../config/api';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import PremiumBackground from '../components/PremiumBackground';
import { useTabAnimation } from '../context/TabAnimationContext';

const ProfileScreen = React.memo(function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { handleScroll } = useTabAnimation();
  const [profile, setProfile] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Helper to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    // Remove /api from API_BASE_URL since image paths start with /uploads
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  };

  useEffect(() => {
    fetchProfile();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Refresh profile when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setProfile(response.data.user);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      // Here you would typically upload the image to your server
      // and update the user's profile
      setProfile({ ...profile, profile_image: result.uri });
    }
  };

  const menuItems = [
    { icon: 'edit', text: 'Edit Profile', screen: 'EditProfile' },
    ...(user?.user_type === 'worker'
      ? [{ icon: 'work', text: 'Worker Dashboard', screen: 'WorkerDashboard' }]
      : []),
    { icon: 'notifications', text: 'Notifications', screen: 'Notifications' },
    { icon: 'security', text: 'Security', screen: 'Security' },
    { icon: 'help-outline', text: 'Help & Support', screen: 'Help' },
  ];

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)',
    borderWidth: 1,
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Animated.ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 140 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Animated.View style={[styles.header, glassStyle, { opacity: fadeAnim }]}>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
              {getImageUrl(profile?.profile_image) ? (
                <Image
                  source={{ uri: getImageUrl(profile?.profile_image) }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[styles.profileImagePlaceholder, { borderColor: isDarkMode ? '#38BDF8' : '#2563EB' }]}>
                  <Icon name="person" size={60} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Icon name="camera-alt" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.name, { color: '#000000' }]}>{profile?.name || 'User'}</Text>
            <Text style={[styles.email, { color: 'rgba(0,0,0,0.6)' }]}>{profile?.email}</Text>
            <Text style={[styles.userType, { color: '#005bb5' }]}>
              {user?.user_type?.replace('_', ' ').toUpperCase()}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.menuContainer, glassStyle, { opacity: fadeAnim }]}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Icon name={item.icon} size={24} color="#005bb5" />
                <Text style={[styles.menuText, { color: '#000000' }]}>{item.text}</Text>
                <Icon name="chevron-right" size={24} color="rgba(0,0,0,0.4)" />
              </TouchableOpacity>
            ))}
            <View style={[styles.menuItem, { borderBottomColor: 'transparent' }]}>
              <Icon name="brightness-4" size={24} color="#005bb5" />
              <Text style={[styles.menuText, { color: '#000000' }]}>Dark Mode</Text>
              <Switch
                trackColor={{ false: '#767577', true: '#2563EB' }}
                thumbColor={isDarkMode ? '#38BDF8' : '#f4f3f4'}
                onValueChange={toggleTheme}
                value={isDarkMode}
              />
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity 
              style={[styles.logoutButton, { 
                backgroundColor: '#EF4444', 
                borderColor: '#EF4444', 
                borderWidth: 1,
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4
              }]} 
              onPress={handleLogout}
            >
              <Icon name="logout" size={24} color="#FFFFFF" />
              <Text style={[styles.logoutText, { color: '#FFFFFF' }]}>Logout</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
});

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#38BDF8',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#2563eb',
    padding: 8,
    borderRadius: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 15,
  },
  email: {
    fontSize: 16,
    marginTop: 5,
  },
  userType: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 16,
  },
  menuContainer: {
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});