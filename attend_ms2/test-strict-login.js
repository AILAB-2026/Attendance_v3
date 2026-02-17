/**
 * Test Strict Database-Only Login
 * Run: node test-strict-login.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://192.168.1.5:7012';

async function testLogin(companyCode, employeeNo, password, testName) {
  console.log(`\n=== ${testName} ===`);
  console.log(`Company: ${companyCode}, Employee: ${employeeNo}, Password: ${password ? '***' : '(empty)'}`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyCode, employeeNo, password })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`âœ… SUCCESS (${response.status})`);
      console.log(`   Message: ${data.message}`);
      console.log(`   User: ${data.data?.name}`);
      console.log(`   Session: ${data.data?.sessionToken ? 'Created' : 'None'}`);
    } else {
      console.log(`âŒ FAILED (${response.status})`);
      console.log(`   Message: ${data.message}`);
    }
  } catch (error) {
    console.log(`âŒ ERROR: ${error.message}`);
  }
}

async function runTests() {
  console.log('===========================================');
  console.log('  Strict Database-Only Login Tests');
  console.log('===========================================');
  console.log(`API: ${API_BASE_URL}`);

  // Test 1: Valid credentials (should succeed)
  await testLogin('AILAB', 'RA002', 'password123', 'Test 1: Valid Credentials');

  // Test 2: Wrong password (should fail)
  await testLogin('AILAB', 'RA002', 'wrongpassword', 'Test 2: Wrong Password');

  // Test 3: Non-existent user (should fail)
  await testLogin('AILAB', 'NOTEXIST', 'password123', 'Test 3: Non-existent User');

  // Test 4: Non-existent company (should fail)
  await testLogin('NOTEXIST', 'RA002', 'password123', 'Test 4: Non-existent Company');

  // Test 5: Empty password (should fail)
  await testLogin('AILAB', 'RA002', '', 'Test 5: Empty Password');

  // Test 6: Missing fields (should fail)
  console.log('\n=== Test 6: Missing Fields ===');
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyCode: 'AILAB' }) // Missing employeeNo and password
    });
    const data = await response.json();
    console.log(`âŒ FAILED (${response.status})`);
    console.log(`   Message: ${data.message}`);
  } catch (error) {
    console.log(`âŒ ERROR: ${error.message}`);
  }

  console.log('\n===========================================');
  console.log('  Tests Complete');
  console.log('===========================================\n');
  
  console.log('Expected Results:');
  console.log('âœ… Test 1: Should succeed (valid credentials)');
  console.log('âŒ Test 2: Should fail (wrong password)');
  console.log('âŒ Test 3: Should fail (user not found)');
  console.log('âŒ Test 4: Should fail (company not found)');
  console.log('âŒ Test 5: Should fail (empty password)');
  console.log('âŒ Test 6: Should fail (missing fields)');
  console.log('\nNote: Update test credentials to match your database');
}

// Run tests
runTests().catch(console.error);


