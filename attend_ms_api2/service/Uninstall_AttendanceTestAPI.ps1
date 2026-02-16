# Uninstall NSSM service for AttendanceTestAPI
# Run as Administrator

param(
    [string]$ServiceName = "AttendanceTestAPI"
)

Write-Host "=== Uninstalling NSSM Service: $ServiceName ===" -ForegroundColor Yellow

# Admin check
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run PowerShell as Administrator" -ForegroundColor Red
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
    Write-Host "WARNING: nssm.exe not found. Attempting to remove service via Service Control." -ForegroundColor Yellow
}

# Stop service if it exists
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Seconds 2
}

if ($nssm -and $svc) {
    & $nssm remove $ServiceName confirm | Out-Null
    Write-Host "Service removed via NSSM." -ForegroundColor Green
} elseif ($svc) {
    sc.exe delete $ServiceName | Out-Null
    Write-Host "Service removed via SC." -ForegroundColor Green
} else {
    Write-Host "Service '$ServiceName' not found." -ForegroundColor Yellow
}
