# HIFIX Logo & Icon Setup Guide

## Step 1: Get Your Logo Image

You need to save your HIFIX logo image file. The logo should show:
- Dark gray house outline
- Blue glowing tools (wrench, screwdriver, hammer) inside
- "HiFix" text below (or you can use just the icon part for smaller sizes)

## Step 2: Create Required Sizes

### Option A: Using Online Tools (Easiest)

1. Go to https://www.appicon.co/ or https://icon.kitchen/
2. Upload your logo image
3. Select "Expo" or "React Native" as the platform
4. Download the generated icons
5. Extract and place them in `frontend/assets/` folder

### Option B: Manual Creation

Use any image editor to create these files:

1. **logo.png** - 512x512 or larger (for display in app)
2. **icon.png** - 1024x1024 (main app icon)
3. **adaptive-icon.png** - 1024x1024 (Android adaptive icon - keep content in center)
4. **splash.png** - 1242x2436 (splash screen with dark gray background #2C2C2C)
5. **favicon.png** - 48x48 or 64x64 (web favicon)

## Step 3: File Placement

Place all files in: `frontend/assets/`

```
frontend/assets/
├── logo.png          ✅ Required for Logo component
├── icon.png          ✅ Required for app icon
├── adaptive-icon.png ✅ Required for Android
├── splash.png        ✅ Required for splash screen
└── favicon.png       ✅ Optional (for web)
```

## Step 4: Verify Setup

After adding the files, run:
```bash
cd frontend
npm start
```

The app should now display your logo correctly!

## Tips

- For **icon.png** and **adaptive-icon.png**: Make sure the logo looks good when cropped to a circle/square shape
- Keep important visual elements (the tools) within the center 80% of the image
- For **splash.png**: Use a dark gray background (#2C2C2C) to match the app theme
- The **logo.png** can include the text "HiFix" for welcome screens
- App icons typically work better without text, using just the house+tools icon

