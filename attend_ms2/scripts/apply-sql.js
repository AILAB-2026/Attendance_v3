const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function applySQL(filePath) {
  const abs = path.resolve(filePath);
  console.log('🔧 Applying SQL file:', abs);
  const sql = fs.readFileSync(abs, 'utf-8');
  try {
    await db.query('BEGIN');
    await db.query(sql);
    await db.query('COMMIT');
    console.log('✅ Applied successfully');
  } catch (e) {
    await db.query('ROLLBACK');
    console.error('❌ Failed applying SQL:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

(async () => {
  const file = process.argv[2] || path.join(__dirname, '..', 'backend', 'db', 'functions.sql');
  await applySQL(file);
})();
