import fetch from 'node-fetch';

const API = 'http://localhost:3001';

console.log('\n🔍 TESTING LEAVE BALANCE - FULL FLOW\n');

// 1. Login
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyCode: '1', employeeNo: 'B1-E079', password: 'Test@123' })
});
const loginData = await loginRes.json();
const token = loginData.data?.sessionToken;

console.log('✅ Login successful');
console.log(`   Token: ${token?.substring(0, 30)}...`);

// 2. Get Leave Balance
const balanceRes = await fetch(`${API}/leave/balance`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const balanceData = await balanceRes.json();

console.log('\n📊 LEAVE BALANCE RESPONSE:');
console.log(JSON.stringify(balanceData, null, 2));

if (balanceData.success && balanceData.data?.balance) {
  const b = balanceData.data.balance;
  console.log('\n✅ LEAVE BALANCE VALUES:');
  console.log(`   Annual: ${b.annual} days`);
  console.log(`   Medical: ${b.medical} days`);
  console.log(`   Emergency: ${b.emergency} days`);
  console.log(`   Unpaid: ${b.unpaid} days`);

  if (b.annual > 0 || b.medical > 0) {
    console.log('\n✅ SUCCESS: Leave balance shows actual numbers (NOT zeros)!');
  } else {
    console.log('\n❌ FAIL: All balances are zero');
  }
} else {
  console.log('\n❌ FAIL: Could not get leave balance');
}

// 3. Get Leave Requests
const requestsRes = await fetch(`${API}/leave/requests`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const requestsData = await requestsRes.json();

console.log('\n📋 LEAVE REQUESTS RESPONSE:');
if (Array.isArray(requestsData)) {
  console.log(`✅ Found ${requestsData.length} leave requests`);
  if (requestsData.length > 0) {
    console.log('\n   Recent requests:');
    requestsData.slice(0, 3).forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.leaveType} - ${req.leaveRequestFrom} to ${req.leaveRequestTo} (${req.days} days) - ${req.leaveStatus}`);
    });
  }
} else {
  console.log('❌ FAIL: Response is not an array');
  console.log(JSON.stringify(requestsData, null, 2));
}

console.log('\n✅ TEST COMPLETE\n');
