param(
    [string]$BaseUrl = 'http://localhost:7010',
    [string]$CompanyCode = '1',
    [string]$EmployeeNo = 'B1-E079'
)

Write-Host "=== Quick Clock Verify ===" -ForegroundColor Cyan
Write-Host "Base: $BaseUrl | Company: $CompanyCode | Employee: $EmployeeNo" -ForegroundColor Gray

function Invoke-Json {
    param(
        [Parameter(Mandatory=$true)][ValidateSet('GET','POST','PUT','DELETE')][string]$Method,
        [Parameter(Mandatory=$true)][string]$Uri,
        [object]$Body
    )
    try {
        if ($PSBoundParameters.ContainsKey('Body') -and $null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 8
            return Invoke-RestMethod -Uri $Uri -Method $Method -Body $json -ContentType 'application/json'
        } else {
            return Invoke-RestMethod -Uri $Uri -Method $Method
        }
    } catch {
        Write-Host ("HTTP Error -> {0} {1}" -f $Method, $Uri) -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $respBody = $reader.ReadToEnd()
            Write-Host $respBody -ForegroundColor Yellow
        } else {
            Write-Host $_.Exception.Message -ForegroundColor Yellow
        }
        return $null
    }
}

# 1) Face readiness
Write-Host "--- /facialAuth/ready ---" -ForegroundColor Cyan
$ready = Invoke-Json -Method GET -Uri ("{0}/facialAuth/ready" -f $BaseUrl)
$ready | ConvertTo-Json -Depth 6

# 2) Status BEFORE
Write-Host "--- /attendance/status (before) ---" -ForegroundColor Cyan
$statBefore = Invoke-Json -Method GET -Uri ("{0}/attendance/status?companyCode={1}&employeeNo={2}" -f $BaseUrl, $CompanyCode, $EmployeeNo)
$statBefore | ConvertTo-Json -Depth 6

# 3) Clock In (button)
Write-Host "--- /attendance/clock-in ---" -ForegroundColor Cyan
$clockInBody = @{ companyCode=$CompanyCode; employeeNo=$EmployeeNo; latitude=1.3521; longitude=103.8198; address='QA Test'; method='button' }
$inRes = Invoke-Json -Method POST -Uri ("{0}/attendance/clock-in" -f $BaseUrl) -Body $clockInBody
$inRes | ConvertTo-Json -Depth 6

Start-Sleep -Seconds 1

# 4) Status AFTER IN
Write-Host "--- /attendance/status (after in) ---" -ForegroundColor Cyan
$statAfterIn = Invoke-Json -Method GET -Uri ("{0}/attendance/status?companyCode={1}&employeeNo={2}" -f $BaseUrl, $CompanyCode, $EmployeeNo)
$statAfterIn | ConvertTo-Json -Depth 6

Start-Sleep -Seconds 1

# 5) Clock Out (button)
Write-Host "--- /attendance/clock-out ---" -ForegroundColor Cyan
$clockOutBody = @{ companyCode=$CompanyCode; employeeNo=$EmployeeNo; latitude=1.3521; longitude=103.8198; address='QA Test'; method='button' }
$outRes = Invoke-Json -Method POST -Uri ("{0}/attendance/clock-out" -f $BaseUrl) -Body $clockOutBody
$outRes | ConvertTo-Json -Depth 6

Start-Sleep -Seconds 1

# 6) Today's attendance
Write-Host "--- /attendance/today ---" -ForegroundColor Cyan
$today = Invoke-Json -Method GET -Uri ("{0}/attendance/today?companyCode={1}&employeeNo={2}" -f $BaseUrl, $CompanyCode, $EmployeeNo)
$today | ConvertTo-Json -Depth 6

Write-Host "=== Done ===" -ForegroundColor Green
