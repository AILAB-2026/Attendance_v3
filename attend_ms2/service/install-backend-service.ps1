# AIAttend Backend Service Installation Script
# This script installs the AIAttend backend as a Windows service using NSSM

# Requires Administrator privileges
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Configuration
$SERVICE_NAME = "AI Attend_v2"
$SERVICE_DISPLAY_NAME = "AI Attend_v2"
$SERVICE_DESCRIPTION = "AIAttend attendance management system backend API server"
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$NODE_EXECUTABLE = (Get-Command node).Source
$SERVER_SCRIPT = Join-Path $PROJECT_ROOT "backend\server.js"
$NSSM_URL = "https://nssm.cc/release/nssm-2.24.zip"
$NSSM_DIR = Join-Path $PSScriptRoot "nssm"
$LOG_DIR = Join-Path $PROJECT_ROOT "logs"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "AIAttend Backend Service Installation" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Validate Node.js installation
Write-Host "[1/7] Checking Node.js installation..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "  [OK] Node.js found: $nodeVersion" -ForegroundColor Green

# Validate project files
Write-Host "[2/7] Validating project files..." -ForegroundColor Yellow
if (-not (Test-Path $SERVER_SCRIPT)) {
    Write-Host "ERROR: Server script not found at: $SERVER_SCRIPT" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Server script found" -ForegroundColor Green

# Create logs directory
Write-Host "[3/7] Creating logs directory..." -ForegroundColor Yellow
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}
Write-Host "  [OK] Logs directory ready: $LOG_DIR" -ForegroundColor Green

# Download and extract NSSM if not present
Write-Host "[4/7] Checking NSSM installation..." -ForegroundColor Yellow
$nssmExe = Join-Path $NSSM_DIR "nssm.exe"

if (-not (Test-Path $nssmExe)) {
    Write-Host "  Downloading NSSM..." -ForegroundColor Yellow
    $tempZip = Join-Path $env:TEMP "nssm.zip"
    
    try {
        Invoke-WebRequest -Uri $NSSM_URL -OutFile $tempZip -UseBasicParsing
        
        # Extract NSSM
        Write-Host "  Extracting NSSM..." -ForegroundColor Yellow
        Expand-Archive -Path $tempZip -DestinationPath $env:TEMP -Force
        
        # Copy the appropriate architecture version
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        $nssmSource = Join-Path $env:TEMP "nssm-2.24\$arch\nssm.exe"
        
        if (-not (Test-Path $NSSM_DIR)) {
            New-Item -ItemType Directory -Path $NSSM_DIR -Force | Out-Null
        }
        
        Copy-Item -Path $nssmSource -Destination $nssmExe -Force
        Remove-Item $tempZip -Force
        Remove-Item (Join-Path $env:TEMP "nssm-2.24") -Recurse -Force
        
        Write-Host "  [OK] NSSM downloaded and installed" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Failed to download NSSM: $_" -ForegroundColor Red
        Write-Host "Please download NSSM manually from https://nssm.cc/download" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  [OK] NSSM already installed" -ForegroundColor Green
}

# Check if service already exists
Write-Host "[5/7] Checking existing service..." -ForegroundColor Yellow
$existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "  Service '$SERVICE_NAME' already exists" -ForegroundColor Yellow
    $response = Read-Host "  Do you want to remove and reinstall it? (y/N)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "  Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        Write-Host "  Removing service..." -ForegroundColor Yellow
        & $nssmExe remove $SERVICE_NAME confirm
        Start-Sleep -Seconds 2
        Write-Host "  [OK] Existing service removed" -ForegroundColor Green
    } else {
        Write-Host "Installation cancelled." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "  [OK] No existing service found" -ForegroundColor Green
}

# Install the service
Write-Host "[6/7] Installing service..." -ForegroundColor Yellow

# Install service with NSSM
& $nssmExe install $SERVICE_NAME $NODE_EXECUTABLE $SERVER_SCRIPT

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install service" -ForegroundColor Red
    exit 1
}

# Configure service parameters
Write-Host "  Configuring service parameters..." -ForegroundColor Yellow

# Set display name and description
& $nssmExe set $SERVICE_NAME DisplayName $SERVICE_DISPLAY_NAME
& $nssmExe set $SERVICE_NAME Description $SERVICE_DESCRIPTION

# Set working directory
& $nssmExe set $SERVICE_NAME AppDirectory $PROJECT_ROOT

# Set environment (use .env.production if exists, otherwise .env)
$envFile = Join-Path $PROJECT_ROOT ".env.production"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $PROJECT_ROOT ".env"
}

# Configure logging
$stdoutLog = Join-Path $LOG_DIR "backend-service-stdout.log"
$stderrLog = Join-Path $LOG_DIR "backend-service-stderr.log"

& $nssmExe set $SERVICE_NAME AppStdout $stdoutLog
& $nssmExe set $SERVICE_NAME AppStderr $stderrLog

# Set log rotation (10MB file size, rotate on restart)
& $nssmExe set $SERVICE_NAME AppStdoutCreationDisposition 4
& $nssmExe set $SERVICE_NAME AppStderrCreationDisposition 4
& $nssmExe set $SERVICE_NAME AppRotateFiles 1
& $nssmExe set $SERVICE_NAME AppRotateOnline 1
& $nssmExe set $SERVICE_NAME AppRotateBytes 10485760

# Set startup type to automatic
& $nssmExe set $SERVICE_NAME Start SERVICE_AUTO_START

# Set restart behavior (restart on failure)
& $nssmExe set $SERVICE_NAME AppExit Default Restart
& $nssmExe set $SERVICE_NAME AppRestartDelay 5000

# Set process priority to normal
& $nssmExe set $SERVICE_NAME AppPriority NORMAL_PRIORITY_CLASS

Write-Host "  [OK] Service configured" -ForegroundColor Green

# Start the service
Write-Host "[7/7] Starting service..." -ForegroundColor Yellow
Start-Service -Name $SERVICE_NAME

# Wait a moment and check status
Start-Sleep -Seconds 3
$service = Get-Service -Name $SERVICE_NAME

if ($service.Status -eq 'Running') {
    Write-Host "  [OK] Service started successfully" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Service status is $($service.Status)" -ForegroundColor Yellow
    Write-Host "  Check logs at: $LOG_DIR" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name: $SERVICE_NAME" -ForegroundColor White
Write-Host "Display Name: $SERVICE_DISPLAY_NAME" -ForegroundColor White
Write-Host "Status: $($service.Status)" -ForegroundColor White
Write-Host "Logs: $LOG_DIR" -ForegroundColor White
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Yellow
Write-Host "  Start:   Start-Service '$SERVICE_NAME'" -ForegroundColor White
Write-Host "  Stop:    Stop-Service '$SERVICE_NAME'" -ForegroundColor White
Write-Host "  Restart: Restart-Service '$SERVICE_NAME'" -ForegroundColor White
Write-Host "  Status:  Get-Service '$SERVICE_NAME'" -ForegroundColor White
Write-Host "  Remove:  .\uninstall-backend-service.ps1" -ForegroundColor White
Write-Host ""

