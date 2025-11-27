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
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api, { API_BASE_URL } from '../config/api';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import AuroraBackground from '../components/AuroraBackground';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { isDarkMode, colors, toggleTheme } = useTheme();
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

    if (!result.cancelled) {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: fadeAnim, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
            {getImageUrl(profile?.profile_image) ? (
              <Image
                source={{ uri: getImageUrl(profile?.profile_image) }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Icon name="person" size={60} color="#4285F4" />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Icon name="camera-alt" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.name, { color: colors.text }]}>{profile?.name || 'User'}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{profile?.email}</Text>
          <Text style={[styles.userType, { color: colors.primary }]}>
            {user?.user_type?.replace('_', ' ').toUpperCase()}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.menuContainer, { opacity: fadeAnim, backgroundColor: colors.surface }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Icon name={item.icon} size={24} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.text }]}>{item.text}</Text>
              <Icon name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <Icon name="brightness-4" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
              onValueChange={toggleTheme}
              value={isDarkMode}
            />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: `${colors.error}20` }]} 
            onPress={handleLogout}
          >
            <Icon name="logout" size={24} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#4285F4',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#4285F4',
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#4285F4',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 15,
  },
  menuContainer: {
    marginTop: 30,
    marginHorizontal: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    marginTop: 30,
    padding: 15,
    borderRadius: 15,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});