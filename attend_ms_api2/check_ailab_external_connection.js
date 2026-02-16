import pkg from 'pg';
const { Pool } = pkg;

async function checkAILABExternalConnection() {
  console.log('\n🔍 Checking AILAB External Server Connection\n');
  console.log('='.repeat(70));

  const masterPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    // Get current AILAB configuration
    console.log('📊 Current AILAB Configuration:\n');
    
    const configResult = await masterPool.query(`
      SELECT 
        company_code,
        company_name,
        server_host,
        server_port,
        database_name,
        server_user,
        server_password,
        active
      FROM companies
      WHERE company_code = 'AILAB'
    `);

    if (configResult.rows.length === 0) {
      console.log('❌ AILAB company not found');
      await masterPool.end();
      return;
    }

    const config = configResult.rows[0];
    console.log(`   Company: ${config.company_name}`);
    console.log(`   Host: ${config.server_host}`);
    console.log(`   Port: ${config.server_port}`);
    console.log(`   Database: ${config.database_name}`);
    console.log(`   User: ${config.server_user}`);
    console.log(`   Password: ${config.server_password ? '***SET***' : '(not set)'}`);
    console.log(`   Active: ${config.active}`);

    await masterPool.end();

    // Test connection to external server
    console.log('\n📊 Testing connection to external AILAB server...\n');
    console.log(`   Connecting to: ${config.server_host}:${config.server_port}`);
    console.log(`   Database: ${config.database_name}`);
    console.log(`   User: ${config.server_user}`);
    console.log(`   Timeout: 15 seconds\n`);

    const externalPool = new Pool({
      host: config.server_host,
      port: config.server_port,
      user: config.server_user,
      password: config.server_password,
      database: config.database_name,
      connectionTimeoutMillis: 15000,
      max: 1
    });

    const startTime = Date.now();
    console.log('⏳ Attempting connection...\n');

    try {
      await externalPool.query('SELECT 1 as test');
      const duration = Date.now() - startTime;
      
      console.log(`✅ Connection Successful! (${duration}ms)\n`);
      
      // Test hr_employee table
      console.log('📊 Testing hr_employee table access...\n');
      const empResult = await externalPool.query(`
        SELECT COUNT(*) as count 
        FROM hr_employee 
        WHERE active = true
      `);
      
      console.log(`   Active Employees: ${empResult.rows[0].count}`);
      
      // Check if specific employee exists
      console.log('\n📊 Checking for employee AILAB0007...\n');
      const userResult = await externalPool.query(`
        SELECT 
          id,
          "x_Emp_No" as "employeeNo",
          name,
          company_id as "companyId",
          CASE WHEN password IS NOT NULL THEN 'YES' ELSE 'NO' END as has_password
        FROM hr_employee
        WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))
        LIMIT 1
      `, ['AILAB0007']);
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        console.log(`   ✅ Employee Found:`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Employee No: ${user.employeeNo}`);
        console.log(`      Name: ${user.name}`);
        console.log(`      Company ID: ${user.companyId}`);
        console.log(`      Has Password: ${user.has_password}`);
      } else {
        console.log(`   ❌ Employee AILAB0007 not found`);
      }

      await externalPool.end();

      console.log('\n' + '='.repeat(70));
      console.log('\n✅ External AILAB Server: ACCESSIBLE\n');
      console.log('📝 Connection is working. Login should succeed if:');
      console.log('   1. Employee exists in the database');
      console.log('   2. Password matches exactly');
      console.log('   3. Employee is active\n');

    } catch (connError) {
      const duration = Date.now() - startTime;
      console.log(`❌ Connection Failed! (${duration}ms)\n`);
      console.log(`   Error Type: ${connError.constructor.name}`);
      console.log(`   Error Message: ${connError.message}`);
      console.log(`   Error Code: ${connError.code || 'N/A'}`);
      
      if (connError.code === 'ECONNREFUSED') {
        console.log('\n💡 Issue: Database server is refusing connections');
        console.log('   - Check if PostgreSQL is running on the external server');
        console.log('   - Verify firewall allows connections on port ' + config.server_port);
      } else if (connError.code === 'ETIMEDOUT' || connError.message.includes('timeout')) {
        console.log('\n💡 Issue: Connection timeout');
        console.log('   - External server might be unreachable from your network');
        console.log('   - VPN connection might be required');
        console.log('   - Firewall might be blocking the connection');
        console.log('   - Server might be down or IP address incorrect');
      } else if (connError.code === '28P01') {
        console.log('\n💡 Issue: Authentication failed');
        console.log('   - Check username and password in companies table');
      } else if (connError.code === '3D000') {
        console.log('\n💡 Issue: Database does not exist');
        console.log('   - Database name "' + config.database_name + '" not found on server');
      }

      await externalPool.end();
      
      console.log('\n' + '='.repeat(70));
      console.log('\n❌ External AILAB Server: NOT ACCESSIBLE\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await masterPool.end();
    process.exit(1);
  }
}

checkAILABExternalConnection();
