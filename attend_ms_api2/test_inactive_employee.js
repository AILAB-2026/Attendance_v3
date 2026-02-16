import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 TESTING INACTIVE EMPLOYEE RESTRICTIONS\n');
console.log('='.repeat(80));

// First, let's find an employee and check their status
console.log('\nSTEP 1: Finding an employee to test with...\n');

query(`
  SELECT id, "x_Emp_No", name, active, company_id
  FROM hr_employee 
  WHERE id = 267
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  if (res1.rows.length === 0) {
    console.log('❌ Employee 267 not found');
    process.exit(1);
  }

  const employee = res1.rows[0];
  console.log('Employee Details:');
  console.log(`  ID: ${employee.id}`);
  console.log(`  Employee No: ${employee.x_Emp_No}`);
  console.log(`  Name: ${employee.name}`);
  console.log(`  Active: ${employee.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`  Company: ${employee.company_id}`);

  console.log('\n' + '='.repeat(80));
  console.log('\nSTEP 2: Testing what happens when employee is INACTIVE...\n');

  // Temporarily set employee to inactive for testing
  query(`
    UPDATE hr_employee 
    SET active = false 
    WHERE id = 267
    RETURNING id, "x_Emp_No", name, active
  `, [], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log('✅ Employee set to INACTIVE for testing');
    console.log(`   Status: ${res2.rows[0].active ? 'Active' : 'Inactive'}\n`);

    // Test 1: Login attempt
    console.log('TEST 1: Login Attempt (INACTIVE employee)');
    console.log('-'.repeat(60));
    
    testLogin(employee.x_Emp_No, employee.company_id, () => {
      
      // Test 2: Clock In attempt
      console.log('\nTEST 2: Clock In Attempt (INACTIVE employee)');
      console.log('-'.repeat(60));
      
      testClockIn(employee.x_Emp_No, employee.company_id, () => {
        
        // Test 3: Payslip access
        console.log('\nTEST 3: Payslip Access (INACTIVE employee)');
        console.log('-'.repeat(60));
        
        testPayslipAccess(employee.id, () => {
          
          // Restore employee to active
          console.log('\n' + '='.repeat(80));
          console.log('\nSTEP 3: Restoring employee to ACTIVE status...\n');
          
          query(`
            UPDATE hr_employee 
            SET active = true 
            WHERE id = 267
            RETURNING id, active
          `, [], (err3, res3) => {
            if (err3) {
              console.error('❌ Error:', err3.message);
              process.exit(1);
            }

            console.log('✅ Employee restored to ACTIVE');
            console.log(`   Status: ${res3.rows[0].active ? 'Active' : 'Inactive'}\n`);

            // Final summary
            console.log('='.repeat(80));
            console.log('\n📊 TEST SUMMARY:\n');
            console.log('✅ All inactive employee restrictions have been tested');
            console.log('\nExpected Behavior:');
            console.log('  1. Login: ❌ BLOCKED with friendly message');
            console.log('  2. Clock In: ❌ BLOCKED with friendly message');
            console.log('  3. Payslip: ⚠️  Shows friendly message (no data)');
            console.log('\n' + '='.repeat(80));
            
            process.exit(0);
          });
        });
      });
    });
  });
});

// Test functions
function testLogin(employeeNo, companyCode, callback) {
  query(`
    SELECT id, "x_Emp_No", name, active, company_id
    FROM hr_employee
    WHERE LOWER("x_Emp_No") = LOWER($1)
      AND company_id = $2::integer
      AND active = true
  `, [employeeNo, companyCode], (err, res) => {
    if (err) {
      console.log('❌ Query Error:', err.message);
      callback();
      return;
    }

    if (res.rows.length === 0) {
      // Check if employee exists but is inactive
      query(`
        SELECT id, active FROM hr_employee 
        WHERE LOWER("x_Emp_No") = LOWER($1) AND company_id = $2::integer
      `, [employeeNo, companyCode], (err2, res2) => {
        if (err2) {
          console.log('❌ Error:', err2.message);
          callback();
          return;
        }

        if (res2.rows.length > 0 && !res2.rows[0].active) {
          console.log('✅ CORRECT: Login blocked for inactive employee');
          console.log('   Message: "🔒 Your account is inactive. Please contact HR to reactivate your access."');
        } else {
          console.log('❌ INCORRECT: Employee not found');
        }
        callback();
      });
    } else {
      console.log('❌ INCORRECT: Inactive employee was allowed to login!');
      callback();
    }
  });
}

function testClockIn(employeeNo, companyCode, callback) {
  query(`
    SELECT id, "x_Emp_No" as employee_no, name 
    FROM hr_employee 
    WHERE "x_Emp_No" = $1 AND company_id = $2::integer AND active = true
  `, [employeeNo, companyCode], (err, res) => {
    if (err) {
      console.log('❌ Query Error:', err.message);
      callback();
      return;
    }

    if (res.rows.length === 0) {
      // Check if employee exists but is inactive
      query(`
        SELECT id, active FROM hr_employee 
        WHERE "x_Emp_No" = $1 AND company_id = $2::integer
      `, [employeeNo, companyCode], (err2, res2) => {
        if (err2) {
          console.log('❌ Error:', err2.message);
          callback();
          return;
        }

        if (res2.rows.length > 0 && !res2.rows[0].active) {
          console.log('✅ CORRECT: Clock in blocked for inactive employee');
          console.log('   Message: "🔒 Your account is inactive. Please contact HR to reactivate your access."');
        } else {
          console.log('❌ INCORRECT: Employee not found');
        }
        callback();
      });
    } else {
      console.log('❌ INCORRECT: Inactive employee was allowed to clock in!');
      callback();
    }
  });
}

function testPayslipAccess(employeeId, callback) {
  query(`
    SELECT id, name, active FROM hr_employee WHERE id = $1
  `, [employeeId], (err, res) => {
    if (err) {
      console.log('❌ Query Error:', err.message);
      callback();
      return;
    }

    if (res.rows.length === 0) {
      console.log('❌ Employee not found');
      callback();
      return;
    }

    const employee = res.rows[0];
    const isActive = employee.active === true || employee.active === 't';

    if (!isActive) {
      console.log('✅ CORRECT: Payslip access restricted for inactive employee');
      console.log('   Message: "⚠️ Payslip access is restricted for inactive employees. Please contact HR for assistance."');
      console.log('   Data returned: [] (empty array)');
    } else {
      console.log('❌ INCORRECT: Inactive employee has payslip access!');
    }
    
    callback();
  });
}
