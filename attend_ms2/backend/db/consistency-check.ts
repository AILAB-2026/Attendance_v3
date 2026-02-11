/**
 * Database Consistency Check Functions
 * Ensures data integrity across all tables (Updated for Short ID system)
 */

import { db } from './connection';

export interface ConsistencyReport {
  tableName: string;
  issues: Array<{
    type: 'error' | 'warning';
    description: string;
    count: number;
    query?: string;
  }>;
  totalRecords: number;
  lastChecked: Date;
}

/**
 * Check assignment synchronization between schedules and employee_assignments
 */
export async function checkAssignmentSyncConsistency(): Promise<ConsistencyReport> {
  const issues: ConsistencyReport['issues'] = [];
  
  try {
    // Check for schedules with location but no corresponding employee_assignments
    const schedulesWithoutAssignments = await db.query(`
      SELECT COUNT(*) as count 
      FROM schedules s 
      WHERE s.location IS NOT NULL 
        AND s.location != ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_assignments ea 
          WHERE ea.user_id = s.user_id 
            AND (ea.start_date IS NULL OR ea.start_date <= s.date)
            AND (ea.end_date IS NULL OR ea.end_date >= s.date)
            AND (ea.site_name = s.location OR ea.project_name = s.location)
        )
    `);
    
    if (schedulesWithoutAssignments.rows[0]?.count > 0) {
      issues.push({
        type: 'warning',
        description: 'Schedules with location but no matching employee assignments',
        count: parseInt(schedulesWithoutAssignments.rows[0].count),
        query: 'SELECT s.* FROM schedules s WHERE s.location IS NOT NULL AND ...'
      });
    }

    // Check for employee_assignments without corresponding schedules
    const assignmentsWithoutSchedules = await db.query(`
      SELECT COUNT(*) as count 
      FROM employee_assignments ea 
      WHERE NOT EXISTS (
        SELECT 1 FROM schedules s 
        WHERE s.user_id = ea.user_id 
          AND s.date BETWEEN COALESCE(ea.start_date, s.date) AND COALESCE(ea.end_date, s.date)
          AND (s.location = ea.site_name OR s.location = ea.project_name)
      )
      AND (ea.start_date <= CURRENT_DATE AND COALESCE(ea.end_date, CURRENT_DATE) >= CURRENT_DATE)
    `);
    
    if (assignmentsWithoutSchedules.rows[0]?.count > 0) {
      issues.push({
        type: 'warning',
        description: 'Active employee assignments without corresponding schedules',
        count: parseInt(assignmentsWithoutSchedules.rows[0].count)
      });
    }

    const totalCount = await db.query('SELECT COUNT(*) as count FROM employee_assignments');
    
    return {
      tableName: 'assignment_sync',
      issues,
      totalRecords: parseInt(totalCount.rows[0]?.count || '0'),
      lastChecked: new Date()
    };

  } catch (error) {
    console.error('Assignment sync consistency check failed:', error);
    return {
      tableName: 'assignment_sync',
      issues: [{
        type: 'error',
        description: `Assignment sync check failed: ${error}`,
        count: 0
      }],
      totalRecords: 0,
      lastChecked: new Date()
    };
  }
}

/**
 * Check attendance data consistency
 */
