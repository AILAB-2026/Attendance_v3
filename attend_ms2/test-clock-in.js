/**
 * Test script for clock-in with face recognition
 * Run: node test-clock-in.js
 */

require('dotenv').config({ path: '.env.production' });
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE_URL || 'http://192.168.1.5:7012';

async function testClockIn() {
  console.log('=== Testing Clock-In Flow ===\n');

  // Test data - replace with actual values
  const testData = {
    companyCode: 'TEST',  // Replace with your company code
    employeeNo: '001',     // Replace with test employee number
    latitude: 3.1390,
    longitude: 101.6869,
    address: 'Test Location, Kuala Lumpur',
    method: 'face',
    imageUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',  // Sample base64
    faceTemplate: null,
    siteName: 'Test Site',
    projectName: 'Test Project'
  };

  try {
    console.log('1. Testing clock-in endpoint...');
    const response = await fetch(`${API_BASE}/attendance/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\nâœ… Clock-in successful!');
      console.log('Event ID:', result.data?.id);
      console.log('Timestamp:', result.data?.timestamp);
      console.log('Location:', result.data?.location);
    } else {
      console.log('\nâŒ Clock-in failed!');
      console.log('Error:', result.message);
    }

  } catch (error) {
    console.error('\nâŒ Test failed with error:');
    console.error(error.message);
  }
}

// Run test
testClockIn().catch(console.error);


