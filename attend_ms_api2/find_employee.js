import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Searching for employees with similar numbers...\n');

// Search for employees with W079 or E079
query(`
  SELECT id, "x_Emp_No", name, active, company_id
  FROM hr_employee 
  WHERE "x_Emp_No" LIKE '%W079%' OR "x_Emp_No" LIKE '%E079%'
  ORDER BY "x_Emp_No"
`, [], (err, res) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  console.log(`Found ${res.rows.length} matching employees:\n`);
  
  res.rows.forEach((emp, i) => {
    console.log(`${i + 1}. ${emp.x_Emp_No}`);
    console.log(`   ID: ${emp.id}`);
    console.log(`   Name: ${emp.name}`);
    console.log(`   Active: ${emp.active}`);
    console.log(`   Company: ${emp.company_id}`);
    console.log('');
  });

  if (res.rows.length === 0) {
    console.log('⚠️  No employees found with W079 or E079');
    console.log('\nSearching for B1-W employees...\n');
    
    query(`
      SELECT id, "x_Emp_No", name, active, company_id
      FROM hr_employee 
      WHERE "x_Emp_No" LIKE 'B1-W%'
      ORDER BY "x_Emp_No"
      LIMIT 10
    `, [], (err2, res2) => {
      if (err2) {
        console.error('❌ Error:', err2.message);
        process.exit(1);
      }

      console.log(`Found ${res2.rows.length} B1-W employees:\n`);
      res2.rows.forEach((emp, i) => {
        console.log(`${i + 1}. ${emp.x_Emp_No} - ${emp.name} (ID: ${emp.id}, Active: ${emp.active})`);
      });

      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
