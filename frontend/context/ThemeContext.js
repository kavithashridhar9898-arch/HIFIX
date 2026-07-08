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

// Dark mode colors
const darkColors = {
  background: '#101415',
  secondaryBackground: '#16202A',
  surface: 'rgba(255, 255, 255, 0.18)',
  card: 'rgba(255, 255, 255, 0.18)',
  text: '#ffffff',
  textSecondary: '#c3c6d7',
  primary: '#2563eb',
  accent: '#38bdf8',
  accentBlue: '#3b82f6',
  border: 'rgba(255, 255, 255, 0.10)',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  placeholder: '#8d90a0',
  shadow: '#000000',
};

// Light mode colors
const lightColors = {
  background: '#FFFFFF',
  secondaryBackground: '#FAFBFC',
  surface: '#F5F7FA',
  card: '#F5F7FA',
  text: '#101415',
  textSecondary: '#4B5563',
  primary: '#2563eb',
  accent: '#38bdf8',
  accentBlue: '#60A5FA',
  border: 'rgba(255, 255, 255, 0.75)',
  divider: '#E5E7EB',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  placeholder: '#999999',
  shadow: '#000000',
};
