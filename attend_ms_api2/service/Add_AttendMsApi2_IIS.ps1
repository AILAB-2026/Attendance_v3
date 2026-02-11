# Add IIS Application for attend_ms_api2
# Run as Administrator

param(
    [string]$HostName = "cx.brk.sg",
    [string]$AppAlias = "attend_ms_api_2",
    [string]$PhysicalPath = "C:\\inetpub\\wwwroot\\attend_ms_api2",
    [string]$AppPool = "AttendMsApi2AppPool"
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
    if ($site.State -eq 'Stopped') { continue }
    $bindings = Get-WebBinding -Name $site.Name -ErrorAction SilentlyContinue
    foreach ($b in $bindings) {
        $bindingHost = ($b.bindingInformation -split ':')[-1]
        if ($bindingHost -ieq $HostName) { $targetSite = $site; break }
    }
    if ($targetSite) { break }
}

if (-not $targetSite) {
    Write-Host "WARNING: No site with host '$HostName' found. Falling back to 'Default Web Site' or first available." -ForegroundColor Yellow
    # Try finding any site with binding to * or explicit
    $targetSite = Get-Website | Where-Object { $_.Binding -match $HostName } | Select-Object -First 1
    if (-not $targetSite) {
        $targetSite = Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue
    }
    if (-not $targetSite) {
         # Fallback to first site
         $targetSite = Get-Website | Select-Object -First 1
    }
    
    if (-not $targetSite) {
        Write-Host "ERROR: Could not find any suitable IIS site to attach the application." -ForegroundColor Red
        exit 2
    }
}

Write-Host "Selected Site: $($targetSite.Name)" -ForegroundColor Cyan

# Ensure physical path exists
if (-not (Test-Path $PhysicalPath)) {
    Write-Host "ERROR: PhysicalPath not found: $PhysicalPath" -ForegroundColor Red
    exit 3
}

# Ensure app pool
$appPoolPath = "IIS:\\AppPools\\$AppPool"
if (-not (Test-Path $appPoolPath)) {
    New-WebAppPool -Name $AppPool | Out-Null
    Write-Host "Created App Pool: $AppPool" -ForegroundColor Gray
}
# Optimize for Node/reverse proxy: No Managed Code
Set-ItemProperty -Path $appPoolPath -Name managedRuntimeVersion -Value "" -ErrorAction SilentlyContinue
Set-ItemProperty -Path $appPoolPath -Name managedPipelineMode -Value "Integrated" -ErrorAction SilentlyContinue

# Add or update application
$appPath = "IIS:\\Sites\\$($targetSite.Name)\\$AppAlias"
$existingApp = Get-Item $appPath -ErrorAction SilentlyContinue
if ($existingApp) {
    Write-Host "Application '$AppAlias' already exists. Recreating..." -ForegroundColor Yellow
    Remove-WebApplication -Site $targetSite.Name -Name $AppAlias -ErrorAction SilentlyContinue
}

New-WebApplication -Site $targetSite.Name -Name $AppAlias -PhysicalPath $PhysicalPath -ApplicationPool $AppPool | Out-Null
Write-Host "Application '$AppAlias' created/updated." -ForegroundColor Green

# Output summary
Write-Host "Site: $($targetSite.Name)" -ForegroundColor White
Write-Host "Alias: /$AppAlias" -ForegroundColor White
Write-Host "URL:   https://$HostName/$AppAlias" -ForegroundColor White
Write-Host "Path:  $PhysicalPath" -ForegroundColor White
Write-Host "Pool:  $AppPool" -ForegroundColor White
