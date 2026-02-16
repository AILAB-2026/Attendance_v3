
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB'; // Or 'BRK', trying AILAB first

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
            return res.rows;
        };

        console.log("--- hr_employee columns ---");
        const hrCols = await getColumns('hr_employee');
        console.log(hrCols.filter(c => c.column_name.includes('site_popup')));

        console.log("\n--- project_employee_details columns ---");
        const pedCols = await getColumns('project_employee_details');
        console.log(pedCols);

        console.log("\n--- project_task columns ---");
        const ptCols = await getColumns('project_task');
        console.log(ptCols);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
