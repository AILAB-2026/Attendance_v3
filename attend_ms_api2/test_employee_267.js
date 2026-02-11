import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from './src/constants.js';

const employeeId = 267; // B1-E079
const employeeNumber = 'B1-E079';

console.log('='.repeat(80));
console.log(`Testing Leave Balance for Employee: ${employeeNumber} (ID: ${employeeId})`);
console.log('='.repeat(80));

// Step 1: Check all allocations
console.log('\n📋 STEP 1: Fetching all leave allocations...\n');

query(`SELECT * FROM hr_leave_allocation WHERE employee_id = $1`, [employeeId], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  console.log(`Found ${res1.rows.length} allocations:\n`);
  res1.rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.name}`);
    console.log(`   Days: ${row.number_of_days}, Status: ${row.state}`);
    console.log(`   Period: ${row.date_from} to ${row.date_to}\n`);
  });

  // Step 2: Check applied leaves
  console.log('📋 STEP 2: Fetching applied leaves...\n');

  query(`SELECT * FROM hr_leave WHERE employee_id = $1`, [employeeId], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log(`Found ${res2.rows.length} leave applications:\n`);
    if (res2.rows.length > 0) {
      res2.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.name}`);
        console.log(`   Days: ${row.number_of_days}, Status: ${row.state}`);
        console.log(`   Period: ${row.date_from} to ${row.date_to}\n`);
      });
    } else {
      console.log('   No leave applications found.\n');
    }

    // Step 3: Test the API endpoint
    console.log('🔌 STEP 3: Testing /api/leave/balance endpoint...\n');

    const token = jwt.sign({ employeeId, employeeNumber }, SECRET_KEY, { expiresIn: '24h' });
    
    console.log('Generated JWT Token:');
    console.log(token);
    console.log('\n📝 Test with curl:\n');
    console.log(`curl -X GET "http://localhost:3001/api/leave/balance" -H "Authorization: Bearer ${token}"`);
    console.log('\n' + '='.repeat(80));

    process.exit(0);
  });
});
