# Test clock out functionality for the already clocked-in employee
Write-Host "Testing Clock Out for B1-E079 who is already clocked in..." -ForegroundColor Cyan

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
        
        # Test clock out
        Write-Host "Attempting clock out..." -ForegroundColor Yellow
        
        $clockOutBody = @{
            companyCode = "1"
            employeeNo = "B1-E079"
            projectName = "tower"
            latitude = "1.3521"
            longitude = "103.8198"
            address = "Singapore"
            imageUri = "test_image.jpg"
        } | ConvertTo-Json
        
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        
        try {
            $clockOutResponse = Invoke-RestMethod -Uri "http://localhost:3001/attendance/clock-out" -Method POST -Body $clockOutBody -Headers $headers
            
            Write-Host "Clock Out Response:" -ForegroundColor Green
            $clockOutResponse | ConvertTo-Json -Depth 3 | Write-Host
            
            if ($clockOutResponse.success) {
                Write-Host "SUCCESS! Clock out completed successfully!" -ForegroundColor Green
            } else {
                Write-Host "Clock out failed: $($clockOutResponse.message)" -ForegroundColor Red
            }
        } catch {
            Write-Host "Clock out error: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
            }
        }
        
    } else {
        Write-Host "Login failed: $($loginResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
