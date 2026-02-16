import pkg from 'pg';
const { Pool } = pkg;
import { getCompanyPool } from './src/multiCompanyDb.js';

async function addColumnsToCompany(companyCode) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔄 Adding columns to ${companyCode} database...`);
    console.log(`${'='.repeat(70)}\n`);

    const pool = await getCompanyPool(companyCode);

    const migrations = [
      // Add exact coordinates to employee_clocking_line
      {
        name: 'in_lat_exact',
        sql: 'ALTER TABLE employee_clocking_line ADD COLUMN IF NOT EXISTS in_lat_exact DOUBLE PRECISION;'
      },
      {
        name: 'in_lng_exact',
        sql: 'ALTER TABLE employee_clocking_line ADD COLUMN IF NOT EXISTS in_lng_exact DOUBLE PRECISION;'
      },
      {
        name: 'out_lat_exact',
        sql: 'ALTER TABLE employee_clocking_line ADD COLUMN IF NOT EXISTS out_lat_exact DOUBLE PRECISION;'
      },
      {
        name: 'out_lng_exact',
        sql: 'ALTER TABLE employee_clocking_line ADD COLUMN IF NOT EXISTS out_lng_exact DOUBLE PRECISION;'
      },
      // Add face descriptor to hr_employee
      {
        name: 'l_face_descriptor',
        sql: 'ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS l_face_descriptor Text;'
      },
      // Add holiday_type to hr_leave
      {
        name: 'holiday_type',
        sql: 'ALTER TABLE hr_leave ADD COLUMN IF NOT EXISTS holiday_type VARCHAR(50);'
      },
      // Create indexes
      {
        name: 'idx_ecl_in_lat_exact',
        sql: 'CREATE INDEX IF NOT EXISTS idx_ecl_in_lat_exact ON employee_clocking_line(in_lat_exact);'
      },
      {
        name: 'idx_ecl_in_lng_exact',
        sql: 'CREATE INDEX IF NOT EXISTS idx_ecl_in_lng_exact ON employee_clocking_line(in_lng_exact);'
      },
      {
        name: 'idx_ecl_out_lat_exact',
        sql: 'CREATE INDEX IF NOT EXISTS idx_ecl_out_lat_exact ON employee_clocking_line(out_lat_exact);'
      },
      {
        name: 'idx_ecl_out_lng_exact',
        sql: 'CREATE INDEX IF NOT EXISTS idx_ecl_out_lng_exact ON employee_clocking_line(out_lng_exact);'
      },
      {
        name: 'idx_hr_employee_face',
        sql: 'CREATE INDEX IF NOT EXISTS idx_hr_employee_face ON hr_employee(l_face_descriptor) WHERE l_face_descriptor IS NOT NULL;'
      }
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const migration of migrations) {
      try {
        await pool.query(migration.sql);
        successCount++;
        console.log(`✅ ${migration.name}`);
      } catch (err) {
        if (err.code === '42701' || err.code === '42P07' || err.message.includes('already exists')) {
          skipCount++;
          console.log(`⚠️  ${migration.name} (already exists)`);
        } else {
          errorCount++;
          console.error(`❌ ${migration.name}: ${err.message}`);
        }
      }
    }

    console.log(`\n📊 Summary for ${companyCode}:`);
    console.log(`   ✅ Added: ${successCount}`);
    console.log(`   ⚠️  Already exists: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);

    await pool.end();
    return errorCount === 0;
  } catch (err) {
    console.error(`❌ Failed to add columns to ${companyCode}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting database migrations for SKK and AILAB...');
  console.log('   (BRK already has these columns)\n');

  const companies = ['SKK', 'AILAB'];
  let allSuccess = true;

  for (const company of companies) {
    const success = await addColumnsToCompany(company);
    if (!success) allSuccess = false;
  }

  if (allSuccess) {
    console.log('\n✅ All migrations completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart the backend API: npm start');
    console.log('   2. Test clock-in/out functionality');
    console.log('   3. Verify facial authentication\n');
  } else {
    console.log('\n⚠️  Some migrations encountered errors. Please check above.\n');
  }

  process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
