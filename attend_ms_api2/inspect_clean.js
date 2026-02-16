
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        const getColumns = async (tableName) => {
            const query = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '${tableName}'
                ORDER BY column_name;
            `;
            const res = await pool.query(query);
            return res.rows.map(r => r.column_name);
        };

        const ptCols = await getColumns('project_task');
        console.log("Cols in project_task:");
        ptCols.forEach(c => console.log(c));

        const pedCols = await getColumns('project_employee_details');
        console.log("Cols in project_employee_details:");
        pedCols.forEach(c => console.log(c));

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
