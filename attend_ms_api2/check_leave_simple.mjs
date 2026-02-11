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

async function checkLeaveSimple() {
  try {
    console.log('🔍 Checking leave data for employee B1-E079 (ID: 267)...\n');

    // Simple query to get leave records
    const leaveQuery = `
      SELECT 
        id,
        employee_id,
        date_from,
        date_to,
        number_of_days,
        state,
        name,
        holiday_status_id,
        create_date,
        request_date_from,
        request_date_to
      FROM hr_leave
      WHERE employee_id = 267
      ORDER BY create_date DESC;
    `;

    const leaveResult = await pool.query(leaveQuery);
    console.log(`📋 Found ${leaveResult.rows.length} leave records:`);
    
    if (leaveResult.rows.length > 0) {
      leaveResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Leave Record:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Date From: ${row.date_from}`);
        console.log(`   Date To: ${row.date_to}`);
        console.log(`   Days: ${row.number_of_days}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Name: ${row.name}`);
        console.log(`   Holiday Status ID: ${row.holiday_status_id}`);
        console.log(`   Created: ${row.create_date}`);
        console.log(`   Request From: ${row.request_date_from}`);
        console.log(`   Request To: ${row.request_date_to}`);
      });
    }

    // Check leave allocation
    console.log('\n📊 Checking leave allocations...');
    const allocationQuery = `
      SELECT 
        id,
        employee_id,
        holiday_status_id,
        name,
        number_of_days,
        state,
        date_from,
        date_to
      FROM hr_leave_allocation
      WHERE employee_id = 267
      ORDER BY date_from DESC;
    `;

    const allocationResult = await pool.query(allocationQuery);
    console.log(`📋 Found ${allocationResult.rows.length} allocation records:`);
    
    if (allocationResult.rows.length > 0) {
      allocationResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Allocation Record:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Holiday Status ID: ${row.holiday_status_id}`);
        console.log(`   Name: ${row.name}`);
        console.log(`   Days: ${row.number_of_days}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Valid From: ${row.date_from}`);
        console.log(`   Valid To: ${row.date_to}`);
      });
    }

    // Test the exact API query from leaveRoutes.js
    console.log('\n🧪 Testing exact API query from /leave/requests...');
    const apiQuery = `
      SELECT 
        hl.id,
        hl.date_from as request_date_from,
        hl.date_to as request_date_to,
        hl.name as leave_type,
        hl.state as leave_status,
        hl.holiday_status_id as leave_status_id,
        hl.number_of_days as days,
        hl.create_date as apply_date
      FROM hr_leave hl
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

    // Check employee B2-W138 (ID: 260) for comparison
    console.log('\n\n🔍 Checking employee B2-W138 (ID: 260) for comparison...');
    
    const employee2Query = `
      SELECT COUNT(*) as leave_count
      FROM hr_leave
      WHERE employee_id = 260;
    `;
    
    const employee2Result = await pool.query(employee2Query);
    console.log(`📋 Employee 260 has ${employee2Result.rows[0].leave_count} leave records`);

    const allocation2Query = `
      SELECT COUNT(*) as allocation_count
      FROM hr_leave_allocation
      WHERE employee_id = 260;
    `;
    
    const allocation2Result = await pool.query(allocation2Query);
    console.log(`📋 Employee 260 has ${allocation2Result.rows[0].allocation_count} allocation records`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkLeaveSimple();
