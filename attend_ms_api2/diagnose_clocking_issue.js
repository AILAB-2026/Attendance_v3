import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'SKK';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Check for employees with multiple open clocking records (clock_out IS NULL)
        console.log("=== Employees with MULTIPLE open clocking records ===");
        const multipleOpen = await pool.query(`
            SELECT 
                ecl.employee_id,
                he."x_Emp_No" as emp_no,
                he.name as emp_name,
                COUNT(*) as open_count
            FROM employee_clocking_line ecl
            JOIN hr_employee he ON ecl.employee_id = he.id
            WHERE ecl.clock_out IS NULL
            GROUP BY ecl.employee_id, he."x_Emp_No", he.name
            HAVING COUNT(*) > 1
            ORDER BY open_count DESC
            LIMIT 20
        `);

        if (multipleOpen.rows.length === 0) {
            console.log("  No employees with multiple open records found.");
        } else {
            console.log(`  Found ${multipleOpen.rows.length} employees with multiple open records:`);
            multipleOpen.rows.forEach(row => {
                console.log(`    ${row.emp_no} (${row.emp_name}): ${row.open_count} open records`);
            });
        }

        // Check for recent clock-out records that might have failed
        console.log("\n=== Recent records where clock_out might not have been set ===");
        const recentOpen = await pool.query(`
            SELECT 
                ecl.id,
                ecl.employee_id,
                he."x_Emp_No" as emp_no,
                ecl.clock_in_date,
                ecl.clock_in,
                ecl.clock_out,
                ecl.state
            FROM employee_clocking_line ecl
            JOIN hr_employee he ON ecl.employee_id = he.id
            WHERE ecl.clock_out IS NULL
            ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC
            LIMIT 10
        `);

        console.log(`  Found ${recentOpen.rows.length} open records:`);
        recentOpen.rows.forEach(row => {
            console.log(`    ID: ${row.id} | ${row.emp_no} | Date: ${row.clock_in_date} | In: ${row.clock_in} | Out: ${row.clock_out} | State: ${row.state}`);
        });

        // Check if there are records from today that are still open
        console.log("\n=== TODAY's open records (Singapore time) ===");
        const todayOpen = await pool.query(`
            SELECT 
                ecl.id,
                he."x_Emp_No" as emp_no,
                he.name,
                ecl.clock_in,
                ecl.clock_out,
                ecl.state
            FROM employee_clocking_line ecl
            JOIN hr_employee he ON ecl.employee_id = he.id
            WHERE ecl.clock_in_date = (NOW() AT TIME ZONE 'Asia/Singapore')::date
              AND ecl.clock_out IS NULL
            ORDER BY ecl.clock_in DESC
        `);

        console.log(`  Found ${todayOpen.rows.length} open records for today:`);
        todayOpen.rows.forEach(row => {
            console.log(`    ID: ${row.id} | ${row.emp_no} | ${row.name} | In: ${row.clock_in} | Out: ${row.clock_out} | State: ${row.state}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
};

run();
