# Quick Start Deployment Guide

This guide provides a quick overview to get your AI Attend Tracker deployed to production.

## 📋 What You Need

### Accounts & Services
- [ ] Windows Server 2022 with admin access
- [ ] Domain: api.ailabtech.com pointing to your server
- [ ] SSL certificate for api.ailabtech.com
- [ ] Expo account (https://expo.dev)
- [ ] Google Play Console account ($25 one-time)
- [ ] Apple Developer account ($99/year)

### Software Requirements
- [ ] Node.js 18+ on Windows Server
- [ ] PostgreSQL on Windows Server
- [ ] IIS on Windows Server
- [ ] NSSM (service manager)

## 🚀 Deployment Steps

### Step 1: Backend Server (Windows Server 2022)

Follow the detailed guide: [Windows Server Setup](./windows-server-setup.md)

**Quick Commands:**
```powershell
# 1. Install Node.js and PostgreSQL
# Download and install from official websites

# 2. Create directories
New-Item -ItemType Directory -Path "C:\AIAttend\app" -Force
New-Item -ItemType Directory -Path "C:\AIAttend\logs" -Force

# 3. Copy your project files to C:\AIAttend\app

# 4. Install dependencies
cd C:\AIAttend\app
npm install --production

# 5. Configure environment
# Edit .env.production with your settings

# 6. Run automated deployment script
.\deployment\deploy-backend.ps1
```

### Step 2: IIS Reverse Proxy

Follow the detailed guide: [IIS Reverse Proxy Setup](./iis-reverse-proxy-setup.md)

**Quick Commands:**
```powershell
# 1. Install IIS
Install-WindowsFeature -Name Web-Server -IncludeManagementTools

# 2. Install URL Rewrite and ARR
# Download and install from Microsoft

# 3. Create website and configure SSL
# Follow detailed guide for web.config and SSL setup

# 4. Test
Invoke-WebRequest -Uri "https://api.ailabtech.com/health"
```

### Step 3: Mobile App - Android

Follow the detailed guide: [Google Play Store Deployment](./google-play-store-deployment.md)

**Quick Commands:**
```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Build Android app
eas build --platform android --profile production

# 4. Download AAB and upload to Google Play Console
# Follow the guide for store listing setup
```

### Step 4: Mobile App - iOS

Follow the detailed guide: [Apple App Store Deployment](./apple-app-store-deployment.md)

**Quick Commands:**
```bash
# 1. Build iOS app
eas build --platform ios --profile production

# 2. Upload to App Store Connect
# IPA is automatically uploaded after build

# 3. Configure app in App Store Connect
# Follow the guide for store listing setup
```

## 📁 Project Structure

```
Attendance/
├── deployment/                    # 📂 Deployment guides (you are here)
│   ├── README.md                 # Main deployment guide
│   ├── QUICK-START.md            # This file
│   ├── windows-server-setup.md   # Windows Server setup
│   ├── iis-reverse-proxy-setup.md # IIS configuration
│   ├── google-play-store-deployment.md # Android deployment
│   ├── apple-app-store-deployment.md   # iOS deployment
│   ├── deploy-backend.ps1        # Automated deployment script
│   └── deployment-checklist.md   # Complete checklist
│
├── .env.production               # 🔐 Production environment config
├── eas.json                      # ✅ EAS build configuration (updated)
├── app.json                      # ✅ Expo configuration (updated)
└── package.json                  # Dependencies
```

## 🔐 Important Configuration Files

### 1. `.env.production`
**Location:** Root directory  
**Purpose:** Production environment variables  
**Action Required:** 
- Replace `CHANGE_THIS_PASSWORD` with actual database password
- Replace `CHANGE_THIS_TO_A_VERY_LONG_RANDOM_SECRET` with strong JWT secret
- Verify all URLs and settings

### 2. `eas.json`
**Location:** Root directory  
**Purpose:** EAS build configuration  
**Status:** ✅ Already configured with production settings
- Production API: https://api.ailabtech.com
- Build profiles for Android (AAB) and iOS

### 3. `app.json`
**Location:** Root directory  
**Purpose:** Expo app configuration  
**Status:** ✅ Already configured with:
- iOS permission descriptions
- Android version code
- Bundle identifiers
- App icons and splash screens

## 🎯 Quick Deployment Workflow

### For Backend Updates:
```powershell
# On Windows Server
cd C:\AIAttend\app

# Pull latest code or copy new files
# Then run:
.\deployment\deploy-backend.ps1
```

### For Mobile App Updates:
```bash
# Update version in app.json
# Then build:
eas build --platform android --profile production
eas build --platform ios --profile production

# Or for JavaScript-only updates:
eas update --branch production --message "Bug fixes"
```

## ✅ Pre-Deployment Checklist

### Backend
- [ ] `.env.production` configured with real credentials
- [ ] Database created and accessible
- [ ] Domain (api.ailabtech.com) pointing to server
- [ ] SSL certificate installed
- [ ] Firewall configured (ports 80, 443 open)

### Mobile Apps
- [ ] Production API URL set: https://api.ailabtech.com
- [ ] App icons and splash screens ready
- [ ] Screenshots prepared for stores
- [ ] Store descriptions written
- [ ] Privacy policy URL available

## 🧪 Testing

### Test Backend:
```powershell
# Health check
Invoke-WebRequest -Uri "https://api.ailabtech.com/health"

# Check services
nssm status AIAttendBackend
nssm status AIAttendFaceAI

# View logs
Get-Content C:\AIAttend\logs\backend.log -Tail 50
```

### Test Mobile App:
1. Install from TestFlight (iOS) or Internal Testing (Android)
2. Test login with production API
3. Test face recognition
4. Test attendance marking
5. Test all core features

## 🆘 Common Issues

### Backend not accessible
```powershell
# Check services
nssm status AIAttendBackend

# Restart if needed
nssm restart AIAttendBackend

# Check logs
Get-Content C:\AIAttend\logs\backend-error.log -Tail 50
```

### Build fails
```bash
# Clear cache and rebuild
eas build --platform android --profile production --clear-cache
```

### SSL certificate issues
- Verify certificate is valid and not expired
- Check certificate is bound to IIS website
- Verify domain DNS is correct

## 📚 Detailed Documentation

For complete step-by-step instructions, refer to:

1. **[README.md](./README.md)** - Main deployment overview
2. **[Windows Server Setup](./windows-server-setup.md)** - Complete server setup
3. **[IIS Reverse Proxy](./iis-reverse-proxy-setup.md)** - IIS configuration
4. **[Google Play Store](./google-play-store-deployment.md)** - Android deployment
5. **[Apple App Store](./apple-app-store-deployment.md)** - iOS deployment
6. **[Deployment Checklist](./deployment-checklist.md)** - Complete checklist

## 🔗 Useful Commands

### Backend Management
```powershell
# Service status
nssm status AIAttendBackend
nssm status AIAttendFaceAI

# Restart services
nssm restart AIAttendBackend
nssm restart AIAttendFaceAI

# View logs
Get-Content C:\AIAttend\logs\backend.log -Tail 50 -Wait
```

### EAS Build
```bash
# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]

# Download build
eas build:download [BUILD_ID]
```

### App Updates
```bash
# JavaScript-only update (no rebuild)
eas update --branch production --message "Bug fixes"

# Full rebuild
eas build --platform android --profile production
eas build --platform ios --profile production
```

## 📞 Support Resources

- **Expo Docs**: https://docs.expo.dev
- **EAS Build**: https://docs.expo.dev/build/introduction/
- **Google Play Console**: https://play.google.com/console
- **App Store Connect**: https://appstoreconnect.apple.com
- **NSSM**: https://nssm.cc

## 🎉 Next Steps

After successful deployment:

1. ✅ Monitor service logs for errors
2. ✅ Test all features end-to-end
3. ✅ Set up monitoring and alerts
4. ✅ Configure automated backups
5. ✅ Document any custom configurations
6. ✅ Train team on deployment process
7. ✅ Plan for regular updates and maintenance

---

**Need Help?** Refer to the detailed guides in the `deployment/` directory for step-by-step instructions.

**Ready to Deploy?** Start with [Windows Server Setup](./windows-server-setup.md)!
