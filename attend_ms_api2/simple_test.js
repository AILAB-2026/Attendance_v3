import dotenv from "dotenv";
dotenv.config();

import fetch from 'node-fetch';

async function simpleTest() {
  const baseUrl = 'http://192.168.1.4:7012';
  
  // Login
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyCode: "1", employeeNo: "B1-W422", password: "Test@123" })
  });
  
  const loginData = await loginRes.json();
  console.log("Login response:", JSON.stringify(loginData, null, 2));
  
  const token = loginData.data?.sessionToken || loginData.data?.token;
  console.log("Token obtained:", token ? "YES" : "NO");
  console.log("Token value:", token ? token.substring(0, 30) + "..." : "NONE");
  
  if (!token) {
    console.log("ERROR: No token received!");
    return;
  }
  
  // Test face recognition endpoint
  const faceRecRes = await fetch(`${baseUrl}/faceRecognition/sites-projects`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log("Face Rec Status:", faceRecRes.status);
  const faceRecText = await faceRecRes.text();
  console.log("Face Rec Response:", faceRecText);
}

simpleTest();



