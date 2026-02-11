# Professional Attendance System Deployment Script
# Run as Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$DomainName,
    [string]$SiteName = "AttendanceSystem",
    [string]$SSLCertThumbprint = "",
    [switch]$EnableHTTPS,
    [switch]$CreateWebUI
)

Write-Host "=== Professional Attendance System Deployment ===" -ForegroundColor Green
Write-Host "Domain: $DomainName" -ForegroundColor Cyan
Write-Host ""

# Check Administrator privileges
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run as Administrator!" -ForegroundColor Red
    exit 1
}

# Phase 1: IIS Configuration
Write-Host "Phase 1: Configuring IIS..." -ForegroundColor Yellow
Import-Module WebAdministration -ErrorAction SilentlyContinue

# Remove existing site
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Remove-Website -Name $SiteName
    Write-Host "Removed existing site" -ForegroundColor Yellow
}

# Create main website
$physicalPath = "C:\inetpub\wwwroot\Attendance_App"
New-Website -Name $SiteName -Port 80 -PhysicalPath $physicalPath -HostHeader $DomainName
Write-Host "Created website: $SiteName" -ForegroundColor Green

# Phase 2: SSL Configuration
if ($EnableHTTPS -and $SSLCertThumbprint) {
    Write-Host "Phase 2: Configuring SSL..." -ForegroundColor Yellow
    New-WebBinding -Name $SiteName -Protocol https -Port 443 -HostHeader $DomainName -SslFlags 1
    $binding = Get-WebBinding -Name $SiteName -Protocol https
    $binding.AddSslCertificate($SSLCertThumbprint, "my")
    Write-Host "SSL configured successfully" -ForegroundColor Green
}

# Phase 3: API Configuration
Write-Host "Phase 3: Configuring API..." -ForegroundColor Yellow
$apiPath = Join-Path $physicalPath "api"
if (-not (Test-Path $apiPath)) {
    New-Item -ItemType Directory -Path $apiPath -Force
}

# Create API web.config
$apiWebConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="AttendanceAPI" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3001/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="Access-Control-Allow-Origin" value="*" />
        <add name="Access-Control-Allow-Methods" value="GET,POST,PUT,DELETE,OPTIONS" />
        <add name="Access-Control-Allow-Headers" value="Content-Type,Authorization" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
"@

$apiWebConfig | Out-File -FilePath (Join-Path $apiPath "web.config") -Encoding UTF8

# Phase 4: Firewall Configuration
Write-Host "Phase 4: Configuring Firewall..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Attendance HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Attendance HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Attendance API" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -RemoteAddress LocalSubnet -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  Website: http://$DomainName" -ForegroundColor White
if ($EnableHTTPS) {
    Write-Host "  Secure:  https://$DomainName" -ForegroundColor White
}
Write-Host "  API:     http://$DomainName/api/health" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start Node.js API: .\start-api.ps1" -ForegroundColor White
Write-Host "2. Configure DNS A record: $DomainName -> YOUR_PUBLIC_IP" -ForegroundColor White
Write-Host "3. Test access from external network" -ForegroundColor White
