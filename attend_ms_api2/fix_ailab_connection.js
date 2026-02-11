import pkg from 'pg';
const { Pool } = pkg;

async function fixAILABConnection() {
  console.log('\n🔧 Fixing AILAB Database Connection Configuration\n');
  console.log('='.repeat(70));

  const masterPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    // Check current AILAB configuration
    console.log('📊 Current AILAB Configuration:\n');
    
    const currentConfig = await masterPool.query(`
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

    if (currentConfig.rows.length === 0) {
      console.log('❌ AILAB company not found');
      await masterPool.end();
      return;
    }

    const current = currentConfig.rows[0];
    console.log(`   Company: ${current.company_name}`);
    console.log(`   Host: ${current.server_host}`);
    console.log(`   Port: ${current.server_port}`);
    console.log(`   Database: ${current.database_name}`);
    console.log(`   User: ${current.server_user}`);
    console.log(`   Password: ${current.server_password || '(not set)'}`);
    console.log(`   Active: ${current.active}`);

    // Test connection to local CX18AI database
    console.log('\n📊 Testing connection to local CX18AI database...\n');
    
    const testPool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'openpg',
      password: 'openpgpwd',
      database: 'CX18AI',
      connectionTimeoutMillis: 5000
    });

    try {
      await testPool.query('SELECT 1');
      console.log('✅ Local CX18AI database is accessible\n');
      await testPool.end();
    } catch (testErr) {
      console.log('❌ Cannot connect to local CX18AI database');
      console.log(`   Error: ${testErr.message}\n`);
      await testPool.end();
      await masterPool.end();
      return;
    }

    // Update AILAB configuration to use localhost
    console.log('📊 Updating AILAB configuration to use localhost...\n');
    
    await masterPool.query(`
      UPDATE companies
      SET 
        server_host = 'localhost',
        server_port = 5432,
        database_name = 'CX18AI',
        server_user = 'openpg',
        server_password = 'openpgpwd'
      WHERE company_code = 'AILAB'
    `);

    console.log('✅ Configuration updated successfully\n');

    // Verify the update
    const updatedConfig = await masterPool.query(`
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

    const updated = updatedConfig.rows[0];
    console.log('📊 New AILAB Configuration:\n');
    console.log(`   Company: ${updated.company_name}`);
    console.log(`   Host: ${updated.server_host}`);
    console.log(`   Port: ${updated.server_port}`);
    console.log(`   Database: ${updated.database_name}`);
    console.log(`   User: ${updated.server_user}`);
    console.log(`   Active: ${updated.active}`);

    await masterPool.end();

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ AILAB Configuration Fixed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart the API server');
    console.log('   2. Try AILAB login again');
    console.log('   3. Connection should now work without timeout\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await masterPool.end();
    process.exit(1);
  }
}

fixAILABConnection();
