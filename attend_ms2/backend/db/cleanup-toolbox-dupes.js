require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://openpg:openpgpwd@localhost:5432/attendance_db';
  const pool = new Pool({ connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  try {
    console.log('Connecting to DB:', connectionString);
    await client.query('BEGIN');
    const delSql = `
      WITH ranked AS (
        SELECT id,
               row_number() OVER (
                 PARTITION BY meeting_date,
                              presenter_id,
                              regexp_replace(lower(btrim(coalesce(title,''))), '\\s+', ' ', 'g'),
                              regexp_replace(lower(btrim(coalesce(location,''))), '\\s+', ' ', 'g')
                 ORDER BY updated_at DESC, created_at DESC, id DESC
               ) AS rn
        FROM toolbox_meetings
      )
      DELETE FROM toolbox_meetings tm USING ranked r
      WHERE tm.id = r.id AND r.rn > 1;
    `;
    const res = await client.query(delSql);
    console.log('Duplicate cleanup completed.');
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Cleanup failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
