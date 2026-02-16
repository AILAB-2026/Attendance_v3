import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'CX18BRKERP',
  password: 'openpgpwd',
  port: 5432,
});

async function debugTimestamp() {
  try {
    console.log('🔍 Debugging Timestamp Conversion Issue');
    console.log('======================================');
    
    // Get the exact record that's causing issues
    const result = await pool.query(
      `SELECT 
        clock_in,
        clock_in_date,
        clock_out,
        clock_out_date
       FROM employee_clocking_line 
       WHERE id = 22495`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Record not found');
      return;
    }
    
    const row = result.rows[0];
    console.log('\n📊 Raw Database Values:');
    console.log('clock_in:', row.clock_in);
    console.log('clock_in_date:', row.clock_in_date);
    console.log('clock_in_date type:', typeof row.clock_in_date);
    console.log('clock_in_date toString:', row.clock_in_date.toString());
    
    // Test the current backend logic
    console.log('\n🔧 Testing Current Backend Logic:');
    const clockInDate = row.clock_in_date ? new Date(row.clock_in_date) : new Date();
    console.log('1. new Date(row.clock_in_date):', clockInDate);
    console.log('2. clockInDate.toString():', clockInDate.toString());
    
    const [hours, minutes, seconds] = row.clock_in.split(':');
    console.log('3. Parsed time parts:', { hours, minutes, seconds: seconds || 0 });
    
    clockInDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);
    console.log('4. After setHours():', clockInDate);
    console.log('5. Final timestamp:', clockInDate.getTime());
    console.log('6. Converted back:', new Date(clockInDate.getTime()));
    console.log('7. Local time string:', new Date(clockInDate.getTime()).toLocaleString());
    
    // Test correct approach
    console.log('\n✅ Testing Correct Approach:');
    // Create date in local timezone (Singapore)
    const correctDate = new Date(row.clock_in_date.getFullYear(), row.clock_in_date.getMonth(), row.clock_in_date.getDate());
    console.log('1. Correct date (local timezone):', correctDate);
    
    correctDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);
    console.log('2. After setHours():', correctDate);
    console.log('3. Correct timestamp:', correctDate.getTime());
    console.log('4. Converted back:', new Date(correctDate.getTime()));
    console.log('5. Local time string:', new Date(correctDate.getTime()).toLocaleString());
    
    // Compare timestamps
    console.log('\n📈 Comparison:');
    console.log('Wrong timestamp:', clockInDate.getTime());
    console.log('Correct timestamp:', correctDate.getTime());
    console.log('Difference (ms):', correctDate.getTime() - clockInDate.getTime());
    console.log('Difference (hours):', (correctDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugTimestamp();
