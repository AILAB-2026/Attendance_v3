
$path = "C:\inetpub\wwwroot\attend_ms_api2"
$acl = Get-Acl $path
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS","ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow")
$acl.AddAccessRule($rule)
$rule2 = New-Object System.Security.AccessControl.FileSystemAccessRule("IUSR","ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow")
$acl.AddAccessRule($rule2)
Set-Acl $path $acl
Write-Host "Permissions updated for $path"
