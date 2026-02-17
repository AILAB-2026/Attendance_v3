import dotenv from "dotenv";
dotenv.config();

import fetch from 'node-fetch';

async function debugEndpoints() {
  console.log("ðŸ” DEBUG: Checking Each Endpoint Individually");
  console.log("=" .repeat(50));
  
  const baseUrl = 'http://192.168.1.5:7012';
  
  try {
    // Login first
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: "1",
        employeeNo: "B1-W422", 
        password: "Test@123"
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log("âœ… Login successful");
    
    // Test /sites endpoint
    console.log("\n1. Testing /sites endpoint...");
    try {
      const sitesResponse = await fetch(`${baseUrl}/sites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`Status: ${sitesResponse.status}`);
      const sitesText = await sitesResponse.text();
      console.log(`Response: ${sitesText.substring(0, 200)}...`);
      
      if (sitesResponse.ok) {
        const sitesData = JSON.parse(sitesText);
        console.log(`âœ… /sites working - ${sitesData.length} sites found`);
      }
    } catch (e) {
      console.log(`âŒ /sites error: ${e.message}`);
    }
    
    // Test /faceRecognition/sites-projects endpoint
    console.log("\n2. Testing /faceRecognition/sites-projects endpoint...");
    try {
      const faceRecResponse = await fetch(`${baseUrl}/faceRecognition/sites-projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`Status: ${faceRecResponse.status}`);
      const faceRecText = await faceRecResponse.text();
      console.log(`Response: ${faceRecText.substring(0, 300)}...`);
      
      if (faceRecResponse.ok) {
        const faceRecData = JSON.parse(faceRecText);
        console.log(`âœ… /faceRecognition/sites-projects working - ${faceRecData.data?.sites?.length || 0} sites found`);
      }
    } catch (e) {
      console.log(`âŒ /faceRecognition/sites-projects error: ${e.message}`);
    }
    
  } catch (error) {
    console.error("âŒ Debug error:", error.message);
  }
}

debugEndpoints().then(() => {
  console.log("\nâœ… Debug completed");
}).catch(error => {
  console.error("âŒ Debug failed:", error);
});


