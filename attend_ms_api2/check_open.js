/**
 * Check open clockings from yesterday
 */

import { getCompanyPool } from './src/multiCompanyDb.js';

async function check() {
    try {
        const pool = await getCompanyPool('SKK');

        // Check open records from yesterday (Jan 12)
        const result = await pool.query(`
      SELECT 
        ecl.id,
        he.name as employee_name,
        he."x_Emp_No" as emp_no,
        ecl.clock_in,
        ecl.clock_in_date,
        ecl.site_name,
        ecl.project_name
      FROM employee_clocking_line ecl
      LEFT JOIN hr_employee he ON ecl.employee_id = he.id
      WHERE ecl.clock_out IS NULL
        AND ecl.clock_in_date = '2026-01-12'::date
      ORDER BY ecl.clock_in_date, ecl.clock_in
    `);

        console.log('Open clockings from 2026-01-12:', result.rows.length);
        console.log(JSON.stringify(result.rows, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit(0);
}

check();
