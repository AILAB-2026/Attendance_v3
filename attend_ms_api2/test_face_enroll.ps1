# Test Face Enrollment
# Usage: Place a photo of yourself in the project root as "test_face.jpg"
# Then run this script

param(
    [string]$ImagePath = "test_face.jpg",
    [string]$EmployeeNo = "ARDI-0008",
    [string]$CompanyCode = "1"
)

Write-Host "=== Face Enrollment Test ===" -ForegroundColor Cyan
Write-Host "Employee Number: $EmployeeNo"
Write-Host "Company Code: $CompanyCode"
Write-Host "Image Path: $ImagePath"
Write-Host ""

# Check if image exists
if (-not (Test-Path $ImagePath)) {
    Write-Host "ERROR: Image file not found at: $ImagePath" -ForegroundColor Red
    Write-Host "Please place a photo of yourself in the project root and name it 'test_face.jpg'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Uploading image and enrolling face..." -ForegroundColor Yellow

try {
    # Create multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"employeeNo`"$LF",
        $EmployeeNo,
        "--$boundary",
        "Content-Disposition: form-data; name=`"companyCode`"$LF",
        $CompanyCode,
        "--$boundary",
        "Content-Disposition: form-data; name=`"image`"; filename=`"face.jpg`"",
        "Content-Type: image/jpeg$LF"
    ) -join $LF
    
    $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $ImagePath))
    $bodyLinesBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyLines)
    $endBytes = [System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF")
    
    $requestBytes = $bodyLinesBytes + $fileBytes + $endBytes
    
    $response = Invoke-RestMethod -Uri "http://192.168.1.4:7012/facial-auth/enroll" `
        -Method Post `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $requestBytes
    
    Write-Host ""
    Write-Host "SUCCESS! Face enrolled successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host ""
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}



