
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
            AND table_name LIKE 'project_task%'
            ORDER BY table_name;
        `;
        const res = await pool.query(query);
        console.log("Tables like project_task%:");
        res.rows.forEach(r => console.log(r.table_name));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