export async function checkAttendanceConsistency(): Promise<ConsistencyReport> {
  const issues: ConsistencyReport['issues'] = [];
  
  try {
    // Check for orphaned clock events
    const orphanedEvents = await db.query(`
      SELECT COUNT(*) as count 
      FROM clock_events ce 
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance_entries ae 
        WHERE ae.clock_in_id = ce.id OR ae.clock_out_id = ce.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM attendance_days ad 
        WHERE ad.clock_in_id = ce.id OR ad.clock_out_id = ce.id
      )
    `);
    
    if (orphanedEvents.rows[0]?.count > 0) {
      issues.push({
        type: 'warning',
        description: 'Orphaned clock events not linked to any attendance record',
        count: parseInt(orphanedEvents.rows[0].count),
        query: 'SELECT * FROM clock_events WHERE ...'
      });
    }

    // Check for attendance entries without corresponding attendance_days
    const entriesWithoutDays = await db.query(`
      SELECT COUNT(*) as count 
      FROM attendance_entries ae 
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance_days ad 
        WHERE ad.user_id = ae.user_id AND ad.date = ae.date
      )
    `);
    
    if (entriesWithoutDays.rows[0]?.count > 0) {
      issues.push({
        type: 'error',
        description: 'Attendance entries without corresponding attendance_days records',
        count: parseInt(entriesWithoutDays.rows[0].count)
      });
    }

    // Check for clock-in without clock-out (older than 24 hours)
    const incompleteClockIns = await db.query(`
      SELECT COUNT(*) as count 
      FROM attendance_entries ae 
      WHERE ae.clock_in_id IS NOT NULL 
        AND ae.clock_out_id IS NULL 
        AND ae.date < CURRENT_DATE - INTERVAL '1 day'
    `);
    
    if (incompleteClockIns.rows[0]?.count > 0) {
      issues.push({
        type: 'warning',
        description: 'Clock-ins without clock-outs older than 24 hours',
        count: parseInt(incompleteClockIns.rows[0].count)
      });
    }

    // Check for negative hours
    const negativeHours = await db.query(`
      SELECT COUNT(*) as count 
      FROM attendance_days 
      WHERE normal_hours < 0 OR overtime_hours < 0
    `);
    
    if (negativeHours.rows[0]?.count > 0) {
      issues.push({
        type: 'error',
        description: 'Records with negative hours',
        count: parseInt(negativeHours.rows[0].count)
      });
    }

    // Get total records count
    const totalCount = await db.query('SELECT COUNT(*) as count FROM attendance_days');
    
    return {
      tableName: 'attendance_system',
      issues,
      totalRecords: parseInt(totalCount.rows[0]?.count || '0'),
      lastChecked: new Date()
    };

  } catch (error) {
    console.error('Consistency check failed:', error);
    return {
      tableName: 'attendance_system',
      issues: [{
        type: 'error',
        description: `Consistency check failed: ${error}`,
        count: 0
      }],
      totalRecords: 0,
      lastChecked: new Date()
    };
  }
}

/**
 * Check user and company data consistency
 */
export async function checkUserConsistency(): Promise<ConsistencyReport> {
  const issues: ConsistencyReport['issues'] = [];
  
  try {
    // Check for users without companies
    const usersWithoutCompanies = await db.query(`
      SELECT COUNT(*) as count 
      FROM users u 
      WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = u.company_id)
    `);
    
    if (usersWithoutCompanies.rows[0]?.count > 0) {
      issues.push({
        type: 'error',
        description: 'Users without valid company references',
        count: parseInt(usersWithoutCompanies.rows[0].count)
      });
    }

    // Check for duplicate employee numbers within companies
    const duplicateEmpNos = await db.query(`
      SELECT company_id, emp_no, COUNT(*) as count 
      FROM users 
      GROUP BY company_id, emp_no 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateEmpNos.rows.length > 0) {
      issues.push({
        type: 'error',
        description: 'Duplicate employee numbers within companies',
        count: duplicateEmpNos.rows.length
      });
    }

    // Check for invalid leave balances
    const invalidBalances = await db.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE annual_leave_balance < 0 
         OR medical_leave_balance < 0 
         OR emergency_leave_balance < 0 
         OR unpaid_leave_balance < 0
    `);
    
    if (invalidBalances.rows[0]?.count > 0) {
      issues.push({
        type: 'error',
        description: 'Users with negative leave balances',
        count: parseInt(invalidBalances.rows[0].count)
      });
    }

    const totalCount = await db.query('SELECT COUNT(*) as count FROM users');
    
    return {
      tableName: 'users_companies',
      issues,
      totalRecords: parseInt(totalCount.rows[0]?.count || '0'),
      lastChecked: new Date()
    };

  } catch (error) {
    console.error('User consistency check failed:', error);
    return {
      tableName: 'users_companies',
      issues: [{
        type: 'error',
        description: `User consistency check failed: ${error}`,
        count: 0
      }],
      totalRecords: 0,
      lastChecked: new Date()
    };
  }
}

