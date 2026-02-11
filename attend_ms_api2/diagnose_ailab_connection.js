import pkg from 'pg';
const { Pool } = pkg;

async function diagnoseAILABConnection() {
  console.log('\n🔍 Diagnosing AILAB Database Connection\n');
  console.log('='.repeat(70));

  // Step 1: Check master DB connection
  console.log('\n📊 Step 1: Checking Master DB (attendance_db)...\n');
  
  const masterPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db',
    connectionTimeoutMillis: 5000
  });

  try {
    const result = await masterPool.query(`
      SELECT 
        company_code,
        company_name,
        server_host,
        server_port,
        database_name,
        server_user,
        active
      FROM companies
      WHERE company_code = 'AILAB'
    `);

    if (result.rows.length === 0) {
      console.log('❌ AILAB company not found in database');
      await masterPool.end();
      return;
    }

    const config = result.rows[0];
    console.log('✅ AILAB Configuration Found:');
    console.log(`   Company: ${config.company_name}`);
    console.log(`   Host: ${config.server_host}`);
    console.log(`   Port: ${config.server_port}`);
    console.log(`   Database: ${config.database_name}`);
    console.log(`   User: ${config.server_user}`);
    console.log(`   Active: ${config.active}`);

    await masterPool.end();

    // Step 2: Test AILAB database connection
    console.log('\n📊 Step 2: Testing AILAB Database Connection...\n');
    
    const ailabPool = new Pool({
      host: config.server_host,
      port: config.server_port,
      user: config.server_user,
      password: 'pgsql@2025', // Using the standard password
      database: config.database_name,
      connectionTimeoutMillis: 15000, // 15 seconds timeout
      max: 5
    });

    console.log('⏳ Attempting connection...');
    const startTime = Date.now();

    try {
      const testResult = await ailabPool.query('SELECT 1 as test');
      const duration = Date.now() - startTime;
      
      console.log(`✅ Connection Successful! (${duration}ms)`);
      console.log(`   Test Query Result: ${testResult.rows[0].test}`);

      // Check if database has required tables
      console.log('\n📊 Step 3: Checking Database Tables...\n');
      
      const tablesResult = await ailabPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('hr_employee', 'employee_clocking_line', 'employee_daily_attendance')
        ORDER BY table_name
      `);

      console.log('Required Tables:');
      const requiredTables = ['hr_employee', 'employee_clocking_line', 'employee_daily_attendance'];
      requiredTables.forEach(table => {
        const exists = tablesResult.rows.some(row => row.table_name === table);
        console.log(`   ${exists ? '✅' : '❌'} ${table}`);
      });

      // Check employee count
      console.log('\n📊 Step 4: Checking Employee Data...\n');
      
      const empResult = await ailabPool.query(`
        SELECT COUNT(*) as count FROM hr_employee WHERE active = true
      `);
      
      console.log(`   Active Employees: ${empResult.rows[0].count}`);

      await ailabPool.end();
      
      console.log('\n' + '='.repeat(70));
      console.log('\n✅ AILAB Database Connection: HEALTHY\n');
      console.log('The database is accessible and contains required tables.');
      console.log('The timeout issue might be intermittent or network-related.\n');

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`\n❌ Connection Failed! (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('\n💡 Suggestion: Database server is not running or refusing connections');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('\n💡 Suggestion: Connection timeout - database might be slow or unreachable');
      } else if (error.code === '28P01') {
        console.log('\n💡 Suggestion: Authentication failed - check password');
      } else if (error.code === '3D000') {
        console.log('\n💡 Suggestion: Database does not exist');
      }

      await ailabPool.end();
    }

  } catch (error) {
    console.error('\n❌ Master DB Error:', error.message);
    await masterPool.end();
  }
}

diagnoseAILABConnection().catch(err => {
  console.error('\n❌ Fatal Error:', err.message);
  process.exit(1);
});
