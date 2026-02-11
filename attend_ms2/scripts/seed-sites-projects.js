/* Seed sample data for sites, projects, and project_tasks for demo companies. */
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
      { companyCode: 'ACME' },
      { companyCode: 'ABC123' },
    ];

    const results = [];

    for (const t of targets) {
      const comp = await client.query(
        `SELECT id FROM companies WHERE company_code = $1 LIMIT 1`,
        [t.companyCode]
      );
      if (comp.rows.length === 0) { results.push({ ...t, status: 'skipped-no-company' }); continue; }
      const companyId = comp.rows[0].id;

      // Upsert multiple sites
      const siteDefs = [
        { code: 'SITE-WH', name: 'Main Warehouse', addr: '123 Industrial Ave', lat: 12.9716, lon: 77.5946 },
        { code: 'SITE-HQ', name: 'Head Office', addr: '456 Corporate Blvd', lat: 28.6139, lon: 77.2090 },
      ];
      const siteIds = [];
      for (const s of siteDefs) {
        const sRes = await client.query(
          `INSERT INTO sites (company_id, code, name, address, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
           RETURNING id, name, code`,
          [companyId, s.code, s.name, s.addr, s.lat, s.lon]
        );
        siteIds.push({ id: sRes.rows[0].id, code: s.code, name: sRes.rows[0].name });
      }

      // Upsert multiple projects (some linked to site, some standalone)
      const projDefs = [
        { code: 'PRJ-AUDIT', name: 'Safety Audit', desc: 'Monthly safety audit', siteCode: 'SITE-WH', days: 21 },
        { code: 'PRJ-RENOV', name: 'HQ Renovation', desc: 'Renovation of HQ floor 3', siteCode: 'SITE-HQ', days: 45 },
        { code: 'PRJ-TRAIN', name: 'Training Program', desc: 'Q4 safety training program', siteCode: null, days: 30 },
      ];
      const projectRows = [];
      for (const p of projDefs) {
        const siteId = p.siteCode ? siteIds.find(x => x.code === p.siteCode)?.id : null;
        const pRes = await client.query(
          `INSERT INTO projects (company_id, site_id, code, name, description, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_DATE + ($6 || ' days')::interval, 'active')
           ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
           RETURNING id, name, code`,
          [companyId, siteId, p.code, p.name, p.desc, String(p.days)]
        );
        const projectId = pRes.rows[0].id;
        projectRows.push(pRes.rows[0]);

        // Ensure tasks exist for each project
        const taskCount = await client.query(`SELECT COUNT(1) FROM project_tasks WHERE project_id = $1`, [projectId]);
        if (Number(taskCount.rows[0].count) === 0) {
          await client.query(
            `INSERT INTO project_tasks (project_id, name, description, start_date, due_date, status)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'in-progress')`,
            [projectId, `${p.name}: Kickoff`, `Start and plan for ${p.name}`]
          );
          await client.query(
            `INSERT INTO project_tasks (project_id, name, description, start_date, due_date, status)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'pending')`,
            [projectId, `${p.name}: Milestone 1`, `First milestone tasks for ${p.name}`]
          );
          await client.query(
            `INSERT INTO project_tasks (project_id, name, description, start_date, due_date, status)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '28 days', 'pending')`,
            [projectId, `${p.name}: Review`, `Review and QA for ${p.name}`]
          );
        }
      }

      results.push({ ...t, status: 'seeded', sites: siteIds, projects: projectRows });
    }

    await client.query('COMMIT');
    console.log('[seed-sites-projects] done:', results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-sites-projects] error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
