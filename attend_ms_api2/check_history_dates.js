import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'CX18BRKERP',
  password: 'openpgpwd',
  port: 5432,
});

async function checkHistoryDates() {
  try {
    console.log('🔍 Checking History Date Issue');
    console.log('=============================');
    
    // Check recent records for employee B1-W422 (SANKAR SAMBATH)
    const employeeNo = 'B1-W422';
    const companyCode = 1;
    
    // Get employee ID
    const empResult = await pool.query(
      `SELECT id FROM hr_employee 
       WHERE "x_Emp_No" = $1 AND company_id = $2::integer AND active = true`,
      [employeeNo, companyCode]
    );
    
    const employeeId = empResult.rows[0].id;
    console.log('Employee ID:', employeeId);
    
    // Check recent clock records
    const result = await pool.query(
      `SELECT 
        id,
        clock_in,
        clock_out,
        clock_in_date,
        clock_out_date,
        clock_in_location
       FROM employee_clocking_line 
       WHERE employee_id = $1 
         AND clock_in_date >= CURRENT_DATE - INTERVAL '5 days'
       ORDER BY clock_in_date DESC, clock_in DESC`,
      [employeeId]
    );
    
    console.log(`\n📊 Recent Records (last 5 days):`);
    result.rows.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ID: ${record.id}`);
      console.log(`     Clock In Date: ${record.clock_in_date}`);
      console.log(`     Clock In Time: ${record.clock_in}`);
      console.log(`     Location: ${record.clock_in_location}`);
      console.log('     ---');
    });
    
    // Test the history API endpoint query
    console.log('\n🧪 Testing History API Query:');
    const startDate = '2025-11-11';
    const endDate = '2025-11-12';
    
    const historyResult = await pool.query(
      `SELECT 
        DATE(ecl.clock_in_date) as date,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.clock_in_location as site_name,
        pp.name->>'en_US' as project_name
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp ON ecl.project_id = pp.id
       WHERE ecl.employee_id = $1 
         AND DATE(ecl.clock_in_date) BETWEEN $2::date AND $3::date
       ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC`,
      [employeeId, startDate, endDate]
    );
    
    console.log(`\nHistory Query Results (${startDate} to ${endDate}):`);
    historyResult.rows.forEach((record, idx) => {
      console.log(`  ${idx + 1}. Date: ${record.date}`);
      console.log(`     Clock In: ${record.clock_in}`);
      console.log(`     Clock Out: ${record.clock_out || 'NULL'}`);
      console.log(`     Site: ${record.site_name}`);
      console.log(`     Project: ${record.project_name || 'NULL'}`);
      console.log('     ---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkHistoryDates();
