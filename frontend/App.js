import React, { useEffect, useState } from 'react';
import VideoSplashScreen from './screens/VideoSplashScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screens are lazily required for faster startup

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AlertProvider } from './context/AlertContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main App Navigator
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { TabAnimationProvider, useTabAnimation } from './context/TabAnimationContext';
import { Animated } from 'react-native';

const AnimatedTabBar = (props) => {
  const { scrollYClamped, isTabBarVisible } = useTabAnimation();
  const visibilityAnim = React.useRef(new Animated.Value(1)).current; // 1 = visible, 0 = hidden

  React.useEffect(() => {
    Animated.spring(visibilityAnim, {
      toValue: isTabBarVisible ? 1 : 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isTabBarVisible]);

  const scrollOpacity = scrollYClamped.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const scrollTranslateY = scrollYClamped.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 100],
    extrapolate: 'clamp',
  });

  const manualTranslateY = visibilityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0]
  });

  const combinedTranslateY = Animated.add(scrollTranslateY, manualTranslateY);

  return (
    <Animated.View style={{ 
      position: 'absolute', 
      bottom: 20, 
      left: 20, 
      right: 20, 
      opacity: visibilityAnim, // fades out when manually hidden
      transform: [{ translateY: combinedTranslateY }]
    }}>
      <BottomTabBar {...props} />
    </Animated.View>
  );
};

function AppNavigator() {
  const { user, loading } = useAuth();
  const { isDarkMode } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" getComponent={() => require('./screens/WelcomeScreen').default} />
        <Stack.Screen name="Login" getComponent={() => require('./screens/LoginScreen').default} />
        <Stack.Screen name="Register" getComponent={() => require('./screens/RegisterScreen').default} />
        <Stack.Screen name="ForgotPassword" getComponent={() => require('./screens/ForgotPasswordScreen').default} />
      </Stack.Navigator>
    );
  }

  const tabBarStyle = {
    elevation: 10,
    backgroundColor: isDarkMode ? 'rgba(29, 32, 34, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    height: 65,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    paddingBottom: 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: isDarkMode ? 0.4 : 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  };

  const headerStyle = { backgroundColor: isDarkMode ? '#101415' : '#FFFFFF', shadowColor: 'transparent', elevation: 0 };
  const headerTintColor = isDarkMode ? '#e0e3e5' : '#101415';
  const activeTintColor = isDarkMode ? '#7bd0ff' : '#005bb5';
  const inactiveTintColor = isDarkMode ? '#8d90a0' : '#6B7280';

  // Homeowner tabs
  if (user.user_type === 'homeowner') {
    return (
      <Tab.Navigator
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') iconName = 'home';
            else if (route.name === 'Workers') iconName = 'construction';
            else if (route.name === 'Bookings') iconName = 'calendar-today';
            else if (route.name === 'Chats') iconName = 'chat';
            else if (route.name === 'Profile') iconName = 'person';
            return <Icon name={iconName} size={focused ? size + 2 : size} color={color} />;
          },
          tabBarActiveTintColor: activeTintColor,
          tabBarInactiveTintColor: inactiveTintColor,
          tabBarStyle,
          headerStyle,
          headerTintColor,
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 }
        })}
      >
        <Tab.Screen name="Home" getComponent={() => require('./screens/HomeScreen').default} />
        <Tab.Screen name="Workers" getComponent={() => require('./screens/WorkersScreen').default} />
        <Tab.Screen name="Bookings" getComponent={() => require('./screens/BookingsScreen').default} />
        <Tab.Screen name="Chats" getComponent={() => require('./screens/ChatsScreen').default} />
        <Tab.Screen name="Profile" getComponent={() => require('./screens/ProfileScreen').default} />
      </Tab.Navigator>
    );
  }

  // Worker tabs
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Jobs') iconName = 'work';
          else if (route.name === 'Map') iconName = 'map';
          else if (route.name === 'Chats') iconName = 'chat';
          else if (route.name === 'Profile') iconName = 'person';
          return <Icon name={iconName} size={focused ? size + 2 : size} color={color} />;
        },
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        tabBarStyle,
        headerStyle,
        headerTintColor,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 20 }
      })}
    >
      <Tab.Screen name="Jobs" getComponent={() => require('./screens/BookingsScreen').default} />
      <Tab.Screen name="Map" getComponent={() => require('./screens/WorkerMapScreen').default} />
      <Tab.Screen name="Chats" getComponent={() => require('./screens/ChatsScreen').default} />
      <Tab.Screen name="Profile" getComponent={() => require('./screens/ProfileScreen').default} />
    </Tab.Navigator>
  );
}

// Modal screens (accessible from anywhere)
function RootNavigator() {
  const { isDarkMode } = useTheme();
  
  const headerStyle = { backgroundColor: isDarkMode ? '#101415' : '#FFFFFF', shadowColor: 'transparent', elevation: 0 };
  const headerTintColor = isDarkMode ? '#e0e3e5' : '#101415';

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={AppNavigator} />
        <Stack.Screen 
          name="WorkerDashboard" 
          getComponent={() => require('./screens/WorkerDashboardScreen').default}
          options={{ 
            headerShown: true,
            headerTitle: 'Worker Dashboard',
            headerStyle,
            headerTintColor
          }}
        />
        <Stack.Screen 
          name="WorkerDetail" 
          getComponent={() => require('./screens/WorkerDetailScreen').default}
          options={{ 
            presentation: 'modal',
            headerShown: true,
            headerStyle,
            headerTintColor
          }}
        />
        <Stack.Screen 
          name="BookingDetail" 
          getComponent={() => require('./screens/BookingDetailScreen').default}
          options={{ 
            presentation: 'modal',
            headerShown: true,
            headerStyle,
            headerTintColor
          }}
        />
        <Stack.Screen 
          name="ServiceRequest" 
          getComponent={() => require('./screens/ServiceRequestScreen').default}
          options={{ 
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Request Service',
            headerStyle,
            headerTintColor
          }}
        />
        <Stack.Screen 
          name="Help" 
          getComponent={() => require('./screens/HelpScreen').default}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="EditProfile" 
          getComponent={() => require('./screens/EditProfileScreen').default}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Notifications" 
          getComponent={() => require('./screens/NotificationsScreen').default}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Security" 
          getComponent={() => require('./screens/SecurityScreen').default}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Chats" 
          getComponent={() => require('./screens/ChatsScreen').default}
          options={{ 
            headerShown: true,
            headerTitle: 'Messages',
            headerStyle,
            headerTintColor
          }}
        />
        <Stack.Screen 
          name="Chat" 
          getComponent={() => require('./screens/ChatScreen').default}
          options={{ 
            headerShown: false
          }}
        />
      </Stack.Navigator>
    </>
  );
}

export default function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <TabAnimationProvider>
              <AlertProvider>
                <NavigationContainer>
                  <RootNavigator />
                  {isSplashVisible && (
                    <VideoSplashScreen onFinish={() => setIsSplashVisible(false)} />
                  )}
                </NavigationContainer>
              </AlertProvider>
            </TabAnimationProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

