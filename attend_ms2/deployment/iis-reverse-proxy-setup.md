# IIS Reverse Proxy Setup Guide

This guide covers setting up IIS (Internet Information Services) as a reverse proxy for the AI Attend Tracker backend API, exposing it securely at https://api.ailabtech.com.

## 📋 Prerequisites

- Windows Server 2022 with IIS installed
- Administrator access
- Backend services running (see [Windows Server Setup](./windows-server-setup.md))
- Domain name: api.ailabtech.com pointing to your server's public IP
- SSL certificate for api.ailabtech.com

## 🔧 Step 1: Install IIS

1. **Install IIS via Server Manager**
   ```powershell
   # Install IIS with PowerShell
   Install-WindowsFeature -Name Web-Server -IncludeManagementTools
   
   # Install additional features
   Install-WindowsFeature -Name Web-WebServer
   Install-WindowsFeature -Name Web-Common-Http
   Install-WindowsFeature -Name Web-Default-Doc
   Install-WindowsFeature -Name Web-Dir-Browsing
   Install-WindowsFeature -Name Web-Http-Errors
   Install-WindowsFeature -Name Web-Static-Content
   Install-WindowsFeature -Name Web-Health
   Install-WindowsFeature -Name Web-Http-Logging
   Install-WindowsFeature -Name Web-Performance
   Install-WindowsFeature -Name Web-Stat-Compression
   Install-WindowsFeature -Name Web-Dyn-Compression
   Install-WindowsFeature -Name Web-Security
   Install-WindowsFeature -Name Web-Filtering
   ```

2. **Verify IIS Installation**
   - Open browser and navigate to `http://localhost`
   - You should see the IIS default page

## 📦 Step 2: Install URL Rewrite Module

1. **Download URL Rewrite Module**
   ```powershell
   # Download URL Rewrite 2.1
   Invoke-WebRequest -Uri "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi" -OutFile "$env:TEMP\urlrewrite.msi"
   ```

2. **Install URL Rewrite**
   ```powershell
   Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\urlrewrite.msi /quiet /norestart"
   ```

3. **Verify Installation**
   - Open IIS Manager
   - Select server node
   - Look for "URL Rewrite" icon in Features View

## 🔄 Step 3: Install Application Request Routing (ARR)

1. **Download ARR**
   ```powershell
   # Download ARR 3.0
   Invoke-WebRequest -Uri "https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi" -OutFile "$env:TEMP\arr.msi"
   ```

2. **Install ARR**
   ```powershell
   Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\arr.msi /quiet /norestart"
   ```

3. **Enable ARR Proxy**
   - Open IIS Manager
   - Click on server node
   - Double-click "Application Request Routing Cache"
   - Click "Server Proxy Settings" in Actions pane
   - Check "Enable proxy"
   - Click "Apply"

## 🌐 Step 4: Create IIS Website

1. **Create Website Directory**
   ```powershell
   New-Item -ItemType Directory -Path "C:\inetpub\api.ailabtech.com" -Force
   ```

2. **Create Default Page (Optional)**
   ```powershell
   @"
   <!DOCTYPE html>
   <html>
   <head>
       <title>AI Attend Tracker API</title>
   </head>
   <body>
       <h1>AI Attend Tracker API</h1>
       <p>API is running. Use the mobile app to connect.</p>
   </body>
   </html>
   "@ | Out-File -FilePath "C:\inetpub\api.ailabtech.com\index.html" -Encoding UTF8
   ```

