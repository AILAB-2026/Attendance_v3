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

async function testLeaveAPI() {
  try {
    console.log('🧪 Testing the fixed leave API query...\n');

    // Test the exact query from the fixed API
    const queryString = `
      SELECT 
        hl.id,
        hl.request_date_from,
        hl.request_date_to,
        hl.date_from,
        hl.date_to,
        COALESCE(hlt.name->>'en_US', 'Leave') as leave_type,
        hl.state as leave_status,
        hl.holiday_status_id as leave_status_id,
        hl.number_of_days as days,
        hl.create_date as apply_date,
        hl.x_employee,
        hl.private_name,
        hl.duration_display
      FROM hr_leave hl
      LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
      WHERE hl.employee_id = $1
      ORDER BY hl.create_date DESC NULLS LAST, hl.write_date DESC
    `;

    const result = await pool.query(queryString, [267]);
    console.log(`📋 API query returned ${result.rows.length} records for employee 267:`);
    
    result.rows.forEach((row, index) => {
      // Map database states to mobile app status
      let mappedStatus = 'pending';
      switch (row.leave_status) {
        case 'validate':
        case 'confirm':
          mappedStatus = 'approved';
          break;
        case 'draft':
          mappedStatus = 'pending';
          break;
        case 'refuse':
        case 'cancel':
          mappedStatus = 'rejected';
          break;
        default:
          mappedStatus = row.leave_status || 'pending';
      }
      
      console.log(`\n${index + 1}. Leave Record:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Employee: ${row.x_employee}`);
      console.log(`   Leave Type: ${row.leave_type}`);
      console.log(`   Request Date From: ${row.request_date_from}`);
      console.log(`   Request Date To: ${row.request_date_to}`);
      console.log(`   Date From: ${row.date_from}`);
      console.log(`   Date To: ${row.date_to}`);
      console.log(`   Days: ${row.days}`);
      console.log(`   Raw State: ${row.leave_status}`);
      console.log(`   Mapped Status: ${mappedStatus}`);
      console.log(`   Apply Date: ${row.apply_date}`);
      console.log(`   Duration: ${row.duration_display}`);
    });

    // Test for employee 260 (B2-W138) as well
    console.log('\n\n🔍 Testing for employee 260 (B2-W138)...');
    const result2 = await pool.query(queryString, [260]);
    console.log(`📋 API query returned ${result2.rows.length} records for employee 260`);
    
    if (result2.rows.length > 0) {
      result2.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Leave Record for 260:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   Employee: ${row.x_employee}`);
        console.log(`   Leave Type: ${row.leave_type}`);
        console.log(`   Days: ${row.days}`);
        console.log(`   State: ${row.leave_status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testLeaveAPI();
