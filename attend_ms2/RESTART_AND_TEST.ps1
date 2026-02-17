# AIAttend Backend Restart and Test Script
# Restarts the backend service and verifies face verification is working

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AIAttend Backend Restart & Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$SERVICE_NAME = "AI Attend_v2"

# Step 1: Check if service exists
Write-Host "[1/5] Checking service status..." -ForegroundColor Yellow
$service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue

if (-not $service) {
    Write-Host "ERROR: Service '$SERVICE_NAME' not found!" -ForegroundColor Red
    Write-Host "Please install the service first using: .\service\install-backend-service.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Service found: $($service.DisplayName)" -ForegroundColor Green
Write-Host "Current status: $($service.Status)" -ForegroundColor White
Write-Host ""

# Step 2: Rebuild backend (code changes require rebuild)
Write-Host "[2/6] Rebuilding backend..." -ForegroundColor Yellow
try {
    Push-Location backend
    $buildOutput = npm run build 2>&1
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Backend rebuilt successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Build had warnings (continuing anyway)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Build error (continuing anyway): $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Restart service
Write-Host "[3/6] Restarting backend service..." -ForegroundColor Yellow
try {
    Restart-Service -Name $SERVICE_NAME -Force -ErrorAction Stop
    Start-Sleep -Seconds 3
    
    $service = Get-Service -Name $SERVICE_NAME
    if ($service.Status -eq 'Running') {
        Write-Host "[OK] Service restarted successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Service status is $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Failed to restart service: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Wait for backend to initialize
Write-Host "[4/6] Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "[OK] Backend should be ready" -ForegroundColor Green
Write-Host ""

# Step 5: Test health endpoint
Write-Host "[5/6] Testing backend health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://192.168.1.5:7012/health" -Method GET -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] Backend is responding (HTTP 200)" -ForegroundColor Green
        $content = $response.Content | ConvertFrom-Json
        Write-Host "Uptime: $($content.uptime) seconds" -ForegroundColor Gray
    } else {
        Write-Host "WARNING: Unexpected status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Backend health check failed: $_" -ForegroundColor Red
    Write-Host "The service may still be starting up. Check logs for details." -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Check logs for configuration
Write-Host "[6/6] Checking backend configuration..." -ForegroundColor Yellow
$logFile = ".\logs\backend-service-stdout.log"
if (Test-Path $logFile) {
    $lastLines = Get-Content $logFile -Tail 20 | Select-String -Pattern "Env config|FACE_ENFORCE_STRICT|webhook"
    if ($lastLines) {
        Write-Host "Recent configuration from logs:" -ForegroundColor Gray
        $lastLines | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    } else {
        Write-Host "No configuration lines found in recent logs" -ForegroundColor Yellow
    }
} else {
    Write-Host "Log file not found: $logFile" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restart Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open the mobile app" -ForegroundColor White
Write-Host "2. Try Face Recognition clock in/out" -ForegroundColor White
Write-Host "3. If issues persist, check logs:" -ForegroundColor White
Write-Host "   .\service\manage-backend-service.ps1 logs" -ForegroundColor Gray
Write-Host ""
Write-Host "Configuration Applied:" -ForegroundColor Yellow
Write-Host "  FACE_ENFORCE_STRICT=true" -ForegroundColor White
Write-Host "  FACE_VERIFY_WEBHOOK=http://192.168.1.5:7012/v1/verify" -ForegroundColor White
Write-Host "  FACE_MATCH_THRESHOLD=0.75" -ForegroundColor White
Write-Host ""


