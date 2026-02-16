
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        console.log(`Connecting to ${COMPANY_CODE}...`);
        const pool = await getCompanyPool(COMPANY_CODE);

        // List active employees
        const res = await pool.query(`
            SELECT id, "x_Emp_No" as employee_no, name, active, company_id
            FROM hr_employee 
            WHERE active = true
            LIMIT 5
        `);

        console.log("Active Employees in AILAB:");
        console.table(res.rows);

        if (res.rows.length === 0) {
            console.log("No active employees found.");
            process.exit(1);
        }

        const employee = res.rows[0];
        console.log(`\nSelected Employee: ${employee.employee_no} (${employee.name})`);

        // Check for existing clockings today
        const today = new Date().toISOString().split('T')[0];
        console.log(`Checking clockings for today (${today})...`);

        const clockings = await pool.query(`
            SELECT * FROM employee_clocking_line 
            WHERE employee_id = $1 
            AND clock_in_date = NOW()::date
            ORDER BY clock_in DESC
        `, [employee.id]);

        console.table(clockings.rows);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
};

run();
