
Import-Module WebAdministration
$site = "Default Web Site"
$limit = 10
$path = "IIS:\Sites\$site\attend_ms_api_2"

if (Test-Path $path) {
    Set-ItemProperty $path -Name physicalPath -Value "C:\inetpub\wwwroot\attend_ms_api2"
    Write-Host "Updated physical path to: C:\inetpub\wwwroot\attend_ms_api2"
    
    $app = Get-ItemProperty $path
    Write-Host "Current PhysicalPath: $($app.physicalPath)"
} else {
    Write-Host "Path not found: $path"
}
