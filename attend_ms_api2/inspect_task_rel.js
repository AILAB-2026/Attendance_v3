
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        const query = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'project_task_user_rel'
            ORDER BY column_name;
        `;
        const res = await pool.query(query);
        console.log("Cols in project_task_user_rel:");
        res.rows.forEach(r => console.log(r.column_name));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
