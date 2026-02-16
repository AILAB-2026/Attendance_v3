
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

async function run() {
    const pool = await getCompanyPool('AILAB');

    console.log("=== AILAB Recent Clockings (Last 10) ===\n");

    const res = await pool.query(`
        SELECT 
            ecl.id,
            he."x_Emp_No" as emp_no,
            ecl.clock_in_date::text as date,
            ecl.clock_in::text as in_time,
            ecl.clock_out::text as out_time,
            ecl.state
        FROM employee_clocking_line ecl
        JOIN hr_employee he ON he.id = ecl.employee_id
        ORDER BY ecl.write_date DESC
        LIMIT 10
    `);

    res.rows.forEach(r => {
        console.log(`ID: ${r.id} | Emp: ${r.emp_no} | Date: ${r.date} | In: ${r.in_time} | Out: ${r.out_time} | State: ${r.state}`);
    });

    process.exit(0);
}

run();
