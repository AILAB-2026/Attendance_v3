# Start attendance_api_mobile Backend (Stop AIAttend_v2 if running)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting attendance_api_mobile Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any process on port 3000
Write-Host "Step 1: Checking for processes on port 3000..." -ForegroundColor Yellow
try {
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Host "Found process(es) on port 3000. Stopping..." -ForegroundColor Yellow
        $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped process ID: $_" -ForegroundColor Green
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "  No process found on port 3000" -ForegroundColor Green
    }
} catch {
    Write-Host "  No process found on port 3000" -ForegroundColor Green
}

Write-Host ""

# Step 2: Verify port is free
Write-Host "Step 2: Verifying port 3000 is free..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
$stillRunning = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($stillRunning) {
    Write-Host "  ERROR: Port 3000 still in use!" -ForegroundColor Red
    Write-Host "  Please manually stop the process and try again." -ForegroundColor Red
    exit 1
} else {
    Write-Host "  Port 3000 is free ✅" -ForegroundColor Green
}

Write-Host ""

# Step 3: Start attendance_api_mobile backend
Write-Host "Step 3: Starting attendance_api_mobile backend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected output:" -ForegroundColor Gray
Write-Host "  Server running on port 3000" -ForegroundColor Gray
Write-Host "  Available routes:" -ForegroundColor Gray
Write-Host "    /auth/login" -ForegroundColor Gray
Write-Host "    /sites" -ForegroundColor Gray
Write-Host "    /projects" -ForegroundColor Gray
Write-Host "    /facialAuth/authenticate" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Change to attendance_api_mobile directory and start
Set-Location "d:\MY_SPACE\MOBILE APPS\attendance_api_mobile"
npm start
