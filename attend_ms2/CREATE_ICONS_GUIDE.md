# BRK Logo Icon Creation Guide

## Required Icon Files

You need to create these icon files from `brk_logo.jpg`:

### 1. Main App Icon
- **File**: `assets/images/icon.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparent background
- **Usage**: Main app icon for both iOS and Android

### 2. Adaptive Icon (Android)
- **File**: `assets/images/adaptive-icon.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparent background
- **Usage**: Android adaptive icon foreground

### 3. Favicon
- **File**: `assets/images/favicon.png`
- **Size**: 48x48 pixels
- **Format**: PNG
- **Usage**: Web favicon

## How to Create Icons

### Option 1: Using Online Tools
1. Go to https://www.canva.com or https://www.figma.com
2. Create a new design with 1024x1024 dimensions
3. Upload your `brk_logo.jpg`
4. Resize and center the logo
5. Add padding around the logo (about 10% margin)
6. Export as PNG with transparent background
7. Create smaller versions for favicon

### Option 2: Using Photoshop/GIMP
1. Open `brk_logo.jpg`
2. Create new document: 1024x1024 pixels
3. Place logo in center with padding
4. Ensure background is transparent
5. Export as PNG
6. Create 48x48 version for favicon

### Option 3: Using Expo Icon Generator
1. Use the 1024x1024 PNG you created
2. Run: `npx @expo/image-utils generate-icons assets/images/brk-icon-1024.png`

## Important Notes
- Keep the logo centered with padding
- Use transparent background for better adaptive icon support
- Test the icon on both light and dark backgrounds
- The logo should be clearly visible at small sizes

## After Creating Icons
1. Replace the existing icon files
2. Update app.json (already configured)
3. Rebuild APK with `eas build`
