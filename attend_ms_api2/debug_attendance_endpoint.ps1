# Debug attendance endpoint
Write-Host "Debugging attendance endpoint..." -ForegroundColor Cyan

try {
    # Login first
    $loginBody = @{
        companyCode = "1"
        employeeNo = "B1-E079"
        password = "Test@123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://192.168.1.4:7012/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        Write-Host "Login successful, token: $($loginResponse.data.sessionToken.Substring(0,20))..." -ForegroundColor Green
        
        $headers = @{
            'Authorization' = "Bearer $($loginResponse.data.sessionToken)"
            'Content-Type' = 'application/json'
        }
        
        # Test attendance endpoint with detailed error handling
        Write-Host "Testing attendance endpoint..." -ForegroundColor Yellow
        
        $uri = "http://192.168.1.4:7012/attendance/today?companyCode=1&employeeNo=B1-E079"
        Write-Host "URI: $uri" -ForegroundColor Gray
        
        try {
            $response = Invoke-WebRequest -Uri $uri -Method GET -Headers $headers
            Write-Host "Success! Status: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Response: $($response.Content)" -ForegroundColor White
        } catch {
            Write-Host "HTTP Error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
            Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
            
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "Login Error: $($_.Exception.Message)" -ForegroundColor Red
}



