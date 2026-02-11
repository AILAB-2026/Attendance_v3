# Scripts Guide — Database Reset and Seed

This document explains how to use the ready-to-run scripts in `scripts/` to manage your database.

## Overview

- `scripts/reset-db.js`
  - Drops and recreates the target database from `.env` `DATABASE_URL`.
  - Runs `backend/db/migrate.js` to apply `schema.sql` + `functions.sql`.
  - Intended for development resets. Destructive.

- `scripts/seed-db.js`
  - Inserts baseline data:
    - Company (default: ACME).
    - Manager/Admin user (default emp_no: M001).
    - Employee user (default emp_no: E001).
    - Sample pending leave for the employee.
  - Uses the same bcrypt hash for `password123` as `backend/db/schema.sql`.

- `scripts/seed-assignments.js`
  - Seeds example site/project assignments for users.
  - Useful for demonstrating attendance tied to sites/projects.

- `scripts/seed-sites-projects.js`
  - Seeds example sites and projects for a company.
  - Helps populate dropdowns and relations used by attendance.

- `scripts/show-sites-projects.js`
  - Prints existing sites and projects for quick inspection.

- `scripts/check-users.js`
  - Prints a summary of users in the database for verification.

## Prerequisites

- Postgres running and accessible
- `.env` configured with `DATABASE_URL` (e.g., `postgresql://postgres:postgres@localhost:5432/attendance_db`)
- Optional: `NODE_ENV=development` for local (disables SSL in scripts)

## NPM Commands

- Reset database (destructive):
```
npm run db:reset
```

- Seed baseline data:
```
npm run db:seed
```

These map to:
- `db:reset` → `node scripts/reset-db.js`
- `db:seed` → `node scripts/seed-db.js`

Additional utilities (run directly with Node):
- Show users:
```
node scripts/check-users.js
```
- Seed sites & projects:
```
node scripts/seed-sites-projects.js
```
- Seed assignments:
```
node scripts/seed-assignments.js
```
- Show sites & projects:
```
node scripts/show-sites-projects.js
```

## Environment Variables (Optional Overrides)

Place in `.env` to customize seed data:

- Company:
  - `SEED_COMPANY_CODE=ACME`
  - `SEED_COMPANY_NAME=Acme Corp`
- Manager/Admin:
  - `SEED_MANAGER_EMP_NO=M001`
  - `SEED_MANAGER_EMAIL=manager@example.com`
  - `SEED_MANAGER_NAME=Mark Manager`
  - `SEED_MANAGER_ROLE=manager` (or `admin`)
- Employee:
  - `SEED_EMP_EMP_NO=E001`
  - `SEED_EMP_EMAIL=employee@example.com`
  - `SEED_EMP_NAME=Alice Employee`
- Sample leave:
  - `SEED_LEAVE_START=2025-08-25`
  - `SEED_LEAVE_END=2025-08-26`
  - `SEED_LEAVE_TYPE=annual` (annual|medical|emergency|unpaid|other)
  - `SEED_LEAVE_REASON=Family event`

## What Each Script Does

- `reset-db.js`
  - Connects to the `postgres` database to:
    - Terminate active connections to the target DB.
    - `DROP DATABASE IF EXISTS <db>;`
    - `CREATE DATABASE <db>;`
  - Spawns `backend/db/migrate.js` to apply schema and functions.

- `seed-db.js`
  - Starts a transaction.
  - Upserts a company into `companies(company_code, company_name)`.
  - Upserts a manager/admin into `users` with initial leave balances.
  - Upserts an employee into `users` with initial leave balances.
  - Ensures company policy defaults: `work_start_time`, `work_end_time`, `work_hours_per_day`.
  - Inserts a `pending` leave for the employee.
  - Commits on success, rolls back on error.

- `seed-sites-projects.js`
  - Inserts sample `sites` and `projects` for the seeded company.
  - Safe to re-run; uses upsert patterns where applicable.

- `seed-assignments.js`
  - Links users to sites/projects with example assignment records.
  - Helps demo attendance filtered by assignment.

- `show-sites-projects.js`
  - Reads and prints current sites/projects for a quick check.

- `check-users.js`
  - Prints user rows and basic counts to validate seeds.

## Expected Output

- Reset: logs for terminating connections, dropping/creating DB, running migrations, then "Done.".
- Seed: summary like `{ companyCode: 'ACME', managerEmpNo: 'M001', employeeEmpNo: 'E001' }`.
- Additional scripts: short summaries or JSON dumps of inserted/listed entities.

## Troubleshooting

- Connection errors: verify Postgres is running and `DATABASE_URL` is correct.
- Permission errors (reset): ensure DB user can drop/create databases.
- Migration failures: inspect `backend/db/migrate.js` output for `schema.sql` / `functions.sql` errors.
- Seed conflicts: update seed env values or adjust unique fields (e.g., emails).

## Related Files

- `scripts/reset-db.js`
- `scripts/seed-db.js`
- `scripts/seed-sites-projects.js`
- `scripts/seed-assignments.js`
- `scripts/show-sites-projects.js`
- `scripts/check-users.js`
- `backend/db/migrate.js`
- `backend/db/schema.sql`
- `backend/db/functions.sql`
- `package.json` (npm scripts)
