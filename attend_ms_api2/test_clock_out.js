// Test Clock Out for B1-W422
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

// Load environment variables from .env file
dotenv.config();

console.log('📋 Database Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? '***' : 'NOT SET'
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'CX18BRKERP',
  user: process.env.DB_USER || 'openpg',
  password: process.env.DB_PASSWORD || 'openpgpwd',
});

async function testClockOut() {
  try {
    console.log('🔍 Testing Clock Out for B1-W422...\n');
    
    // 1. Get employee ID
    const empResult = await pool.query(
      `SELECT id, "x_Emp_No" as employee_no, name 
       FROM hr_employee 
       WHERE "x_Emp_No" = $1 AND company_id = $2 AND active = true`,
      ['B1-W422', 1]
    );
    
    if (empResult.rows.length === 0) {
      console.log('❌ Employee B1-W422 not found or inactive');
      return;
    }
    
    const employee = empResult.rows[0];
    console.log('✅ Found employee:', employee);
    console.log('   Employee ID:', employee.id);
    console.log('   Name:', employee.name);
    console.log('');
    
    // 2. Check for open clock-ins (no clock-out)
    const openClockings = await pool.query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.project_id,
        ecl.clock_in_location as site_name,
        pp.name->>'en_US' as project_name
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp ON ecl.project_id = pp.id
       WHERE ecl.employee_id = $1 
         AND ecl.clock_out IS NULL
       ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC`,
      [employee.id]
    );
    
    console.log('📊 Open Clock-ins (no clock-out):');
    if (openClockings.rows.length === 0) {
      console.log('   ❌ No open clock-ins found');
      console.log('   Employee needs to clock in first before clocking out');
    } else {
      console.log(`   ✅ Found ${openClockings.rows.length} open clock-in(s):\n`);
      openClockings.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}`);
        console.log(`      Clock In: ${row.clock_in} on ${row.clock_in_date}`);
        console.log(`      Site: ${row.site_name || 'N/A'}`);
        console.log(`      Project: ${row.project_name || 'N/A'} (ID: ${row.project_id || 'N/A'})`);
        console.log('');
      });
    }
    
    // 3. Check today's attendance
    const todayClockings = await pool.query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.project_id,
        ecl.clock_in_location as site_name,
        pp.name->>'en_US' as project_name
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp ON ecl.project_id = pp.id
       WHERE ecl.employee_id = $1 
         AND DATE(ecl.clock_in_date) = CURRENT_DATE
       ORDER BY ecl.clock_in DESC`,
      [employee.id]
    );
    
    console.log('📅 Today\'s Attendance Records:');
    if (todayClockings.rows.length === 0) {
      console.log('   ❌ No records for today');
    } else {
      console.log(`   ✅ Found ${todayClockings.rows.length} record(s) for today:\n`);
      todayClockings.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}`);
        console.log(`      Clock In: ${row.clock_in} on ${row.clock_in_date}`);
        console.log(`      Clock Out: ${row.clock_out ? `${row.clock_out} on ${row.clock_out_date}` : 'NOT CLOCKED OUT'}`);
        console.log(`      Site: ${row.site_name || 'N/A'}`);
        console.log(`      Project: ${row.project_name || 'N/A'} (ID: ${row.project_id || 'N/A'})`);
        console.log('');
      });
    }
    
    // 4. Test clock-out query for a specific project
    if (openClockings.rows.length > 0) {
      const firstOpen = openClockings.rows[0];
      console.log('🧪 Testing clock-out query for first open record:');
      console.log(`   Project ID: ${firstOpen.project_id || 'NULL'}`);
      console.log(`   Project Name: ${firstOpen.project_name || 'N/A'}`);
      
      if (firstOpen.project_id) {
        const testQuery = await pool.query(
          `SELECT id, clock_in, clock_in_location, clock_in_date, project_id
           FROM employee_clocking_line 
           WHERE employee_id = $1 AND project_id = $2 AND clock_out IS NULL 
           ORDER BY clock_in DESC 
           LIMIT 1`,
          [employee.id, firstOpen.project_id]
        );
        
        if (testQuery.rows.length > 0) {
          console.log('   ✅ Query would find this record for clock-out');
          console.log('   Record:', testQuery.rows[0]);
        } else {
          console.log('   ❌ Query would NOT find this record (BUG!)');
        }
      } else {
        console.log('   ⚠️ No project_id, would use fallback query');
        const testQuery = await pool.query(
          `SELECT id, clock_in, clock_in_location, clock_in_date, project_id
           FROM employee_clocking_line 
           WHERE employee_id = $1 AND clock_out IS NULL 
           ORDER BY clock_in DESC 
           LIMIT 1`,
          [employee.id]
        );
        
        if (testQuery.rows.length > 0) {
          console.log('   ✅ Fallback query would find this record');
          console.log('   Record:', testQuery.rows[0]);
        } else {
          console.log('   ❌ Fallback query would NOT find this record (BUG!)');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testClockOut();
