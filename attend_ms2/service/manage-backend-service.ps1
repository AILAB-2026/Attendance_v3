# AIAttend Backend Service Management Script
# Quick commands to manage the backend service

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'tail', 'help')]
    [string]$Action = 'help'
)

$SERVICE_NAME = "AI Attend_v2"
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$LOG_DIR = Join-Path $PROJECT_ROOT "logs"
$STDOUT_LOG = Join-Path $LOG_DIR "backend-service-stdout.log"
$STDERR_LOG = Join-Path $LOG_DIR "backend-service-stderr.log"

function Show-Help {
    Write-Host ""
    Write-Host "AIAttend Backend Service Management" -ForegroundColor Cyan
    Write-Host "====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\manage-backend-service.ps1 [action]" -ForegroundColor White
    Write-Host ""
    Write-Host "Actions:" -ForegroundColor Yellow
    Write-Host "  start    - Start the backend service" -ForegroundColor White
    Write-Host "  stop     - Stop the backend service" -ForegroundColor White
    Write-Host "  restart  - Restart the backend service" -ForegroundColor White
    Write-Host "  status   - Show service status" -ForegroundColor White
    Write-Host "  logs     - Show recent log entries" -ForegroundColor White
    Write-Host "  tail     - Continuously monitor logs (Ctrl+C to stop)" -ForegroundColor White
    Write-Host "  help     - Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\manage-backend-service.ps1 start" -ForegroundColor Gray
    Write-Host "  .\manage-backend-service.ps1 status" -ForegroundColor Gray
    Write-Host "  .\manage-backend-service.ps1 logs" -ForegroundColor Gray
    Write-Host ""
}

function Get-ServiceStatus {
    $service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    
    if (-not $service) {
        Write-Host ""
        Write-Host "Service Status: NOT INSTALLED" -ForegroundColor Red
        Write-Host ""
        Write-Host "To install the service, run:" -ForegroundColor Yellow
        Write-Host "  .\install-backend-service.ps1" -ForegroundColor White
        Write-Host ""
        return $null
    }
    
    $statusColor = switch ($service.Status) {
        'Running' { 'Green' }
        'Stopped' { 'Yellow' }
        default { 'Red' }
    }
    
    Write-Host ""
    Write-Host "Service Information" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    Write-Host "Name:         $($service.Name)" -ForegroundColor White
    Write-Host "Display Name: $($service.DisplayName)" -ForegroundColor White
    Write-Host "Status:       $($service.Status)" -ForegroundColor $statusColor
    Write-Host "Start Type:   $($service.StartType)" -ForegroundColor White
    Write-Host ""
    
    return $service
}

function Start-BackendService {
    Write-Host "Starting service '$SERVICE_NAME'..." -ForegroundColor Yellow
    
    $service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "ERROR: Service not found. Please install it first." -ForegroundColor Red
        return
    }
    
    if ($service.Status -eq 'Running') {
        Write-Host "Service is already running." -ForegroundColor Green
        return
    }
    
    try {
        Start-Service -Name $SERVICE_NAME
        Start-Sleep -Seconds 2
        $service = Get-Service -Name $SERVICE_NAME
        
        if ($service.Status -eq 'Running') {
            Write-Host "[OK] Service started successfully" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Service status is $($service.Status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: Failed to start service: $_" -ForegroundColor Red
    }
}

function Stop-BackendService {
    Write-Host "Stopping service '$SERVICE_NAME'..." -ForegroundColor Yellow
    
    $service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "ERROR: Service not found." -ForegroundColor Red
        return
    }
    
    if ($service.Status -eq 'Stopped') {
        Write-Host "Service is already stopped." -ForegroundColor Green
        return
    }
    
    try {
        Stop-Service -Name $SERVICE_NAME -Force
        Start-Sleep -Seconds 2
        $service = Get-Service -Name $SERVICE_NAME
        
        if ($service.Status -eq 'Stopped') {
            Write-Host "[OK] Service stopped successfully" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Service status is $($service.Status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: Failed to stop service: $_" -ForegroundColor Red
    }
}

function Restart-BackendService {
    Write-Host "Restarting service '$SERVICE_NAME'..." -ForegroundColor Yellow
    
    $service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "ERROR: Service not found." -ForegroundColor Red
        return
    }
    
    try {
        Restart-Service -Name $SERVICE_NAME -Force
        Start-Sleep -Seconds 2
        $service = Get-Service -Name $SERVICE_NAME
        
        if ($service.Status -eq 'Running') {
            Write-Host "[OK] Service restarted successfully" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Service status is $($service.Status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: Failed to restart service: $_" -ForegroundColor Red
    }
}

function Show-Logs {
    Write-Host ""
    Write-Host "Recent Log Entries" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-Path $STDOUT_LOG) {
        Write-Host "STDOUT (last 20 lines):" -ForegroundColor Yellow
        Write-Host "----------------------" -ForegroundColor Gray
        Get-Content $STDOUT_LOG -Tail 20 | ForEach-Object { Write-Host $_ -ForegroundColor White }
        Write-Host ""
    } else {
        Write-Host "STDOUT log not found at: $STDOUT_LOG" -ForegroundColor Yellow
        Write-Host ""
    }
    
    if (Test-Path $STDERR_LOG) {
        $errorContent = Get-Content $STDERR_LOG -Tail 20
        if ($errorContent) {
            Write-Host "STDERR (last 20 lines):" -ForegroundColor Red
            Write-Host "----------------------" -ForegroundColor Gray
            $errorContent | ForEach-Object { Write-Host $_ -ForegroundColor Red }
            Write-Host ""
        }
    }
    
    Write-Host "Log files location:" -ForegroundColor Cyan
    Write-Host "  STDOUT: $STDOUT_LOG" -ForegroundColor Gray
    Write-Host "  STDERR: $STDERR_LOG" -ForegroundColor Gray
    Write-Host ""
}

function Tail-Logs {
    Write-Host ""
    Write-Host "Monitoring logs (Press Ctrl+C to stop)..." -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-Path $STDOUT_LOG)) {
        Write-Host "Log file not found: $STDOUT_LOG" -ForegroundColor Yellow
        Write-Host "The service may not have started yet." -ForegroundColor Yellow
        return
    }
    
    try {
        Get-Content $STDOUT_LOG -Wait -Tail 10
    } catch {
        Write-Host ""
        Write-Host "Log monitoring stopped." -ForegroundColor Yellow
    }
}

# Main script logic
switch ($Action) {
    'start' {
        Start-BackendService
    }
    'stop' {
        Stop-BackendService
    }
    'restart' {
        Restart-BackendService
    }
    'status' {
        Get-ServiceStatus | Out-Null
    }
    'logs' {
        Show-Logs
    }
    'tail' {
        Tail-Logs
    }
    'help' {
        Show-Help
    }
}
