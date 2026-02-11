
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        const query = `
      SELECT pg_get_functiondef(oid) as func_def
      FROM pg_proc
      WHERE proname = 'hr_leave_sync_to_mobile';
    `;

        console.log(`Fetching function definition for hr_leave_sync_to_mobile...`);
        const res = await pool.query(query);

        if (res.rows.length > 0) {
            const fs = await import('fs');
            fs.writeFileSync('func_def.txt', res.rows[0].func_def);
            console.log("Function definition saved to func_def.txt");
        } else {
            console.log("Function not found.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Error fetching function:", err);
        process.exit(1);
    }
};

run();
