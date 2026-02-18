# Test Network Access for Attendance API
# This script tests if your API is accessible from the network

Write-Host "=== Testing Attendance API Network Access ===" -ForegroundColor Green
Write-Host ""

# Get server IP
$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -ne "127.0.0.1" -and 
    $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
} | Select-Object -First 1).IPAddress

if (-not $serverIP) {
    Write-Host "ERROR: Could not determine server IP address!" -ForegroundColor Red
    exit 1
}

Write-Host "Server IP: $serverIP" -ForegroundColor Cyan
Write-Host ""

# Test local access first
Write-Host "1. Testing local access..." -ForegroundColor Yellow
try {
    $localResponse = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   âœ… Local access: SUCCESS" -ForegroundColor Green
    Write-Host "   Status: $($localResponse.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "   âŒ Local access: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "   Make sure IIS site is running and Node.js API is started" -ForegroundColor Yellow
}

Write-Host ""

# Test network access
Write-Host "2. Testing network access..." -ForegroundColor Yellow
try {
    $networkResponse = Invoke-WebRequest -Uri "http://$serverIP/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   âœ… Network access: SUCCESS" -ForegroundColor Green
    Write-Host "   Status: $($networkResponse.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "   âŒ Network access: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Test Node.js direct access
Write-Host "3. Testing Node.js direct access..." -ForegroundColor Yellow
try {
    $nodeResponse = Invoke-WebRequest -Uri "http://192.168.1.4:7012/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   âœ… Node.js direct: SUCCESS" -ForegroundColor Green
    Write-Host "   Status: $($nodeResponse.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "   âŒ Node.js direct: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "   Make sure to run: .\start-api.ps1" -ForegroundColor Yellow
}

Write-Host ""

# Check firewall rules
Write-Host "4. Checking firewall rules..." -ForegroundColor Yellow
$firewallRules = Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*Attendance*" -and $_.Enabled -eq "True" }
if ($firewallRules) {
    Write-Host "   âœ… Firewall rules found:" -ForegroundColor Green
    $firewallRules | ForEach-Object { Write-Host "     - $($_.DisplayName)" -ForegroundColor White }
} else {
    Write-Host "   âš ï¸  No firewall rules found" -ForegroundColor Yellow
    Write-Host "   Run: .\setup-network-access.ps1" -ForegroundColor Gray
}

Write-Host ""

# Check IIS site status
Write-Host "5. Checking IIS site status..." -ForegroundColor Yellow
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (Get-Module WebAdministration) {
    $site = Get-Website -Name "AttendanceAPI" -ErrorAction SilentlyContinue
    if ($site) {
        Write-Host "   âœ… IIS Site Status: $($site.State)" -ForegroundColor Green
        Write-Host "   Bindings: $($site.Bindings.Collection.bindingInformation)" -ForegroundColor White
    } else {
        Write-Host "   âŒ IIS site not found" -ForegroundColor Red
        Write-Host "   Run: .\setup-network-access.ps1" -ForegroundColor Gray
    }
} else {
    Write-Host "   âš ï¸  IIS Management not available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "ðŸ“± For Mobile App Configuration:" -ForegroundColor Green
Write-Host "   API_BASE_URL = 'http://$serverIP'" -ForegroundColor White
Write-Host ""
Write-Host "ðŸŒ Test URLs:" -ForegroundColor Green
Write-Host "   Local:   http://localhost/health" -ForegroundColor White
Write-Host "   Network: http://$serverIP/health" -ForegroundColor White
Write-Host "   Direct:  http://192.168.1.4:7012/health" -ForegroundColor White
Write-Host ""

# Show QR code info for easy mobile testing
Write-Host "ðŸ“± Mobile Testing:" -ForegroundColor Cyan
Write-Host "   Open browser on mobile device and go to:" -ForegroundColor White
Write-Host "   http://$serverIP/health" -ForegroundColor Green
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")



