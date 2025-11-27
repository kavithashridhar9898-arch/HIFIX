# Biometric Authentication Feature

## Overview
The app now supports biometric authentication (fingerprint, Face ID, or iris recognition) for quick and secure login.

## Features Implemented

### 1. Security Screen Toggle
- **Location**: Profile → Security → Biometric Authentication
- **Functionality**:
  - Detects device biometric capabilities
  - Shows biometric type (Fingerprint/Face ID/Iris)
  - Toggle to enable/disable biometric login
  - Requires biometric authentication to enable
  - Stores preference in AsyncStorage

### 2. Login Screen Integration
- **Biometric Button**: Appears only when biometric is enabled
- **Quick Login**: Tap fingerprint icon to login instantly
- **Fallback**: Can still use email/password if biometric fails

### 3. Security Features
- Credentials encrypted and stored locally only when biometric is enabled
- Biometric authentication required before storing credentials
- Can be disabled anytime from Security settings
- No credentials stored on server

## How to Use

### Enable Biometric Authentication:
1. Login with your email and password
2. Go to **Profile → Security**
3. Toggle **"Biometric Authentication"** ON
4. Authenticate with your device biometric (fingerprint/face)
5. Credentials will be securely saved

### Login with Biometrics:
1. Open the app
2. Your email will be pre-filled
3. Tap the **"Login with Biometrics"** button
4. Use your fingerprint/face to authenticate
5. You'll be logged in instantly!

### Disable Biometric Authentication:
1. Go to **Profile → Security**
2. Toggle **"Biometric Authentication"** OFF
3. Confirm to disable
4. Saved credentials will be removed

## Technical Details

### Packages Used
- `expo-local-authentication`: Handles biometric authentication
- `@react-native-async-storage/async-storage`: Stores preferences and credentials

### Storage Keys
- `biometricEnabled`: Boolean flag for biometric status
- `userEmail`: Encrypted user email
- `userPassword`: Encrypted user password

### Device Requirements
- Device must have biometric hardware (fingerprint sensor, Face ID, etc.)
- Biometric authentication must be set up in device settings
- At least one fingerprint or face enrolled

### Supported Biometric Types
- ✅ Fingerprint (most Android devices)
- ✅ Face ID (iPhone X and newer)
- ✅ Face Recognition (some Android devices)
- ✅ Iris Scanner (some Samsung devices)

## Security Notes

### What's Secure:
- Credentials stored locally only (never on server)
- AsyncStorage is encrypted on iOS by default
- Biometric authentication uses device's secure enclave
- Re-authentication required to enable feature

### Important:
- If you disable biometric or uninstall app, credentials are removed
- Biometric data never leaves your device
- Always use a strong password as fallback
- Keep your device biometric settings secure

## Troubleshooting

### "Biometric Not Available"
**Solution**: 
- Check if your device has fingerprint/Face ID hardware
- Ensure biometric is set up in device Settings
- Enroll at least one fingerprint or face

### Biometric Login Not Working
**Solution**:
- Disable and re-enable biometric in Security settings
- Try logging in manually once
- Check if device biometric settings changed

### Can't Find Biometric Toggle
**Solution**:
- Update app to latest version
- Check if running on physical device (not emulator)
- Verify device supports biometrics

## Future Enhancements
- [ ] Biometric for sensitive actions (password change, delete account)
- [ ] Option to require biometric for app unlock
- [ ] Biometric for payment confirmations
- [ ] Multiple device biometric management
