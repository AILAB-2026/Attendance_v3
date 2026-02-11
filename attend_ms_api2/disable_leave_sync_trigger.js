import pkg from 'pg';
const { Pool } = pkg;

async function disableLeaveSyncTrigger() {
  console.log('\n🔄 Disabling hr_leave sync trigger\n');
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

    console.log('📊 Disabling tr_hr_leave_sync_to_mobile trigger...\n');

    // Disable the trigger
    await ailabPool.query(`
      ALTER TABLE hr_leave 
      DISABLE TRIGGER tr_hr_leave_sync_to_mobile
    `);

    console.log('✅ Trigger disabled successfully\n');

    // Verify trigger is disabled
    const verifyResult = await ailabPool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing,
        tgenabled
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'hr_leave'
        AND t.tgname = 'tr_hr_leave_sync_to_mobile'
    `);

    if (verifyResult.rows.length > 0) {
      const trigger = verifyResult.rows[0];
      const status = trigger.tgenabled === 'D' ? 'DISABLED ✅' : 'ENABLED ⚠️';
      console.log('📊 Trigger Status:');
      console.log('─'.repeat(70));
      console.log(`   Trigger: ${trigger.trigger_name}`);
      console.log(`   Status: ${status}`);
      console.log('─'.repeat(70));
    }

    // List remaining active triggers
    console.log('\n📊 Active triggers on hr_leave table:\n');
    
    const activeTriggersResult = await ailabPool.query(`
      SELECT 
        t.tgname as trigger_name,
        CASE t.tgenabled
          WHEN 'O' THEN 'ENABLED'
          WHEN 'D' THEN 'DISABLED'
          ELSE 'UNKNOWN'
        END as status
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'hr_leave'
        AND NOT t.tgisinternal
      ORDER BY t.tgname
    `);

    activeTriggersResult.rows.forEach(trigger => {
      const icon = trigger.status === 'ENABLED' ? '✅' : '❌';
      console.log(`   ${icon} ${trigger.trigger_name.padEnd(40)} | ${trigger.status}`);
    });

    await ailabPool.end();

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Trigger Disabled Successfully!\n');
    console.log('📝 Summary:');
    console.log('   ❌ tr_hr_leave_sync_to_mobile - DISABLED');
    console.log('   ✅ tr_hr_leave_validate_entitlement - ACTIVE');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the API server');
    console.log('   2. Test leave application - should work now');
    console.log('   3. Leave data will be stored locally without remote sync\n');
    console.log('💡 Note: If you need remote sync later, fix the remote database');
    console.log('   connection and re-enable the trigger with:');
    console.log('   ALTER TABLE hr_leave ENABLE TRIGGER tr_hr_leave_sync_to_mobile;\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await ailabPool.end();
    process.exit(1);
  }
}

disableLeaveSyncTrigger();
