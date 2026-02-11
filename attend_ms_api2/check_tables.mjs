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

async function checkTables() {
  try {
    console.log('🔍 Checking database table structures...\n');

    // Check hr_leave table structure
    const leaveTableQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_leave'
      ORDER BY ordinal_position;
    `;

    const leaveTableResult = await pool.query(leaveTableQuery);
    console.log(`📋 hr_leave table columns (${leaveTableResult.rows.length}):`);
    leaveTableResult.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type}) - ${row.is_nullable}`);
    });

    // Check hr_leave_type table structure
    const leaveTypeTableQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_leave_type'
      ORDER BY ordinal_position;
    `;

    const leaveTypeTableResult = await pool.query(leaveTypeTableQuery);
    console.log(`\n📋 hr_leave_type table columns (${leaveTypeTableResult.rows.length}):`);
    if (leaveTypeTableResult.rows.length > 0) {
      leaveTypeTableResult.rows.forEach(row => {
        console.log(`   ${row.column_name} (${row.data_type}) - ${row.is_nullable}`);
      });
    } else {
      console.log('   ❌ hr_leave_type table not found');
    }

    // Check hr_leave_allocation table structure
    const allocationTableQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_leave_allocation'
      ORDER BY ordinal_position;
    `;

    const allocationTableResult = await pool.query(allocationTableQuery);
    console.log(`\n📋 hr_leave_allocation table columns (${allocationTableResult.rows.length}):`);
    if (allocationTableResult.rows.length > 0) {
      allocationTableResult.rows.forEach(row => {
        console.log(`   ${row.column_name} (${row.data_type}) - ${row.is_nullable}`);
      });
    } else {
      console.log('   ❌ hr_leave_allocation table not found');
    }

    // Check for any tables with 'leave' in the name
    const leaveTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name LIKE '%leave%'
      ORDER BY table_name;
    `;

    const leaveTablesResult = await pool.query(leaveTablesQuery);
    console.log(`\n📋 Tables with 'leave' in name (${leaveTablesResult.rows.length}):`);
    leaveTablesResult.rows.forEach(row => {
      console.log(`   ${row.table_name}`);
    });

    // Simple query to check if hr_leave has data for employee 267
    const simpleLeaveQuery = `
      SELECT COUNT(*) as count
      FROM hr_leave
      WHERE employee_id = 267;
    `;

    const simpleLeaveResult = await pool.query(simpleLeaveQuery);
    console.log(`\n📊 Leave records for employee 267: ${simpleLeaveResult.rows[0].count}`);

    // Check first few records from hr_leave
    const sampleLeaveQuery = `
      SELECT *
      FROM hr_leave
      WHERE employee_id = 267
      LIMIT 5;
    `;

    const sampleLeaveResult = await pool.query(sampleLeaveQuery);
    console.log(`\n📋 Sample leave records for employee 267:`);
    if (sampleLeaveResult.rows.length > 0) {
      console.log('First record keys:', Object.keys(sampleLeaveResult.rows[0]));
      sampleLeaveResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Record:`, JSON.stringify(row, null, 2));
      });
    } else {
      console.log('   ❌ No leave records found');
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
