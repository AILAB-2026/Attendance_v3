# Watch face recognition logs in real-time
Write-Host "`n=== Watching Face Recognition Logs ===" -ForegroundColor Cyan
Write-Host "Monitoring: backend-service-stdout.log" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray

Get-Content .\logs\backend-service-stdout.log -Tail 20 -Wait | 
    Where-Object { $_ -match "Face|face|verify|register|Hamming|Match score" } |
    ForEach-Object {
        $line = $_
        if ($line -match "error|Error|failed|Failed|REJECTED") {
            Write-Host $line -ForegroundColor Red
        }
        elseif ($line -match "success|Success|verified|registered|PASS") {
            Write-Host $line -ForegroundColor Green
        }
        elseif ($line -match "Face Register|Face Verify") {
            Write-Host $line -ForegroundColor Cyan
        }
        else {
            Write-Host $line -ForegroundColor White
        }
    }
