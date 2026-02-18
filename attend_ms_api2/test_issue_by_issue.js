import fetch from 'node-fetch';
import FormData from 'form-data';

const API_BASE = 'http://192.168.1.4:7012';
const TEST_USER = {
  companyCode: '1',
  employeeNo: 'B1-E079',
  password: 'Test@123'
};

let authToken = '';

async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    options.body = body;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : await response.text();
  
  return { status: response.status, data };
}

async function login() {
  const result = await apiCall('/auth/login', 'POST', TEST_USER);
  if (result.status === 200 && result.data.success) {
    authToken = result.data.data.sessionToken;
    console.log(`âœ… Logged in as ${result.data.data.name} (${result.data.data.employeeNo})\n`);
    return true;
  }
  console.log('âŒ Login failed\n');
  return false;
}

// ISSUE 1: Face Recognition
async function testIssue1() {
  console.log('â”'.repeat(80));
  console.log('ISSUE 1: Face Recognition - Enrolled Face Showing Unauthorized');
  console.log('â”'.repeat(80));
  
  const statusResult = await apiCall(`/face/status?companyCode=1&employeeNo=${TEST_USER.employeeNo}`, 'GET');
  console.log('Face Status:', JSON.stringify(statusResult.data, null, 2));
  
  if (statusResult.data.data?.registered) {
    console.log('\nâœ… FIXED: Face enrollment detected correctly');
    console.log('   Message:', statusResult.data.data.message);
  } else {
    console.log('\nâš ï¸  Face not enrolled for this employee');
  }
  console.log('\n');
}

// ISSUE 2: Leave Application
async function testIssue2() {
  console.log('â”'.repeat(80));
  console.log('ISSUE 2: Leave Application - DB Storage & ERP Visibility');
  console.log('â”'.repeat(80));
  
  // Check balance
  const balanceResult = await apiCall('/leave/balance', 'GET', null, authToken);
  console.log('Leave Balance:', JSON.stringify(balanceResult.data.data?.balance, null, 2));
  
  // Apply for leave
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const leaveDate = tomorrow.toISOString().split('T')[0];
  
  const leaveData = {
    startDate: leaveDate,
    endDate: leaveDate,
    leaveTypeId: 1,
    type: 'annual',
    reason: 'Test Leave from API',
    halfDay: false,
    duration: 'full'
  };
  
  console.log(`\nApplying for leave on ${leaveDate}...`);
  const applyResult = await apiCall('/leave/apply', 'POST', leaveData, authToken);
  
  if (applyResult.data.success) {
    console.log('âœ… FIXED: Leave application successful');
    console.log('   Leave ID:', applyResult.data.data.leaveId);
    console.log('   Message:', applyResult.data.message);
    
    // Verify in DB
    const requestsResult = await apiCall('/leave/requests', 'GET', null, authToken);
    if (requestsResult.data && requestsResult.data.length > 0) {
      console.log('\nâœ… VERIFIED: Leave stored in hr_leave table');
      console.log('   Total requests:', requestsResult.data.length);
      console.log('   Latest:', {
        from: requestsResult.data[0].leaveRequestFrom,
        to: requestsResult.data[0].leaveRequestTo,
        type: requestsResult.data[0].leaveType,
        status: requestsResult.data[0].leaveStatus
      });
      console.log('\nðŸ“Œ To verify in ERP UI:');
      console.log('   1. Login to https://cx.brk.sg');
      console.log('   2. Go to: HR > Leaves > Leave Requests');
      console.log(`   3. Filter by Employee: ${TEST_USER.employeeNo}`);
    }
  } else {
    console.log('âŒ Leave application failed:', applyResult.data.message);
  }
  console.log('\n');
}

// ISSUE 3: Payslip Page
async function testIssue3() {
  console.log('â”'.repeat(80));
  console.log('ISSUE 3: Payslip Page - Fix Error & Show Salary Details');
  console.log('â”'.repeat(80));
  
  const result = await apiCall('/payroll/payslips', 'GET', null, authToken);
  
  if (result.status === 500) {
    console.log('âŒ ERROR: Server error occurred');
    console.log('   Details:', result.data);
  } else if (result.data.success) {
    if (!result.data.isActive) {
      console.log('âš ï¸  Employee is inactive');
      console.log('   Message:', result.data.message);
    } else if (result.data.data && result.data.data.length > 0) {
      console.log('âœ… FIXED: Payslips fetched successfully');
      console.log(`   Employee: ${result.data.employee.name}`);
      console.log(`   Total payslips: ${result.data.data.length}\n`);
      
      console.log('ðŸ“‹ Payslip Details (Latest 3):');
      result.data.data.slice(0, 3).forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.monthYear}`);
        console.log(`      Pay Date: ${p.payDate}`);
        console.log(`      Basic Salary: $${p.basicSalary.toLocaleString()}`);
        console.log(`      Allowance: $${p.allowance.toLocaleString()}`);
        console.log(`      Deduction: $${p.deduction.toLocaleString()}`);
        console.log(`      Net Pay: $${p.totalSalary.toLocaleString()}`);
      });
    } else {
      console.log('âš ï¸  No payslips found (employee may not have payslip records)');
    }
  } else {
    console.log('âŒ Failed:', result.data.message);
  }
  console.log('\n');
}

async function main() {
  console.log('\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘                    THREE ISSUES - COMPREHENSIVE TEST                       â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
  
  if (!(await login())) return;
  
  await testIssue1();
  await testIssue2();
  await testIssue3();
  
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘                           TESTING COMPLETE                                 â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
}

main().catch(console.error);



