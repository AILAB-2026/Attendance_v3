import { getCompanyPool } from './src/multiCompanyDb.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const companyCode = 'SKK'; // Change if needed
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔧 RUNNING DATABASE MIGRATION: Add site_id Column`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Company: ${companyCode}`);
        console.log(`Migration: add_site_id_to_employee_clocking_line.sql\n`);

        // Get company database pool
        console.log('📡 Connecting to company database...');
        const pool = await getCompanyPool(companyCode);
        console.log('✅ Connected successfully\n');

        // Read migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', 'add_site_id_to_employee_clocking_line.sql');
        console.log(`📄 Reading migration file: ${migrationPath}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolons and filter out comments and empty lines
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // Skip comment-only statements
            if (statement.startsWith('/*') || statement.trim().length === 0) {
                continue;
            }

            console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
            console.log(`Statement preview: ${statement.substring(0, 100)}...`);

            try {
                const result = await pool.query(statement);
                console.log(`✅ Success!`, result.command ? `(${result.command})` : '');
            } catch (err) {
                // Check if error is because column/constraint already exists
                if (err.code === '42701') {
                    console.log(`⚠️  Column already exists, skipping...`);
                } else if (err.code === '42P07') {
                    console.log(`⚠️  Index/constraint already exists, skipping...`);
                } else {
                    console.error(`❌ Error: ${err.message}`);
                    throw err;
                }
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
        console.log(`${'='.repeat(80)}`);

        // Verify the column was added
        console.log('\n🔍 Verifying migration...');
        const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'employee_clocking_line' 
        AND column_name = 'site_id'
    `);

        if (verifyResult.rows.length > 0) {
            console.log('✅ Verification successful!');
            console.log('\nColumn details:');
            console.log(`  Name: ${verifyResult.rows[0].column_name}`);
            console.log(`  Type: ${verifyResult.rows[0].data_type}`);
            console.log(`  Nullable: ${verifyResult.rows[0].is_nullable}`);
        } else {
            console.log('❌ Warning: Column not found after migration!');
        }

        console.log('\n✅ Migration complete! You can now restart the backend API.\n');

    } catch (error) {
        console.error('\n❌ MIGRATION FAILED!');
        console.error('Error:', error.message);
        console.error('\nPlease check the error and try again.');
        process.exit(1);
    }

    process.exit(0);
}

runMigration();
