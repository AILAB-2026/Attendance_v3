// Check B1-L157 today's clock-in
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkToday() {
  try {
    console.log('🔍 Checking B1-L157 clock-in records...\n');
    
    // Get employee ID
    const empResult = await pool.query(
      `SELECT id FROM hr_employee WHERE "x_Emp_No" = 'B1-L157' AND company_id = 1`
    );
    const employeeId = empResult.rows[0].id;
    console.log('Employee ID:', employeeId);
    console.log('');
    
    // Check what CURRENT_DATE returns
    const dateCheck = await pool.query(`SELECT CURRENT_DATE, NOW(), CURRENT_TIMESTAMP`);
    console.log('📅 Database Date/Time:');
    console.log('   CURRENT_DATE:', dateCheck.rows[0].current_date);
    console.log('   NOW():', dateCheck.rows[0].now);
    console.log('   CURRENT_TIMESTAMP:', dateCheck.rows[0].current_timestamp);
    console.log('');
    
    // Get ALL records for this employee (no date filter)
    const allRecords = await pool.query(
      `SELECT id, clock_in, clock_in_date, clock_out, clock_out_date, project_id
       FROM employee_clocking_line
       WHERE employee_id = $1
       ORDER BY clock_in_date DESC, clock_in DESC
       LIMIT 5`,
      [employeeId]
    );
    
    console.log('📊 Last 5 Records (any date):');
    allRecords.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ID: ${row.id}`);
      console.log(`      Clock In: ${row.clock_in} on ${row.clock_in_date}`);
      console.log(`      Clock Out: ${row.clock_out || 'NULL'} ${row.clock_out_date ? `on ${row.clock_out_date}` : ''}`);
      console.log(`      Project ID: ${row.project_id}`);
      console.log('');
    });
    
    // Check records with TODAY filter (same as /attendance/today endpoint)
    const todayRecords = await pool.query(
      `SELECT id, clock_in, clock_in_date, clock_out, clock_out_date, project_id
       FROM employee_clocking_line
       WHERE employee_id = $1 
         AND DATE(clock_in_date) = CURRENT_DATE
       ORDER BY clock_in DESC`,
      [employeeId]
    );
    
    console.log('📅 Records for TODAY (DATE(clock_in_date) = CURRENT_DATE):');
    if (todayRecords.rows.length === 0) {
      console.log('   ❌ NO RECORDS FOUND');
      console.log('   This is why /attendance/today returns empty!');
    } else {
      console.log(`   ✅ Found ${todayRecords.rows.length} record(s):`);
      todayRecords.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ID: ${row.id}`);
        console.log(`      Clock In: ${row.clock_in} on ${row.clock_in_date}`);
        console.log(`      Clock Out: ${row.clock_out || 'NULL'}`);
      });
    }
    console.log('');
    
    // Check if the most recent record matches today
    if (allRecords.rows.length > 0) {
      const latest = allRecords.rows[0];
      const latestDate = new Date(latest.clock_in_date);
      const today = new Date(dateCheck.rows[0].current_date);
      
      console.log('🔍 Date Comparison:');
      console.log(`   Latest record date: ${latestDate.toISOString().split('T')[0]}`);
      console.log(`   Database CURRENT_DATE: ${today.toISOString().split('T')[0]}`);
      console.log(`   Match: ${latestDate.toISOString().split('T')[0] === today.toISOString().split('T')[0] ? '✅ YES' : '❌ NO'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkToday();
