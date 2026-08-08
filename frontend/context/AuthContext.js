import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        // Fire and forget - refresh silently in background so UI unblocks instantly
        refreshProfile().catch(console.error);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, refreshToken: newRefreshToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('refreshToken', newRefreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(newToken);
      setUser(userData);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return { success: true };
    } catch (error) {
      const errMsg = error.response?.data?.message || 
                     (Array.isArray(error.response?.data?.errors) ? error.response.data.errors[0]?.msg : null) || 
                     error.message || 
                     'Login failed';
      return {
        success: false,
        message: String(errMsg),
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token: newToken, refreshToken: newRefreshToken, user: registeredUser } = response.data;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('refreshToken', newRefreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(registeredUser));
      
      setToken(newToken);
      setUser(registeredUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
      delete api.defaults.headers.common['Authorization'];
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      }
    } catch (error) {
      console.error('Failed to refresh profile', error);
      if (error.response?.status === 401) {
        // Token is invalid, so log out
        await logout();
      }
    }
  };

  const loginWithGoogle = async (idToken, userType, serviceType) => {
    try {
      const response = await api.post('/auth/google', {
        idToken,
        user_type: userType,
        service_type: serviceType
      });
      
      if (response.data.success) {
        const { token: newToken, refreshToken: newRefreshToken, user: userData } = response.data;
        
        await AsyncStorage.setItem('token', newToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        setToken(newToken);
        setUser(userData);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        return { success: true };
      } else if (response.data.code === 'ROLE_REQUIRED') {
        return {
          success: false,
          code: 'ROLE_REQUIRED',
          googleProfile: response.data.googleProfile
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Google login failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Google authentication failed'
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        loginWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};