3. **Create Website in IIS**
   ```powershell
   # Remove default website if needed
   Remove-Website -Name "Default Web Site" -ErrorAction SilentlyContinue
   
   # Create new website
   New-Website -Name "AIAttendAPI" `
               -PhysicalPath "C:\inetpub\api.ailabtech.com" `
               -Port 80 `
               -HostHeader "api.ailabtech.com"
   ```

## 🔐 Step 5: Install SSL Certificate

### Option A: Using Let's Encrypt (Free)

1. **Install Win-ACME**
   ```powershell
   # Download Win-ACME
   Invoke-WebRequest -Uri "https://github.com/win-acme/win-acme/releases/download/v2.2.7.1612/win-acme.v2.2.7.1612.x64.pluggable.zip" -OutFile "$env:TEMP\win-acme.zip"
   
   # Extract
   Expand-Archive -Path "$env:TEMP\win-acme.zip" -DestinationPath "C:\win-acme"
   ```

2. **Run Win-ACME**
   ```powershell
   cd C:\win-acme
   .\wacs.exe
   ```
   
   Follow the prompts:
   - Choose "N" for new certificate
   - Choose "1" for single binding of an IIS site
   - Select "AIAttendAPI" website
   - Choose "2" for automatic installation
   - Accept terms of service

### Option B: Using Purchased Certificate

1. **Import Certificate**
   - Open IIS Manager
   - Click on server node
   - Double-click "Server Certificates"
   - Click "Import" in Actions pane
   - Browse to your .pfx file
   - Enter password
   - Click OK

2. **Bind Certificate to Website**
   ```powershell
   # Add HTTPS binding
   New-WebBinding -Name "AIAttendAPI" `
                  -Protocol https `
                  -Port 443 `
                  -HostHeader "api.ailabtech.com" `
                  -SslFlags 1
   
   # Get certificate thumbprint
   $cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*api.ailabtech.com*"}
   
   # Bind certificate
   $binding = Get-WebBinding -Name "AIAttendAPI" -Protocol https
   $binding.AddSslCertificate($cert.Thumbprint, "My")
   ```

## 🔀 Step 6: Configure URL Rewrite Rules

1. **Create web.config**
   ```powershell
   @"
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
       <system.webServer>
           <rewrite>
               <rules>
                   <!-- Force HTTPS -->
                   <rule name="Force HTTPS" stopProcessing="true">
                       <match url="(.*)" />
                       <conditions>
                           <add input="{HTTPS}" pattern="^OFF$" />
                       </conditions>
                       <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
                   </rule>
                   
                   <!-- Reverse Proxy to Backend -->
                   <rule name="ReverseProxyInboundRule" stopProcessing="true">
                       <match url="(.*)" />
                       <conditions>
                           <add input="{CACHE_URL}" pattern="^(.+)://" />
                       </conditions>
                       <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
                       <serverVariables>
                           <set name="HTTP_X_FORWARDED_PROTO" value="https" />
                           <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
                           <set name="HTTP_X_REAL_IP" value="{REMOTE_ADDR}" />
                       </serverVariables>
                   </rule>
               </rules>
               <outboundRules>
                   <rule name="Add CORS Headers" preCondition="CheckForHtml">
                       <match serverVariable="RESPONSE_Access-Control-Allow-Origin" pattern=".*" />
                       <action type="Rewrite" value="*" />
                   </rule>
                   <rule name="Add CORS Methods" preCondition="CheckForHtml">
                       <match serverVariable="RESPONSE_Access-Control-Allow-Methods" pattern=".*" />
                       <action type="Rewrite" value="GET, POST, PUT, DELETE, OPTIONS" />
                   </rule>
                   <rule name="Add CORS Headers Allow" preCondition="CheckForHtml">
                       <match serverVariable="RESPONSE_Access-Control-Allow-Headers" pattern=".*" />
                       <action type="Rewrite" value="Content-Type, Authorization, X-Requested-With" />
                   </rule>
                   <preConditions>
                       <preCondition name="CheckForHtml">
                           <add input="{RESPONSE_CONTENT_TYPE}" pattern="^application/json" />
                       </preCondition>
                   </preConditions>
               </outboundRules>
           </rewrite>
           <httpProtocol>
               <customHeaders>
                   <add name="X-Content-Type-Options" value="nosniff" />
                   <add name="X-Frame-Options" value="SAMEORIGIN" />
                   <add name="X-XSS-Protection" value="1; mode=block" />
               </customHeaders>
           </httpProtocol>
       </system.webServer>
   </configuration>
   "@ | Out-File -FilePath "C:\inetpub\api.ailabtech.com\web.config" -Encoding UTF8
   ```

2. **Enable Server Variables**
   - Open IIS Manager
   - Click on server node
   - Double-click "URL Rewrite"
   - Click "View Server Variables" in Actions pane
   - Add the following variables:
     - HTTP_X_FORWARDED_PROTO
     - HTTP_X_FORWARDED_HOST
     - HTTP_X_REAL_IP
     - RESPONSE_Access-Control-Allow-Origin
     - RESPONSE_Access-Control-Allow-Methods
     - RESPONSE_Access-Control-Allow-Headers

## 🔥 Step 7: Configure Windows Firewall

```powershell
# Allow HTTP (port 80)
New-NetFirewallRule -DisplayName "HTTP Inbound" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow HTTPS (port 443)
New-NetFirewallRule -DisplayName "HTTPS Inbound" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Block direct access to backend ports from external (optional but recommended)
New-NetFirewallRule -DisplayName "Block Backend Port 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -RemoteAddress Any -Action Block
New-NetFirewallRule -DisplayName "Block Face AI Port 8888" -Direction Inbound -Protocol TCP -LocalPort 8888 -RemoteAddress Any -Action Block

