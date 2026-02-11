# Remove IIS Application for AttendanceTestAPI
# Run as Administrator

param(
    [string]$HostName = "cx.brk.sg",
    [string]$AppAlias = "attendance_test_api",
    [switch]$RemoveAppPool = $false,
    [string]$AppPool = "AttendanceTestAPIAppPool"
)

Write-Host "=== Removing IIS Application '$AppAlias' under host '$HostName' ===" -ForegroundColor Yellow

# Admin check
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run PowerShell as Administrator" -ForegroundColor Red
    exit 1
}

Import-Module WebAdministration -ErrorAction SilentlyContinue
if (-not (Get-Module WebAdministration)) {
    Write-Host "ERROR: WebAdministration module not available. Please install IIS Management Scripts and Tools." -ForegroundColor Red
    exit 1
}

# Locate target site by host header
$targetSite = $null
foreach ($site in Get-Website) {
    $bindings = Get-WebBinding -Name $site.Name -ErrorAction SilentlyContinue
    foreach ($b in $bindings) {
        $bindingHost = ($b.bindingInformation -split ':')[-1]
        if ($bindingHost -ieq $HostName) { $targetSite = $site; break }
    }
    if ($targetSite) { break }
}

if (-not $targetSite) {
    Write-Host "WARNING: No site with host '$HostName' found. Falling back to 'Default Web Site'." -ForegroundColor Yellow
    $targetSite = Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue
    if (-not $targetSite) {
        Write-Host "ERROR: Could not find any suitable IIS site." -ForegroundColor Red
        exit 2
    }
}

# Remove application if exists
$appPath = "IIS:\\Sites\\$($targetSite.Name)\\$AppAlias"
$existingApp = Get-Item $appPath -ErrorAction SilentlyContinue
if ($existingApp) {
    Remove-WebApplication -Site $targetSite.Name -Name $AppAlias -ErrorAction SilentlyContinue
    Write-Host "Application '/$AppAlias' removed from site '$($targetSite.Name)'." -ForegroundColor Green
} else {
    Write-Host "Application '/$AppAlias' not found under site '$($targetSite.Name)'." -ForegroundColor Yellow
}

# Optionally remove the dedicated app pool (if unused)
if ($RemoveAppPool -and $AppPool) {
    $poolPath = "IIS:\\AppPools\\$AppPool"
    if (Test-Path $poolPath) {
        # Check usage by other applications
        $inUse = $false
        foreach ($s in Get-Website) {
            $apps = Get-WebApplication -Site $s.Name -ErrorAction SilentlyContinue
            foreach ($a in $apps) {
                if ($a.ApplicationPool -ieq $AppPool) { $inUse = $true; break }
            }
            if ($inUse) { break }
        }
        if (-not $inUse) {
            Remove-WebAppPool -Name $AppPool -ErrorAction SilentlyContinue
            Write-Host "App Pool '$AppPool' removed." -ForegroundColor Green
        } else {
            Write-Host "App Pool '$AppPool' is in use by other applications. Not removed." -ForegroundColor Yellow
        }
    } else {
        Write-Host "App Pool '$AppPool' not found." -ForegroundColor Yellow
    }
}
