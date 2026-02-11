const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAndFixClockStatus() {
  try {
    const today = '2025-09-23';
    const userId = 'USR_EMP001';
    
    console.log('🔍 Checking clock-in status for user E001 on', today);
    console.log('================================================');
    
    // 1. Check attendance_entries for today
    console.log('\n📋 ATTENDANCE ENTRIES:');
    const entries = await db.query(
      'SELECT * FROM attendance_entries WHERE user_id = $1 AND date = $2', 
      [userId, today]
    );
    
    if (entries.rows.length === 0) {
      console.log('  ✅ No attendance entries for today - should be able to clock in');
    } else {
      console.log('  Found', entries.rows.length, 'entries:');
      entries.rows.forEach((row, index) => {
        console.log(`    ${index + 1}. Site: ${row.site_name}, Project: ${row.project_name}`);
        console.log(`       Clock In ID: ${row.clock_in_id || 'NULL'}`);
        console.log(`       Clock Out ID: ${row.clock_out_id || 'NULL'}`);
        
        if (row.clock_in_id) {
          console.log('       ❌ THIS ENTRY IS BLOCKING CLOCK-IN!');
        }
      });
    }
    
    // 2. Check clock_events for today
    console.log('\n⏰ CLOCK EVENTS:');
    const startTs = Date.parse(today + 'T00:00:00Z');
    const endTs = Date.parse(today + 'T23:59:59Z');
    const events = await db.query(
      'SELECT * FROM clock_events WHERE user_id = $1 AND timestamp >= $2 AND timestamp < $3 ORDER BY timestamp', 
      [userId, startTs, endTs]
    );
    
    if (events.rows.length === 0) {
      console.log('  ✅ No clock events for today');
    } else {
      console.log('  Found', events.rows.length, 'events:');
      events.rows.forEach((row, index) => {
        const eventTime = new Date(parseInt(row.timestamp)).toLocaleString();
        console.log(`    ${index + 1}. ${row.type.toUpperCase()} at ${eventTime}`);
        console.log(`       Site: ${row.site_name}, Project: ${row.project_name}`);
        console.log(`       Method: ${row.method}`);
      });
    }
    
    // 3. Check for specific blocking entry
    console.log('\n🎯 SPECIFIC CHECK (Head Office / HQ Renovation):');
    const blockingEntry = await db.query(
      'SELECT * FROM attendance_entries WHERE user_id = $1 AND date = $2 AND site_name = $3 AND project_name = $4', 
      [userId, today, 'Head Office', 'HQ Renovation']
    );
    
    if (blockingEntry.rows.length === 0) {
      console.log('  ✅ No blocking entry for Head Office / HQ Renovation');
    } else {
      console.log('  ❌ Found blocking entry:');
      const entry = blockingEntry.rows[0];
      console.log(`     Clock In ID: ${entry.clock_in_id || 'NULL'}`);
      console.log(`     Clock Out ID: ${entry.clock_out_id || 'NULL'}`);
      
      if (entry.clock_in_id) {
        console.log('\n🔧 FIXING: Removing the blocking clock-in record...');
        
        // Delete the clock event
        await db.query('DELETE FROM clock_events WHERE id = $1', [entry.clock_in_id]);
        console.log('  ✅ Deleted clock event:', entry.clock_in_id);
        
        // Reset the attendance entry
        await db.query(
          'UPDATE attendance_entries SET clock_in_id = NULL WHERE id = $1', 
          [entry.id]
        );
        console.log('  ✅ Reset attendance entry');
        
        // Also clean up attendance_days if exists
        await db.query(
          'UPDATE attendance_days SET clock_in_id = NULL, status = $1 WHERE user_id = $2 AND date = $3', 
          ['absent', userId, today]
        );
        console.log('  ✅ Reset attendance day status');
      }
    }
    
    // 4. Final verification
    console.log('\n🔍 FINAL VERIFICATION:');
    const finalCheck = await db.query(
      'SELECT COUNT(*) as count FROM attendance_entries WHERE user_id = $1 AND date = $2 AND clock_in_id IS NOT NULL', 
      [userId, today]
    );
    
    if (finalCheck.rows[0].count === 0) {
      console.log('  ✅ SUCCESS! No blocking clock-in records found');
      console.log('  🎉 User should now be able to clock in');
    } else {
      console.log('  ❌ Still found', finalCheck.rows[0].count, 'blocking records');
    }
    
    console.log('\n📱 FRONTEND CACHE ISSUE:');
    console.log('The frontend might be using cached data. Try:');
    console.log('1. Force refresh the app');
    console.log('2. Clear app cache/storage');
    console.log('3. Restart the app');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await db.end();
  }
}

checkAndFixClockStatus();
