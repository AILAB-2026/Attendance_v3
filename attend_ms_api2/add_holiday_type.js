
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        console.log(`Adding holiday_type column to hr_leave...`);

        await pool.query(`
      ALTER TABLE hr_leave 
      ADD COLUMN IF NOT EXISTS holiday_type character varying DEFAULT 'employee';
    `);

        console.log(`✅ Column added.`);

        console.log(`Updating existing records to default 'employee'...`);
        await pool.query(`
      UPDATE hr_leave SET holiday_type = 'employee' WHERE holiday_type IS NULL;
    `);

        console.log(`✅ Records updated.`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error adding column:", err);
        process.exit(1);
    }
};

run();
