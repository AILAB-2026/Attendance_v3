/**
 * Database Assignment Checker
 * Verifies employee assignments for clock-in
 * Run: node check-assignments.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkAssignments() {
  console.log('=== Database Assignment Check ===\n');

  try {
    // 1. Check if assignment check is enabled
    const skipCheck = String(process.env.SKIP_ASSIGNMENT_CHECK || '').toLowerCase() === 'true';
    console.log('Assignment Check Status:', skipCheck ? '❌ DISABLED' : '✅ ENABLED');
    
    if (skipCheck) {
      console.log('⚠️  SKIP_ASSIGNMENT_CHECK=true - Assignments are not enforced\n');
    }

    // 2. Get all active users
    console.log('\n1. Active Users:');
    const usersResult = await pool.query(`
      SELECT u.id, u.emp_no, u.name, c.company_code, u.is_active
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE u.is_active = true
      ORDER BY c.company_code, u.emp_no
      LIMIT 20
    `);

    console.log(`   Found ${usersResult.rows.length} active users\n`);
    usersResult.rows.forEach(user => {
      console.log(`   - ${user.company_code}/${user.emp_no}: ${user.name}`);
    });

    // 3. Check assignments for today
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n2. Assignments for Today (${today}):`);
    
    const assignmentsResult = await pool.query(`
      SELECT 
        u.emp_no,
        u.name,
        c.company_code,
        ea.site_name,
        ea.project_name,
        ea.start_date,
        ea.end_date
      FROM employee_assignments ea
      JOIN users u ON u.id = ea.user_id
      JOIN companies c ON c.id = u.company_id
      WHERE u.is_active = true
        AND (ea.start_date IS NULL OR ea.start_date <= $1::date)
        AND (ea.end_date IS NULL OR ea.end_date >= $1::date)
      ORDER BY c.company_code, u.emp_no, ea.site_name
    `, [today]);

    if (assignmentsResult.rows.length === 0) {
      console.log('   ⚠️  No assignments found for today!');
      console.log('   This means users cannot clock in (if assignment check is enabled)\n');
    } else {
      console.log(`   Found ${assignmentsResult.rows.length} assignments:\n`);
      assignmentsResult.rows.forEach(assignment => {
        const site = assignment.site_name || '(no site)';
        const project = assignment.project_name || '(no project)';
        const dateRange = `${assignment.start_date || 'open'} to ${assignment.end_date || 'open'}`;
        console.log(`   - ${assignment.company_code}/${assignment.emp_no} (${assignment.name})`);
        console.log(`     Site: ${site}, Project: ${project}`);
        console.log(`     Period: ${dateRange}\n`);
      });
    }

    // 4. Check for users with face registration
    console.log('3. Face Registration Status:');
    const faceResult = await pool.query(`
      SELECT 
        u.emp_no,
        u.name,
        c.company_code,
        CASE WHEN uf.user_id IS NOT NULL THEN 'Registered' ELSE 'Not Registered' END as face_status,
        uf.template_version
      FROM users u
      JOIN companies c ON c.id = u.company_id
      LEFT JOIN user_faces uf ON uf.user_id = u.id
      WHERE u.is_active = true
      ORDER BY c.company_code, u.emp_no
      LIMIT 20
    `);

    console.log(`   Checking ${faceResult.rows.length} users:\n`);
    faceResult.rows.forEach(user => {
      const icon = user.face_status === 'Registered' ? '✅' : '❌';
      console.log(`   ${icon} ${user.company_code}/${user.emp_no}: ${user.name} - ${user.face_status}`);
      if (user.template_version) {
        console.log(`      Template: ${user.template_version}`);
      }
    });

    // 5. Check recent clock events
    console.log('\n4. Recent Clock Events (Last 24 hours):');
    const eventsResult = await pool.query(`
      SELECT 
        u.emp_no,
        u.name,
        ce.type,
        ce.method,
        ce.site_name,
        ce.project_name,
        to_timestamp(ce.timestamp/1000) as event_time
      FROM clock_events ce
      JOIN users u ON u.id = ce.user_id
      WHERE ce.timestamp > $1
      ORDER BY ce.timestamp DESC
      LIMIT 10
    `, [Date.now() - 24 * 60 * 60 * 1000]);

    if (eventsResult.rows.length === 0) {
      console.log('   No recent clock events found\n');
    } else {
      console.log(`   Found ${eventsResult.rows.length} recent events:\n`);
      eventsResult.rows.forEach(event => {
        const site = event.site_name || '(no site)';
        const project = event.project_name || '(no project)';
        console.log(`   - ${event.emp_no} (${event.name}): ${event.type.toUpperCase()}`);
        console.log(`     Method: ${event.method}, Site: ${site}, Project: ${project}`);
        console.log(`     Time: ${event.event_time}\n`);
      });
    }

    // 6. Recommendations
    console.log('\n=== Recommendations ===');
    
    if (skipCheck) {
      console.log('⚠️  Assignment check is DISABLED');
      console.log('   Set SKIP_ASSIGNMENT_CHECK=false to enforce assignments');
    }
    
    if (assignmentsResult.rows.length === 0 && !skipCheck) {
      console.log('❌ No assignments found - users cannot clock in!');
      console.log('   Solution: Add assignments in the database or disable assignment check');
    }
    
    const unregisteredFaces = faceResult.rows.filter(u => u.face_status === 'Not Registered');
    if (unregisteredFaces.length > 0) {
      console.log(`⚠️  ${unregisteredFaces.length} users without face registration`);
      console.log('   They cannot use face recognition for clock-in');
    }

  } catch (error) {
    console.error('\n❌ Database check failed!');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('  1. Database is not running');
    console.error('  2. DATABASE_URL is incorrect');
    console.error('  3. Tables are not created');
  } finally {
    await pool.end();
  }
}

// Run check
checkAssignments().catch(console.error);
