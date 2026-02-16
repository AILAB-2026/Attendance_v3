
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('employee_clocking_line', 'project_project')
      ORDER BY table_name;
    `;

        console.log(`Checking tables in ${COMPANY_CODE}...`);
        const res = await pool.query(query);
        console.log(JSON.stringify(res.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
};

run();
