import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Verifying clock-in records for B1-E079 (Employee ID: 267)...\n');

query(`
  SELECT 
    id, 
    employee_id, 
    clock_in, 
    clock_out,
    clock_in_date,
    clock_out_date,
    clock_in_location, 
    clock_out_location,
    project_id,
    in_lat,
    in_lan,
    in_addr,
    clock_in_image_uri,
    state,
    is_mobile_clocking,
    create_date
  FROM employee_clocking_line 
  WHERE employee_id = 267 
  ORDER BY clock_in_date DESC, create_date DESC 
  LIMIT 10
`, [], (err, res) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  console.log(`✅ Found ${res.rows.length} clock in/out records:\n`);
  console.log('='.repeat(80));
  
  res.rows.forEach((row, i) => {
    console.log(`\n📍 Record #${i + 1}:`);
    console.log(`   ID: ${row.id}`);
    console.log(`   Employee ID: ${row.employee_id}`);
    console.log(`   Clock In: ${row.clock_in} on ${row.clock_in_date}`);
    console.log(`   Clock Out: ${row.clock_out || 'Not clocked out'} ${row.clock_out_date ? 'on ' + row.clock_out_date : ''}`);
    console.log(`   Clock In Location: ${row.clock_in_location}`);
    console.log(`   Clock Out Location: ${row.clock_out_location || 'N/A'}`);
    console.log(`   Project ID: ${row.project_id || 'None'}`);
    console.log(`   GPS (In): ${row.in_lat}, ${row.in_lan}`);
    console.log(`   Address (In): ${row.in_addr}`);
    console.log(`   Face Image URI: ${row.clock_in_image_uri || 'None'}`);
    console.log(`   State: ${row.state}`);
    console.log(`   Mobile Clocking: ${row.is_mobile_clocking === 1 ? 'Yes' : 'No'}`);
    console.log(`   Created: ${row.create_date}`);
    console.log('   ' + '-'.repeat(76));
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ Total records: ${res.rows.length}`);
  console.log('\n💡 If you see records above, clock-in IS working and saving to database!');
  
  process.exit(0);
});
