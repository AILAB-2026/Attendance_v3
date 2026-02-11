# EAS Login Script
$username = "pn.sheeva@gmail.com"
$password = "Redblue*2024"

# Send username
Write-Host "Logging in to EAS..."
$process = Start-Process -FilePath "npx" -ArgumentList "eas-cli", "login" -NoNewWindow -PassThru -Wait

Write-Host "Login process completed"
