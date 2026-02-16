# Restart attendance_api_mobile Backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restarting Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping backend on port 3001..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { 
    $conn = Get-NetTCPConnection -OwningProcess $_.Id -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($conn) { $true } else { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2
Write-Host "Backend stopped" -ForegroundColor Green
Write-Host ""

Write-Host "Starting backend with updated response format..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npm start
