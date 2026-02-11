import fetch from 'node-fetch';

async function finalTest() {
  try {
    console.log("=== Final Login Test for B1-W422 ===");
    
    const credentials = {
      companyCode: "1",
      employeeNo: "B1-W422", 
      password: "Test@123"
    };
    
    console.log("Testing credentials:");
    console.log("- Company Code:", credentials.companyCode);
    console.log("- Employee Number:", credentials.employeeNo);
    console.log("- Password:", credentials.password);
    
    const apiUrl = "http://localhost:3001/auth/login";
    console.log("\nAPI Endpoint:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });
    
    const result = await response.json();
    
    console.log("\n=== RESPONSE ===");
    console.log("Status:", response.status, response.statusText);
    console.log("Success:", result.success);
    console.log("Message:", result.message);
    
    if (result.success && result.data) {
      console.log("\n=== USER DATA ===");
      console.log("Employee Number:", result.data.employeeNo);
      console.log("Name:", result.data.name);
      console.log("Email:", result.data.email);
      console.log("Role:", result.data.role);
      console.log("Company Code:", result.data.companyCode);
      console.log("Session Token:", result.data.sessionToken ? "✅ Generated" : "❌ Missing");
      
      console.log("\n🎉 LOGIN SUCCESSFUL!");
      console.log("The mobile app should now be able to login with these credentials.");
      
      // Test token validation
      console.log("\n=== Testing Token Validation ===");
      const validateResponse = await fetch("http://localhost:3001/auth/validatetoken", {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${result.data.sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (validateResponse.ok) {
        const validateResult = await validateResponse.json();
        console.log("✅ Token validation successful");
        console.log("Validated user:", validateResult.employeeNo);
      } else {
        console.log("⚠️ Token validation failed:", validateResponse.status);
      }
      
    } else {
      console.log("\n❌ LOGIN FAILED");
      console.log("Full response:", JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

finalTest();
