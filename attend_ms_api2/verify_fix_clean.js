
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = 'http://localhost:7010';
const COMPANY_CODE = 'AILAB';
const EMPLOYEE_NO = 'AILAB0004';

async function run() {
    try {
        console.log("--- CLEAN VERIFICATION ---");

        // 1. Clock In
        console.log("1. Clocking In...");
        const resIn = await axios.post(`${BASE_URL}/attendance/clock-in`, {
            companyCode: COMPANY_CODE,
            employeeNo: EMPLOYEE_NO,
            siteName: 'FixTest',
            method: 'remote'
        });
        const clockInId = resIn.data.data.id;
        console.log(`   Clocked In ID: ${clockInId}`);

        // 2. Clock Out
        console.log("2. Clocking Out...");
        const resOut = await axios.post(`${BASE_URL}/attendance/clock-out`, {
            companyCode: COMPANY_CODE,
            employeeNo: EMPLOYEE_NO,
            siteName: 'FixTest',
            method: 'remote'
        });
        const clockOutId = resOut.data.data.id;
        console.log(`   Clocked Out ID: ${clockOutId}`);

        if (String(clockInId) === String(clockOutId)) {
            console.log("✅ SUCCESS: Clock Out targeted the correct session ID.");
        } else {
            console.error(`❌ FAILURE: Clock In ID (${clockInId}) != Clock Out ID (${clockOutId}).`);
            console.error("   The system likely closed an old ghost record instead of the current one.");
            process.exit(1);
        }

    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) console.error(err.response.data);
    }
}

run();
