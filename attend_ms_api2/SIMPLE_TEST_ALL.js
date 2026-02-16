import fetch from 'node-fetch';

const API = 'http://localhost:3001';
let token = '';

console.log('\n=== TESTING ALL 4 ISSUES ===\n');

// 1. Login
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyCode: '1', employeeNo: 'B1-E079', password: 'Test@123' })
});
const loginData = await loginRes.json();
token = loginData.data?.sessionToken;
console.log('1. LOGIN:', loginData.success ? '✅ PASS' : '❌ FAIL');

// 2. Face Recognition
const faceRes = await fetch(`${API}/face/status?companyCode=1&employeeNo=B1-E079`);
const faceData = await faceRes.json();
console.log('2. FACE RECOGNITION:', faceData.data?.registered ? '✅ PASS - Enrolled' : '❌ FAIL - Not enrolled');

// 3. Leave Balance
const balanceRes = await fetch(`${API}/leave/balance`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const balanceData = await balanceRes.json();
const hasBalance = balanceData.data?.balance?.annual > 0 || balanceData.data?.balance?.medical > 0;
console.log('3. LEAVE BALANCE:', hasBalance ? `✅ PASS - Annual:${balanceData.data.balance.annual} Medical:${balanceData.data.balance.medical}` : '❌ FAIL - All zeros');

// 4. Leave Requests
const requestsRes = await fetch(`${API}/leave/requests`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const requestsData = await requestsRes.json();
console.log('4. LEAVE REQUESTS:', Array.isArray(requestsData) ? `✅ PASS - Found ${requestsData.length} requests` : '❌ FAIL');

// 5. Payslips
const payslipsRes = await fetch(`${API}/payroll/payslips`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const payslipsData = await payslipsRes.json();
console.log('5. PAYSLIPS:', payslipsData.success && payslipsData.data?.length > 0 ? `✅ PASS - Found ${payslipsData.data.length} payslips` : '❌ FAIL');

console.log('\n=== TEST COMPLETE ===\n');
