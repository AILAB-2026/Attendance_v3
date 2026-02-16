/* 
 * Database Reset and Migration Script
 * This script completely resets the database with new short ID schema and clean data
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database reset and migration to short IDs...');
    console.log('⚠️  WARNING: This will DELETE ALL existing data!');
    
    // Give a moment for the user to cancel if needed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await client.query('BEGIN');
    
    // Step 1: Apply new schema
    console.log('[reset] 📋 Applying new schema with short IDs...');
    const schemaPath = path.join(__dirname, '..', 'backend', 'db', 'new-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schemaSql);
    console.log('[reset] ✅ New schema applied successfully');
    
    await client.query('COMMIT');
    console.log('[reset] 🎉 Database reset completed successfully!');
    console.log('[reset] 📊 New schema features:');
    console.log('  - Short, human-readable IDs (e.g., USR_ABC123, CMP_XYZ789)');
    console.log('  - Collision-resistant ID generation');
    console.log('  - Sequential IDs for high-volume tables');
    console.log('  - All foreign key relationships maintained');
    console.log('  - Optimized indexes for performance');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reset] ❌ Migration failed:', err.message);
    console.error('[reset] Stack trace:', err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
