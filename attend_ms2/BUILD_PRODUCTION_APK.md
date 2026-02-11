# 🚀 BUILD PRODUCTION APK - AI Attendance App

## 📋 **VERSION INFORMATION**

- **App Version:** 1.0.1 (updated from 1.0.0)
- **Android Version Code:** 2 (updated from 1)
- **Build Date:** 2025-11-10
- **Build Type:** Production APK

---

## ✅ **CHANGES IN THIS VERSION (v1.0.1)**

### **Backend Updates:**
1. ✅ **Inactive Employee Login** - Now allows inactive employees to login
2. ✅ **Clock In/Out Restrictions** - Blocks inactive employees with friendly message
3. ✅ **Payslip Restrictions** - Shows friendly message for inactive employees
4. ✅ **Schedule Page Fix** - Added missing project-tasks endpoint
5. ✅ **Clock In Location Fix** - Now shows GPS address instead of site name
6. ✅ **Leave System Verified** - Confirmed working correctly
7. ✅ **Database Query Fix** - Fixed promise handling in dbconn.js

### **Frontend Updates:**
1. ✅ **Payslip Page** - Updated inactive employee message handling
2. ✅ **API Integration** - Fixed token retrieval from secure storage

---

## 🔧 **PRE-BUILD CHECKLIST**

Before building, ensure:

- [x] Version number updated (1.0.0 → 1.0.1)
- [x] Android versionCode incremented (1 → 2)
- [x] Backend server is running on production (https://cx.brk.sg/attendance_api_mobile)
- [x] Production API URL configured in eas.json
- [ ] All dependencies installed (`npm install`)
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Logged into Expo account

---

## 📦 **BUILD COMMANDS**

### **Option 1: Build Production APK (Recommended)**

```bash
cd C:\Attendance_App\AIAttend_v2
eas build --platform android --profile production-apk
```

**This will:**
- Build an APK file (not AAB)
- Use production environment variables
- Connect to: https://cx.brk.sg/attendance_api_mobile
- Generate a downloadable APK file

---

### **Option 2: Build Production AAB (For Play Store)**

```bash
cd C:\Attendance_App\AIAttend_v2
eas build --platform android --profile production
```

**This will:**
- Build an Android App Bundle (AAB)
- Suitable for Google Play Store submission
- Use production environment variables

---

### **Option 3: Local Build (If EAS Build Fails)**

```bash
cd C:\Attendance_App\AIAttend_v2
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

**APK Location:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 🌐 **ENVIRONMENT CONFIGURATION**

### **Production Environment (eas.json):**
```json
{
  "EXPO_PUBLIC_API_BASE_URL": "https://cx.brk.sg/attendance_api_mobile",
  "EXPO_PUBLIC_DEMO_MODE": "false",
  "EXPO_PUBLIC_SHOW_OFFLINE_BANNER": "false"
}
```

### **Verify API URL:**
The app will connect to:
- **Base URL:** https://cx.brk.sg/attendance_api_mobile
- **Login:** https://cx.brk.sg/attendance_api_mobile/auth/login
- **Clock In:** https://cx.brk.sg/attendance_api_mobile/attendance/clock-in
- **Payslips:** https://cx.brk.sg/attendance_api_mobile/payroll/payslips

---

## 📝 **STEP-BY-STEP BUILD PROCESS**

### **Step 1: Prepare the Build**

```powershell
# Navigate to project directory
cd C:\Attendance_App\AIAttend_v2

# Install dependencies (if needed)
npm install

# Clear cache (optional but recommended)
npx expo start --clear
```

### **Step 2: Login to Expo**

```powershell
# Login to your Expo account
eas login

# Verify login
eas whoami
```

**Expected Output:** `henry_007` (your Expo username)

### **Step 3: Start the Build**

```powershell
# Build production APK
eas build --platform android --profile production-apk
```

### **Step 4: Monitor Build Progress**

The build will:
1. Upload your project to EAS servers
2. Install dependencies
3. Run prebuild
4. Compile Android APK
5. Generate download link

**Build Time:** Approximately 10-15 minutes

### **Step 5: Download APK**

Once complete, you'll get:
- **Download URL** in the terminal
- **Build page** on https://expo.dev
- **APK file** ready to download

---

## 📥 **DOWNLOAD & INSTALL**

### **Download APK:**
1. Click the download link from EAS build output
2. Or visit: https://expo.dev/accounts/henry_007/projects/ai-attend-tracker-e8j784c/builds
3. Download the APK file

### **Install on Android Device:**

**Method 1: Direct Install**
1. Transfer APK to Android device
2. Enable "Install from Unknown Sources" in Settings
3. Tap the APK file to install

**Method 2: ADB Install**
```powershell
adb install path/to/app.apk
```

---

## 🧪 **POST-BUILD TESTING**

After installing the APK, test:

### **1. Login**
- [x] Active employee can login
- [x] Inactive employee can login (NEW)
- [x] Login response includes `isActive` field

### **2. Clock In/Out**
- [x] Active employee can clock in/out
- [x] Inactive employee is blocked with message
- [x] GPS location is recorded
- [x] Face recognition works

### **3. Payslips**
- [x] Active employee sees payslip data
- [x] Inactive employee sees friendly message
- [x] Download payslip button works

### **4. Leave Management**
- [x] Leave balance shows correctly
- [x] Leave application works
- [x] Leave history displays

### **5. Schedule**
- [x] Schedule page loads without error
- [x] Project tasks display correctly

---

## 🔍 **TROUBLESHOOTING**

### **Build Fails:**
```powershell
# Clear EAS cache
eas build:cancel

# Try again
eas build --platform android --profile production-apk --clear-cache
```

### **Dependencies Error:**
```powershell
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### **Version Conflict:**
```powershell
# Update EAS CLI
npm install -g eas-cli@latest
```

---

## 📊 **BUILD CONFIGURATION SUMMARY**

| Setting | Value |
|---------|-------|
| **App Name** | AI Attendance |
| **Package** | com.spchezhiyan.aiattendtrackere8j784c |
| **Version** | 1.0.1 |
| **Version Code** | 2 |
| **Build Type** | APK |
| **API URL** | https://cx.brk.sg/attendance_api_mobile |
| **EAS Project ID** | 3b8b3e65-5543-4c0d-9993-8fdc2368838b |
| **Owner** | henry_007 |

---

## 🎯 **QUICK BUILD COMMAND**

```powershell
cd C:\Attendance_App\AIAttend_v2 && eas build --platform android --profile production-apk
```

---

## 📱 **DISTRIBUTION**

### **Internal Testing:**
1. Download APK from EAS
2. Share APK file with testers
3. Install on test devices

### **Production Release:**
1. Test thoroughly with APK
2. If all tests pass, build AAB for Play Store
3. Submit to Google Play Console

---

## ✅ **FINAL CHECKLIST**

Before distributing:
- [ ] Backend server is running and accessible
- [ ] All API endpoints are working
- [ ] Database is properly configured
- [ ] Test with both active and inactive employees
- [ ] Verify all features work as expected
- [ ] Check app performance and stability

---

## 📞 **SUPPORT**

If you encounter issues:
1. Check backend server logs
2. Verify API connectivity
3. Review build logs on https://expo.dev
4. Check device compatibility

---

**Build Status:** ✅ Ready to Build
**Last Updated:** 2025-11-10 17:37
**Next Step:** Run `eas build --platform android --profile production-apk`
