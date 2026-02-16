import pkg from 'pg';
const { Pool } = pkg;

// Test master DB connection
async function testMasterConnection() {
  console.log('\n=== Testing Master DB Connection ===');
  console.log('Host:', process.env.DB_HOST || 'localhost');
  console.log('Port:', process.env.DB_PORT || 5432);
  console.log('User:', process.env.DB_USER || 'postgres');
  console.log('Database:', process.env.DB_NAME || 'attendance_db');
  console.log('Password length:', (process.env.DB_PASSWORD || '').length);

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'attendance_db',
    connectionTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ Master DB connection successful');
    console.log('Query result:', result.rows);

    // Check if companies table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'companies'
      );
    `);
    console.log('Companies table exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      const companies = await pool.query('SELECT * FROM companies LIMIT 5');
      console.log('Companies in DB:', companies.rows);
    }

    await pool.end();
    return true;
  } catch (err) {
    console.error('❌ Master DB connection failed:', err.message);
    await pool.end().catch(() => {});
    return false;
  }
}

testMasterConnection().then(success => {
  process.exit(success ? 0 : 1);
});
