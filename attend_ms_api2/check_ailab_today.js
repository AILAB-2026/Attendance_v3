
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

async function run() {
    const pool = await getCompanyPool('AILAB');

    // Check today's clockings
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
        WHERE ecl.clock_in_date = CURRENT_DATE
        ORDER BY ecl.id DESC
        LIMIT 5
    `);

    console.log("Today's clockings in AILAB:");
    if (res.rows.length === 0) {
        console.log("  No clockings found for today.");
    } else {
        res.rows.forEach(r => {
            console.log(`  ID: ${r.id} | Emp: ${r.emp_no} | In: ${r.in_time} | Out: ${r.out_time || 'NULL'} | State: ${r.state}`);
        });
    }

    process.exit(0);
}

run();
