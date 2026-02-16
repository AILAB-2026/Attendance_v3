/* Seed sample site/project assignments for demo users if they exist. */
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

    const targets = [
      { companyCode: 'ABC123', empNo: 'E001' },
      { companyCode: 'ABC123', empNo: 'E12345' },
    ];

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const results = [];

    for (const t of targets) {
      const userRes = await client.query(
        `SELECT u.id as user_id
           FROM users u
           JOIN companies c ON c.id = u.company_id
          WHERE c.company_code = $1 AND u.emp_no = $2
          LIMIT 1`,
        [t.companyCode, t.empNo]
      );
      if (userRes.rows.length === 0) {
        results.push({ target: t, status: 'skipped-no-user' });
        continue;
      }
      const userId = userRes.rows[0].user_id;

      // Helper date util
      const toYMD = (dt) => {
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };
      const addDays = (dt, n) => { const d2 = new Date(dt); d2.setDate(d2.getDate() + n); return d2; };

      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endStr = toYMD(endOfMonth);

      // Multiple site-only assignments (past, active, upcoming)
      await client.query(
        `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, notes)
         VALUES ($1, $2, NULL, $3::date, $4::date, $5)
         ON CONFLICT DO NOTHING`,
        [userId, 'Main Warehouse', toYMD(addDays(today, -14)), toYMD(addDays(today, -7)), 'Past site assignment']
      );
      await client.query(
        `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, notes)
         VALUES ($1, $2, NULL, $3::date, NULL, $4)
         ON CONFLICT DO NOTHING`,
        [userId, 'Main Warehouse', todayStr, 'Active site assignment']
      );
      await client.query(
        `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, notes)
         VALUES ($1, $2, NULL, $3::date, $4::date, $5)
         ON CONFLICT DO NOTHING`,
        [userId, 'Head Office', toYMD(addDays(today, 7)), toYMD(addDays(today, 21)), 'Upcoming site assignment']
      );

      // Multiple project-only assignments (ensure they exist from seed-sites-projects)
      const projNames = ['Safety Audit', 'HQ Renovation', 'Training Program'];
      for (let i = 0; i < projNames.length; i++) {
        const pName = projNames[i];
        const start = addDays(today, i === 0 ? 0 : (i === 1 ? -10 : 10));
        const end = addDays(start, 20);
        await client.query(
          `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, notes)
           VALUES ($1, NULL, $2, $3::date, $4::date, $5)
           ON CONFLICT DO NOTHING`,
          [userId, pName, toYMD(start), toYMD(end), `${pName} assignment`]
        );
      }

      // Combined assignment example
      await client.query(
        `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, notes)
         VALUES ($1, $2, $3, $4::date, $5::date, $6)
         ON CONFLICT DO NOTHING`,
        [userId, 'Main Warehouse', 'Safety Audit', todayStr, endStr, 'Combined site+project assignment']
      );
      results.push({ target: t, status: 'inserted-multi' });
    }

    await client.query('COMMIT');
    console.log('[seed-assignments] done:', results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-assignments] error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
