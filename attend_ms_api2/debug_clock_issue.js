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

async function debugClockIssue() {
  try {
    console.log('🔍 Debugging Clock In/Out Display Issue');
    console.log('=====================================');
    
    // Test employee B1-L157 from the screenshot
    const employeeNo = 'B1-L157';
    const companyCode = 1;
    
    console.log(`\n1. Checking employee: ${employeeNo} (Company: ${companyCode})`);
    
    // Get employee ID
    const empResult = await pool.query(
      `SELECT id, "x_Emp_No", name, active FROM hr_employee 
       WHERE "x_Emp_No" = $1 AND company_id = $2::integer`,
      [employeeNo, companyCode]
    );
    
    if (empResult.rows.length === 0) {
      console.log('❌ Employee not found');
      return;
    }
    
    const employee = empResult.rows[0];
    console.log('✅ Employee found:', {
      id: employee.id,
      empNo: employee.x_Emp_No,
      name: employee.name,
      active: employee.active
    });
    
    const employeeId = employee.id;
    
    // Check today's date in different timezones
    console.log('\n2. Checking date/timezone issues:');
    const dateCheck = await pool.query(`
      SELECT 
        CURRENT_DATE as server_current_date,
        NOW()::date as server_now_date,
        (NOW() AT TIME ZONE 'Asia/Singapore')::date as singapore_date,
        NOW() AT TIME ZONE 'Asia/Singapore' as singapore_now
    `);
    
    console.log('📅 Date comparison:', dateCheck.rows[0]);
    
    // Get all clock records for this employee (last 7 days)
    console.log('\n3. Checking recent clock records:');
    const clockRecords = await pool.query(
      `SELECT 
        id,
        clock_in,
        clock_out,
        clock_in_date,
        clock_out_date,
        clock_in_location,
        project_id,
        in_addr,
        out_add,
        clock_in_image_uri,
        clock_out_image_uri
       FROM employee_clocking_line 
       WHERE employee_id = $1 
         AND clock_in_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY clock_in_date DESC, clock_in DESC`,
      [employeeId]
    );
    
    console.log(`📊 Found ${clockRecords.rows.length} clock records in last 7 days:`);
    clockRecords.rows.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ID: ${record.id}`);
      console.log(`     Clock In: ${record.clock_in} (Date: ${record.clock_in_date})`);
      console.log(`     Clock Out: ${record.clock_out || 'NULL'} (Date: ${record.clock_out_date || 'NULL'})`);
      console.log(`     Location: ${record.clock_in_location || 'NULL'}`);
      console.log(`     Project ID: ${record.project_id || 'NULL'}`);
      console.log(`     Address: ${record.in_addr || 'NULL'}`);
      console.log('     ---');
    });
    
    // Test the exact query used by /attendance/today endpoint
    console.log('\n4. Testing /attendance/today query:');
    const todayQuery = await pool.query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.in_lat,
        ecl.in_lan,
        ecl.in_addr,
        ecl.out_lat,
        ecl.out_lan,
        ecl.out_add,
        ecl.clock_in_image_uri,
        ecl.clock_out_image_uri,
        pp.name->>'en_US' as project_name,
        ecl.clock_in_location as site_name
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp ON ecl.project_id = pp.id
       WHERE ecl.employee_id = $1 
         AND DATE(ecl.clock_in_date) = (NOW() AT TIME ZONE 'Asia/Singapore')::date
       ORDER BY ecl.clock_in ASC`,
      [employeeId]
    );
    
    console.log(`🎯 Today's query result: ${todayQuery.rows.length} records found`);
    todayQuery.rows.forEach((record, idx) => {
      console.log(`  ${idx + 1}. Clock In: ${record.clock_in} | Clock Out: ${record.clock_out || 'NULL'}`);
      console.log(`     Site: ${record.site_name || 'NULL'} | Project: ${record.project_name || 'NULL'}`);
      console.log(`     Date: ${record.clock_in_date}`);
    });
    
    // Check if there are any open clockings (no clock out)
    console.log('\n5. Checking open clockings (no clock out):');
    const openClockings = await pool.query(
      `SELECT id, clock_in, clock_in_date, clock_in_location, project_id
       FROM employee_clocking_line 
       WHERE employee_id = $1 AND clock_out IS NULL 
       ORDER BY clock_in DESC`,
      [employeeId]
    );
    
    console.log(`🔓 Open clockings: ${openClockings.rows.length} found`);
    openClockings.rows.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ID: ${record.id}, Clock In: ${record.clock_in}, Date: ${record.clock_in_date}`);
      console.log(`     Location: ${record.clock_in_location || 'NULL'}, Project: ${record.project_id || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await pool.end();
  }
}

debugClockIssue();
