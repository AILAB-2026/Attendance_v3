import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:pgsql%402025@localhost:5432/attendance_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Note: process.env is available in Bun/Node environments. If running in a browser, this will not work.
// Export both named and default exports for compatibility
export const db = pool;
export { pool };
export default pool;