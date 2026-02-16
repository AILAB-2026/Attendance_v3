
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        console.log(`Adding missing columns to hr_leave...`);

        // Add half_day_type
        console.log(`Adding half_day_type...`);
        await pool.query(`
      ALTER TABLE hr_leave 
      ADD COLUMN IF NOT EXISTS half_day_type character varying;
    `);

        // Add enable_half_day
        console.log(`Adding enable_half_day...`);
        await pool.query(`
      ALTER TABLE hr_leave 
      ADD COLUMN IF NOT EXISTS enable_half_day boolean DEFAULT false;
    `);

        console.log(`✅ Columns added.`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error adding columns:", err);
        process.exit(1);
    }
};

run();
