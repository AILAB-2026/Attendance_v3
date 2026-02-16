import pkg from 'pg';
const { Pool } = pkg;

async function addHalfDayTypeColumn() {
  console.log('\n🔄 Adding half_day_type column to AILAB hr_leave table\n');
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
    console.log('📊 Checking if half_day_type column exists...\n');
    
    const checkResult = await ailabPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hr_leave' 
        AND column_name = 'half_day_type'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column half_day_type already exists\n');
      await ailabPool.end();
      return;
    }

    console.log('📝 Column does not exist, adding it now...\n');

    // Add the column
    await ailabPool.query(`
      ALTER TABLE hr_leave 
      ADD COLUMN half_day_type VARCHAR(20)
    `);

    console.log('✅ Column added successfully\n');

    // Add comment
    await ailabPool.query(`
      COMMENT ON COLUMN hr_leave.half_day_type IS 'Type of half day leave: morning, afternoon, or NULL for full day'
    `);

    console.log('✅ Comment added\n');

    // Create index
    await ailabPool.query(`
      CREATE INDEX idx_hr_leave_half_day_type ON hr_leave(half_day_type)
    `);

    console.log('✅ Index created\n');

    // Verify
    const verifyResult = await ailabPool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_leave' 
        AND column_name = 'half_day_type'
    `);

    if (verifyResult.rows.length > 0) {
      const col = verifyResult.rows[0];
      console.log('📊 Verification:');
      console.log('─'.repeat(70));
      console.log(`   ✅ Column: ${col.column_name}`);
      console.log(`   ✅ Type: ${col.data_type}(${col.character_maximum_length})`);
      console.log(`   ✅ Nullable: ${col.is_nullable}`);
      console.log('─'.repeat(70));
    }

    await ailabPool.end();

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Migration Complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. The half_day_type column has been added to hr_leave');
    console.log('   2. Restart the API server to apply changes');
    console.log('   3. Test leave application functionality\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await ailabPool.end();
    process.exit(1);
  }
}

addHalfDayTypeColumn();
