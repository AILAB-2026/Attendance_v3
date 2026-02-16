import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addHalfDayTypeColumn() {
  console.log('\n🔄 Adding half_day_type column to AILAB hr_leave table\n');
  console.log('='.repeat(70));

  // Step 1: Connect to master DB to get AILAB configuration
  console.log('\n📊 Step 1: Getting AILAB database configuration...\n');
  
  const masterPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    const configResult = await masterPool.query(`
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

    if (configResult.rows.length === 0) {
      console.log('❌ AILAB company not found in database');
      await masterPool.end();
      return;
    }

    const config = configResult.rows[0];
    console.log('✅ AILAB Configuration:');
    console.log(`   Company: ${config.company_name}`);
    console.log(`   Host: ${config.server_host}`);
    console.log(`   Port: ${config.server_port}`);
    console.log(`   Database: ${config.database_name}`);
    console.log(`   Active: ${config.active}`);

    await masterPool.end();

    // Step 2: Connect to AILAB database
    console.log('\n📊 Step 2: Connecting to AILAB database...\n');
    
    const ailabPool = new Pool({
      host: config.server_host,
      port: config.server_port,
      user: config.server_user,
      password: 'openpgpwd',
      database: config.database_name,
      connectionTimeoutMillis: 15000
    });

    console.log('⏳ Testing connection...');
    await ailabPool.query('SELECT 1');
    console.log('✅ Connected to AILAB database\n');

    // Step 3: Check if column already exists
    console.log('📊 Step 3: Checking if half_day_type column exists...\n');
    
    const checkResult = await ailabPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hr_leave' 
        AND column_name = 'half_day_type'
    `);

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Column half_day_type already exists in hr_leave table');
      console.log('   No migration needed\n');
      await ailabPool.end();
      return;
    }

    console.log('✅ Column does not exist, proceeding with migration\n');

    // Step 4: Read and execute migration SQL
    console.log('📊 Step 4: Running migration script...\n');
    
    const migrationPath = path.join(__dirname, 'migrations', 'add_half_day_type_ailab.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('select')) {
        // This is the verification query
        const result = await ailabPool.query(statement);
        if (result.rows.length > 0) {
          console.log('✅ Column added successfully:');
          console.log(`   Column: ${result.rows[0].column_name}`);
          console.log(`   Type: ${result.rows[0].data_type}`);
          console.log(`   Max Length: ${result.rows[0].character_maximum_length || 'N/A'}`);
          console.log(`   Nullable: ${result.rows[0].is_nullable}`);
        }
      } else {
        await ailabPool.query(statement);
      }
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Step 5: Verify the table structure
    console.log('📊 Step 5: Verifying hr_leave table structure...\n');
    
    const columnsResult = await ailabPool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'hr_leave'
      ORDER BY ordinal_position
    `);

    console.log('hr_leave table columns:');
    console.log('─'.repeat(70));
    columnsResult.rows.forEach(col => {
      const maxLen = col.character_maximum_length ? ` (${col.character_maximum_length})` : '';
      const indicator = col.column_name === 'half_day_type' ? '✅ ' : '   ';
      console.log(`${indicator}${col.column_name.padEnd(30)} | ${col.data_type}${maxLen}`);
    });
    console.log('─'.repeat(70));

    await ailabPool.end();

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ AILAB Database Migration Complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart the API server (if running)');
    console.log('   2. Test leave application functionality');
    console.log('   3. Verify half-day leave requests work correctly\n');

  } catch (error) {
    console.error('\n❌ Migration Error:', error.message);
    console.error(error.stack);
    
    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Suggestion: AILAB database server is unreachable');
      console.log('   - Check if VPN connection is required');
      console.log('   - Verify network connectivity to external server');
    }
    
    process.exit(1);
  }
}

addHalfDayTypeColumn().catch(err => {
  console.error('\n❌ Fatal Error:', err.message);
  process.exit(1);
});
