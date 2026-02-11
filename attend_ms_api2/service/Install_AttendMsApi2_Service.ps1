# Install NSSM service for AttendMsApi2 (Node.js) on Port 7012
# Run this script as Administrator

param(
    [string]$ServiceName = "AttendMsApi2",
    [string]$NodePath = "C:\\Program Files\\nodejs\\node.exe",
    [string]$WorkingDir = "C:\\inetpub\\wwwroot\\attend_ms_api2",
    [int]$Port = 7012
)

Write-Host "=== Installing NSSM Service: $ServiceName ===" -ForegroundColor Green

# Admin check
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run PowerShell as Administrator" -ForegroundColor Red
    exit 1
}

# Resolve paths
$AppPath = Join-Path $WorkingDir "src\\app.js"
if (-not (Test-Path $AppPath)) {
    Write-Host "ERROR: App entry not found: $AppPath" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $NodePath)) {
    Write-Host "ERROR: Node not found at: $NodePath" -ForegroundColor Red
    exit 1
}

# Find NSSM
$commonPaths = @(
    "C:\\nssm\\nssm.exe",
    "C:\\nssm\\win64\\nssm.exe",
    "C:\\Program Files\\nssm\\nssm.exe",
    "C:\\Program Files\\nssm\\win64\\nssm.exe",
    "C:\\Windows\\System32\\nssm.exe"
)
$nssm = $commonPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nssm) {
    Write-Host "ERROR: nssm.exe not found in common locations. Please install NSSM and re-run." -ForegroundColor Red
    Write-Host "Download: https://nssm.cc/download" -ForegroundColor Yellow
    exit 1
}

# Ensure logs folder
$logDir = Join-Path $WorkingDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

# If service exists, remove it safely (same name only)
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Service '$ServiceName' exists. Removing before reinstall..." -ForegroundColor Yellow
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    & $nssm remove $ServiceName confirm | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host "Installing NSSM service..." -ForegroundColor Green
& $nssm install $ServiceName $NodePath $AppPath | Out-Null

# Configure service
& $nssm set $ServiceName AppDirectory $WorkingDir | Out-Null
& $nssm set $ServiceName DisplayName "Attendance MS API 2 Service ($Port)" | Out-Null
& $nssm set $ServiceName Description "Node.js Attendance MS API 2 (Port $Port)" | Out-Null
& $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null

# Environment
$domain = "https://cx.brk.sg/attend_ms_api_2"
& $nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production" | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "SERVER_PORT=$Port" | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "DOMAIN=$domain" | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "API_BASE_URL=$domain" | Out-Null

# Logging & rotation
& $nssm set $ServiceName AppStdout (Join-Path $logDir "service-output.log") | Out-Null
& $nssm set $ServiceName AppStderr (Join-Path $logDir "service-error.log") | Out-Null
& $nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $nssm set $ServiceName AppRotateOnline 1 | Out-Null
& $nssm set $ServiceName AppRotateSeconds 86400 | Out-Null
& $nssm set $ServiceName AppRotateBytes 10485760 | Out-Null

# Recovery
& $nssm set $ServiceName AppExit Default Restart | Out-Null
& $nssm set $ServiceName AppRestartDelay 5000 | Out-Null
& $nssm set $ServiceName AppThrottle 1500 | Out-Null

# Start
Write-Host "Starting service..." -ForegroundColor Green
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "Service '$ServiceName' is Running on port $Port" -ForegroundColor Green
    Write-Host "Local:  http://localhost:$Port/health" -ForegroundColor White
    Write-Host "Public: $domain/health" -ForegroundColor White
} else {
    Write-Host "Service failed to start. Check logs in: $logDir" -ForegroundColor Yellow
    exit 2
}
