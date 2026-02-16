
import { getCompanyPool } from './src/multiCompanyDb.js';

async function testFlow() {
    const companyCode = 'AILAB';
    const pool = await getCompanyPool(companyCode);

    // 1. Get valid employee
    const empRes = await pool.query('SELECT "x_Emp_No" FROM hr_employee WHERE active=true LIMIT 1');
    if (empRes.rows.length === 0) {
        console.log("No active employee found");
        return;
    }
    const empNo = empRes.rows[0].x_Emp_No;
    console.log(`Using Employee: ${empNo}`);

    // 2. Simulate Clock In Logic (Direct DB manipulation to match route logic)
    const todaySGT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });

    console.log(`Clocking in for ${todaySGT}...`);
    // Insert Header if needed (simplified)

    // Insert Line
    const insertRes = await pool.query(`
    INSERT INTO employee_clocking_line 
    (attendance_id, employee_id, employee_no, clock_in_date, clock_in, state, is_mobile_clocking, create_date, write_date)
    VALUES 
    (NULL, (SELECT id FROM hr_employee WHERE "x_Emp_No"=$1), $1, $2, '10:00:00', 'draft', 1, NOW(), NOW())
    RETURNING id
  `, [empNo, todaySGT]);

    const lineId = insertRes.rows[0].id;
    console.log(`Inserted Line ID: ${lineId}`);

    // 3. Verify it exists
    const check1 = await pool.query('SELECT * FROM employee_clocking_line WHERE id=$1', [lineId]);
    console.log('After Insert:', check1.rows[0]);

    // 4. Simulate Clock Out Logic
    console.log('Clocking out...');
    await pool.query(`
    UPDATE employee_clocking_line
    SET clock_out = '18:00:00',
        clock_out_date = $2,
        state = 'done',
        write_date = NOW()
    WHERE id = $1
  `, [lineId, todaySGT]);

    // 5. Verify update
    const check2 = await pool.query('SELECT * FROM employee_clocking_line WHERE id=$1', [lineId]);
    console.log('After Update:', check2.rows[0]);

    process.exit(0);
}

testFlow();
