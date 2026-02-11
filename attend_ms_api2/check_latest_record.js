import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Checking the ABSOLUTE LATEST record in employee_clocking_line...\n');

query(`
  SELECT 
    id, 
    employee_id,
    clock_in, 
    clock_in_date,
    clock_in_location,
    create_date,
    write_date
  FROM employee_clocking_line 
  ORDER BY id DESC 
  LIMIT 5
`, [], (err, res) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  console.log(`Latest 5 records in the ENTIRE table (by ID):\n`);
  
  res.rows.forEach((row, i) => {
    console.log(`${i + 1}. ID: ${row.id}`);
    console.log(`   Employee ID: ${row.employee_id}`);
    console.log(`   Clock In: ${row.clock_in} on ${row.clock_in_date}`);
    console.log(`   Location: ${row.clock_in_location}`);
    console.log(`   Created: ${row.create_date}`);
    console.log(`   Modified: ${row.write_date}`);
    console.log('');
  });

  console.log('\n🔍 Now checking specifically for employee 267 (B1-E079)...\n');
  
  query(`
    SELECT 
      id, 
      clock_in, 
      clock_in_date,
      clock_in_location,
      create_date
    FROM employee_clocking_line 
    WHERE employee_id = 267
    ORDER BY id DESC 
    LIMIT 3
  `, [], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log(`Latest 3 records for employee 267:\n`);
    
    res2.rows.forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.id}`);
      console.log(`   Clock In: ${row.clock_in} on ${row.clock_in_date}`);
      console.log(`   Location: ${row.clock_in_location}`);
      console.log(`   Created: ${row.create_date}`);
      console.log('');
    });

    const latestId = res2.rows.length > 0 ? res2.rows[0].id : 'None';
    console.log(`\n📊 Latest record ID for employee 267: ${latestId}`);
    console.log(`\n💡 If this ID doesn't change after clock-in, the record is NOT being saved!`);
    
    process.exit(0);
  });
});