/**
 * Fix assignment synchronization issues
 */
export async function fixAssignmentSyncIssues(): Promise<{
  fixed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let fixed = 0;

  try {
    // Create employee_assignments for schedules with location but no assignment
    const result1 = await db.query(`
      INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, notes, created_at, updated_at)
      SELECT DISTINCT s.user_id, 
             CASE WHEN EXISTS(SELECT 1 FROM sites WHERE name = s.location) THEN s.location ELSE NULL END,
             CASE WHEN EXISTS(SELECT 1 FROM projects WHERE name = s.location) THEN s.location ELSE NULL END,
             MIN(s.date), 
             MAX(s.date),
             'Auto-created from schedule sync',
             CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP
      FROM schedules s 
      WHERE s.location IS NOT NULL 
        AND s.location != ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_assignments ea 
          WHERE ea.user_id = s.user_id 
            AND (ea.start_date IS NULL OR ea.start_date <= s.date)
            AND (ea.end_date IS NULL OR ea.end_date >= s.date)
            AND (ea.site_name = s.location OR ea.project_name = s.location)
        )
      GROUP BY s.user_id, s.location
      ON CONFLICT (user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm) DO NOTHING
    `);
    fixed += result1.rowCount || 0;

    return { fixed, errors };

  } catch (error) {
    errors.push(`Assignment sync fix failed: ${error}`);
    return { fixed, errors };
  }
}

/**
 * Fix common data inconsistencies
 */
export async function fixDataInconsistencies(): Promise<{
  fixed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let fixed = 0;

  try {
    // Fix attendance_days without entries by creating default entries
    const result1 = await db.query(`
      INSERT INTO attendance_entries (user_id, date, site_name, project_name, clock_in_id, clock_out_id)
      SELECT ad.user_id, ad.date, NULL, NULL, ad.clock_in_id, ad.clock_out_id
      FROM attendance_days ad
      WHERE (ad.clock_in_id IS NOT NULL OR ad.clock_out_id IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM attendance_entries ae 
          WHERE ae.user_id = ad.user_id AND ae.date = ad.date
        )
    `);
    fixed += result1.rowCount || 0;

    // Also fix assignment sync issues
    const assignmentFix = await fixAssignmentSyncIssues();
    fixed += assignmentFix.fixed;
    errors.push(...assignmentFix.errors);

    // Recalculate hours for records with inconsistent data
    const daysToRecalculate = await db.query(`
      SELECT DISTINCT user_id, date 
      FROM attendance_days 
      WHERE normal_hours < 0 OR overtime_hours < 0
      LIMIT 100
    `);

    for (const row of daysToRecalculate.rows) {
      try {
        await db.query('SELECT recompute_day_hours($1, $2)', [row.user_id, row.date]);
        fixed++;
      } catch (error) {
        errors.push(`Failed to recalculate hours for user ${row.user_id} on ${row.date}: ${error}`);
      }
    }

    return { fixed, errors };

  } catch (error) {
    errors.push(`Fix operation failed: ${error}`);
    return { fixed, errors };
  }
}

/**
 * Run comprehensive consistency check including assignment sync
 */
export async function runFullConsistencyCheck(): Promise<ConsistencyReport[]> {
  const reports = await Promise.allSettled([
    checkAssignmentSyncConsistency(),
    checkAttendanceConsistency(),
    checkUserConsistency()
  ]);

  return reports.map(result => 
    result.status === 'fulfilled' 
      ? result.value 
      : {
          tableName: 'unknown',
          issues: [{ type: 'error' as const, description: `Check failed: ${result.reason}`, count: 0 }],
          totalRecords: 0,
          lastChecked: new Date()
        }
  );
}
