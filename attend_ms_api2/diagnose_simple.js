import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const run = async () => {
    try {
        const pool = await getCompanyPool('SKK');

        // Count employees with multiple open records
        const multipleOpen = await pool.query(`
            SELECT 
                ecl.employee_id,
                he."x_Emp_No" as emp_no,
                COUNT(*) as open_count
            FROM employee_clocking_line ecl
            JOIN hr_employee he ON ecl.employee_id = he.id
            WHERE ecl.clock_out IS NULL
            GROUP BY ecl.employee_id, he."x_Emp_No"
            HAVING COUNT(*) > 1
            ORDER BY open_count DESC
            LIMIT 20
        `);

        console.log("MULTIPLE_OPEN_RECORDS:");
        console.log(JSON.stringify(multipleOpen.rows, null, 2));

        // Today's open records
        const todayOpen = await pool.query(`
            SELECT 
                ecl.id,
                he."x_Emp_No" as emp_no,
                ecl.clock_in::text as clock_in,
                ecl.clock_out::text as clock_out
            FROM employee_clocking_line ecl
            JOIN hr_employee he ON ecl.employee_id = he.id
            WHERE ecl.clock_in_date = (NOW() AT TIME ZONE 'Asia/Singapore')::date
              AND ecl.clock_out IS NULL
            ORDER BY ecl.clock_in DESC
            LIMIT 10
        `);

        console.log("TODAY_OPEN_RECORDS:");
        console.log(JSON.stringify(todayOpen.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("ERROR:", err.message);
        process.exit(1);
    }
};

run();
