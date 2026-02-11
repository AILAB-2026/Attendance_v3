# Attendance App — User Guide

This guide covers setup, environment config, database commands, running the backend and app, API usage, and troubleshooting.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- PowerShell (Windows)
- Optional: psql client

## Project Structure

- Backend server: `backend/server.js` (runs `backend/hono.ts`)
- DB: `backend/db/schema.sql`, `backend/db/functions.sql`, `backend/db/migrate.js`
- API client: `lib/api.ts` (uses `EXPO_PUBLIC_API_BASE_URL` or `http://localhost:3000`)
- Expo app: `app/`

## Environment Variables

Create a `.env` at project root. Keys observed in this repo:

```
DATABASE_URL=postgresql://openpg:openpgpwd@localhost:5432/attendance_db
JWT_SECRET=change-this-dev-secret
PORT=3000

# Preferred by backend and local tests (non-Expo)
API_BASE_URL=http://localhost:3000

# Used by Expo app builds/runtime
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000

# Optional toggles
ALLOW_DEV_LOGIN=false
LOGIN_ALLOWED_ROLES=employee,manager
EXPO_PUBLIC_DEMO_MODE=false
NODE_ENV=development
```

## Install Dependencies

```
npm install
```

## Database Setup

You can use the migration script (recommended) or run SQL manually.

- Scripted migration (auto-creates DB if missing, applies schema + functions):
```
npm run db:migrate
```

- Manual via psql:
```powershell
# Connect as postgres superuser
psql -U postgres -h localhost -p 5432

-- Create database and optional user
CREATE DATABASE attendance_db;
CREATE USER attendance_user WITH PASSWORD 'attendance_pass';
GRANT ALL PRIVILEGES ON DATABASE attendance_db TO attendance_user;

\c attendance_db

-- Apply schema and functions from files:
-- psql -U postgres -h localhost -p 5432 -d attendance_db -f backend/db/schema.sql
-- psql -U postgres -h localhost -p 5432 -d attendance_db -f backend/db/functions.sql
```

Re-run migration any time:
```
npm run db:migrate
```

## Seed Minimal Data (SQL)

```sql
-- Company
INSERT INTO companies (code, name) VALUES ('ACME', 'Acme Corp')
ON CONFLICT (code) DO NOTHING;

-- Users (employee + manager)
INSERT INTO users (company_id, employee_no, name, role, annual_leave_balance, medical_leave_balance, emergency_leave_balance)
SELECT id, 'E001', 'Alice Employee', 'employee', 10, 5, 2 FROM companies WHERE code='ACME'
ON CONFLICT (employee_no, company_id) DO NOTHING;

INSERT INTO users (company_id, employee_no, name, role, annual_leave_balance, medical_leave_balance, emergency_leave_balance)
SELECT id, 'M001', 'Mark Manager', 'manager', 15, 10, 5 FROM companies WHERE code='ACME'
ON CONFLICT (employee_no, company_id) DO NOTHING;

-- Example leave (pending)
INSERT INTO leaves (user_id, start_date, end_date, type, reason, status)
SELECT u.id, '2025-08-25', '2025-08-26', 'annual', 'Family event', 'pending'
FROM users u JOIN companies c ON c.id=u.company_id
WHERE u.employee_no='E001' AND c.code='ACME';

-- Elevate manager to admin (optional)
UPDATE users SET role='admin' WHERE employee_no='M001';
```

## Running the Backend

- Start API:
```
npm run api:start
```

- Health check:
```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/"
# Expect: { status = "ok"; message = "API is running" }
```

## Running the Expo App

- Start Expo (tunnel):
```
npm start
```

- Start Expo (web):
```
npm run start-web
```

Ensure `EXPO_PUBLIC_API_BASE_URL` points to your API (default `http://localhost:3000`).

- When testing on a physical device on the same LAN, set both `API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP (e.g., `http://192.168.0.101:3000`).
- For production builds via EAS, set `EXPO_PUBLIC_API_BASE_URL` to your public domain (e.g., `https://api.example.com`).

