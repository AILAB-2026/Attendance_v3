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

async function testAttendanceSimple() {
  try {
    console.log('🔍 Testing attendance data for today (Nov 12, 2025)...\n');

    // Check current Singapore date
    const dateQuery = `SELECT (NOW() AT TIME ZONE 'Asia/Singapore')::date as singapore_date, CURRENT_DATE as server_date, NOW() as server_time`;
    const dateResult = await pool.query(dateQuery);
    console.log('📅 Date comparison:');
    console.log(`   Singapore Date: ${dateResult.rows[0].singapore_date}`);
    console.log(`   Server Date: ${dateResult.rows[0].server_date}`);
    console.log(`   Server Time: ${dateResult.rows[0].server_time}`);

    // Check employee_clocking_line for today - simple query
    const todayQuery = `
      SELECT 
        id,
        employee_id,
        clock_in,
        clock_out,
        clock_in_date,
        clock_out_date,
        clock_in_location,
        clock_out_location
      FROM employee_clocking_line
      WHERE DATE(clock_in_date) = (NOW() AT TIME ZONE 'Asia/Singapore')::date
      ORDER BY clock_in DESC;
    `;

    const todayResult = await pool.query(todayQuery);
    console.log(`\n📋 Found ${todayResult.rows.length} attendance records for today:`);
    
    if (todayResult.rows.length > 0) {
      todayResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Attendance Record:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   Employee ID: ${row.employee_id}`);
        console.log(`   Clock In: ${row.clock_in}`);
        console.log(`   Clock Out: ${row.clock_out || 'Not clocked out'}`);
        console.log(`   Clock In Date: ${row.clock_in_date}`);
        console.log(`   Clock Out Date: ${row.clock_out_date || 'N/A'}`);
        console.log(`   Clock In Location: ${row.clock_in_location}`);
        console.log(`   Clock Out Location: ${row.clock_out_location || 'N/A'}`);
      });
    } else {
      console.log('   ❌ No attendance records found for today');
    }

    // Check for employee 267 specifically
    console.log('\n🔍 Checking specifically for employee 267 (B1-E079)...');
    const emp267Query = `
      SELECT 
        id,
        employee_id,
        clock_in,
        clock_out,
        clock_in_date,
        clock_out_date,
        clock_in_location
      FROM employee_clocking_line
      WHERE employee_id = 267
        AND clock_in_date >= (NOW() AT TIME ZONE 'Asia/Singapore')::date - INTERVAL '3 days'
      ORDER BY clock_in_date DESC, clock_in DESC;
    `;

    const emp267Result = await pool.query(emp267Query);
    console.log(`📋 Found ${emp267Result.rows.length} records for employee 267 in last 3 days:`);
    
    if (emp267Result.rows.length > 0) {
      emp267Result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Employee 267 Record:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   Clock In: ${row.clock_in}`);
        console.log(`   Clock Out: ${row.clock_out || 'Not clocked out'}`);
        console.log(`   Clock In Date: ${row.clock_in_date}`);
        console.log(`   Clock Out Date: ${row.clock_out_date || 'N/A'}`);
        console.log(`   Location: ${row.clock_in_location}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAttendanceSimple();
