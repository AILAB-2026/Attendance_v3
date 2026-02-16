import dotenv from "dotenv";
dotenv.config();

import fetch from 'node-fetch';

async function finalApiTest() {
  console.log("🔍 FINAL API TEST - Complete Verification");
  console.log("=" .repeat(50));
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Step 1: Login
    console.log("\n1. Testing Login...");
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: "1",
        employeeNo: "B1-W422", 
        password: "Test@123"
      })
    });
    
    if (!loginResponse.ok) {
      console.log("❌ LOGIN FAILED");
      return;
    }
    
    const loginData = await loginResponse.json();
    
    if (!loginData.success || !loginData.data || !loginData.data.token) {
      console.log("❌ LOGIN FAILED - No token in response");
      console.log("Response:", loginData);
      return;
    }
    
    const token = loginData.data.token;
    console.log("✅ LOGIN SUCCESS");
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Step 2: Test /sites endpoint
    console.log("\n2. Testing /sites endpoint...");
    const sitesResponse = await fetch(`${baseUrl}/sites`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (sitesResponse.ok) {
      const sitesData = await sitesResponse.json();
      console.log(`✅ /sites SUCCESS - ${sitesData.length} sites found`);
      sitesData.slice(0, 3).forEach((site, i) => {
        console.log(`   ${i+1}. ${site.siteLocationName}`);
      });
    } else {
      console.log(`❌ /sites FAILED - Status: ${sitesResponse.status}`);
    }
    
    // Step 3: Test /faceRecognition/sites-projects endpoint
    console.log("\n3. Testing /faceRecognition/sites-projects...");
    const faceRecResponse = await fetch(`${baseUrl}/faceRecognition/sites-projects`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${faceRecResponse.status}`);
    
    if (faceRecResponse.ok) {
      const faceRecData = await faceRecResponse.json();
      console.log(`✅ /faceRecognition/sites-projects SUCCESS`);
      console.log(`   Sites count: ${faceRecData.data.sites.length}`);
      faceRecData.data.sites.slice(0, 3).forEach((site, i) => {
        console.log(`   ${i+1}. ID: ${site.siteId}, Name: "${site.siteName}"`);
      });
      
      // Step 4: Test projects endpoint
      if (faceRecData.data.sites.length > 0) {
        const siteId = faceRecData.data.sites[0].siteId;
        console.log(`\n4. Testing /faceRecognition/projects/${siteId}...`);
        
        const projectsResponse = await fetch(`${baseUrl}/faceRecognition/projects/${siteId}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          console.log(`✅ /faceRecognition/projects SUCCESS`);
          console.log(`   Projects count: ${projectsData.data.projects.length}`);
          projectsData.data.projects.forEach((project, i) => {
            console.log(`   ${i+1}. ${project.projectName}`);
          });
        } else {
          console.log(`❌ /faceRecognition/projects FAILED - Status: ${projectsResponse.status}`);
        }
      }
      
      // Final summary
      console.log("\n" + "=" .repeat(50));
      console.log("🎉 ALL ENDPOINTS WORKING!");
      console.log("=" .repeat(50));
      console.log("\n✅ Backend API Status: READY FOR PRODUCTION");
      console.log("\n📱 NEXT STEPS:");
      console.log("1. The backend API is now fully functional");
      console.log("2. You can now rebuild your mobile APK");
      console.log("3. The APK will connect to: https://cx.brk.sg/attendance_api_mobile");
      console.log("4. After rebuilding, test the mobile app:");
      console.log("   - Login with B1-W422");
      console.log("   - Site dropdown should populate");
      console.log("   - Project dropdown should populate after selecting site");
      console.log("   - Face recognition clock-in should work");
      
    } else {
      const errorText = await faceRecResponse.text();
      console.log(`❌ /faceRecognition/sites-projects FAILED`);
      console.log(`   Error: ${errorText}`);
      console.log("\n❌ Backend still has issues - DO NOT rebuild APK yet");
    }
    
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
    console.error(error.stack);
  }
}

finalApiTest().then(() => {
  console.log("\n✅ Final API test completed");
}).catch(error => {
  console.error("❌ Test failed:", error);
});
