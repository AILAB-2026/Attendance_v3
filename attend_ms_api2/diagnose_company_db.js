
import { getCompanyPool, masterPool } from './src/multiCompanyDb.js';

async function diagnose() {
    try {
        console.log("--- Checking Master DB Companies Config ---");
        const res = await masterPool.query("SELECT company_code, company_name, database_name, server_host, active FROM companies");
        console.table(res.rows);

        const companies = res.rows.map(r => r.company_code);

        for (const code of companies) {
            if (!code) continue;
            console.log(`\n--- Testing Pool for ${code} ---`);
            try {
                const pool = await getCompanyPool(code);
                const dbNameRes = await pool.query("SELECT current_database()");
                console.log(`Connected to DB: ${dbNameRes.rows[0].current_database}`);

                // Check if employee_clocking_line exists in this DB
                const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'employee_clocking_line'
            );
        `);
                console.log(`Table 'employee_clocking_line' exists: ${tableCheck.rows[0].exists}`);

                // Check count
                const countRes = await pool.query("SELECT count(*) FROM employee_clocking_line");
                console.log(`Current clocking line count: ${countRes.rows[0].count}`);

            } catch (err) {
                console.error(`Failed to connect/query pool for ${code}:`, err.message);
            }
        }

    } catch (err) {
        console.error("Master pool error:", err);
    } finally {
        process.exit(0);
    }
}

diagnose();
