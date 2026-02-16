# Test attendance API endpoints
Write-Host "Testing attendance API endpoints..." -ForegroundColor Cyan

try {
    # Login first
    $loginBody = @{
        companyCode = "1"
        employeeNo = "B1-E079"
        password = "Test@123"
    } | ConvertTo-Json

    Write-Host "Getting login token..." -ForegroundColor Yellow
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        Write-Host "Login successful" -ForegroundColor Green
        $token = $loginResponse.data.sessionToken
        
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        
        # Test /attendance/today endpoint
        Write-Host "Testing /attendance/today..." -ForegroundColor Yellow
        try {
            $todayResponse = Invoke-RestMethod -Uri "http://localhost:3001/attendance/today?companyCode=1&employeeNo=B1-E079" -Method GET -Headers $headers
            Write-Host "Today's attendance:" -ForegroundColor Green
            $todayResponse | ConvertTo-Json -Depth 3 | Write-Host
        } catch {
            Write-Host "Error with /attendance/today: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # Test /attendance/history endpoint
        Write-Host "Testing /attendance/history..." -ForegroundColor Yellow
        try {
            $historyResponse = Invoke-RestMethod -Uri "http://localhost:3001/attendance/history?startDate=2025-11-10&endDate=2025-11-12" -Method GET -Headers $headers
            Write-Host "Attendance history:" -ForegroundColor Green
            $historyResponse | ConvertTo-Json -Depth 3 | Write-Host
        } catch {
            Write-Host "Error with /attendance/history: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
