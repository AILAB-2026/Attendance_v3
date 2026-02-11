import pkg from 'pg';
const { Pool } = pkg;

async function checkLogoColumns() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n📊 Checking logo-related columns in companies table...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'companies'
        AND column_name LIKE '%logo%'
      ORDER BY column_name
    `);

    console.log('Logo-related columns found:');
    console.log('─'.repeat(60));
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type}`);
    });
    console.log('─'.repeat(60));

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkLogoColumns();
