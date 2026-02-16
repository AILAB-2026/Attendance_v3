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

async function checkEmployeeTable() {
  try {
    console.log('🔍 Checking hr_employee table structure...\n');

    // Check columns in hr_employee table
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'hr_employee'
        AND (column_name LIKE '%emp%' OR column_name LIKE '%no%' OR column_name = 'id')
      ORDER BY column_name;
    `;

    const columnsResult = await pool.query(columnsQuery);
    console.log(`📋 Employee-related columns in hr_employee:`);
    columnsResult.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type})`);
    });

    // Check for employee B1-E079
    console.log('\n🔍 Looking for employee B1-E079...');
    const empQuery = `
      SELECT id, emp_no, "x_Emp_No", name, company_id, active
      FROM hr_employee
      WHERE emp_no = 'B1-E079' OR "x_Emp_No" = 'B1-E079'
      LIMIT 5;
    `;

    const empResult = await pool.query(empQuery);
    console.log(`📋 Found ${empResult.rows.length} records for B1-E079:`);
    
    if (empResult.rows.length > 0) {
      empResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Employee Record:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   emp_no: ${row.emp_no}`);
        console.log(`   x_Emp_No: ${row.x_Emp_No}`);
        console.log(`   Name: ${row.name}`);
        console.log(`   Company ID: ${row.company_id}`);
        console.log(`   Active: ${row.active}`);
      });
    } else {
      // Try broader search
      console.log('   ❌ Not found with exact match, trying broader search...');
      const broadQuery = `
        SELECT id, emp_no, "x_Emp_No", name, company_id, active
        FROM hr_employee
        WHERE emp_no LIKE '%E079%' OR "x_Emp_No" LIKE '%E079%'
        LIMIT 5;
      `;
      
      const broadResult = await pool.query(broadQuery);
      console.log(`📋 Broader search found ${broadResult.rows.length} records:`);
      
      if (broadResult.rows.length > 0) {
        broadResult.rows.forEach((row, index) => {
          console.log(`\n${index + 1}. Employee Record:`);
          console.log(`   ID: ${row.id}`);
          console.log(`   emp_no: ${row.emp_no}`);
          console.log(`   x_Emp_No: ${row.x_Emp_No}`);
          console.log(`   Name: ${row.name}`);
          console.log(`   Company ID: ${row.company_id}`);
          console.log(`   Active: ${row.active}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkEmployeeTable();
