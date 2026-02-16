# Assignment Synchronization Documentation

## Overview

The attendance management system uses two separate but related systems for managing employee assignments:

1. **Schedules Table** - Stores daily work schedules with location information
2. **Employee Assignments Table** - Stores site/project assignments with date ranges

This document explains how these systems work together and how to maintain synchronization between them.

## Problem Statement

Previously, there was a disconnect between:
- **Frontend Assignment Creation** → Creates records in `schedules` table
- **Clock-in Validation** → Checks `employee_assignments` table

This caused "You are not assigned to this site/project for today" errors even when assignments existed in the schedules.

## Solution Architecture

### 1. Unified Assignment Creation

**Backend Enhancement (`/admin/schedules/bulk-assign`)**:
- Now accepts both `location` (legacy) and `siteName`/`projectName` (new) parameters
- Creates records in **both** `schedules` and `employee_assignments` tables
- Automatically determines if location is a site or project by checking existing entities

**Frontend Enhancement (`AssignView.tsx`)**:
- Sends both `location` and separate `siteName`/`projectName` fields
- Provides backward compatibility while enabling proper assignment tracking

### 2. Database Schema Alignment

**Schedules Table**:
```sql
CREATE TABLE schedules (
  user_id UUID,
  date DATE,
  location TEXT,  -- Can be site name or project name
  start_time TIME,
  end_time TIME,
  -- other fields...
);
```

**Employee Assignments Table**:
```sql
CREATE TABLE employee_assignments (
  user_id UUID,
  site_name TEXT,     -- Specific site assignment
  project_name TEXT,  -- Specific project assignment
  start_date DATE,
  end_date DATE,
  -- other fields...
);
```

### 3. Synchronization Logic

**Assignment Creation Flow**:
1. Frontend sends assignment data with both location and site/project fields
2. Backend creates schedule records for each day in date range
3. Backend creates employee_assignment record for the date range
4. Assignment validation during clock-in checks employee_assignments table

**Data Mapping**:
- If `siteName` provided → `employee_assignments.site_name`
- If `projectName` provided → `employee_assignments.project_name`
- If only `location` provided → Check if it's a known site or project, assign accordingly

## API Endpoints

### Assignment Creation
```
POST /admin/schedules/bulk-assign
{
  "companyCode": "ABC123",
  "employeeNo": "E001",
  "employeeNos": ["E001", "E002"],
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "startTime": "09:00",
  "endTime": "18:00",
  "location": "Main Warehouse",     // Legacy field
  "siteName": "Main Warehouse",     // New explicit field
  "projectName": "Safety Audit",    // New explicit field
  "notes": "Monthly assignment"
}
```

### Consistency Checking
```
GET /admin/consistency-check?companyCode=ABC123&employeeNo=ADMIN001
```

### Fix Inconsistencies
```
POST /admin/fix-inconsistencies
{
  "companyCode": "ABC123",
  "employeeNo": "ADMIN001"
}
```

## Database Consistency Checks

### Automated Checks

The system includes automated consistency checks that detect:

1. **Schedules without Assignments**: Schedule records with location but no corresponding employee_assignments
2. **Assignments without Schedules**: Employee assignments without corresponding schedule records
3. **Orphaned Records**: Clock events not linked to any attendance records
4. **Data Integrity Issues**: Negative hours, missing references, etc.

### Manual Sync Script

Run the synchronization script to fix existing data:

```bash
node scripts/sync-assignments.js
```

This script:
- Finds schedules with location but no corresponding employee_assignments
- Creates appropriate employee_assignments records
- Handles site vs project detection automatically
- Reports on sync results

## Frontend Integration

### Management Interface

**Assignment Sync View** (`components/manage/AssignmentSyncView.tsx`):
- Accessible from Manage → Assignment Sync
- Provides one-click consistency checking
- Shows detailed reports of sync issues
- Allows automated fixing of common problems

**Features**:
- Real-time consistency checking
- Visual issue reporting with counts and descriptions
- Automated fix functionality
- Admin role validation

### Usage Flow

1. **Manager/Admin** accesses Manage screen
2. Selects **Assignment Sync** tool
3. Clicks **Check Sync** to analyze current state
4. Reviews any issues found
5. Clicks **Fix Issues** to automatically resolve problems
6. Re-checks to verify fixes applied successfully

## Data Flow Diagram

```
Frontend Assignment Creation
         ↓
Backend /admin/schedules/bulk-assign
         ↓
    ┌─────────────────┐
    │   Creates:      │
    │ • schedules     │ ← Daily work schedules
    │ • employee_     │ ← Date range assignments
    │   assignments   │
    └─────────────────┘
         ↓
Clock-in Validation
         ↓
Checks employee_assignments table
         ↓
✅ Assignment Found → Allow clock-in
❌ No Assignment → Show validation error
```

## Troubleshooting

### Common Issues

**"Not assigned to this site/project" Error**:
1. Check if employee_assignments record exists for the user/date/site
2. Run consistency check to identify sync issues
3. Use automated fix to create missing assignments
4. Verify site/project names match exactly

**Duplicate Assignment Errors**:
1. Check for conflicting date ranges in employee_assignments
2. Review unique constraints on assignment table
3. Clean up duplicate records if necessary

**Schedule vs Assignment Mismatch**:
1. Run full consistency check
2. Review sync script output for errors
3. Manually verify data integrity

### Monitoring

**Regular Maintenance**:
- Run consistency checks weekly
- Monitor assignment creation logs
- Review sync script output for patterns
- Update site/project master data as needed

**Performance Considerations**:
- Assignment validation is cached during clock-in process
- Bulk operations use database transactions
- Consistency checks are optimized with proper indexing

## Migration Guide

### For Existing Deployments

1. **Backup Database**: Always backup before running sync operations
2. **Run Sync Script**: `node scripts/sync-assignments.js`
3. **Verify Results**: Check consistency reports
4. **Test Clock-in**: Verify assignment validation works
5. **Monitor**: Watch for any remaining sync issues

### For New Deployments

The system is now synchronized by default. New assignments will automatically create both schedule and employee_assignment records.

## Security Considerations

- Assignment sync operations require admin role
- All sync operations are logged in admin_audit_logs
- Input validation prevents SQL injection
- Rate limiting on consistency check endpoints

## Future Enhancements

- Real-time sync notifications
- Automated sync scheduling
- Enhanced reporting dashboard
- Integration with HR systems
- Mobile sync status indicators

---

For technical support or questions about assignment synchronization, refer to the development team or check the consistency reports in the admin interface.
