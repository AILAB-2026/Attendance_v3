# NSSM Service Installation Script for Attendance API using npm start
# Run this script as Administrator

param(
    [string]$ServiceName = "AttendanceAPI",
    [string]$NpmPath = "C:\Program Files\nodejs\npm.cmd",
    [string]$WorkingDir = "C:\inetpub\wwwroot\attendance_api_mobile",
    [string]$NSSMPath = "C:\nssm\win64\nssm.exe"
)

Write-Host "=== Attendance API NSSM Service Installation (npm start) ===" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if NSSM exists
if (-not (Test-Path $NSSMPath)) {
    Write-Host "NSSM not found at: $NSSMPath" -ForegroundColor Red
    Write-Host "Please download NSSM from: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Extract to C:\nssm\ or update the NSSMPath parameter" -ForegroundColor Yellow
    exit 1
}

# Check if npm exists
if (-not (Test-Path $NpmPath)) {
    Write-Host "npm not found at: $NpmPath" -ForegroundColor Red
    Write-Host "Please install Node.js or update the NpmPath parameter" -ForegroundColor Yellow
    exit 1
}

# Check if working directory exists
if (-not (Test-Path $WorkingDir)) {
    Write-Host "Working directory not found at: $WorkingDir" -ForegroundColor Red
    Write-Host "Please verify the WorkingDir parameter" -ForegroundColor Yellow
    exit 1
}

# Check if package.json exists
$packageJsonPath = Join-Path $WorkingDir "package.json"
if (-not (Test-Path $packageJsonPath)) {
    Write-Host "package.json not found at: $packageJsonPath" -ForegroundColor Red
    Write-Host "Please verify the working directory contains a Node.js project" -ForegroundColor Yellow
    exit 1
}

# Stop existing service if it exists
Write-Host "Checking for existing service..." -ForegroundColor Yellow
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Stopping existing service: $ServiceName" -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force
    & $NSSMPath remove $ServiceName confirm
    Start-Sleep -Seconds 2
}

Write-Host "Installing NSSM service: $ServiceName" -ForegroundColor Green

# Install the service with npm start
& $NSSMPath install $ServiceName $NpmPath start

# Configure service parameters
& $NSSMPath set $ServiceName AppDirectory $WorkingDir
& $NSSMPath set $ServiceName DisplayName "Attendance API Service (npm)"
& $NSSMPath set $ServiceName Description "Node.js Attendance API for AIAttend_v2 Mobile App (using npm start)"
& $NSSMPath set $ServiceName Start SERVICE_AUTO_START

# Set environment variables
& $NSSMPath set $ServiceName AppEnvironmentExtra NODE_ENV=production

# Configure logging
$LogDir = Join-Path $WorkingDir "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force
}

& $NSSMPath set $ServiceName AppStdout (Join-Path $LogDir "service-output.log")
& $NSSMPath set $ServiceName AppStderr (Join-Path $LogDir "service-error.log")
& $NSSMPath set $ServiceName AppRotateFiles 1
& $NSSMPath set $ServiceName AppRotateOnline 1
& $NSSMPath set $ServiceName AppRotateSeconds 86400  # Rotate daily
& $NSSMPath set $ServiceName AppRotateBytes 10485760  # 10MB

# Configure service recovery
& $NSSMPath set $ServiceName AppExit Default Restart
& $NSSMPath set $ServiceName AppRestartDelay 5000  # 5 seconds

# Set service to restart on failure
& $NSSMPath set $ServiceName AppThrottle 1500  # Throttle restarts

Write-Host ""
Write-Host "Service configuration completed!" -ForegroundColor Green
Write-Host ""

# Start the service
Write-Host "Starting service: $ServiceName" -ForegroundColor Green
Start-Service -Name $ServiceName

# Wait a moment and check status
Start-Sleep -Seconds 5
$service = Get-Service -Name $ServiceName
Write-Host "Service Status: $($service.Status)" -ForegroundColor $(if($service.Status -eq 'Running') {'Green'} else {'Red'})

if ($service.Status -eq 'Running') {
    Write-Host ""
    Write-Host "=== SUCCESS! ===" -ForegroundColor Green
    Write-Host "Attendance API service is now running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Service Details:" -ForegroundColor Cyan
    Write-Host "  Name: $ServiceName" -ForegroundColor White
    Write-Host "  Status: Running" -ForegroundColor Green
    Write-Host "  Command: npm start" -ForegroundColor White
    Write-Host "  Working Dir: $WorkingDir" -ForegroundColor White
    Write-Host "  API URL: http://192.168.1.4:7012" -ForegroundColor White
    Write-Host ""
    Write-Host "Management Commands:" -ForegroundColor Cyan
    Write-Host "  Start:   Start-Service -Name $ServiceName" -ForegroundColor White
    Write-Host "  Stop:    Stop-Service -Name $ServiceName" -ForegroundColor White
    Write-Host "  Restart: Restart-Service -Name $ServiceName" -ForegroundColor White
    Write-Host "  Status:  Get-Service -Name $ServiceName" -ForegroundColor White
    Write-Host "  Remove:  & '$NSSMPath' remove $ServiceName confirm" -ForegroundColor White
    Write-Host ""
    Write-Host "Logs Location: $LogDir" -ForegroundColor White
    Write-Host "  Output: service-output.log" -ForegroundColor White
    Write-Host "  Errors: service-error.log" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "=== WARNING ===" -ForegroundColor Yellow
    Write-Host "Service installed but not running properly." -ForegroundColor Yellow
    Write-Host "Check logs at: $LogDir" -ForegroundColor White
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Cyan
    Write-Host "1. Check service logs for errors" -ForegroundColor White
    Write-Host "2. Verify npm and Node.js are installed correctly" -ForegroundColor White
    Write-Host "3. Ensure PostgreSQL database is running" -ForegroundColor White
    Write-Host "4. Check .env file configuration" -ForegroundColor White
    Write-Host "5. Test 'npm start' manually in the working directory" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")



