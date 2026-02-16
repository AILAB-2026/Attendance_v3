import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 VERIFYING LEAVE SYSTEM FOR EMPLOYEE B1-E079 (ID: 267)\n');
console.log('Database:', process.env.DB_NAME);
console.log('Host:', process.env.DB_HOST);
console.log('\n' + '='.repeat(80) + '\n');

// Step 1: Check hr_leave table structure
console.log('STEP 1: Checking hr_leave table structure...\n');

query(`
  SELECT column_name, data_type
  FROM information_schema.columns 
  WHERE table_name = 'hr_leave'
  ORDER BY ordinal_position
  LIMIT 20
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  console.log('hr_leave table columns (first 20):');
  res1.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });

  // Step 2: Check hr_leave_allocation table structure
  console.log('\n' + '='.repeat(80));
  console.log('\nSTEP 2: Checking hr_leave_allocation table structure...\n');

  query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'hr_leave_allocation'
    ORDER BY ordinal_position
    LIMIT 20
  `, [], (err2, res2) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      process.exit(1);
    }

    console.log('hr_leave_allocation table columns (first 20):');
    res2.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Step 3: Check leave applications for employee 267
    console.log('\n' + '='.repeat(80));
    console.log('\nSTEP 3: Checking leave applications (hr_leave) for employee 267...\n');

    query(`
      SELECT 
        hl.id,
        hl.employee_id,
        hl.holiday_status_id,
        hlt.name as leave_type_name,
        hl.date_from,
        hl.date_to,
        hl.number_of_days,
        hl.state,
        hl.create_date
      FROM hr_leave hl
      LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
      WHERE hl.employee_id = 267
      ORDER BY hl.create_date DESC
      LIMIT 10
    `, [], (err3, res3) => {
      if (err3) {
        console.error('❌ Error:', err3.message);
        process.exit(1);
      }

      console.log(`Found ${res3.rows.length} leave application(s):\n`);
      
      if (res3.rows.length === 0) {
        console.log('⚠️  NO LEAVE APPLICATIONS found for employee 267');
        console.log('   This means no leaves have been applied yet.\n');
      } else {
        res3.rows.forEach((leave, i) => {
          console.log(`${i + 1}. Leave ID: ${leave.id}`);
          console.log(`   Type: ${leave.leave_type_name || 'Unknown'} (ID: ${leave.holiday_status_id})`);
          console.log(`   From: ${leave.date_from} To: ${leave.date_to}`);
          console.log(`   Days: ${leave.number_of_days}`);
          console.log(`   Status: ${leave.state}`);
          console.log(`   Applied: ${leave.create_date}`);
          console.log('');
        });
      }

      // Step 4: Check leave allocations for employee 267
      console.log('\n' + '='.repeat(80));
      console.log('\nSTEP 4: Checking leave allocations (hr_leave_allocation) for employee 267...\n');

      query(`
        SELECT 
          hla.id,
          hla.employee_id,
          hla.holiday_status_id,
          hlt.name as leave_type_name,
          hla.number_of_days as allocated_days,
          hla.date_from,
          hla.date_to,
          hla.state,
          hla.name as allocation_name,
          hla.create_date
        FROM hr_leave_allocation hla
        LEFT JOIN hr_leave_type hlt ON hla.holiday_status_id = hlt.id
        WHERE hla.employee_id = 267
          AND hla.state = 'validate'
        ORDER BY hla.create_date DESC
      `, [], (err4, res4) => {
        if (err4) {
          console.error('❌ Error:', err4.message);
          process.exit(1);
        }

        console.log(`Found ${res4.rows.length} leave allocation(s):\n`);
        
        if (res4.rows.length === 0) {
          console.log('⚠️  NO LEAVE ALLOCATIONS found for employee 267');
          console.log('   This means no leave days have been allocated yet.\n');
        } else {
          res4.rows.forEach((alloc, i) => {
            console.log(`${i + 1}. Allocation ID: ${alloc.id}`);
            console.log(`   Type: ${alloc.leave_type_name || 'Unknown'} (ID: ${alloc.holiday_status_id})`);
            console.log(`   Allocated Days: ${alloc.allocated_days}`);
            console.log(`   Period: ${alloc.date_from} to ${alloc.date_to}`);
            console.log(`   Status: ${alloc.state}`);
            console.log(`   Name: ${alloc.allocation_name || 'N/A'}`);
            console.log(`   Created: ${alloc.create_date}`);
            console.log('');
          });
        }

        // Step 5: Calculate leave balance
        console.log('\n' + '='.repeat(80));
        console.log('\nSTEP 5: Calculating leave balance by type...\n');

        query(`
          SELECT 
            hlt.id as leave_type_id,
            hlt.name as leave_type_name,
            COALESCE(SUM(hla.number_of_days), 0) as total_allocated,
            COALESCE((
              SELECT SUM(hl.number_of_days)
              FROM hr_leave hl
              WHERE hl.employee_id = 267
                AND hl.holiday_status_id = hlt.id
                AND hl.state IN ('validate', 'confirm')
            ), 0) as total_taken,
            COALESCE(SUM(hla.number_of_days), 0) - COALESCE((
              SELECT SUM(hl.number_of_days)
              FROM hr_leave hl
              WHERE hl.employee_id = 267
                AND hl.holiday_status_id = hlt.id
                AND hl.state IN ('validate', 'confirm')
            ), 0) as balance
          FROM hr_leave_type hlt
          LEFT JOIN hr_leave_allocation hla ON hla.holiday_status_id = hlt.id 
            AND hla.employee_id = 267 
            AND hla.state = 'validate'
          WHERE hlt.active = true
          GROUP BY hlt.id, hlt.name
          HAVING COALESCE(SUM(hla.number_of_days), 0) > 0
          ORDER BY hlt.name
        `, [], (err5, res5) => {
          if (err5) {
            console.error('❌ Error:', err5.message);
            process.exit(1);
          }

          console.log('Leave Balance Summary:\n');
          
          if (res5.rows.length === 0) {
            console.log('⚠️  No leave balance data available');
          } else {
            console.log('┌────────────────────────────┬───────────┬────────┬─────────┐');
            console.log('│ Leave Type                 │ Allocated │ Taken  │ Balance │');
            console.log('├────────────────────────────┼───────────┼────────┼─────────┤');
            
            res5.rows.forEach(row => {
              const type = (row.leave_type_name || 'Unknown').padEnd(26);
              const allocated = String(row.total_allocated).padStart(9);
              const taken = String(row.total_taken).padStart(6);
              const balance = String(row.balance).padStart(7);
              console.log(`│ ${type} │ ${allocated} │ ${taken} │ ${balance} │`);
            });
            
            console.log('└────────────────────────────┴───────────┴────────┴─────────┘');
          }

          // Final summary
          console.log('\n' + '='.repeat(80));
          console.log('\n📊 VERIFICATION SUMMARY:\n');
          
          console.log(`✅ hr_leave table: ${res1.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
          console.log(`✅ hr_leave_allocation table: ${res2.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
          console.log(`📋 Leave applications: ${res3.rows.length} record(s)`);
          console.log(`📋 Leave allocations: ${res4.rows.length} record(s)`);
          console.log(`📊 Leave types with balance: ${res5.rows.length}`);
          
          console.log('\n' + '='.repeat(80));
          console.log('\n💡 HOW IT WORKS:\n');
          console.log('1. Leave Allocation (hr_leave_allocation):');
          console.log('   - HR/Admin allocates leave days to employees');
          console.log('   - Shows in "Leave Balance" section of mobile app');
          console.log('   - Example: 14 days Annual Leave allocated\n');
          
          console.log('2. Leave Application (hr_leave):');
          console.log('   - Employee applies for leave via mobile app');
          console.log('   - Stored in hr_leave table');
          console.log('   - Deducted from allocated balance\n');
          
          console.log('3. Leave Balance Calculation:');
          console.log('   - Balance = Allocated Days - Taken Days');
          console.log('   - Only counts approved leaves (state = validate/confirm)');
          
          console.log('\n' + '='.repeat(80));
          process.exit(0);
        });
      });
    });
  });
});
