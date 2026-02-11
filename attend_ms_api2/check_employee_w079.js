import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Checking employee B1-W079...\n');

// Check employee details
query(`
  SELECT id, "x_Emp_No", name, active, company_id
  FROM hr_employee 
  WHERE "x_Emp_No" = 'B1-W079'
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  if (res1.rows.length === 0) {
    console.log('❌ Employee B1-W079 not found in database!');
    process.exit(1);
  }

  const employee = res1.rows[0];
  console.log('✅ Employee found:');
  console.log('   ID:', employee.id);
  console.log('   Employee No:', employee.x_Emp_No);
  console.log('   Name:', employee.name);
  console.log('   Active:', employee.active);
  console.log('   Company ID:', employee.company_id);

  const employeeId = employee.id;

  // Check recent clock in/out records
  console.log('\n📋 Checking recent clock in/out records...\n');
  query(`
    SELECT 
      id, employee_id, clock_in, clock_out, 
      clock_in_date, clock_out_date,
      clock_in_location, project_id,
      in_lat, in_lan, in_addr,
      clock_in_image_uri,
      create_date
    FROM employee_clocking_line 
    WHERE employee_id = $1 
    ORDER BY clock_in_date DESC, create_date DESC 
    LIMIT 5;
  `, [employeeId], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log(`Found ${res2.rows.length} clock in/out records:\n`);
    
    if (res2.rows.length === 0) {
      console.log('⚠️  NO RECORDS FOUND for employee ID', employeeId);
      console.log('\nThis means clock-in is NOT being saved to the database.');
      console.log('\nPossible reasons:');
      console.log('1. Clock-in request is failing before reaching database');
      console.log('2. Employee ID mismatch in the request');
      console.log('3. Database INSERT is failing silently');
      console.log('4. Wrong employee number being used');
    } else {
      res2.rows.forEach((row, i) => {
        console.log(`${i + 1}. Record ID: ${row.id}`);
        console.log(`   Clock In: ${row.clock_in} on ${row.clock_in_date}`);
        console.log(`   Clock Out: ${row.clock_out || 'Not clocked out'}`);
        console.log(`   Location: ${row.clock_in_location}`);
        console.log(`   Project ID: ${row.project_id}`);
        console.log(`   GPS: ${row.in_lat}, ${row.in_lan}`);
        console.log(`   Created: ${row.create_date}`);
        console.log('');
      });
    }

    // Check employee_clocking header records
    console.log('\n📋 Checking employee_clocking header records...\n');
    query(`
      SELECT id, company_id, date, clock_in_date, state, create_date
      FROM employee_clocking 
      WHERE company_id = $1 
      ORDER BY date DESC 
      LIMIT 5;
    `, [employee.company_id], (err3, res3) => {
      if (err3) {
        console.error('❌ Error:', err3.message);
      } else {
        console.log(`Found ${res3.rows.length} header records for company ${employee.company_id}:\n`);
        res3.rows.forEach((row, i) => {
          console.log(`${i + 1}. ID: ${row.id}, Date: ${row.date}, State: ${row.state}`);
        });
      }

      process.exit(0);
    });
  });
});
