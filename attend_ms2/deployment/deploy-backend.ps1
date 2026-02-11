# AI Attend Tracker - Automated Backend Deployment Script
# This script automates the deployment of backend services on Windows Server 2022

param(
    [string]$AppPath = "C:\AIAttend\app",
    [string]$LogPath = "C:\AIAttend\logs",
    [string]$BackupPath = "C:\AIAttend\backups",
    [switch]$SkipBackup,
    [switch]$SkipDependencies,
    [switch]$SkipMigrations,
    [switch]$RestartOnly
)

# Requires Administrator privileges
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Color output helper functions (ASCII-safe). Do not override built-in Write-Error.
if (-not (Get-Command Write-Info -ErrorAction SilentlyContinue)) {
    function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
}
if (-not (Get-Command Write-Success -ErrorAction SilentlyContinue)) {
    function Write-Success { param([string]$Message) Write-Host "[OK]   $Message" -ForegroundColor Green }
}
if (-not (Get-Command Write-Warning -ErrorAction SilentlyContinue)) {
    function Write-Warning { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
}

# Banner
Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║   AI Attend Tracker - Backend Deployment Script          ║
║   Version 1.0.0                                           ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator!"
    exit 1
}

# Function to check if a service exists
function Test-ServiceExists {
    param([string]$ServiceName)
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    return $null -ne $service
}

# Function to check if NSSM is installed
function Test-NSSMInstalled {
    try {
        $null = Get-Command nssm -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Function to stop services
function Stop-AIAttendServices {
    Write-Info "Stopping AI Attend services..."
    
    if (Test-ServiceExists "AIAttendBackend") {
        try {
            nssm stop AIAttendBackend
            Write-Success "Backend service stopped"
        } catch {
            Write-Warning "Failed to stop backend service: $_"
        }
    }
    
    # Wait for services to stop
    Start-Sleep -Seconds 3
}

# Function to start services
function Start-AIAttendServices {
    Write-Info "Starting AI Attend services..."
    
    if (Test-ServiceExists "AIAttendBackend") {
        try {
            nssm start AIAttendBackend
            Write-Success "Backend service started"
        } catch {
            Write-Error "Failed to start backend service: $_"
        }
    } else {
        Write-Warning "Backend service not found. Run full deployment first."
    }
    
    # Wait for services to start
    Start-Sleep -Seconds 5
}

# Function to check service status
function Get-AIAttendServiceStatus {
    Write-Info "Checking service status..."
    
    if (Test-ServiceExists "AIAttendBackend") {
        $status = nssm status AIAttendBackend
        Write-Host "  Backend Service: $status" -ForegroundColor $(if ($status -eq "SERVICE_RUNNING") { "Green" } else { "Red" })
    } else {
        Write-Host "  Backend Service: Not Installed" -ForegroundColor Yellow
    }
    
}

# If RestartOnly flag is set, just restart services and exit
if ($RestartOnly) {
    Write-Info "Restart-only mode enabled"
    Stop-AIAttendServices
    Start-AIAttendServices
    Get-AIAttendServiceStatus
    Write-Success "Services restarted successfully!"
    exit 0
}

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js installed: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed! Please install Node.js first."
    exit 1
}

# Check NSSM
if (-not (Test-NSSMInstalled)) {
    Write-Error "NSSM is not installed! Please install NSSM first."
    Write-Info "Download from: https://nssm.cc/download"
    exit 1
}
Write-Success "NSSM is installed"

# Check if app directory exists
if (-not (Test-Path $AppPath)) {
    Write-Error "Application directory not found: $AppPath"
    Write-Info "Please copy your application files to $AppPath first"
    exit 1
}
Write-Success "Application directory found: $AppPath"

# Create directories if they don't exist
Write-Info "Creating required directories..."
@($LogPath, $BackupPath) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-Success "Created directory: $_"
    }
}

# Backup current version
if (-not $SkipBackup) {
    Write-Info "Creating backup of current version..."
    $backupName = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $backupFullPath = Join-Path $BackupPath $backupName
    
    try {
        Copy-Item -Path $AppPath -Destination $backupFullPath -Recurse -Force
        Write-Success "Backup created: $backupFullPath"
    } catch {
        Write-Warning "Backup failed: $_"
        $continue = Read-Host "Continue without backup? (y/n)"
        if ($continue -ne 'y') {
            exit 1
        }
    }
} else {
    Write-Warning "Skipping backup (SkipBackup flag set)"
}

