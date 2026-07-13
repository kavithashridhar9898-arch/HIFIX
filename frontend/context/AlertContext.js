import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from './ThemeContext';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error', // 'error', 'success', 'info'
    onConfirm: null,
  });

  const { theme, isDarkMode } = useTheme();
  const scaleValue = useRef(new Animated.Value(0.8)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  const showAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 40,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideAlert = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAlertConfig(prev => ({ ...prev, visible: false }));
      if (alertConfig.onConfirm) {
        alertConfig.onConfirm();
      }
    });
  };

  const getIconConfig = (type) => {
    switch (type) {
      case 'success':
        return { name: 'check-circle', color: '#22C55E' };
      case 'info':
        return { name: 'info', color: '#38bdf8' };
      case 'error':
      default:
        return { name: 'error', color: '#EF4444' };
    }
  };

  const iconConfig = getIconConfig(alertConfig.type);
  
  // Adaptive colors for the modal surface
  const modalBackgroundColor = isDarkMode ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const textColor = isDarkMode ? '#FFFFFF' : '#111827';
  const textSecondaryColor = isDarkMode ? '#9CA3AF' : '#4B5563';
  const buttonBackgroundColor = iconConfig.color;

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        transparent
        visible={alertConfig.visible}
        animationType="none"
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, { opacity: opacityValue }]} />
          
          <Animated.View 
            style={[
              styles.alertContainer, 
              { 
                backgroundColor: modalBackgroundColor,
                transform: [{ scale: scaleValue }],
                opacity: opacityValue
              }
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${iconConfig.color}20` }]}>
              <Icon name={iconConfig.name} size={40} color={iconConfig.color} />
            </View>
            
            <Text style={[styles.title, { color: textColor }]}>{alertConfig.title}</Text>
            <Text style={[styles.message, { color: textSecondaryColor }]}>{alertConfig.message}</Text>
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: buttonBackgroundColor }]} 
              onPress={hideAlert}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alertContainer: {
    width: '80%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
