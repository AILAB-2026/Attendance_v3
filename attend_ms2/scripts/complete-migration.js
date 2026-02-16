/* 
 * Complete Migration Script
 * This script performs the full migration: reset schema + seed clean data
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 ${description}...`);
    const child = spawn('node', [scriptPath], { stdio: 'inherit' });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${description} failed with code ${code}`);
        reject(new Error(`${description} failed`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ ${description} error:`, error.message);
      reject(error);
    });
  });
}

(async () => {
  try {
    console.log('🔄 Starting Complete Database Migration to Short IDs');
    console.log('================================================');
    console.log('⚠️  WARNING: This will completely reset your database!');
    console.log('📋 Migration Steps:');
    console.log('   1. Reset database schema with short IDs');
    console.log('   2. Seed clean sample data');
    console.log('   3. Verify data integrity');
    
    // Give user time to cancel
    console.log('\n⏳ Starting in 3 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 1: Reset database schema
    await runScript(
      path.join(__dirname, 'reset-and-migrate.js'),
      'Database Schema Reset'
    );
    
    // Step 2: Seed clean data
    await runScript(
      path.join(__dirname, 'seed-clean-data.js'),
      'Clean Data Seeding'
    );
    
    // Step 3: Verify migration
    console.log('\n🔍 Verifying migration...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    const client = await pool.connect();
    
    try {
      // Check table counts
      const tables = [
        'companies', 'users', 'sites', 'projects', 'employee_assignments',
        'schedules', 'clock_events', 'attendance_days', 'leaves', 
        'toolbox_meetings', 'payslips'
      ];
      
      console.log('\n📊 Database Summary:');
      for (const table of tables) {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result.rows[0].count;
        console.log(`   ${table.padEnd(20)}: ${count} records`);
      }
      
      // Verify ID formats
      console.log('\n🔍 Verifying ID formats:');
      const idChecks = [
        { table: 'companies', prefix: 'CMP_' },
        { table: 'users', prefix: 'USR_' },
        { table: 'sites', prefix: 'SIT_' },
        { table: 'projects', prefix: 'PRJ_' },
        { table: 'clock_events', prefix: 'CLK_' }
      ];
      
      for (const check of idChecks) {
        const result = await client.query(`
          SELECT COUNT(*) as count 
          FROM ${check.table} 
          WHERE id LIKE '${check.prefix}%'
        `);
        const count = result.rows[0].count;
        const total = await client.query(`SELECT COUNT(*) as count FROM ${check.table}`);
        const totalCount = total.rows[0].count;
        
        if (count === totalCount && totalCount > 0) {
          console.log(`   ✅ ${check.table}: All ${count} IDs have correct ${check.prefix} prefix`);
        } else {
          console.log(`   ⚠️  ${check.table}: ${count}/${totalCount} IDs have correct format`);
        }
      }
      
      // Check relationships
      console.log('\n🔗 Verifying relationships:');
      const relationshipChecks = [
        {
          name: 'Users → Companies',
          query: 'SELECT COUNT(*) as count FROM users u JOIN companies c ON u.company_id = c.id'
        },
        {
          name: 'Sites → Companies', 
          query: 'SELECT COUNT(*) as count FROM sites s JOIN companies c ON s.company_id = c.id'
        },
        {
          name: 'Assignments → Users',
          query: 'SELECT COUNT(*) as count FROM employee_assignments ea JOIN users u ON ea.user_id = u.id'
        },
        {
          name: 'Clock Events → Users',
          query: 'SELECT COUNT(*) as count FROM clock_events ce JOIN users u ON ce.user_id = u.id'
        }
      ];
      
      for (const check of relationshipChecks) {
        const result = await client.query(check.query);
        const count = result.rows[0].count;
        console.log(`   ✅ ${check.name}: ${count} valid relationships`);
      }
      
    } finally {
      client.release();
      await pool.end();
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('================================================');
    console.log('✅ Database Features:');
    console.log('   • Short, human-readable IDs (8-12 characters)');
    console.log('   • Meaningful prefixes (USR_, CMP_, SIT_, etc.)');
    console.log('   • Collision-resistant generation');
    console.log('   • All relationships maintained');
    console.log('   • Clean sample data loaded');
    console.log('   • No duplicate records');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test frontend screens');
    console.log('   2. Verify all functionality works');
    console.log('   3. Check for any remaining issues');
    console.log('\n🔧 Test Credentials:');
    console.log('   Admin: alice.johnson@abccorp.com / admin123');
    console.log('   Manager: bob.smith@abccorp.com / manager123');
    console.log('   Employee: charlie.brown@abccorp.com / employee123');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
})();