# Stop services before deployment
Stop-AIAttendServices

# Install/Update dependencies
if (-not $SkipDependencies) {
    Write-Info "Installing/updating dependencies..."
    Push-Location $AppPath
    try {
        npm install --production
        Write-Success "Dependencies installed successfully"
    } catch {
        Write-Error "Failed to install dependencies: $_"
        Pop-Location
        exit 1
    }
    Pop-Location
} else {
    Write-Warning "Skipping dependency installation (SkipDependencies flag set)"
}

# Run database migrations
if (-not $SkipMigrations) {
    Write-Info "Running database migrations..."
    Push-Location $AppPath
    try {
        # Check if migration script exists
        if (Test-Path "backend\db\migrate.js") {
            node backend\db\migrate.js
            Write-Success "Database migrations completed"
        } else {
            Write-Warning "Migration script not found, skipping migrations"
        }
    } catch {
        Write-Warning "Migration failed: $_"
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne 'y') {
            Pop-Location
            exit 1
        }
    }
    Pop-Location
} else {
    Write-Warning "Skipping database migrations (SkipMigrations flag set)"
}

# Install/Update Backend Service
Write-Info "Configuring Backend service..."

if (Test-ServiceExists "AIAttendBackend") {
    Write-Info "Backend service exists, updating configuration..."
    try {
        nssm set AIAttendBackend AppDirectory $AppPath
        nssm set AIAttendBackend AppStdout "$LogPath\backend.log"
        nssm set AIAttendBackend AppStderr "$LogPath\backend-error.log"
        Write-Success "Backend service configuration updated"
    } catch {
        Write-Error "Failed to update backend service: $_"
    }
} else {
    Write-Info "Installing Backend service..."
    try {
        $nodePath = (Get-Command node).Source
        nssm install AIAttendBackend $nodePath "$AppPath\backend\server.js"
        nssm set AIAttendBackend AppDirectory $AppPath
        nssm set AIAttendBackend AppEnvironmentExtra "NODE_ENV=production"
        nssm set AIAttendBackend AppStdout "$LogPath\backend.log"
        nssm set AIAttendBackend AppStderr "$LogPath\backend-error.log"
        nssm set AIAttendBackend Description "AI Attend Tracker Backend API Service"
        nssm set AIAttendBackend DisplayName "AI Attend Backend"
        nssm set AIAttendBackend Start SERVICE_AUTO_START
        nssm set AIAttendBackend AppThrottle 1500
        nssm set AIAttendBackend AppExit Default Restart
        nssm set AIAttendBackend AppRestartDelay 5000
        Write-Success "Backend service installed"
    } catch {
        Write-Error "Failed to install backend service: $_"
        exit 1
    }
}


# Start services
Start-AIAttendServices

# Wait for services to initialize
Write-Info "Waiting for services to initialize..."
Start-Sleep -Seconds 10

# Verify services are running
Write-Info "Verifying services..."

# Test Backend API
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Success "Backend API is responding"
    } else {
        Write-Warning "Backend API returned status code: $($response.StatusCode)"
    }
} catch {
    Write-Error "Backend API is not responding: $_"
    Write-Info "Check logs at: $LogPath\backend-error.log"
}


# Display service status
Get-AIAttendServiceStatus

# Display log locations
Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║   Deployment Complete!                                    ║
╚═══════════════════════════════════════════════════════════╝

Log Files:
  Backend:  $LogPath\backend.log
  Errors:   $LogPath\*-error.log

Service Management:
  Status:   nssm status AIAttendBackend
  Start:    nssm start AIAttendBackend
  Stop:     nssm stop AIAttendBackend
  Restart:  nssm restart AIAttendBackend

View Logs:
  Get-Content $LogPath\backend.log -Tail 50 -Wait

Quick Restart:
  .\deploy-backend.ps1 -RestartOnly

"@ -ForegroundColor Green

Write-Success "Deployment completed successfully!"
