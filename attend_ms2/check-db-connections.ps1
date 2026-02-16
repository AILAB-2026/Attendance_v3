# Check for any database connections or foreign servers
$env:PGPASSWORD = "openpgpwd"

Write-Host "=== Checking Database Connections ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking for dblink extensions..." -ForegroundColor Yellow
psql -U openpg -h localhost -p 5432 -d attendance_db -c "SELECT * FROM pg_extension WHERE extname LIKE '%dblink%' OR extname LIKE '%fdw%';"

Write-Host ""
Write-Host "2. Checking for foreign servers..." -ForegroundColor Yellow
psql -U openpg -h localhost -p 5432 -d attendance_db -c "SELECT * FROM pg_foreign_server;"

Write-Host ""
Write-Host "3. Checking current database..." -ForegroundColor Yellow
psql -U openpg -h localhost -p 5432 -d attendance_db -c "SELECT current_database();"

Write-Host ""
Write-Host "4. Testing record_clock_event function directly..." -ForegroundColor Yellow
psql -U openpg -h localhost -p 5432 -d attendance_db -c "SELECT record_clock_event('test-user-id', 1729000000000, 'in', 3.1390, 101.6869, 'Test', 'button', NULL, NULL, 'Test Site', 'Test Project');" 2>&1

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
