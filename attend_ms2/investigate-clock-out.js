/**
 * Investigate Clock-Out Issues
 * Checks why users aren't clocking out
 * Run: node investigate-clock-out.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function investigateClockOut() {
  console.log('=== Clock-Out Investigation ===\n');

  try {
    // 1. Check users with open clock-ins (no clock-out)
    console.log('1. Users with OPEN clock-ins (no clock-out):');
    const openClockIns = await pool.query(`
      SELECT 
        u.emp_no,
        u.name,
        ae.date,
        ae.site_name,
        ae.project_name,
        to_timestamp(ci.timestamp/1000) as clock_in_time,
        CASE 
          WHEN ae.clock_out_id IS NULL THEN 'NO CLOCK OUT'
          ELSE 'HAS CLOCK OUT'
        END as status
      FROM attendance_entries ae
      JOIN users u ON u.id = ae.user_id
      JOIN clock_events ci ON ae.clock_in_id = ci.id
      WHERE ae.date >= CURRENT_DATE - interval '3 days'
        AND ae.clock_out_id IS NULL
      ORDER BY ae.date DESC, ci.timestamp DESC
      LIMIT 20
    `);

    if (openClockIns.rows.length === 0) {
      console.log('   ✅ No open clock-ins found (all users clocked out)\n');
    } else {
      console.log(`   ⚠️  Found ${openClockIns.rows.length} open clock-ins:\n`);
      openClockIns.rows.forEach(row => {
        console.log(`   - ${row.emp_no} (${row.name})`);
        console.log(`     Date: ${row.date}`);
        console.log(`     Site: ${row.site_name || '(none)'}, Project: ${row.project_name || '(none)'}`);
        console.log(`     Clock In: ${row.clock_in_time}`);
        console.log(`     Status: ${row.status}\n`);
      });
    }

    // 2. Check all clock events (IN and OUT) for last 3 days
    console.log('2. All Clock Events (Last 3 days):');
    const allEvents = await pool.query(`
      SELECT 
        u.emp_no,
        u.name,
        ce.type,
        ce.method,
        to_timestamp(ce.timestamp/1000) as event_time,
        ce.site_name,
        ce.project_name
      FROM clock_events ce
      JOIN users u ON u.id = ce.user_id
      WHERE ce.timestamp > extract(epoch from (CURRENT_DATE - interval '3 days')) * 1000
      ORDER BY ce.timestamp DESC
      LIMIT 30
    `);

    const inEvents = allEvents.rows.filter(r => r.type === 'in');
    const outEvents = allEvents.rows.filter(r => r.type === 'out');

    console.log(`   Total events: ${allEvents.rows.length}`);
    console.log(`   Clock IN events: ${inEvents.length}`);
    console.log(`   Clock OUT events: ${outEvents.length}\n`);

    if (outEvents.length === 0) {
      console.log('   ❌ NO CLOCK-OUT EVENTS FOUND!\n');
      console.log('   Possible causes:');
      console.log('   1. Clock-out button not working in mobile app');
      console.log('   2. Clock-out validation failing');
      console.log('   3. Users not attempting to clock out');
      console.log('   4. Database constraint preventing clock-out\n');
    } else {
      console.log('   Recent clock-out events:\n');
      outEvents.slice(0, 10).forEach(event => {
        console.log(`   - ${event.emp_no} (${event.name}): OUT`);
        console.log(`     Time: ${event.event_time}`);
        console.log(`     Method: ${event.method}`);
        console.log(`     Site: ${event.site_name || '(none)'}, Project: ${event.project_name || '(none)'}\n`);
      });
    }

    // 3. Check attendance_entries for completed vs incomplete
    console.log('3. Attendance Entry Status (Last 3 days):');
    const entryStatus = await pool.query(`
      SELECT 
        ae.date,
        COUNT(*) as total_entries,
        COUNT(ae.clock_in_id) as has_clock_in,
        COUNT(ae.clock_out_id) as has_clock_out,
        COUNT(*) FILTER (WHERE ae.clock_in_id IS NOT NULL AND ae.clock_out_id IS NOT NULL) as complete,
        COUNT(*) FILTER (WHERE ae.clock_in_id IS NOT NULL AND ae.clock_out_id IS NULL) as incomplete
      FROM attendance_entries ae
      WHERE ae.date >= CURRENT_DATE - interval '3 days'
      GROUP BY ae.date
      ORDER BY ae.date DESC
    `);

    console.log('   Date       | Total | Complete | Incomplete');
    console.log('   -----------|-------|----------|------------');
    entryStatus.rows.forEach(row => {
      const date = new Date(row.date).toISOString().split('T')[0];
      console.log(`   ${date} |   ${row.total_entries}   |    ${row.complete}     |     ${row.incomplete}`);
    });
    console.log();

    // 4. Check specific users who clocked in multiple times
    console.log('4. Users with Multiple Clock-Ins (Same Day):');
    const duplicates = await pool.query(`
      SELECT 
        u.emp_no,
        u.name,
        ae.date,
        COUNT(*) as clock_in_count,
        array_agg(ae.site_name || ' / ' || ae.project_name) as locations
      FROM attendance_entries ae
      JOIN users u ON u.id = ae.user_id
      WHERE ae.date >= CURRENT_DATE - interval '3 days'
        AND ae.clock_in_id IS NOT NULL
      GROUP BY u.emp_no, u.name, ae.date
      HAVING COUNT(*) > 1
      ORDER BY ae.date DESC, clock_in_count DESC
    `);

    if (duplicates.rows.length === 0) {
      console.log('   ✅ No duplicate clock-ins found\n');
    } else {
      console.log(`   ⚠️  Found ${duplicates.rows.length} cases of multiple clock-ins:\n`);
      duplicates.rows.forEach(row => {
        console.log(`   - ${row.emp_no} (${row.name})`);
        console.log(`     Date: ${row.date}`);
        console.log(`     Clock-ins: ${row.clock_in_count}`);
        console.log(`     Locations: ${row.locations.join(', ')}\n`);
      });
    }

    // 5. Check attendance_days summary
    console.log('5. Attendance Days Summary (Last 3 days):');
    const daysSummary = await pool.query(`
      SELECT 
        ad.date,
        COUNT(*) as total_days,
        COUNT(ad.clock_in_id) as has_clock_in,
        COUNT(ad.clock_out_id) as has_clock_out,
        AVG(ad.normal_hours) as avg_normal_hours,
        AVG(ad.overtime_hours) as avg_overtime_hours
      FROM attendance_days ad
      WHERE ad.date >= CURRENT_DATE - interval '3 days'
      GROUP BY ad.date
      ORDER BY ad.date DESC
    `);

    console.log('   Date       | Records | Clock In | Clock Out | Avg Hours');
    console.log('   -----------|---------|----------|-----------|----------');
    daysSummary.rows.forEach(row => {
      const date = new Date(row.date).toISOString().split('T')[0];
      const avgHours = parseFloat(row.avg_normal_hours || 0).toFixed(1);
      console.log(`   ${date} |    ${row.total_days}    |    ${row.has_clock_in}     |     ${row.has_clock_out}     |   ${avgHours}h`);
    });
    console.log();

    // 6. Recommendations
    console.log('=== RECOMMENDATIONS ===\n');

    if (outEvents.length === 0) {
      console.log('❌ CRITICAL: No clock-out events in last 3 days!');
      console.log('   Action: Test clock-out flow in mobile app immediately');
      console.log('   Steps:');
      console.log('   1. Login as a user who clocked in yesterday');
      console.log('   2. Try to clock out today');
      console.log('   3. Check console logs for errors');
      console.log('   4. Verify clock-out button is visible and enabled\n');
    }

    if (openClockIns.rows.length > 0) {
      console.log(`⚠️  ${openClockIns.rows.length} users have open clock-ins`);
      console.log('   Action: Remind users to clock out at end of day');
      console.log('   Consider: Auto clock-out at midnight or send reminders\n');
    }

    if (duplicates.rows.length > 0) {
      console.log(`⚠️  ${duplicates.rows.length} cases of multiple clock-ins per day`);
      console.log('   Action: Review if these are legitimate multi-site visits');
      console.log('   Consider: Enhance duplicate prevention logic\n');
    }

  } catch (error) {
    console.error('\n❌ Investigation failed!');
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run investigation
investigateClockOut().catch(console.error);
