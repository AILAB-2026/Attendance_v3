import fetch from 'node-fetch';

async function emergencyFixSites() {
  try {
    console.log("=== EMERGENCY: FIXING SITES DROPDOWN FOR CLOCK IN ===");
    console.log("ðŸš¨ Employees can't clock in because sites dropdown is empty!");
    console.log("");
    
    // Test login first
    console.log("1. ðŸ” Testing login...");
    const loginResponse = await fetch("http://192.168.1.5:7012/auth/login", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: "1",
        employeeNo: "B1-W422", 
        password: "Test@123"
      })
    });
    
    if (!loginResponse.ok) {
      console.log("âŒ CRITICAL: Login is broken!");
      return;
    }
    
    const loginResult = await loginResponse.json();
    const sessionToken = loginResult.data.sessionToken;
    console.log("âœ… Login working");
    
    // Test the original sites endpoint that the APK is probably calling
    console.log("\n2. ðŸ¢ Testing sites endpoint that APK is calling...");
    
    const sitesResponse = await fetch("http://192.168.1.5:7012/sites", {
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
        console.log(`âœ… GOOD: Sites endpoint returns ${sitesResult.data.sites.length} sites`);
        console.log("ðŸ“± APK should be able to get sites for clock in");
        
        console.log("\nðŸ¢ Available sites for clock in:");
        sitesResult.data.sites.forEach((site, index) => {
          console.log(`   ${index + 1}. ${site.siteName} (ID: ${site.siteId})`);
        });
        
      } else {
        console.log("âŒ CRITICAL: Sites endpoint returns no sites!");
        console.log("ðŸš¨ This is why employees can't clock in!");
        
        // Check what format the APK might be expecting
        console.log("\nðŸ” Checking if APK expects different format...");
        
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
      console.log("âŒ CRITICAL: Sites endpoint is broken!");
      const errorText = await sitesResponse.text();
      console.log("Error:", errorText);
    }
    
    // Also test the attendance endpoints to see if they're working
    console.log("\n3. ðŸ• Testing attendance endpoints...");
    
    const attendanceStatusResponse = await fetch("http://192.168.1.5:7012/attendance/status", {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Attendance status: ${attendanceStatusResponse.status}`);
    
    if (attendanceStatusResponse.ok) {
      const attendanceResult = await attendanceStatusResponse.json();
      console.log("âœ… Attendance status endpoint working");
    } else {
      console.log("âŒ Attendance status endpoint broken");
    }
    
    console.log("\nðŸŽ¯ EMERGENCY DIAGNOSIS:");
    console.log("   - Login: Working âœ…");
    console.log("   - Sites: " + (sitesResult?.data?.sites?.length > 0 ? "Working âœ…" : "BROKEN âŒ"));
    console.log("   - Clock in: " + (sitesResult?.data?.sites?.length > 0 ? "Should work âœ…" : "BLOCKED âŒ"));
    
    if (!sitesResult?.data?.sites?.length) {
      console.log("\nðŸš¨ IMMEDIATE ACTION REQUIRED:");
      console.log("   1. Sites dropdown is empty");
      console.log("   2. Employees cannot select a site");
      console.log("   3. Clock in will fail");
      console.log("   4. This is a production emergency!");
    }
    
  } catch (error) {
    console.error("âŒ CRITICAL ERROR:", error.message);
  }
}

emergencyFixSites();


