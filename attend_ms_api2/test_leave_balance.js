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

// First, let's check the table structure
console.log('\n📋 STEP 0: Checking hr_leave_allocation table structure...\n');

const tableStructureQuery = `
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'hr_leave_allocation' 
  ORDER BY ordinal_position;
`;

query(tableStructureQuery, [], (error, result) => {
  if (error) {
    console.error('❌ Error checking table structure:', error);
    return;
  }

  console.log('hr_leave_allocation table columns:');
  result.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });

  // Step 1: Check hr_leave_allocation for this employee
  console.log('\n📋 STEP 1: Checking hr_leave_allocation table...\n');

  const allocationQuery = `
    SELECT *
    FROM hr_leave_allocation
    WHERE employee_id = $1
    ORDER BY date_from DESC;
  `;

query(allocationQuery, [employeeId], (error, result) => {
  if (error) {
    console.error('❌ Error querying hr_leave_allocation:', error);
    return;
  }

  console.log(`Found ${result.rows.length} leave allocations:\n`);
  
  result.rows.forEach((row, index) => {
    console.log(`${index + 1}. Leave Type: ${row.allocation_name}`);
    console.log(`   Allocated Days: ${row.allocated_days}`);
    console.log(`   Status: ${row.state}`);
    console.log(`   Period: ${row.date_from} to ${row.date_to}`);
    console.log(`   Holiday Status ID: ${row.holiday_status_id}`);
    console.log('');
  });

  // Step 2: Check hr_leave for applied leaves
  console.log('\n📋 STEP 2: Checking hr_leave table (applied leaves)...\n');

  const leaveQuery = `
    SELECT 
      hl.id,
      hl.employee_id,
      hl.name as leave_name,
      hl.number_of_days as days_taken,
      hl.state,
      hl.date_from,
      hl.date_to,
      hl.holiday_status_id
    FROM hr_leave hl
    WHERE hl.employee_id = $1
    ORDER BY hl.date_from DESC;
  `;

  query(leaveQuery, [employeeId], (error2, result2) => {
    if (error2) {
      console.error('❌ Error querying hr_leave:', error2);
      return;
    }

    console.log(`Found ${result2.rows.length} leave applications:\n`);
    
    if (result2.rows.length === 0) {
      console.log('   No leave applications found for this employee.\n');
    } else {
      result2.rows.forEach((row, index) => {
        console.log(`${index + 1}. Leave Name: ${row.leave_name}`);
        console.log(`   Days Taken: ${row.days_taken}`);
        console.log(`   Status: ${row.state}`);
        console.log(`   Period: ${row.date_from} to ${row.date_to}`);
        console.log(`   Holiday Status ID: ${row.holiday_status_id}`);
        console.log('');
      });
    }

    // Step 3: Calculate balance manually
    console.log('\n📊 STEP 3: Calculating Leave Balance...\n');

    const balanceQuery = `
      WITH leave_allocations AS (
        SELECT 
          hla.employee_id,
          hla.holiday_status_id,
          hla.name as leave_type_name,
          COALESCE(SUM(hla.number_of_days), 0) as allocated_days
        FROM hr_leave_allocation hla
        WHERE hla.employee_id = $1
          AND hla.state = 'validate'
          AND CURRENT_DATE BETWEEN hla.date_from AND hla.date_to
        GROUP BY hla.employee_id, hla.holiday_status_id, hla.name
      ),
      leave_taken AS (
        SELECT 
          hl.employee_id,
          hl.holiday_status_id,
          COALESCE(SUM(hl.number_of_days), 0) as taken_days
        FROM hr_leave hl
        WHERE hl.employee_id = $1
          AND hl.state IN ('validate', 'confirm')
        GROUP BY hl.employee_id, hl.holiday_status_id
      )
      SELECT 
        la.leave_type_name,
        la.allocated_days,
        COALESCE(lt.taken_days, 0) as taken_days,
        la.allocated_days - COALESCE(lt.taken_days, 0) as balance
      FROM leave_allocations la
      LEFT JOIN leave_taken lt ON la.employee_id = lt.employee_id 
        AND la.holiday_status_id = lt.holiday_status_id
      ORDER BY la.leave_type_name;
    `;

    query(balanceQuery, [employeeId], (error3, result3) => {
      if (error3) {
        console.error('❌ Error calculating balance:', error3);
        return;
      }

      console.log('Leave Balance Summary:\n');
      
      if (result3.rows.length === 0) {
        console.log('   ⚠️  No active leave allocations found for current period.\n');
      } else {
        result3.rows.forEach((row, index) => {
          console.log(`${index + 1}. ${row.leave_type_name}`);
          console.log(`   Allocated: ${row.allocated_days} days`);
          console.log(`   Taken: ${row.taken_days} days`);
          console.log(`   Balance: ${row.balance} days`);
          console.log('');
        });
      }

      // Step 4: Test the API endpoint
      console.log('\n🔌 STEP 4: Testing /api/leave/balance endpoint...\n');

      // Generate JWT token for this employee
      const token = jwt.sign(
        { 
          employeeId: employeeId,
          employeeNumber: employeeNumber
        },
        SECRET_KEY,
        { expiresIn: '24h' }
      );

      console.log('Generated JWT Token for testing:');
      console.log(token);
      console.log('\n📝 To test the endpoint, use this curl command:\n');
      console.log(`curl -X GET "http://localhost:3001/api/leave/balance" \\`);
      console.log(`  -H "Authorization: Bearer ${token}"`);
      console.log('\n');
      console.log('Or test in browser/Postman:');
      console.log('URL: http://localhost:3001/api/leave/balance');
      console.log(`Authorization Header: Bearer ${token}`);
      console.log('\n');
      console.log('='.repeat(80));
      console.log('✅ Test Complete!');
      console.log('='.repeat(80));

      process.exit(0);
    });
  });
});
