# Test the site name fix - should show project names instead of addresses
Write-Host "Testing site name display fix..." -ForegroundColor Cyan

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
        
        # Test /attendance/today endpoint
        Write-Host "`nTesting /attendance/today for site names..." -ForegroundColor Yellow
        try {
            $todayResponse = Invoke-RestMethod -Uri "http://192.168.1.5:7012/attendance/today?companyCode=1&employeeNo=B1-E079" -Method GET -Headers $headers
            
            Write-Host "Today's attendance response:" -ForegroundColor Green
            if ($todayResponse.entries -and $todayResponse.entries.Count -gt 0) {
                foreach ($entry in $todayResponse.entries) {
                    Write-Host "   Site Name: '$($entry.siteName)'" -ForegroundColor White
                    Write-Host "   Project Name: '$($entry.projectName)'" -ForegroundColor White
                    
                    # Check if siteName looks like an address (contains comma and numbers)
                    if ($entry.siteName -match '\d+,.*Tamil Nadu') {
                        Write-Host "   âŒ ISSUE: Still showing address instead of site name!" -ForegroundColor Red
                    } else {
                        Write-Host "   âœ… GOOD: Showing proper site name (not address)" -ForegroundColor Green
                    }
                }
            } else {
                Write-Host "   No entries found for today" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Today endpoint error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # Test /attendance/history endpoint
        Write-Host "`nTesting /attendance/history for site names..." -ForegroundColor Yellow
        try {
            $historyResponse = Invoke-RestMethod -Uri "http://192.168.1.5:7012/attendance/history?companyCode=1&employeeNo=B1-E079&startDate=2025-11-10&endDate=2025-11-12" -Method GET -Headers $headers
            
            Write-Host "History response:" -ForegroundColor Green
            if ($historyResponse -and $historyResponse.Count -gt 0) {
                $historyResponse | ForEach-Object {
                    Write-Host "   Date: $($_.date)" -ForegroundColor Cyan
                    Write-Host "   Site Name: '$($_.siteName)'" -ForegroundColor White
                    Write-Host "   Project Name: '$($_.projectName)'" -ForegroundColor White
                    
                    # Check if siteName looks like an address
                    if ($_.siteName -match '\d+,.*Tamil Nadu') {
                        Write-Host "   âŒ ISSUE: Still showing address instead of site name!" -ForegroundColor Red
                    } else {
                        Write-Host "   âœ… GOOD: Showing proper site name (not address)" -ForegroundColor Green
                    }
                    Write-Host ""
                }
            } else {
                Write-Host "   No history entries found" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   History endpoint error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nðŸ“± EXPECTED RESULT AFTER FIX:" -ForegroundColor Cyan
Write-Host "- Site names should show project names like 'tower', 'yard', 'T2C' etc." -ForegroundColor White
Write-Host "- Should NOT show addresses like '15, Thanjavur, Tamil Nadu, 613...'" -ForegroundColor White
Write-Host "- Mobile app will display clean site names in Today's Sites section" -ForegroundColor White


