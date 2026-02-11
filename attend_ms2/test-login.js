// Quick test script to verify login endpoint
const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('Testing login endpoint...');
    
    // tRPC batch request format
    const response = await fetch('http://127.0.0.1:3000/api/trpc/auth.login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyCode: 'AILAB',
        empNo: 'E001',
        password: 'password123'
      })
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
