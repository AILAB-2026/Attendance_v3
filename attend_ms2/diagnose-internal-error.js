/**
 * Diagnose "Internal Error" during clock-in
 * Run: node diagnose-internal-error.js
 */

const { Pool } = require('pg');
// Load .env (same as backend does)
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diagnoseInternalError() {
  console.log('=== Diagnosing Clock-In Internal Error ===\n');

  try {
    // 1. Test database connection
    console.log('1. Testing database connection...');
    try {
      await pool.query('SELECT NOW()');
      console.log('   ✅ Database connection OK\n');
    } catch (err) {
      console.log('   ❌ Database connection FAILED');
      console.log('   Error:', err.message);
      console.log('   Check DATABASE_URL in .env.production\n');
      return;
    }

    // 2. Check if record_clock_event function exists
    console.log('2. Checking record_clock_event function...');
    const funcCheck = await pool.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname = 'record_clock_event'
    `);
    
    if (funcCheck.rows.length === 0) {
      console.log('   ❌ Function record_clock_event NOT FOUND');
      console.log('   Action: Run database migration to create function');
      console.log('   File: backend/db/functions.sql\n');
      return;
    } else {
      console.log('   ✅ Function exists');
      console.log(`   Parameters: ${funcCheck.rows[0].pronargs}\n`);
    }

    // 3. Test calling the function with sample data
    console.log('3. Testing record_clock_event function...');
    
    // Get a test user
    const userRes = await pool.query(`
      SELECT u.id, u.emp_no, u.name, c.company_code
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE u.is_active = true
      LIMIT 1
    `);

    if (userRes.rows.length === 0) {
      console.log('   ❌ No active users found in database\n');
      return;
    }

    const testUser = userRes.rows[0];
    console.log(`   Using test user: ${testUser.company_code}/${testUser.emp_no} (${testUser.name})`);

    // Try to call the function
    try {
      const testResult = await pool.query(`
        SELECT record_clock_event(
          $1::varchar,  -- user_id
          $2::bigint,   -- timestamp
          $3::varchar,  -- type
          $4::decimal,  -- latitude
          $5::decimal,  -- longitude
          $6::text,     -- address
          $7::varchar,  -- method
          $8::text,     -- image_uri
          $9::decimal,  -- accuracy
          $10::varchar, -- site_name
          $11::varchar  -- project_name
        ) AS event_id
      `, [
        testUser.id,
        Date.now(),
        'in',
        3.1390,
        101.6869,
        'Test Location',
        'button',
        null,
        null,
        'TNJ - OFFICE',
        'AI LAB'
      ]);

      console.log('   ✅ Function call succeeded');
      console.log(`   Event ID: ${testResult.rows[0]?.event_id}\n`);

      // Clean up test data
      await pool.query('DELETE FROM clock_events WHERE id = $1', [testResult.rows[0]?.event_id]);
      console.log('   ✅ Test data cleaned up\n');

    } catch (funcErr) {
      console.log('   ❌ Function call FAILED');
      console.log('   Error Code:', funcErr.code);
      console.log('   Error Message:', funcErr.message);
      console.log('   Error Detail:', funcErr.detail || 'N/A');
      console.log('   Error Hint:', funcErr.hint || 'N/A');
      console.log();

      // Specific error diagnostics
      if (funcErr.message.includes('does not exist')) {
        console.log('   💡 Diagnosis: Function or table does not exist');
        console.log('   Action: Run database migrations');
        console.log('   Commands:');
        console.log('     cd backend/db');
        console.log('     psql $DATABASE_URL -f schema.sql');
        console.log('     psql $DATABASE_URL -f functions.sql\n');
      } else if (funcErr.message.includes('permission')) {
        console.log('   💡 Diagnosis: Database permission issue');
        console.log('   Action: Grant permissions to database user\n');
      } else if (funcErr.message.includes('duplicate')) {
        console.log('   💡 Diagnosis: Duplicate clock-in prevention working');
        console.log('   This is expected behavior, not an error\n');
      } else {
        console.log('   💡 Diagnosis: Unknown database error');
        console.log('   Action: Check backend logs for more details\n');
      }
    }

    // 4. Check required tables exist
    console.log('4. Checking required tables...');
    const tables = ['clock_events', 'attendance_entries', 'attendance_days', 'users', 'user_faces'];
    
    for (const table of tables) {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      const exists = tableCheck.rows[0].exists;
      if (exists) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING`);
      }
    }
    console.log();

    // 5. Check environment variables
    console.log('5. Checking environment variables...');
    const envVars = {
      'DATABASE_URL': process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      'SKIP_ASSIGNMENT_CHECK': process.env.SKIP_ASSIGNMENT_CHECK || 'false',
      'FACE_ENFORCE_STRICT': process.env.FACE_ENFORCE_STRICT || 'true',
      'FACE_USE_AI_VERIFIER': process.env.FACE_USE_AI_VERIFIER || 'false',
    };

    for (const [key, value] of Object.entries(envVars)) {
      console.log(`   ${key}: ${value}`);
    }
    console.log();

    // 6. Check recent errors in clock_events
    console.log('6. Checking recent clock event attempts...');
    const recentEvents = await pool.query(`
      SELECT 
        u.emp_no,
        ce.type,
        ce.method,
        to_timestamp(ce.timestamp/1000) as time,
        ce.site_name,
        ce.project_name
      FROM clock_events ce
      JOIN users u ON u.id = ce.user_id
      WHERE ce.timestamp > extract(epoch from NOW() - interval '1 hour') * 1000
      ORDER BY ce.timestamp DESC
      LIMIT 5
    `);

    if (recentEvents.rows.length === 0) {
      console.log('   ⚠️  No clock events in last hour');
      console.log('   This might indicate the function is failing before inserting\n');
    } else {
      console.log(`   Found ${recentEvents.rows.length} recent events:\n`);
      recentEvents.rows.forEach(event => {
        console.log(`   - ${event.emp_no}: ${event.type.toUpperCase()} via ${event.method}`);
        console.log(`     Time: ${event.time}`);
        console.log(`     Site: ${event.site_name || '(none)'}, Project: ${event.project_name || '(none)'}\n`);
      });
    }

    // 7. Recommendations
    console.log('=== RECOMMENDATIONS ===\n');
    
    console.log('To see the actual error in production:');
    console.log('1. Check backend logs:');
    console.log('   pm2 logs aiattend-backend --lines 100');
    console.log('   OR');
    console.log('   tail -f /path/to/backend/logs\n');
    
    console.log('2. Look for this line:');
    console.log('   "clock event error:" followed by error details\n');
    
    console.log('3. Common causes of "Internal error":');
    console.log('   - Database function missing or outdated');
    console.log('   - Required table missing');
    console.log('   - Database connection lost');
    console.log('   - Invalid data types in parameters');
    console.log('   - Database constraint violation\n');

    console.log('4. Quick fixes:');
    console.log('   - Restart backend: pm2 restart aiattend-backend');
    console.log('   - Check database: psql $DATABASE_URL');
    console.log('   - Review migrations: cd backend/db && ls -la\n');

  } catch (error) {
    console.error('\n❌ Diagnostic failed!');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run diagnostics
console.log('Starting diagnostics...\n');
diagnoseInternalError().catch(console.error);
