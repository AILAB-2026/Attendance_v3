
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'hr_employee' AND column_name = 'user_id'
        `);
        console.log("hr_employee user_id column:", res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
