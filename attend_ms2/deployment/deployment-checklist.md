# Deployment Checklist

Complete checklist for deploying AI Attend Tracker to production.

## 🔧 Backend Server Deployment

### Prerequisites
- [ ] Windows Server 2022 with Administrator access
- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and configured
- [ ] Domain name (api.ailabtech.com) pointing to server IP
- [ ] SSL certificate for api.ailabtech.com

### Server Setup
- [ ] Node.js installed and verified (`node --version`)
- [ ] PostgreSQL installed and running
- [ ] Database created: `attendance_db`
- [ ] Database user created with proper permissions
- [ ] Application files copied to `C:\AIAttend\app`
- [ ] Dependencies installed (`npm install --production`)
- [ ] `.env.production` file created and configured
- [ ] Environment file secured (proper permissions)

### NSSM Service Configuration
- [ ] NSSM downloaded and installed
- [ ] Backend service created: `AIAttendBackend`
- [ ] Face AI service created: `AIAttendFaceAI`
- [ ] Services set to auto-start
- [ ] Service logs configured
- [ ] Services started successfully
- [ ] Backend API responding at http://localhost:3000
- [ ] Face AI responding at http://localhost:8888

### Database
- [ ] Database migrations completed
- [ ] Database connection verified
- [ ] Test data seeded (if needed)
- [ ] Database backup configured

### IIS Reverse Proxy
- [ ] IIS installed
- [ ] URL Rewrite module installed
- [ ] Application Request Routing (ARR) installed
- [ ] ARR proxy enabled
- [ ] Website created: `AIAttendAPI`
- [ ] SSL certificate installed
- [ ] HTTPS binding configured
- [ ] HTTP to HTTPS redirect working
- [ ] Reverse proxy rules configured
- [ ] CORS headers configured
- [ ] Security headers configured

### Firewall & Security
- [ ] Firewall rules configured (ports 80, 443)
- [ ] Backend ports (3000, 8888) blocked from external access
- [ ] Localhost access to backend allowed
- [ ] SSL/TLS protocols configured (disable old protocols)
- [ ] HSTS enabled
- [ ] Security headers configured

### Testing
- [ ] Backend API accessible via https://api.ailabtech.com
- [ ] Health endpoint working: https://api.ailabtech.com/health
- [ ] HTTPS redirect working
- [ ] SSL certificate valid
- [ ] API endpoints responding correctly
- [ ] Database queries working
- [ ] Face AI service responding
- [ ] Logs being written correctly

## 📱 Mobile App Deployment

### EAS Build Setup
- [ ] Expo account created
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Logged into EAS (`eas login`)
- [ ] Project configured with EAS
- [ ] `eas.json` configured with production profile
- [ ] `app.json` updated with production settings

### Environment Configuration
- [ ] Production API URL set: https://api.ailabtech.com
- [ ] Environment variables configured in EAS
- [ ] Demo mode disabled
- [ ] Offline banner configured
- [ ] App permissions configured

### Android (Google Play Store)

#### Prerequisites
- [ ] Google Play Console account created ($25 fee paid)
- [ ] App created in Play Console
- [ ] Package name verified: com.spchezhiyan.aiattendtrackere8j784c

#### Build
- [ ] Android production build completed (`eas build --platform android --profile production`)
- [ ] AAB file downloaded
- [ ] Build tested on device

#### Store Listing
- [ ] App name set: AI Attend Tracker
- [ ] Short description written (80 chars)
- [ ] Full description written (4000 chars)
- [ ] App icon uploaded (512x512)
- [ ] Feature graphic uploaded (1024x500)
- [ ] Screenshots uploaded (minimum 2)
- [ ] App category selected: Business
- [ ] Contact details provided
- [ ] Privacy policy URL provided

#### App Content
- [ ] Content rating completed
- [ ] Target audience set (18+)
- [ ] Data safety form completed
- [ ] App access information provided
- [ ] Ads declaration completed

#### Release
- [ ] AAB uploaded to Play Console
- [ ] Release notes written
- [ ] Internal testing completed (recommended)
- [ ] App submitted for review
- [ ] App approved and published

### iOS (Apple App Store)

#### Prerequisites
- [ ] Apple Developer account created ($99/year paid)
- [ ] App ID created: com.attendance.ai-attend-tracker-e8j784c
- [ ] Certificates and provisioning profiles configured

#### Build
- [ ] iOS production build completed (`eas build --platform ios --profile production`)
- [ ] IPA file uploaded to App Store Connect
- [ ] Build processed successfully

#### App Store Connect
- [ ] App created in App Store Connect
- [ ] App name set: AI Attend Tracker
- [ ] Bundle ID selected
- [ ] SKU set

#### Store Listing
- [ ] App name and subtitle set
- [ ] Description written (4000 chars)
- [ ] Keywords set (100 chars)
- [ ] App icon uploaded (1024x1024)
- [ ] Screenshots uploaded for all required sizes
- [ ] Support URL provided
- [ ] Privacy policy URL provided
- [ ] Category selected: Business

