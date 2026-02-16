import pkg from 'pg';
const { Pool } = pkg;
import { getCompanyConfig, getCompanyPool } from './src/multiCompanyDb.js';

async function diagnoseCompany(companyCode) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Diagnosing ${companyCode} company...`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // 1. Check company configuration
    console.log('1️⃣ Checking company configuration in master DB...');
    const config = await getCompanyConfig(companyCode);
    
    if (!config) {
      console.error(`❌ Company ${companyCode} not found in master database`);
      return false;
    }

    console.log('✅ Company configuration found:');
    console.log(`   - Company Name: ${config.company_name}`);
    console.log(`   - Database: ${config.database_name}`);
    console.log(`   - Host: ${config.server_host}:${config.server_port}`);
    console.log(`   - Active: ${config.active}`);

    if (!config.active) {
      console.error(`❌ Company ${companyCode} is marked as INACTIVE`);
      return false;
    }

    // 2. Test database connection
    console.log('\n2️⃣ Testing database connection...');
    const pool = await getCompanyPool(companyCode);
    
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ Database connection successful`);
    console.log(`   - Current DB time: ${testResult.rows[0].current_time}`);

    // 3. Check if employee_clocking_line table exists
    console.log('\n3️⃣ Checking employee_clocking_line table...');
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employee_clocking_line' 
      AND column_name IN ('in_lat_exact', 'in_lng_exact', 'out_lat_exact', 'out_lng_exact', 'l_face_descriptor')
      ORDER BY column_name
    `);

    if (tableCheck.rows.length === 0) {
      console.error(`❌ Required columns not found in employee_clocking_line`);
    } else {
      console.log(`✅ Found ${tableCheck.rows.length} required columns:`);
      tableCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }

    // 4. Check for test employees
    console.log('\n4️⃣ Checking for active employees...');
    const empCheck = await pool.query(`
      SELECT id, "x_Emp_No" as employee_no, name, active
      FROM hr_employee 
      WHERE active = true
      ORDER BY id
      LIMIT 5
    `);

    if (empCheck.rows.length === 0) {
      console.error(`❌ No active employees found in ${companyCode}`);
    } else {
      console.log(`✅ Found ${empCheck.rows.length} active employees (showing first 5):`);
      empCheck.rows.forEach(emp => {
        console.log(`   - ${emp.employee_no}: ${emp.name} (ID: ${emp.id})`);
      });
    }

    // 5. Check for open clockings
    console.log('\n5️⃣ Checking for open clockings...');
    const openCheck = await pool.query(`
      SELECT ecl.id, ecl.employee_id, he."x_Emp_No" as employee_no, he.name,
             ecl.clock_in_date, ecl.clock_in, ecl.clock_out
      FROM employee_clocking_line ecl
      JOIN hr_employee he ON he.id = ecl.employee_id
      WHERE ecl.clock_out IS NULL
      ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC
      LIMIT 10
    `);

    if (openCheck.rows.length === 0) {
      console.log(`✅ No open clockings found (clean state)`);
    } else {
      console.warn(`⚠️  Found ${openCheck.rows.length} open clockings:`);
      openCheck.rows.forEach(row => {
        console.log(`   - ${row.employee_no} (${row.name}): Clocked in at ${row.clock_in} on ${row.clock_in_date}`);
      });
    }

    await pool.end();
    return true;

  } catch (err) {
    console.error(`❌ Error diagnosing ${companyCode}:`, err.message);
    console.error(`   Stack: ${err.stack}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Company Database Diagnostic Tool\n');

  const companies = ['BRK', 'SKK', 'AILAB'];
  const results = {};

  for (const company of companies) {
    results[company] = await diagnoseCompany(company);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  for (const [company, success] of Object.entries(results)) {
    console.log(`${success ? '✅' : '❌'} ${company}: ${success ? 'OK' : 'FAILED'}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
