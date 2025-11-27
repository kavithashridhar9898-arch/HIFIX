import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = {
    isDarkMode,
    colors: isDarkMode ? darkColors : lightColors,
  };

  return (
    <ThemeContext.Provider value={{ ...theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Dark mode colors - Premium Aurora Theme
const darkColors = {
  background: '#0a0a0f',
  surface: '#1a1a2e',
  card: '#1a1a2e',
  text: '#FFFFFF',
  textSecondary: '#B8B8C8',
  primary: '#FFD700',
  accent: '#C882FF',
  border: 'rgba(255, 215, 0, 0.2)',
  error: '#FF6B6B',
  success: '#4CAF50',
  warning: '#FFB84D',
  inputBackground: 'rgba(26, 26, 46, 0.8)',
  placeholder: '#8888A8',
  shadow: '#FFD700',
  gradient1: '#FFD700',
  gradient2: '#C882FF',
  gradient3: '#FFB464',
};

// Light mode colors
const lightColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#4285F4',
  border: '#E0E0E0',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FFC107',
  inputBackground: '#F9F9F9',
  placeholder: '#999999',
  shadow: '#000000',
};
