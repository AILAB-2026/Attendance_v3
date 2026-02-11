
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

async function run() {
    const pool = await getCompanyPool('AILAB');

    // Check AILAB0006
    const res = await pool.query(`
        SELECT id, "x_Emp_No" as emp_no, name, active, company_id
        FROM hr_employee
        WHERE "x_Emp_No" = 'AILAB0006'
    `);

    if (res.rows.length === 0) {
        console.log("AILAB0006 NOT FOUND");
        process.exit(1);
    }

    const emp = res.rows[0];
    console.log("Employee Details:");
    console.log(`  ID: ${emp.id}`);
    console.log(`  Emp No: ${emp.emp_no}`);
    console.log(`  Name: ${emp.name}`);
    console.log(`  Active: ${emp.active}`);
    console.log(`  Company ID: ${emp.company_id}`);

    // Check today's clockings 
    const todayRes = await pool.query(`
        SELECT 
            id, 
            clock_in_date::text as date, 
            clock_in::text as in_time, 
            clock_out::text as out_time, 
            state,
            write_date
        FROM employee_clocking_line
        WHERE employee_id = $1
        ORDER BY write_date DESC
        LIMIT 5
    `, [emp.id]);

    console.log("\nRecent Clockings:");
    todayRes.rows.forEach(r => {
        console.log(`  ID: ${r.id} | Date: ${r.date} | In: ${r.in_time} | Out: ${r.out_time || 'NULL'} | State: ${r.state}`);
    });

    process.exit(0);
}

run();
