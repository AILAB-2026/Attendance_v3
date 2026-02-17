
import { getCompanyPool } from './src/multiCompanyDb.js';
import './src/initEnv.js';

async function check() {
    try {
        const pool = await getCompanyPool('AILAB');
        const res = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_audit_logs')");
        console.log('Result:', res.rows[0]);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit(0);
    }
}
check();
