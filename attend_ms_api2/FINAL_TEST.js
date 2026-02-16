import dotenv from "dotenv";
dotenv.config();

import fetch from 'node-fetch';

console.log("=" .repeat(60));
console.log("🎯 FINAL COMPLETE API TEST");
console.log("=" .repeat(60));

async function finalCompleteTest() {
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Step 1: Login
    console.log("\n✅ STEP 1: Testing Login API");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyCode: "1", employeeNo: "B1-W422", password: "Test@123" })
    });
    
    const loginData = await loginRes.json();
    const token = loginData.data?.sessionToken || loginData.data?.token;
    
    if (!token) {
      console.log("❌ LOGIN FAILED - No token");
      return false;
    }
    
    console.log(`   ✓ Login successful for: ${loginData.data.name}`);
    console.log(`   ✓ Token obtained: ${token.substring(0, 20)}...`);
    
    // Step 2: Test /sites endpoint
    console.log("\n✅ STEP 2: Testing /sites endpoint (APK format)");
    const sitesRes = await fetch(`${baseUrl}/sites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!sitesRes.ok) {
      console.log(`❌ /sites FAILED - Status: ${sitesRes.status}`);
      return false;
    }
    
    const sitesData = await sitesRes.json();
    console.log(`   ✓ Sites loaded: ${sitesData.length} sites found`);
    sitesData.slice(0, 3).forEach((site, i) => {
      console.log(`   ${i+1}. ${site.siteLocationName}`);
    });
    
    // Step 3: Test /faceRecognition/sites-projects
    console.log("\n✅ STEP 3: Testing /faceRecognition/sites-projects");
    const faceRecRes = await fetch(`${baseUrl}/faceRecognition/sites-projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!faceRecRes.ok) {
      console.log(`❌ /faceRecognition/sites-projects FAILED - Status: ${faceRecRes.status}`);
      const errorText = await faceRecRes.text();
      console.log(`   Error: ${errorText}`);
      return false;
    }
    
    const faceRecData = await faceRecRes.json();
    console.log(`   ✓ Face recognition sites loaded: ${faceRecData.data.sites.length} sites`);
    faceRecData.data.sites.slice(0, 5).forEach((site, i) => {
      console.log(`   ${i+1}. ID: ${site.siteId}, Name: "${site.siteName}"`);
    });
    
    // Step 4: Test /faceRecognition/projects
    if (faceRecData.data.sites.length > 0) {
      const testSiteId = faceRecData.data.sites[0].siteId;
      console.log(`\n✅ STEP 4: Testing /faceRecognition/projects/${testSiteId}`);
      
      const projectsRes = await fetch(`${baseUrl}/faceRecognition/projects/${testSiteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!projectsRes.ok) {
        console.log(`❌ /faceRecognition/projects FAILED - Status: ${projectsRes.status}`);
        return false;
      }
      
      const projectsData = await projectsRes.json();
      console.log(`   ✓ Projects loaded: ${projectsData.data.projects.length} projects`);
      projectsData.data.projects.forEach((project, i) => {
        console.log(`   ${i+1}. ${project.projectName}`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error("\n❌ TEST ERROR:", error.message);
    return false;
  }
}

finalCompleteTest().then((success) => {
  console.log("\n" + "=" .repeat(60));
  if (success) {
    console.log("🎉 ALL TESTS PASSED! BACKEND IS READY!");
    console.log("=" .repeat(60));
    console.log("\n📱 MOBILE APP REBUILD INSTRUCTIONS:");
    console.log("─".repeat(60));
    console.log("1. Navigate to your mobile app directory:");
    console.log("   cd C:/Attendance_App/AIAttend_v2");
    console.log("\n2. Rebuild the APK (use your build command, e.g.):");
    console.log("   npm run build:android");
    console.log("   OR");
    console.log("   ionic capacitor build android");
    console.log("   OR");
    console.log("   npx react-native run-android --variant=release");
    console.log("\n3. Install the new APK on your device");
    console.log("\n4. Test the mobile app:");
    console.log("   ✓ Login with: B1-W422 / Test@123");
    console.log("   ✓ Site dropdown should populate after login");
    console.log("   ✓ Project dropdown should populate when site is selected");
    console.log("   ✓ Face recognition clock-in should work");
    console.log("\n5. API Endpoint:");
    console.log("   Production: https://cx.brk.sg/attendance_api_mobile");
    console.log("   Local Test: http://localhost:3001");
    console.log("=" .repeat(60));
  } else {
    console.log("❌ TESTS FAILED - DO NOT REBUILD APK YET");
    console.log("=" .repeat(60));
    console.log("Please fix the backend issues first.");
  }
}).catch(error => {
  console.error("❌ Test execution failed:", error);
});
