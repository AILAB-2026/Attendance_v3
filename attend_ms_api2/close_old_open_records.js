/**
 * Script to close all old open clocking records (older than today)
 * This fixes the issue where users have many old unclosed records
 * causing the app to show "Clock Out" instead of "Clock In"
 */
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';
const DRY_RUN = process.argv.includes('--dry-run');

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`  CLOSE OLD OPEN CLOCKING RECORDS FOR ${COMPANY_CODE}`);
        console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update records)'}`);
        console.log(`${'='.repeat(60)}\n`);

        // Count old open records (before today)
        const countResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM employee_clocking_line
            WHERE clock_out IS NULL
              AND clock_in_date < (NOW() AT TIME ZONE 'Asia/Singapore')::date
        `);

        console.log(`Found ${countResult.rows[0].count} old open records to close.\n`);

        if (parseInt(countResult.rows[0].count) === 0) {
            console.log('No old open records found. Nothing to do.');
            process.exit(0);
        }

        if (DRY_RUN) {
            // Show sample of what would be affected
            const sampleResult = await pool.query(`
                SELECT 
                    ecl.id,
                    he."x_Emp_No" as emp_no,
                    ecl.clock_in_date,
                    ecl.clock_in::text as clock_in
                FROM employee_clocking_line ecl
                JOIN hr_employee he ON ecl.employee_id = he.id
                WHERE ecl.clock_out IS NULL
                  AND ecl.clock_in_date < (NOW() AT TIME ZONE 'Asia/Singapore')::date
                ORDER BY ecl.clock_in_date DESC
                LIMIT 20
            `);

            console.log('Sample records that would be closed:');
            sampleResult.rows.forEach(row => {
                console.log(`  ID: ${row.id} | ${row.emp_no} | Date: ${row.clock_in_date} | In: ${row.clock_in}`);
            });
            console.log('\nRun without --dry-run to actually close these records.');
        } else {
            // Actually close the old records
            // Set clock_out to 23:59:59, state to 'done'
            const updateResult = await pool.query(`
                UPDATE employee_clocking_line
                SET clock_out = '23:59:59',
                    clock_out_date = clock_in_date,
                    clock_out_location = 'Auto-closed (missing clock-out)',
                    state = 'done',
                    write_date = NOW()
                WHERE clock_out IS NULL
                  AND clock_in_date < (NOW() AT TIME ZONE 'Asia/Singapore')::date
                RETURNING id
            `);

            console.log(`Successfully closed ${updateResult.rowCount} old open records.`);
        }

        // Show remaining open count
        const remainingResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM employee_clocking_line
            WHERE clock_out IS NULL
        `);

        console.log(`\nRemaining open records (all dates): ${remainingResult.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
};

run();
