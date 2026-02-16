/* 
 * Sync existing schedules with employee_assignments table
 * This script creates employee_assignments for existing schedules that have location data
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('[sync-assignments] Starting assignment synchronization...');
    
    // Step 1: Find schedules with location but no corresponding employee_assignments
    const orphanedSchedules = await client.query(`
      SELECT DISTINCT s.user_id, s.location, MIN(s.date) as start_date, MAX(s.date) as end_date, COUNT(*) as schedule_count
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
      ORDER BY s.user_id, s.location
    `);
    
    console.log(`[sync-assignments] Found ${orphanedSchedules.rows.length} schedule groups without assignments`);
    
    let created = 0;
    let errors = 0;
    
    // Step 2: Create employee_assignments for each orphaned schedule group
    for (const schedule of orphanedSchedules.rows) {
      try {
        // Check if location is a site or project
        const siteCheck = await client.query('SELECT 1 FROM sites WHERE name = $1 LIMIT 1', [schedule.location]);
        const projectCheck = await client.query('SELECT 1 FROM projects WHERE name = $1 LIMIT 1', [schedule.location]);
        
        const siteName = siteCheck.rows.length > 0 ? schedule.location : null;
        const projectName = projectCheck.rows.length > 0 ? schedule.location : null;
        
        // If neither site nor project exists, treat as site
        const finalSiteName = siteName || (!projectName ? schedule.location : null);
        const finalProjectName = projectName;
        
        await client.query(`
          INSERT INTO employee_assignments (
            user_id, site_name, project_name, start_date, end_date, 
            notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm) 
          DO NOTHING
        `, [
          schedule.user_id,
          finalSiteName,
          finalProjectName,
          schedule.start_date,
          schedule.end_date,
          `Auto-synced from ${schedule.schedule_count} schedule(s)`
        ]);
        
        created++;
        console.log(`[sync-assignments] Created assignment for user ${schedule.user_id} at ${schedule.location} (${schedule.start_date} to ${schedule.end_date})`);
        
      } catch (error) {
        errors++;
        console.error(`[sync-assignments] Error creating assignment for user ${schedule.user_id} at ${schedule.location}:`, error.message);
      }
    }
    
    // Step 3: Report on assignments without schedules (informational)
    const assignmentsWithoutSchedules = await client.query(`
      SELECT ea.user_id, ea.site_name, ea.project_name, ea.start_date, ea.end_date
      FROM employee_assignments ea 
      WHERE NOT EXISTS (
        SELECT 1 FROM schedules s 
        WHERE s.user_id = ea.user_id 
          AND s.date BETWEEN COALESCE(ea.start_date, s.date) AND COALESCE(ea.end_date, s.date)
          AND (s.location = ea.site_name OR s.location = ea.project_name)
      )
      AND (ea.start_date <= CURRENT_DATE AND COALESCE(ea.end_date, CURRENT_DATE) >= CURRENT_DATE)
      LIMIT 10
    `);
    
    if (assignmentsWithoutSchedules.rows.length > 0) {
      console.log(`[sync-assignments] Found ${assignmentsWithoutSchedules.rows.length} active assignments without corresponding schedules (this may be normal)`);
    }
    
    await client.query('COMMIT');
    
    console.log(`[sync-assignments] Synchronization complete:`);
    console.log(`  - Created: ${created} assignments`);
    console.log(`  - Errors: ${errors}`);
    console.log(`  - Orphaned schedules processed: ${orphanedSchedules.rows.length}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[sync-assignments] Fatal error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
