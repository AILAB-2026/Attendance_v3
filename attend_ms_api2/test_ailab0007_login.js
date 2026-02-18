import fetch from 'node-fetch';

const API_BASE_URL = 'http://192.168.1.4:7012';

async function testAILABLogin() {
  console.log('\n=== Testing AILAB Login (AILAB0007) ===\n');

  try {
    // Step 1: Login
    console.log('ðŸ“‹ Step 1: Attempting login...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login-multi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyCode: 'AILAB',
        employeeNo: 'AILAB0007',
        password: 'Test@123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login Response Status:', loginResponse.status);
    console.log('Login Response:', JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      console.log('âŒ Login failed:', loginData.message);
      return;
    }

    const sessionToken = loginData.data?.sessionToken;
    console.log('âœ… Login successful');
    console.log('   SessionToken:', sessionToken?.substring(0, 30) + '...');

    // Step 2: Get user profile
    console.log('\nðŸ“‹ Step 2: Fetching user profile...');
    const profileResponse = await fetch(`${API_BASE_URL}/users/profile?companyCode=AILAB&employeeNo=AILAB0007`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    const profileData = await profileResponse.json();
    console.log('Profile Response Status:', profileResponse.status);
    console.log('Profile Response:', JSON.stringify(profileData, null, 2));

    if (profileData.success) {
      console.log('\nâœ… Profile fetched successfully');
      console.log('   Employee:', profileData.data?.name);
      console.log('   Employee No:', profileData.data?.employeeNo);
      console.log('   Company Code:', profileData.data?.companyCode);
      console.log('   Payroll Enable:', profileData.data?.payrollEnable);
    } else {
      console.log('âŒ Profile fetch failed:', profileData.message);
    }

  } catch (err) {
    console.error('âŒ Error:', err.message);
  }

  console.log('\n=== Test Complete ===\n');
}

testAILABLogin();



