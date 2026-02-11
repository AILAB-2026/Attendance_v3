import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Finding open clock-in for employee 267 at Office location...\n');

// First, find the open clock-in record
query(`
  SELECT id, clock_in, clock_in_date, clock_in_location
  FROM employee_clocking_line 
  WHERE employee_id = 267 
    AND clock_in_location LIKE '%Office%' 
    AND clock_out IS NULL
  ORDER BY id DESC
  LIMIT 1
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  if (res1.rows.length === 0) {
    console.log('❌ No open clock-in found for Office location');
    console.log('\nLet me check all open clock-ins for employee 267...\n');
    
    query(`
      SELECT id, clock_in, clock_in_date, clock_in_location
      FROM employee_clocking_line 
      WHERE employee_id = 267 
        AND clock_out IS NULL
      ORDER BY id DESC
    `, [], (err2, res2) => {
      if (err2) {
        console.error('❌ Error:', err2.message);
        process.exit(1);
      }

      if (res2.rows.length === 0) {
        console.log('❌ No open clock-ins found for employee 267');
        process.exit(0);
      }

      console.log(`Found ${res2.rows.length} open clock-in(s):\n`);
      res2.rows.forEach((row, i) => {
        console.log(`${i + 1}. ID: ${row.id} | Clock In: ${row.clock_in} on ${row.clock_in_date} | Location: ${row.clock_in_location}`);
      });
      
      process.exit(0);
    });
    return;
  }

  const openRecord = res1.rows[0];
  console.log('✅ Found open clock-in:');
  console.log(`   ID: ${openRecord.id}`);
  console.log(`   Clock In: ${openRecord.clock_in} on ${openRecord.clock_in_date}`);
  console.log(`   Location: ${openRecord.clock_in_location}`);
  console.log('\n📝 Performing clock out...\n');

  // Get current time for clock out
  const now = new Date();
  const clockOutTimeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS format

  // Update with clock out
  query(`
    UPDATE employee_clocking_line 
    SET clock_out = $1, 
        clock_out_date = CURRENT_DATE, 
        clock_out_location = $2, 
        out_lat = $3, 
        out_lan = $4, 
        out_add = $5,
        write_date = NOW()
    WHERE id = $6
    RETURNING id, clock_in, clock_out, clock_in_location, clock_out_location
  `, [
    clockOutTimeStr,
    'Singapore (Manual Clock Out)',
    '1.3521',
    '103.8198',
    'Singapore (Manual Clock Out)',
    openRecord.id
  ], (err3, res3) => {
    if (err3) {
      console.error('❌ Clock out error:', err3.message);
      process.exit(1);
    }

    const updated = res3.rows[0];
    console.log('✅ Clock out successful!\n');
    console.log('   Record ID:', updated.id);
    console.log('   Clock In:', updated.clock_in);
    console.log('   Clock Out:', updated.clock_out);
    console.log('   Clock In Location:', updated.clock_in_location);
    console.log('   Clock Out Location:', updated.clock_out_location);
    console.log('\n✅ Employee 267 has been clocked out successfully!');
    
    process.exit(0);
  });
});
