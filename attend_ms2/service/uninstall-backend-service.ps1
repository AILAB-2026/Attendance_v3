# AIAttend Backend Service Uninstallation Script
# This script removes the AIAttend backend Windows service

# Requires Administrator privileges
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Configuration
$SERVICE_NAME = "AI Attend_v2"
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$NSSM_DIR = Join-Path $PSScriptRoot "nssm"
$nssmExe = Join-Path $NSSM_DIR "nssm.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AIAttend Backend Service Uninstallation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if NSSM exists
if (-not (Test-Path $nssmExe)) {
    Write-Host "ERROR: NSSM not found at: $nssmExe" -ForegroundColor Red
    Write-Host "The service may have been installed manually." -ForegroundColor Yellow
    Write-Host "Try using: sc.exe delete '$SERVICE_NAME'" -ForegroundColor Yellow
    exit 1
}

# Check if service exists
Write-Host "[1/3] Checking service..." -ForegroundColor Yellow
$service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue

if (-not $service) {
    Write-Host "  Service '$SERVICE_NAME' not found" -ForegroundColor Yellow
    Write-Host "  Nothing to uninstall." -ForegroundColor Green
    exit 0
}

Write-Host "  ✓ Service found: $SERVICE_NAME" -ForegroundColor Green
Write-Host "  Current status: $($service.Status)" -ForegroundColor White

# Confirm uninstallation
Write-Host ""
$response = Read-Host "Are you sure you want to remove the service? (y/N)"

if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Uninstallation cancelled." -ForegroundColor Yellow
    exit 0
}

# Stop the service
Write-Host ""
Write-Host "[2/3] Stopping service..." -ForegroundColor Yellow

if ($service.Status -eq 'Running') {
    try {
        Stop-Service -Name $SERVICE_NAME -Force
        Start-Sleep -Seconds 2
        Write-Host "  ✓ Service stopped" -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Failed to stop service: $_" -ForegroundColor Yellow
        Write-Host "  Proceeding with removal anyway..." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ Service already stopped" -ForegroundColor Green
}

# Remove the service
Write-Host "[3/3] Removing service..." -ForegroundColor Yellow

try {
    & $nssmExe remove $SERVICE_NAME confirm
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Service removed successfully" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: NSSM returned exit code $LASTEXITCODE" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR: Failed to remove service: $_" -ForegroundColor Red
    exit 1
}

# Verify removal
Start-Sleep -Seconds 1
$verifyService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue

if ($verifyService) {
    Write-Host ""
    Write-Host "WARNING: Service still exists after removal" -ForegroundColor Yellow
    Write-Host "You may need to manually remove it using:" -ForegroundColor Yellow
    Write-Host "  sc.exe delete '$SERVICE_NAME'" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "Uninstallation Complete!" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The service '$SERVICE_NAME' has been removed." -ForegroundColor White
    Write-Host ""
    Write-Host "Note: Log files in the 'logs' directory were not deleted." -ForegroundColor Yellow
    Write-Host ""
}
