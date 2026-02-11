# Backend API & Database Setup — Windows and Linux Servers

This guide explains how to provision PostgreSQL, configure the API, run DB migrations and seeds, and run the backend as a service on Windows and Linux.

## 1) Prerequisites

- Node.js 18+ and npm on the server
- Git (optional)
- PostgreSQL 14+
- A domain (optional) if you want HTTPS via a reverse proxy

Project files used:
- API entrypoint: `backend/server.js` (runs `backend/hono.ts`)
- Migrations: `backend/db/migrate.js` (applies `backend/db/schema.sql` and `backend/db/functions.sql`)
- Scripts: `scripts/reset-db.js`, `scripts/seed-db.js`
- Environment: `.env`

## 2) Prepare the Server

### Linux (Ubuntu/Debian)
```bash
# System updates
sudo apt update && sudo apt -y upgrade

# Install Node.js 18 LTS (example via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Optional: Firewall allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Windows
- Install Node.js 18+ from nodejs.org
- Install PostgreSQL from postgresql.org (Windows Installer)
- Optional: Allow inbound rules on port 3000 (or your chosen port) in Windows Defender Firewall

## 3) Create Project Directory and Env

Copy project files to the server (git clone, zip upload, or CI/CD).

Create `.env` in project root (example based on this repo):
```
DATABASE_URL=postgresql://openpg:openpgpwd@localhost:5432/attendance_db
JWT_SECRET=change-this-dev-secret
PORT=3000

# Preferred base URL for backend & local node tests
API_BASE_URL=http://localhost:3000

# Expo app base URL (used by lib/api.ts)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000

# Optional toggles
ALLOW_DEV_LOGIN=false
LOGIN_ALLOWED_ROLES=employee,manager
EXPO_PUBLIC_DEMO_MODE=false
NODE_ENV=production
```
Adjust `DATABASE_URL` for your DB user/password/host.

Install dependencies:
```bash
npm install
```

## 4) Configure PostgreSQL

### Linux (psql)
```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE attendance_db;
CREATE USER attendance_user WITH PASSWORD 'attendance_pass';
GRANT ALL PRIVILEGES ON DATABASE attendance_db TO attendance_user;
SQL
```
Update `.env`:
```
DATABASE_URL=postgresql://attendance_user:attendance_pass@localhost:5432/attendance_db
```

### Windows (pgAdmin / psql)
- Use pgAdmin GUI to create DB `attendance_db` and user `attendance_user` with password.
- Or use `psql` from command prompt:
```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE attendance_db;"
psql -U postgres -h localhost -p 5432 -c "CREATE USER attendance_user WITH PASSWORD 'attendance_pass';"
psql -U postgres -h localhost -p 5432 -c "GRANT ALL PRIVILEGES ON DATABASE attendance_db TO attendance_user;"
```
Set `DATABASE_URL` accordingly.

## 5) Run Migrations and Seed

From project root:
```bash
# Apply schema + functions (auto-creates DB if missing when user has privileges)
npm run db:migrate

# Optional: seed baseline data (company, users, sample leave)
npm run db:seed
```

## 6) Run the API (Foreground)

```bash
npm run api:start
# API should log: API server listening on http://localhost:3000
```
Health check:
```bash
curl http://localhost:3000/
# {"status":"ok","message":"API is running"}
```

Quick local tests (optional):
```bash
# Verify DB connection and presence of users table
node test-db-connection.js

# Test login endpoint
node test-login.js
```

## 7) Run as a Service

### Linux — systemd Service
Create service unit `/etc/systemd/system/attendance-api.service`:
```
[Unit]
Description=Attendance API (Hono)
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/attendance
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=postgresql://attendance_user:attendance_pass@localhost:5432/attendance_db
Environment=JWT_SECRET=change_me

[Install]
WantedBy=multi-user.target
```
Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable attendance-api
sudo systemctl start attendance-api
sudo systemctl status attendance-api --no-pager
```
Logs:
```bash
journalctl -u attendance-api -f
```

### Windows — NSSM or PM2

