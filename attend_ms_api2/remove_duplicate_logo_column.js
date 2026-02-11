import pkg from 'pg';
const { Pool } = pkg;

async function removeDuplicateColumn() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n🔄 Removing duplicate logo_content_type column...\n');
    console.log('📝 Keeping: logo_mime_type (has correct data)');
    console.log('🗑️  Removing: logo_content_type (duplicate)\n');

    // Drop the logo_content_type column
    await pool.query(`
      ALTER TABLE companies 
      DROP COLUMN IF EXISTS logo_content_type
    `);

    console.log('✅ logo_content_type column removed successfully\n');

    // Verify the remaining columns
    console.log('📊 Verifying remaining logo columns:\n');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'companies'
        AND column_name LIKE '%logo%'
      ORDER BY column_name
    `);

    console.log('Remaining logo columns:');
    console.log('─'.repeat(50));
    columnsResult.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name.padEnd(20)} | ${col.data_type}`);
    });
    console.log('─'.repeat(50));

    // Verify data is intact
    console.log('\n📋 Verifying company logo data:\n');
    const dataResult = await pool.query(`
      SELECT 
        company_code,
        logo_mime_type,
        CASE WHEN logo_image IS NOT NULL 
             THEN CONCAT(ROUND(LENGTH(logo_image) / 1024.0, 2), ' KB')
             ELSE 'No Image' 
        END as logo_size
      FROM companies
      WHERE company_code IN ('AILAB', 'SKK', 'BRK')
      ORDER BY company_code
    `);

    console.log('Company Logo Status:');
    console.log('─'.repeat(60));
    dataResult.rows.forEach(row => {
      const status = row.logo_size !== 'No Image' ? '✅' : '❌';
      console.log(`${status} ${row.company_code.padEnd(10)} | ${row.logo_size.padEnd(15)} | ${row.logo_mime_type}`);
    });
    console.log('─'.repeat(60));

    await pool.end();
    console.log('\n✅ Cleanup completed successfully!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

removeDuplicateColumn();
