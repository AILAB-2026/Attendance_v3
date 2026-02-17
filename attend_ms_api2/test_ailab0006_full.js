
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const BASE_URL = 'http://192.168.1.5:7012';
const COMPANY_CODE = 'AILAB';
const EMPLOYEE_NO = 'AILAB0006';

async function checkDbState() {
    const pool = await getCompanyPool(COMPANY_CODE);
    const res = await pool.query(`
        SELECT ecl.id, ecl.clock_in_date::text as date, ecl.clock_in::text as in_time, ecl.clock_out::text as out_time, ecl.state
        FROM employee_clocking_line ecl
        JOIN hr_employee he ON he.id = ecl.employee_id
        WHERE he."x_Emp_No" = $1 AND ecl.clock_in_date = CURRENT_DATE
        ORDER BY ecl.id DESC
        LIMIT 3
    `, [EMPLOYEE_NO]);

    console.log("  DB Records for today:");
    if (res.rows.length === 0) {
        console.log("    (none)");
    } else {
        res.rows.forEach(r => {
            console.log(`    ID: ${r.id} | In: ${r.in_time} | Out: ${r.out_time || 'NULL'} | State: ${r.state}`);
        });
    }
    return res.rows;
}

async function run() {
    console.log(`=== AILAB0006 Full Clock Test ===\n`);

    console.log("Initial State:");
    await checkDbState();

    // 1. Clock In
    console.log("\n1. Sending Clock In...");
    try {
        const resIn = await axios.post(`${BASE_URL}/attendance/clock-in`, {
            companyCode: COMPANY_CODE,
            employeeNo: EMPLOYEE_NO,
            siteName: 'TestSite',
            method: 'button',
            latitude: 1.0,
            longitude: 1.0
        });
        console.log(`   API Response: success=${resIn.data.success}, id=${resIn.data.data?.id}`);
    } catch (e) {
        console.log(`   API Error: ${e.response?.data?.message || e.message}`);
    }

    console.log("\nAfter Clock In:");
    await checkDbState();

    // 2. Clock Out
    console.log("\n2. Sending Clock Out...");
    try {
        const resOut = await axios.post(`${BASE_URL}/attendance/clock-out`, {
            companyCode: COMPANY_CODE,
            employeeNo: EMPLOYEE_NO,
            siteName: 'TestSite',
            method: 'button',
            latitude: 1.0,
            longitude: 1.0
        });
        console.log(`   API Response: success=${resOut.data.success}, id=${resOut.data.data?.id}`);
    } catch (e) {
        console.log(`   API Error: ${e.response?.data?.message || e.message}`);
    }

    console.log("\nFinal State:");
    await checkDbState();

    console.log("\n=== Test Complete ===");
    process.exit(0);
}

run().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});


