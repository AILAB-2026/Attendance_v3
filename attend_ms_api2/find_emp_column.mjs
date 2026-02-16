import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'CX18BRKERP',
  password: 'openpgpwd',
  port: 5432,
});

async function findEmpColumn() {
  try {
    console.log('🔍 Finding employee number column...\n');

    // Get all columns in hr_employee table
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'hr_employee'
      ORDER BY column_name;
    `;

    const columnsResult = await pool.query(columnsQuery);
    console.log(`📋 All columns in hr_employee (${columnsResult.rows.length}):`);
    columnsResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name} (${row.data_type})`);
    });

    // Get a sample record to see the data
    console.log('\n📊 Sample record from hr_employee:');
    const sampleQuery = `
      SELECT *
      FROM hr_employee
      WHERE id = 267
      LIMIT 1;
    `;

    const sampleResult = await pool.query(sampleQuery);
    if (sampleResult.rows.length > 0) {
      const row = sampleResult.rows[0];
      console.log('\nSample record (ID 267):');
      Object.keys(row).forEach(key => {
        if (key.toLowerCase().includes('emp') || key.toLowerCase().includes('no') || key === 'id' || key === 'name') {
          console.log(`   ${key}: ${row[key]}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

findEmpColumn();
