import pkg from 'pg';
const { Pool } = pkg;

async function addEnableHalfDayColumn() {
  console.log('\n🔄 Adding enable_half_day column to AILAB hr_leave table\n');
  console.log('='.repeat(70));

  const ailabPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'openpg',
    password: 'openpgpwd',
    database: 'CX18AI',
    connectionTimeoutMillis: 15000
  });

  try {
    console.log('⏳ Connecting to AILAB database...');
    await ailabPool.query('SELECT 1');
    console.log('✅ Connected\n');

    // Check if column exists
    console.log('📊 Checking if enable_half_day column exists...\n');
    
    const checkResult = await ailabPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hr_leave' 
        AND column_name = 'enable_half_day'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column enable_half_day already exists\n');
      await ailabPool.end();
      return;
    }

    console.log('📝 Column does not exist, adding it now...\n');

    // Add the column
    await ailabPool.query(`
      ALTER TABLE hr_leave 
      ADD COLUMN enable_half_day BOOLEAN DEFAULT false
    `);

    console.log('✅ Column added successfully\n');

    // Add comment
    await ailabPool.query(`
      COMMENT ON COLUMN hr_leave.enable_half_day IS 'Flag to enable half-day leave functionality'
    `);

    console.log('✅ Comment added\n');

    // Create index
    await ailabPool.query(`
      CREATE INDEX idx_hr_leave_enable_half_day ON hr_leave(enable_half_day)
    `);

    console.log('✅ Index created\n');

    // Verify both columns now exist
    const verifyResult = await ailabPool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_leave' 
        AND column_name IN ('half_day_type', 'enable_half_day')
      ORDER BY column_name
    `);

    console.log('📊 Verification - Leave-related columns:');
    console.log('─'.repeat(70));
    verifyResult.rows.forEach(col => {
      const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`   ✅ ${col.column_name.padEnd(25)} | ${col.data_type}${maxLen} | Nullable: ${col.is_nullable}`);
    });
    console.log('─'.repeat(70));

    await ailabPool.end();

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Migration Complete!\n');
    console.log('📝 Summary:');
    console.log('   ✅ half_day_type column - VARCHAR(20)');
    console.log('   ✅ enable_half_day column - BOOLEAN');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the API server to apply changes');
    console.log('   2. Test leave application functionality');
    console.log('   3. Both full-day and half-day leaves should now work\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await ailabPool.end();
    process.exit(1);
  }
}

addEnableHalfDayColumn();
