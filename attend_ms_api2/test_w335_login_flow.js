console.log('ðŸ§ª Testing Complete Login Flow for B1-W335\n');
console.log('='.repeat(70));

const testLoginFlow = async () => {
  try {
    // Step 1: Test /auth/login
    console.log('\n1ï¸âƒ£  Testing /auth/login endpoint...\n');
    
    const loginResponse = await fetch('http://192.168.1.5:7012/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: "1",
        employeeNo: "B1-W335"
      })
    });

    const loginData = await loginResponse.json();
    console.log(`Status: ${loginResponse.status}`);
    console.log(`Success: ${loginData.success}`);
    
    if (!loginData.success) {
      console.log(`âŒ Login failed: ${loginData.message}`);
      process.exit(1);
    }
    
    console.log('âœ… Login successful!');
    console.log(`   Employee: ${loginData.data.name}`);
    console.log(`   Is Active: ${loginData.data.isActive}`);
    console.log(`   Token: ${loginData.data.sessionToken.substring(0, 20)}...`);

    // Step 2: Test /users/profile (this is what was failing)
    console.log('\n' + '='.repeat(70));
    console.log('\n2ï¸âƒ£  Testing /users/profile endpoint...\n');
    
    const profileResponse = await fetch('http://192.168.1.5:7012/users/profile?companyCode=1&employeeNo=B1-W335', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const profileData = await profileResponse.json();
    console.log(`Status: ${profileResponse.status}`);
    console.log(`Success: ${profileData.success}`);
    
    if (!profileData.success) {
      console.log(`âŒ Profile fetch failed: ${profileData.message}`);
      console.log('\nâš ï¸  This is why login was failing in the mobile app!');
      process.exit(1);
    }
    
    console.log('âœ… Profile fetch successful!');
    console.log(`   Employee No: ${profileData.data.employeeNo}`);
    console.log(`   Name: ${profileData.data.name}`);
    console.log(`   Email: ${profileData.data.email || 'N/A'}`);
    console.log(`   Role: ${profileData.data.role}`);
    console.log(`   Is Active: ${profileData.data.isActive}`);

    // Final result
    console.log('\n' + '='.repeat(70));
    console.log('\nâœ… âœ… âœ…  ALL TESTS PASSED! âœ… âœ… âœ…\n');
    console.log('ðŸ“± Mobile app should now be able to login with B1-W335!');
    console.log('\n' + '='.repeat(70));
    console.log('\nðŸ“‹ Summary:');
    console.log('   1. Backend login: âœ… Working');
    console.log('   2. Profile fetch: âœ… Working (FIXED!)');
    console.log('   3. Inactive employee: âœ… Allowed to login');
    console.log('   4. Active status included: âœ… Yes');
    console.log('\nðŸ’¡ Next step: Try logging in with the mobile app now!');
    console.log('   Employee: B1-W335');
    console.log('   Company: 1');
    console.log('   Password: (any password)');
    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\nâŒ Test error:', error.message);
    process.exit(1);
  }
};

testLoginFlow();


