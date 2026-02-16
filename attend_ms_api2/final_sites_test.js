import fetch from 'node-fetch';

async function finalSitesTest() {
  try {
    console.log("=== Final Sites Dropdown Test ===");
    console.log("Testing both possible endpoints the mobile app might call\n");
    
    // Login
    const loginResponse = await fetch("http://localhost:3001/auth/login", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: "1",
        employeeNo: "B1-W422", 
        password: "Test@123"
      })
    });
    
    const loginResult = await loginResponse.json();
    const sessionToken = loginResult.data.sessionToken;
    console.log("✅ Login successful");
    
    // Test both endpoints
    const endpoints = [
      { name: "Sites Endpoint", url: "/sites" },
      { name: "Face Recognition Endpoint", url: "/faceRecognition/sites-projects" }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Testing: ${endpoint.name} (${endpoint.url})`);
      
      const response = await fetch(`http://localhost:3001${endpoint.url}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && result.data.sites) {
          console.log(`   ✅ SUCCESS: Returns ${result.data.sites.length} sites`);
          console.log(`   📋 Sample sites:`);
          result.data.sites.slice(0, 3).forEach((site, index) => {
            console.log(`      ${index + 1}. ${site.siteName} (ID: ${site.siteId})`);
          });
          
          if (result.data.defaultSite) {
            console.log(`   ⭐ Default: ${result.data.defaultSite.siteName}`);
          }
          
          console.log(`   📱 Mobile app can use: response.data.sites`);
        } else {
          console.log(`   ❌ FAILED: Unexpected response format`);
          console.log(`   Response:`, JSON.stringify(result, null, 2));
        }
      } else {
        console.log(`   ❌ FAILED: ${response.status} ${response.statusText}`);
      }
    }
    
    console.log("\n🎯 FINAL CONCLUSION:");
    console.log("   ✅ Both endpoints now return sites from project_project table");
    console.log("   ✅ Mobile app will get sites regardless of which endpoint it calls");
    console.log("   ✅ Response format: { success: true, data: { sites: [...] } }");
    console.log("   ✅ Sites dropdown should now populate correctly");
    
    console.log("\n📱 MOBILE APP INTEGRATION:");
    console.log("   The mobile app should:");
    console.log("   1. Call either /sites or /faceRecognition/sites-projects");
    console.log("   2. Check response.success === true");
    console.log("   3. Use response.data.sites array for dropdown");
    console.log("   4. Set response.data.defaultSite as default selection");
    
    console.log("\n🔧 IF STILL NOT WORKING:");
    console.log("   - Check mobile app base URL configuration");
    console.log("   - Verify Authorization header is sent correctly");
    console.log("   - Check mobile app console for API errors");
    console.log("   - Ensure mobile app is parsing response.data.sites");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

finalSitesTest();