Option A: NSSM (Non-Sucking Service Manager)
- Download NSSM: https://nssm.cc/
- Install service (Admin PowerShell):
```powershell
& "C:\path\to\nssm.exe" install AttendanceAPI "C:\Program Files\nodejs\node.exe" "C:\path\to\project\backend\server.js"
# Set Startup directory to project root
# Set environment variables in Windows Service or use a .env file in project root
& "C:\path\to\nssm.exe" start AttendanceAPI
```

Option B: PM2 (with pm2-windows-service or as a user process)
```powershell
npm i -g pm2
pm2 start backend/server.js --name attendance-api
pm2 save
# Optional (as Windows service): pm2-windows-service
npm i -g pm2-windows-service
pm2-service-install -n AttendancePM2
```

## 8) Reverse Proxy (Optional but Recommended)

### Linux — Nginx + Certbot
```bash
sudo apt-get install -y nginx
sudo ufw allow 'Nginx Full'

# Nginx server block (example):
# /etc/nginx/sites-available/attendance
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}

sudo ln -s /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/attendance
sudo nginx -t && sudo systemctl reload nginx

# HTTPS via Certbot
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

### Windows — IIS or Nginx for Windows
- Use IIS or Nginx for Windows to reverse proxy `http://localhost:3000` to `https://api.example.com`.
- Ensure correct forwarding of headers and websockets if needed.

## 9) Security & Hardening
- Use strong `JWT_SECRET` and keep `.env` out of VCS.
- Create a least-privileged DB user; avoid superuser in production.
- Restrict inbound firewall to only 80/443 (or your proxy ports).
- Keep system and Node packages updated.
- Regularly back up your database.

## 10) Backup & Restore

### Linux
```bash
# Backup
pg_dump -U attendance_user -h localhost -p 5432 -d attendance_db -F c -f /var/backups/attendance_db.backup

# Restore (to a new DB)
createdb -U attendance_user -h localhost -p 5432 attendance_db_restore
pg_restore -U attendance_user -h localhost -p 5432 -d attendance_db_restore --clean /var/backups/attendance_db.backup
```

### Windows (PowerShell)
```powershell
# Backup
pg_dump -U attendance_user -h localhost -p 5432 -d attendance_db -F c -f ".\attendance_db.backup"

# Restore (to a new DB)
createdb -U attendance_user -h localhost -p 5432 attendance_db_restore
pg_restore -U attendance_user -h localhost -p 5432 -d attendance_db_restore --clean ".\attendance_db.backup"
```

## 11) Health Checks & Monitoring
- Health endpoint: `GET /` returns `{ status: "ok", message: "API is running" }`.
- Consider UptimeRobot or a similar service to ping your domain.
- Tail logs via systemd (`journalctl -u attendance-api -f`) or PM2 (`pm2 logs attendance-api`).

## 12) Updating the API
- Pull or copy new code, then:
```bash
# If using git
git pull origin main

# Install dependencies (add --production=false to include dev deps if needed by build)
npm install --production=false

# Apply DB migrations (idempotent)
npm run db:migrate

# Optionally re-seed non-prod environments
# npm run db:seed
```

Restart the process depending on how you run the server:

### Linux — systemd
```bash
sudo systemctl restart attendance-api
sudo systemctl status attendance-api --no-pager
```

### Linux — PM2
```bash
pm2 restart attendance-api
pm2 logs attendance-api --lines 100
```

### Windows — NSSM
```powershell
nssm restart AttendanceAPI
nssm status AttendanceAPI
```

### Windows — PM2
```powershell
pm2 restart attendance-api
pm2 logs attendance-api --lines 100
# Restart via NSSM or PM2
```

## 13) Troubleshooting
- API not listening: verify environment, port binding, and that service started.
- DB connection failures: test `psql` with the same credentials and host.
- Reverse proxy 502: ensure backend is running; validate Nginx proxy_pass target.
- SSL issues: rerun certbot or validate IIS bindings.

Related docs:
- Scripts usage: `docs/SCRIPTS.md`
- Android deploy: `docs/DEPLOY_ANDROID.md`
- iOS deploy: `docs/DEPLOY_IOS.md`
