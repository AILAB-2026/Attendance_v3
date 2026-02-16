
import { getCompanyPool } from './src/multiCompanyDb.js';

async function scanTables() {
    const companyCode = 'AILAB'; // Target company
    try {
        const pool = await getCompanyPool(companyCode);
        console.log(`\n--- Scanning tables for ${companyCode} ---`);

        // Find interesting tables
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%attendance%' OR table_name LIKE '%clocking%')
      ORDER BY table_name
    `);

        console.table(res.rows.map(r => r.table_name));

        // Inspect employee_clocking vs employee_clocking_line
        console.log("\n--- employee_clocking (Header) Last 3 ---");
        const headers = await pool.query("SELECT * FROM employee_clocking ORDER BY id DESC LIMIT 3");
        console.log(headers.rows);

        console.log("\n--- employee_clocking_line (Lines) Last 3 ---");
        const lines = await pool.query("SELECT * FROM employee_clocking_line ORDER BY id DESC LIMIT 3");
        console.log(lines.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

scanTables();
