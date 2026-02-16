import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Verifying clock out for record ID 22446...\n');

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
    in_lat,
    in_lan,
    out_lat,
    out_lan,
    in_addr,
    out_add
  FROM employee_clocking_line 
  WHERE id = 22446
`, [], (err, res) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  if (res.rows.length === 0) {
    console.log('❌ Record not found');
    process.exit(1);
  }

  const record = res.rows[0];
  console.log('✅ Record Details:\n');
  console.log('   ID:', record.id);
  console.log('   Employee ID:', record.employee_id);
  console.log('   Clock In:', record.clock_in, 'on', record.clock_in_date);
  console.log('   Clock Out:', record.clock_out || 'NOT CLOCKED OUT', record.clock_out_date ? 'on ' + record.clock_out_date : '');
  console.log('   Clock In Location:', record.clock_in_location);
  console.log('   Clock Out Location:', record.clock_out_location || 'N/A');
  console.log('   GPS In:', record.in_lat + ', ' + record.in_lan);
  console.log('   GPS Out:', (record.out_lat || 'N/A') + ', ' + (record.out_lan || 'N/A'));
  console.log('   Address In:', record.in_addr);
  console.log('   Address Out:', record.out_add || 'N/A');
  
  if (record.clock_out) {
    console.log('\n✅ Clock out SUCCESSFUL!');
  } else {
    console.log('\n❌ Still NOT clocked out');
  }

  process.exit(0);
});
