# Start Attendance API Script
# This script starts the Node.js API server

param(
    [switch]$Production,
    [switch]$Development,
    [string]$Port = "3001"
)

$ApiPath = "C:\inetpub\wwwroot\Attendance_App\attendance_api_mobile"

Write-Host "=== Starting Attendance API ===" -ForegroundColor Green
Write-Host ""

# Change to API directory
Set-Location $ApiPath

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js Version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating default .env file..." -ForegroundColor Yellow
    
    $envContent = @"
DB_HOST=localhost
DB_USER=postgres
DB_NAME=attendance_db
DB_PASSWORD=pgsql@2025
DB_PORT=5432
SERVER_PORT=$Port
NODE_ENV=development
"@
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host ".env file created. Please update database credentials if needed." -ForegroundColor Green
}

# Set environment
if ($Development) {
    $env:NODE_ENV = "development"
    Write-Host "Environment: Development" -ForegroundColor Cyan
} else {
    $env:NODE_ENV = "production"
    Write-Host "Environment: Production" -ForegroundColor Cyan
}

# Display configuration
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  API Path: $ApiPath" -ForegroundColor White
Write-Host "  Port: $Port" -ForegroundColor White
Write-Host "  Environment: $($env:NODE_ENV)" -ForegroundColor White
Write-Host ""

# Check if port is available
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "WARNING: Port $Port is already in use!" -ForegroundColor Yellow
    Write-Host "Current connections on port $Port`:" -ForegroundColor White
    $portInUse | Format-Table LocalAddress, LocalPort, State, OwningProcess
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host "Starting API server..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server
try {
    if ($Development) {
        npm run dev
    } else {
        npm start
    }
} catch {
    Write-Host ""
    Write-Host "Server stopped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "API server has been stopped." -ForegroundColor Red
