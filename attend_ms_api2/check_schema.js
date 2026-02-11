import { getCompanyPool } from './src/multiCompanyDb.js';

async function checkSchema() {
    try {
        const companyCode = 'SKK';
        const pool = await getCompanyPool(companyCode);

        // Get column information for employee_clocking_line table
        const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'employee_clocking_line'
        AND (column_name LIKE '%site%' OR column_name LIKE '%project%' OR column_name LIKE '%location%')
      ORDER BY ordinal_position
    `);

        console.log('\n' + '='.repeat(80));
        console.log('SITE/PROJECT RELATED COLUMNS IN employee_clocking_line');
        console.log('='.repeat(80));

        if (result.rows.length === 0) {
            console.log('No site/project related columns found');
        } else {
            result.rows.forEach(col => {
                console.log(`\nColumn: ${col.column_name}`);
                console.log(`  Type: ${col.data_type}`);
                console.log(`  Nullable: ${col.is_nullable}`);
                console.log(`  Default: ${col.column_default || 'NULL'}`);
            });
        }

        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit(0);
}

checkSchema();
