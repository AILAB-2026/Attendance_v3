import pkg from 'pg';
const { Pool } = pkg;

async function checkCompaniesSchema() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n📊 Checking companies table schema...\n');

    // Get all columns
    const columns = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'companies'
      ORDER BY ordinal_position
    `);

    console.log('✅ Companies table columns:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''})`);
    });

    // Get sample data
    console.log('\n📋 Sample company records:\n');
    const data = await pool.query(`
      SELECT company_code, company_name, active
      FROM companies
      ORDER BY company_code
      LIMIT 5
    `);

    data.rows.forEach(row => {
      console.log(`   - ${row.company_code}: ${row.company_name} (Active: ${row.active})`);
    });

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkCompaniesSchema();
