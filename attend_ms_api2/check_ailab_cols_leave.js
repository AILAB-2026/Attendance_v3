
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

async function run() {
    try {
        const pool = await getCompanyPool('AILAB');
        console.log("Checking hr_leave columns in AILAB...");
        const res = await pool.query(`
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'hr_leave'
              AND column_name IN ('holiday_type', 'half_day_type', 'enable_half_day')
        `);
        console.log("Columns:", res.rows);

    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}
run();
