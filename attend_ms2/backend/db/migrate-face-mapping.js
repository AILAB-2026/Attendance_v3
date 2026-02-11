/**
 * Migration script to create user_face_mapping table
 * Run this to set up the mapping table in AIAttend_v2 database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔄 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'user-face-mapping.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔄 Creating user_face_mapping table...');
    await pool.query(sql);
    console.log('✅ user_face_mapping table created successfully');

    // Verify table exists
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_face_mapping'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Table structure:');
    console.table(result.rows);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
