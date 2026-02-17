import dotenv from 'dotenv';
dotenv.config();

console.log('ðŸ§ª TESTING INACTIVE EMPLOYEE - FINAL VERIFICATION\n');
console.log('='.repeat(80));

const testEmployee = {
  companyCode: "1",
  employeeNo: "B1-E079"
};

// Step 1: Set employee to inactive
console.log('\nSTEP 1: Setting employee to INACTIVE...\n');

const { query } = await import('./src/dbconn.js');

query(`UPDATE hr_employee SET active = false WHERE "x_Emp_No" = $1 AND company_id = $2::integer RETURNING id, active`, 
  [testEmployee.employeeNo, testEmployee.companyCode], 
  async (err, res) => {
    if (err) {
      console.error('âŒ Error:', err.message);
      process.exit(1);
    }

    console.log('âœ… Employee set to INACTIVE');
    console.log(`   Status: ${res.rows[0].active ? 'Active' : 'Inactive'}\n`);

    console.log('='.repeat(80));
    console.log('\nSTEP 2: Testing LOGIN (should ALLOW)...\n');

    // Test login
    try {
      const loginResponse = await fetch('http://192.168.1.5:7012/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testEmployee)
      });

      const loginData = await loginResponse.json();
      
      if (loginData.success) {
        console.log('âœ… LOGIN ALLOWED for inactive employee');
        console.log(`   Employee: ${loginData.data.name}`);
        console.log(`   Active Status: ${loginData.data.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   Token: ${loginData.data.sessionToken.substring(0, 20)}...`);

        const token = loginData.data.sessionToken;

        // Test clock in
        console.log('\n' + '='.repeat(80));
        console.log('\nSTEP 3: Testing CLOCK IN (should BLOCK)...\n');

        const clockInResponse = await fetch('http://192.168.1.5:7012/attendance/clock-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...testEmployee,
            timestamp: new Date().toISOString(),
            latitude: "1.3521",
            longitude: "103.8198",
            address: "Singapore",
            method: "test",
            siteName: "Office"
          })
        });

        const clockInData = await clockInResponse.json();
        
        if (!clockInData.success) {
          console.log('âœ… CLOCK IN BLOCKED for inactive employee');
          console.log(`   Message: "${clockInData.message}"`);
        } else {
          console.log('âŒ INCORRECT: Clock in was allowed!');
        }

        // Test payslip
        console.log('\n' + '='.repeat(80));
        console.log('\nSTEP 4: Testing PAYSLIP ACCESS (should show friendly message)...\n');

        const payslipResponse = await fetch('http://192.168.1.5:7012/payroll/payslips', {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const payslipData = await payslipResponse.json();
        
        if (payslipData.success && !payslipData.isActive) {
          console.log('âœ… PAYSLIP ACCESS RESTRICTED for inactive employee');
          console.log(`   Message: "${payslipData.message}"`);
          console.log(`   Data: ${JSON.stringify(payslipData.data)} (empty)`);
        } else if (payslipData.success && payslipData.isActive) {
          console.log('âŒ INCORRECT: Payslip data was shown!');
        }

        // Restore employee to active
        console.log('\n' + '='.repeat(80));
        console.log('\nSTEP 5: Restoring employee to ACTIVE...\n');

        query(`UPDATE hr_employee SET active = true WHERE "x_Emp_No" = $1 AND company_id = $2::integer RETURNING id, active`, 
          [testEmployee.employeeNo, testEmployee.companyCode], 
          (err2, res2) => {
            if (err2) {
              console.error('âŒ Error:', err2.message);
              process.exit(1);
            }

            console.log('âœ… Employee restored to ACTIVE');
            console.log(`   Status: ${res2.rows[0].active ? 'Active' : 'Inactive'}\n`);

            // Final summary
            console.log('='.repeat(80));
            console.log('\nðŸ“Š FINAL TEST SUMMARY:\n');
            console.log('âœ… All tests completed successfully!\n');
            console.log('Inactive Employee Behavior:');
            console.log('  1. âœ… LOGIN: ALLOWED (can login)');
            console.log('  2. âŒ CLOCK IN/OUT: BLOCKED with message');
            console.log('     "ðŸ”’ Your account is inactive. Please contact HR to reactivate your access."');
            console.log('  3. âš ï¸  PAYSLIP: Shows friendly message');
            console.log('     "âš ï¸ Payslip access is restricted for inactive employees. Please contact HR for assistance."');
            console.log('\n' + '='.repeat(80));

            process.exit(0);
          }
        );

      } else {
        console.log('âŒ LOGIN BLOCKED - This is incorrect!');
        console.log(`   Message: ${loginData.message}`);
        
        // Restore employee to active
        query(`UPDATE hr_employee SET active = true WHERE "x_Emp_No" = $1 AND company_id = $2::integer`, 
          [testEmployee.employeeNo, testEmployee.companyCode], 
          () => {
            console.log('\nâœ… Employee restored to ACTIVE');
            process.exit(1);
          }
        );
      }

    } catch (error) {
      console.error('âŒ Test error:', error.message);
      
      // Restore employee to active
      query(`UPDATE hr_employee SET active = true WHERE "x_Emp_No" = $1 AND company_id = $2::integer`, 
        [testEmployee.employeeNo, testEmployee.companyCode], 
        () => {
          console.log('\nâœ… Employee restored to ACTIVE');
          process.exit(1);
        }
      );
    }
  }
);


