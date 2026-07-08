# API Configuration Guide

## For Web Browser
The app should work automatically with `http://localhost:5000/api`

## For Physical Devices (Scanning QR Code)

If you're testing on a physical device by scanning the QR code, you need to:

1. **Find your computer's IP address:**
   - Windows: Open Command Prompt and run `ipconfig` - look for "IPv4 Address"
   - Mac/Linux: Run `ifconfig` or `ip addr` - look for your local network IP (usually 192.168.x.x)

2. **Update the API URL:**
   - Open `frontend/config/api.js`
   - Replace `localhost` with your IP address
   - Example: If your IP is `192.168.1.100`, use: `http://192.168.1.100:5000/api`

3. **Make sure both devices are on the same network**

4. **Restart the Expo server after changing the API URL**

## For Android Emulator
Use: `http://10.0.2.2:5000/api` (already configured)

## For iOS Simulator
Use: `http://localhost:5000/api` (already configured)

## Quick Fix for Physical Device Testing

Temporarily update `frontend/config/api.js`:

```javascript
// Replace this line:
API_BASE_URL = 'http://localhost:5000/api';

// With your IP:
API_BASE_URL = 'http://YOUR_IP_ADDRESS:5000/api';
```

Then restart the Expo server.

