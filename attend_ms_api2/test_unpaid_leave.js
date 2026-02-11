import { getCompanyPool } from './src/multiCompanyDb.js';

async function test() {
  try {
    console.log('🔍 Looking for employee TEST-001 in SKK database...\n');

    // Get the company pool using the same method as the API
    const pool = await getCompanyPool('SKK');

    // First find the employee
    const empRes = await pool.query(`
      SELECT id, "x_Emp_No", name 
      FROM hr_employee 
      WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM('TEST-001'))
    `);

    if (empRes.rows.length === 0) {
      console.log('❌ Employee TEST-001 not found');
      return;
    }

    const employee = empRes.rows[0];
    console.log('✅ Found employee:', employee);

    // Get all leave allocations for this employee
    console.log('\n📋 ALL Leave allocations for employee ID ' + employee.id + ':\n');

    const allocRes = await pool.query(`
      SELECT 
        hla.id,
        hla.name as leave_type_name,
        hla.number_of_days,
        hla.state,
        hla.date_from,
        hla.date_to,
        hlt.name as leave_type_full
      FROM hr_leave_allocation hla
      LEFT JOIN hr_leave_type hlt ON hla.holiday_status_id = hlt.id
      WHERE hla.employee_id = $1
      ORDER BY hla.id DESC
    `, [employee.id]);

    console.log('Total allocations:', allocRes.rows.length);
    allocRes.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ID: ${row.id}`);
      console.log(`     Name: "${row.leave_type_name}"`);
      console.log(`     Days: ${row.number_of_days}`);
      console.log(`     State: ${row.state}`);
      console.log(`     Date From: ${row.date_from}`);
      console.log(`     Date To: ${row.date_to}`);
      console.log(`     Leave Type (from hr_leave_type): ${JSON.stringify(row.leave_type_full)}`);

      // Check if it matches 'unpaid'
      const name = (row.leave_type_name || '').toLowerCase();
      console.log(`     Contains 'unpaid': ${name.includes('unpaid')}`);
      console.log('');
    });

    // Now simulate the profile query (same as userRoutes.js)
    console.log('\n📊 Simulating profile query leave balance calculation (only valid allocations)...\n');

    const balanceQuery = `
      WITH leave_allocations AS (
        SELECT 
          hla.employee_id,
          hla.holiday_status_id,
          hla.name as leave_type_name,
          hla.number_of_days as allocated_days,
          hla.state,
          hla.date_from,
          hla.date_to
        FROM hr_leave_allocation hla
        WHERE hla.employee_id = $1
          AND hla.state = 'validate'
          AND CURRENT_DATE >= hla.date_from 
          AND (hla.date_to IS NULL OR CURRENT_DATE <= hla.date_to)
      ),
      leave_taken AS (
        SELECT 
          hl.employee_id,
          hl.holiday_status_id,
          COALESCE(SUM(hl.number_of_days), 0) as taken_days
        FROM hr_leave hl
        WHERE hl.employee_id = $1
          AND hl.state IN ('validate', 'confirm')
        GROUP BY hl.employee_id, hl.holiday_status_id
      )
      SELECT 
        la.leave_type_name,
        la.state,
        la.date_from,
        la.date_to,
        SUM(la.allocated_days) as allocated,
        COALESCE(SUM(la.allocated_days), 0) - COALESCE(lt.taken_days, 0) as balance
      FROM leave_allocations la
      LEFT JOIN leave_taken lt ON la.employee_id = lt.employee_id 
        AND la.holiday_status_id = lt.holiday_status_id
      GROUP BY la.leave_type_name, la.state, la.date_from, la.date_to, lt.taken_days;
    `;

    const balanceRes = await pool.query(balanceQuery, [employee.id]);

    console.log('Balance query results (filtered by state=validate and date range):');
    if (balanceRes.rows.length === 0) {
      console.log('  ❌ No valid allocations found!');
    }
    balanceRes.rows.forEach(row => {
      console.log(`  "${row.leave_type_name}": ${row.balance} days (allocated: ${row.allocated}, state: ${row.state}, from: ${row.date_from}, to: ${row.date_to})`);

      const leaveTypeName = (row.leave_type_name || '').toLowerCase();
      if (leaveTypeName.includes('unpaid')) {
        console.log('    ✅ This would be mapped to "unpaid" balance');
      }
    });

    // Check today's date for debugging
    const todayRes = await pool.query(`SELECT CURRENT_DATE as today`);
    console.log('\n📅 Current date in database:', todayRes.rows[0].today);

  } catch (e) {
    console.error('Error:', e);
  }
}

test();
