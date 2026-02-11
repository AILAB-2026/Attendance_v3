import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const run = async () => {
    try {
        const pool = await getCompanyPool('SKK');

        // Check 5 most recent clocking records
        const result = await pool.query(`
            SELECT 
                ecl.id, 
                ecl.site_id, 
                ecl.site_name as stored_site_name,
                ecl.project_id,
                ecl.project_name as stored_project_name,
                ecl.clock_in_date
            FROM employee_clocking_line ecl
            ORDER BY ecl.clock_in_date DESC, ecl.id DESC
            LIMIT 5
        `);

        console.log("RECENT CLOCKING RECORDS:");
        console.log(JSON.stringify(result.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
};

run();
