# AI Attend Tracker - Deployment Guide

This guide covers the complete deployment process for the AI Attend Tracker application, including backend server setup on Windows Server 2022 and mobile app publishing to Google Play Store and Apple App Store.

## 📋 Overview

### Architecture
- **Frontend**: React Native (Expo) with TypeScript
- **Backend**: Node.js with Hono framework (Port 3000)
- **Face AI Service**: Stable face recognition (Port 8888)
- **Database**: PostgreSQL
- **Production API**: https://api.ailabtech.com
- **Server OS**: Windows Server 2022

### Components
1. **Mobile App**: React Native Expo app for iOS and Android
2. **Backend API**: Node.js server with Hono framework
3. **Face AI Service**: Advanced face recognition service
4. **Database**: PostgreSQL database
5. **Reverse Proxy**: IIS with URL Rewrite for HTTPS

## 🚀 Quick Start

### Prerequisites
- Windows Server 2022 with Administrator access
- Node.js 18+ installed
- PostgreSQL installed and configured
- IIS with URL Rewrite and ARR modules
- SSL certificate for api.ailabtech.com
- Expo account (for app builds)
- Google Play Console account
- Apple Developer account

### Deployment Steps

1. **Backend Server Setup**
   - Follow [Windows Server Setup Guide](./windows-server-setup.md)
   - Configure services with NSSM
   - Set up environment variables

2. **IIS Reverse Proxy**
   - Follow [IIS Reverse Proxy Setup](./iis-reverse-proxy-setup.md)
   - Configure SSL certificate
   - Set up URL rewrite rules

3. **Mobile App Publishing**
   - Build apps using EAS Build
   - Follow [Google Play Store Guide](./google-play-store-deployment.md)
   - Follow [Apple App Store Guide](./apple-app-store-deployment.md)

4. **Automated Deployment**
   - Use [PowerShell Deployment Script](./deploy-backend.ps1)
   - Review [Deployment Checklist](./deployment-checklist.md)

## 📁 Project Structure

```
Attendance/
├── app/                    # React Native app screens
├── backend/               # Node.js backend
│   ├── server.js         # Backend entry point
│   └── hono.ts           # Hono app configuration
├── face-ai-stable.js     # Face recognition service
├── deployment/           # Deployment files (this directory)
├── .env                  # Local environment variables
├── .env.production       # Production environment template
├── eas.json             # EAS Build configuration
├── app.json             # Expo configuration
└── package.json         # Dependencies and scripts
```

## 🔧 Environment Configuration

### Local Development
```bash
# Start backend
npm run api:start

# Start face AI service
npm run face-ai:start

# Start mobile app
npm start
```

### Production
- Backend runs as Windows service via NSSM
- Face AI runs as Windows service via NSSM
- Mobile apps connect to https://api.ailabtech.com

## 📱 App Store Information

### Android
- **Package Name**: com.spchezhiyan.aiattendtrackere8j784c
- **Store**: Google Play Store
- **Build Type**: AAB (Android App Bundle)

### iOS
- **Bundle ID**: com.attendance.ai-attend-tracker-e8j784c
- **Store**: Apple App Store
- **Build Type**: IPA

### EAS Project
- **Project ID**: a3d7a7fb-c0e8-4886-847a-db4ac659c5cf

## 🔐 Security Considerations

1. **Environment Variables**: Never commit `.env.production` with real credentials
2. **SSL/TLS**: Always use HTTPS in production
3. **Database**: Use strong passwords and restrict network access
4. **JWT Secret**: Use a strong, unique secret in production
5. **API Keys**: Store sensitive keys in secure environment variables

## 📚 Documentation

- [Windows Server Setup](./windows-server-setup.md) - Complete server configuration
- [IIS Reverse Proxy Setup](./iis-reverse-proxy-setup.md) - HTTPS proxy configuration
- [Google Play Store Deployment](./google-play-store-deployment.md) - Android publishing
- [Apple App Store Deployment](./apple-app-store-deployment.md) - iOS publishing
- [Deployment Checklist](./deployment-checklist.md) - Pre-deployment verification
- [PowerShell Deployment Script](./deploy-backend.ps1) - Automated deployment

## 🆘 Troubleshooting

### Backend Service Issues
```powershell
# Check service status
nssm status AIAttendBackend
nssm status AIAttendFaceAI

# View logs
Get-Content C:\AIAttend\logs\backend.log -Tail 50
Get-Content C:\AIAttend\logs\face-ai.log -Tail 50

# Restart services
nssm restart AIAttendBackend
nssm restart AIAttendFaceAI
```

### IIS Issues
- Check Application Request Routing (ARR) is enabled
- Verify URL Rewrite rules are correct
- Check SSL certificate binding
- Review IIS logs in `C:\inetpub\logs\LogFiles`

### Mobile App Issues
- Verify API endpoint is accessible
- Check environment variables in EAS build
- Review app permissions in app.json
- Test with development build first

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review service logs
3. Verify environment configuration
4. Test individual components

## 📝 License

Copyright © 2025 AI Lab Tech
