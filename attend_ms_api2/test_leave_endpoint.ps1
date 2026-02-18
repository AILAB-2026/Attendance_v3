# Test the fixed leave requests endpoint
$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbXBsb3llZUlkIjoyNjcsImVtcE5vIjoiQjEtRTA3OSIsImNvbXBhbnlDb2RlIjoiMSIsImlhdCI6MTczMTM5NzU5MywiZXhwIjoxNzMxNDgzOTkzfQ.example'
}

Write-Host "ðŸ§ª Testing /leave/requests endpoint for employee B1-E079..." -ForegroundColor Cyan

try {
    # First get a fresh login token
    $loginBody = @{
        companyCode = "1"
        employeeNo = "B1-E079"
        password = "Test@123"
    } | ConvertTo-Json

    Write-Host "ðŸ” Getting fresh login token..." -ForegroundColor Yellow
    $loginResponse = Invoke-RestMethod -Uri "http://192.168.1.4:7012/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        Write-Host "âœ… Login successful" -ForegroundColor Green
        $token = $loginResponse.data.sessionToken
        
        # Test leave requests endpoint
        $headers['Authorization'] = "Bearer $token"
        Write-Host "ðŸ“‹ Fetching leave requests..." -ForegroundColor Yellow
        
        $leaveResponse = Invoke-RestMethod -Uri "http://192.168.1.4:7012/leave/requests" -Method GET -Headers $headers
        
        Write-Host "ðŸ“Š Leave requests response:" -ForegroundColor Green
        $leaveResponse | ConvertTo-Json -Depth 3 | Write-Host
        
        if ($leaveResponse -and $leaveResponse.Count -gt 0) {
            Write-Host "âœ… Found $($leaveResponse.Count) leave requests" -ForegroundColor Green
            foreach ($leave in $leaveResponse) {
                Write-Host "   - ID: $($leave.id), Status: $($leave.leaveStatus), Type: $($leave.leaveType), Days: $($leave.days)" -ForegroundColor White
            }
        } else {
            Write-Host "âŒ No leave requests found" -ForegroundColor Red
        }
    } else {
        Write-Host "âŒ Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}



