# Quick Login - Get Token for Testing
# Use this after app reinstall to quickly get a valid token

$body = @{
    companyCode = "1"
    employeeNo = "ARDI-0008"
    password = "test"
} | ConvertTo-Json

Write-Host "Logging in..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://192.168.31.45:3000/auth/login" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host ""
    Write-Host "✅ LOGIN SUCCESSFUL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Employee: $($response.employeeNo) - $($response.name)" -ForegroundColor Cyan
    Write-Host "Company: $($response.companyName)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Token (copy this if needed):" -ForegroundColor Yellow
    Write-Host $response.token -ForegroundColor White
    Write-Host ""
    Write-Host "Now you can login to the app with:" -ForegroundColor Cyan
    Write-Host "  Company Code: 1" -ForegroundColor White
    Write-Host "  Employee: ARDI-0008" -ForegroundColor White
    Write-Host "  Password: test (or anything)" -ForegroundColor White
    
} catch {
    Write-Host "❌ LOGIN FAILED!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}
