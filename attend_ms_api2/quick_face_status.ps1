param(
    [string]$BaseUrl = 'http://localhost:7010',
    [string]$CompanyCode = '1',
    [string]$EmployeeNo = 'B1-E079'
)

Write-Host "=== Quick Face/Status Check ===" -ForegroundColor Cyan

function Show-Json($obj, $title) {
    Write-Host "--- $title ---" -ForegroundColor Yellow
    try { $obj | ConvertTo-Json -Depth 8 } catch { $obj | Out-String }
}

try {
    $ready = Invoke-RestMethod -Uri ("{0}/facialAuth/ready" -f $BaseUrl) -Method GET
    Show-Json $ready 'facialAuth/ready'
} catch { Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red }

try {
    $face = Invoke-RestMethod -Uri ("{0}/face/status?companyCode={1}&employeeNo={2}" -f $BaseUrl, $CompanyCode, $EmployeeNo) -Method GET
    Show-Json $face 'face/status'
} catch { Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red }

try {
    $status = Invoke-RestMethod -Uri ("{0}/attendance/status?companyCode={1}&employeeNo={2}" -f $BaseUrl, $CompanyCode, $EmployeeNo) -Method GET
    Show-Json $status 'attendance/status'
} catch { Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red }

Write-Host "=== Done ===" -ForegroundColor Green
