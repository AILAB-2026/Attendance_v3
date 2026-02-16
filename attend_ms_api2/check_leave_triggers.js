import pkg from 'pg';
const { Pool } = pkg;

async function checkLeaveTriggers() {
  console.log('\n🔍 Checking hr_leave triggers and functions\n');
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

    // Check triggers on hr_leave table
    console.log('📊 Triggers on hr_leave table:\n');
    
    const triggersResult = await ailabPool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'hr_leave'
      ORDER BY trigger_name
    `);

    if (triggersResult.rows.length === 0) {
      console.log('   No triggers found\n');
    } else {
      triggersResult.rows.forEach(trigger => {
        console.log(`   Trigger: ${trigger.trigger_name}`);
        console.log(`   Event: ${trigger.action_timing} ${trigger.event_manipulation}`);
        console.log(`   Action: ${trigger.action_statement}`);
        console.log('   ' + '─'.repeat(66));
      });
    }

    // Check if hr_leave_sync_to_mobile function exists
    console.log('\n📊 Checking hr_leave_sync_to_mobile function:\n');
    
    const functionResult = await ailabPool.query(`
      SELECT 
        proname as function_name,
        pg_get_functiondef(oid) as function_definition
      FROM pg_proc
      WHERE proname = 'hr_leave_sync_to_mobile'
    `);

    if (functionResult.rows.length === 0) {
      console.log('   ✅ Function does not exist (good - no sync issues)\n');
    } else {
      console.log('   ⚠️  Function exists - this is causing the error\n');
      console.log('   Function definition:');
      console.log('   ' + '─'.repeat(66));
      console.log(functionResult.rows[0].function_definition.substring(0, 500) + '...\n');
    }

    await ailabPool.end();

    console.log('='.repeat(70));
    console.log('\n💡 Recommendation:\n');
    console.log('   The hr_leave_sync_to_mobile trigger is trying to sync data to a');
    console.log('   remote server that doesn\'t have the required database.');
    console.log('\n   Options:');
    console.log('   1. Disable the trigger (recommended for now)');
    console.log('   2. Fix the remote database connection');
    console.log('   3. Update the trigger to handle missing databases gracefully\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await ailabPool.end();
    process.exit(1);
  }
}

checkLeaveTriggers();
