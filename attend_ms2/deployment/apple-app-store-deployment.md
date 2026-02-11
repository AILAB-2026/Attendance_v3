# Apple App Store Deployment Guide

This guide covers building and publishing the AI Attend Tracker iOS app to the Apple App Store using EAS (Expo Application Services) Build.

## 📋 Prerequisites

- Apple Developer account ($99/year)
- Expo account (sign up at https://expo.dev)
- EAS CLI installed: `npm install -g eas-cli`
- Mac computer (for some steps) or use EAS Build
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

## 🍎 Step 2: Apple Developer Account Setup

### Create Apple Developer Account

1. **Sign Up**
   - Visit: https://developer.apple.com
   - Click "Account"
   - Sign in with Apple ID or create new one
   - Enroll in Apple Developer Program ($99/year)
   - Complete enrollment process (may take 24-48 hours)

2. **Verify Enrollment**
   - Check email for confirmation
   - Sign in to https://developer.apple.com/account
   - Verify you have access to Certificates, Identifiers & Profiles

## 📱 Step 3: Configure App for Production

Your app is already configured with:
- **Bundle ID**: com.attendance.ai-attend-tracker-e8j784c
- **EAS Project ID**: a3d7a7fb-c0e8-4886-847a-db4ac659c5cf
- **App Name**: AI_Attend_Tracker

## 🔐 Step 4: Configure Apple Credentials in EAS

EAS can automatically manage your Apple credentials:

```bash
# Configure credentials
eas credentials

# Or let EAS handle it automatically during build
# EAS will prompt for Apple ID and password
# EAS will generate and manage certificates and provisioning profiles
```

### Manual Configuration (Alternative)

If you prefer manual setup:

1. **Create App ID**
   - Go to https://developer.apple.com/account/resources/identifiers
   - Click "+" to create new identifier
   - Select "App IDs" and click "Continue"
   - Select "App" and click "Continue"
   - Fill in:
     - **Description**: AI Attend Tracker
     - **Bundle ID**: com.attendance.ai-attend-tracker-e8j784c (Explicit)
   - Enable capabilities:
     - Associated Domains
     - Push Notifications (if needed)
   - Click "Continue" and "Register"

2. **Create Certificates**
   - EAS will handle this automatically
   - Or create manually in Apple Developer portal

3. **Create Provisioning Profile**
   - EAS will handle this automatically
   - Or create manually in Apple Developer portal

## 🏗️ Step 5: Build Production iOS App

### Build for App Store

```bash
# Build production iOS app
eas build --platform ios --profile production
```

The build process will:
1. Prompt for Apple ID credentials (if not configured)
2. Upload your code to EAS servers
3. Install dependencies
4. Generate certificates and provisioning profiles
5. Build the iOS app
6. Provide download link for IPA file

### Monitor Build Progress

```bash
# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]

# View build logs
eas build:view [BUILD_ID] --logs
```

### Download Built App

```bash
# Download the built IPA
eas build:download [BUILD_ID]

# Or download from Expo dashboard
# https://expo.dev/accounts/[YOUR_ACCOUNT]/projects/ai-attend-tracker-e8j784c/builds
```

## 🎨 Step 6: Prepare App Store Assets

### App Icon
- **Size**: 1024x1024 pixels
- **Format**: PNG (no transparency)
- **Location**: `assets/images/icon.png`
- Must not include rounded corners (Apple adds them)

### Screenshots

Required for different device sizes:

**iPhone 6.7" Display (iPhone 14 Pro Max, 15 Pro Max)**
- Size: 1290x2796 pixels (portrait) or 2796x1290 (landscape)
- Minimum: 3 screenshots

**iPhone 6.5" Display (iPhone 11 Pro Max, XS Max)**
- Size: 1242x2688 pixels (portrait) or 2688x1242 (landscape)
- Minimum: 3 screenshots

**iPhone 5.5" Display (iPhone 8 Plus)**
- Size: 1242x2208 pixels (portrait) or 2208x1242 (landscape)
- Optional but recommended

**iPad Pro (12.9-inch) 3rd Gen**
- Size: 2048x2732 pixels (portrait) or 2732x2048 (landscape)
- Required if supporting iPad

**iPad Pro (12.9-inch) 2nd Gen**
- Size: 2048x2732 pixels (portrait) or 2732x2048 (landscape)
- Optional

### App Preview Video (Optional)
- 15-30 seconds
- Show key features
- Same sizes as screenshots

### Promotional Text (Optional)
- 170 characters
- Can be updated without new version

## 🏪 Step 7: Create App Store Connect App

1. **Sign in to App Store Connect**
   - Visit: https://appstoreconnect.apple.com
   - Sign in with Apple Developer account

2. **Create New App**
   - Click "My Apps"
   - Click "+" and select "New App"
   - Fill in app information:
     - **Platform**: iOS
     - **Name**: AI Attend Tracker
     - **Primary Language**: English (U.S.)
     - **Bundle ID**: Select com.attendance.ai-attend-tracker-e8j784c
     - **SKU**: aiattendtracker (unique identifier)
     - **User Access**: Full Access
   - Click "Create"

## 📝 Step 8: Fill in App Information

### App Information

1. **General Information**
   - **Name**: AI Attend Tracker
   - **Subtitle** (30 characters):
     ```
     Smart Attendance with AI
     ```
   - **Category**:
     - **Primary**: Business
     - **Secondary**: Productivity

2. **Privacy Policy URL**
   ```
   https://www.ailabtech.com/privacy-policy
   ```

3. **App Store Icon**
   - Upload 1024x1024 PNG icon

### Pricing and Availability

1. **Price**
   - Select "Free" (or set price if paid)

2. **Availability**
   - Select countries/regions
   - Recommended: All countries

### App Privacy

1. **Privacy Policy**
   - Provide URL to privacy policy

2. **Data Collection**
   - Click "Get Started"
   - Answer questions about data collection:
     - **Location**: Yes (for attendance tracking)
     - **Photos**: Yes (for face recognition)
     - **Contact Info**: Yes (name, email)
     - **User Content**: Yes (attendance records)
   
3. **Data Usage**
   - App Functionality
   - Analytics
   - Product Personalization

4. **Data Linking**
   - Specify if data is linked to user identity

5. **Tracking**
   - Specify if app tracks users across apps/websites

## 📱 Step 9: Prepare Version for Submission

### Version Information

1. **Version Number**
   - Start with: 1.0.0

2. **Copyright**
   ```
   2025 AI Lab Tech
   ```

3. **Description** (4000 characters max)
   ```
   AI Attend Tracker - Smart Attendance Management
   
   Transform your attendance management with AI-powered face recognition and intelligent tracking.
   
   KEY FEATURES:
   
   ✓ Face Recognition Clock-In/Out
   • Advanced AI-powered face verification
   • Anti-spoofing technology
   • Secure and contactless attendance
   
   ✓ Location Tracking
   • GPS-based attendance verification
   • Geofencing support
   • Track employee locations during work hours
   
   ✓ Real-time Attendance
   • Instant attendance updates
   • Live dashboard
   • Automatic sync with server
   
   ✓ Leave Management
   • Apply for leaves directly from app
   • Track leave balance
   • Manager approval workflow
   
   ✓ Reports & Analytics
   • Detailed attendance reports
   • Export to PDF
   • Monthly summaries
   
   ✓ Offline Support
   • Works without internet
   • Auto-sync when connected
   • Never miss an attendance entry
   
   ✓ Multi-role Support
   • Employee portal
   • Manager dashboard
   • Admin controls
   
   PERFECT FOR:
   • Small to medium businesses
   • Remote teams
   • Field workforce
   • Organizations requiring secure attendance
   
   SECURITY & PRIVACY:
   • End-to-end encryption
   • Secure data storage
   • Face data stored securely
   • GDPR compliant
   
   Download AI Attend Tracker today and revolutionize your attendance management!
   
   SUPPORT:
   For support, contact us at support@ailabtech.com
   ```

4. **Keywords** (100 characters max)
   ```
   attendance,time tracking,face recognition,HR,workforce,employee,clock in,timesheet
   ```

5. **Support URL**
   ```
   https://www.ailabtech.com/support
   ```

6. **Marketing URL** (Optional)
   ```
   https://www.ailabtech.com/ai-attend-tracker
   ```

7. **Promotional Text** (170 characters, can be updated anytime)
   ```
   AI-powered attendance tracking with face recognition. Perfect for businesses managing remote and field teams. Download now and simplify attendance!
   ```

8. **Screenshots**
   - Upload screenshots for each required device size
   - Show key features: login, face recognition, dashboard, reports
   - Use App Store Screenshot Generator tools if needed

### Build

1. **Upload Build**
   - After EAS build completes, the IPA is automatically uploaded to App Store Connect
   - Or use Transporter app to upload manually
   - Wait for processing (5-30 minutes)

2. **Select Build**
   - Once processed, select the build for this version
   - Click "+" next to "Build"
   - Select the uploaded build

### General App Information

1. **App Icon**
   - Already uploaded with build

2. **Version**
   - 1.0.0

3. **Copyright**
   - 2025 AI Lab Tech

4. **Age Rating**
   - Click "Edit"
   - Answer questionnaire
   - Should be rated 4+ (no objectionable content)

### App Review Information

1. **Contact Information**
   - **First Name**: Your first name
   - **Last Name**: Your last name
   - **Phone Number**: +65 XXXX XXXX
   - **Email**: your-email@ailabtech.com

2. **Demo Account** (Required for review)
   ```
   Username: demo@ailabtech.com
   Password: DemoPassword123!
   
   Note: Provide a test account with sample data
   ```

3. **Notes**
   ```
   This app requires a backend server for authentication and data sync.
   
   Test Account Details:
   - Username: demo@ailabtech.com
   - Password: DemoPassword123!
   
   The app uses:
   - Camera for face recognition attendance
   - Location services for GPS-based attendance verification
   - Background location for tracking during work hours
   
   Please test the following features:
   1. Login with provided credentials
   2. Clock in using face recognition
   3. View attendance dashboard
   4. Apply for leave
   5. View reports
   
   For any questions, please contact: support@ailabtech.com
   ```

4. **Attachment** (Optional)
   - Upload demo video or additional screenshots if needed

### Version Release

1. **Release Options**
   - **Manually release this version**: Recommended for first release
   - **Automatically release this version**: For future updates
   - **Automatically release using phased release**: Gradual rollout

## 🚀 Step 10: Submit for Review

1. **Review Submission**
   - Check all sections are complete
   - Green checkmarks on all required fields

2. **Submit**
   - Click "Add for Review" or "Submit for Review"
   - Confirm submission

3. **Review Process**
   - **Waiting for Review**: 1-3 days
   - **In Review**: 1-2 days
   - **Pending Developer Release**: If manual release selected
   - **Ready for Sale**: App is live

4. **Status Updates**
   - Receive email notifications
   - Check App Store Connect for status
   - May receive questions from reviewer

## 🧪 Step 11: TestFlight (Recommended First)

Before production release, test with TestFlight:

### Internal Testing

1. **Add Internal Testers**
   - Go to TestFlight tab
   - Click "Internal Testing"
   - Add up to 100 internal testers (must have App Store Connect access)

2. **Upload Build**
   - Build automatically appears in TestFlight
   - Add "What to Test" notes

3. **Start Testing**
   - Testers receive email invitation
   - Install TestFlight app
   - Download and test your app

### External Testing

1. **Create External Test Group**
   - Click "External Testing"
   - Create new group
   - Add up to 10,000 external testers

2. **Submit for Beta Review**
   - First external build requires Apple review
   - Usually faster than full App Store review

3. **Invite Testers**
   - Add testers by email
   - Or create public link
   - Testers install via TestFlight

4. **Gather Feedback**
   - Monitor crash reports
   - Collect user feedback
   - Fix issues before production release

## 🔄 Step 12: Update App (Future Updates)

### Build New Version

1. **Update Version in app.json**
   ```json
   {
     "expo": {
       "version": "1.0.1",
       "ios": {
         "buildNumber": "2"
       }
     }
   }
   ```

2. **Build New Version**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Create New Version in App Store Connect**
   - Click "+" next to "iOS App"
   - Enter new version number (e.g., 1.0.1)
   - Fill in "What's New" section
   - Select new build
   - Submit for review

### Automated Updates with EAS Update

For minor updates (JavaScript changes only):

```bash
# Publish update without rebuilding
eas update --branch production --message "Bug fixes and improvements"
```

Users will receive updates automatically without downloading from App Store.

## 📈 Step 13: Monitor and Maintain

### Monitor App Performance

1. **App Store Connect Analytics**
   - App Units (downloads)
   - Sales and Trends
   - Ratings and Reviews
   - Crashes

2. **TestFlight Feedback**
   - Crash reports
   - Beta tester feedback
   - Session data

3. **Respond to Reviews**
   - Reply to user reviews
   - Address issues promptly
   - Thank users for positive feedback

### Maintain App

1. **Regular Updates**
   - Bug fixes
   - New features
   - Performance improvements
   - iOS version compatibility

2. **Monitor Crashes**
   - Use App Store Connect crash reports
   - Use Expo crash reporting
   - Fix critical issues quickly

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
eas build --platform ios --profile production --clear-cache

# Check build logs
eas build:view [BUILD_ID] --logs
```

### Upload Rejected

- **Bundle ID mismatch**: Ensure bundle ID matches in app.json and App Store Connect
- **Version/Build number**: Must be higher than previous
- **Missing capabilities**: Add required capabilities in app.json
- **Invalid icon**: Ensure 1024x1024 PNG without transparency

### App Rejected

Common rejection reasons:
- **Incomplete demo account**: Provide working test credentials
- **Broken functionality**: Test thoroughly before submission
- **Missing privacy policy**: Provide valid privacy policy URL
- **Guideline violations**: Review App Store Review Guidelines
- **Crashes**: Fix all crashes before submission

**How to respond:**
1. Read rejection reason carefully
2. Fix issues mentioned
3. Update build if needed
4. Reply to reviewer in Resolution Center
5. Resubmit for review

### Crashes After Release

1. Check App Store Connect crash reports
2. Reproduce issue locally
3. Fix and release update
4. Consider emergency update if critical

## ✅ Checklist

- [ ] Apple Developer account created and active
- [ ] EAS CLI installed and logged in
- [ ] Apple credentials configured in EAS
- [ ] Production build completed
- [ ] IPA uploaded to App Store Connect
- [ ] App created in App Store Connect
- [ ] App information filled
- [ ] Screenshots uploaded for all required sizes
- [ ] Privacy policy URL provided
- [ ] Age rating completed
- [ ] Demo account provided
- [ ] Build selected for version
- [ ] TestFlight testing completed (recommended)
- [ ] App submitted for review
- [ ] Monitoring setup

## 📱 Testing the Published App

After approval:

```bash
# Install from App Store
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
- **App Store Connect**: https://appstoreconnect.apple.com
- **Apple Developer**: https://developer.apple.com
- **TestFlight**: https://developer.apple.com/testflight/
- **App Store Review Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/
- **Expo Dashboard**: https://expo.dev

## 📞 Support

For issues:
1. Check EAS build logs
2. Review App Store Connect rejection reasons
3. Test with TestFlight first
4. Contact Expo support for build issues
5. Contact Apple Developer support for store issues
6. Check Apple Developer Forums

## 📝 Next Steps

After Apple App Store deployment:
1. Monitor downloads and reviews
2. Set up app analytics
3. Plan marketing strategy
4. Respond to user feedback
5. Plan future updates
6. Consider App Store Optimization (ASO)
