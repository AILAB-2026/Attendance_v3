# Add IIS Application for AttendanceTestAPI without affecting existing apps/services
# Run as Administrator

param(
    [string]$HostName = "cx.brk.sg",
    [string]$AppAlias = "attendance_test_api",
    [string]$PhysicalPath = "C:\\inetpub\\wwwroot\\attendance_test_api",
    [string]$AppPool = "AttendanceTestAPIAppPool"
)

Write-Host "=== Adding IIS Application '$AppAlias' under host '$HostName' ===" -ForegroundColor Green

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
        Write-Host "ERROR: Could not find any suitable IIS site to attach the application." -ForegroundColor Red
        exit 2
    }
}

# Ensure physical path exists
if (-not (Test-Path $PhysicalPath)) {
    Write-Host "ERROR: PhysicalPath not found: $PhysicalPath" -ForegroundColor Red
    exit 3
}

# Ensure app pool
$appPoolPath = "IIS:\\AppPools\\$AppPool"
if (-not (Test-Path $appPoolPath)) {
    New-WebAppPool -Name $AppPool | Out-Null
}
# Optimize for Node/reverse proxy: No Managed Code
Set-ItemProperty -Path $appPoolPath -Name managedRuntimeVersion -Value "" -ErrorAction SilentlyContinue
Set-ItemProperty -Path $appPoolPath -Name managedPipelineMode -Value "Integrated" -ErrorAction SilentlyContinue

# Add or update application
$appPath = "IIS:\\Sites\\$($targetSite.Name)\\$AppAlias"
$existingApp = Get-Item $appPath -ErrorAction SilentlyContinue
if ($existingApp) {
    Write-Host "Application '$AppAlias' already exists under site '$($targetSite.Name)'. Recreating to apply settings..." -ForegroundColor Yellow
    try {
        Remove-WebApplication -Site $targetSite.Name -Name $AppAlias -ErrorAction SilentlyContinue
    } catch {}
    New-WebApplication -Site $targetSite.Name -Name $AppAlias -PhysicalPath $PhysicalPath -ApplicationPool $AppPool | Out-Null
    Write-Host "Application '$AppAlias' recreated." -ForegroundColor Green
} else {
    New-WebApplication -Site $targetSite.Name -Name $AppAlias -PhysicalPath $PhysicalPath -ApplicationPool $AppPool | Out-Null
    Write-Host "Application '$AppAlias' created under site '$($targetSite.Name)'." -ForegroundColor Green
}

# Output summary
Write-Host "Site: $($targetSite.Name)" -ForegroundColor White
Write-Host "Alias: /$AppAlias" -ForegroundColor White
Write-Host "Path:  $PhysicalPath" -ForegroundColor White
Write-Host "Pool:  $AppPool" -ForegroundColor White
