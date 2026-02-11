import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('Checking employee_payslip table structure...\n');

// Check table structure
query(`
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns 
  WHERE table_name = 'employee_payslip'
  ORDER BY ordinal_position;
`, [], (err1, res1) => {
  if (err1) {
    console.error('Error:', err1.message);
    process.exit(1);
  }

  console.log('employee_payslip table columns:');
  res1.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
  });

  // Check sample data for employee 267
  console.log('\n\nSample data for employee 267:');
  query(`SELECT * FROM employee_payslip WHERE employee_id = 267 LIMIT 3;`, [], (err2, res2) => {
    if (err2) {
      console.error('Error:', err2.message);
      process.exit(1);
    }

    console.log(`Found ${res2.rows.length} payslip records:\n`);
    res2.rows.forEach((row, i) => {
      console.log(`${i + 1}.`, JSON.stringify(row, null, 2));
    });

    // Check hr_employee for active status
    console.log('\n\nChecking hr_employee table for employee 267:');
    query(`SELECT id, name, active FROM hr_employee WHERE id = 267;`, [], (err3, res3) => {
      if (err3) {
        console.error('Error:', err3.message);
        process.exit(1);
      }

      if (res3.rows.length > 0) {
        console.log('Employee status:', res3.rows[0]);
      } else {
        console.log('Employee not found');
      }

      process.exit(0);
    });
  });
});
