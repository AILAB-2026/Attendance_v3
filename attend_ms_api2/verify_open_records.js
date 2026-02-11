import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const run = async () => {
    try {
        const pool = await getCompanyPool('SKK');

        const result = await pool.query('SELECT COUNT(*) as count FROM employee_clocking_line WHERE clock_out IS NULL');
        console.log('Total remaining open records:', result.rows[0].count);

        const todayOpen = await pool.query(`SELECT COUNT(*) as count FROM employee_clocking_line WHERE clock_out IS NULL AND clock_in_date = (NOW() AT TIME ZONE 'Asia/Singapore')::date`);
        console.log('Open records for TODAY:', todayOpen.rows[0].count);

        const oldOpen = await pool.query(`SELECT COUNT(*) as count FROM employee_clocking_line WHERE clock_out IS NULL AND clock_in_date < (NOW() AT TIME ZONE 'Asia/Singapore')::date`);
        console.log('Old open records (before today):', oldOpen.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
};

run();
