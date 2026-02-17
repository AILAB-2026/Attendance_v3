
import fetch from 'node-fetch';

const BASE_URL = 'http://192.168.1.5:7012'; // Running service port
// const BASE_URL = 'https://cx.brk.sg/attend_ms_api_2'; // If we wanted to test the IIS binding locally, but DNS might not be set.

async function testLogin() {
    console.log('Testing login with credentials:');
    console.log('Company Code: SKK');
    console.log('Employee No: SKK-IND-0005');
    console.log('Target: ' + BASE_URL + '/auth/login-multi');

    const payload = {
        companyCode: 'SKK',
        employeeNo: 'SKK-IND-0005',
        password: 'Test@123'
    };

    try {
        const response = await fetch(`${BASE_URL}/auth/login-multi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        console.log(`Response Status: ${status}`);

        const data = await response.json();
        console.log('Response Body:');
        console.log(JSON.stringify(data, null, 2));

        if (status === 200 && data.success) {
            console.log('\nâœ… Login Successful!');
        } else {
            console.log('\nâŒ Login Failed.');
        }

    } catch (error) {
        console.error('Error during fetch:', error);
    }
}

testLogin();


