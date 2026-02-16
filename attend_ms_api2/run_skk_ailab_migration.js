import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

async function runMigration(companyCode, dbName) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Running migration for ${companyCode} database...`);
    console.log(`${'='.repeat(60)}\n`);

    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'pgsql@2025',
      database: dbName
    });

    // Read the SQL migration file
    const sqlFile = path.join(process.cwd(), 'migrations', 'add_columns_skk_ailab.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const result = await pool.query(statement);
        successCount++;
        console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
      } catch (err) {
        if (err.code === '42701' || err.code === '42P07' || err.message.includes('already exists')) {
          // Column/index already exists - this is OK
          skipCount++;
          console.log(`⚠️  Already exists: ${statement.substring(0, 60)}...`);
        } else {
          errorCount++;
          console.error(`❌ Error: ${err.message}`);
        }
      }
    }

    console.log(`\n📊 Migration Summary for ${companyCode}:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Already exists: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);

    await pool.end();
    return errorCount === 0;
  } catch (err) {
    console.error(`❌ Migration failed for ${companyCode}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting database migrations for SKK and AILAB...\n');

  const databases = [
    { code: 'SKK', name: 'SKK' },
    { code: 'AILAB', name: 'AILAB' }
  ];

  let allSuccess = true;
  for (const db of databases) {
    const success = await runMigration(db.code, db.name);
    if (!success) allSuccess = false;
  }

  if (allSuccess) {
    console.log('\n✅ All migrations completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart the backend API: npm start');
    console.log('   2. Test clock-in/out functionality');
    console.log('   3. Verify facial authentication\n');
  } else {
    console.log('\n⚠️  Some migrations encountered errors. Please check above.\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
