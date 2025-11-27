# HIFIX - Home Service Connection App

A mobile application that connects homeowners with local service workers (painters, electricians, plumbers) using GPS-based location matching.

## Project Structure

```
pro/
├── backend/          # Node.js/Express backend
├── frontend/         # React Native mobile app
└── README.md
```

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Node.js with Express
- **Database**: MySQL

## Features

- GPS-based worker discovery
- User authentication
- Worker profiles and ratings
- Service booking system
- Real-time location matching

## Setup Instructions

### Backend Setup
```bash
cd backend
npm install
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Database Configuration

- Host: localhost
- User: root
- Password: @Gunther89089
- Database: hifix_db

## App Logo & Icon Setup

To use your HIFIX logo as the app icon and logo:

1. **Add your logo image file** to `frontend/assets/logo.png` (recommended size: 512x512 or larger)
2. **Generate app icons** using an online tool like [App Icon Generator](https://www.appicon.co/):
   - Upload your logo
   - Select "Expo" platform
   - Download and place files in `frontend/assets/`:
     - `icon.png` (1024x1024)
     - `adaptive-icon.png` (1024x1024)
     - `splash.png` (1242x2436 with dark gray background #2C2C2C)
     - `favicon.png` (48x48 for web)
3. **See detailed instructions** in `frontend/assets/README.md` and `frontend/scripts/prepare-assets.md`

## API Endpoints

- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/workers/nearby - Find nearby workers
- GET /api/workers/:id - Get worker details
- POST /api/bookings - Create booking

