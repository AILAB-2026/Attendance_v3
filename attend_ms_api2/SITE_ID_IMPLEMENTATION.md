# Site ID Implementation - Summary

## What Was Changed

### 1. Database Schema
- **Added `site_id` column**to `employee_clocking_line` table
- Added foreign key constraint referencing `project_project` table
- Added index for performance

### 2. Backend API Changes

#### Clock-In Logic (`attendanceRoutes.js`):
- Added site ID lookup by name (similar to project lookup)
- Updated INSERT statement to include `site_id` column
- Both `site_id` and `project_id` are now stored separately

#### Display Logic (Today & History endpoints):
- Updated SQL queries to use two LEFT JOINs:
  - `pp_project` for project information
  - `pp_site` for site information
- Changed display logic to show **both** site and project:
  - `siteName`: Shows the actual site name (from `site_id`)
  - `projectName`: Shows the project name (from `project_id`)

### 3. How It Works Now

**When user selects**:
- Site: "Main Office"
- Project: "Project ABC"

**What gets stored**:
```sql
site_id = 123            -- ID of "Main Office"
project_id = 456         -- ID of "Project ABC"
clock_in_location = "Main Office"  -- Fallback text
```

**What gets displayed**:
```javascript
{
  siteName: "Main Office",      // From site_id join
  projectName: "Project ABC"    // From project_id join
}
```

## Migration Steps

### Step 1: Run Database Migration
Execute the SQL migration script on your database:

```bash
# For PostgreSQL
psql -U postgres -d your_database -f migrations/add_site_id_to_employee_clocking_line.sql
```

Or manually run the SQL in the migration file.

### Step 2: Restart Backend API
```bash
# Restart IIS App Pool
Restart-WebAppPool -Name "AttendMsApi2AppPool"
```

### Step 3: Test
1. Clock in with both site and project selected
2. Check the attendance history
3. Verify both site and project names are displayed

## Benefits

✅ **Proper Data Integrity**: Both site and project are stored as foreign keys
✅ **Better Reporting**: Can now query by site AND project separately
✅ **Improved Display**: Both values shown clearly in the UI
✅ **Backward Compatible**: Old records without `site_id` still work (NULL values allowed)

## Database Schema

```sql
employee_clocking_line
├── site_id (INTEGER, nullable) → project_project.id
├── project_id (INTEGER, nullable) → project_project.id
├── clock_in_location (TEXT) - Fallback text field
└── ...other columns
```

## Notes

- Sites and projects are both stored in the `project_project` table (Odoo convention)
- The `clock_in_location` field is retained as a fallback for text-based location info
- Both JOINs are LEFT JOINs, so NULL values won't break queries
