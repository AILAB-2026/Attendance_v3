
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        console.log(`Getting pool for ${COMPANY_CODE}...`);
        const pool = await getCompanyPool(COMPANY_CODE);

        // Check if column exists
        const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hr_employee' 
      AND column_name = 'profile_image_uri';
    `;

        const checkRes = await pool.query(checkQuery);

        if (checkRes.rows.length === 0) {
            console.log(`Column 'profile_image_uri' missing in ${COMPANY_CODE}. Adding it now...`);
            const alterQuery = `ALTER TABLE hr_employee ADD COLUMN profile_image_uri TEXT;`;
            await pool.query(alterQuery);
            console.log(`✅ Automatically added 'profile_image_uri' column to ${COMPANY_CODE} database.`);
        } else {
            console.log(`✅ Column 'profile_image_uri' already exists in ${COMPANY_CODE} database.`);
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Error adding column:", err);
        process.exit(1);
    }
};

run();
