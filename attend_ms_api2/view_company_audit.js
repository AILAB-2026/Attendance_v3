
import { getCompanyPool } from './src/multiCompanyDb.js';
import './src/initEnv.js';

async function check() {
    try {
        const pool = await getCompanyPool('AILAB');
        const res = await pool.query("SELECT created_at, action, status, remark FROM app_audit_logs ORDER BY created_at DESC LIMIT 5");
        console.log('--- AILAB Audit Logs ---');
        res.rows.forEach(row => {
            console.log(`${row.created_at.toISOString()} | ${row.action.padEnd(20)} | ${row.status.padEnd(10)} | ${row.remark}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit(0);
    }
}
check();
