# Test the fixed leave requests endpoint
Write-Host "Testing /leave/requests endpoint for employee B1-E079..." -ForegroundColor Cyan

try {
    # First get a fresh login token
    $loginBody = @{
        companyCode = "1"
        employeeNo = "B1-E079"
        password = "Test@123"
    } | ConvertTo-Json

    Write-Host "Getting fresh login token..." -ForegroundColor Yellow
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        Write-Host "Login successful" -ForegroundColor Green
        $token = $loginResponse.data.sessionToken
        
        # Test leave requests endpoint
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        
        Write-Host "Fetching leave requests..." -ForegroundColor Yellow
        $leaveResponse = Invoke-RestMethod -Uri "http://localhost:3001/leave/requests" -Method GET -Headers $headers
        
        Write-Host "Leave requests response:" -ForegroundColor Green
        $leaveResponse | ConvertTo-Json -Depth 3 | Write-Host
        
        if ($leaveResponse -and $leaveResponse.Count -gt 0) {
            Write-Host "Found $($leaveResponse.Count) leave requests" -ForegroundColor Green
            foreach ($leave in $leaveResponse) {
                Write-Host "   - ID: $($leave.id), Status: $($leave.leaveStatus), Type: $($leave.leaveType), Days: $($leave.days)" -ForegroundColor White
            }
        } else {
            Write-Host "No leave requests found" -ForegroundColor Red
        }
    } else {
        Write-Host "Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
}
