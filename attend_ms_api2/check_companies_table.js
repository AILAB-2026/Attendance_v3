import pkg from 'pg';
const { Pool } = pkg;

async function checkCompaniesTable() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'attendance_db',
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('\n=== Checking companies table structure ===\n');
    
    const columnsResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'companies' ORDER BY ordinal_position`
    );
    
    console.log('Companies table columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n=== Sample data from companies table ===\n');
    const dataResult = await pool.query('SELECT * FROM companies LIMIT 5');
    console.log('Sample rows:');
    console.table(dataResult.rows);

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkCompaniesTable();
