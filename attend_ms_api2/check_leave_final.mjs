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

async function checkLeaveFinal() {
  try {
    console.log('🔍 Final check of leave data for employee B1-E079 (ID: 267)...\n');

    // Get the exact data that should be returned by the API
    const apiQuery = `
      SELECT 
        id,
        date_from,
        date_to,
        name,
        state,
        holiday_status_id,
        number_of_days,
        create_date,
        request_date_from,
        request_date_to,
        x_employee,
        x_leave_type
      FROM hr_leave
      WHERE employee_id = 267
      ORDER BY create_date DESC;
    `;

    const result = await pool.query(apiQuery);
    console.log(`📋 Found ${result.rows.length} leave records for employee 267:`);
    
    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Leave Record:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Employee: ${row.x_employee}`);
      console.log(`   Leave Type: ${row.x_leave_type}`);
      console.log(`   Date From: ${row.date_from}`);
      console.log(`   Date To: ${row.date_to}`);
      console.log(`   Request Date From: ${row.request_date_from}`);
      console.log(`   Request Date To: ${row.request_date_to}`);
      console.log(`   Days: ${row.number_of_days}`);
      console.log(`   State: ${row.state}`);
      console.log(`   Name: ${row.name}`);
      console.log(`   Holiday Status ID: ${row.holiday_status_id}`);
      console.log(`   Created: ${row.create_date}`);
    });

    // Test the current API query structure
    console.log('\n🧪 Testing current API query structure...');
    const currentApiQuery = `
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
    
    const currentResult = await pool.query(currentApiQuery, [267]);
    console.log(`🔌 Current API query returned ${currentResult.rows.length} records:`);
    
    currentResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Current API Response:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Request Date From: ${row.request_date_from}`);
      console.log(`   Request Date To: ${row.request_date_to}`);
      console.log(`   Leave Type: ${row.leave_type}`);
      console.log(`   Leave Status: ${row.leave_status}`);
      console.log(`   Days: ${row.days}`);
      console.log(`   Apply Date: ${row.apply_date}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkLeaveFinal();
