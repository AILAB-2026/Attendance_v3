import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('='.repeat(80));
console.log('VERIFYING ATTENDANCE AND LEAVE DATABASE TABLES');
console.log('='.repeat(80));

// Check employee_clocking table structure
console.log('\n📋 STEP 1: Checking employee_clocking table structure...\n');
query(`
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns 
  WHERE table_name = 'employee_clocking'
  ORDER BY ordinal_position;
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  console.log('employee_clocking columns:');
  res1.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
  });

  // Check employee_clocking_line table structure
  console.log('\n📋 STEP 2: Checking employee_clocking_line table structure...\n');
  query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns 
    WHERE table_name = 'employee_clocking_line'
    ORDER BY ordinal_position;
  `, [], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log('employee_clocking_line columns:');
    res2.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
    });

    // Check recent clock in/out records for employee 267
    console.log('\n📋 STEP 3: Checking recent clocking records for employee 267...\n');
    query(`
      SELECT * FROM employee_clocking 
      WHERE employee_id = 267 
      ORDER BY clock_in_date DESC 
      LIMIT 3;
    `, [], (err3, res3) => {
      if (err3) {
        console.error('❌ Error:', err3.message);
      } else {
        console.log(`Found ${res3.rows.length} records in employee_clocking:`);
        res3.rows.forEach((row, i) => {
          console.log(`\n${i + 1}.`, JSON.stringify(row, null, 2));
        });
      }

      // Check employee_clocking_line records
      console.log('\n📋 STEP 4: Checking recent clocking line records for employee 267...\n');
      query(`
        SELECT * FROM employee_clocking_line 
        WHERE employee_id = 267 
        ORDER BY clock_in_time DESC 
        LIMIT 5;
      `, [], (err4, res4) => {
        if (err4) {
          console.error('❌ Error:', err4.message);
        } else {
          console.log(`Found ${res4.rows.length} records in employee_clocking_line:`);
          res4.rows.forEach((row, i) => {
            console.log(`\n${i + 1}.`, JSON.stringify(row, null, 2));
          });
        }

        // Check hr_leave table
        console.log('\n📋 STEP 5: Checking hr_leave table structure...\n');
        query(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = 'hr_leave'
          ORDER BY ordinal_position
          LIMIT 20;
        `, [], (err5, res5) => {
          if (err5) {
            console.error('❌ Error:', err5.message);
          } else {
            console.log('hr_leave columns (first 20):');
            res5.rows.forEach(row => {
              console.log(`  - ${row.column_name} (${row.data_type})`);
            });
          }

          // Check hr_leave_allocation table
          console.log('\n📋 STEP 6: Checking hr_leave_allocation table structure...\n');
          query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'hr_leave_allocation'
            ORDER BY ordinal_position
            LIMIT 20;
          `, [], (err6, res6) => {
            if (err6) {
              console.error('❌ Error:', err6.message);
            } else {
              console.log('hr_leave_allocation columns (first 20):');
              res6.rows.forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
              });
            }

            console.log('\n' + '='.repeat(80));
            console.log('✅ VERIFICATION COMPLETE');
            console.log('='.repeat(80));
            process.exit(0);
          });
        });
      });
    });
  });
});
