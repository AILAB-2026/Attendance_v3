import fetch from 'node-fetch';

const API = 'http://192.168.1.5:7012';

// Login first
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyCode: '1', employeeNo: 'B1-E079', password: 'Test@123' })
});
const loginData = await loginRes.json();
const token = loginData.data?.sessionToken;

console.log('Token:', token);

// Test leave requests
const requestsRes = await fetch(`${API}/leave/requests`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

console.log('Status:', requestsRes.status);
console.log('Headers:', requestsRes.headers.raw());

const text = await requestsRes.text();
console.log('Response:', text);

try {
  const json = JSON.parse(text);
  console.log('Parsed JSON:', JSON.stringify(json, null, 2));
} catch (e) {
  console.log('Not JSON:', e.message);
}


