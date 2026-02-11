import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 VERIFYING CLOCK-IN RECORDS IN DATABASE\n');
console.log('Database:', process.env.DB_NAME);
console.log('Host:', process.env.DB_HOST);
console.log('User:', process.env.DB_USER);
console.log('\n' + '='.repeat(80) + '\n');

// Step 1: Check if the specific IDs from backend logs exist
console.log('STEP 1: Checking if records 22445 and 22446 exist...\n');

query(`
  SELECT id, employee_id, clock_in, clock_in_date, clock_in_location, create_date
  FROM employee_clocking_line 
  WHERE id IN (22445, 22446)
  ORDER BY id DESC
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  if (res1.rows.length > 0) {
    console.log(`✅ FOUND ${res1.rows.length} record(s):\n`);
    res1.rows.forEach(row => {
      console.log(`   ID: ${row.id}`);
      console.log(`   Employee ID: ${row.employee_id}`);
      console.log(`   Clock In: ${row.clock_in} on ${row.clock_in_date}`);
      console.log(`   Location: ${row.clock_in_location}`);
      console.log(`   Created: ${row.create_date}`);
      console.log('');
    });
  } else {
    console.log('❌ NO RECORDS FOUND with IDs 22445 or 22446');
    console.log('   This means the INSERT did NOT save to the database!\n');
  }

  // Step 2: Check the absolute latest records
  console.log('\n' + '='.repeat(80));
  console.log('\nSTEP 2: Checking the 5 most recent records in the entire table...\n');

  query(`
    SELECT id, employee_id, clock_in, clock_in_date, clock_in_location, create_date
    FROM employee_clocking_line 
    ORDER BY id DESC 
    LIMIT 5
  `, [], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log(`Latest 5 records (by ID):\n`);
    res2.rows.forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.id} | Employee: ${row.employee_id} | Clock In: ${row.clock_in} on ${row.clock_in_date}`);
    });

    const latestId = res2.rows.length > 0 ? res2.rows[0].id : 0;
    console.log(`\n📊 Latest record ID in database: ${latestId}`);

    // Step 3: Check records for employee 267
    console.log('\n' + '='.repeat(80));
    console.log('\nSTEP 3: Checking records for employee 267 (B1-E079)...\n');

    query(`
      SELECT id, clock_in, clock_in_date, clock_in_location, create_date
      FROM employee_clocking_line 
      WHERE employee_id = 267
      ORDER BY id DESC 
      LIMIT 5
    `, [], (err3, res3) => {
      if (err3) {
        console.error('❌ Error:', err3.message);
        process.exit(1);
      }

      console.log(`Latest 5 records for employee 267:\n`);
      res3.rows.forEach((row, i) => {
        console.log(`${i + 1}. ID: ${row.id} | Clock In: ${row.clock_in} on ${row.clock_in_date} | Location: ${row.clock_in_location}`);
      });

      const latestEmpId = res3.rows.length > 0 ? res3.rows[0].id : 0;
      console.log(`\n📊 Latest record ID for employee 267: ${latestEmpId}`);

      // Final analysis
      console.log('\n' + '='.repeat(80));
      console.log('\n📊 ANALYSIS:\n');

      if (res1.rows.length > 0) {
        console.log('✅ Records 22445/22446 EXIST - Clock-in IS being saved!');
      } else {
        console.log('❌ Records 22445/22446 NOT FOUND - Clock-in is NOT being saved!');
        console.log('\n🔍 Possible reasons:');
        console.log('   1. Backend is connected to a different database');
        console.log('   2. Transaction is not being committed');
        console.log('   3. INSERT is failing silently');
        console.log('   4. You are querying a different database than backend uses');
      }

      console.log('\n' + '='.repeat(80));
      process.exit(0);
    });
  });
});
