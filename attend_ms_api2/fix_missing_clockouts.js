const { Pool } = require('pg');

async function fixMissingClockouts() {
    // First connect to attendance_db to get BRK connection details
    const attendancePool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'attendance_db',
        user: 'postgres',
        password: 'pgsql@2025'
    });

    let brkPool = null;

    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  FIX MISSING CLOCKOUTS - 22.12.2025 @ 6 PM');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Get BRK company config
        console.log('📡 Fetching BRK database configuration...');
        const companyResult = await attendancePool.query(
            "SELECT * FROM companies WHERE company_code = 'BRK'"
        );

        if (companyResult.rows.length === 0) {
            throw new Error('BRK company not found in attendance_db');
        }

        const company = companyResult.rows[0];
        console.log(`✅ Found BRK company: ${company.company_name}`);
        console.log(`   Database: ${company.database_name}`);
        console.log(`   Host: ${company.server_host}:${company.server_port}\n`);

        // Connect to BRK database
        brkPool = new Pool({
            host: company.server_host,
            port: company.server_port,
            database: company.database_name,
            user: company.server_user,
            password: company.server_password
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  STEP 1: VERIFICATION - Current Status');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const verificationQuery = `
      SELECT 
          ecl.id,
          ecl.employee_no,
          ecl.clock_in_date,
          ecl.clock_in,
          ecl.clock_out_date,
          ecl.clock_out,
          ecl.clock_in_location,
          ecl.clock_out_location,
          CASE 
              WHEN ecl.clock_out IS NULL THEN 'MISSING CLOCKOUT'
              ELSE 'HAS CLOCKOUT'
          END as status
      FROM employee_clocking_line ecl
      WHERE ecl.employee_no IN ('TEST-OO1', 'TEST-OO3', 'TEST-O11', 'TEST-006', 'TEST-005', 'TEST-009', 'TEST-007')
      AND ecl.clock_in_date = '2025-12-22'
      ORDER BY ecl.employee_no, ecl.clock_in;
    `;

        const verificationResult = await brkPool.query(verificationQuery);

        console.log(`Found ${verificationResult.rows.length} records for 2025-12-22:\n`);

        if (verificationResult.rows.length === 0) {
            console.log('⚠️  NO RECORDS FOUND for these employees on 2025-12-22');
            console.log('   This means none of these employees clocked in on that date.\n');
            return;
        }

        const missingClockouts = verificationResult.rows.filter(row => row.status === 'MISSING CLOCKOUT');
        const hasClockouts = verificationResult.rows.filter(row => row.status === 'HAS CLOCKOUT');

        console.log('📊 SUMMARY:');
        console.log(`   Total Records: ${verificationResult.rows.length}`);
        console.log(`   Missing Clockouts: ${missingClockouts.length}`);
        console.log(`   Already Has Clockouts: ${hasClockouts.length}\n`);

        // Display detailed results
        console.log('📋 DETAILED RECORDS:\n');
        verificationResult.rows.forEach((row, index) => {
            console.log(`${index + 1}. Employee: ${row.employee_no}`);
            console.log(`   ID: ${row.id}`);
            console.log(`   Clock In: ${row.clock_in_date} ${row.clock_in || 'N/A'}`);
            console.log(`   Clock Out: ${row.clock_out_date || 'N/A'} ${row.clock_out || 'N/A'}`);
            console.log(`   Status: ${row.status === 'MISSING CLOCKOUT' ? '❌ MISSING' : '✅ HAS CLOCKOUT'}`);
            console.log(`   In Location: ${row.clock_in_location || 'N/A'}`);
            console.log(`   Out Location: ${row.clock_out_location || 'N/A'}`);
            console.log('');
        });

        if (missingClockouts.length === 0) {
            console.log('✅ ALL EMPLOYEES ALREADY HAVE CLOCKOUT DATA!');
            console.log('   No updates needed.\n');
            return;
        }

        // Execute the UPDATE
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  STEP 2: EXECUTION - Updating Missing Clockouts');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`⚡ Updating ${missingClockouts.length} records with clockout data...`);
        console.log('   Clock Out Time: 2025-12-22 18:00:00');
        console.log('   Location: 15, Thanjavur, Tamil Nadu, 613001, India');
        console.log('   Coordinates: (10.7788144, 79.1611306)\n');

        const updateQuery = `
      UPDATE employee_clocking_line
      SET 
          clock_out_date = '2025-12-22',
          clock_out = '18:00:00',
          clock_out_location = '15, Thanjavur, Tamil Nadu, 613001, India',
          out_lat = '10.7788144',
          out_lan = '79.1611306',
          write_date = NOW()
      WHERE employee_no IN ('TEST-OO1', 'TEST-OO3', 'TEST-O11', 'TEST-006', 'TEST-005', 'TEST-009', 'TEST-007')
      AND clock_in_date = '2025-12-22'
      AND clock_out IS NULL;
    `;

        const updateResult = await brkPool.query(updateQuery);
        console.log(`✅ UPDATE COMPLETE!`);
        console.log(`   Records Updated: ${updateResult.rowCount}\n`);

        // Final verification
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  STEP 3: FINAL VERIFICATION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const finalVerificationQuery = `
      SELECT 
          ecl.id,
          ecl.employee_no,
          ecl.clock_in_date,
          ecl.clock_in,
          ecl.clock_out_date,
          ecl.clock_out,
          ecl.clock_in_location,
          ecl.clock_out_location,
          'UPDATED' as status
      FROM employee_clocking_line ecl
      WHERE ecl.employee_no IN ('TEST-OO1', 'TEST-OO3', 'TEST-O11', 'TEST-006', 'TEST-005', 'TEST-009', 'TEST-007')
      AND ecl.clock_in_date = '2025-12-22'
      AND ecl.clock_out = '18:00:00'
      ORDER BY ecl.employee_no;
    `;

        const finalResult = await brkPool.query(finalVerificationQuery);

        console.log(`✅ VERIFICATION: ${finalResult.rows.length} records now have clockout time 18:00:00\n`);

        console.log('📋 UPDATED RECORDS:\n');
        finalResult.rows.forEach((row, index) => {
            console.log(`${index + 1}. Employee: ${row.employee_no}`);
            console.log(`   ID: ${row.id}`);
            console.log(`   Clock In: ${row.clock_in_date} ${row.clock_in}`);
            console.log(`   Clock Out: ${row.clock_out_date} ${row.clock_out} ✅`);
            console.log('');
        });

        // Final summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  ✅ SUCCESS - All Missing Clockouts Fixed!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📊 FINAL SUMMARY:');
        console.log(`   Date: 2025-12-22`);
        console.log(`   Clockout Time: 18:00:00 (6 PM)`);
        console.log(`   Employees Processed: ${verificationResult.rows.length}`);
        console.log(`   Records Updated: ${updateResult.rowCount}`);
        console.log(`   Records Verified: ${finalResult.rows.length}\n`);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nStack Trace:', error.stack);
    } finally {
        // Close connections
        if (brkPool) await brkPool.end();
        await attendancePool.end();
        console.log('🔌 Database connections closed.\n');
    }
}

// Run the script
fixMissingClockouts();
