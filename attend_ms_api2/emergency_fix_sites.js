import fetch from 'node-fetch';

async function emergencyFixSites() {
  try {
    console.log("=== EMERGENCY: FIXING SITES DROPDOWN FOR CLOCK IN ===");
    console.log("🚨 Employees can't clock in because sites dropdown is empty!");
    console.log("");
    
    // Test login first
    console.log("1. 🔐 Testing login...");
    const loginResponse = await fetch("http://localhost:3001/auth/login", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: "1",
        employeeNo: "B1-W422", 
        password: "Test@123"
      })
    });
    
    if (!loginResponse.ok) {
      console.log("❌ CRITICAL: Login is broken!");
      return;
    }
    
    const loginResult = await loginResponse.json();
    const sessionToken = loginResult.data.sessionToken;
    console.log("✅ Login working");
    
    // Test the original sites endpoint that the APK is probably calling
    console.log("\n2. 🏢 Testing sites endpoint that APK is calling...");
    
    const sitesResponse = await fetch("http://localhost:3001/sites", {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Sites endpoint status: ${sitesResponse.status}`);
    
    if (sitesResponse.ok) {
      const sitesResult = await sitesResponse.json();
      console.log("Sites response:", JSON.stringify(sitesResult, null, 2));
      
      if (sitesResult.success && sitesResult.data && sitesResult.data.sites && sitesResult.data.sites.length > 0) {
        console.log(`✅ GOOD: Sites endpoint returns ${sitesResult.data.sites.length} sites`);
        console.log("📱 APK should be able to get sites for clock in");
        
        console.log("\n🏢 Available sites for clock in:");
        sitesResult.data.sites.forEach((site, index) => {
          console.log(`   ${index + 1}. ${site.siteName} (ID: ${site.siteId})`);
        });
        
      } else {
        console.log("❌ CRITICAL: Sites endpoint returns no sites!");
        console.log("🚨 This is why employees can't clock in!");
        
        // Check what format the APK might be expecting
        console.log("\n🔍 Checking if APK expects different format...");
        
        // Test if APK expects direct array
        if (Array.isArray(sitesResult)) {
          console.log("APK might expect direct array format");
        } else if (sitesResult.sites) {
          console.log("APK might expect { sites: [...] } format");
        } else {
          console.log("Unknown format expected by APK");
        }
      }
    } else {
      console.log("❌ CRITICAL: Sites endpoint is broken!");
      const errorText = await sitesResponse.text();
      console.log("Error:", errorText);
    }
    
    // Also test the attendance endpoints to see if they're working
    console.log("\n3. 🕐 Testing attendance endpoints...");
    
    const attendanceStatusResponse = await fetch("http://localhost:3001/attendance/status", {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Attendance status: ${attendanceStatusResponse.status}`);
    
    if (attendanceStatusResponse.ok) {
      const attendanceResult = await attendanceStatusResponse.json();
      console.log("✅ Attendance status endpoint working");
    } else {
      console.log("❌ Attendance status endpoint broken");
    }
    
    console.log("\n🎯 EMERGENCY DIAGNOSIS:");
    console.log("   - Login: Working ✅");
    console.log("   - Sites: " + (sitesResult?.data?.sites?.length > 0 ? "Working ✅" : "BROKEN ❌"));
    console.log("   - Clock in: " + (sitesResult?.data?.sites?.length > 0 ? "Should work ✅" : "BLOCKED ❌"));
    
    if (!sitesResult?.data?.sites?.length) {
      console.log("\n🚨 IMMEDIATE ACTION REQUIRED:");
      console.log("   1. Sites dropdown is empty");
      console.log("   2. Employees cannot select a site");
      console.log("   3. Clock in will fail");
      console.log("   4. This is a production emergency!");
    }
    
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
  }
}

emergencyFixSites();
