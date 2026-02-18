$body = @{
    companyCode = "1"
    employeeNo = "ARDI-0008"
    password = "anything"
} | ConvertTo-Json

Write-Host "Testing login with ANY password..."
Write-Host "URL: http://192.168.1.4:3000/auth/login"
Write-Host "Body: $body"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://192.168.1.4:3000/auth/login" -Method Post -Body $body -ContentType "application/json"
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $_"
}


