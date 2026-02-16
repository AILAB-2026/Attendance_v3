import dotenv from 'dotenv';
import { query } from './src/dbconn.js';

// Load environment variables
dotenv.config();

const employeeNo = 'B1-E079';
const companyCode = '1';

// Promisified query function
const queryPromise = (queryText, params) => {
  return new Promise((resolve, reject) => {
    query(queryText, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

async function testEmployeeData() {
  console.log('='.repeat(60));
  console.log('Testing Employee Data for:', employeeNo);
  console.log('='.repeat(60));

  try {
    // 1. Check employee exists
    console.log('\n1. Checking employee in hr_employee table...');
    const empResult = await queryPromise(
      `SELECT id, name, "x_Emp_No", company_id, active FROM hr_employee WHERE "x_Emp_No" = $1 AND company_id = $2`,
      [employeeNo, companyCode]
    );
    
    if (empResult.rows.length === 0) {
      console.log('❌ Employee not found!');
      process.exit(1);
    }
    
    const employee = empResult.rows[0];
    console.log('✅ Employee found:', {
      id: employee.id,
      name: employee.name,
      empNo: employee.x_Emp_No,
      companyId: employee.company_id,
      active: employee.active
    });
    
    const employeeId = employee.id;

    // 2. Check leave allocations
    console.log('\n2. Checking leave allocations in hr_leave_allocation...');
    const allocResult = await queryPromise(
      `SELECT 
        id,
        employee_id,
        holiday_status_id,
        name as leave_type_name,
        number_of_days as allocated_days,
        state,
        date_from,
        date_to
      FROM hr_leave_allocation
      WHERE employee_id = $1
        AND state = 'validate'
        AND CURRENT_DATE BETWEEN date_from AND date_to
      ORDER BY name`,
      [employeeId]
    );
    
    console.log(`Found ${allocResult.rows.length} leave allocations:`);
    allocResult.rows.forEach(row => {
      console.log(`  - ${row.leave_type_name}: ${row.allocated_days} days (${row.date_from} to ${row.date_to})`);
    });

    // 3. Check leave requests
    console.log('\n3. Checking leave requests in hr_leave...');
    const leaveResult = await queryPromise(
      `SELECT 
        hl.id,
        hl.date_from,
        hl.date_to,
        hl.holiday_status_id,
        hl.number_of_days,
        hl.state,
        hlt.name as leave_type
      FROM hr_leave hl
      LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
      WHERE hl.employee_id = $1
      ORDER BY hl.create_date DESC
      LIMIT 10`,
      [employeeId]
    );
    
    console.log(`Found ${leaveResult.rows.length} leave requests:`);
    leaveResult.rows.forEach(row => {
      console.log(`  - ${row.leave_type || 'Unknown'}: ${row.date_from} to ${row.date_to}, ${row.number_of_days} days, state: ${row.state}`);
    });

    // 4. Check payslips
    console.log('\n4. Checking payslips in employee_payslip...');
    const payslipResult = await queryPromise(
      `SELECT 
        id,
        employee_name,
        x_emp_no,
        pay_year,
        month,
        x_pay_date,
        x_basic_salary,
        x_allowance,
        deduction_amount,
        net_pay_amount,
        gross_pay_amount,
        payslipurl,
        status
      FROM employee_payslip
      WHERE employee_id = $1
      ORDER BY x_pay_date DESC
      LIMIT 12`,
      [employeeId]
    );
    
    console.log(`Found ${payslipResult.rows.length} payslips:`);
    payslipResult.rows.forEach(row => {
      console.log(`  - ${row.month}-${row.pay_year}: Basic: $${row.x_basic_salary}, Allowance: $${row.x_allowance}, Total: $${row.net_pay_amount}`);
      console.log(`    URL: ${row.payslipurl || 'N/A'}`);
    });

    // 5. Test leave balance API query
    console.log('\n5. Testing leave balance query (same as API)...');
    const balanceQuery = `
      WITH leave_allocations AS (
        SELECT 
          hla.id as allocation_id,
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
          AND CURRENT_DATE BETWEEN hla.date_from AND hla.date_to
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
      ),
      leave_pending AS (
        SELECT 
          hl.employee_id,
          hl.holiday_status_id,
          COALESCE(SUM(hl.number_of_days), 0) as pending_days
        FROM hr_leave hl
        WHERE hl.employee_id = $1
          AND hl.state IN ('draft', 'confirm')
        GROUP BY hl.employee_id, hl.holiday_status_id
      )
      SELECT 
        la.leave_type_name,
        la.holiday_status_id,
        COALESCE(SUM(la.allocated_days), 0) as total_allocated,
        COALESCE(lt.taken_days, 0) as total_taken,
        COALESCE(lp.pending_days, 0) as total_pending,
        COALESCE(SUM(la.allocated_days), 0) - COALESCE(lt.taken_days, 0) as balance
      FROM leave_allocations la
      LEFT JOIN leave_taken lt ON la.employee_id = lt.employee_id 
        AND la.holiday_status_id = lt.holiday_status_id
      LEFT JOIN leave_pending lp ON la.employee_id = lp.employee_id 
        AND la.holiday_status_id = lp.holiday_status_id
      GROUP BY la.leave_type_name, la.holiday_status_id, lt.taken_days, lp.pending_days
      ORDER BY la.leave_type_name;
    `;
    
    const balanceResult = await queryPromise(balanceQuery, [employeeId]);
    console.log(`Leave balance calculation:`);
    balanceResult.rows.forEach(row => {
      console.log(`  - ${row.leave_type_name}:`);
      console.log(`    Allocated: ${row.total_allocated}, Taken: ${row.total_taken}, Pending: ${row.total_pending}, Balance: ${row.balance}`);
    });

    // 6. Check leave statistics
    console.log('\n6. Checking leave statistics...');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN state IN ('draft', 'confirm') THEN 1 END) as pending_requests,
        COALESCE(SUM(CASE WHEN state IN ('validate', 'confirm') THEN number_of_days ELSE 0 END), 0) as approved_days
      FROM hr_leave
      WHERE employee_id = $1;
    `;
    
    const statsResult = await queryPromise(statsQuery, [employeeId]);
    const stats = statsResult.rows[0];
    console.log(`Statistics:`, {
      totalRequests: stats.total_requests,
      pendingRequests: stats.pending_requests,
      approvedDays: stats.approved_days
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

testEmployeeData();
