# Network Access Setup for Attendance API
# This script configures your API for network access without requiring a domain
# Run this script as Administrator

param(
    [string]$Port = "80",
    [string]$SiteName = "AttendanceAPI"
)

Write-Host "=== Attendance API Network Access Setup ===" -ForegroundColor Green
Write-Host "Setting up API for network access without domain requirements" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Get server IP address
Write-Host "Step 1: Detecting server IP address..." -ForegroundColor Yellow
$serverIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -ne "127.0.0.1" -and 
    $_.IPAddress -ne "169.254.*" -and 
    $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
} | Select-Object IPAddress, InterfaceAlias

if ($serverIPs.Count -eq 0) {
    Write-Host "ERROR: No suitable network IP address found!" -ForegroundColor Red
    exit 1
}

Write-Host "Available IP addresses:" -ForegroundColor Green
$serverIPs | ForEach-Object { Write-Host "  $($_.IPAddress) ($($_.InterfaceAlias))" -ForegroundColor White }

$primaryIP = $serverIPs[0].IPAddress
Write-Host "Using primary IP: $primaryIP" -ForegroundColor Green
Write-Host ""

# Import WebAdministration module
Write-Host "Step 2: Configuring IIS..." -ForegroundColor Yellow
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (-not (Get-Module WebAdministration)) {
    Write-Host "Installing IIS Management Tools..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-ManagementConsole -All -NoRestart
    Import-Module WebAdministration
}

# Remove existing site if it exists
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "Removing existing site: $SiteName" -ForegroundColor Yellow
    Remove-Website -Name $SiteName
}

# Create new website with network binding
$physicalPath = "C:\inetpub\wwwroot\Attendance_App\attendance_api_mobile"
Write-Host "Creating website with network access..." -ForegroundColor Yellow

try {
    # Create site bound to all IP addresses
    New-Website -Name $SiteName -Port $Port -PhysicalPath $physicalPath -IPAddress "*"
    Write-Host "Website created successfully!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create website: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Configure application pool
Write-Host "Configuring application pool..." -ForegroundColor Yellow
$appPoolName = $SiteName + "AppPool"
try {
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ""
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name processModel.idleTimeout -Value "00:00:00"
    Write-Host "Application pool configured!" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not configure application pool" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 3: Configuring Windows Firewall..." -ForegroundColor Yellow

# Configure firewall for network access
$ruleName = "Attendance API Network Access - Port $Port"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existingRule) {
    Remove-NetFirewallRule -DisplayName $ruleName
}

try {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain,Private,Public
    Write-Host "Firewall rule created for network access!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create firewall rule: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to manually configure Windows Firewall" -ForegroundColor Yellow
}

# Also ensure Node.js port is accessible
$nodeRuleName = "Attendance API Node.js - Port 3001"
$existingNodeRule = Get-NetFirewallRule -DisplayName $nodeRuleName -ErrorAction SilentlyContinue
if (-not $existingNodeRule) {
    try {
        New-NetFirewallRule -DisplayName $nodeRuleName -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Domain,Private,Public
        Write-Host "Firewall rule created for Node.js port 3001!" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not create Node.js firewall rule" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Step 4: Testing network connectivity..." -ForegroundColor Yellow

# Test if ports are available
$portTest = Test-NetConnection -ComputerName $primaryIP -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portTest) {
    Write-Host "Port $Port is accessible on network!" -ForegroundColor Green
} else {
    Write-Host "Port $Port test inconclusive (this is normal if IIS isn't fully started)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Network Access Setup Complete! ===" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Your API Network Access Information:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server IP Address: $primaryIP" -ForegroundColor White
Write-Host "API Port: $Port" -ForegroundColor White
Write-Host ""

Write-Host "📱 Access URLs for Mobile/Other Devices:" -ForegroundColor Cyan
Write-Host "  Health Check: http://$primaryIP`:$Port/health" -ForegroundColor Green
Write-Host "  API Base URL: http://$primaryIP`:$Port" -ForegroundColor Green
Write-Host ""

Write-Host "🔧 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start your Node.js API:" -ForegroundColor White
Write-Host "   .\start-api.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test from this computer:" -ForegroundColor White
Write-Host "   http://localhost:$Port/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test from mobile/other devices:" -ForegroundColor White
Write-Host "   http://$primaryIP`:$Port/health" -ForegroundColor Gray
Write-Host ""

Write-Host "📋 Mobile App Configuration:" -ForegroundColor Cyan
Write-Host "Update your mobile app to use:" -ForegroundColor White
Write-Host "  API_BASE_URL = 'http://$primaryIP`:$Port'" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Troubleshooting:" -ForegroundColor Cyan
Write-Host "If devices can't connect:" -ForegroundColor White
Write-Host "• Check Windows Firewall settings" -ForegroundColor Gray
Write-Host "• Ensure devices are on same network" -ForegroundColor Gray
Write-Host "• Try disabling Windows Firewall temporarily for testing" -ForegroundColor Gray
Write-Host "• Check router/network firewall settings" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 Alternative IP Addresses:" -ForegroundColor Cyan
if ($serverIPs.Count -gt 1) {
    $serverIPs | ForEach-Object { 
        Write-Host "  http://$($_.IPAddress):$Port ($($_.InterfaceAlias))" -ForegroundColor Gray
    }
} else {
    Write-Host "  Only one IP address available: $primaryIP" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