#### App Information
- [ ] Age rating completed (4+)
- [ ] Privacy information completed
- [ ] App privacy questions answered
- [ ] Copyright information set

#### Review Information
- [ ] Contact information provided
- [ ] Demo account credentials provided
- [ ] Review notes written
- [ ] Build selected for version

#### Release
- [ ] TestFlight testing completed (recommended)
- [ ] App submitted for review
- [ ] App approved and published

## 🔐 Security Checklist

### Backend Security
- [ ] JWT secret is strong and unique
- [ ] Database password is strong
- [ ] `.env.production` file secured
- [ ] Dev login disabled in production
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] SQL injection protection verified
- [ ] Rate limiting configured (if applicable)

### Mobile App Security
- [ ] API endpoints use HTTPS only
- [ ] Sensitive data encrypted
- [ ] Secure storage used for tokens
- [ ] Face recognition data secured
- [ ] Location data handled properly
- [ ] App permissions justified

### Server Security
- [ ] Windows Server updated
- [ ] Firewall configured
- [ ] Unnecessary services disabled
- [ ] Strong passwords used
- [ ] Remote Desktop secured
- [ ] Antivirus installed and updated

## 📊 Monitoring & Maintenance

### Logging
- [ ] Backend logs configured
- [ ] Face AI logs configured
- [ ] IIS logs enabled
- [ ] Log rotation configured
- [ ] Log monitoring setup

### Monitoring
- [ ] Service status monitoring
- [ ] API health checks
- [ ] Database monitoring
- [ ] Disk space monitoring
- [ ] Memory usage monitoring
- [ ] Error tracking setup

### Backups
- [ ] Database backup scheduled
- [ ] Application files backup scheduled
- [ ] Configuration backup created
- [ ] Backup restoration tested

### Documentation
- [ ] Deployment documentation complete
- [ ] Server access credentials documented (securely)
- [ ] API documentation available
- [ ] Troubleshooting guide available
- [ ] Contact information documented

## 🧪 Testing Checklist

### Backend Testing
- [ ] Health endpoint: https://api.ailabtech.com/health
- [ ] Login endpoint tested
- [ ] Attendance endpoints tested
- [ ] Leave management tested
- [ ] Reports generation tested
- [ ] Face recognition tested
- [ ] Location tracking tested

### Mobile App Testing
- [ ] App installs successfully
- [ ] Login works with production API
- [ ] Face recognition works
- [ ] Location tracking works
- [ ] Clock in/out works
- [ ] Leave application works
- [ ] Reports display correctly
- [ ] Offline mode works
- [ ] Sync works after reconnection
- [ ] Push notifications work (if implemented)

### Cross-Platform Testing
- [ ] Android app tested on multiple devices
- [ ] iOS app tested on multiple devices
- [ ] Different Android versions tested
- [ ] Different iOS versions tested
- [ ] Tablet support tested (if applicable)

### Performance Testing
- [ ] App loads quickly
- [ ] API responds quickly
- [ ] Face recognition is fast
- [ ] Large datasets handled well
- [ ] Memory usage acceptable
- [ ] Battery usage acceptable

## 📱 Post-Deployment

### Immediate Actions
- [ ] Verify all services running
- [ ] Test complete user flow
- [ ] Monitor logs for errors
- [ ] Check API response times
- [ ] Verify database connections

### First 24 Hours
- [ ] Monitor crash reports
- [ ] Check user feedback
- [ ] Monitor server resources
- [ ] Review logs for errors
- [ ] Test from different locations

### First Week
- [ ] Respond to user reviews
- [ ] Address critical bugs
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Plan first update

### Ongoing
- [ ] Regular security updates
- [ ] Monitor app store reviews
- [ ] Track analytics
- [ ] Plan feature updates
- [ ] Maintain documentation

## 🆘 Emergency Contacts

### Technical Contacts
- [ ] Server administrator contact documented
- [ ] Database administrator contact documented
- [ ] Developer contact documented
- [ ] DevOps contact documented

### Service Providers
- [ ] Hosting provider support
- [ ] Domain registrar support
- [ ] SSL certificate provider support
- [ ] Expo support
- [ ] Google Play support
- [ ] Apple Developer support

## ✅ Final Sign-Off

- [ ] All backend services running
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Team trained on deployment process
- [ ] Rollback plan documented
- [ ] Emergency procedures documented
- [ ] Monitoring alerts configured
- [ ] Backup and recovery tested

---

## 📝 Notes

Use this section to document any deployment-specific notes, issues encountered, or special configurations:

```
Date: _______________
Deployed by: _______________
Version: _______________

Notes:
_____________________________________
_____________________________________
_____________________________________
```

---

**Deployment Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Sign-off**: _______________  **Date**: _______________
