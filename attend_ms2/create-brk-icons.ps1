# PowerShell script to create BRK logo icons
Write-Host "🎨 Creating BRK Logo Icons" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

$sourceFile = "assets\images\brk_logo.jpg"
$assetsDir = "assets\images"

# Check if source exists
if (-not (Test-Path $sourceFile)) {
    Write-Host "❌ Source file not found: $sourceFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Source file found: $sourceFile" -ForegroundColor Green

# Create icons using Windows built-in tools or suggest online tools
Write-Host "`n📋 Icon Requirements:" -ForegroundColor Yellow
Write-Host "1. icon.png - 1024x1024 pixels (Main app icon)"
Write-Host "2. adaptive-icon.png - 1024x1024 pixels (Android adaptive icon)"
Write-Host "3. favicon.png - 48x48 pixels (Web favicon)"

Write-Host "`n🛠️ Recommended Online Tools:" -ForegroundColor Magenta
Write-Host "• https://icon.kitchen - Automatic app icon generator"
Write-Host "• https://www.canva.com - Manual design with templates"
Write-Host "• https://appicon.co - App icon generator"

Write-Host "`n📝 Manual Steps:" -ForegroundColor Yellow
Write-Host "1. Go to https://icon.kitchen"
Write-Host "2. Upload your brk_logo.jpg"
Write-Host "3. Adjust size and padding"
Write-Host "4. Download the generated icons"
Write-Host "5. Replace the files in assets/images/"

Write-Host "`n📱 Current App Configuration:" -ForegroundColor Cyan
Write-Host "App Name: BRK Attendance"
Write-Host "Package: com.spchezhiyan.aiattendtrackere8j784c"
Write-Host "Version: 1.0.4"

Write-Host "`n🚀 After replacing icons, run:" -ForegroundColor Green
Write-Host "eas build --platform android --profile production-apk"

# Open the assets directory
Write-Host "`n📂 Opening assets directory..." -ForegroundColor Blue
Start-Process explorer.exe -ArgumentList (Resolve-Path $assetsDir)

# Open icon.kitchen in browser
Write-Host "🌐 Opening icon.kitchen in browser..." -ForegroundColor Blue
Start-Process "https://icon.kitchen"

Write-Host "`n✨ Ready! Follow the steps above to create your BRK icons." -ForegroundColor Green
