# Google Play Store Deployment Guide

This guide covers building and publishing the AI Attend Tracker Android app to the Google Play Store using EAS (Expo Application Services) Build.

## 📋 Prerequisites

- Expo account (sign up at https://expo.dev)
- Google Play Console account ($25 one-time fee)
- EAS CLI installed: `npm install -g eas-cli`
- Project configured with EAS (eas.json exists)
- Production backend running at https://api.ailabtech.com

## 🔧 Step 1: Install EAS CLI

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Verify login
eas whoami
```

## 📱 Step 2: Configure App for Production

Your app is already configured with:
- **Package Name**: com.spchezhiyan.aiattendtrackere8j784c
- **EAS Project ID**: a3d7a7fb-c0e8-4886-847a-db4ac659c5cf
- **App Name**: AI_Attend_Tracker

## 🔐 Step 3: Generate Keystore (First Time Only)

EAS will automatically generate and manage your keystore. However, if you need to generate it manually:

```bash
# EAS will handle this automatically during first build
# No manual keystore generation needed
```

## 🏗️ Step 4: Build Production APK/AAB

### Build Android App Bundle (AAB) for Play Store

```bash
# Build production AAB
eas build --platform android --profile production

# Or build APK for testing
eas build --platform android --profile production-apk
```

The build process will:
1. Upload your code to EAS servers
2. Install dependencies
3. Build the Android app
4. Generate signed AAB/APK
5. Provide download link

### Monitor Build Progress

```bash
# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]
```

### Download Built App

```bash
# Download the built AAB
eas build:download [BUILD_ID]

# Or download from Expo dashboard
# https://expo.dev/accounts/[YOUR_ACCOUNT]/projects/ai-attend-tracker-e8j784c/builds
```

## 🎨 Step 5: Prepare Store Assets

### App Icon
- **Size**: 512x512 pixels
- **Format**: PNG (32-bit)
- **Location**: `assets/images/icon.png`

### Feature Graphic
- **Size**: 1024x500 pixels
- **Format**: PNG or JPEG
- Create a promotional banner for your app

### Screenshots
Required for phone and tablet:
- **Phone**: Minimum 2 screenshots (320-3840px on longest side)
- **7-inch Tablet**: Optional but recommended
- **10-inch Tablet**: Optional but recommended

Recommended sizes:
- **Phone**: 1080x1920 (portrait) or 1920x1080 (landscape)
- **Tablet**: 1536x2048 (portrait) or 2048x1536 (landscape)

### App Video (Optional)
- YouTube video URL showcasing your app

## 🏪 Step 6: Create Google Play Console App

1. **Sign in to Google Play Console**
   - Visit: https://play.google.com/console
   - Sign in with your Google account

2. **Create New App**
   - Click "Create app"
   - Fill in app details:
     - **App name**: AI Attend Tracker
     - **Default language**: English (United States)
     - **App or game**: App
     - **Free or paid**: Free (or Paid if applicable)
   - Accept declarations
   - Click "Create app"

3. **Set Up App**
   - Complete the dashboard setup tasks:
     - App access
     - Ads
     - Content rating
     - Target audience
     - News apps
     - COVID-19 contact tracing and status apps
     - Data safety
     - Government apps
     - Financial features
     - Health
     - Copyrights

## 📝 Step 7: Fill in Store Listing

### Main Store Listing

1. **App Details**
   - **App name**: AI Attend Tracker
   - **Short description** (80 characters max):
     ```
     AI-powered attendance tracking with face recognition and location services
     ```
   
   - **Full description** (4000 characters max):
     ```
     AI Attend Tracker - Smart Attendance Management
     
     Transform your attendance management with AI-powered face recognition and intelligent tracking.
     
     KEY FEATURES:
     
     ✓ Face Recognition Clock-In/Out
     - Advanced AI-powered face verification
     - Anti-spoofing technology
     - Secure and contactless attendance
     
     ✓ Location Tracking
     - GPS-based attendance verification
     - Geofencing support
     - Track employee locations during work hours
     
     ✓ Real-time Attendance
     - Instant attendance updates
     - Live dashboard
     - Automatic sync with server
     
     ✓ Leave Management
     - Apply for leaves directly from app
     - Track leave balance
     - Manager approval workflow
     
     ✓ Reports & Analytics
     - Detailed attendance reports
     - Export to PDF
     - Monthly summaries
     
     ✓ Offline Support
     - Works without internet
     - Auto-sync when connected
     - Never miss an attendance entry
     
     ✓ Multi-role Support
     - Employee portal
     - Manager dashboard
     - Admin controls
     
     PERFECT FOR:
     - Small to medium businesses
     - Remote teams
     - Field workforce
     - Organizations requiring secure attendance
     
     SECURITY & PRIVACY:
     - End-to-end encryption
     - Secure data storage
     - GDPR compliant
     - Face data stored securely
     
     Download AI Attend Tracker today and revolutionize your attendance management!
     ```

2. **App Icon**
   - Upload 512x512 PNG icon

3. **Feature Graphic**
   - Upload 1024x500 feature graphic

4. **Phone Screenshots**
   - Upload at least 2 screenshots (up to 8)
   - Show key features: login, face recognition, dashboard, reports

5. **Tablet Screenshots** (Optional)
   - Upload tablet-optimized screenshots

6. **App Category**
   - **Category**: Business
   - **Tags**: attendance, time tracking, HR, workforce management

7. **Contact Details**
   - **Email**: your-support@ailabtech.com
   - **Phone**: +65 XXXX XXXX (optional)
   - **Website**: https://www.ailabtech.com (optional)

8. **Privacy Policy**
   - **URL**: https://www.ailabtech.com/privacy-policy
   - (Create a privacy policy page if you don't have one)

## 🔒 Step 8: Configure App Content

### Content Rating

1. **Start Questionnaire**
   - Select "Business" category
   - Answer questions honestly
   - Submit for rating

### Target Audience

1. **Age Groups**
   - Select: 18 and over
   - This is a business app for employees

### Data Safety

1. **Data Collection**
   - Specify what data you collect:
     - Location (precise and approximate)
     - Photos and videos (for face recognition)
     - Personal info (name, email)
     - App activity (attendance records)
   
2. **Data Usage**
   - App functionality
   - Analytics
   - Account management
   
3. **Data Sharing**
   - Specify if data is shared with third parties
   
4. **Security Practices**
   - Data is encrypted in transit
   - Data is encrypted at rest
   - Users can request data deletion

## 📦 Step 9: Upload App Bundle

1. **Create Release**
   - Go to "Production" or "Internal testing" (recommended for first release)
   - Click "Create new release"

2. **Upload AAB**
   - Upload the AAB file downloaded from EAS Build
   - EAS Build output: `build-XXXXXXXXXX.aab`

3. **Release Notes**
   ```
   Initial release of AI Attend Tracker
   
   Features:
   - AI-powered face recognition attendance
   - Location-based tracking
   - Leave management
   - Real-time attendance dashboard
   - Offline support with auto-sync
   - Detailed reports and analytics
   ```

4. **Review Release**
   - Check for any warnings or errors
   - Resolve any issues

5. **Save and Review**
   - Save the release
   - Complete any remaining tasks

## 🚀 Step 10: Submit for Review

1. **Complete All Tasks**
   - Ensure all dashboard tasks are completed
   - Green checkmarks on all sections

2. **Submit App**
   - Click "Send X releases for review"
   - Confirm submission

3. **Review Process**
   - Initial review: 1-3 days
   - You'll receive email updates
   - May require additional information

## 📊 Step 11: Internal Testing (Recommended First)

Before production release, test with internal users:

1. **Create Internal Testing Release**
   - Go to "Internal testing" track
   - Upload AAB
   - Add testers (up to 100 email addresses)

2. **Share Testing Link**
   - Copy the opt-in URL
   - Share with testers
   - Testers join via link and download from Play Store

3. **Gather Feedback**
   - Test all features
   - Fix any issues
   - Update and re-upload if needed

4. **Promote to Production**
   - Once testing is complete
   - Promote release to production track

## 🔄 Step 12: Update App (Future Updates)

### Build New Version

1. **Update Version in app.json**
   ```json
   {
     "expo": {
       "version": "1.0.1",
       "android": {
         "versionCode": 2
       }
     }
   }
   ```

2. **Build New Version**
   ```bash
   eas build --platform android --profile production
   ```

3. **Upload to Play Console**
   - Create new release
   - Upload new AAB
   - Add release notes
   - Submit for review

### Automated Updates with EAS Update

For minor updates (JavaScript changes only):

```bash
# Publish update without rebuilding
eas update --branch production --message "Bug fixes and improvements"
```

Users will receive updates automatically without downloading from Play Store.

## 📈 Step 13: Monitor and Maintain

### Monitor App Performance

1. **Play Console Dashboard**
   - Installs and uninstalls
   - Ratings and reviews
   - Crashes and ANRs
   - User feedback

2. **Respond to Reviews**
   - Reply to user reviews
   - Address issues promptly
   - Thank users for positive feedback

3. **Track Metrics**
   - Active users
   - Retention rate
   - Crash-free rate
   - User engagement

### Maintain App

1. **Regular Updates**
   - Bug fixes
   - New features
   - Performance improvements
   - Security updates

2. **Monitor Crashes**
   - Use Play Console crash reports
   - Fix critical issues quickly
   - Test thoroughly before release

3. **Keep Dependencies Updated**
   ```bash
   # Update Expo SDK
   npx expo upgrade
   
   # Update dependencies
   npm update
   ```

## 🔧 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
eas build --platform android --profile production --clear-cache

# Check build logs
eas build:view [BUILD_ID]
```

### Upload Rejected

- **Version code must be higher**: Increment `versionCode` in app.json
- **Package name mismatch**: Ensure package name matches in app.json
- **Signing key mismatch**: Use same EAS project for all builds

### App Rejected

- Review rejection reason in email
- Fix issues mentioned
- Resubmit with changes
- Respond to reviewer if needed

### Crashes After Release

1. Check Play Console crash reports
2. Reproduce issue locally
3. Fix and release update
4. Consider rollback if critical

## ✅ Checklist

- [ ] EAS CLI installed and logged in
- [ ] Production build completed
- [ ] AAB downloaded
- [ ] Google Play Console account created
- [ ] App created in Play Console
- [ ] Store listing completed
- [ ] Screenshots and graphics uploaded
- [ ] Content rating completed
- [ ] Data safety form filled
- [ ] Privacy policy URL provided
- [ ] AAB uploaded
- [ ] Release notes added
- [ ] Internal testing completed (recommended)
- [ ] App submitted for review
- [ ] Monitoring setup

## 📱 Testing the Published App

After approval:

```bash
# Install from Play Store
# Search for "AI Attend Tracker" or use direct link

# Test all features:
# - Login with production API
# - Face recognition
# - Location tracking
# - Attendance marking
# - Leave management
# - Reports
```

## 🔗 Useful Links

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **Play Console**: https://play.google.com/console
- **Play Console Help**: https://support.google.com/googleplay/android-developer
- **Expo Dashboard**: https://expo.dev
- **App Store Optimization**: https://developer.android.com/distribute/best-practices/launch

## 📞 Support

For issues:
1. Check EAS build logs
2. Review Play Console rejection reasons
3. Test with internal testing first
4. Contact Expo support for build issues
5. Contact Google Play support for store issues

## 📝 Next Steps

After Google Play Store deployment:
1. Proceed to [Apple App Store Deployment](./apple-app-store-deployment.md)
2. Set up app analytics
3. Plan marketing strategy
4. Monitor user feedback
5. Plan future updates
