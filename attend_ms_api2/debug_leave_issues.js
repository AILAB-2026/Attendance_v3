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

async function debugLeaveIssues() {
  try {
    console.log('🔍 Debugging Leave Issues');
    console.log('=========================');
    
    // Check both employees
    const employees = [
      { empNo: 'B1-E079', expectedId: 267 },
      { empNo: 'B2-W138', expectedId: 260 }
    ];
    
    for (const emp of employees) {
      console.log(`\n👤 Employee: ${emp.empNo} (Expected ID: ${emp.expectedId})`);
      console.log('='.repeat(50));
      
      // Get employee details
      const empResult = await pool.query(
        `SELECT id, name, active, company_id FROM hr_employee 
         WHERE "x_Emp_No" = $1`,
        [emp.empNo]
      );
      
      if (empResult.rows.length === 0) {
        console.log('❌ Employee not found');
        continue;
      }
      
      const employee = empResult.rows[0];
      console.log(`✅ Employee Found:`);
      console.log(`   ID: ${employee.id}`);
      console.log(`   Name: ${employee.name}`);
      console.log(`   Active: ${employee.active}`);
      console.log(`   Company: ${employee.company_id}`);
      
      // Check leave allocations
      console.log(`\n📊 Leave Allocations:`);
      const allocResult = await pool.query(
        `SELECT 
          hlt.name as leave_type,
          hla.number_of_days as allocated,
          hla.max_leaves,
          hla.leaves_taken
         FROM hr_leave_allocation hla
         JOIN hr_leave_type hlt ON hla.holiday_status_id = hlt.id
         WHERE hla.employee_id = $1 AND hla.state = 'validate'`,
        [employee.id]
      );
      
      if (allocResult.rows.length === 0) {
        console.log('   ❌ No leave allocations found');
      } else {
        allocResult.rows.forEach(alloc => {
          const balance = alloc.allocated - (alloc.leaves_taken || 0);
          console.log(`   ${alloc.leave_type}: ${balance}/${alloc.allocated} days (taken: ${alloc.leaves_taken || 0})`);
        });
      }
      
      // Check leave requests
      console.log(`\n📝 Leave Requests:`);
      const leaveResult = await pool.query(
        `SELECT 
          id,
          name as description,
          date_from,
          date_to,
          number_of_days,
          state,
          holiday_status_id,
          request_date_from,
          request_date_to
         FROM hr_leave
         WHERE employee_id = $1
         ORDER BY create_date DESC
         LIMIT 10`,
        [employee.id]
      );
      
      if (leaveResult.rows.length === 0) {
        console.log('   ❌ No leave requests found');
      } else {
        console.log(`   ✅ Found ${leaveResult.rows.length} leave requests:`);
        leaveResult.rows.forEach((leave, idx) => {
          console.log(`   ${idx + 1}. ID: ${leave.id}`);
          console.log(`      Description: ${leave.description}`);
          console.log(`      From: ${leave.date_from} To: ${leave.date_to}`);
          console.log(`      Days: ${leave.number_of_days}`);
          console.log(`      State: ${leave.state}`);
          console.log(`      Holiday Status ID: ${leave.holiday_status_id}`);
          console.log('      ---');
        });
      }
      
      // Check leave types
      console.log(`\n🏷️ Available Leave Types:`);
      const typeResult = await pool.query(
        `SELECT id, name FROM hr_leave_type ORDER BY id`
      );
      
      typeResult.rows.forEach(type => {
        console.log(`   ${type.id}: ${type.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugLeaveIssues();
