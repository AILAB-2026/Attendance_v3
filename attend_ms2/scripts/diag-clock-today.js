const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const userId = 'USR_EMP001';
  const today = new Date().toISOString().slice(0,10);
  try {
    console.log('=== Diagnostic for', userId, 'date', today, '===');

    const days = await db.query('SELECT * FROM attendance_days WHERE user_id = $1 AND date = $2', [userId, today]);
    console.log('\nattendance_days:', days.rows);

    const entries = await db.query('SELECT * FROM attendance_entries WHERE user_id = $1 AND date = $2 ORDER BY site_name NULLS FIRST, project_name NULLS FIRST', [userId, today]);
    console.log('\nattendance_entries:', entries.rows);

    const startTs = Date.parse(today + 'T00:00:00Z');
    const endTs = Date.parse(today + 'T23:59:59Z');
    const events = await db.query('SELECT * FROM clock_events WHERE user_id = $1 AND timestamp >= $2 AND timestamp < $3 ORDER BY timestamp', [userId, startTs, endTs]);
    console.log('\nclock_events:', events.rows);

    // Check if an open interval exists for Head Office / HQ Renovation
    const openEntry = await db.query(
      `SELECT * FROM attendance_entries 
       WHERE user_id = $1 AND date = $2 
         AND COALESCE(site_name,'') IS NOT DISTINCT FROM COALESCE($3,'')
         AND COALESCE(project_name,'') IS NOT DISTINCT FROM COALESCE($4,'')
         AND clock_in_id IS NOT NULL AND clock_out_id IS NULL`,
      [userId, today, 'Head Office', 'HQ Renovation']
    );
    console.log('\nopen interval for Head Office / HQ Renovation:', openEntry.rows);
  } catch (e) {
    console.error('Diagnostic failed:', e);
  } finally {
    await db.end();
  }
}

run();
