# Production Hotfix Deployment Script
# Run: .\deploy-hotfix.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AIAttend Production Hotfix Deployment" -ForegroundColor Cyan
Write-Host "  Fix: Clock-in error message display" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path ".\package.json")) {
    Write-Host "ERROR: Must run from AIAttend root directory" -ForegroundColor Red
    exit 1
}

Write-Host "Pre-deployment checks..." -ForegroundColor Yellow
Write-Host ""

# Check if changes are committed
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "WARNING: Uncommitted changes detected" -ForegroundColor Yellow
    Write-Host "Uncommitted files:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $commit = Read-Host "Commit changes first? (y/n)"
    if ($commit -eq "y") {
        $message = Read-Host "Commit message"
        git add .
        git commit -m "$message"
        Write-Host "Changes committed" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Choose deployment method:" -ForegroundColor Cyan
Write-Host "1. OTA Update (Fastest - 5 minutes, users get it immediately)" -ForegroundColor Green
Write-Host "2. Build for App Stores (1-3 days for review)" -ForegroundColor Yellow
Write-Host "3. Test locally first" -ForegroundColor White
Write-Host "4. Cancel" -ForegroundColor Red
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Deploying OTA Update..." -ForegroundColor Green
        Write-Host ""
        
        # Check if EAS is configured
        if (-not (Test-Path ".\eas.json")) {
            Write-Host "ERROR: eas.json not found. OTA updates not configured." -ForegroundColor Red
            Write-Host "Use option 2 to build for app stores instead." -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Publishing update to production channel..." -ForegroundColor Yellow
        npx eas update --branch production --message "Fix: Display error messages for clock-in failures"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "SUCCESS! OTA update published" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "1. Users will get update on next app launch" -ForegroundColor White
            Write-Host "2. Monitor logs for next 24 hours" -ForegroundColor White
            Write-Host "3. Check user feedback" -ForegroundColor White
            Write-Host ""
            Write-Host "Monitor with: pm2 logs" -ForegroundColor Yellow
        } else {
            Write-Host ""
            Write-Host "FAILED! OTA update failed" -ForegroundColor Red
            Write-Host "Check error messages above" -ForegroundColor Yellow
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "Building for App Stores..." -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Choose platform:" -ForegroundColor Cyan
        Write-Host "1. Android only" -ForegroundColor White
        Write-Host "2. iOS only" -ForegroundColor White
        Write-Host "3. Both" -ForegroundColor White
        $platform = Read-Host "Enter choice (1-3)"
        
        $platformArg = switch ($platform) {
            "1" { "android" }
            "2" { "ios" }
            "3" { "all" }
            default { "all" }
        }
        
        Write-Host ""
        Write-Host "Building for $platformArg..." -ForegroundColor Yellow
        npx eas build --platform $platformArg --profile production
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "SUCCESS! Build submitted" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "1. Wait for build to complete (15-30 min)" -ForegroundColor White
            Write-Host "2. Submit to app stores: npx eas submit" -ForegroundColor White
            Write-Host "3. Wait for app store review (1-3 days)" -ForegroundColor White
            Write-Host ""
            Write-Host "Check build status: https://expo.dev" -ForegroundColor Yellow
        } else {
            Write-Host ""
            Write-Host "FAILED! Build failed" -ForegroundColor Red
            Write-Host "Check error messages above" -ForegroundColor Yellow
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "Running local tests..." -ForegroundColor Green
        Write-Host ""
        
        Write-Host "1. Running diagnostics..." -ForegroundColor Yellow
        node run-diagnostics.js
        
        Write-Host ""
        Write-Host "2. Starting development server..." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop when done testing" -ForegroundColor Yellow
        Write-Host ""
        npm start
    }
    
    "4" {
        Write-Host ""
        Write-Host "Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    default {
        Write-Host ""
        Write-Host "Invalid choice. Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
