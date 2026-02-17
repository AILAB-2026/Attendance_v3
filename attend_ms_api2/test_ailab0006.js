
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";
import axios from 'axios';

const COMPANY_CODE = 'AILAB';
const EMPLOYEE_NO = 'AILAB0006';
const BASE_URL = 'http://192.168.1.5:7012';

async function run() {
    console.log(`=== Testing AILAB0006 ===\n`);

    const pool = await getCompanyPool(COMPANY_CODE);

    // 1. Check if employee exists
    console.log("1. Checking employee in database...");
    const empRes = await pool.query(`
        SELECT id, "x_Emp_No" as emp_no, name, active, company_id
        FROM hr_employee
        WHERE "x_Emp_No" = $1
    `, [EMPLOYEE_NO]);

    if (empRes.rows.length === 0) {
        console.log(`   âŒ Employee ${EMPLOYEE_NO} NOT FOUND in AILAB database!`);

        // Try case-insensitive search
        const fuzzyRes = await pool.query(`
            SELECT "x_Emp_No" as emp_no, name, active
            FROM hr_employee
            WHERE LOWER("x_Emp_No") LIKE '%ailab%'
            ORDER BY "x_Emp_No"
        `);
        console.log(`\n   Available AILAB employees:`);
        fuzzyRes.rows.forEach(r => {
            console.log(`   - ${r.emp_no}: ${r.name} (active: ${r.active})`);
        });
        process.exit(1);
    }

    const emp = empRes.rows[0];
    console.log(`   âœ… Found: ${emp.name} (ID: ${emp.id}, Active: ${emp.active})\n`);

    // 2. Check for existing open clockings
    console.log("2. Checking open clockings...");
    const openRes = await pool.query(`
        SELECT id, clock_in_date, clock_in, project_id
        FROM employee_clocking_line
        WHERE employee_id = $1 AND clock_out IS NULL
        ORDER BY clock_in_date DESC, clock_in DESC
    `, [emp.id]);

    console.log(`   Open clockings: ${openRes.rows.length}`);
    openRes.rows.forEach(r => {
        console.log(`   - ID: ${r.id}, Date: ${r.clock_in_date}, In: ${r.clock_in}`);
    });
    console.log("");

    // 3. Test Clock-In API
    console.log("3. Testing Clock-In via API...");
    try {
        const resIn = await axios.post(`${BASE_URL}/attendance/clock-in`, {
            companyCode: COMPANY_CODE,
            employeeNo: EMPLOYEE_NO,
            siteName: 'TestFromScript',
            method: 'remote'
        });
        console.log(`   Response: ${JSON.stringify(resIn.data)}\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}`);
        if (e.response) {
            console.log(`   Status: ${e.response.status}`);
            console.log(`   Data: ${JSON.stringify(e.response.data)}`);
        }
        console.log("");
    }

    // 4. Re-check open clockings
    console.log("4. Re-checking open clockings after clock-in...");
    const openRes2 = await pool.query(`
        SELECT id, clock_in_date, clock_in
        FROM employee_clocking_line
        WHERE employee_id = $1 AND clock_out IS NULL
        ORDER BY clock_in_date DESC, clock_in DESC
    `, [emp.id]);
    console.log(`   Open clockings: ${openRes2.rows.length}`);
    openRes2.rows.forEach(r => {
        console.log(`   - ID: ${r.id}, Date: ${r.clock_in_date}, In: ${r.clock_in}`);
    });
    console.log("");

    // 5. Test Clock-Out API
    console.log("5. Testing Clock-Out via API...");
    try {
        const resOut = await axios.post(`${BASE_URL}/attendance/clock-out`, {
            companyCode: COMPANY_CODE,
            employeeNo: EMPLOYEE_NO,
            siteName: 'TestFromScript',
            method: 'remote'
        });
        console.log(`   Response: ${JSON.stringify(resOut.data)}\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}`);
        if (e.response) {
            console.log(`   Status: ${e.response.status}`);
            console.log(`   Data: ${JSON.stringify(e.response.data)}`);
        }
        console.log("");
    }

    // 6. Final check
    console.log("6. Final database check (today's records)...");
    const finalRes = await pool.query(`
        SELECT id, clock_in_date::text as date, clock_in::text as in_time, clock_out::text as out_time, state
        FROM employee_clocking_line
        WHERE employee_id = $1 AND clock_in_date = CURRENT_DATE
        ORDER BY id DESC
    `, [emp.id]);

    if (finalRes.rows.length === 0) {
        console.log("   âŒ No records found for today!");
    } else {
        finalRes.rows.forEach(r => {
            console.log(`   ID: ${r.id} | Date: ${r.date} | In: ${r.in_time} | Out: ${r.out_time || 'NULL'} | State: ${r.state}`);
        });
    }

    process.exit(0);
}

run().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});


