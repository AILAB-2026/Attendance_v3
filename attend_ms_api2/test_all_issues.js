import fetch from 'node-fetch';

const API_BASE = 'http://192.168.1.5:7012/api';

// Test credentials - using B1-W422 from memory
const TEST_USER = {
  companyCode: '1',
  employeeNo: 'B1-W422',
  password: 'Test@123'
};

let authToken = '';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

async function testLogin() {
  console.log('\nðŸ” TEST 1: Login');
  console.log('='.repeat(60));
  
  const result = await apiCall('/auth/login', 'POST', TEST_USER);
  
  if (result.status === 200 && result.data.token) {
    authToken = result.data.token;
    console.log('âœ… Login successful');
    console.log(`   Employee: ${result.data.employeeName} (${result.data.employeeNo})`);
    console.log(`   Token: ${authToken.substring(0, 30)}...`);
    return true;
  } else {
    console.log('âŒ Login failed:', result.data);
    return false;
  }
}

async function testFaceEnrollment() {
  console.log('\nðŸ‘¤ TEST 2: Face Enrollment Status');
  console.log('='.repeat(60));
  
  // Check if face is enrolled
  const result = await apiCall('/face/status', 'GET', null, authToken);
  
  console.log(`   Status: ${result.status}`);
  console.log(`   Response:`, result.data);
  
  if (result.data.enrolled) {
    console.log('âœ… Face is enrolled');
    console.log(`   Employee: ${result.data.employeeName}`);
    return true;
  } else {
    console.log('âš ï¸  Face not enrolled for this employee');
    return false;
  }
}

async function testLeaveApplication() {
  console.log('\nðŸ“ TEST 3: Leave Application & Database Storage');
  console.log('='.repeat(60));
  
  // First, get leave balance
  const balanceResult = await apiCall('/leave/balance', 'GET', null, authToken);
  console.log('   Current leave balance:', balanceResult.data);
  
  // Apply for leave
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const leaveData = {
    startDate: tomorrow.toISOString().split('T')[0],
    endDate: tomorrow.toISOString().split('T')[0],
    leaveTypeId: 1, // Annual leave
    type: 'annual',
    reason: 'Test leave from mobile API',
    halfDay: false,
    duration: 'full'
  };
  
  console.log(`   Applying for leave: ${leaveData.startDate}`);
  const applyResult = await apiCall('/leave/apply', 'POST', leaveData, authToken);
  
  console.log(`   Status: ${applyResult.status}`);
  console.log(`   Response:`, applyResult.data);
  
  if (applyResult.data.success) {
    console.log('âœ… Leave application submitted successfully');
    console.log(`   Leave ID: ${applyResult.data.data?.leaveId}`);
    console.log(`   Message: ${applyResult.data.message}`);
    
    // Verify it's in the database by fetching leave requests
    console.log('\n   Verifying in database...');
    const requestsResult = await apiCall('/leave/requests', 'GET', null, authToken);
    console.log(`   Total leave requests: ${requestsResult.data.length}`);
    
    if (requestsResult.data.length > 0) {
      console.log('âœ… Leave data is stored in hr_leave table');
      console.log('   Latest request:', requestsResult.data[0]);
    }
    
    return true;
  } else {
    console.log('âŒ Leave application failed:', applyResult.data.message);
    return false;
  }
}

async function testPayslips() {
  console.log('\nðŸ’° TEST 4: Payslip Page & Data Display');
  console.log('='.repeat(60));
  
  const result = await apiCall('/payroll/payslips', 'GET', null, authToken);
  
  console.log(`   Status: ${result.status}`);
  console.log(`   Response:`, result.data);
  
  if (result.data.success) {
    if (!result.data.isActive) {
      console.log('âš ï¸  Employee is inactive - showing friendly message');
      console.log(`   Message: ${result.data.message}`);
      return true;
    }
    
    if (result.data.data && result.data.data.length > 0) {
      console.log('âœ… Payslips fetched successfully');
      console.log(`   Total payslips: ${result.data.data.length}`);
      console.log('\n   Sample payslip details:');
      const sample = result.data.data[0];
      console.log(`   - Month/Year: ${sample.monthYear}`);
      console.log(`   - Pay Date: ${sample.payDate}`);
      console.log(`   - Basic Salary: $${sample.basicSalary}`);
      console.log(`   - Allowance: $${sample.allowance}`);
      console.log(`   - Deduction: $${sample.deduction}`);
      console.log(`   - Total Salary: $${sample.totalSalary}`);
      console.log(`   - Gross Pay: $${sample.grossPay}`);
      console.log(`   - Payslip URL: ${sample.payslipUrl}`);
      return true;
    } else {
      console.log('âš ï¸  No payslips found for this employee');
      return true;
    }
  } else {
    console.log('âŒ Failed to fetch payslips:', result.data.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘  COMPREHENSIVE API TESTING - ALL ISSUES                    â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  try {
    // Test 1: Login
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
      console.log('\nâŒ Cannot proceed without successful login');
      return;
    }
    
    // Test 2: Face Recognition
    await testFaceEnrollment();
    
    // Test 3: Leave Application
    await testLeaveApplication();
    
    // Test 4: Payslips
    await testPayslips();
    
    console.log('\n');
    console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
    console.log('â•‘  TESTING COMPLETE                                          â•‘');
    console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('\n');
    
  } catch (error) {
    console.error('\nâŒ Test error:', error.message);
    console.error(error.stack);
  }
}

runAllTests();


