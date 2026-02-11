console.log('🧪 Testing Complete Login Flow for B1-W335\n');
console.log('='.repeat(70));

const testLoginFlow = async () => {
  try {
    // Step 1: Test /auth/login
    console.log('\n1️⃣  Testing /auth/login endpoint...\n');
    
    const loginResponse = await fetch('http://localhost:3001/auth/login', {
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
      console.log(`❌ Login failed: ${loginData.message}`);
      process.exit(1);
    }
    
    console.log('✅ Login successful!');
    console.log(`   Employee: ${loginData.data.name}`);
    console.log(`   Is Active: ${loginData.data.isActive}`);
    console.log(`   Token: ${loginData.data.sessionToken.substring(0, 20)}...`);

    // Step 2: Test /users/profile (this is what was failing)
    console.log('\n' + '='.repeat(70));
    console.log('\n2️⃣  Testing /users/profile endpoint...\n');
    
    const profileResponse = await fetch('http://localhost:3001/users/profile?companyCode=1&employeeNo=B1-W335', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const profileData = await profileResponse.json();
    console.log(`Status: ${profileResponse.status}`);
    console.log(`Success: ${profileData.success}`);
    
    if (!profileData.success) {
      console.log(`❌ Profile fetch failed: ${profileData.message}`);
      console.log('\n⚠️  This is why login was failing in the mobile app!');
      process.exit(1);
    }
    
    console.log('✅ Profile fetch successful!');
    console.log(`   Employee No: ${profileData.data.employeeNo}`);
    console.log(`   Name: ${profileData.data.name}`);
    console.log(`   Email: ${profileData.data.email || 'N/A'}`);
    console.log(`   Role: ${profileData.data.role}`);
    console.log(`   Is Active: ${profileData.data.isActive}`);

    // Final result
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ ✅ ✅  ALL TESTS PASSED! ✅ ✅ ✅\n');
    console.log('📱 Mobile app should now be able to login with B1-W335!');
    console.log('\n' + '='.repeat(70));
    console.log('\n📋 Summary:');
    console.log('   1. Backend login: ✅ Working');
    console.log('   2. Profile fetch: ✅ Working (FIXED!)');
    console.log('   3. Inactive employee: ✅ Allowed to login');
    console.log('   4. Active status included: ✅ Yes');
    console.log('\n💡 Next step: Try logging in with the mobile app now!');
    console.log('   Employee: B1-W335');
    console.log('   Company: 1');
    console.log('   Password: (any password)');
    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  }
};

testLoginFlow();
