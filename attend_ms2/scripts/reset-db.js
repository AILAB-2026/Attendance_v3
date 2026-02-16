/* Reset DB: drops and recreates the target database, then runs migration */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { spawnSync } = require('child_process');

(async () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/attendance_db';
  const url = new URL(connectionString);
  const targetDb = (url.pathname || '/attendance_db').replace('/', '') || 'attendance_db';

  const baseUrl = new URL(connectionString);
  baseUrl.pathname = '/postgres';

  const basePool = new Pool({ connectionString: baseUrl.toString(), ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  const baseClient = await basePool.connect();
  try {
    console.log(`[reset-db] Terminating connections to ${targetDb} ...`);
    await baseClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [targetDb]
    );

    console.log(`[reset-db] Dropping database ${targetDb} (if exists) ...`);
    await baseClient.query(`DROP DATABASE IF EXISTS ${JSON.stringify(targetDb).slice(1, -1)}`);

    console.log(`[reset-db] Creating database ${targetDb} ...`);
    await baseClient.query(`CREATE DATABASE ${JSON.stringify(targetDb).slice(1, -1)}`);

    console.log('[reset-db] Running migrations ...');
    const res = spawnSync(process.execPath, [require('path').join(__dirname, '..', 'backend', 'db', 'migrate.js')], {
      stdio: 'inherit',
      env: process.env,
      cwd: require('path').join(__dirname, '..'),
    });
    if (res.status !== 0) {
      throw new Error(`Migration failed with code ${res.status}`);
    }

    console.log('[reset-db] Done.');
  } catch (err) {
    console.error('[reset-db] Error:', err.message);
    process.exit(1);
  } finally {
    baseClient.release();
    await basePool.end();
  }
})();
