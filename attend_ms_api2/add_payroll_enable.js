import pkg from 'pg';
const { Pool } = pkg;

async function addPayrollEnableColumn() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'attendance_db',
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('\n=== Adding payroll_enable column to companies table ===\n');
    
    // Check if column already exists
    const checkResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'companies' AND column_name = 'payroll_enable'`
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Column payroll_enable already exists in companies table');
      await pool.end();
      return;
    }

    // Add the column
    await pool.query(
      `ALTER TABLE companies ADD COLUMN payroll_enable BOOLEAN DEFAULT true`
    );
    console.log('✅ Column payroll_enable added successfully with default value: true');

    // Verify the column was added
    const verifyResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'companies' AND column_name = 'payroll_enable'`
    );

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   Column: ${verifyResult.rows[0].column_name}`);
      console.log(`   Type: ${verifyResult.rows[0].data_type}`);
    }

    // Show current companies and their payroll_enable status
    const companiesResult = await pool.query(
      `SELECT company_code, company_name, payroll_enable FROM companies ORDER BY company_code`
    );

    console.log('\n=== Current companies payroll_enable status ===\n');
    companiesResult.rows.forEach(row => {
      console.log(`${row.company_code.padEnd(10)} | ${row.company_name.padEnd(25)} | payroll_enable: ${row.payroll_enable}`);
    });

    await pool.end();
    console.log('\n✅ Database update completed successfully\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

addPayrollEnableColumn();
