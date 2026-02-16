# IIS Deployment Setup Script for Attendance API
# Run this script as Administrator

param(
    [string]$SiteName = "AttendanceAPI",
    [string]$Port = "80",
    [string]$PhysicalPath = "C:\inetpub\wwwroot\Attendance_App\attendance_api_mobile",
    [string]$HostName = ""
)

Write-Host "=== Attendance API IIS Deployment Setup ===" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Import WebAdministration module
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (-not (Get-Module WebAdministration)) {
    Write-Host "ERROR: WebAdministration module not available!" -ForegroundColor Red
    Write-Host "Please install IIS Management Tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Checking IIS Installation..." -ForegroundColor Yellow

# Check if IIS is installed
$iisFeature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
if ($iisFeature.State -ne "Enabled") {
    Write-Host "Installing IIS..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpErrors -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpLogging -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-RequestFiltering -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-StaticContent -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-DefaultDocument -All -NoRestart
    Write-Host "IIS installed successfully!" -ForegroundColor Green
} else {
    Write-Host "IIS is already installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Checking Application Request Routing..." -ForegroundColor Yellow

# Check if ARR is installed (this is a basic check)
$arrModule = Get-WebGlobalModule | Where-Object { $_.Name -like "*ApplicationRequestRouting*" }
if (-not $arrModule) {
    Write-Host "WARNING: Application Request Routing (ARR) may not be installed!" -ForegroundColor Yellow
    Write-Host "Please download and install ARR from:" -ForegroundColor White
    Write-Host "https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
} else {
    Write-Host "Application Request Routing is installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 3: Checking URL Rewrite Module..." -ForegroundColor Yellow

# Check if URL Rewrite is installed
$rewriteModule = Get-WebGlobalModule | Where-Object { $_.Name -eq "RewriteModule" }
if (-not $rewriteModule) {
    Write-Host "WARNING: URL Rewrite Module may not be installed!" -ForegroundColor Yellow
    Write-Host "Please download and install URL Rewrite from:" -ForegroundColor White
    Write-Host "https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
} else {
    Write-Host "URL Rewrite Module is installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 4: Creating IIS Site..." -ForegroundColor Yellow

# Check if site already exists
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "Site '$SiteName' already exists. Removing..." -ForegroundColor Yellow
    Remove-Website -Name $SiteName
}

# Create the website
try {
    if ($HostName) {
        New-Website -Name $SiteName -Port $Port -PhysicalPath $PhysicalPath -HostHeader $HostName
        Write-Host "Website created with host header: $HostName" -ForegroundColor Green
    } else {
        New-Website -Name $SiteName -Port $Port -PhysicalPath $PhysicalPath
        Write-Host "Website created on port: $Port" -ForegroundColor Green
    }
} catch {
    Write-Host "ERROR: Failed to create website: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 5: Configuring Application Pool..." -ForegroundColor Yellow

# Configure application pool for better Node.js support
$appPoolName = $SiteName + "AppPool"
$appPool = Get-IISAppPool -Name $appPoolName -ErrorAction SilentlyContinue
if ($appPool) {
    Write-Host "Configuring existing application pool: $appPoolName" -ForegroundColor Yellow
} else {
    Write-Host "Application pool not found, using default." -ForegroundColor Yellow
    $appPoolName = "DefaultAppPool"
}

# Set application pool to No Managed Code (for better proxy performance)
try {
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ""
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name processModel.idleTimeout -Value "00:00:00"
    Write-Host "Application pool configured successfully." -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not configure application pool: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 6: Configuring Firewall..." -ForegroundColor Yellow

# Add firewall rule for the port
$ruleName = "Attendance API - Port $Port"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    try {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow
        Write-Host "Firewall rule added for port $Port" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not add firewall rule: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "You may need to manually configure Windows Firewall" -ForegroundColor White
    }
} else {
    Write-Host "Firewall rule already exists for port $Port" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 7: Testing Configuration..." -ForegroundColor Yellow

# Test if the site is accessible
Start-Sleep -Seconds 2
try {
    $testUrl = if ($HostName) { "http://$HostName" } else { "http://localhost:$Port" }
    Write-Host "Testing site accessibility at: $testUrl" -ForegroundColor White
    
    # Note: This will likely fail until Node.js app is running, but we test the IIS part
    $response = Invoke-WebRequest -Uri $testUrl -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "Site is accessible!" -ForegroundColor Green
} catch {
    Write-Host "Site test failed (this is expected if Node.js app is not running)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== IIS Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start your Node.js application:" -ForegroundColor White
Write-Host "   cd '$PhysicalPath'" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the API:" -ForegroundColor White
if ($HostName) {
    Write-Host "   Health Check: http://$HostName/health" -ForegroundColor Gray
    Write-Host "   API Base URL: http://$HostName" -ForegroundColor Gray
} else {
    Write-Host "   Health Check: http://localhost:$Port/health" -ForegroundColor Gray
    Write-Host "   API Base URL: http://localhost:$Port" -ForegroundColor Gray
}
Write-Host ""
Write-Host "3. For network access, use your server's IP address:" -ForegroundColor White
$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress
if ($serverIP) {
    Write-Host "   Network URL: http://$serverIP`:$Port" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Site Details:" -ForegroundColor Cyan
Write-Host "  Name: $SiteName" -ForegroundColor White
Write-Host "  Port: $Port" -ForegroundColor White
Write-Host "  Path: $PhysicalPath" -ForegroundColor White
if ($HostName) {
    Write-Host "  Host: $HostName" -ForegroundColor White
}
Write-Host ""
Write-Host "Management:" -ForegroundColor Cyan
Write-Host "  IIS Manager: inetmgr" -ForegroundColor White
Write-Host "  Start Site: Start-Website -Name '$SiteName'" -ForegroundColor White
Write-Host "  Stop Site:  Stop-Website -Name '$SiteName'" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
