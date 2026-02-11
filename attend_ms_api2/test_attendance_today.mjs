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

async function testAttendanceToday() {
  try {
    console.log('🔍 Testing attendance data for today (Nov 12, 2025)...\n');

    // Check current Singapore date
    const dateQuery = `SELECT (NOW() AT TIME ZONE 'Asia/Singapore')::date as singapore_date, CURRENT_DATE as server_date, NOW() as server_time`;
    const dateResult = await pool.query(dateQuery);
    console.log('📅 Date comparison:');
    console.log(`   Singapore Date: ${dateResult.rows[0].singapore_date}`);
    console.log(`   Server Date: ${dateResult.rows[0].server_date}`);
    console.log(`   Server Time: ${dateResult.rows[0].server_time}`);

    // Check employee_clocking_line for today
    const todayQuery = `
      SELECT 
        ecl.id,
        ecl.employee_id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.clock_in_location,
        ecl.clock_out_location,
        he.emp_no
      FROM employee_clocking_line ecl
      LEFT JOIN hr_employee he ON ecl.employee_id = he.id
      WHERE DATE(ecl.clock_in_date) = (NOW() AT TIME ZONE 'Asia/Singapore')::date
        AND he.emp_no IN ('B1-E079', 'B1-W422', 'B1-L157')
      ORDER BY ecl.clock_in DESC;
    `;

    const todayResult = await pool.query(todayQuery);
    console.log(`\n📋 Found ${todayResult.rows.length} attendance records for today:`);
    
    if (todayResult.rows.length > 0) {
      todayResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Attendance Record:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   Employee: ${row.emp_no} (ID: ${row.employee_id})`);
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

    // Check attendance for the last few days
    console.log('\n📊 Checking attendance for last 3 days...');
    const recentQuery = `
      SELECT 
        ecl.clock_in_date,
        COUNT(*) as record_count,
        COUNT(CASE WHEN ecl.clock_out IS NOT NULL THEN 1 END) as clocked_out_count
      FROM employee_clocking_line ecl
      LEFT JOIN hr_employee he ON ecl.employee_id = he.id
      WHERE ecl.clock_in_date >= (NOW() AT TIME ZONE 'Asia/Singapore')::date - INTERVAL '3 days'
        AND he.emp_no IN ('B1-E079', 'B1-W422', 'B1-L157')
      GROUP BY ecl.clock_in_date
      ORDER BY ecl.clock_in_date DESC;
    `;

    const recentResult = await pool.query(recentQuery);
    console.log(`📋 Attendance summary for last 3 days:`);
    
    if (recentResult.rows.length > 0) {
      recentResult.rows.forEach((row, index) => {
        console.log(`   ${row.clock_in_date}: ${row.record_count} records, ${row.clocked_out_count} clocked out`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAttendanceToday();