## API Quick Reference

Base URL: `http://localhost:3000`

- Auth
  - POST `/auth/login`
- Attendance
  - GET `/attendance/today?employeeNo=...&companyCode=...`
  - POST `/attendance/clock-in`
  - POST `/attendance/clock-out`
- Leaves
  - GET `/leaves?companyCode=...&employeeNo=...`
  - POST `/leaves/apply`
  - POST `/leaves/update-status` (manager/admin only)
- Users
  - GET `/users/profile?companyCode=...&employeeNo=...`

### PowerShell Examples

- Login
```powershell
$body = @{ companyCode = "ACME"; employeeNo = "E001"; password = "password123" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/login" -ContentType "application/json" -Body $body
```

- Get today attendance
```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/attendance/today?employeeNo=E001&companyCode=ACME"
```

- Clock-in
```powershell
$body = @{ employeeNo="E001"; companyCode="ACME"; latitude=12.34; longitude=56.78; method="button" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/attendance/clock-in" -ContentType "application/json" -Body $body
```

- Apply leave
```powershell
$body = @{ companyCode="ACME"; employeeNo="E001"; startDate="2025-08-25"; endDate="2025-08-26"; type="annual"; reason="Family event" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/leaves/apply" -ContentType "application/json" -Body $body
```

- Approve leave (role required)
```powershell
$body = @{ leaveId="<LEAVE_ID>"; status="approved"; approverCompanyCode="ACME"; approverEmployeeNo="M001" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/leaves/update-status" -ContentType "application/json" -Body $body
```

- Reject leave
```powershell
$body = @{ leaveId="<LEAVE_ID>"; status="rejected"; rejectedReason="Insufficient coverage"; approverCompanyCode="ACME"; approverEmployeeNo="M001" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/leaves/update-status" -ContentType "application/json" -Body $body
```

## Common DB Commands

- Connect:
```powershell
psql -U postgres -h localhost -p 5432 -d attendance_db
```

- List tables:
```sql
\dt
```

- Inspect table:
```sql
\d users;
SELECT * FROM users LIMIT 10;
```

- Reset DB (destructive, dev only):
```powershell
psql -U postgres -h localhost -p 5432 -c "DROP DATABASE IF EXISTS attendance_db;"
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE attendance_db;"
npm run db:migrate
```

- Backup/Restore:
```powershell
# Backup
pg_dump -U postgres -h localhost -p 5432 -d attendance_db -F c -f ".\attendance_db.backup"

# Restore
pg_restore -U postgres -h localhost -p 5432 -d attendance_db --clean --create ".\attendance_db.backup"
```

## Troubleshooting

- API not reachable
  - Ensure `npm run api:start` shows: `API server listening on http://localhost:3000`.
  - Confirm `.env` `PORT` matches requests.

- Migration errors
  - Validate `DATABASE_URL`.
  - Ensure Postgres is running and accessible.
  - Re-run: `npm run db:migrate`.

- Leave approval errors
  - 403: approver not manager/admin.
  - 400: leave not pending / insufficient balance.
  - Approver company must match leave company.

- Expo app cannot reach API
  - Set `EXPO_PUBLIC_API_BASE_URL` to reachable host (LAN IP for device testing). For non-Expo scripts, ensure `API_BASE_URL` matches as well.

- Verify DB connectivity quickly
  - `node test-db-connection.js`

- Verify login endpoint quickly
  - `node test-login.js`

## NPM Scripts

- Start Expo: `npm start`
- Start Expo Web: `npm run start-web`
- DB Migrate: `npm run db:migrate`
- Start API: `npm run api:start`
- Reset DB (dev, destructive): `npm run db:reset`
- Seed DB (baseline data): `npm run db:seed`

## Related Documentation

- Android deploy: `docs/DEPLOY_ANDROID.md`
- iOS deploy: `docs/DEPLOY_IOS.md`
- Server/API/DB setup: `docs/SERVER_API_DB_SETUP.md`
- Scripts guide: `docs/SCRIPTS.md`
