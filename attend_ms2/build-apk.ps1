# Production APK Build Script for AI Attend Tracker
Write-Host "Building Production APK for AI Attend Tracker" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Check EAS login
Write-Host "Checking EAS login status..." -ForegroundColor Yellow
eas whoami

# Start build
Write-Host "Starting production APK build..." -ForegroundColor Yellow
Write-Host "This may take 10-20 minutes." -ForegroundColor White

eas build --platform android --profile production-apk --non-interactive

Write-Host "Build process initiated!" -ForegroundColor Green
Write-Host "Check EAS dashboard for progress and download link." -ForegroundColor White
