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

async function testEmployeeQuery() {
  try {
    console.log('🧪 Testing different ways to query employee B1-E079...\n');

    // Test 1: With quotes
    console.log('1. Testing with quotes: "x_Emp_No"');
    try {
      const query1 = `SELECT id, "x_Emp_No", name, company_id, active FROM hr_employee WHERE "x_Emp_No" = 'B1-E079' AND company_id = 1`;
      const result1 = await pool.query(query1);
      console.log(`   ✅ Success: Found ${result1.rows.length} records`);
      if (result1.rows.length > 0) {
        console.log(`   Employee: ${result1.rows[0].name} (ID: ${result1.rows[0].id})`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 2: Without quotes
    console.log('\n2. Testing without quotes: x_Emp_No');
    try {
      const query2 = `SELECT id, x_Emp_No, name, company_id, active FROM hr_employee WHERE x_Emp_No = 'B1-E079' AND company_id = 1`;
      const result2 = await pool.query(query2);
      console.log(`   ✅ Success: Found ${result2.rows.length} records`);
      if (result2.rows.length > 0) {
        console.log(`   Employee: ${result2.rows[0].name} (ID: ${result2.rows[0].id})`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Case insensitive with quotes
    console.log('\n3. Testing case insensitive with quotes: LOWER("x_Emp_No")');
    try {
      const query3 = `SELECT id, "x_Emp_No", name, company_id, active FROM hr_employee WHERE LOWER("x_Emp_No") = LOWER('B1-E079') AND company_id = 1`;
      const result3 = await pool.query(query3);
      console.log(`   ✅ Success: Found ${result3.rows.length} records`);
      if (result3.rows.length > 0) {
        console.log(`   Employee: ${result3.rows[0].name} (ID: ${result3.rows[0].id})`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 4: Check what column names actually exist
    console.log('\n4. Checking actual column names containing "Emp"');
    try {
      const query4 = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'hr_employee' 
          AND column_name ILIKE '%emp%'
        ORDER BY column_name;
      `;
      const result4 = await pool.query(query4);
      console.log(`   Found ${result4.rows.length} columns:`);
      result4.rows.forEach(row => {
        console.log(`   - ${row.column_name}`);
      });
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testEmployeeQuery();
