# Windows Server 2022 Setup Guide

This guide covers the complete setup of the AI Attend Tracker backend on Windows Server 2022, including Node.js services configuration using NSSM (Non-Sucking Service Manager).

## 📋 Prerequisites

- Windows Server 2022 with Administrator access
- Internet connection for downloading dependencies
- Remote Desktop access or physical access to server

## 🔧 Step 1: Install Node.js

1. **Download Node.js LTS**
   ```powershell
   # Download Node.js 20.x LTS (or latest LTS version)
   # Visit: https://nodejs.org/en/download/
   # Or use PowerShell:
   Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile "$env:TEMP\nodejs.msi"
   ```

2. **Install Node.js**
   ```powershell
   Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\nodejs.msi /quiet /norestart"
   ```

3. **Verify Installation**
   ```powershell
   node --version
   npm --version
   ```

## 🗄️ Step 2: Install PostgreSQL

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15 or later

2. **Install PostgreSQL**
   - Run the installer
   - Set a strong password for the `postgres` user
   - Note the port (default: 5432)
   - Install pgAdmin 4 (optional but recommended)

3. **Create Database**
   ```sql
   -- Connect to PostgreSQL as postgres user
   CREATE DATABASE attendance_db;
   CREATE USER attendance_user WITH ENCRYPTED PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE attendance_db TO attendance_user;
   ```

4. **Configure PostgreSQL for Network Access** (if needed)
   - Edit `postgresql.conf`:
     ```
     listen_addresses = '*'  # or specific IP
     ```
   - Edit `pg_hba.conf`:
     ```
     host    attendance_db    attendance_user    0.0.0.0/0    md5
     ```
   - Restart PostgreSQL service

## 📁 Step 3: Deploy Application Files

1. **Create Application Directory**
   ```powershell
   New-Item -ItemType Directory -Path "C:\AIAttend" -Force
   New-Item -ItemType Directory -Path "C:\AIAttend\logs" -Force
   ```

2. **Copy Application Files**
   - Copy your entire project to `C:\AIAttend\app`
   - Ensure all files are present:
     - `package.json`
     - `backend/` directory
     - `.env.production` (create from template)

3. **Install Dependencies**
   ```powershell
   cd C:\AIAttend\app
   npm install --production
   ```

## 🔐 Step 4: Configure Environment Variables

1. **Create Production Environment File**
   ```powershell
   # Copy template and edit
   Copy-Item .env.production.template .env.production
   notepad .env.production
   ```

2. **Edit `.env.production`**
   ```env
   # Production API base URL
   API_BASE_URL=https://api.ailabtech.com
   EXPO_PUBLIC_API_BASE_URL=https://api.ailabtech.com

   # PostgreSQL connection
   DATABASE_URL=postgresql://attendance_user:your_secure_password@localhost:5432/attendance_db

   # JWT secret (generate a strong random string)
   JWT_SECRET=your_very_long_random_secret_key_here

   # Disable dev login in production
   ALLOW_DEV_LOGIN=false

   # Backend port (internal, proxied by IIS)
   PORT=3000
   HOST=127.0.0.1

   # Login allowed roles
   LOGIN_ALLOWED_ROLES=employee,manager,admin

   # Authentication
   PREFERRED_AUTH=db
   BACKEND_VERBOSE_LOGIN=false

   # Face recognition settings (no external AI service)
   FACE_ENFORCE_STRICT=false
   # FACE_VERIFY_WEBHOOK=http://localhost:8888/verify
   # FACE_AI_PORT=8888

   # Assignment check
   SKIP_ASSIGNMENT_CHECK=false

   # Leave settings
   LEAVE_QUOTA_ENFORCE=true
   LEAVE_QUOTA_REQUIRE_ENTITLEMENT=false

   # Disable demo mode
   EXPO_PUBLIC_DEMO_MODE=false
   EXPO_PUBLIC_SHOW_OFFLINE_BANNER=false
   ```

3. **Secure the Environment File**
   ```powershell
   # Set file permissions (only administrators can read)
   $acl = Get-Acl "C:\AIAttend\app\.env.production"
   $acl.SetAccessRuleProtection($true, $false)
   $adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators","FullControl","Allow")
   $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM","FullControl","Allow")
   $acl.SetAccessRule($adminRule)
   $acl.SetAccessRule($systemRule)
   Set-Acl "C:\AIAttend\app\.env.production" $acl
   ```

## 🛠️ Step 5: Install NSSM (Non-Sucking Service Manager)

1. **Download NSSM**
   ```powershell
   # Download NSSM
   Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$env:TEMP\nssm.zip"
   
   # Extract
   Expand-Archive -Path "$env:TEMP\nssm.zip" -DestinationPath "$env:TEMP\nssm"
   
   # Copy to system directory
   Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" "C:\Windows\System32\nssm.exe"
   ```

2. **Verify NSSM Installation**
   ```powershell
   nssm --version
   ```

## 🚀 Step 6: Create Backend Service

