import fetch from 'node-fetch';

const API = 'http://192.168.1.4:7012';
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
console.log('1. LOGIN:', loginData.success ? 'âœ… PASS' : 'âŒ FAIL');

// 2. Face Recognition
const faceRes = await fetch(`${API}/face/status?companyCode=1&employeeNo=B1-E079`);
const faceData = await faceRes.json();
console.log('2. FACE RECOGNITION:', faceData.data?.registered ? 'âœ… PASS - Enrolled' : 'âŒ FAIL - Not enrolled');

// 3. Leave Balance
const balanceRes = await fetch(`${API}/leave/balance`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const balanceData = await balanceRes.json();
const hasBalance = balanceData.data?.balance?.annual > 0 || balanceData.data?.balance?.medical > 0;
console.log('3. LEAVE BALANCE:', hasBalance ? `âœ… PASS - Annual:${balanceData.data.balance.annual} Medical:${balanceData.data.balance.medical}` : 'âŒ FAIL - All zeros');

// 4. Leave Requests
const requestsRes = await fetch(`${API}/leave/requests`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const requestsData = await requestsRes.json();
console.log('4. LEAVE REQUESTS:', Array.isArray(requestsData) ? `âœ… PASS - Found ${requestsData.length} requests` : 'âŒ FAIL');

// 5. Payslips
const payslipsRes = await fetch(`${API}/payroll/payslips`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const payslipsData = await payslipsRes.json();
console.log('5. PAYSLIPS:', payslipsData.success && payslipsData.data?.length > 0 ? `âœ… PASS - Found ${payslipsData.data.length} payslips` : 'âŒ FAIL');

console.log('\n=== TEST COMPLETE ===\n');



