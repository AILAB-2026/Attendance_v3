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

async function findEmployeeColumn() {
  try {
    console.log('🔍 Finding employee-related columns in hr_leave table...\n');

    // Get all columns that might contain employee info
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'hr_leave'
        AND (column_name LIKE '%employee%' OR column_name LIKE '%emp%' OR column_name LIKE '%user%')
      ORDER BY column_name;
    `;

    const columnsResult = await pool.query(columnsQuery);
    console.log(`📋 Employee-related columns:`);
    columnsResult.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type})`);
    });

    // Get a sample record to see the values
    console.log('\n📊 Sample record from hr_leave:');
    const sampleQuery = `
      SELECT *
      FROM hr_leave
      WHERE x_employee = 'B1-E079'
      LIMIT 1;
    `;

    const sampleResult = await pool.query(sampleQuery);
    if (sampleResult.rows.length > 0) {
      const row = sampleResult.rows[0];
      console.log('\nSample record fields:');
      Object.keys(row).forEach(key => {
        if (key.includes('employee') || key.includes('emp') || key.includes('user') || key.includes('id')) {
          console.log(`   ${key}: ${row[key]}`);
        }
      });
    }

    // Try to find records by employee number instead
    console.log('\n🔍 Looking for records by employee number B1-E079...');
    const empQuery = `
      SELECT 
        id,
        x_employee,
        date_from,
        date_to,
        name,
        state,
        number_of_days,
        create_date
      FROM hr_leave
      WHERE x_employee = 'B1-E079'
      ORDER BY create_date DESC;
    `;

    const empResult = await pool.query(empQuery);
    console.log(`📋 Found ${empResult.rows.length} records for B1-E079:`);
    
    empResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Leave Record:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Employee: ${row.x_employee}`);
      console.log(`   Date From: ${row.date_from}`);
      console.log(`   Date To: ${row.date_to}`);
      console.log(`   Days: ${row.number_of_days}`);
      console.log(`   State: ${row.state}`);
      console.log(`   Name: ${row.name}`);
      console.log(`   Created: ${row.create_date}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

findEmployeeColumn();
