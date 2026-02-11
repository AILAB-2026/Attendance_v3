/* Show sites, projects, and project_tasks grouped by companyCode. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();
  try {
    const companyCodes = process.argv.slice(2);
    const where = companyCodes.length ? `WHERE c.company_code = ANY($1)` : '';
    const params = companyCodes.length ? [companyCodes] : [];

    const rows = await client.query(
`SELECT c.company_code,
        s.id as site_id, s.code as site_code, s.name as site_name,
        p.id as project_id, p.code as project_code, p.name as project_name,
        t.id as task_id, t.name as task_name, t.status as task_status
   FROM companies c
   LEFT JOIN sites s ON s.company_id = c.id
   LEFT JOIN projects p ON p.company_id = c.id AND (p.site_id IS NULL OR p.site_id = s.id)
   LEFT JOIN project_tasks t ON t.project_id = p.id
   ${where}
   ORDER BY c.company_code, s.name NULLS LAST, p.name NULLS LAST, t.name NULLS LAST`, params);

    const grouped = {};
    for (const r of rows.rows) {
      const cc = r.company_code || 'UNKNOWN';
      grouped[cc] ||= { sites: {}, projects: {}, tasks: [] };
      if (r.site_id) {
        grouped[cc].sites[r.site_id] = { id: r.site_id, code: r.site_code, name: r.site_name };
      }
      if (r.project_id) {
        grouped[cc].projects[r.project_id] = { id: r.project_id, code: r.project_code, name: r.project_name };
      }
      if (r.task_id) {
        grouped[cc].tasks.push({ id: r.task_id, name: r.task_name, status: r.task_status, projectId: r.project_id });
      }
    }

    const out = Object.fromEntries(Object.entries(grouped).map(([cc, v]) => [cc, {
      sites: Object.values(v.sites),
      projects: Object.values(v.projects),
      tasks: v.tasks,
    }]));
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('[show-sites-projects] error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
