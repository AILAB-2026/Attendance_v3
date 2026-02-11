const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://openpg:openpgpwd@localhost:5432/attendance_db';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  const sql = `
    INSERT INTO employee_assignments (
      user_id,
      site_name,
      project_name,
      start_date,
      end_date,
      assigned_by,
      created_at,
      updated_at
    )
    VALUES (
      (SELECT id FROM users WHERE emp_no = 'E001' AND company_id = (SELECT id FROM companies WHERE company_code = 'ABC123')),
      'Head Office',
      'HQ Renovation',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      (SELECT id FROM users WHERE emp_no = 'E001' AND company_id = (SELECT id FROM companies WHERE company_code = 'ABC123')),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT DO NOTHING;
  `;

  try {
    await client.query(sql);
    console.log('Assignment inserted (or already existed).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to insert assignment:', err);
  process.exit(1);
});
