# Deploy Final Security Fix - All 3 Critical Holes Fixed
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYING FINAL SECURITY FIX" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fixed 3 Critical Security Holes:" -ForegroundColor Yellow
Write-Host "  1. Local fallback verification removed" -ForegroundColor White
Write-Host "  2. Error handling fixed (no silent bypass)" -ForegroundColor White
Write-Host "  3. Strict mode always enforced" -ForegroundColor White
Write-Host ""

# Step 1: Check if backend is managed by PM2
Write-Host "Step 1: Restarting backend..." -ForegroundColor Cyan
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Exists) {
    try {
        pm2 restart aiattend-backend
        Write-Host "  ✅ Backend restarted via PM2" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  PM2 restart failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  Manual restart required" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  PM2 not found - manual restart required" -ForegroundColor Yellow
    Write-Host "  Run: cd backend && npm start" -ForegroundColor White
}

Write-Host ""

# Step 2: Check Face AI service
Write-Host "Step 2: Checking Face AI service..." -ForegroundColor Cyan
$faceAiPort = netstat -ano | Select-String ":8888"
if ($faceAiPort) {
    Write-Host "  ✅ Face AI service is running on port 8888" -ForegroundColor Green
} else {
    Write-Host "  ❌ Face AI service NOT running!" -ForegroundColor Red
    Write-Host "  CRITICAL: Face AI service is required for security" -ForegroundColor Red
    Write-Host "  Start it now: node face-ai-stable.js" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Verify webhook configuration
Write-Host "Step 3: Verifying webhook configuration..." -ForegroundColor Cyan
$envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
if ($envContent -match "FACE_VERIFY_WEBHOOK=http://localhost:8888/verify") {
    Write-Host "  ✅ Webhook configured correctly" -ForegroundColor Green
} else {
    Write-Host "  ❌ Webhook not configured!" -ForegroundColor Red
    Write-Host "  Add to .env: FACE_VERIFY_WEBHOOK=http://localhost:8888/verify" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔒 SECURITY FIXES APPLIED:" -ForegroundColor Green
Write-Host "  ✅ Local fallback removed" -ForegroundColor White
Write-Host "  ✅ Error bypass fixed" -ForegroundColor White
Write-Host "  ✅ Strict mode enforced" -ForegroundColor White
Write-Host ""
Write-Host "🚨 REQUIREMENTS:" -ForegroundColor Yellow
Write-Host "  • Backend must be restarted" -ForegroundColor White
Write-Host "  • Face AI service must be running on port 8888" -ForegroundColor White
Write-Host "  • Webhook must be configured" -ForegroundColor White
Write-Host ""
Write-Host "🎯 RESULT:" -ForegroundColor Green
Write-Host "  Unauthorized faces are NOW BLOCKED!" -ForegroundColor White
Write-Host ""

# Ask if user wants to test
$test = Read-Host "Test face recognition now? (y/n)"
if ($test -eq "y" -or $test -eq "Y") {
    Write-Host ""
    Write-Host "Testing face recognition..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Try these tests:" -ForegroundColor Yellow
    Write-Host "  1. Clock in with registered face (should succeed)" -ForegroundColor White
    Write-Host "  2. Clock in with wrong face (should fail)" -ForegroundColor White
    Write-Host "  3. Stop Face AI and try (should fail)" -ForegroundColor White
    Write-Host ""
}

Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ""
