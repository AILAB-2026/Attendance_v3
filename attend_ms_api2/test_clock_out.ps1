# Test clock-out API endpoint
Write-Host "Testing Clock-Out API" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

$clockOutData = @{
    companyCode = 1
    employeeNo = "B1-L157"
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    latitude = 1.3521
    longitude = 103.8198
    address = "Test Location"
    method = "face"
    projectName = "tower"
    siteName = "Test Site"
    imageUri = "test://image.jpg"
} | ConvertTo-Json

$url = "http://192.168.1.5:7012/attendance/clock-out"

try {
    Write-Host "Making clock-out request to: $url" -ForegroundColor Yellow
    Write-Host "Request data: $clockOutData" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $clockOutData -ContentType "application/json"
    
    Write-Host "Clock-out response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5 | Write-Host
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
}


