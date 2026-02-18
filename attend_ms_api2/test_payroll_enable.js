import fetch from 'node-fetch';

const API_BASE_URL = 'http://192.168.1.4:7012';

const testCases = [
  {
    company: 'BRK',
    employeeNo: 'TEST-001',
    expectedPayrollEnable: true,
    description: 'BRK should have payroll enabled'
  },
  {
    company: 'SKK',
    employeeNo: 'SKK-IND-0005',
    expectedPayrollEnable: false,
    description: 'SKK should have payroll disabled'
  },
  {
    company: 'AILAB',
    employeeNo: 'AILAB-001',
    expectedPayrollEnable: false,
    description: 'AILAB should have payroll disabled'
  }
];

async function testPayrollEnable() {
  console.log('\n=== Testing Payroll Enable Feature ===\n');

  for (const testCase of testCases) {
    try {
      console.log(`ðŸ“‹ Testing: ${testCase.description}`);
      console.log(`   Company: ${testCase.company}, Employee: ${testCase.employeeNo}`);

      const url = `${API_BASE_URL}/users/profile?companyCode=${testCase.company}&employeeNo=${testCase.employeeNo}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        console.log(`   âŒ Error: ${data.message}`);
        continue;
      }

      const payrollEnable = data.data?.payrollEnable;
      const matches = payrollEnable === testCase.expectedPayrollEnable;

      if (matches) {
        console.log(`   âœ… PASS: payrollEnable = ${payrollEnable} (expected: ${testCase.expectedPayrollEnable})`);
      } else {
        console.log(`   âŒ FAIL: payrollEnable = ${payrollEnable} (expected: ${testCase.expectedPayrollEnable})`);
      }

      console.log(`   Response data:`, {
        employeeNo: data.data?.employeeNo,
        name: data.data?.name,
        payrollEnable: data.data?.payrollEnable,
      });

    } catch (err) {
      console.error(`   âŒ Error: ${err.message}`);
    }

    console.log('');
  }

  console.log('=== Test Complete ===\n');
}

testPayrollEnable();



