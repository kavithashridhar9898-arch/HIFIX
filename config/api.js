import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let API_BASE_URL;

if (Platform.OS === 'web') {
  API_BASE_URL = 'http://localhost:5000/api';
} else {
  // For native, use your computer's IP address when running on a physical device
  API_BASE_URL = 'http://192.168.189.251:5000/api';
   
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token refreshing
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Network error (no response) – don't attempt refresh, just bubble up
    if (!error || !error.response) {
      return Promise.reject(error);
    }

    const originalRequest = error.config || {};
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { token } = response.data;
        
        await AsyncStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        // Handle refresh token failure (e.g., logout user)
        console.error('Token refresh failed:', refreshError);
        // Here you might trigger a logout action
      }
    }
    return Promise.reject(error);
  }
);
// Also export the API base for reuse (e.g., to derive socket origin)
export { API_BASE_URL };

export default api;