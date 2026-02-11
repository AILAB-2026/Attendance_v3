# AIAttend Backend Service Setup

This directory contains scripts to install and manage the AIAttend backend server as a Windows service using NSSM (Non-Sucking Service Manager).

## Prerequisites

- **Windows OS** (Windows 7 or later)
- **Administrator privileges** (required for service installation)
- **Node.js** installed and available in PATH
- **Project dependencies** installed (`npm install` in project root)

## Quick Start

### 1. Install the Service

Open PowerShell **as Administrator** and run:

```powershell
cd C:\AIAttend_v2\service
.\install-backend-service.ps1
```

The script will:
- ✓ Check Node.js installation
- ✓ Download and install NSSM (if not present)
- ✓ Create the Windows service named "AI Attend_v2"
- ✓ Configure logging and auto-restart
- ✓ Start the service

### 2. Verify Installation

Check the service status:

```powershell
.\manage-backend-service.ps1 status
```

Or use Windows Services:

```powershell
Get-Service "AI Attend_v2"
```

## Service Management

### Using the Management Script

The `manage-backend-service.ps1` script provides convenient commands:

```powershell
# Show help
.\manage-backend-service.ps1 help

# Start the service
.\manage-backend-service.ps1 start

# Stop the service
.\manage-backend-service.ps1 stop

# Restart the service
.\manage-backend-service.ps1 restart

# Check status
.\manage-backend-service.ps1 status

# View recent logs
.\manage-backend-service.ps1 logs

# Monitor logs in real-time
.\manage-backend-service.ps1 tail
```

### Using Windows PowerShell Commands

```powershell
# Start
Start-Service "AI Attend_v2"

# Stop
Stop-Service "AI Attend_v2"

# Restart
Restart-Service "AI Attend_v2"

# Status
Get-Service "AI Attend_v2"
```

### Using Windows Services Manager

1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "AI Attend_v2" in the list
4. Right-click for options (Start, Stop, Restart, Properties)

## Service Configuration

### Service Details

- **Service Name:** `AI Attend_v2`
- **Display Name:** `AI Attend_v2`
- **Description:** AIAttend attendance management system backend API server
- **Startup Type:** Automatic
- **Recovery:** Automatically restart on failure (5 second delay)

### File Locations

- **Server Script:** `C:\AIAttend_v2\backend\server.js`
- **Working Directory:** `C:\AIAttend_v2`
- **Log Files:** `C:\AIAttend_v2\logs\`
  - `backend-service-stdout.log` - Standard output
  - `backend-service-stderr.log` - Error output
- **NSSM Executable:** `C:\AIAttend_v2\service\nssm\nssm.exe`

### Log Rotation

Logs are automatically rotated when they reach 10MB in size.

## Uninstalling the Service

To remove the service:

```powershell
cd C:\AIAttend_v2\service
.\uninstall-backend-service.ps1
```

This will:
1. Stop the service
2. Remove the service from Windows
3. Keep log files (you can delete them manually if needed)

## Troubleshooting

### Service Won't Start

1. Check the logs:
   ```powershell
   .\manage-backend-service.ps1 logs
   ```

2. Verify Node.js is installed:
   ```powershell
   node --version
   ```

3. Test the server manually:
   ```powershell
   cd C:\AIAttend_v2
   npm run api:start
   ```

4. Check if port 3000 is already in use:
   ```powershell
   netstat -ano | findstr :3000
   ```

### Service Crashes Immediately

1. Check error logs:
   ```powershell
   Get-Content C:\AIAttend_v2\logs\backend-service-stderr.log -Tail 50
   ```

2. Verify environment variables in `.env` or `.env.production`

3. Ensure all npm dependencies are installed:
   ```powershell
   cd C:\AIAttend_v2
   npm install
   ```

### Permission Issues

- Ensure you run installation scripts **as Administrator**
- Check that the Node.js installation is accessible system-wide

### Database Connection Issues

- Verify PostgreSQL is running
- Check database credentials in `.env` or `.env.production`
- Ensure the database is accessible from the service account

## Advanced Configuration

### Modifying Service Settings

Use NSSM directly for advanced configuration:

```powershell
cd C:\AIAttend_v2\service\nssm
.\nssm.exe edit "AI Attend_v2"
```

This opens a GUI where you can modify:
- Application path and arguments
- Environment variables
- Log file locations
- Process priority
- Startup dependencies
- And more...

### Changing Port or Environment

1. Edit `.env` or `.env.production` in the project root
2. Restart the service:
   ```powershell
   Restart-Service "AI Attend_v2"
   ```

### Running Multiple Instances

To run multiple backend instances:
1. Copy the service scripts to a new directory
2. Modify the `$SERVICE_NAME` variable in each script
3. Configure different ports in separate `.env` files
4. Install each service with its unique name

## Service Behavior

### Automatic Startup

The service is configured to start automatically when Windows boots.

### Auto-Recovery

If the backend crashes, the service will automatically restart after 5 seconds.

### Graceful Shutdown

When stopping the service, it will attempt to gracefully shut down the Node.js process.

## Security Notes

- The service runs under the Local System account by default
- Ensure `.env` files contain sensitive credentials and are not exposed
- Log files may contain sensitive information - restrict access as needed
- Consider running the service under a dedicated user account for production

## Additional Resources

- **NSSM Documentation:** https://nssm.cc/
- **Node.js Documentation:** https://nodejs.org/docs/
- **Windows Services:** https://docs.microsoft.com/windows/win32/services/

## Support

For issues specific to:
- **NSSM:** Visit https://nssm.cc/
- **AIAttend Backend:** Check project documentation or contact your system administrator
- **Windows Services:** Consult Windows documentation or IT support
