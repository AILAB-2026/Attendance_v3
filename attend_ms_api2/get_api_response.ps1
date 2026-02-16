# PowerShell script to test the attendance API
Write-Host "Testing Attendance API Response" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$url = "http://localhost:3001/attendance/today?companyCode=1&employeeNo=B1-L157"
Write-Host "Making request to: $url" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    
    Write-Host "API Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    if ($response.success -and $response.data) {
        $data = $response.data
        Write-Host "Key Data Points:" -ForegroundColor Magenta
        Write-Host "Date: $($data.date)"
        Write-Host "Status: $($data.status)"
        
        if ($data.clockIn) {
            Write-Host "Clock In Timestamp: $($data.clockIn.timestamp)"
            $clockInTime = [DateTimeOffset]::FromUnixTimeMilliseconds($data.clockIn.timestamp).ToString("HH:mm:ss")
            Write-Host "Clock In Time: $clockInTime"
        } else {
            Write-Host "Clock In: NULL"
        }
        
        if ($data.clockOut) {
            Write-Host "Clock Out Timestamp: $($data.clockOut.timestamp)"
            $clockOutTime = [DateTimeOffset]::FromUnixTimeMilliseconds($data.clockOut.timestamp).ToString("HH:mm:ss")
            Write-Host "Clock Out Time: $clockOutTime"
        } else {
            Write-Host "Clock Out: NULL"
        }
        
        Write-Host "Entries Count: $($data.entries.Count)"
    }
    
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