# Allow localhost access to backend
New-NetFirewallRule -DisplayName "Allow Localhost Backend" -Direction Inbound -Protocol TCP -LocalPort 3000 -RemoteAddress 127.0.0.1 -Action Allow
New-NetFirewallRule -DisplayName "Allow Localhost Face AI" -Direction Inbound -Protocol TCP -LocalPort 8888 -RemoteAddress 127.0.0.1 -Action Allow
```

## 🔍 Step 8: Configure IIS Application Pool

```powershell
# Create dedicated application pool
New-WebAppPool -Name "AIAttendAPIPool"

# Configure application pool
Set-ItemProperty IIS:\AppPools\AIAttendAPIPool -Name managedRuntimeVersion -Value ""
Set-ItemProperty IIS:\AppPools\AIAttendAPIPool -Name startMode -Value AlwaysRunning
Set-ItemProperty IIS:\AppPools\AIAttendAPIPool -Name processModel.idleTimeout -Value ([TimeSpan]::FromMinutes(0))

# Assign application pool to website
Set-ItemProperty IIS:\Sites\AIAttendAPI -Name applicationPool -Value "AIAttendAPIPool"
```

## ✅ Step 9: Test Configuration

1. **Test HTTP to HTTPS Redirect**
   ```powershell
   # Should redirect to HTTPS
   Invoke-WebRequest -Uri "http://api.ailabtech.com" -MaximumRedirection 0 -ErrorAction SilentlyContinue
   ```

2. **Test HTTPS Connection**
   ```powershell
   # Should return API response
   Invoke-WebRequest -Uri "https://api.ailabtech.com/health" -UseBasicParsing
   ```

3. **Test from External Network**
   - Use a mobile device or external computer
   - Navigate to https://api.ailabtech.com/health
   - Should return JSON response

4. **Test with Mobile App**
   - Update app environment to use https://api.ailabtech.com
   - Test login and other API calls

## 📊 Step 10: Enable Logging

1. **Configure IIS Logging**
   ```powershell
   # Enable detailed logging
   Set-WebConfigurationProperty -Filter "/system.applicationHost/sites/site[@name='AIAttendAPI']/logFile" -Name "logFormat" -Value "W3C"
   Set-WebConfigurationProperty -Filter "/system.applicationHost/sites/site[@name='AIAttendAPI']/logFile" -Name "directory" -Value "C:\inetpub\logs\AIAttendAPI"
   
   # Enable all fields
   Set-WebConfigurationProperty -Filter "/system.applicationHost/sites/site[@name='AIAttendAPI']/logFile" -Name "logExtFileFlags" -Value "Date,Time,ClientIP,UserName,SiteName,ComputerName,ServerIP,Method,UriStem,UriQuery,HttpStatus,Win32Status,BytesSent,BytesRecv,TimeTaken,ServerPort,UserAgent,Cookie,Referer,ProtocolVersion,Host,HttpSubStatus"
   ```

2. **View Logs**
   ```powershell
   # View IIS logs
   Get-Content "C:\inetpub\logs\LogFiles\W3SVC*\*.log" -Tail 50
   
   # View Failed Request Tracing (if enabled)
   Get-ChildItem "C:\inetpub\logs\FailedReqLogFiles" -Recurse
   ```

## 🔧 Step 11: Performance Tuning

1. **Enable Compression**
   ```powershell
   # Enable static compression
   Set-WebConfigurationProperty -Filter "/system.webServer/httpCompression/scheme[@name='gzip']" -Name "staticCompressionLevel" -Value 9
   
   # Enable dynamic compression
   Set-WebConfigurationProperty -Filter "/system.webServer/httpCompression" -Name "dynamicCompressionLevel" -Value 4
   
   # Enable compression for JSON
   Add-WebConfigurationProperty -Filter "/system.webServer/httpCompression/dynamicTypes" -Name "." -Value @{mimeType='application/json';enabled='true'}
   ```

2. **Configure Caching**
   ```powershell
   # Set cache control headers
   Set-WebConfigurationProperty -Filter "/system.webServer/staticContent/clientCache" -Name "cacheControlMode" -Value "UseMaxAge"
   Set-WebConfigurationProperty -Filter "/system.webServer/staticContent/clientCache" -Name "cacheControlMaxAge" -Value "1.00:00:00"
   ```

3. **Increase Connection Limits**
   ```powershell
   # Increase connection timeout
   Set-WebConfigurationProperty -Filter "/system.applicationHost/sites/site[@name='AIAttendAPI']/limits" -Name "connectionTimeout" -Value "00:05:00"
   
   # Increase max connections
   Set-WebConfigurationProperty -Filter "/system.applicationHost/sites/site[@name='AIAttendAPI']/limits" -Name "maxConnections" -Value 4294967295
   ```

## 🛡️ Step 12: Security Hardening

1. **Remove Unnecessary Headers**
   ```powershell
   # Remove X-Powered-By header
   Set-WebConfigurationProperty -Filter "/system.webServer/httpProtocol/customHeaders" -Name "." -Value @{name='X-Powered-By';value=''}
   
   # Remove Server header (requires URL Rewrite)
   Set-WebConfigurationProperty -Filter "/system.webServer/rewrite/outboundRules" -Name "rewriteBeforeCache" -Value "true"
   ```

2. **Configure SSL/TLS**
   ```powershell
   # Disable weak protocols
   New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 2.0\Server' -Force
   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 2.0\Server' -Name 'Enabled' -Value 0 -PropertyType 'DWord' -Force
   
   New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 3.0\Server' -Force
   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 3.0\Server' -Name 'Enabled' -Value 0 -PropertyType 'DWord' -Force
   
   New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server' -Force
   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server' -Name 'Enabled' -Value 0 -PropertyType 'DWord' -Force
   
   New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server' -Force
   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server' -Name 'Enabled' -Value 0 -PropertyType 'DWord' -Force
   
   # Enable TLS 1.2 and 1.3
   New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Server' -Force
   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Server' -Name 'Enabled' -Value 1 -PropertyType 'DWord' -Force
   
   # Restart required for SSL/TLS changes
   # Restart-Computer -Force
   ```

3. **Enable HSTS (HTTP Strict Transport Security)**
   - Add to web.config:
   ```xml
   <customHeaders>
       <add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
   </customHeaders>
   ```

## 🆘 Troubleshooting

### 502 Bad Gateway Error
```powershell
# Check backend service is running
nssm status AIAttendBackend

