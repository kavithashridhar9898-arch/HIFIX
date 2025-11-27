import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

// Global Error Boundary to catch runtime errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Optionally log error to an error reporting service
    if (console && console.error) {
      console.error('App crashed:', error, errorInfo);
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
          <Icon name="error-outline" size={60} color="#FFD700" />
          <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: 'bold', marginTop: 20 }}>Something went wrong</Text>
          <Text style={{ color: '#fff', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}>
            {this.state.error?.toString()}
          </Text>
          <Text style={{ color: '#aaa', marginTop: 10, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
            {this.state.errorInfo?.componentStack}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import WorkersScreen from './screens/WorkersScreen';
import WorkerDetailScreen from './screens/WorkerDetailScreen';
import BookingsScreen from './screens/BookingsScreen';
import ProfileScreen from './screens/ProfileScreen';
import BookingDetailScreen from './screens/BookingDetailScreen';
import ServiceRequestScreen from './screens/ServiceRequestScreen';
import HelpScreen from './screens/HelpScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SecurityScreen from './screens/SecurityScreen';
import WorkerDashboardScreen from './screens/WorkerDashboardScreen';
import WorkerMapScreen from './screens/WorkerMapScreen';
import ChatsScreen from './screens/ChatsScreen';
import ChatScreen from './screens/ChatScreen';
import HomeScreenNew from './screens/HomeScreen.new';
import HomeScreenOld from './screens/HomeScreen.old';
import HomeScreenTemp from './screens/HomeScreen.temp';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Premium transition configurations
const premiumTransition = {
  animation: 'spring',
  config: {
    stiffness: 80,
    damping: 20,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

const modalTransition = {
  animation: 'spring',
  config: {
    damping: 30,
    mass: 1,
    stiffness: 120,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

// Main App Navigator
function AppNavigator() {
  const { user, loading } = useAuth();

  console.log('AppNavigator - user:', user ? 'logged in' : 'not logged in', 'loading:', loading);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C2C2C' }}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          ...premiumTransition,
          presentation: 'card',
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    );
  }

  // Homeowner tabs
  if (user.user_type === 'homeowner') {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') iconName = 'home';
            else if (route.name === 'Workers') iconName = 'construction';
            else if (route.name === 'Bookings') iconName = 'calendar-today';
            else if (route.name === 'Chats') iconName = 'chat';
            else if (route.name === 'Profile') iconName = 'person';
            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FFD700',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: 'rgba(255, 215, 0, 0.2)',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Workers" component={WorkersScreen} />
        <Tab.Screen name="Bookings" component={BookingsScreen} />
        <Tab.Screen name="Chats" component={ChatsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    );
  }

  // Worker tabs
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Jobs') iconName = 'work';
          else if (route.name === 'Map') iconName = 'map';
          else if (route.name === 'Chats') iconName = 'chat';
          else if (route.name === 'Profile') iconName = 'person';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: 'rgba(255, 215, 0, 0.2)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#FFD700',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
      })}
    >
      <Tab.Screen name="Jobs" component={BookingsScreen} />
      <Tab.Screen name="Map" component={WorkerMapScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Modal screens (accessible from anywhere)
function RootNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        ...premiumTransition,
        presentation: 'card',
      }}
    >
      <Stack.Screen name="Main" component={AppNavigator} />
      <Stack.Screen 
        name="WorkerDashboard" 
        component={WorkerDashboardScreen}
        options={{ 
          headerShown: true,
          headerTitle: 'Worker Dashboard',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
          ...premiumTransition,
        }}
      />
      <Stack.Screen 
        name="WorkerDetail" 
        component={WorkerDetailScreen}
        options={{ 
          presentation: 'modal',
          headerShown: false,
          ...modalTransition,
        }}
      />
      <Stack.Screen 
        name="BookingDetail" 
        component={BookingDetailScreen}
        options={{ 
          presentation: 'modal',
          headerShown: true,
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
          ...modalTransition,
        }}
      />
      <Stack.Screen 
        name="ServiceRequest" 
        component={ServiceRequestScreen}
        options={{ 
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Request Service',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
          ...modalTransition,
        }}
      />
      <Stack.Screen 
        name="Help" 
        component={HelpScreen}
        options={{ 
          headerShown: false,
          ...premiumTransition,
        }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{ 
          headerShown: false,
          ...premiumTransition,
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ 
          headerShown: false,
          ...premiumTransition,
        }}
      />
      <Stack.Screen 
        name="Security" 
        component={SecurityScreen}
        options={{ 
          headerShown: false,
          ...premiumTransition,
        }}
      />
      <Stack.Screen 
        name="Chats" 
        component={ChatsScreen}
        options={{ 
          headerShown: true,
          headerTitle: 'Messages',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
          ...premiumTransition,
        }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ 
          headerShown: false,
          ...premiumTransition,
        }}
      />
      {/* Legacy Home Screens for reference/testing */}
      <Stack.Screen name="HomeNew" component={HomeScreenNew} />
      <Stack.Screen name="HomeOld" component={HomeScreenOld} />
      <Stack.Screen name="HomeTemp" component={HomeScreenTemp} />
    </Stack.Navigator>
  );
}


export default function App() {
  const [appReady, setAppReady] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function prepare() {
      try {
        // Add a small delay to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        setAppReady(true);
      } catch (e) {
        console.error('Error preparing app:', e);
        setError(e);
      }
    }
    prepare();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 20 }}>
        <Icon name="error-outline" size={60} color="#FFD700" />
        <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
          App Initialization Error
        </Text>
        <Text style={{ color: '#fff', marginTop: 10, textAlign: 'center' }}>
          {error.toString()}
        </Text>
      </View>
    );
  }

  if (!appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#FFD700', marginTop: 20, fontSize: 16 }}>Loading HIFIX...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

