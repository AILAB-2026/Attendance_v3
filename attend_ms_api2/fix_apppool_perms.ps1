
$path = "C:\inetpub\wwwroot\attend_ms_api2"
$acl = Get-Acl $path
$identity = "IIS AppPool\AttendMsApi2AppPool"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity,"ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow")
$acl.AddAccessRule($rule)
Set-Acl $path $acl
Write-Host "Permissions updated for $path ($identity)"
