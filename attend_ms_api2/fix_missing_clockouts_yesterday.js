/**
 * Script to fix missing clock-outs from yesterday
 * This finds all open clocking records (no clock_out) from yesterday
 * and sets a default clock-out time
 */

import { getCompanyPool } from './src/multiCompanyDb.js';

const COMPANY_CODE = 'SKK';
const YESTERDAY = '2026-01-12'; // Change this to the correct date

async function fixMissingClockouts() {
    console.log(`\n🔍 Looking for open clockings from ${YESTERDAY} in ${COMPANY_CODE}...\n`);

    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // First, let's see what open records exist
        const openRecords = await pool.query(`
      SELECT 
        ecl.id,
        ecl.employee_id,
        ecl.employee_no,
        he."x_Emp_No" as emp_no_from_hr,
        he.name as employee_name,
        ecl.clock_in,
        ecl.clock_in_date,
        ecl.site_name,
        ecl.project_name,
        ecl.project_id,
        ecl.clock_in_location
      FROM employee_clocking_line ecl
      LEFT JOIN hr_employee he ON ecl.employee_id = he.id
      WHERE ecl.clock_out IS NULL
        AND ecl.clock_in_date = $1::date
      ORDER BY ecl.clock_in_date, ecl.clock_in
    `, [YESTERDAY]);

        console.log(`Found ${openRecords.rows.length} open clocking records from ${YESTERDAY}:\n`);

        if (openRecords.rows.length === 0) {
            console.log('No open clockings found.');
            process.exit(0);
        }

        for (const row of openRecords.rows) {
            console.log(`  📋 ID: ${row.id}`);
            console.log(`     Employee: ${row.employee_name} (${row.emp_no_from_hr || row.employee_no})`);
            console.log(`     Clock In: ${row.clock_in} on ${row.clock_in_date}`);
            console.log(`     Site: ${row.site_name || 'N/A'}`);
            console.log(`     Project: ${row.project_name || 'N/A'} (ID: ${row.project_id || 'NULL'})`);
            console.log('');
        }

        // Ask for confirmation before fixing
        console.log('\n⚠️  This script will set clock_out to 18:00:00 for all these records.');
        console.log('    To execute the fix, run with --fix flag.\n');

        if (process.argv.includes('--fix')) {
            console.log('🔧 Fixing open clockings...\n');

            for (const row of openRecords.rows) {
                const defaultClockOut = '18:00:00';

                const updateResult = await pool.query(`
          UPDATE employee_clocking_line
          SET clock_out = $1,
              clock_out_date = clock_in_date,
              state = 'done',
              write_date = NOW(),
              -- Calculate hours
              tot_hrs = TRUNC((EXTRACT(EPOCH FROM ($1::time - clock_in::time)) / 3600.0)::numeric, 2)
          WHERE id = $2
          RETURNING id, clock_in, clock_out, tot_hrs
        `, [defaultClockOut, row.id]);

                if (updateResult.rows.length > 0) {
                    const updated = updateResult.rows[0];
                    console.log(`  ✅ Fixed ID ${updated.id}: ${updated.clock_in} → ${updated.clock_out} (${updated.tot_hrs} hrs)`);
                }
            }

            console.log('\n✅ All open clockings have been fixed.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }

    process.exit(0);
}

fixMissingClockouts();
