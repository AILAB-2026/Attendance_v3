import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

const employeeId = 267;

console.log('🔍 Checking Leave System for Employee 267 (B1-E079)\n');
console.log('='.repeat(60));

// Check leave applications
console.log('\n📋 LEAVE APPLICATIONS (hr_leave):\n');

query(`
  SELECT 
    hl.id,
    hl.employee_id,
    hlt.name as leave_type,
    hl.date_from,
    hl.date_to,
    hl.number_of_days,
    hl.state,
    hl.create_date
  FROM hr_leave hl
  LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
  WHERE hl.employee_id = $1
  ORDER BY hl.create_date DESC
  LIMIT 10
`, [employeeId], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  if (res1.rows.length === 0) {
    console.log('⚠️  No leave applications found');
  } else {
    console.log(`Found ${res1.rows.length} leave application(s):\n`);
    res1.rows.forEach((leave, i) => {
      console.log(`${i + 1}. ID: ${leave.id} | Type: ${leave.leave_type}`);
      console.log(`   From: ${leave.date_from} To: ${leave.date_to}`);
      console.log(`   Days: ${leave.number_of_days} | Status: ${leave.state}`);
      console.log(`   Applied: ${leave.create_date}\n`);
    });
  }

  // Check leave allocations
  console.log('='.repeat(60));
  console.log('\n📊 LEAVE ALLOCATIONS (hr_leave_allocation):\n');

  query(`
    SELECT 
      hla.id,
      hla.employee_id,
      hlt.name as leave_type,
      hla.number_of_days as allocated_days,
      hla.date_from,
      hla.date_to,
      hla.state,
      hla.create_date
    FROM hr_leave_allocation hla
    LEFT JOIN hr_leave_type hlt ON hla.holiday_status_id = hlt.id
    WHERE hla.employee_id = $1
      AND hla.state = 'validate'
    ORDER BY hla.create_date DESC
  `, [employeeId], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    if (res2.rows.length === 0) {
      console.log('⚠️  No leave allocations found');
    } else {
      console.log(`Found ${res2.rows.length} leave allocation(s):\n`);
      res2.rows.forEach((alloc, i) => {
        console.log(`${i + 1}. ID: ${alloc.id} | Type: ${alloc.leave_type}`);
        console.log(`   Allocated Days: ${alloc.allocated_days}`);
        console.log(`   Period: ${alloc.date_from} to ${alloc.date_to}`);
        console.log(`   Status: ${alloc.state}`);
        console.log(`   Created: ${alloc.create_date}\n`);
      });
    }

    // Calculate balance
    console.log('='.repeat(60));
    console.log('\n💰 LEAVE BALANCE CALCULATION:\n');

    query(`
      SELECT 
        hlt.name as leave_type,
        COALESCE(SUM(hla.number_of_days), 0) as allocated,
        COALESCE((
          SELECT SUM(hl.number_of_days)
          FROM hr_leave hl
          WHERE hl.employee_id = ${employeeId}
            AND hl.holiday_status_id = hlt.id
            AND hl.state IN ('validate', 'confirm')
        ), 0) as taken,
        COALESCE(SUM(hla.number_of_days), 0) - COALESCE((
          SELECT SUM(hl.number_of_days)
          FROM hr_leave hl
          WHERE hl.employee_id = ${employeeId}
            AND hl.holiday_status_id = hlt.id
            AND hl.state IN ('validate', 'confirm')
        ), 0) as balance
      FROM hr_leave_type hlt
      LEFT JOIN hr_leave_allocation hla ON hla.holiday_status_id = hlt.id 
        AND hla.employee_id = ${employeeId}
        AND hla.state = 'validate'
      WHERE hlt.active = true
      GROUP BY hlt.id, hlt.name
      HAVING COALESCE(SUM(hla.number_of_days), 0) > 0
      ORDER BY hlt.name
    `, [], (err3, res3) => {
      if (err3) {
        console.error('❌ Error:', err3.message);
        process.exit(1);
      }

      if (res3.rows.length === 0) {
        console.log('⚠️  No leave balance data');
      } else {
        res3.rows.forEach(row => {
          console.log(`${row.leave_type}:`);
          console.log(`  Allocated: ${row.allocated} days`);
          console.log(`  Taken: ${row.taken} days`);
          console.log(`  Balance: ${row.balance} days\n`);
        });
      }

      console.log('='.repeat(60));
      console.log('\n✅ VERIFICATION COMPLETE\n');
      console.log('Summary:');
      console.log(`  - Leave Applications: ${res1.rows.length}`);
      console.log(`  - Leave Allocations: ${res2.rows.length}`);
      console.log(`  - Leave Types with Balance: ${res3.rows.length}`);
      console.log('\n' + '='.repeat(60));
      
      process.exit(0);
    });
  });
});
