/* Migration script: applies schema.sql and functions.sql to PostgreSQL */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/attendance_db';

  // Parse target DB name and base connection
  const url = new URL(connectionString);
  const targetDb = (url.pathname || '/attendance_db').replace('/', '') || 'attendance_db';
  const baseUrl = new URL(connectionString);
  baseUrl.pathname = '/postgres'; // connect to default DB first

  const basePool = new Pool({ connectionString: baseUrl.toString(), ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

  // Ensure target database exists
  const baseClient = await basePool.connect();
  try {
    const existsRes = await baseClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (existsRes.rowCount === 0) {
      console.log(`Database ${targetDb} not found. Creating...`);
      await baseClient.query(`CREATE DATABASE ${JSON.stringify(targetDb).slice(1, -1)}`); // simple safe-ish
      console.log(`Database ${targetDb} created.`);
    }
  } finally {
    baseClient.release();
    await basePool.end();
  }

  const pool = new Pool({ connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const functionsPath = path.join(__dirname, 'functions.sql');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const functionsSql = fs.readFileSync(functionsPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Connecting to DB:', connectionString);
    await client.query('BEGIN');

    console.log('Applying schema.sql ...');
    await client.query(schemaSql);

    console.log('Applying functions.sql ...');
    await client.query(functionsSql);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
