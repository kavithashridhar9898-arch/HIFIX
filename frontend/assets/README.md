# HIFIX App Assets

This folder contains all the image assets for the HIFIX mobile app.

## Required Image Files

To use your HIFIX logo as the app icon and logo, you need to add the following image files:

### 1. **logo.png** (for app display)
- **Size**: Recommended 512x512 pixels or higher
- **Format**: PNG with transparent background preferred
- **Usage**: Displayed in the app's welcome/login screens
- **Description**: Your HIFIX logo with the house outline and blue glowing tools

### 2. **icon.png** (main app icon)
- **Size**: Exactly 1024x1024 pixels
- **Format**: PNG, square
- **Usage**: Main app icon for iOS and general use
- **Description**: Square version of your HIFIX logo (may need to add padding/border to make it square)

### 3. **adaptive-icon.png** (Android adaptive icon)
- **Size**: Exactly 1024x1024 pixels
- **Format**: PNG, square
- **Usage**: Android adaptive icon (the visible area will be cropped to circle/square)
- **Description**: Square version, centered content with safe area margins

### 4. **splash.png** (splash screen)
- **Size**: Recommended 1242x2436 pixels (or use largest device size)
- **Format**: PNG
- **Background**: Should match your app's theme (dark gray #2C2C2C)
- **Description**: Your HIFIX logo centered on the splash screen

### 5. **favicon.png** (web favicon)
- **Size**: 48x48 or 64x64 pixels
- **Format**: PNG
- **Usage**: Web browser favicon

## Quick Setup Instructions

1. **Get your logo image file** (the HIFIX logo with house and blue tools)

2. **Resize/Create the icons:**
   - Use an online tool like: https://www.appicon.co/ or https://icon.kitchen/
   - Upload your logo and it will generate all required sizes
   - Or use image editing software (Photoshop, GIMP, etc.) to create the different sizes

3. **Place all files in this `assets/` folder:**
   ```
   frontend/assets/
   ├── logo.png
   ├── icon.png
   ├── adaptive-icon.png
   ├── splash.png
   └── favicon.png
   ```

4. **For the app icon (icon.png and adaptive-icon.png):**
   - Make sure the logo is centered
   - Add padding if needed to make it look good in a square format
   - Keep important elements within the center 80% (safe zone) for Android adaptive icons

5. **For the splash screen:**
   - Use the dark gray background (#2C2C2C) as specified in app.json
   - Center your logo
   - Make sure it looks good on different screen sizes

## Logo Design Notes

Based on your HIFIX logo description:
- **House outline**: Dark gray
- **Tools (wrench, screwdriver, hammer)**: Bright blue with glow effect
- **Text**: "HiFix" in dark gray below the logo

For app icons, you might want to:
- Use just the house + tools (without text) for smaller icons
- Keep the full logo (with text) for larger displays and splash screen

