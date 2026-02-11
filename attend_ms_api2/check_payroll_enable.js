import pkg from 'pg';
const { Pool } = pkg;

async function checkPayrollEnable() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'attendance_db',
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('\n=== Companies payroll_enable status ===\n');
    
    const result = await pool.query(
      `SELECT company_code, company_name, payroll_enable FROM companies ORDER BY company_code`
    );

    result.rows.forEach(row => {
      console.log(`${row.company_code}: ${row.company_name} - payroll_enable: ${row.payroll_enable}`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkPayrollEnable();
