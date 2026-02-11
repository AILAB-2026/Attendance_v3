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

async function checkLeaveColumns() {
  try {
    console.log('🔍 Checking hr_leave table structure and data...\n');

    // Get all columns in hr_leave table
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'hr_leave'
      ORDER BY ordinal_position;
    `;

    const columnsResult = await pool.query(columnsQuery);
    console.log(`📋 hr_leave table has ${columnsResult.rows.length} columns:`);
    columnsResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name} (${row.data_type})`);
    });

    // Get sample data to see what's available
    console.log('\n📊 Sample data from hr_leave for employee 267:');
    const sampleQuery = `
      SELECT *
      FROM hr_leave
      WHERE employee_id = 267
      LIMIT 1;
    `;

    const sampleResult = await pool.query(sampleQuery);
    if (sampleResult.rows.length > 0) {
      const row = sampleResult.rows[0];
      console.log('\nAvailable fields and values:');
      Object.keys(row).forEach(key => {
        console.log(`   ${key}: ${row[key]}`);
      });
    } else {
      console.log('   ❌ No records found for employee 267');
    }

    // Count total records for employee 267
    const countQuery = `
      SELECT COUNT(*) as total
      FROM hr_leave
      WHERE employee_id = 267;
    `;

    const countResult = await pool.query(countQuery);
    console.log(`\n📊 Total leave records for employee 267: ${countResult.rows[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkLeaveColumns();
