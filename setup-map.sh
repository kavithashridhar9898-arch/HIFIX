#!/bin/bash

# Quick Setup Script for Real-Time GPS Map Features

echo "🚀 Setting up Real-Time GPS Map & Notifications..."
echo ""

# Navigate to frontend
cd frontend

# Install socket.io-client
echo "📦 Installing socket.io-client..."
npm install socket.io-client@4.8.1

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure backend is running: cd ../backend && npm run dev"
echo "2. Start Expo with tunnel: npx expo start --tunnel"
echo "3. Test with a worker account - go to Map tab"
echo ""
echo "📖 See SETUP_REALTIME_MAP.md for full documentation"
