
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

        console.log("\n--- project_employee_details columns ---");
        const pedCols = await getColumns('project_employee_details');
        console.log(pedCols);

        console.log("\n--- project_task columns ---");
        const ptCols = await getColumns('project_task');
        console.log(ptCols);

        // Check if project_employee_details has data
        const pedData = await pool.query(`SELECT * FROM project_employee_details LIMIT 1`);
        console.log("\n--- project_employee_details sample ---");
        console.log(pedData.rows);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
