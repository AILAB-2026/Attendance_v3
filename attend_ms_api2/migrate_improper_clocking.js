/**
 * Migration: Add is_improper_clocking column to employee_clocking_line table
 * Run this for each company database (SKK, AILAB, etc.)
 */
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODES = ['SKK', 'AILAB'];

const run = async () => {
    for (const companyCode of COMPANY_CODES) {
        try {
            console.log(`\n=== Adding is_improper_clocking column for ${companyCode} ===`);
            const pool = await getCompanyPool(companyCode);

            // Check if column already exists
            const checkCol = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'employee_clocking_line' 
                  AND column_name = 'is_improper_clocking'
            `);

            if (checkCol.rows.length > 0) {
                console.log(`  Column already exists for ${companyCode}. Skipping.`);
                continue;
            }

            // Add the column
            await pool.query(`
                ALTER TABLE employee_clocking_line 
                ADD COLUMN is_improper_clocking BOOLEAN DEFAULT false
            `);

            console.log(`  ✅ Column added successfully for ${companyCode}`);

        } catch (err) {
            console.error(`  ❌ Error for ${companyCode}:`, err.message);
        }
    }

    console.log('\n=== Migration complete ===');
    process.exit(0);
};

run();
