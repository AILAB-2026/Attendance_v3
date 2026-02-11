/* Seed DB: baseline company, users (employee + manager/admin), and a sample leave */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/attendance_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Company
    const companyCode = process.env.SEED_COMPANY_CODE || 'ACME';
    const companyName = process.env.SEED_COMPANY_NAME || 'Acme Corp';
    const companyRes = await client.query(
      `INSERT INTO companies (company_code, company_name)
       VALUES ($1, $2)
       ON CONFLICT (company_code) DO UPDATE SET company_name = EXCLUDED.company_name
       RETURNING id`,
      [companyCode, companyName]
    );
    const companyId = companyRes.rows[0].id;

    // Plaintext password for dev environments
    const plainPassword = process.env.SEED_PLAIN_PASSWORD || 'password123';

    // Manager/admin user
    const mgrEmpNo = process.env.SEED_MANAGER_EMP_NO || 'M001';
    const mgrEmail = process.env.SEED_MANAGER_EMAIL || 'manager@example.com';
    const mgrName = process.env.SEED_MANAGER_NAME || 'Mark Manager';
    const mgrRole = process.env.SEED_MANAGER_ROLE || 'manager'; // or 'admin'

    const mgrRes = await client.query(
      `INSERT INTO users (company_id, emp_no, name, email, password, role,
                          annual_leave_balance, medical_leave_balance, emergency_leave_balance, unpaid_leave_balance)
       VALUES ($1, $2, $3, $4, $5, $6, 15, 10, 5, 0)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
       RETURNING id`,
      [companyId, mgrEmpNo, mgrName, mgrEmail, plainPassword, mgrRole]
    );
    const managerId = mgrRes.rows[0].id;

    // Employee user
    const empEmpNo = process.env.SEED_EMP_EMP_NO || 'E001';
    const empEmail = process.env.SEED_EMP_EMAIL || 'employee@example.com';
    const empName = process.env.SEED_EMP_NAME || 'Alice Employee';

    const empRes = await client.query(
      `INSERT INTO users (company_id, emp_no, name, email, password, role,
                          annual_leave_balance, medical_leave_balance, emergency_leave_balance, unpaid_leave_balance)
       VALUES ($1, $2, $3, $4, $5, 'employee', 10, 5, 2, 0)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [companyId, empEmpNo, empName, empEmail, plainPassword]
    );
    const employeeId = empRes.rows[0].id;

    // Set company policy defaults if missing
    await client.query(
      `UPDATE companies
         SET work_start_time = COALESCE(work_start_time, '09:00'),
             work_end_time = COALESCE(work_end_time, '18:00'),
             work_hours_per_day = COALESCE(work_hours_per_day, 8)
       WHERE id = $1`,
      [companyId]
    );

    // Sample pending leave for employee
    const startDate = process.env.SEED_LEAVE_START || '2025-08-25';
    const endDate = process.env.SEED_LEAVE_END || '2025-08-26';
    const leaveType = process.env.SEED_LEAVE_TYPE || 'annual';
    const leaveReason = process.env.SEED_LEAVE_REASON || 'Family event';

    await client.query(
      `INSERT INTO leaves (user_id, start_date, end_date, type, reason, status)
       VALUES ($1, $2::date, $3::date, $4, $5, 'pending')
       ON CONFLICT DO NOTHING`,
      [employeeId, startDate, endDate, leaveType, leaveReason]
    );

    await client.query('COMMIT');
    console.log('[seed-db] Seed completed:', { companyCode, managerEmpNo: mgrEmpNo, employeeEmpNo: empEmpNo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-db] Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
