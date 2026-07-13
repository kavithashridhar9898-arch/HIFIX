import { Platform } from 'react-native';
import Constants from 'expo-constants';

let GoogleSignin = null;
let isNativeModuleAvailable = false;

try {
  if (Platform.OS !== 'web') {
    const nativeModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = nativeModule.GoogleSignin;
    isNativeModuleAvailable = true;
  }
} catch (e) {
  console.warn('Google Sign-in native module not loaded. Fallback dev mock mode will be used.', e);
}

// Check if running in Expo Go or if native module is unavailable
const isExpoGo = Constants.appOwnership === 'expo' || !isNativeModuleAvailable;

// Configure Google Sign-in if native module is available
if (isNativeModuleAvailable && GoogleSignin) {
  GoogleSignin.configure({
    webClientId: '123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com', // Replace with real Web Client ID
    offlineAccess: true,
  });
}

/**
 * Initiates the Google Sign-In flow.
 * Returns { idToken } on success, or throws an error.
 */
export const signInWithGoogle = async (onMockPrompt) => {
  if (isExpoGo) {
    // In Expo Go or when native module is missing, run mock flow
    return new Promise((resolve, reject) => {
      if (onMockPrompt) {
        onMockPrompt((mockToken) => {
          if (mockToken) {
            resolve({ idToken: mockToken });
          } else {
            reject(new Error('User cancelled sign-in'));
          }
        });
      } else {
        // Fallback default mock token
        resolve({ idToken: 'mock_token_john_doe' });
      }
    });
  }

  // Native flow
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken || userInfo.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In returned no ID Token.');
    }
    return { idToken };
  } catch (error) {
    console.error('Google native sign-in error:', error);
    throw error;
  }
};
