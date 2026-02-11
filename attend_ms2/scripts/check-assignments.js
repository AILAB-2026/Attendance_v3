const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://openpg:openpgpwd@localhost:5432/attendance_db';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  const sql = `
    SELECT ea.id, ea.site_name, ea.project_name, ea.start_date, ea.end_date
    FROM employee_assignments ea
    JOIN users u ON u.id = ea.user_id
    JOIN companies c ON c.id = u.company_id
    WHERE u.emp_no = 'E001' AND c.company_code = 'ABC123'
    ORDER BY ea.created_at DESC
    LIMIT 5;
  `;

  const res = await client.query(sql);
  console.log('Assignments for E001:');
  for (const row of res.rows) {
    console.log(row);
  }
  await client.end();
}

main().catch((err) => {
  console.error('Failed to fetch assignments:', err);
  process.exit(1);
});
