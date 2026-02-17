# Test the legacy /leave endpoint that mobile app uses
Write-Host "Testing legacy /leave endpoint..." -ForegroundColor Cyan

try {
    # Login first
    $loginBody = @{
        companyCode = "1"
        employeeNo = "B1-E079"
        password = "Test@123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://192.168.1.5:7012/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        Write-Host "Login successful" -ForegroundColor Green
        $token = $loginResponse.data.sessionToken
        
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        
        # Test legacy /leave endpoint (what mobile app calls)
        Write-Host "Testing /leave endpoint (legacy)..." -ForegroundColor Yellow
        try {
            $leaveResponse = Invoke-RestMethod -Uri "http://192.168.1.5:7012/leave?companyCode=1&employeeNo=B1-E079" -Method GET -Headers $headers
            
            Write-Host "Legacy leave endpoint response:" -ForegroundColor Green
            $leaveResponse | ConvertTo-Json -Depth 3 | Write-Host
            
            if ($leaveResponse.data -and $leaveResponse.data.Count -gt 0) {
                Write-Host "SUCCESS! Found $($leaveResponse.data.Count) leave requests" -ForegroundColor Green
                foreach ($leave in $leaveResponse.data) {
                    Write-Host "   - ID: $($leave.id), Status: $($leave.leaveStatus), Type: $($leave.leaveType), Days: $($leave.days)" -ForegroundColor White
                }
            } else {
                Write-Host "No leave requests found in legacy endpoint" -ForegroundColor Red
            }
        } catch {
            Write-Host "Legacy leave endpoint error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}


