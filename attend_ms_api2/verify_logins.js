
import axios from 'axios';

const BASE_URL = 'http://localhost:7010/auth/login-multi';

const testCases = [
    {
        companyCode: 'BRK',
        employeeNo: 'TEST-004',
        password: 'Test@123'
    },
    {
        companyCode: 'SKK',
        employeeNo: 'SKK-IND-0005',
        password: 'Test@123'
    },
    {
        companyCode: 'AILAB',
        employeeNo: 'AILAB0007',
        password: 'Test@123'
    }
];

async function runTests() {
    console.log(`Testing Login API at ${BASE_URL}\n`);

    for (const testCase of testCases) {
        console.log('---------------------------------------------------');
        console.log(`Testing Login for Company: ${testCase.companyCode}, Employee: ${testCase.employeeNo}`);
        try {
            const response = await axios.post(BASE_URL, {
                companyCode: testCase.companyCode,
                employeeNo: testCase.employeeNo,
                password: testCase.password
            });

            if (response.status === 200 && response.data.success) {
                console.log('✅ SUCCESS');
                console.log('Message:', response.data.message);
                console.log('Data:', {
                    ...response.data.data,
                    sessionToken: response.data.data.sessionToken ? 'Valid Token (Truncated)' : 'Missing Token'
                });
            } else {
                console.log('❌ FAILED (Logic)');
                console.log('Status:', response.status);
                console.log('Response:', response.data);
            }
        } catch (error) {
            console.log('❌ FAILED (Error)');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', error.response.data);
            } else {
                console.log('Error Message:', error.message);
            }
        }
        console.log('---------------------------------------------------\n');
    }
}

runTests();
