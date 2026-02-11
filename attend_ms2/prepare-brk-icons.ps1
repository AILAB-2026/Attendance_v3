# PowerShell script to prepare BRK logo icons from PNG
Write-Host "🎨 Preparing BRK Logo Icons from PNG" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$sourceFile = "assets\images\brk_logo.png"
$assetsDir = "assets\images"

# Check if PNG source exists
if (-not (Test-Path $sourceFile)) {
    Write-Host "❌ PNG source file not found: $sourceFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ PNG source file found: $sourceFile" -ForegroundColor Green

# Check current icon files
$iconFiles = @("icon.png", "adaptive-icon.png", "favicon.png")
Write-Host "`n📋 Current Icon Files Status:" -ForegroundColor Yellow

foreach ($file in $iconFiles) {
    $filePath = Join-Path $assetsDir $file
    if (Test-Path $filePath) {
        $fileInfo = Get-Item $filePath
        Write-Host "  ✅ $file - Size: $($fileInfo.Length) bytes" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - Missing" -ForegroundColor Red
    }
}

Write-Host "`n🛠️ Quick Icon Creation Options:" -ForegroundColor Magenta

Write-Host "`n📱 Option 1: Use Online Icon Generator (Recommended)"
Write-Host "1. Go to https://icon.kitchen"
Write-Host "2. Upload your brk_logo.png"
Write-Host "3. Set background to transparent or white"
Write-Host "4. Adjust padding (recommended: 10%)"
Write-Host "5. Download the generated icons"
Write-Host "6. Replace icon.png, adaptive-icon.png, and favicon.png"

Write-Host "`n🖼️ Option 2: Manual Replacement (Quick Test)"
Write-Host "1. Copy brk_logo.png to icon.png (for testing)"
Write-Host "2. Copy brk_logo.png to adaptive-icon.png (for testing)"
Write-Host "3. Create a smaller version for favicon.png"

Write-Host "`n⚡ Option 3: Quick Test Copy (Use this for immediate testing)"
Write-Host "This will copy your BRK logo to replace the current icons:"

$userChoice = Read-Host "`nDo you want to copy brk_logo.png to replace current icons for testing? (y/n)"

if ($userChoice -eq "y" -or $userChoice -eq "Y") {
    Write-Host "`n🔄 Copying BRK logo to icon files..." -ForegroundColor Blue
    
    # Copy brk_logo.png to icon files
    Copy-Item $sourceFile (Join-Path $assetsDir "icon.png") -Force
    Write-Host "  ✅ Copied to icon.png" -ForegroundColor Green
    
    Copy-Item $sourceFile (Join-Path $assetsDir "adaptive-icon.png") -Force
    Write-Host "  ✅ Copied to adaptive-icon.png" -ForegroundColor Green
    
    Copy-Item $sourceFile (Join-Path $assetsDir "favicon.png") -Force
    Write-Host "  ✅ Copied to favicon.png" -ForegroundColor Green
    
    Write-Host "`n✨ BRK logo icons created successfully!" -ForegroundColor Green
    Write-Host "📱 Your app will now use the BRK logo as the icon." -ForegroundColor Cyan
    
    Write-Host "`n🚀 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Build the APK: eas build --platform android --profile production-apk"
    Write-Host "2. Test the app with new BRK logo icon"
    Write-Host "3. If needed, use icon.kitchen for better optimization"
    
} else {
    Write-Host "`n📝 Manual Steps:" -ForegroundColor Yellow
    Write-Host "1. Use icon.kitchen or similar tool to create proper icons"
    Write-Host "2. Replace icon.png, adaptive-icon.png, and favicon.png"
    Write-Host "3. Build APK when ready"
}

Write-Host "`nOpening assets directory..." -ForegroundColor Blue
Start-Process explorer.exe -ArgumentList (Resolve-Path $assetsDir)

Write-Host "`n🎯 App Configuration Updated:" -ForegroundColor Cyan
Write-Host "  App Name: BRK Attendance"
Write-Host "  Version: 1.0.5 (versionCode: 6)"
Write-Host "  Package: com.spchezhiyan.aiattendtrackere8j784c"
