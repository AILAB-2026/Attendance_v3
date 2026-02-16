import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const run = async () => {
    try {
        const pool = await getCompanyPool('BRK');
        const queryString = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hr_employee' 
      AND (column_name ILIKE '%image%' OR column_name ILIKE '%photo%' OR column_name ILIKE '%avatar%' OR column_name ILIKE '%url%')
      ORDER BY column_name;
    `;
        const result = await pool.query(queryString);
        console.log("Columns in hr_employee (Company BRK):");
        console.table(result.rows);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
