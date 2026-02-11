# Fix Database Connection Issue
# The error shows: database "CX18AILABDEMO" does not exist

Write-Host "=== Database Connection Fix ===" -ForegroundColor Cyan
Write-Host ""

# Check what databases exist
Write-Host "1. Checking available databases..." -ForegroundColor Yellow
Write-Host ""

$pgUser = "openpg"
$pgHost = "localhost"
$pgPort = "5432"

Write-Host "Listing databases on PostgreSQL server..." -ForegroundColor White
$env:PGPASSWORD = "openpgpwd"
psql -U $pgUser -h $pgHost -p $pgPort -d postgres -c "\l" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not connect to PostgreSQL. Trying alternative method..." -ForegroundColor Yellow
    psql -U $pgUser -h $pgHost -p $pgPort -l 2>$null
}

Write-Host ""
Write-Host "2. Current DATABASE_URL in .env.production:" -ForegroundColor Yellow
$dbUrl = Get-Content .env.production | Select-String "^DATABASE_URL="
Write-Host "   $dbUrl" -ForegroundColor White
Write-Host ""

Write-Host "3. Possible fixes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option A: Create the missing database 'CX18AILABDEMO'" -ForegroundColor Green
Write-Host "   psql -U openpg -h localhost -p 5432 -d postgres -c `"CREATE DATABASE CX18AILABDEMO;`"" -ForegroundColor White
Write-Host ""

Write-Host "Option B: Update DATABASE_URL to use existing database" -ForegroundColor Green
Write-Host "   Edit .env.production and change DATABASE_URL to point to correct database" -ForegroundColor White
Write-Host ""

Write-Host "Option C: Use 'attendance_db' (as configured in .env.production)" -ForegroundColor Green
Write-Host "   Check if 'attendance_db' exists above" -ForegroundColor White
Write-Host "   If not, create it:" -ForegroundColor White
Write-Host "   psql -U openpg -h localhost -p 5432 -d postgres -c `"CREATE DATABASE attendance_db;`"" -ForegroundColor White
Write-Host ""

Write-Host "4. Which database do you want to use?" -ForegroundColor Cyan
Write-Host "   1. Create CX18AILABDEMO (matches error message)" -ForegroundColor White
Write-Host "   2. Use attendance_db (matches .env.production)" -ForegroundColor White
Write-Host "   3. Use CX18AI (ERP database)" -ForegroundColor White
Write-Host "   4. Manual fix" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Creating database CX18AILABDEMO..." -ForegroundColor Green
        $env:PGPASSWORD = "openpgpwd"
        psql -U openpg -h localhost -p 5432 -d postgres -c "CREATE DATABASE CX18AILABDEMO;"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database created!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Now update .env.production:" -ForegroundColor Yellow
            Write-Host "DATABASE_URL=postgresql://openpg:openpgpwd@localhost:5432/CX18AILABDEMO?sslmode=disable" -ForegroundColor White
            Write-Host ""
            Write-Host "Then run migrations:" -ForegroundColor Yellow
            Write-Host "cd backend/db" -ForegroundColor White
            Write-Host "psql postgresql://openpg:openpgpwd@localhost:5432/CX18AILABDEMO -f schema.sql" -ForegroundColor White
            Write-Host "psql postgresql://openpg:openpgpwd@localhost:5432/CX18AILABDEMO -f functions.sql" -ForegroundColor White
        } else {
            Write-Host "❌ Failed to create database" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "Checking if attendance_db exists..." -ForegroundColor Green
        $env:PGPASSWORD = "openpgpwd"
        $checkDb = psql -U openpg -h localhost -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='attendance_db';"
        
        if ($checkDb -eq "1") {
            Write-Host "✅ attendance_db exists!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Backend should use this database." -ForegroundColor Yellow
            Write-Host "Check why it's trying to connect to CX18AILABDEMO instead." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Possible causes:" -ForegroundColor White
            Write-Host "1. Backend is not loading .env.production" -ForegroundColor White
            Write-Host "2. Backend has hardcoded database name" -ForegroundColor White
            Write-Host "3. Different .env file is being used" -ForegroundColor White
        } else {
            Write-Host "⚠️  attendance_db does NOT exist" -ForegroundColor Yellow
            Write-Host ""
            $create = Read-Host "Create it now? (y/n)"
            if ($create -eq "y") {
                psql -U openpg -h localhost -p 5432 -d postgres -c "CREATE DATABASE attendance_db;"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Database created!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Run migrations:" -ForegroundColor Yellow
                    Write-Host "cd backend/db" -ForegroundColor White
                    Write-Host "psql postgresql://openpg:openpgpwd@localhost:5432/attendance_db -f schema.sql" -ForegroundColor White
                    Write-Host "psql postgresql://openpg:openpgpwd@localhost:5432/attendance_db -f functions.sql" -ForegroundColor White
                }
            }
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "Using CX18AI database..." -ForegroundColor Green
        Write-Host ""
        Write-Host "Update .env.production:" -ForegroundColor Yellow
        Write-Host "DATABASE_URL=postgresql://openpg:openpgpwd@localhost:5432/CX18AI?sslmode=disable" -ForegroundColor White
        Write-Host ""
        Write-Host "Then restart backend:" -ForegroundColor Yellow
        Write-Host "pm2 restart aiattend-backend" -ForegroundColor White
    }
    
    "4" {
        Write-Host ""
        Write-Host "Manual fix instructions:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. Decide which database to use" -ForegroundColor White
        Write-Host "2. Update DATABASE_URL in .env.production" -ForegroundColor White
        Write-Host "3. Ensure database exists" -ForegroundColor White
        Write-Host "4. Run migrations if needed" -ForegroundColor White
        Write-Host "5. Restart backend" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Verify DATABASE_URL is correct" -ForegroundColor White
Write-Host "2. Restart backend: pm2 restart aiattend-backend" -ForegroundColor White
Write-Host "3. Test clock-in again" -ForegroundColor White
Write-Host ""
