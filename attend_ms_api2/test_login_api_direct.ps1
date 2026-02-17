# Test login API directly
Write-Host "Testing Login API for AI-EMP-014..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    companyCode = "1"
    employeeNo = "AI-EMP-014"
    password = "password"
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $body
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://192.168.1.5:7012/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "âœ… LOGIN SUCCESSFUL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Token (first 50 chars):" -ForegroundColor Yellow
    Write-Host $response.token.Substring(0, [Math]::Min(50, $response.token.Length))
    Write-Host ""
    Write-Host "Employee Details:" -ForegroundColor Yellow
    Write-Host "  ID: $($response.employeeId)"
    Write-Host "  Number: $($response.employeeNo)"
    Write-Host "  Name: $($response.name)"
    Write-Host "  Company ID: $($response.customerId)"
    Write-Host "  Company Name: $($response.companyName)"
    
} catch {
    Write-Host "âŒ LOGIN FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message
    Write-Host ""
    if ($_.ErrorDetails.Message) {
        Write-Host "Server Response:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message
    }
}


