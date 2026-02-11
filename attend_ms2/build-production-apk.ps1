# Production APK Build Script for AI Attend Tracker
# This script builds the production APK with the correct configuration

Write-Host "🚀 Building Production APK for AI Attend Tracker" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "app.json")) {
    Write-Host "❌ Error: app.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

# Display current configuration
Write-Host "`n📋 Current Configuration:" -ForegroundColor Yellow
Write-Host "Project: AI_Attend_Tracker" -ForegroundColor White
Write-Host "API Domain: https://brave-smooth-favourite-geek.trycloudflare.com" -ForegroundColor White
Write-Host "Database: CX18BRKERP" -ForegroundColor White
Write-Host "Build Type: APK (production-apk)" -ForegroundColor White

# Check EAS login status
Write-Host "`n🔐 Checking EAS login status..." -ForegroundColor Yellow
$whoami = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged into EAS. Please run 'eas login' first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Logged in as: $whoami" -ForegroundColor Green

# Verify project configuration
Write-Host "`n🔍 Verifying project configuration..." -ForegroundColor Yellow
$appJson = Get-Content "app.json" | ConvertFrom-Json
$projectId = $appJson.expo.extra.eas.projectId
Write-Host "✅ Project ID: $projectId" -ForegroundColor Green
Write-Host "✅ Package: $($appJson.expo.android.package)" -ForegroundColor Green

# Check if production environment is ready
Write-Host "`n⚙️ Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env.production") {
    Write-Host "✅ .env.production found" -ForegroundColor Green
    $envContent = Get-Content ".env.production" | Select-String "API_BASE_URL"
    Write-Host "✅ API URL configured: $envContent" -ForegroundColor Green
} else {
    Write-Host "❌ .env.production not found" -ForegroundColor Red
    exit 1
}

# Start the build
Write-Host "`n🔨 Starting production APK build..." -ForegroundColor Yellow
Write-Host "This may take 10-20 minutes depending on your internet connection." -ForegroundColor White
Write-Host "Build profile: production-apk" -ForegroundColor White

# Run the EAS build command
Write-Host "`n▶️ Running: eas build --platform android --profile production-apk" -ForegroundColor Cyan

try {
    eas build --platform android --profile production-apk --non-interactive
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n🎉 APK build completed successfully!" -ForegroundColor Green
        Write-Host "=================================================" -ForegroundColor Green
        Write-Host "✅ Your production APK is ready!" -ForegroundColor Green
        Write-Host "📱 You can download it from the EAS dashboard:" -ForegroundColor White
        Write-Host "   https://expo.dev/accounts/henry_007/projects/ai-attend-tracker-e8j784c/builds" -ForegroundColor Cyan
        Write-Host "`n📋 Build Configuration Used:" -ForegroundColor Yellow
        Write-Host "   - API: https://brave-smooth-favourite-geek.trycloudflare.com" -ForegroundColor White
        Write-Host "   - Database: CX18BRKERP" -ForegroundColor White
        Write-Host "   - Build Type: APK" -ForegroundColor White
        Write-Host "   - Environment: Production" -ForegroundColor White
        
        Write-Host "`n🔄 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. Download the APK from the EAS dashboard" -ForegroundColor White
        Write-Host "2. Install on Android device for testing" -ForegroundColor White
        Write-Host "3. Test login with Company Code: 1, Employee: AI-EMP-014" -ForegroundColor White
        Write-Host "4. Verify face recognition and attendance features" -ForegroundColor White
    } else {
        Write-Host "`n❌ Build failed!" -ForegroundColor Red
        Write-Host "Please check the error messages above and try again." -ForegroundColor White
    }
} catch {
    Write-Host "`n❌ Build failed with error: $_" -ForegroundColor Red
}

Write-Host "`n📝 Build log saved. Check EAS dashboard for detailed logs." -ForegroundColor White