# Test backend directly
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing

# Check ARR proxy is enabled
# IIS Manager > Server > Application Request Routing > Server Proxy Settings > Enable proxy

# Check URL Rewrite rules
# IIS Manager > Site > URL Rewrite
```

### 503 Service Unavailable
```powershell
# Check application pool is running
Get-WebAppPoolState -Name "AIAttendAPIPool"

# Start application pool if stopped
Start-WebAppPool -Name "AIAttendAPIPool"

# Check IIS logs
Get-Content "C:\inetpub\logs\LogFiles\W3SVC*\*.log" -Tail 50
```

### SSL Certificate Issues
```powershell
# Check certificate binding
Get-WebBinding -Name "AIAttendAPI" -Protocol https

# Check certificate is valid
Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*api.ailabtech.com*"} | Select-Object Subject, NotAfter, Thumbprint

# Rebind certificate if needed
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*api.ailabtech.com*"}
$binding = Get-WebBinding -Name "AIAttendAPI" -Protocol https
$binding.AddSslCertificate($cert.Thumbprint, "My")
```

### CORS Issues
- Verify CORS headers in web.config
- Check outbound rules are configured
- Test with browser developer tools

### Performance Issues
```powershell
# Check IIS worker process
Get-Process w3wp

# Check memory usage
Get-Process w3wp | Select-Object ProcessName, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet / 1MB, 2)}}

# Restart application pool
Restart-WebAppPool -Name "AIAttendAPIPool"
```

## ✅ Verification Checklist

- [ ] IIS installed and running
- [ ] URL Rewrite module installed
- [ ] ARR installed and proxy enabled
- [ ] Website created and running
- [ ] SSL certificate installed and bound
- [ ] HTTP to HTTPS redirect working
- [ ] Reverse proxy rules configured
- [ ] Backend accessible via https://api.ailabtech.com
- [ ] CORS headers configured
- [ ] Firewall rules configured
- [ ] Logging enabled
- [ ] Security headers configured
- [ ] Performance tuning applied
- [ ] External access tested

## 📝 Next Steps

After completing this setup:
1. Test API from mobile app
2. Monitor logs for errors
3. Set up monitoring and alerts
4. Configure backup for IIS configuration
5. Proceed to mobile app deployment

## 📞 Support

For issues:
1. Check IIS logs in C:\inetpub\logs
2. Check backend service logs
3. Verify DNS resolution for api.ailabtech.com
4. Test SSL certificate validity
5. Review Windows Event Viewer
