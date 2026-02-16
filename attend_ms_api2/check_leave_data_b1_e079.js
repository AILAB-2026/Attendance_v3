import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'attendance',
  password: 'admin',
  port: 5432,
});

async function checkLeaveData() {
  try {
    console.log('🔍 Checking leave data for employee B1-E079 (ID: 267)...\n');

    // Check hr_leave table for employee 267
    const leaveQuery = `
      SELECT 
        hl.id,
        hl.employee_id,
        hl.date_from,
        hl.date_to,
        hl.number_of_days,
        hl.state,
        hl.name as leave_name,
        hl.holiday_status_id,
        hlt.name as leave_type_name,
        hl.create_date,
        hl.request_date_from,
        hl.request_date_to
      FROM hr_leave hl
      LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
      WHERE hl.employee_id = 267
      ORDER BY hl.create_date DESC;
    `;

    const leaveResult = await pool.query(leaveQuery);
    console.log(`📋 Found ${leaveResult.rows.length} leave records in hr_leave table:`);
    
    if (leaveResult.rows.length > 0) {
      leaveResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Leave ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Leave Type: ${row.leave_type_name} (ID: ${row.holiday_status_id})`);
        console.log(`   Date From: ${row.date_from}`);
        console.log(`   Date To: ${row.date_to}`);
        console.log(`   Days: ${row.number_of_days}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Leave Name: ${row.leave_name}`);
        console.log(`   Created: ${row.create_date}`);
        console.log(`   Request From: ${row.request_date_from}`);
        console.log(`   Request To: ${row.request_date_to}`);
      });
    } else {
      console.log('   ❌ No leave records found for employee 267');
    }

    // Check hr_leave_allocation table
    console.log('\n📊 Checking leave allocations...');
    const allocationQuery = `
      SELECT 
        hla.id,
        hla.employee_id,
        hla.holiday_status_id,
        hla.name as allocation_name,
        hla.number_of_days as allocated_days,
        hla.state,
        hla.date_from,
        hla.date_to,
        hlt.name as leave_type_name
      FROM hr_leave_allocation hla
      LEFT JOIN hr_leave_type hlt ON hla.holiday_status_id = hlt.id
      WHERE hla.employee_id = 267
      ORDER BY hla.date_from DESC;
    `;

    const allocationResult = await pool.query(allocationQuery);
    console.log(`📋 Found ${allocationResult.rows.length} leave allocation records:`);
    
    if (allocationResult.rows.length > 0) {
      allocationResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Allocation ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Leave Type: ${row.leave_type_name} (ID: ${row.holiday_status_id})`);
        console.log(`   Allocated Days: ${row.allocated_days}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Valid From: ${row.date_from}`);
        console.log(`   Valid To: ${row.date_to}`);
        console.log(`   Allocation Name: ${row.allocation_name}`);
      });
    }

    // Check employee B2-W138 (ID: 260) for comparison
    console.log('\n\n🔍 Checking leave data for employee B2-W138 (ID: 260) for comparison...\n');

    const leave2Query = `
      SELECT 
        hl.id,
        hl.employee_id,
        hl.date_from,
        hl.date_to,
        hl.number_of_days,
        hl.state,
        hl.name as leave_name,
        hl.holiday_status_id,
        hlt.name as leave_type_name,
        hl.create_date
      FROM hr_leave hl
      LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
      WHERE hl.employee_id = 260
      ORDER BY hl.create_date DESC;
    `;

    const leave2Result = await pool.query(leave2Query);
    console.log(`📋 Found ${leave2Result.rows.length} leave records for employee 260:`);
    
    if (leave2Result.rows.length > 0) {
      leave2Result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Leave ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Leave Type: ${row.leave_type_name} (ID: ${row.holiday_status_id})`);
        console.log(`   Date From: ${row.date_from}`);
        console.log(`   Date To: ${row.date_to}`);
        console.log(`   Days: ${row.number_of_days}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Created: ${row.create_date}`);
      });
    } else {
      console.log('   ❌ No leave records found for employee 260');
    }

    // Check allocations for employee 260
    const allocation2Query = `
      SELECT 
        hla.id,
        hla.employee_id,
        hla.holiday_status_id,
        hla.name as allocation_name,
        hla.number_of_days as allocated_days,
        hla.state,
        hla.date_from,
        hla.date_to,
        hlt.name as leave_type_name
      FROM hr_leave_allocation hla
      LEFT JOIN hr_leave_type hlt ON hla.holiday_status_id = hlt.id
      WHERE hla.employee_id = 260
      ORDER BY hla.date_from DESC;
    `;

    const allocation2Result = await pool.query(allocation2Query);
    console.log(`\n📊 Found ${allocation2Result.rows.length} leave allocation records for employee 260:`);
    
    if (allocation2Result.rows.length > 0) {
      allocation2Result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Allocation ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Leave Type: ${row.leave_type_name} (ID: ${row.holiday_status_id})`);
        console.log(`   Allocated Days: ${row.allocated_days}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Valid From: ${row.date_from}`);
        console.log(`   Valid To: ${row.date_to}`);
      });
    }

    // Test the API endpoint directly
    console.log('\n\n🧪 Testing /leave/requests API endpoint...');
    
    // First get a token for employee 267
    const authQuery = `
      SELECT he.id, he.name, he.emp_no, he.company_id, he.active
      FROM hr_employee he
      WHERE he.id = 267;
    `;
    
    const authResult = await pool.query(authQuery);
    if (authResult.rows.length > 0) {
      const employee = authResult.rows[0];
      console.log(`👤 Employee found: ${employee.name} (${employee.emp_no}), Company: ${employee.company_id}, Active: ${employee.active}`);
      
      // Simulate the API query
      const apiQuery = `
        SELECT 
          hl.id,
          hl.date_from as request_date_from,
          hl.date_to as request_date_to,
          hlt.name as leave_type,
          hl.state as leave_status,
          hl.holiday_status_id as leave_status_id,
          hl.number_of_days as days,
          hl.create_date as apply_date
        FROM hr_leave hl
        LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
        WHERE hl.employee_id = $1
        ORDER BY hl.create_date DESC
      `;
      
      const apiResult = await pool.query(apiQuery, [267]);
      console.log(`🔌 API query returned ${apiResult.rows.length} records:`);
      
      if (apiResult.rows.length > 0) {
        apiResult.rows.forEach((row, index) => {
          console.log(`\n${index + 1}. API Response:`);
          console.log(`   ID: ${row.id}`);
          console.log(`   Request Date From: ${row.request_date_from}`);
          console.log(`   Request Date To: ${row.request_date_to}`);
          console.log(`   Leave Type: ${row.leave_type}`);
          console.log(`   Leave Status: ${row.leave_status}`);
          console.log(`   Days: ${row.days}`);
          console.log(`   Apply Date: ${row.apply_date}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking leave data:', error);
  } finally {
    await pool.end();
  }
}

checkLeaveData();
