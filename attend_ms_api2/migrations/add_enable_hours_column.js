/**
 * Migration script to add enable_hours column to hr_employee table
 * - BRK: true for all employees
 * - AILAB: true for all employees
 * - SKK: false for all employees
 */
import { getCompanyPool, masterPool } from '../src/multiCompanyDb.js';

async function addEnableHoursColumn() {
    console.log('🚀 Starting enable_hours column migration...\n');

    const companySettings = {
        'BRK': true,
        'AILAB': true,
        'SKK': false
    };

    for (const [companyCode, enableHoursValue] of Object.entries(companySettings)) {
        console.log(`\n📦 Processing company: ${companyCode} (enable_hours = ${enableHoursValue})`);

        try {
            const pool = await getCompanyPool(companyCode);

            // Check if column already exists
            const checkColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'hr_employee' 
        AND column_name = 'enable_hours'
      `;

            const columnExists = await pool.query(checkColumnQuery);

            if (columnExists.rows.length === 0) {
                // Add the column with default value
                console.log(`   Adding enable_hours column with default = ${enableHoursValue}...`);

                await pool.query(`
          ALTER TABLE hr_employee 
          ADD COLUMN enable_hours BOOLEAN DEFAULT ${enableHoursValue}
        `);

                console.log(`   ✅ Column added successfully`);
            } else {
                console.log(`   ℹ️  Column already exists, updating values...`);
            }

            // Update all existing employees with the correct value
            const updateResult = await pool.query(`
        UPDATE hr_employee 
        SET enable_hours = $1 
        WHERE enable_hours IS NULL OR enable_hours != $1
      `, [enableHoursValue]);

            console.log(`   ✅ Updated ${updateResult.rowCount} employees to enable_hours = ${enableHoursValue}`);

            // Verify the update
            const verifyQuery = await pool.query(`
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN enable_hours = true THEN 1 END) as enabled,
               COUNT(CASE WHEN enable_hours = false THEN 1 END) as disabled
        FROM hr_employee
      `);

            const stats = verifyQuery.rows[0];
            console.log(`   📊 Verification: ${stats.total} total employees, ${stats.enabled} enabled, ${stats.disabled} disabled`);

        } catch (error) {
            console.error(`   ❌ Error processing ${companyCode}:`, error.message);
        }
    }

    console.log('\n✅ Migration completed successfully!');

    // Close connections
    await masterPool.end();
    process.exit(0);
}

addEnableHoursColumn().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