1. **Install Backend Service**
   ```powershell
   # Install service
   nssm install AIAttendBackend "C:\Program Files\nodejs\node.exe" "C:\AIAttend\app\backend\server.js"
   
   # Set working directory
   nssm set AIAttendBackend AppDirectory "C:\AIAttend\app"
   
   # Set environment file
   nssm set AIAttendBackend AppEnvironmentExtra "NODE_ENV=production"
   
   # Set stdout log
   nssm set AIAttendBackend AppStdout "C:\AIAttend\logs\backend.log"
   
   # Set stderr log
   nssm set AIAttendBackend AppStderr "C:\AIAttend\logs\backend-error.log"
   
   # Set service description
   nssm set AIAttendBackend Description "AI Attend Tracker Backend API Service"
   
   # Set service display name
   nssm set AIAttendBackend DisplayName "AI Attend Backend"
   
   # Set service to start automatically
   nssm set AIAttendBackend Start SERVICE_AUTO_START
   
   # Set restart policy
   nssm set AIAttendBackend AppThrottle 1500
   nssm set AIAttendBackend AppExit Default Restart
   nssm set AIAttendBackend AppRestartDelay 5000
   ```

2. **Start Backend Service**
   ```powershell
   nssm start AIAttendBackend
   ```

3. **Verify Backend Service**
   ```powershell
   # Check service status
   nssm status AIAttendBackend
   
   # View logs
   Get-Content C:\AIAttend\logs\backend.log -Tail 20
   
   # Test API endpoint
   Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
   ```

## 🔍 Step 7: Service Management

### Check Service Status
```powershell
# Check service status
Get-Service | Where-Object {$_.Name -like "*AIAttend*"}

# Or use NSSM
nssm status AIAttendBackend
```

### Start Services
```powershell
nssm start AIAttendBackend

# Or use Windows services
Start-Service AIAttendBackend
```

### Stop Services
```powershell
nssm stop AIAttendBackend

# Or use Windows services
Stop-Service AIAttendBackend
```

### Restart Services
```powershell
nssm restart AIAttendBackend

# Or use Windows services
Restart-Service AIAttendBackend
```

### View Service Logs
```powershell
# Backend logs
Get-Content C:\AIAttend\logs\backend.log -Tail 50 -Wait

# Error logs
Get-Content C:\AIAttend\logs\backend-error.log -Tail 50
```

### Remove Services (if needed)
```powershell
# Stop and remove service
nssm stop AIAttendBackend
nssm remove AIAttendBackend confirm
```

## 🔥 Step 9: Configure Windows Firewall

```powershell
# Allow Node.js through firewall (if needed for external access)
New-NetFirewallRule -DisplayName "AI Attend Backend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow

# Note: These ports should only be accessible from localhost in production
# IIS will handle external access via reverse proxy
```

## 📊 Step 10: Database Migration

```powershell
# Run database migrations
cd C:\AIAttend\app
node backend/db/migrate.js

# Verify database tables
# Connect to PostgreSQL and check tables
```

## ✅ Verification Checklist

- [ ] Node.js installed and working
- [ ] PostgreSQL installed and database created
- [ ] Application files deployed to C:\AIAttend\app
- [ ] Dependencies installed (npm install)
- [ ] .env.production configured with correct values
- [ ] NSSM installed
- [ ] Backend service created and running
- [ ] Service set to auto-start
- [ ] Logs being written correctly
- [ ] Backend API responding at http://localhost:3000
- [ ] Database migrations completed

## 🆘 Troubleshooting

### Service Won't Start
```powershell
# Check service status
nssm status AIAttendBackend

# View detailed service info
nssm dump AIAttendBackend

# Check logs
Get-Content C:\AIAttend\logs\backend-error.log -Tail 50

# Try running manually to see errors
cd C:\AIAttend\app
node backend/server.js
```

### Database Connection Issues
- Verify DATABASE_URL in .env.production
- Check PostgreSQL is running: `Get-Service postgresql*`
- Test connection with pgAdmin or psql
- Check pg_hba.conf for access rules

### Port Already in Use
```powershell
# Find process using port 3000
Get-NetTCPConnection -LocalPort 3000 | Select-Object -Property LocalPort, OwningProcess
Get-Process -Id <ProcessId>

# Kill process if needed
Stop-Process -Id <ProcessId> -Force
```

### Permission Issues
- Ensure NSSM is running as Administrator
- Check file permissions on C:\AIAttend\app
- Verify Node.js has execute permissions

## 🔄 Updating the Application

```powershell
# Stop service
nssm stop AIAttendBackend

# Backup current version
Copy-Item -Path "C:\AIAttend\app" -Destination "C:\AIAttend\backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Recurse

# Deploy new version
# (copy new files to C:\AIAttend\app)

# Install/update dependencies
cd C:\AIAttend\app
npm install --production

# Run migrations if needed
node backend/db/migrate.js

# Start service
nssm start AIAttendBackend

# Verify
Get-Content C:\AIAttend\logs\backend.log -Tail 20
```

## 📝 Next Steps

After completing this setup:
1. Proceed to [IIS Reverse Proxy Setup](./iis-reverse-proxy-setup.md)
2. Configure SSL certificate for https://api.ailabtech.com
3. Test the complete setup
4. Deploy mobile apps using EAS Build

## 📞 Support

For issues:
1. Check service logs in C:\AIAttend\logs
2. Verify environment configuration
3. Test services individually
4. Check Windows Event Viewer for system errors
