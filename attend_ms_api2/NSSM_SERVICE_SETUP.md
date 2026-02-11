# NSSM Service Setup for Attendance API

## Prerequisites

1. **Download NSSM**:
   - Go to: https://nssm.cc/download
   - Download the latest version
   - Extract to `C:\nssm\` (so you have `C:\nssm\nssm.exe`)

2. **Verify Node.js Installation**:
   - Ensure Node.js is installed at `C:\Program Files\nodejs\`
   - Verify npm is available at `C:\Program Files\nodejs\npm.cmd`

## Installation Steps

### Option 1: Using npm start (Recommended)

1. **Stop current Node.js process** (if running):
   ```powershell
   Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
   ```

2. **Run as Administrator**:
   - Right-click PowerShell
   - Select "Run as Administrator"

3. **Navigate to project directory**:
   ```powershell
   cd C:\inetpub\wwwroot\attendance_api_mobile
   ```

4. **Install NSSM service**:
   ```powershell
   .\install-nssm-npm-service.ps1
   ```

### Option 2: Direct Node.js execution

1. **Use the alternative script**:
   ```powershell
   .\install-nssm-service.ps1
   ```

## Service Management

After installation, you can manage the service with these commands:

```powershell
# Check service status
Get-Service -Name AttendanceAPI

# Start the service
Start-Service -Name AttendanceAPI

# Stop the service
Stop-Service -Name AttendanceAPI

# Restart the service
Restart-Service -Name AttendanceAPI

# Remove the service (if needed)
C:\nssm\nssm.exe remove AttendanceAPI confirm
```

## Verification

1. **Check if service is running**:
   ```powershell
   Get-Service -Name AttendanceAPI
   ```

2. **Test API endpoint**:
   - Open browser: http://localhost:3001
   - Should show API response

3. **Check logs**:
   - Location: `C:\inetpub\wwwroot\attendance_api_mobile\logs\`
   - Files: `service-output.log`, `service-error.log`

## Benefits of NSSM Service

✅ **Auto-start**: Service starts automatically when Windows boots
✅ **Background**: Runs in background without console window
✅ **Logging**: Automatic log rotation and management
✅ **Recovery**: Automatically restarts if it crashes
✅ **Management**: Easy start/stop/restart via Windows Services

## Troubleshooting

If the service fails to start:

1. **Check logs**: `C:\inetpub\wwwroot\attendance_api_mobile\logs\service-error.log`
2. **Verify paths**: Ensure Node.js and npm paths are correct
3. **Test manually**: Run `npm start` in the directory to check for errors
4. **Database**: Ensure PostgreSQL is running and accessible
5. **Environment**: Check `.env` file configuration

## Current Configuration

- **Service Name**: AttendanceAPI
- **Working Directory**: `C:\inetpub\wwwroot\attendance_api_mobile`
- **Command**: `npm start`
- **Port**: 3001
- **Auto-start**: Yes
- **Log Rotation**: Daily (10MB max)
