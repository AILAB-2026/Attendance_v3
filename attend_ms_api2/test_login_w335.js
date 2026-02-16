import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Testing Login for B1-W335\n');
console.log('='.repeat(60));

// Test the login API
const testLogin = async () => {
  try {
    console.log('\n1. Checking employee status in database...\n');
    
    const { query } = await import('./src/dbconn.js');
    
    query(`
      SELECT id, "x_Emp_No", name, active, company_id
      FROM hr_employee
      WHERE "x_Emp_No" = 'B1-W335' AND company_id = 1
    `, [], async (err, res) => {
      if (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
      }

      if (res.rows.length === 0) {
        console.log('❌ Employee B1-W335 not found');
        process.exit(1);
      }

      const employee = res.rows[0];
      console.log('Employee Details:');
      console.log(`  ID: ${employee.id}`);
      console.log(`  Employee No: ${employee.x_Emp_No}`);
      console.log(`  Name: ${employee.name}`);
      console.log(`  Active: ${employee.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      console.log(`  Company: ${employee.company_id}`);

      console.log('\n' + '='.repeat(60));
      console.log('\n2. Testing login API call...\n');

      // Test login API
      const loginResponse = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyCode: "1",
          employeeNo: "B1-W335"
        })
      });

      const loginData = await loginResponse.json();
      
      console.log('Login Response:');
      console.log(`  Status: ${loginResponse.status}`);
      console.log(`  Success: ${loginData.success}`);
      console.log(`  Message: ${loginData.message}`);
      
      if (loginData.data) {
        console.log('\nLogin Data:');
        console.log(`  Employee No: ${loginData.data.employeeNo}`);
        console.log(`  Name: ${loginData.data.name}`);
        console.log(`  Email: ${loginData.data.email}`);
        console.log(`  Role: ${loginData.data.role}`);
        console.log(`  Company Code: ${loginData.data.companyCode}`);
        console.log(`  Is Active: ${loginData.data.isActive}`);
        console.log(`  Session Token: ${loginData.data.sessionToken ? loginData.data.sessionToken.substring(0, 30) + '...' : 'MISSING'}`);
      }

      console.log('\n' + '='.repeat(60));
      console.log('\n3. Analysis:\n');

      if (loginData.success) {
        console.log('✅ Backend login successful');
        
        if (!loginData.data) {
          console.log('❌ PROBLEM: No data object in response!');
          console.log('   Mobile app expects data object with user info');
        } else if (!loginData.data.sessionToken) {
          console.log('❌ PROBLEM: No sessionToken in response!');
          console.log('   Mobile app needs sessionToken to proceed');
        } else if (loginData.data.isActive === false) {
          console.log('⚠️  Employee is INACTIVE');
          console.log('   Login allowed but features will be restricted');
        } else {
          console.log('✅ All required fields present');
          console.log('   Mobile app should accept this login');
        }
      } else {
        console.log('❌ Backend login failed');
        console.log(`   Reason: ${loginData.message}`);
      }

      console.log('\n' + '='.repeat(60));
      console.log('\n4. Recommendations:\n');

      if (!employee.active) {
        console.log('⚠️  Employee B1-W335 is INACTIVE');
        console.log('   To activate:');
        console.log('   UPDATE hr_employee SET active = true WHERE "x_Emp_No" = \'B1-W335\' AND company_id = 1;');
      }

      if (loginData.success && loginData.data && loginData.data.sessionToken) {
        console.log('✅ Login response is correct');
        console.log('   If mobile app still fails:');
        console.log('   1. Check mobile app console logs');
        console.log('   2. Verify API URL in mobile app');
        console.log('   3. Check network connectivity');
        console.log('   4. Rebuild APK with latest code');
      }

      console.log('\n' + '='.repeat(60));
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
};

testLogin();
