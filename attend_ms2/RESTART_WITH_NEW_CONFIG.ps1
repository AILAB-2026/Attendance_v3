# Restart Expo with New Configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restarting Expo with New Config" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Show current configuration
Write-Host "Step 1: Current Configuration" -ForegroundColor Yellow
Write-Host ""
Get-Content .env | Select-String -Pattern "EXPO_PUBLIC_API_BASE_URL"
Write-Host ""

# Step 2: Kill any existing Expo/Metro processes
Write-Host "Step 2: Stopping existing Expo/Metro processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*AIAttend_v2*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Processes stopped" -ForegroundColor Green
Write-Host ""

# Step 3: Clear Expo cache
Write-Host "Step 3: Clearing Expo cache..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  .expo folder cleared" -ForegroundColor Green
}
if (Test-Path "node_modules\.cache") {
    Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  node_modules cache cleared" -ForegroundColor Green
}
Write-Host ""

# Step 4: Start Expo with clear cache
Write-Host "Step 4: Starting Expo with clear cache..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Expo Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected API URL: https://brave-smooth-favourite-geek.trycloudflare.com" -ForegroundColor Green
Write-Host ""
Write-Host "After app loads on your phone:" -ForegroundColor Yellow
Write-Host "  1. Shake phone -> Reload" -ForegroundColor Gray
Write-Host "  2. Try login with:" -ForegroundColor Gray
Write-Host "     Company Code: 1" -ForegroundColor Gray
Write-Host "     Employee: AI-EMP-014" -ForegroundColor Gray
Write-Host "     Password: password" -ForegroundColor Gray
Write-Host ""

npx expo start -c
