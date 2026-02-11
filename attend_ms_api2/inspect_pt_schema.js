
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        const getColumns = async (tableName) => {
            const query = `
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '${tableName}';
            `;
            const res = await pool.query(query);
            return res.rows.map(r => `${r.column_name} (${r.data_type})`);
        };

        console.log("--- project_task columns ---");
        const ptCols = await getColumns('project_task');
        console.log(ptCols);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
