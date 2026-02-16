# Test the site name fix - should show project names instead of addresses
Write-Host "Testing site name display fix..." -ForegroundColor Cyan

try {
    # Login first
    $loginBody = @{
        companyCode = "1"
        employeeNo = "B1-E079"
        password = "Test@123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        Write-Host "Login successful" -ForegroundColor Green
        $token = $loginResponse.data.sessionToken
        
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        
        # Test /attendance/today endpoint
        Write-Host "Testing /attendance/today for site names..." -ForegroundColor Yellow
        try {
            $todayResponse = Invoke-RestMethod -Uri "http://localhost:3001/attendance/today?companyCode=1&employeeNo=B1-E079" -Method GET -Headers $headers
            
            Write-Host "Today's attendance response:" -ForegroundColor Green
            if ($todayResponse.entries -and $todayResponse.entries.Count -gt 0) {
                foreach ($entry in $todayResponse.entries) {
                    Write-Host "   Site Name: '$($entry.siteName)'" -ForegroundColor White
                    Write-Host "   Project Name: '$($entry.projectName)'" -ForegroundColor White
                    
                    # Check if siteName looks like an address (contains comma and numbers)
                    if ($entry.siteName -match '\d+,.*Tamil Nadu') {
                        Write-Host "   ISSUE: Still showing address instead of site name!" -ForegroundColor Red
                    } else {
                        Write-Host "   GOOD: Showing proper site name (not address)" -ForegroundColor Green
                    }
                }
            } else {
                Write-Host "   No entries found for today" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Today endpoint error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "EXPECTED RESULT AFTER FIX:" -ForegroundColor Cyan
Write-Host "- Site names should show project names like 'tower', 'yard', 'T2C' etc." -ForegroundColor White
Write-Host "- Should NOT show addresses like '15, Thanjavur, Tamil Nadu, 613...'" -ForegroundColor White
