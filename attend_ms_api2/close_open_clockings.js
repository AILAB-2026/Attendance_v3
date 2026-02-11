import { getCompanyPool } from './src/multiCompanyDb.js';

async function closeOpenClockings(companyCode, daysOld = 7) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔧 Closing open clockings for ${companyCode} (older than ${daysOld} days)...`);
    console.log(`${'='.repeat(70)}\n`);

    const pool = await getCompanyPool(companyCode);

    // Find all open clockings older than X days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    console.log(`📅 Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`);
    console.log(`   (Closing all clockings before this date)\n`);

    const openClockings = await pool.query(`
      SELECT ecl.id, ecl.employee_id, he."x_Emp_No" as employee_no, he.name,
             ecl.clock_in_date, ecl.clock_in, ecl.project_id
      FROM employee_clocking_line ecl
      JOIN hr_employee he ON he.id = ecl.employee_id
      WHERE ecl.clock_out IS NULL
        AND ecl.clock_in_date < $1::date
      ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC
    `, [cutoffDate.toISOString().split('T')[0]]);

    if (openClockings.rows.length === 0) {
      console.log('✅ No old open clockings found. Database is clean!\n');
      await pool.end();
      return 0;
    }

    console.log(`⚠️  Found ${openClockings.rows.length} old open clockings:\n`);
    openClockings.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.employee_no} (${row.name})`);
      console.log(`      Clocked in: ${row.clock_in_date} ${row.clock_in}`);
    });

    console.log(`\n🔄 Closing these clockings by setting clock_out to end of shift...\n`);

    // Close each clocking by setting clock_out to 8 hours after clock_in
    for (const row of openClockings.rows) {
      try {
        // Calculate clock_out as clock_in + 8 hours (default shift)
        const clockOutTime = new Date(`${row.clock_in_date.toISOString().split('T')[0]}T${row.clock_in}`);
        clockOutTime.setHours(clockOutTime.getHours() + 8);
        const clockOutTimeStr = clockOutTime.toTimeString().split(' ')[0];

        await pool.query(`
          UPDATE employee_clocking_line
          SET clock_out = $1,
              clock_out_date = clock_in_date,
              clock_out_location = 'Auto-closed (system cleanup)',
              state = 'done',
              tot_hrs = 8.00,
              normal_hrs = 8.00,
              rest_hrs = 0.00,
              ot_hours = 0.00,
              write_date = NOW()
          WHERE id = $2
        `, [clockOutTimeStr, row.id]);

        console.log(`   ✅ Closed clocking ID ${row.id} for ${row.employee_no}`);
      } catch (err) {
        console.error(`   ❌ Failed to close clocking ID ${row.id}: ${err.message}`);
      }
    }

    console.log(`\n✅ Closed ${openClockings.rows.length} old open clockings for ${companyCode}\n`);

    await pool.end();
    return openClockings.rows.length;

  } catch (err) {
    console.error(`❌ Error closing open clockings for ${companyCode}:`, err.message);
    return -1;
  }
}

async function main() {
  console.log('\n🚀 Close Open Clockings Tool\n');
  console.log('This will close all open clockings older than 7 days');
  console.log('by setting clock_out to 8 hours after clock_in.\n');

  const companies = ['SKK', 'AILAB'];
  const results = {};

  for (const company of companies) {
    results[company] = await closeOpenClockings(company, 7);
  }

  console.log('='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  let totalClosed = 0;
  for (const [company, count] of Object.entries(results)) {
    if (count >= 0) {
      console.log(`✅ ${company}: Closed ${count} open clockings`);
      totalClosed += count;
    } else {
      console.log(`❌ ${company}: Failed`);
    }
  }
  
  console.log(`\n🎉 Total: ${totalClosed} open clockings closed\n`);
  console.log('📝 Next steps:');
  console.log('   1. Restart the mobile app');
  console.log('   2. Login as SKK or AILAB employee');
  console.log('   3. Try clock-in - should now show "Clock In" button');
  console.log('   4. Clock in should work and write to database\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
