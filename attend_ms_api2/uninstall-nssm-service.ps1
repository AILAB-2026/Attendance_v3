# NSSM Service Uninstallation Script for Attendance API
# Run this script as Administrator

param(
    [string]$ServiceName = "AttendanceAPI",
    [string]$NSSMPath = "C:\nssm\nssm.exe"
)

Write-Host "=== Attendance API NSSM Service Uninstallation ===" -ForegroundColor Red
Write-Host ""

# Check if running as Administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if service exists
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "Service '$ServiceName' not found." -ForegroundColor Yellow
    Write-Host "Nothing to uninstall." -ForegroundColor Green
    exit 0
}

Write-Host "Found service: $ServiceName" -ForegroundColor Yellow
Write-Host "Current Status: $($service.Status)" -ForegroundColor White

# Stop the service if running
if ($service.Status -eq 'Running') {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    try {
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
        Write-Host "Service stopped successfully." -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to stop service: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Attempting force removal..." -ForegroundColor Yellow
    }
}

# Remove the service using NSSM
if (Test-Path $NSSMPath) {
    Write-Host "Removing service using NSSM..." -ForegroundColor Yellow
    try {
        & $NSSMPath remove $ServiceName confirm
        Write-Host "Service removed successfully using NSSM." -ForegroundColor Green
    }
    catch {
        Write-Host "NSSM removal failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "NSSM not found at: $NSSMPath" -ForegroundColor Yellow
    Write-Host "Attempting manual service removal..." -ForegroundColor Yellow
}

# Verify removal
Start-Sleep -Seconds 2
$serviceCheck = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $serviceCheck) {
    Write-Host ""
    Write-Host "=== SUCCESS! ===" -ForegroundColor Green
    Write-Host "Service '$ServiceName' has been completely removed." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=== WARNING ===" -ForegroundColor Yellow
    Write-Host "Service may still exist. Manual cleanup may be required." -ForegroundColor Yellow
    Write-Host "Try running: sc delete $ServiceName" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
