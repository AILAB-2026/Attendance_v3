import 'dotenv/config';
import { getCompanyPool } from './src/multiCompanyDb.js';
import { query } from './src/dbconn.js';

async function checkLogs() {
    const companyCode = process.argv[2] || 'AILAB';
    const sql = 'SELECT * FROM app_audit_logs ORDER BY created_at DESC LIMIT 5';

    console.log('--- Checking Master DB ---');
    await new Promise((resolve) => {
        query(sql, [], (err, res) => {
            if (err) console.error(err);
            else console.table(res?.rows);
            resolve();
        });
    });

    console.log(`--- Checking Company DB (${companyCode}) ---`);
    try {
        const pool = await getCompanyPool(companyCode);
        const res = await pool.query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error('Company DB Error:', e);
    }
}

checkLogs().then(() => process.exit());
