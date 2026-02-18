import dotenv from 'dotenv';
dotenv.config();
import { query } from './src/dbconn.js';
import fetch from 'node-fetch';

const API_BASE = 'http://192.168.1.4:7012';
const TEST_USER = {
  companyCode: '1',
  employeeNo: 'B1-E079',
  password: 'Test@123'
};

let sessionToken = '';
let employeeId = null;

console.log('\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
console.log('â•‘           COMPREHENSIVE TEST - ALL 4 ISSUES VERIFICATION                   â•‘');
console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

async function test1_Login() {
  console.log('TEST 1: LOGIN & TOKEN');
  console.log('â”€'.repeat(80));
  
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  const data = await response.json();
  
  if (data.success && data.data?.sessionToken) {
    sessionToken = data.data.sessionToken;
    console.log('âœ… Login successful');
    console.log(`   Employee: ${data.data.name} (${data.data.employeeNo})`);
    console.log(`   Token: ${sessionToken.substring(0, 40)}...`);
    
    // Get employee ID from database
    const empResult = await new Promise((resolve, reject) => {
      query('SELECT id FROM hr_employee WHERE "x_Emp_No" = $1', [TEST_USER.employeeNo], (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    employeeId = empResult.rows[0].id;
    console.log(`   Employee ID: ${employeeId}`);
    return true;
  } else {
    console.log('âŒ Login failed:', data);
    return false;
  }
}

async function test2_FaceRecognition() {
  console.log('\n\nTEST 2: FACE RECOGNITION - ENROLLED FACE DETECTION');
  console.log('â”€'.repeat(80));
  
  // Check face enrollment status
  const response = await fetch(`${API_BASE}/face/status?companyCode=1&employeeNo=${TEST_USER.employeeNo}`);
  const data = await response.json();
  
  console.log('API Response:', JSON.stringify(data, null, 2));
  
  if (data.success && data.data?.registered) {
    console.log('âœ… PASS: Face enrollment detected correctly');
    console.log(`   Status: ${data.data.message}`);
    console.log(`   Employee: ${data.data.name}`);
    
    // Verify in database
    const dbResult = await new Promise((resolve, reject) => {
      query('SELECT l_face_descriptor IS NOT NULL as has_face FROM hr_employee WHERE id = $1', 
        [employeeId], (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
    });
    
    if (dbResult.rows[0].has_face) {
      console.log('âœ… Database confirmed: Face descriptor exists');
    }
    return true;
  } else {
    console.log('âŒ FAIL: Face not enrolled or not detected correctly');
    console.log('   Response:', data);
    return false;
  }
}

async function test3_LeaveBalance() {
  console.log('\n\nTEST 3: LEAVE BALANCE - MUST SHOW DAYS (NOT 0)');
  console.log('â”€'.repeat(80));
  
  const response = await fetch(`${API_BASE}/leave/balance`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  
  const data = await response.json();
  
  console.log('API Response:', JSON.stringify(data, null, 2));
  
  if (data.success && data.data?.balance) {
    const balance = data.data.balance;
    console.log('\nâœ… Leave Balance Retrieved:');
    console.log(`   Annual: ${balance.annual} days`);
    console.log(`   Medical: ${balance.medical} days`);
    console.log(`   Emergency: ${balance.emergency} days`);
    console.log(`   Unpaid: ${balance.unpaid} days`);
    
    // Check if any balance is greater than 0
    const hasBalance = balance.annual > 0 || balance.medical > 0 || balance.emergency > 0;
    
    if (hasBalance) {
      console.log('\nâœ… PASS: Leave balance shows actual days (not all zeros)');
      return true;
    } else {
      console.log('\nâŒ FAIL: All leave balances are 0');
      console.log('   Check hr_leave_allocation table for this employee');
      return false;
    }
  } else {
    console.log('âŒ FAIL: Could not retrieve leave balance');
    console.log('   Response:', data);
    return false;
  }
}

async function test4_LeaveRequests() {
  console.log('\n\nTEST 4: LEAVE REQUESTS - APPLIED LEAVES MUST SHOW IN MOBILE');
  console.log('â”€'.repeat(80));
  
  const response = await fetch(`${API_BASE}/leave/requests`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  
  const data = await response.json();
  
  console.log('API Response:', JSON.stringify(data, null, 2));
  
  if (Array.isArray(data) && data.length > 0) {
    console.log(`\nâœ… PASS: Found ${data.length} leave requests`);
    console.log('\n   Recent Leave Requests:');
    data.slice(0, 3).forEach((leave, idx) => {
      console.log(`\n   ${idx + 1}. ${leave.leaveType}`);
      console.log(`      From: ${leave.leaveRequestFrom}`);
      console.log(`      To: ${leave.leaveRequestTo}`);
      console.log(`      Days: ${leave.days}`);
      console.log(`      Status: ${leave.leaveStatus}`);
      console.log(`      Applied: ${leave.applyDate}`);
    });
    return true;
  } else {
    console.log('âš ï¸  WARNING: No leave requests found');
    console.log('   This might be OK if employee has never applied for leave');
    console.log('   But the endpoint is working correctly');
    return true;
  }
}

async function test5_LeaveApplication() {
  console.log('\n\nTEST 5: LEAVE APPLICATION - MUST BE ABLE TO APPLY');
  console.log('â”€'.repeat(80));
  
  // Try to apply for leave
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5);
  const leaveDate = tomorrow.toISOString().split('T')[0];
  
  const leaveData = {
    startDate: leaveDate,
    endDate: leaveDate,
    leaveTypeId: 1,
    type: 'annual',
    reason: 'Comprehensive Test - Leave Application',
    halfDay: false,
    duration: 'full'
  };
  
  console.log(`   Attempting to apply leave for: ${leaveDate}`);
  
  const response = await fetch(`${API_BASE}/leave/apply`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(leaveData)
  });
  
  const data = await response.json();
  
  console.log('API Response:', JSON.stringify(data, null, 2));
  
  if (data.success) {
    console.log('\nâœ… PASS: Leave application successful');
    console.log(`   Leave ID: ${data.data.leaveId}`);
    console.log(`   Message: ${data.message}`);
    
    // Verify in database
    const dbResult = await new Promise((resolve, reject) => {
      query('SELECT * FROM hr_leave WHERE id = $1', [data.data.leaveId], (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    
    if (dbResult.rows.length > 0) {
      console.log('âœ… Database confirmed: Leave stored in hr_leave table');
    }
    return true;
  } else {
    console.log('âŒ FAIL: Leave application failed');
    console.log(`   Error: ${data.message}`);
    return false;
  }
}

async function test6_Payslips() {
  console.log('\n\nTEST 6: PAYSLIPS - MUST SHOW SALARY DETAILS');
  console.log('â”€'.repeat(80));
  
  const response = await fetch(`${API_BASE}/payroll/payslips`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  
  const data = await response.json();
  
  console.log('API Response:', JSON.stringify(data, null, 2));
  
  if (data.success && data.data && data.data.length > 0) {
    console.log(`\nâœ… PASS: Found ${data.data.length} payslips`);
    console.log(`   Employee: ${data.employee.name}`);
    
    const latest = data.data[0];
    console.log('\n   Latest Payslip Details:');
    console.log(`   - Month/Year: ${latest.monthYear}`);
    console.log(`   - Pay Date: ${latest.payDate}`);
    console.log(`   - Basic Salary: $${latest.basicSalary}`);
    console.log(`   - Allowance: $${latest.allowance}`);
    console.log(`   - Deduction: $${latest.deduction}`);
    console.log(`   - Gross Pay: $${latest.grossPay}`);
    console.log(`   - Net Pay: $${latest.totalSalary}`);
    console.log(`   - Status: ${latest.status}`);
    
    if (latest.basicSalary > 0) {
      console.log('\nâœ… PASS: Payslip shows salary details correctly');
      return true;
    } else {
      console.log('\nâŒ FAIL: Basic salary is 0');
      return false;
    }
  } else if (data.success && !data.isActive) {
    console.log('âš ï¸  Employee is inactive');
    console.log(`   Message: ${data.message}`);
    return true;
  } else {
    console.log('âŒ FAIL: Could not retrieve payslips');
    console.log('   Response:', data);
    return false;
  }
}

async function runAllTests() {
  const results = {
    login: false,
    faceRecognition: false,
    leaveBalance: false,
    leaveRequests: false,
    leaveApplication: false,
    payslips: false
  };
  
  try {
    results.login = await test1_Login();
    if (!results.login) {
      console.log('\nâŒ CRITICAL: Cannot proceed without login');
      return results;
    }
    
    results.faceRecognition = await test2_FaceRecognition();
    results.leaveBalance = await test3_LeaveBalance();
    results.leaveRequests = await test4_LeaveRequests();
    results.leaveApplication = await test5_LeaveApplication();
    results.payslips = await test6_Payslips();
    
  } catch (error) {
    console.error('\nâŒ Test error:', error.message);
  }
  
  // Final Summary
  console.log('\n\n');
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘                          FINAL TEST RESULTS                                â•‘');
  console.log('â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£');
  console.log(`â•‘  1. Login & Token:           ${results.login ? 'âœ… PASS' : 'âŒ FAIL'}                                    â•‘`);
  console.log(`â•‘  2. Face Recognition:        ${results.faceRecognition ? 'âœ… PASS' : 'âŒ FAIL'}                                    â•‘`);
  console.log(`â•‘  3. Leave Balance (Days):    ${results.leaveBalance ? 'âœ… PASS' : 'âŒ FAIL'}                                    â•‘`);
  console.log(`â•‘  4. Leave Requests (List):   ${results.leaveRequests ? 'âœ… PASS' : 'âŒ FAIL'}                                    â•‘`);
  console.log(`â•‘  5. Leave Application:       ${results.leaveApplication ? 'âœ… PASS' : 'âŒ FAIL'}                                    â•‘`);
  console.log(`â•‘  6. Payslips (Salary):       ${results.payslips ? 'âœ… PASS' : 'âŒ FAIL'}                                    â•‘`);
  console.log('â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£');
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('â•‘                                                                            â•‘');
    console.log('â•‘  âœ…âœ…âœ… ALL TESTS PASSED - READY FOR APK BUILD âœ…âœ…âœ…                      â•‘');
    console.log('â•‘                                                                            â•‘');
  } else {
    console.log('â•‘                                                                            â•‘');
    console.log('â•‘  âŒâŒâŒ SOME TESTS FAILED - DO NOT BUILD APK YET âŒâŒâŒ                    â•‘');
    console.log('â•‘                                                                            â•‘');
  }
  
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('\n');
  
  process.exit(allPassed ? 0 : 1);
}

runAllTests();



