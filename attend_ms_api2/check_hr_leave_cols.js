
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

async function run() {
    try {
        const pool = await getCompanyPool('SKK');
        console.log("Checking hr_leave columns in SKK...");
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'hr_leave'
            ORDER BY column_name
        `);
        console.log("Columns:", res.rows.map(r => r.column_name));

        const hasHolidayType = res.rows.some(r => r.column_name === 'holiday_type');
        console.log(`Has holiday_type: ${hasHolidayType}`);

    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}
run();
