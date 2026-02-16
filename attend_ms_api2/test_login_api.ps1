$body = @{
    companyCode = "1"
    employeeNo = "ARDI-0008"
    password = "Test@123"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "Testing login API with credentials:"
Write-Host "Company Code: 1"
Write-Host "Employee Number: ARDI-0008"
Write-Host "Password: Test@123"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -Body $body -Headers $headers
    Write-Host "Login SUCCESSFUL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Login FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error:" -ForegroundColor Red
    $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "Details:" -ForegroundColor Red
        $_.ErrorDetails.Message
    }
}
