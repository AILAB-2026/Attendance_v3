
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const BASE_URL = 'http://localhost:7010';
const COMPANY_CODE = 'AILAB';
const EMPLOYEE_NO = 'AILAB0004'; // Punitha S

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyInDb(checkClockOut = false) {
    const pool = await getCompanyPool(COMPANY_CODE);
    const res = await pool.query(`
        SELECT ecl.* 
        FROM employee_clocking_line ecl
        JOIN hr_employee he ON he.id = ecl.employee_id
        WHERE he."x_Emp_No" = $1
        AND ecl.clock_in_date = NOW()::date
        ORDER BY ecl.clock_in DESC
        LIMIT 1
    `, [EMPLOYEE_NO]);

    if (res.rows.length === 0) {
        console.log("❌ DB Verify: No record found for today.");
        return null;
    }

    const row = res.rows[0];
    console.log(`✅ DB Verify: Found record ID ${row.id}`);
    console.log(`   Clock In: ${row.clock_in}`);
    console.log(`   Clock Out: ${row.clock_out}`);

    if (checkClockOut) {
        if (row.clock_out) {
            console.log("✅ DB Verify: Clock Out is SET.");
        } else {
            console.error("❌ DB Verify: Clock Out is NULL (Update Failed).");
        }
    }
    return row;
}

async function run() {
    try {
        console.log("--- Starting AILAB API Test ---");

        // 1. Clock In
        console.log("\n1️⃣ Sending Clock In Request...");
        try {
            const resIn = await axios.post(`${BASE_URL}/attendance/clock-in`, {
                companyCode: COMPANY_CODE,
                employeeNo: EMPLOYEE_NO,
                start_time: new Date().toISOString(), // Mobile app sends weird fields, but backend uses timestamp or server time
                timestamp: Date.now(),
                latitude: 1.0,
                longitude: 1.0,
                siteName: 'Test Site',
                method: 'remote'
            });
            console.log("Response:", resIn.data);
        } catch (e) {
            if (e.response && e.response.data && e.response.data.message.includes("already have an open clock-in")) {
                console.log("⚠️ Already clocked in, proceeding to clock out...");
            } else {
                console.error("❌ Clock In Failed:", e.message);
                if (e.response) console.error("   Data:", e.response.data);
                // process.exit(1); 
            }
        }

        await verifyInDb(false);

        await sleep(2000);

        // 2. Clock Out
        console.log("\n2️⃣ Sending Clock Out Request...");
        try {
            const resOut = await axios.post(`${BASE_URL}/attendance/clock-out`, {
                companyCode: COMPANY_CODE,
                employeeNo: EMPLOYEE_NO,
                end_time: new Date().toISOString(),
                timestamp: Date.now(),
                latitude: 1.0,
                longitude: 1.0,
                siteName: 'Test Site',
                method: 'remote'
            });
            console.log("Response:", resOut.data);
        } catch (e) {
            console.error("❌ Clock Out Failed:", e.message);
            if (e.response) console.error("   Data:", e.response.data);
        }

        // 3. Verify Final State
        console.log("\n3️⃣ Verifying Final DB State...");
        await verifyInDb(true);

        process.exit(0);
    } catch (err) {
        console.error("Fatal Error:", err);
        process.exit(1);
    }
}

run();
