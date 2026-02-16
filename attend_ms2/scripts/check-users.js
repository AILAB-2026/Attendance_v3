require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/attendance_db',
    ssl: false,
  });
  const client = await pool.connect();
  try {
    console.log('Connected. Checking companies and users...');

    const companies = await client.query('SELECT id, company_code, company_name, is_active FROM companies ORDER BY company_code');
    console.log('Companies:', companies.rows);

    const users = await client.query('SELECT id, emp_no, email, role, is_active FROM users ORDER BY emp_no LIMIT 20');
    console.log('Users (first 20):', users.rows);

    // Check if a common dev user exists
    const devUserEmpNo = process.env.SEED_EMP_EMP_NO || 'E001';
    const devCompanyCode = (process.env.SEED_COMPANY_CODE || 'ACME').toUpperCase();
    const res = await client.query(
      `SELECT u.id, u.emp_no, u.email, u.role, c.company_code
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.emp_no = $1 AND c.company_code = $2`,
      [devUserEmpNo, devCompanyCode]
    );
    console.log(`Lookup ${devCompanyCode}/${devUserEmpNo}:`, res.rows);
  } catch (e) {
    console.error('Check failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
})();
