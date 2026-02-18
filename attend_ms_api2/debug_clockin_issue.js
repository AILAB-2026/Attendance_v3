
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const BASE_URL = 'http://192.168.1.4:7012';
const COMPANY_CODE = 'AILAB';
const EMPLOYEE_NO = 'AILAB0004';

async function run() {
    try {
        console.log("=== Debugging Clock-In/Out Issue ===\n");

        // 1. Check DB connectivity
        console.log("1. Checking AILAB DB connectivity...");
        const pool = await getCompanyPool(COMPANY_CODE);
        const dbCheck = await pool.query("SELECT current_database(), NOW() as db_time");
        console.log(`   Connected to: ${dbCheck.rows[0].current_database}`);
        console.log(`   DB Time: ${dbCheck.rows[0].db_time}\n`);

        // 2. Check employee exists
        console.log("2. Checking employee...");
        const empCheck = await pool.query(`
            SELECT id, "x_Emp_No", name, active 
            FROM hr_employee 
            WHERE "x_Emp_No" = $1
        `, [EMPLOYEE_NO]);

        if (empCheck.rows.length === 0) {
            console.log(`   âŒ Employee ${EMPLOYEE_NO} NOT FOUND`);
            process.exit(1);
        }
        console.log(`   âœ… Found: ${empCheck.rows[0].name} (ID: ${empCheck.rows[0].id}, Active: ${empCheck.rows[0].active})\n`);

        const employeeId = empCheck.rows[0].id;

        // 3. Check open clockings
        console.log("3. Checking open clockings...");
        const openCheck = await pool.query(`
            SELECT id, clock_in_date, clock_in, clock_out, project_id
            FROM employee_clocking_line
            WHERE employee_id = $1 AND clock_out IS NULL
            ORDER BY clock_in_date DESC, clock_in DESC
        `, [employeeId]);

        console.log(`   Found ${openCheck.rows.length} open clocking(s):`);
        openCheck.rows.forEach(r => {
            console.log(`   - ID: ${r.id}, Date: ${r.clock_in_date}, In: ${r.clock_in}`);
        });
        console.log("");

        // 4. Try clock-in via API
        console.log("4. Testing Clock-In API...");
        try {
            const resIn = await axios.post(`${BASE_URL}/attendance/clock-in`, {
                companyCode: COMPANY_CODE,
                employeeNo: EMPLOYEE_NO,
                siteName: 'DebugTest',
                method: 'remote',
                latitude: 1.0,
                longitude: 1.0
            });
            console.log(`   âœ… Clock-In Response:`, resIn.data);
        } catch (e) {
            console.log(`   âš ï¸ Clock-In Error: ${e.message}`);
            if (e.response) {
                console.log(`   Response Status: ${e.response.status}`);
                console.log(`   Response Data:`, e.response.data);
            }
        }
        console.log("");

        // 5. Try clock-out via API
        console.log("5. Testing Clock-Out API...");
        try {
            const resOut = await axios.post(`${BASE_URL}/attendance/clock-out`, {
                companyCode: COMPANY_CODE,
                employeeNo: EMPLOYEE_NO,
                siteName: 'DebugTest',
                method: 'remote',
                latitude: 1.0,
                longitude: 1.0
            });
            console.log(`   âœ… Clock-Out Response:`, resOut.data);
        } catch (e) {
            console.log(`   âŒ Clock-Out Error: ${e.message}`);
            if (e.response) {
                console.log(`   Response Status: ${e.response.status}`);
                console.log(`   Response Data:`, e.response.data);
            }
        }
        console.log("");

        // 6. Re-check DB state
        console.log("6. Final DB state check...");
        const finalCheck = await pool.query(`
            SELECT id, clock_in_date, clock_in, clock_out, state
            FROM employee_clocking_line
            WHERE employee_id = $1
            ORDER BY clock_in_date DESC, clock_in DESC
            LIMIT 3
        `, [employeeId]);

        console.log("   Recent records:");
        finalCheck.rows.forEach(r => {
            console.log(`   - ID: ${r.id}, Date: ${r.clock_in_date}, In: ${r.clock_in}, Out: ${r.clock_out}, State: ${r.state}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Fatal Error:", err);
        process.exit(1);
    }
}

run();



