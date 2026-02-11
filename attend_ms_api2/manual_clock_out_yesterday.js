// Manually clock out yesterday's record for B1-W422
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'CX18BRKERP',
  user: process.env.DB_USER || 'openpg',
  password: process.env.DB_PASSWORD || 'openpgpwd',
});

async function manualClockOut() {
  try {
    console.log('🔧 Manual Clock Out for B1-W422 (Yesterday\'s Record)...\n');
    
    // Get the most recent open clock-in (ID: 22477 from Nov 11)
    const openRecord = await pool.query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_in_date,
        ecl.clock_in_location,
        pp.name->>'en_US' as project_name,
        he.name as employee_name
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp ON ecl.project_id = pp.id
       LEFT JOIN hr_employee he ON ecl.employee_id = he.id
       WHERE ecl.employee_id = 245
         AND ecl.clock_out IS NULL
       ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC
       LIMIT 1`
    );
    
    if (openRecord.rows.length === 0) {
      console.log('❌ No open clock-in found for B1-W422');
      return;
    }
    
    const record = openRecord.rows[0];
    console.log('📋 Found open clock-in:');
    console.log('   ID:', record.id);
    console.log('   Employee:', record.employee_name);
    console.log('   Clock In:', record.clock_in, 'on', record.clock_in_date);
    console.log('   Location:', record.clock_in_location);
    console.log('   Project:', record.project_name || 'N/A');
    console.log('');
    
    // Calculate clock out time (use same date as clock in, but set time to 17:30:00)
    const clockOutTime = '17:30:00'; // 5:30 PM
    const clockOutDate = record.clock_in_date;
    
    console.log('⏰ Setting clock out to:', clockOutTime, 'on', clockOutDate);
    console.log('');
    
    // Update the record with clock out
    const updateResult = await pool.query(
      `UPDATE employee_clocking_line 
       SET clock_out = $1,
           clock_out_date = $2,
           clock_out_location = $3,
           out_lat = $4,
           out_lan = $5,
           out_add = $6,
           write_date = NOW()
       WHERE id = $7
       RETURNING id, clock_in, clock_out, clock_in_date, clock_out_date`,
      [
        clockOutTime,
        clockOutDate,
        record.clock_in_location, // Use same location as clock in
        '', // latitude (empty)
        '', // longitude (empty)
        record.clock_in_location, // address
        record.id
      ]
    );
    
    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('✅ Successfully clocked out!');
      console.log('');
      console.log('📊 Updated Record:');
      console.log('   ID:', updated.id);
      console.log('   Clock In:', updated.clock_in, 'on', updated.clock_in_date);
      console.log('   Clock Out:', updated.clock_out, 'on', updated.clock_out_date);
      console.log('');
      console.log('✅ B1-W422 is now ready to clock in fresh today!');
    } else {
      console.log('❌ Failed to update record');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

manualClockOut();
