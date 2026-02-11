
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Check both tables
        const query = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('employee_clocking_line', 'employee_daily_attendance')
      ORDER BY table_name, column_name;
    `;

        console.log(`Checking clocking columns in ${COMPANY_CODE}...`);
        const res = await pool.query(query);
        console.log(JSON.stringify(res.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("❌ Error checking schema:", err);
        process.exit(1);
    }
};

run();
