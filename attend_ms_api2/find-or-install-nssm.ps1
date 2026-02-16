# Find NSSM or help with installation
Write-Host "=== NSSM Finder and Installer Helper ===" -ForegroundColor Green
Write-Host ""

# Common NSSM locations to check
$commonPaths = @(
    "C:\nssm\nssm.exe",
    "C:\Program Files\nssm\nssm.exe", 
    "C:\Program Files (x86)\nssm\nssm.exe",
    "C:\Windows\System32\nssm.exe",
    "C:\tools\nssm\nssm.exe",
    "C:\nssm-2.24\win64\nssm.exe",
    "C:\nssm-2.24\win32\nssm.exe"
)

Write-Host "Checking common NSSM locations..." -ForegroundColor Yellow

$nssmFound = $false
$nssmPath = ""

foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        Write-Host "✅ Found NSSM at: $path" -ForegroundColor Green
        $nssmPath = $path
        $nssmFound = $true
        break
    }
}

if (-not $nssmFound) {
    Write-Host "❌ NSSM not found in common locations" -ForegroundColor Red
    Write-Host ""
    Write-Host "=== NSSM Installation Guide ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Download NSSM:" -ForegroundColor White
    Write-Host "   - Go to: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "   - Download the latest version (nssm-2.24.zip)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2. Extract NSSM:" -ForegroundColor White
    Write-Host "   - Extract the ZIP file" -ForegroundColor Yellow
    Write-Host "   - Copy the appropriate folder to C:\nssm\" -ForegroundColor Yellow
    Write-Host "   - For 64-bit Windows: Copy win64\nssm.exe to C:\nssm\nssm.exe" -ForegroundColor Yellow
    Write-Host "   - For 32-bit Windows: Copy win32\nssm.exe to C:\nssm\nssm.exe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3. Verify Installation:" -ForegroundColor White
    Write-Host "   - Run this script again to verify" -ForegroundColor Yellow
    Write-Host ""
    
    # Try to help with download
    Write-Host "Would you like me to help you download NSSM? (Y/N)" -ForegroundColor Cyan
    $response = Read-Host
    
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host ""
        Write-Host "Opening NSSM download page..." -ForegroundColor Green
        Start-Process "https://nssm.cc/download"
        
        Write-Host ""
        Write-Host "After downloading:" -ForegroundColor Cyan
        Write-Host "1. Extract the ZIP file" -ForegroundColor White
        Write-Host "2. Create folder: C:\nssm" -ForegroundColor White
        Write-Host "3. Copy nssm.exe to: C:\nssm\nssm.exe" -ForegroundColor White
        Write-Host "4. Run this script again" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "=== NSSM Ready for Service Installation ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "NSSM Path: $nssmPath" -ForegroundColor White
    Write-Host ""
    
    # Test NSSM
    Write-Host "Testing NSSM..." -ForegroundColor Yellow
    try {
        $nssmVersion = & $nssmPath
        Write-Host "✅ NSSM is working correctly!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  NSSM found but may have issues: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Ready to install Attendance API service!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Stop current Node.js process (if running)" -ForegroundColor White
    Write-Host "2. Run as Administrator: .\install-nssm-npm-service.ps1" -ForegroundColor White
    Write-Host ""
    
    # Update the installation script with the correct path
    if ($nssmPath -ne "C:\nssm\nssm.exe") {
        Write-Host "Updating installation script with correct NSSM path..." -ForegroundColor Yellow
        
        $scriptContent = Get-Content "install-nssm-npm-service.ps1" -Raw
        $updatedContent = $scriptContent -replace 'NSSMPath = "C:\\nssm\\nssm.exe"', "NSSMPath = `"$nssmPath`""
        Set-Content "install-nssm-npm-service.ps1" -Value $updatedContent
        
        Write-Host "✅ Installation script updated with correct NSSM path" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
